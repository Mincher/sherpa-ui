/**
 * sherpa-donut-chart — a donut (or pie) showing parts of a whole.
 *
 * Give it data with populate([{ label, value, colorIndex? }]). Each slice becomes
 * its own SVG arc, matching the Figma component (five ELLIPSE arcs with
 * arcData.innerRadius 0.7, cornerRadius 2, a 1px stroke and a 60% fill).
 *
 * Each slice is ONE CLOSED <path> — a ring segment with all four corners rounded,
 * built by ringSegmentPath(). It used to be a stroked circle whose dash exposed
 * only its own span, which could express neither of the two things Figma asks for:
 * a stroke is a thick LINE, so it has two caps and no corners. It could not carry
 * a border round the whole slice (only along the two long edges, as a second arc
 * drawn on top), and it could not round the four corners at all. A closed path
 * does both in one element: `fill` tints the body at 60%, `stroke` traces the
 * entire boundary, and the corner arcs are part of the outline.
 *
 * Slices TOUCH — no gap, as in Figma, where the 2px rounding alone separates
 * them. The old flat-capped 1-unit gap was standing in for that rounding.
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
import type { ChartDatum } from '../../core/chart-datum.js';
import { SherpaElement } from '../../core/sherpa-element.js';
import { formatTick, radialArea, ringSegmentPath, seriesBorderVar, seriesVar } from '../../core/format-tick.js';

/** One slice — an alias of the shared `ChartDatum`. See chart-datum.ts. */
export type DonutSlice = ChartDatum;

/** The viewBox is 100×100, so every number below is a percentage of the box. */
const BOX = 100;
const CENTRE = BOX / 2;
/**
 * Corner rounding, in viewBox units — Figma's cornerRadius 2 on a 200px chart.
 * ringSegmentPath() clamps it down for a slice too thin or too short to hold it.
 */
const CORNER = 1;
/** A slice never shrinks below this SHARE, so a 0.1% slice is still visible. */
const MIN_SHARE = 0.005;
/**
 * The outline's width — Figma strokes each slice 1px on a 200px chart, ALIGNED
 * INSIDE. SVG has no inside stroke (it always straddles the path), so the path is
 * drawn half a stroke in from the true edges and the stroke then lands inside the
 * band, exactly as Figma paints it.
 */
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

    const hotspots = this.$('.hotspots');
    const hotTpl = this.$<HTMLTemplateElement>('template.hotspot-tpl');
    group.replaceChildren();
    hotspots?.replaceChildren();

    // Figma: innerRadius 0.7 of the radius, so the band is the outer 30%. A `pie`
    // fills to the centre instead. These are the TRUE edges of the band; the path
    // is inset half an outline below so the stroke lands inside them, matching
    // Figma's strokeAlign INSIDE.
    const pie = this.dataset['variant'] === 'pie';
    const outer = CENTRE - OUTLINE / 2;
    const inner = pie ? 0 : CENTRE * 0.7 + OUTLINE / 2;

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
      // Floored so a near-zero slice is still a visible sliver rather than a
      // zero-width path the browser drops entirely.
      const share = Math.max(value / total, MIN_SHARE);

      // Clone the <path> INSIDE the template's <svg> wrapper, not the wrapper.
      // The wrapper exists only so the HTML parser puts the path in the SVG
      // namespace — see the note on .slice-tpl in the template.
      const arc = tpl.content.querySelector('.slice')!.cloneNode(true) as SVGPathElement;
      arc.dataset['index'] = String(i);
      // -90deg is not needed: ringSegmentPath measures CLOCKWISE FROM 12 O'CLOCK
      // already, which is where Figma's startingAngle of -1.5708 rad puts the
      // first slice. No transform, so the rounded corners stay true.
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
      // The OUTLINE is its own token — colour 5 of the series' sequence, held at
      // full strength. A mark's fill moves along its ramp; its border does not.
      arc.style.setProperty('--_border', seriesBorderVar(i, slice.colorIndex));
      arc.setAttribute('aria-label', `${slice.label}: ${slice.value}`);
      group.appendChild(arc);

      // The hover dot + its tooltip. The ONLY number JS gives CSS is the slice's
      // MID-ANGLE — cos()/sin() in the CSS turn that into a position on the ring,
      // so the dot follows the ring at any size with nothing measured here.
      if (hotspots && hotTpl) {
        // BOTH children — the dot and its tip are SIBLINGS, so the whole
        // fragment is cloned. The tip cannot be a descendant of the dot: an
        // absolutely-positioned ancestor breaks anchor positioning for a fixed
        // tip, and the dot must be absolute to sit on its slice.
        const frag = hotTpl.content.cloneNode(true) as DocumentFragment;
        const dot = frag.querySelector<HTMLElement>('.hotspot')!;
        const tip = frag.querySelector<HTMLElement>('.chart-tip')!;
        dot.dataset['index'] = String(i);
        // The tip carries the SAME index, so CSS can pair slice N with tip N —
        // the slice is inside <svg> and cannot be reached by a sibling selector.
        tip.dataset['index'] = String(i);
        // Measured from 12 o'clock, matching the arcs' own -90deg rotation.
        const mid = (acc + share / 2) * 360;
        dot.style.setProperty('--_angle', `${mid}deg`);
        // Push the tip OUTWARD along this slice's radius, so it clears the ring
        // rather than sitting over the data it describes.
        tip.style.setProperty('--_area', radialArea(mid));
        // The ANCHOR NAME. Without it the tip has no anchor at all: `position-area`
        // is then meaningless and the browser parks the tip wherever it likes —
        // which is why every donut tip appeared beside its dot instead of above.
        // The anchor NAME goes on BOTH: the dot declares it, the tip points at it.
        dot.style.setProperty('--_anchor', `--donut-slice-${i}`);
        tip.style.setProperty('--_anchor', `--donut-slice-${i}`);
        tip.querySelector('.chart-tip-label')!.textContent = slice.label;
        tip.querySelector('.chart-tip-value')!.textContent = formatTick(slice.value);
        hotspots.append(dot, tip);
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
