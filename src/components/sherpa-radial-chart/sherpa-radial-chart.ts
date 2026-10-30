/**
 * sherpa-radial-chart — one ring, drawn as a donut, a pie or an arc.
 *
 * The gauge COMPOSES this for its arc rather than redrawing one; it keeps its
 * own needle, zones, scale and caption. TRAP T-a-gauge-composes-the-ring
 *
 * TRAP T-donut-slice-is-a-closed-path — each slice is ONE closed <path>; a
 * stroked circle can express neither the full border nor the rounded corners.
 * TRAP T-hiding-a-series-rescales-the-axis — the rest re-share the full circle.
 *
 * Map:
 * - RadialSlice — One slice — an alias of the shared `ChartDatum`.
 */
import { datumTotal, type ChartDatum } from '../../core/data/chart-datum.js';
import { SUMMARY_PROPS, SherpaElement, define } from '../../core/ui/sherpa-element.js';
import type { DataAsk } from '../../core/ui/context.js';
import { formatValue, radialArea, ringInset, ringSegmentPath } from '../../core/data/format-tick.js';
import { fillTip, pairAnchor, paintSeries, paintTone, redrawOnResize, unitsPerPixel, partsSaid } from '../../core/ui/chart-parts.js';
import { rovingFocus, type Roving } from '../../core/ui/roving-focus.js';
import { RADIAL_CENTRE as CENTRE, RADIAL_CORNER as CORNER,
  RADIAL_OUTLINE as OUTLINE, DONUT_INNER_RATIO, SEGMENT_GAP, SECTION_GAP } from '../../core/ui/shared-constants.js';

/** One slice — an alias of the shared `ChartDatum`. */
export type RadialSlice = ChartDatum;

const MIN_SHARE = 0.005;

export class SherpaRadialChart extends SherpaElement {
  static override css = [
    new URL('../../core/sherpa-chart-frame.css', import.meta.url),
    new URL('../../core/sherpa-chart-segments.css', import.meta.url),
    new URL('./sherpa-radial-chart.css', import.meta.url),
  ];
  static override html = new URL('./sherpa-radial-chart.html', import.meta.url);
  static override asks: DataAsk = { shape: 'segments', stacks: true };
  // A host's aria-label names the chart. TRAP T-a-host-label-must-reach-its-control
  static override labelTarget = '.ring';
  static override props = {
    ...SUMMARY_PROPS,
    'data-label': { type: 'string', kind: 'content' },
    'data-sublabel': { type: 'string', kind: 'content' },
    'data-type': { type: 'enum', kind: 'style', values: ['donut', 'pie'] },
    // The arc. A gauge is this ring stopped short — 270° for 180°.
    'data-sweep-start': { type: 'number', kind: 'behaviour' },
    'data-sweep': { type: 'number', kind: 'behaviour' },
    'data-inner': { type: 'string', kind: 'behaviour' },
  } as const;

  /** The slices, as populated. */
  #slices: RadialSlice[] = [];
  /** One tab stop for the ring; the arrows move between slices. TRAP T-one-tab-stop-per-set */
  #roving: Roving | null = null;

  override onRender(): void {
    this.#syncCentre();
    const slices = this.$('.slices');
    slices?.addEventListener('click', this.#onClick);
    // Enter and Space press the focused slice, as a click does. TODO 318
    slices?.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      this.#onClick(event);
    });
    if (slices) this.#roving = rovingFocus(slices, { items: '.slice' });
    if (this.#slices.length) this.#renderRing();
  }

