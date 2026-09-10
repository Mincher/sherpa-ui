/**
 * sherpa-donut-chart — a donut (or pie) showing parts of a whole.
 *
 * Give it data with populate([{ label, value, colorIndex? }]). Each slice becomes
 * its own SVG arc, matching the Figma component (five ELLIPSE arcs with
 * arcData.innerRadius 0.7, cornerRadius 2, a 1px stroke and a 60% fill).
 *
 * The arcs are drawn as ONE stroked circle per slice, using stroke-dasharray to
 * expose only that slice's span. That gives each slice a real element — so it can
 * carry its own hue, its own hit target and its own hover — which a
 * conic-gradient (the earlier approach) could not: a gradient is one paint with no
 * per-slice element at all.
 *
 * Figma gives each slice a translucent FILL and a solid 1px STROKE. One stroked
 * circle carries a single paint, so each slice is TWO arcs on the same geometry:
 * a wide translucent band (the fill) and a thin solid outline drawn over it. The
 * outline is what makes a small slice legible against its neighbour.
 *
 * DIVERGENCE: Figma's slices have a 2px cornerRadius. An SVG stroke has caps, not
 * corners, so that exact chamfer is not expressible here — `stroke-linecap: round`
 * looks like it should help but adds a HALF-STROKE dome at each end (7.5 of a
 * 15-unit band), which turns a small slice into a blob. Slices are separated by a
 * 1-unit gap instead, which is the readability the rounding was providing.
 *
 * `setSliceHidden(index, hidden)` drops a slice so a chart legend can toggle it.
 * The remaining slices are re-shared across the FULL circle: a donut shows parts
 * of a whole, so hiding one must not leave a gap where it was.
 *
 * @element sherpa-donut-chart
 * @attr {enum}   data-variant   donut (default) | pie
 * @attr {string} data-label     centre big text
 * @attr {string} data-sublabel  centre small text
 *
 * @slot legend — an optional legend beside the ring
 *
 * @fires slice-click — a slice is clicked. bubbles + composed. detail: { index: number, label: string, value: number }
 */
import { SherpaElement } from '../../core/sherpa-element.js';

export interface DonutSlice {
  label: string;
  value: number;
  colorIndex?: number;
}

/** The viewBox is 100×100, so every number below is a percentage of the box. */
const BOX = 100;
const CENTRE = BOX / 2;
/** Separation between slices, in viewBox units (Figma's 2px on a 200px chart). */
const GAP = 1;
/** A slice never shrinks below this, so a 0.1% share is still visible. */
const MIN_ARC = 0.5;
/** The solid outline's width — Figma strokes each slice 1px on a 200px chart. */
const OUTLINE = 0.5;

export class SherpaDonutChart extends SherpaElement {
  static override css = new URL('./sherpa-donut-chart.css', import.meta.url);
  static override html = new URL('./sherpa-donut-chart.html', import.meta.url);
  static override observed = ['data-label', 'data-sublabel', 'data-variant'];

  #slices: DonutSlice[] = [];
  /** Slice indices the legend has switched off. */
  #hidden = new Set<number>();

