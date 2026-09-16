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
import { formatTick, seriesBorderVar, seriesVar, tickPercent } from '../../core/format-tick.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
/** Gridlines when data-ticks is absent — 4 matches the Figma Chart Axis. */
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
    'data-axis-label': { type: 'string', kind: 'content', to: '.axis-label-y' },
    'data-x-axis-label': { type: 'string', kind: 'content', to: '.axis-label-x' },
  } as const;

  static override observed = ['data-type', 'data-min', 'data-max', 'data-ticks'];

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

  /**
   * Hide exactly these series, by index — a saved view, a preset, an agent.
   *
   * Clicking a legend swatch to hide a series is real VIEW STATE: it is what
   * this reader wants to look at, and it belongs in a saved view beside the
   * filter and the sort. It was a getter only, so that choice could be read and
   * never put back — half an API.
   *
   * REPLACES rather than adds, like every other restore here: a saved view says
   * "this is what is hidden", not "also hide these". An empty array shows
   * everything.
   *
   * Out-of-range indices are KEPT rather than filtered — the data may not have
   * arrived yet, and an index that matches nothing hides nothing.
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
    // New data means the old indices may not line up, so start with all visible.
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

    // The extent covers only the VISIBLE series, so hiding one re-scales the axis.
    const all = this.#series
      .filter((_, i) => !this.#hidden.has(i))
      .flatMap((s) => s.values);
    // NaN is the "not given" sentinel: an absent bound is DERIVED from the data,
    // so there is no static default to fall back to. num() treats an EMPTY
    // attribute as absent too — `Number('')` is 0, which used to pin the floor
    // to 0 the moment a template emitted `data-min=""`.
    const explicitMin = this.num('data-min', NaN);
    const explicitMax = this.num('data-max', NaN);
    const min = Number.isFinite(explicitMin) ? explicitMin : Math.min(0, ...all);
    const max = Number.isFinite(explicitMax) ? explicitMax : Math.max(1, ...all);
    const span = max - min || 1;

    this.#renderYAxis(min, max);

    // Gridlines on the SAME divisions as the axis labels, via tickPercent.
    //
    // Runs to `bands` INCLUSIVE, so the topmost label gets a line. It used to
    // stop at bands-1 on the reasoning that 0% and 100% are the plot's own
    // edges — but only the BOTTOM edge is actually drawn (the x-axis rule), so
    // the highest value was the one label on the axis with nothing beside it.
    // i=0 stays excluded: that line would sit exactly under the x-axis rule.
    grid.replaceChildren();
    const bands = this.#tickSteps();
    for (let i = 1; i <= bands; i++) {
      // The SVG's y runs downward, so a percentage UP from the bottom inverts.
      const y = 100 - tickPercent(i, bands);
      const line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('x1', '0');
      line.setAttribute('x2', '100');
      line.setAttribute('y1', String(y));
      line.setAttribute('y2', String(y));
      grid.appendChild(line);
    }

    // Series polylines + area paths.
    layer.replaceChildren();
    hotspots?.replaceChildren();
    this.#series.forEach((s, si) => {
      // A hidden series draws nothing at all — no empty <g> to confuse a11y or
      // hit-testing. Its COLOUR INDEX is still derived from `si`, so unhiding it
      // comes back the same hue rather than shifting every colour along.
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

      // Hover dots — one per point on this series. They reuse the SAME x/y
      // percentages the polyline was just drawn from, so a dot can never sit
      // anywhere but on its own point. HTML rather than SVG, because an SVG
      // element cannot be a CSS anchor (see .hotspot in the CSS).
      if (hotspots && dotTpl) {
        pts.forEach(([x, y], i) => {
          // BOTH children — the dot and its tip are SIBLINGS. The tip cannot be a
          // descendant of the dot: an absolutely-positioned ancestor breaks anchor
          // positioning for a fixed tip, and the dot must be absolute to sit on
          // its point.
          const frag = dotTpl.content.cloneNode(true) as DocumentFragment;
          const dot = frag.querySelector<HTMLElement>('.hotspot')!;
          const tip = frag.querySelector<HTMLElement>('.chart-tip')!;
          dot.dataset['series'] = String(si);
          dot.dataset['index'] = String(i);
          dot.style.setProperty('--_x', `${x}%`);
          dot.style.setProperty('--_y', `${y}%`);
          dot.style.setProperty('--_hue', hue);
          // …and its BORDER. A dot lives in the .hotspots layer, OUTSIDE the <g>
          // that carries the series' properties, so it inherits nothing — without
          // this its `var(--_border, …)` fell through to the fallback and every
          // dot painted the same grey.
          dot.style.setProperty('--_border', seriesBorderVar(si, s.colorIndex));
          // The anchor NAME on BOTH: the dot declares it, the tip points at it.
          dot.style.setProperty('--_anchor', `--line-${si}-${i}`);
          tip.style.setProperty('--_anchor', `--line-${si}-${i}`);
          // The series NAME plus the x label, so a multi-series chart says which
          // line the reader is on — the value alone would be ambiguous.
          const at = this.#labels[i];
          const label = [s.name, at].filter(Boolean).join(' · ');
          tip.querySelector('.chart-tip-label')!.textContent = label;
          tip.querySelector('.chart-tip-value')!.textContent = formatTick(s.values[i]!);
          dot.setAttribute('aria-label', `${label} ${s.values[i]}`.trim());
          hotspots.append(dot, tip);
        });
      }
    });

    // X labels.
    xAxis.replaceChildren();
    for (const label of this.#labels) {
      const span = xtpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
      span.textContent = label;
      xAxis.appendChild(span);
    }

  }

  /**
   * Stamp the y-axis values, top (max) to bottom (min).
   *
   * The span is min..max, NOT 0..max: a line chart's y-scale is derived from its
   * own extent (see #render), so an axis running from 0 would label gridlines that
   * are not where the lines actually sit. Descending because the highest value is
   * at the TOP of the plot but the FIRST child in the column.
   */
  /** The number of value divisions — shared by the axis and the gridlines. */
  #tickSteps(): number {
    // min: 0 rather than a >= 0 test, so a NEGATIVE count clamps to "no ticks"
    // instead of silently falling back to the default.
    return this.num('data-ticks', DEFAULT_TICKS, { min: 0, int: true });
  }

  #renderYAxis(min: number, max: number): void {
    const axis = this.$('.y-axis');
    const tpl = this.$<HTMLTemplateElement>('template.ytick-tpl');
    if (!axis || !tpl) return;

    const steps = this.#tickSteps();
    axis.replaceChildren();
    // Written, not inferred: an absent data-ticks must not mean "no axis", and a
    // data-ticks="0" must.
    this.toggleAttribute('data-has-y-axis', steps > 0 && this.#series.length > 0);
    if (steps <= 0 || !this.#series.length) return;

    // One label per division boundary at the SAME percentage its gridline uses.
    for (let i = 0; i <= steps; i++) {
      const tick = tpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
      tick.style.setProperty('--_at', `${tickPercent(i, steps)}%`);
      tick.querySelector('.y-value')!.textContent = formatTick(min + ((max - min) * i) / steps);
      axis.appendChild(tick);
    }
    // The axis width is FIXED in CSS and long labels truncate — nothing measured
    // here. Sizing it from the data made the plot wiggle whenever a value crossed
    // a digit boundary.
  }
}

customElements.define('sherpa-line-chart', SherpaLineChart);
