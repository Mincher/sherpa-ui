/**
 * sherpa-donut-chart — a donut (or pie) showing parts of a whole.
 *
 * TRAP T-donut-slice-is-a-closed-path — each slice is ONE closed <path>; a
 * stroked circle can express neither the full border nor the rounded corners.
 * TRAP T-hiding-a-series-rescales-the-axis — the rest re-share the full circle.
 */
import type { ChartDatum } from '../../core/data/chart-datum.js';
import { SherpaElement } from '../../core/ui/sherpa-element.js';
import { radialArea, ringSegmentPath, seriesBorderVar, seriesVar, formatValue } from '../../core/data/format-tick.js';

/** One slice — an alias of the shared `ChartDatum`. */
export type DonutSlice = ChartDatum;

/* Geometry in viewBox units of a 100×100 box. */
const BOX = 100;
const CENTRE = BOX / 2;
const CORNER = 1;
const MIN_SHARE = 0.005;
const OUTLINE = 0.5;

export class SherpaDonutChart extends SherpaElement {
  static override css = new URL('./sherpa-donut-chart.css', import.meta.url);
  static override html = new URL('./sherpa-donut-chart.html', import.meta.url);
  static override observed = ['data-label', 'data-sublabel', 'data-type'];

  #slices: DonutSlice[] = [];
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
    this.#slices = Array.isArray(data) ? (data as DonutSlice[]) : [];
    // Stale indices would hide the wrong slice.
    this.#hidden.clear();
    this.#renderRing();
    // The total moved, so the centre did too.
    this.#syncCentre();
  }

  get slices(): DonutSlice[] {
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
    const inner = pie ? 0 : CENTRE * 0.7 + OUTLINE / 2;

    // Only the visible slices share the circle, so the ring always closes.
    const visible = this.#slices.filter((_, i) => !this.#hidden.has(i));
    const total = visible.reduce((sum, s) => sum + Math.max(0, s.value), 0);
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
          startDeg: acc * 360,
          endDeg: (acc + share) * 360,
          radius: CORNER,
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
        const mid = (acc + share / 2) * 360;
        dot.style.setProperty('--_angle', `${mid}deg`);
        tip.style.setProperty('--_area', radialArea(mid));
        dot.style.setProperty('--_anchor', `--donut-slice-${i}`);
        tip.style.setProperty('--_anchor', `--donut-slice-${i}`);
        tip.querySelector('.chart-tip-label')!.textContent = slice.label;
        // TRAP T-a-tooltip-is-not-an-axis.
        tip.querySelector('.chart-tip-value')!.textContent = formatValue(slice.value);
        hotspots.append(dot, tip);
      }

      acc += share;
    });
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
    const sum = shown.reduce((n, s) => n + (Number.isFinite(s.value) ? s.value : 0), 0);
    return sum.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  #onClick = (event: Event): void => {
    const arc = (event.target as Element).closest('.slice');
    const raw = (arc as HTMLElement | null)?.dataset['index'];
    if (raw == null) return;
    const slice = this.#slices[Number(raw)];
    if (!slice) return;
    this.emit('slice-click', { index: Number(raw), label: slice.label, value: slice.value });
  };
}

customElements.define('sherpa-donut-chart', SherpaDonutChart);