  override onRender(): void {
    this.#syncCentre();
    this.$('.slices')?.addEventListener('click', this.#onClick);
    if (this.#slices.length) this.#renderRing();
  }

  override onChange(): void {
    this.#syncCentre();
    // data-variant changes the ring's thickness, so the arcs must be re-measured.
    if (this.#slices.length) this.#renderRing();
  }

  /** populate([{ label, value, colorIndex? }]) — the slices. */
  protected override renderData(data: unknown): void {
    this.#slices = Array.isArray(data) ? (data as DonutSlice[]) : [];
    // New data means the old indices may not line up, so start with all visible.
    this.#hidden.clear();
    this.#renderRing();
  }

  get slices(): DonutSlice[] {
    return [...this.#slices];
  }

  /**
   * Show or hide one slice by index — the hook a chart legend toggles.
   *
   * The visible slices are then re-shared across the whole circle rather than
   * leaving a gap: a donut reads as parts OF A WHOLE, so a hole where a slice used
   * to be would misreport the remaining proportions.
   */
  setSliceHidden(index: number, hidden = true): void {
    if (hidden) this.#hidden.add(index);
    else this.#hidden.delete(index);
    this.#renderRing();
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

    group.replaceChildren();

    // Figma: innerRadius 0.7 of the radius, so the band is the outer 30%. A `pie`
    // fills to the centre instead. The stroked-circle trick puts the stroke on the
    // BAND'S MID-LINE, so the path radius is the midpoint of inner and outer.
    const pie = this.dataset['variant'] === 'pie';
    const outer = CENTRE;
    const inner = pie ? 0 : CENTRE * 0.7;
    const width = outer - inner;
    const radius = inner + width / 2;
    const circumference = 2 * Math.PI * radius;

    // The total covers only the VISIBLE slices, so the ring always closes.
    const visible = this.#slices.filter((_, i) => !this.#hidden.has(i));
    const total = visible.reduce((sum, s) => sum + Math.max(0, s.value), 0);
    if (total <= 0) return;

    let acc = 0;
    this.#slices.forEach((slice, i) => {
      // Skip AFTER indexing, so a slice keeps its own colour when unhidden rather
      // than every hue shifting along the ramp.
      if (this.#hidden.has(i)) return;
      const value = Math.max(0, slice.value);
      const share = value / total;

      // Clone the <circle> INSIDE the template's <svg> wrapper, not the wrapper.
      // The wrapper exists only so the HTML parser puts the circle in the SVG
      // namespace — see the note on .slice-tpl in the template.
      const arc = tpl.content.querySelector('.slice')!.cloneNode(true) as SVGCircleElement;
      arc.dataset['index'] = String(i);
      arc.setAttribute('r', String(radius));
      arc.setAttribute('stroke-width', String(width));
      // Expose only this slice's span: one dash of its arc length, then a gap of
      // the whole circumference so the dash never repeats.
      //
      // The dash is shortened by GAP so neighbouring slices do not touch. Figma
      // separates them with a 2px corner radius, which an SVG stroke cannot draw
      // (a stroke has caps, not corners) — the gap gives the same readability.
      // Clamped so a tiny slice still renders rather than vanishing.
      const length = Math.max(share * circumference - GAP, MIN_ARC);
      arc.setAttribute('stroke-dasharray', `${length} ${circumference}`);
      // Rotate it into place. -90deg puts the first slice at 12 o'clock, matching
      // Figma's startingAngle of -1.5708 rad.
      arc.setAttribute(
        'transform',
        `rotate(${acc * 360 - 90} ${CENTRE} ${CENTRE})`,
      );
      const n = ((slice.colorIndex ?? i + 1) - 1) % 11 + 1;
      arc.style.setProperty('--_hue', `var(--sherpa-data-viz-series-${n})`);
      arc.setAttribute('aria-label', `${slice.label}: ${slice.value}`);
      group.appendChild(arc);

      // The solid outline: the SAME dash and rotation on the band's two edges, so
      // it traces the slice's boundary. Figma strokes each slice 1px INSIDE, so
      // the outline sits just within the band rather than straddling its edge.
      for (const edge of [inner, outer]) {
        if (edge <= 0) continue; // a pie has no inner edge to trace
        const edgeRadius = edge === inner ? inner + OUTLINE / 2 : outer - OUTLINE / 2;
        const line = tpl.content.querySelector('.slice')!.cloneNode(true) as SVGCircleElement;
        line.classList.add('slice-outline');
        line.classList.remove('slice');
        line.setAttribute('r', String(edgeRadius));
        line.setAttribute('stroke-width', String(OUTLINE));
        // Its own circumference, so the dash still covers exactly this slice.
        const edgeCircumference = 2 * Math.PI * edgeRadius;
        const edgeLength = Math.max(share * edgeCircumference - GAP, MIN_ARC);
        line.setAttribute('stroke-dasharray', `${edgeLength} ${edgeCircumference}`);
        line.setAttribute('transform', `rotate(${acc * 360 - 90} ${CENTRE} ${CENTRE})`);
        line.style.setProperty('--_hue', `var(--sherpa-data-viz-series-${n})`);
        group.appendChild(line);
      }

      acc += share;
    });
  }

  #syncCentre(): void {
    const value = this.$('.value');
    if (value) value.textContent = this.dataset['label'] ?? '';
    const sub = this.$('.sub');
    if (sub) sub.textContent = this.dataset['sublabel'] ?? '';
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
