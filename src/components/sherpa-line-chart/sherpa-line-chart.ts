/**
 * sherpa-line-chart — a line or area chart for one or more sets of numbers.
 * CSS owns colour, fill and width.
 */
import { SHARED_PROPS, SUMMARY_PROPS, SherpaElement } from '../../core/ui/sherpa-element.js';
import type { DataAsk } from '../../core/ui/context.js';
import { chartScale, tickPercent, type ChartScale } from '../../core/data/format-tick.js';
import { fillTip, pairAnchor, paintSeries, renderValueAxis } from '../../core/ui/chart-parts.js';
import { DEFAULT_TICKS } from '../../core/ui/shared-constants.js';


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
  static override css = [
    new URL('../../core/sherpa-chart-axes.css', import.meta.url),
    new URL('./sherpa-line-chart.css', import.meta.url),
  ];
  static override html = new URL('./sherpa-line-chart.html', import.meta.url);
  static override asks: DataAsk = { shape: 'series', shows: 'chart' };

  static override props = {
    ...SUMMARY_PROPS,
    'data-legend': SHARED_PROPS['data-legend'],
    'data-axis-label': { type: 'string', kind: 'content', to: '.axis-label-y' },
    'data-x-axis-label': { type: 'string', kind: 'content', to: '.axis-label-x' },
  } as const;

  static override observed = ['data-type', 'data-min', 'data-max', 'data-ticks'];

  /** The x-axis labels, one per point. */
  #labels: string[] = [];
  /** The lines, as populated. */
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

  /** Draw the gridlines, the x-axis and one path per series. */
  #render(): void {
    const layer = this.$('.series-layer');
    const grid = this.$('.grid');
    const xAxis = this.$('.x-axis');
    const xtpl = this.$<HTMLTemplateElement>('template.xlabel-tpl');
    const hotspots = this.$('.hotspots');
    const dotTpl = this.$<HTMLTemplateElement>('template.hotspot-tpl');
    if (!layer || !grid || !xAxis || !xtpl) return;

    // Bounds come from the series it is given. TRAP T-hiding-a-series-rescales-the-axis
    const all = this.#series.flatMap((s) => s.values);
    /* ONE scale rule for every chart. NaN is the not-given sentinel; Number('')
       would be 0. TRAP T-nan-is-the-not-given-sentinel
       TRAP T-one-scale-for-every-chart */
    const scale = chartScale(all, {
      min: this.num('data-min', NaN),
      max: this.num('data-max', NaN),
      // The PREFERRED band count; the scale may use one either side so every
      // gridline is a round number.
      bands: this.#tickSteps(),
    });
    const { min, span } = scale;

    this.#renderYAxis(scale);

    // From i=1, inclusive of `bands`, so a line meets the top label.
    // TRAP T-gridlines-run-to-the-top-label
    grid.replaceChildren();
    const bands = this.#tickSteps() > 0 ? scale.bands : 0;
    const gridline = this.$<HTMLTemplateElement>('template.gridline-tpl')?.content.querySelector('line');
    for (let i = 1; i <= bands && gridline; i++) {
      const y = String(100 - tickPercent(i, bands));
      const line = document.importNode(gridline, true);
      line.setAttribute('y1', y);
      line.setAttribute('y2', y);
      grid.appendChild(line);
    }

    layer.replaceChildren();
    hotspots?.replaceChildren();
    this.#series.forEach((s, si) => {
      const pts = s.values.map((v, i) => {
        const x = s.values.length > 1 ? (i / (s.values.length - 1)) * 100 : 50;
        const y = 100 - ((v - min) / span) * 100;
        return [x, y] as const;
      });

      const proto = this.$<HTMLTemplateElement>('template.series-tpl')?.content.querySelector('.series');
      if (!proto) return;
      const g = document.importNode(proto, true) as SVGGElement;
      paintSeries(g, si, s.colorIndex);

      const area = g.querySelector('.area')!;
      if (pts.length) {
        const d = `M ${pts[0]![0]} 100 ` + pts.map((p) => `L ${p[0]} ${p[1]}`).join(' ') +
          ` L ${pts[pts.length - 1]![0]} 100 Z`;
        area.setAttribute('d', d);
      }

      g.querySelector('.line')!.setAttribute('points', pts.map((p) => `${p[0]},${p[1]}`).join(' '));
      layer.appendChild(g);

      if (hotspots && dotTpl) {
        pts.forEach(([x, y], i) => {
          const frag = dotTpl.content.cloneNode(true) as DocumentFragment;
          const dot = frag.querySelector<HTMLElement>('.hotspot')!;
          const tip = frag.querySelector<HTMLElement>('.chart-tip')!;
          dot.dataset['series'] = String(si);
          dot.dataset['index'] = String(i);
          dot.style.setProperty('--_x', `${x}%`);
          dot.style.setProperty('--_y', `${y}%`);
          // A dot inherits nothing from the <g>.
          paintSeries(dot, si, s.colorIndex);
          pairAnchor(`--line-${si}-${i}`, dot, tip);
          const label = [s.name, this.#labels[i]].filter(Boolean).join(' · ');
          fillTip(tip, label, s.values[i]!);
          dot.setAttribute('aria-label', `${label} ${s.values[i]}`.trim());
          hotspots.append(dot, tip);
        });
      }
    });

    xAxis.replaceChildren();
    for (const label of this.#labels) {
      const span = xtpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
      span.textContent = label;
      xAxis.appendChild(span);
    }

  }

  /** Value divisions, shared by the axis and the gridlines. */
  #tickSteps(): number {
    return this.num('data-ticks', DEFAULT_TICKS, { min: 0, int: true });
  }

  /** The value ticks, placed on the same scale as the gridlines. */
  #renderYAxis(scale: ChartScale): void {
    const steps = this.#tickSteps() > 0 && this.#series.length ? scale.bands : 0;
    this.toggleAttribute('data-has-y-axis', renderValueAxis(
      this.$('.y-axis'), this.$<HTMLTemplateElement>('template.ytick-tpl'), scale, steps,
    ));
  }
}

customElements.define('sherpa-line-chart', SherpaLineChart);
