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
import { SUMMARY_PROPS, SherpaElement } from '../../core/ui/sherpa-element.js';
import type { DataAsk } from '../../core/ui/context.js';
import { radialArea, ringSegmentPath, seriesBorderVar, seriesVar, formatValue } from '../../core/data/format-tick.js';
import { RADIAL_CENTRE as CENTRE, RADIAL_CORNER as CORNER,
  RADIAL_OUTLINE as OUTLINE, RADIAL_INNER_RATIO } from '../../core/ui/shared-constants.js';

/** One slice — an alias of the shared `ChartDatum`. */
export type RadialSlice = ChartDatum;

const MIN_SHARE = 0.005;

export class SherpaRadialChart extends SherpaElement {
  static override css = new URL('./sherpa-radial-chart.css', import.meta.url);
  static override html = new URL('./sherpa-radial-chart.html', import.meta.url);
  static override asks: DataAsk = { shape: 'segments' };
  static override props = { ...SUMMARY_PROPS } as const;
  static override observed = [
    'data-label', 'data-sublabel', 'data-type',
    // The arc. A gauge is this ring stopped short — 270° for 180°.
    'data-sweep-start', 'data-sweep', 'data-inner',
  ];

  /** The slices, as populated. */
  #slices: RadialSlice[] = [];
  /** Which slices a legend has switched off, by index. */
  #hidden = new Set<number>();

  override onRender(): void {
    this.#syncCentre();
    this.$('.slices')?.addEventListener('click', this.#onClick);
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
    // Stale indices would hide the wrong slice.
    this.#hidden.clear();
    this.#renderRing();
    // The total moved, so the centre did too.
    this.#syncCentre();
  }

  get slices(): RadialSlice[] {
    return [...this.#slices];
  }

  /** Show or hide one slice by index — the hook a chart legend toggles. */
  setSliceHidden(index: number, hidden = true): void {
    if (hidden) this.#hidden.add(index);
    else this.#hidden.delete(index);
    this.#renderRing();
    this.#syncCentre();
  }

  /** The indices currently hidden. */
  get hiddenSlices(): number[] {
    return [...this.#hidden].sort((a, b) => a - b);
  }

  /* ── Render ─────────────────────────────────────────────────────── */

  /** Draw the ring: one closed path per slice, and its hotspot. */
  #renderRing(): void {
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

    // Only the visible slices share the circle, so the ring always closes.
    const visible = this.#slices.filter((_, i) => !this.#hidden.has(i));
    // CLAMPED: a negative arc is not a shape. TRAP T-one-total-for-the-ring-and-the-label
    const total = datumTotal(visible, { clamp: true });
    if (total <= 0) return;

    let acc = 0;
    this.#slices.forEach((slice, i) => {
      // Skip AFTER indexing, so an index still names the same slice.
      if (this.#hidden.has(i)) return;
      const value = Math.max(0, slice.value);
      const share = Math.max(value / total, MIN_SHARE);

      // Clone from inside the <svg> (namespace), and add no -90deg transform:
      // ringSegmentPath already measures from 12 o'clock.
      const arc = tpl.content.querySelector('.slice')!.cloneNode(true) as SVGPathElement;
      arc.dataset['index'] = String(i);
      arc.setAttribute(
        'd',
        ringSegmentPath({
          cx: CENTRE,
          cy: CENTRE,
          inner,
          outer,
          startDeg: sweepStart + acc * sweep,
          endDeg: sweepStart + (acc + share) * sweep,
          /* A PIE SLICE HAS NO ROUNDING. Its two straight edges meet at the
             centre, and a corner radius there rounds the point off — the path
             started at 49 rather than the centre's 50. A donut's corners round
             because they sit on two ARCS, which is a different join.
             TRAP T-a-pie-slice-has-no-rounded-corner */
          radius: pie ? 0 : CORNER,
        }),
      );
      arc.setAttribute('stroke-width', String(OUTLINE));
      arc.style.setProperty('--_hue', seriesVar(i, slice.colorIndex));
      // The border is fixed — it does not move along the ramp with the fill.
      arc.style.setProperty('--_border', seriesBorderVar(i, slice.colorIndex));
      /* KEYBOARD-REACHABLE. An SVG <path> takes focus from `tabindex`, and the
         CSS below lights its tip on :focus-visible as well as :hover — so a
         reader with no pointer can read every slice. `role="img"` because the
         path IS the datum, not a control.
         TRAP T-a-chart-datum-is-reachable-without-a-pointer */
      arc.setAttribute('tabindex', '0');
      arc.setAttribute('role', 'img');
      arc.setAttribute('aria-label', `${slice.label}: ${slice.value}`);
      group.appendChild(arc);

      // TRAP T-chart-tip-is-a-sibling-of-its-dot — the anchor name goes on BOTH
      // dot and tip, or the browser parks the tip wherever it likes.
      if (hotspots && hotTpl) {
        const frag = hotTpl.content.cloneNode(true) as DocumentFragment;
        const dot = frag.querySelector<HTMLElement>('.hotspot')!;
        const tip = frag.querySelector<HTMLElement>('.chart-tip')!;
        dot.dataset['index'] = String(i);
        tip.dataset['index'] = String(i);
        const mid = sweepStart + (acc + share / 2) * sweep;
        dot.style.setProperty('--_angle', `${mid}deg`);
        tip.style.setProperty('--_area', radialArea(mid));
        dot.style.setProperty('--_anchor', `--radial-slice-${i}`);
        tip.style.setProperty('--_anchor', `--radial-slice-${i}`);
        tip.querySelector('.chart-tip-label')!.textContent = slice.label;
        // TRAP T-a-tooltip-is-not-an-axis.
        tip.querySelector('.chart-tip-value')!.textContent = formatValue(slice.value);
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
  #inner(pie: boolean, outer: number): number {
    if (pie) return 0;
    const raw = this.dataset['inner'];
    if (raw != null && raw !== '') {
      const frac = Number(raw);
      // Clamped: a hole wider than the ring is not a ring.
      if (Number.isFinite(frac)) return Math.min(Math.max(frac, 0), 1) * outer;
    }
    return CENTRE * RADIAL_INNER_RATIO + OUTLINE / 2;
  }

  /**
   * The centre reads the TOTAL of what is drawn, unless the host named its own
   * `data-label`.
   *
   * A hardcoded centre goes stale the moment a filter moves: the dashboard's
   * said "1,284" while the ring beneath it drew 881. Deriving it means the
   * number and the ring can never disagree — and a hidden slice leaves the
   * total, because the ring no longer counts it either.
   * TRAP T-the-centre-totals-what-the-ring-draws
   */
  #syncCentre(): void {
    const value = this.$('.value');
    if (value) value.textContent = this.dataset['label'] ?? this.#total();
    const sub = this.$('.sub');
    if (sub) sub.textContent = this.dataset['sublabel'] ?? '';
  }

  /** The visible slices, summed and grouped. Empty when there is nothing drawn. */
  #total(): string {
    const shown = this.#slices.filter((_, i) => !this.#hidden.has(i));
    if (!shown.length) return '';
    /* NOT clamped: −5 is what the data says, and a printed total that quietly
       drops it disagrees with the rows behind it.
       TRAP T-one-total-for-the-ring-and-the-label */
    // `formatValue`, which this file already imports — it guards non-finite
    // too. TRAP T-a-tooltip-is-not-an-axis
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

customElements.define('sherpa-radial-chart', SherpaRadialChart);