  override onChange(): void {
    this.#syncCentre();
    // data-type changes ring thickness, so re-measure the arcs.
    if (this.#slices.length) this.#renderRing();
  }

  /** populate([{ label, value, colorIndex? }]) — the slices. */
  protected override renderData(data: unknown): void {
    this.#slices = Array.isArray(data) ? (data as RadialSlice[]) : [];
    this.#renderRing();
    // The total moved, so the centre did too.
    this.#syncCentre();
  }

  get slices(): RadialSlice[] {
    return [...this.#slices];
  }

  /* ── Render ─────────────────────────────────────────────────────── */

  /** Draw the ring, keeping focus on its slice. */
  #renderRing(): void {
    const r = this.#roving;
    if (r) r.restamp(() => this.#drawRing());
    else this.#drawRing();
  }

  /** Draw the ring: one closed path per slice, and its hotspot. */
  #drawRing(): void {
    const group = this.$('.slices');
    const tpl = this.$<HTMLTemplateElement>('template.slice-tpl');
    if (!group || !tpl) return;

    const hotspots = this.$('.hotspots');
    const hotTpl = this.$<HTMLTemplateElement>('template.hotspot-tpl');
    group.replaceChildren();
    hotspots?.replaceChildren();

    // Inset half an outline, so the stroke lands INSIDE the true edges.
    const pie = this.dataset['type'] === 'pie';
    const outer = CENTRE - OUTLINE / 2;
    const inner = this.#inner(pie, outer);
    // The arc this ring fills. A full circle unless the host stops it short.
    const sweepStart = this.num('data-sweep-start', 0);
    const sweep = this.num('data-sweep', 360);

    // The slices it is given share the circle, so the ring always closes.
    // CLAMPED: a negative arc is not a shape. TRAP T-one-total-for-the-ring-and-the-label
    const total = datumTotal(this.#slices, { clamp: true });
    if (total <= 0) return;
    const marking = this.#slices.some((s) => s.matched != null);
    this.toggleState('highlighting', marking);
    const matchTpl = this.$<HTMLTemplateElement>('template.match-tpl');
    const partTpl = this.$<HTMLTemplateElement>('template.part-tpl');
    const ringTpl = this.$<HTMLTemplateElement>('template.ring-tpl');
    /* Real gaps, in px at the size it draws: each side gives up half a gap and the
       half of its outline that lands outside its path. Will, TODO 635
       TRAP T-a-chart-gap-is-real-space */
    const ring = this.$('.ring');
    if (ring) this.#sized ??= redrawOnResize(ring, () => this.#drawRing());
    const unit = unitsPerPixel(ring);
    const segmentPad = (SEGMENT_GAP * unit + OUTLINE) / 2;
    const sectionPad = SECTION_GAP * unit;
    /** A band's parts: each a shade or tint of its colour by its weight there, a gap
     *  between, none at the band's own edges, which its outline holds. Will, TODOs 548, 564, 635 */
    const partsIn = (parts: readonly { value: number }[] | undefined, whole: number, from: number, to: number,
      startDeg: number, spanDeg: number, index: number, colorIndex?: number): void => {
      const shown = (parts ?? []).filter((one) => one.value > 0);
      let within = 0;
      shown.forEach((p, n) => {
        const begins = within;
        within += whole ? p.value / whole : 0;
        const part = partTpl ? this.clone<SVGPathElement>(partTpl, '.slice-part') : null;
        if (!part) return;
        const [start, end] = ringInset(startDeg + spanDeg * begins, startDeg + spanDeg * within, from, to, sectionPad);
        part.setAttribute('d', ringSegmentPath({
          cx: CENTRE, cy: CENTRE, inner: from, outer: to,
          startDeg: n ? start : startDeg + spanDeg * begins, endDeg: n < shown.length - 1 ? end : startDeg + spanDeg * within,
        }));
        part.setAttribute('stroke-width', String(SECTION_GAP * unit));
        paintSeries(part, index, colorIndex);
        paintTone(part, p.value, shown.map((one) => one.value));
        group.appendChild(part);
      });
    };

    let acc = 0;
    this.#slices.forEach((slice, i) => {
      const value = Math.max(0, slice.value);
      const share = Math.max(value / total, MIN_SHARE);

      // A lone slice closes the ring, and has no neighbour to clear.
      const [gapStart, gapEnd] = this.#slices.length > 1
        ? ringInset(sweepStart + acc * sweep, sweepStart + (acc + share) * sweep, inner, outer, segmentPad)
        : [sweepStart + acc * sweep, sweepStart + (acc + share) * sweep];
      const edges = { startDeg: gapStart, endDeg: gapEnd };
      // No -90deg transform: ringSegmentPath already measures from 12 o'clock.
      const arc = this.clone<SVGPathElement>(tpl, '.slice');
      if (!arc) return;
      arc.dataset['index'] = String(i);
      arc.setAttribute(
        'd',
        ringSegmentPath({
          cx: CENTRE,
          cy: CENTRE,
          inner,
          outer,
          ...edges,
          /* A PIE SLICE HAS NO ROUNDING. Its two straight edges meet at the
             centre, and a corner radius there rounds the point off — the path
             started at 49 rather than the centre's 50. A donut's corners round
             because they sit on two ARCS, which is a different join.
             TRAP T-a-pie-slice-has-no-rounded-corner */
          radius: pie ? 0 : CORNER,
        }),
      );
      arc.setAttribute('stroke-width', String(OUTLINE));
      paintSeries(arc, i, slice.colorIndex);
      arc.toggleAttribute('data-stacked', !!slice.stack?.length);
      arc.toggleAttribute('data-split', !slice.stack?.length && !!slice.parts?.some((one) => one.value > 0));
      // The part the highlight's driver matches: from the slice's start. TODO 441
      const part = value && slice.matched ? Math.min(1, Math.max(0, slice.matched) / value) : 0;
      const match = marking && part && matchTpl ? this.clone<SVGPathElement>(matchTpl, '.slice-match') : null;
      if (match) {
        match.setAttribute('d', ringSegmentPath({
          cx: CENTRE, cy: CENTRE, inner, outer, radius: pie ? 0 : CORNER,
          startDeg: gapStart, endDeg: gapStart + (gapEnd - gapStart) * part,
        }));
        paintSeries(match, i, slice.colorIndex);
      }
      /* The path IS the datum, not a control; the ring is its one tab stop.
         TRAP T-a-chart-datum-is-reachable-without-a-pointer */
      arc.setAttribute('role', 'img');
      const parts = partsSaid(slice.stack ?? slice.parts);
      arc.setAttribute('aria-label', `${slice.label}: ${slice.value}${parts ? ` (${parts})` : ''}`);
      const startDeg = gapStart;
      const spanDeg = gapEnd - gapStart;
      const split = !slice.stack?.length && !!slice.parts?.some((one) => one.value > 0);
      // Under its parts, unless it has them: then it is their outline, and takes the pointer.
      if (!split) group.appendChild(arc);
      if (slice.stack?.length) {
        /* STACKED by its Secondary: a ring each, from the centre out, its
           thickness its share, in ITS colour; each ring's Group a spoke at each
           boundary. Will, TODO 548 */
        let from = inner;
        const last = slice.stack.length - 1;
        for (const [j, band] of slice.stack.entries()) {
          const to = from + (outer - inner) * (value ? Math.max(0, band.value) / value : 0);
          const path = ringTpl ? this.clone<SVGPathElement>(ringTpl, '.slice-ring') : null;
          if (!path) break;
          // A real gap to the ring beside it, where it is thick enough to give one.
          const thick = to - from > segmentPad * 4;
          const near = j && thick ? from + segmentPad : from;
          const far = j < last && thick ? to - segmentPad : to;
          path.setAttribute('d', ringSegmentPath({ cx: CENTRE, cy: CENTRE, inner: near, outer: far, startDeg, endDeg: startDeg + spanDeg, radius: CORNER }));
          path.setAttribute('stroke-width', String(OUTLINE));
          paintSeries(path, j, band.colorIndex);
          path.toggleAttribute('data-split', !!band.parts?.some((one) => one.value > 0));
          if (!path.hasAttribute('data-split')) group.appendChild(path);
          partsIn(band.parts, Math.max(0, band.value), near, far, startDeg, spanDeg, j, band.colorIndex);
          if (path.hasAttribute('data-split')) group.appendChild(path);
          from = to;
        }
      } else {
        // GROUPED: its parts, in tones of its own colour. TODO 548
        partsIn(slice.parts, value, inner, outer, startDeg, spanDeg, i, slice.colorIndex);
      }
      if (split) group.appendChild(arc);
      if (match) group.appendChild(match);

      if (hotspots && hotTpl) {
        const frag = hotTpl.content.cloneNode(true) as DocumentFragment;
        const dot = frag.querySelector<HTMLElement>('.hotspot')!;
        const tip = frag.querySelector<HTMLElement>('.sherpa-tip')!;
        dot.dataset['index'] = String(i);
        tip.dataset['index'] = String(i);
        const mid = sweepStart + (acc + share / 2) * sweep;
        dot.style.setProperty('--_dot-angle', `${mid}deg`);
        tip.style.setProperty('--_area', radialArea(mid));
        pairAnchor(`--radial-slice-${i}`, dot, tip);
        fillTip(tip, slice.label, slice.value, slice.stack ?? slice.parts);
        hotspots.append(dot, tip);
      }

      acc += share;
    });
  }

