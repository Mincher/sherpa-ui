/**
 * sherpa-line-chart — a line or area chart for one or more sets of numbers.
 * CSS owns colour, fill and width.
 */
import { SherpaElement } from '../../core/sherpa-element.js';
import { formatTick, seriesBorderVar, seriesVar, tickPercent } from '../../core/format-tick.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
/** Gridlines when data-ticks is absent. */
const DEFAULT_TICKS = 4;

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
  static override props = {
    'data-legend': { type: 'enum', kind: 'style', values: ['horizontal', 'vertical'] },
    'data-axis-label': { type: 'string', kind: 'content', to: '.axis-label-y' },
    'data-x-axis-label': { type: 'string', kind: 'content', to: '.axis-label-x' },
  } as const;

  static override observed = ['data-type', 'data-min', 'data-max', 'data-ticks'];

  #labels: string[] = [];
  #series: Series[] = [];
  #hidden = new Set<number>();

  override onRender(): void {
    if (this.#series.length) this.#render();
  }

  override onChange(): void {
    this.#render();
  }

  /* ── Public API ──────────────────────────────────────────────────── */

  /**
   * Show or hide one series. Hiding re-renders — the axis rescales to what is
   * left. TRAP T-hiding-a-series-rescales-the-axis
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

  /**
   * Hide exactly these series — REPLACES, and keeps an out-of-range index.
   * TRAP T-hidden-set-is-view-state-and-replaces
   */
  set hiddenSeries(indices: readonly number[]) {
    this.#hidden = new Set(indices.filter((i) => Number.isInteger(i) && i >= 0));
    this.#render();
  }

  /** populate({ labels, series }) — series is number[] | {name?,values}[]. */
  protected override renderData(data: unknown): void {
    const d = (data ?? {}) as LineData;
    this.#labels = Array.isArray(d.labels) ? d.labels : [];
    this.#series = (Array.isArray(d.series) ? d.series : []).map((s) =>
      Array.isArray(s) ? { values: s } : s,
    );
    // Stale indices would hide the wrong series.
    this.#hidden.clear();
    this.#render();
  }

  #render(): void {
    const layer = this.$('.series-layer');
    const grid = this.$('.grid');
    const xAxis = this.$('.x-axis');
    const xtpl = this.$<HTMLTemplateElement>('template.xlabel-tpl');
    const hotspots = this.$('.hotspots');
    const dotTpl = this.$<HTMLTemplateElement>('template.hotspot-tpl');
    if (!layer || !grid || !xAxis || !xtpl) return;

    // Bounds come from the VISIBLE series only.
    const all = this.#series
      .filter((_, i) => !this.#hidden.has(i))
      .flatMap((s) => s.values);
    // NaN is the not-given sentinel; Number('') would be 0.
    // TRAP T-nan-is-the-not-given-sentinel
    const explicitMin = this.num('data-min', NaN);
    const explicitMax = this.num('data-max', NaN);
    const min = Number.isFinite(explicitMin) ? explicitMin : Math.min(0, ...all);
    const max = Number.isFinite(explicitMax) ? explicitMax : Math.max(1, ...all);
    const span = max - min || 1;

    this.#renderYAxis(min, max);

    // From i=1, inclusive of `bands`, so a line meets the top label.
    // TRAP T-gridlines-run-to-the-top-label
    grid.replaceChildren();
    const bands = this.#tickSteps();
    for (let i = 1; i <= bands; i++) {
      const y = 100 - tickPercent(i, bands);
      const line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('x1', '0');
      line.setAttribute('x2', '100');
      line.setAttribute('y1', String(y));
      line.setAttribute('y2', String(y));
      grid.appendChild(line);
    }

    layer.replaceChildren();
    hotspots?.replaceChildren();
    this.#series.forEach((s, si) => {
      // Hue stays keyed to `si`, so a visible series keeps its colour when a
      // neighbour is hidden.
      if (this.#hidden.has(si)) return;
      const hue = seriesVar(si, s.colorIndex);
      const pts = s.values.map((v, i) => {
        const x = s.values.length > 1 ? (i / (s.values.length - 1)) * 100 : 50;
        const y = 100 - ((v - min) / span) * 100;
        return [x, y] as const;
      });

      const g = document.createElementNS(SVG_NS, 'g');
      g.setAttribute('class', 'series');
      g.style.setProperty('--_hue', hue);
      g.style.setProperty('--_border', seriesBorderVar(si, s.colorIndex));

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

      if (hotspots && dotTpl) {
        pts.forEach(([x, y], i) => {
          const frag = dotTpl.content.cloneNode(true) as DocumentFragment;
          const dot = frag.querySelector<HTMLElement>('.hotspot')!;
          const tip = frag.querySelector<HTMLElement>('.chart-tip')!;
          dot.dataset['series'] = String(si);
          dot.dataset['index'] = String(i);
          dot.style.setProperty('--_x', `${x}%`);
          dot.style.setProperty('--_y', `${y}%`);
          dot.style.setProperty('--_hue', hue);
          // A dot inherits nothing from the <g>; the anchor name goes on both.
          // TRAP T-chart-tip-is-a-sibling-of-its-dot
          dot.style.setProperty('--_border', seriesBorderVar(si, s.colorIndex));
          dot.style.setProperty('--_anchor', `--line-${si}-${i}`);
          tip.style.setProperty('--_anchor', `--line-${si}-${i}`);
          const at = this.#labels[i];
          const label = [s.name, at].filter(Boolean).join(' · ');
          tip.querySelector('.chart-tip-label')!.textContent = label;
          tip.querySelector('.chart-tip-value')!.textContent = formatTick(s.values[i]!);
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

  #renderYAxis(min: number, max: number): void {
    const axis = this.$('.y-axis');
    const tpl = this.$<HTMLTemplateElement>('template.ytick-tpl');
    if (!axis || !tpl) return;

    const steps = this.#tickSteps();
    axis.replaceChildren();
    // Written, never inferred by measuring.
    // TRAP T-y-axis-width-is-fixed-not-measured
    this.toggleAttribute('data-has-y-axis', steps > 0 && this.#series.length > 0);
    if (steps <= 0 || !this.#series.length) return;

    for (let i = 0; i <= steps; i++) {
      const tick = tpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
      tick.style.setProperty('--_at', `${tickPercent(i, steps)}%`);
      tick.querySelector('.y-value')!.textContent = formatTick(min + ((max - min) * i) / steps);
      axis.appendChild(tick);
    }
  }
}

customElements.define('sherpa-line-chart', SherpaLineChart);
