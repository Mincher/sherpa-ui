/**
 * sherpa-line-chart — a line or area chart for one or more sets of numbers.
 *
 * Give it data with populate({ labels, series }). JS turns each set of numbers
 * into a line and a filled area on an SVG canvas, spacing the points evenly and
 * putting bigger values higher up. CSS handles the line colour, fill, and width.
 *
 * `setSeriesHidden(index, hidden)` hides one series so a chart legend can toggle
 * it. Hiding is a RE-RENDER, not a `display: none`, because the y-scale is derived
 * from the visible values — leaving a hidden series in the extent would keep the
 * axis stretched to data nobody can see.
 */
import { SherpaElement } from '../../core/sherpa-element.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

interface Series {
  name?: string;
  values: number[];
  colorIndex?: number;
}
interface LineData {
  labels?: string[];
  series: Array<number[] | Series>;
}

export class SherpaLineChart extends SherpaElement {
  static override css = new URL('./sherpa-line-chart.css', import.meta.url);
  static override html = new URL('./sherpa-line-chart.html', import.meta.url);
  static override observed = ['data-variant', 'data-min', 'data-max'];

  #labels: string[] = [];
  #series: Series[] = [];
  /** Series indices the legend has switched off. */
  #hidden = new Set<number>();

  override onRender(): void {
    if (this.#series.length) this.#render();
  }

  override onChange(): void {
    this.#render();
  }

  /* ── Public API ──────────────────────────────────────────────────── */

  /**
   * Show or hide one series by index — the hook a chart legend toggles.
   *
   * Re-renders rather than hiding the drawn `<g>`: the y-scale comes from the
   * VISIBLE values, so a hidden series left in the extent would keep the axis
   * stretched to data nobody can see, and the remaining lines would sit squashed
   * at the bottom of the canvas.
   */
  setSeriesHidden(index: number, hidden = true): void {
    if (hidden) this.#hidden.add(index);
    else this.#hidden.delete(index);
    this.#render();
  }

  /** The indices currently hidden. */
  get hiddenSeries(): number[] {
    return [...this.#hidden].sort((a, b) => a - b);
  }

  /** populate({ labels, series }) — series is number[] | {name?,values}[]. */
  protected override renderData(data: unknown): void {
    const d = (data ?? {}) as LineData;
    this.#labels = Array.isArray(d.labels) ? d.labels : [];
    this.#series = (Array.isArray(d.series) ? d.series : []).map((s) =>
      Array.isArray(s) ? { values: s } : s,
    );
    // New data means the old indices may not line up, so start with all visible.
    this.#hidden.clear();
    this.#render();
  }

  #render(): void {
    const layer = this.$('.series-layer');
    const grid = this.$('.grid');
    const xAxis = this.$('.x-axis');
    const xtpl = this.$<HTMLTemplateElement>('template.xlabel-tpl');
    if (!layer || !grid || !xAxis || !xtpl) return;

    // The extent covers only the VISIBLE series, so hiding one re-scales the axis.
    const all = this.#series
      .filter((_, i) => !this.#hidden.has(i))
      .flatMap((s) => s.values);
    const explicitMin = Number(this.dataset['min']);
    const explicitMax = Number(this.dataset['max']);
    const min = Number.isFinite(explicitMin) ? explicitMin : Math.min(0, ...all);
    const max = Number.isFinite(explicitMax) ? explicitMax : Math.max(1, ...all);
    const span = max - min || 1;

    // Grid: 4 horizontal lines.
    grid.replaceChildren();
    for (let i = 1; i < 4; i++) {
      const y = (i / 4) * 100;
      const line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('x1', '0');
      line.setAttribute('x2', '100');
      line.setAttribute('y1', String(y));
      line.setAttribute('y2', String(y));
      grid.appendChild(line);
    }

    // Series polylines + area paths.
    layer.replaceChildren();
    this.#series.forEach((s, si) => {
      // A hidden series draws nothing at all — no empty <g> to confuse a11y or
      // hit-testing. Its COLOUR INDEX is still derived from `si`, so unhiding it
      // comes back the same hue rather than shifting every colour along.
      if (this.#hidden.has(si)) return;
      const n = ((s.colorIndex ?? si + 1) - 1) % 11 + 1;
      const pts = s.values.map((v, i) => {
        const x = s.values.length > 1 ? (i / (s.values.length - 1)) * 100 : 50;
        const y = 100 - ((v - min) / span) * 100;
        return [x, y] as const;
      });

      const g = document.createElementNS(SVG_NS, 'g');
      g.setAttribute('class', 'series');
      g.style.setProperty('--_hue', `var(--sherpa-data-viz-series-${n})`);

      const area = document.createElementNS(SVG_NS, 'path');
      area.setAttribute('class', 'area');
      if (pts.length) {
        const d = `M ${pts[0]![0]} 100 ` + pts.map((p) => `L ${p[0]} ${p[1]}`).join(' ') +
          ` L ${pts[pts.length - 1]![0]} 100 Z`;
        area.setAttribute('d', d);
      }

      const line = document.createElementNS(SVG_NS, 'polyline');
      line.setAttribute('class', 'line');
      line.setAttribute('fill', 'none');
      line.setAttribute('points', pts.map((p) => `${p[0]},${p[1]}`).join(' '));

      g.append(area, line);
      layer.appendChild(g);
    });

    // X labels.
    xAxis.replaceChildren();
    for (const label of this.#labels) {
      const span = xtpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
      span.textContent = label;
      xAxis.appendChild(span);
    }
  }
}

customElements.define('sherpa-line-chart', SherpaLineChart);