  /**
   * The hole. `data-inner` is a FRACTION of the outer radius, so a host names
   * 0.5 rather than a unit in this component's private 100-unit box.
   * A pie has none, and says so by being a pie.
   */
  /** Draws it again at a new size: its gaps are in pixels. */
  #sized: ResizeObserver | undefined;

  override onDisconnect(): void {
    this.#sized?.disconnect();
    this.#sized = undefined;
  }

  /** The hole's radius: none in a pie; else its `data-inner`, or a donut's own. */
  #inner(pie: boolean, outer: number): number {
    if (pie) return 0;
    const raw = this.dataset['inner'];
    if (raw != null && raw !== '') {
      const frac = Number(raw);
      // Clamped: a hole wider than the ring is not a ring.
      if (Number.isFinite(frac)) return Math.min(Math.max(frac, 0), 1) * outer;
    }
    return CENTRE * DONUT_INNER_RATIO + OUTLINE / 2;
  }

  /**
   * The centre reads the TOTAL of what is drawn, unless the host named its own
   * `data-label`.
   *
   * A hardcoded centre goes stale the moment a filter moves: the dashboard's
   * said "1,284" while the ring beneath it drew 881. Deriving it means the
   * number and the ring can never disagree.
   * TRAP T-the-centre-totals-what-the-ring-draws
   */
  #syncCentre(): void {
    const value = this.$('.value');
    if (value) value.textContent = this.dataset['label'] ?? this.#total();
    const sub = this.$('.sub');
    if (sub) sub.textContent = this.dataset['sublabel'] ?? '';
  }

  /** The slices, summed and grouped. Empty when there is nothing drawn. */
  #total(): string {
    const shown = this.#slices;
    if (!shown.length) return '';
    /* NOT clamped: −5 is what the data says, and a printed total that quietly
       drops it disagrees with the rows behind it.
       TRAP T-one-total-for-the-ring-and-the-label */
    // `formatValue` guards non-finite too. TRAP T-a-tooltip-is-not-an-axis
    return formatValue(datumTotal(shown, { clamp: false }));
  }

  /** A slice was clicked: report which. */
  #onClick = (event: Event): void => {
    const arc = (event.target as Element).closest('.slice');
    const raw = (arc as HTMLElement | null)?.dataset['index'];
    if (raw == null) return;
    const slice = this.#slices[Number(raw)];
    if (!slice) return;
    this.emit('slice-click', { index: Number(raw), label: slice.label, value: slice.value });
  };
}

define('sherpa-radial-chart', SherpaRadialChart);
