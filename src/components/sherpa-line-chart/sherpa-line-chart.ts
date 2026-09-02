/**
 * sherpa-line-chart — a line or area chart for one or more sets of numbers.
 *
 * Give it data with populate({ labels, series }). JS turns each set of numbers
 * into a line and a filled area on an SVG canvas, spacing the points evenly and
 * putting bigger values higher up. CSS handles the line colour, fill, and width.
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

  override onRender(): void {
    if (this.#series.length) this.#render();
  }

  override onChange(): void {
    this.#render();
  }

  /** populate({ labels, series }) — series is number[] | {name?,values}[]. */
  protected override renderData(data: unknown): void {
    const d = (data ?? {}) as LineData;
    this.#labels = Array.isArray(d.labels) ? d.labels : [];
    this.#series = (Array.isArray(d.series) ? d.series : []).map((s) =>
      Array.isArray(s) ? { values: s } : s,
    );
    this.#render();
  }

  #render(): void {
    const layer = this.$('.series-layer');
    const grid = this.$('.grid');
    const xAxis = this.$('.x-axis');
    const xtpl = this.$<HTMLTemplateElement>('template.xlabel-tpl');
    if (!layer || !grid || !xAxis || !xtpl) return;

    const all = this.#series.flatMap((s) => s.values);
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
      const n = ((s.colorIndex ?? si + 1) - 1) % 11 + 1;
      const pts = s.values.map((v, i) => {
        const x = s.values.length > 1 ? (i / (s.values.length - 1)) * 100 : 50;
        const y = 100 - ((v - min) / span) * 100;
        return [x, y] as const;
      });

      const g = document.createElementNS(SVG_NS, 'g');
      g.setAttribute('class', 'series');
      g.style.setProperty('--_hue', `var(--sherpa-categorical-${n})`);

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
