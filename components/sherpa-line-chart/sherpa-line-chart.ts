/**
 * @element sherpa-line-chart
 * @category media
 * @description Line or area chart for visualising trends over a continuous dimension such as
 *   time. Use for time-series data (daily active users, weekly revenue, monthly error rates).
 *   Built with CSS clip-path — no canvas or SVG. Feed via setData({ labels, series }),
 *   data-src-json (standalone/static pages), or the ContentAttributesMixin data pipeline
 *   (app-shell integration — last writer wins on datasetfiltered). Use the area variant
 *   (data-variant="area") for cumulative totals or filled ranges. Supports multi-series with
 *   up to 8 colour-coded lines.
 *
 * @attr {string}  data-title          — Chart heading text
 * @attr {boolean} data-loading        — Show loading state
 * @attr {enum}    data-variant         — line | area
 * @attr {string}  data-segment-field  — Field for series grouping
 * @attr {enum}    data-segment-mode    — Segment display mode
 * @attr {string}  data-sort-field     — Sort field
 * @attr {enum}    data-sort-direction — asc | desc
 * @attr {string}  data-src-json       — URL to JSON: { columns, rows } or { labels, series }
 *
 * @method setData(data) — Set chart data: { labels, series: [{ name, values }] } or config
 */

import { ContentAttributesMixin } from '../utilities/content-attributes-mixin.js';
import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';
import { getSegmentField, isSegmentEnabled, getActiveSort, syncChartTitle } from '../utilities/chart-utils.js';
import { injectFilterMenu, removeFilterMenu, toggleFilters, toggleLegend, syncFilterMenuItems } from '../utilities/filter-menu-utils.js';
import '../sherpa-button/sherpa-button.js';
import '../sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.js';

const MAX_SEGMENTS = 8;
const OTHER_COLOR = '#9e9ea8';

const DEFAULT_COLORS = [
  '#7b1ce6', // purple
  '#16abe2', // blue
  '#2bd1c1', // teal
  '#ffaa00', // amber
  '#f3699d', // pink
  '#c046ff', // violet
  '#e67c1c', // orange
  '#e6416e', // raspberry
];

/** A column descriptor from the content payload. */
interface ChartColumn {
  field?: string;
  name?: string;
  type?: string;
}

/** One line series. */
interface LineSeries {
  name: string;
  values: number[];
  color?: string;
}

/** Transformed chart data: shared labels + one or more series. */
interface LineData {
  labels: string[];
  series: LineSeries[];
}

/** Aggregated content payload delivered via the dataset cascade. */
interface LineContentData {
  columns?: ChartColumn[];
  rows?: Record<string, unknown>[];
  name?: string;
  metadata?: Record<string, unknown>;
  segmentBy?: string | null;
  _fromCascade?: boolean;
  [key: string]: unknown;
}

export class SherpaLineChart extends ContentAttributesMixin(SherpaElement) {

  /* ── Config ───────────────────────────────────────────────────── */

  static override get cssUrl(): string  { return new URL('./sherpa-line-chart.css', import.meta.url).href; }
  static override get htmlUrl(): string { return new URL('./sherpa-line-chart.html', import.meta.url).href; }

  static override get observedAttributes(): string[] {
    return [
      ...super.observedAttributes,
      'data-title',
      'data-loading',
      'data-variant',
      'data-segment-field',
      'data-segment-mode',
      'data-sort-field',
      'data-sort-direction',
    ];
  }

  /* ── State ────────────────────────────────────────────────────── */

  #data: LineData | null = null;
  #contentData: LineContentData | null = null;
  #prevSeriesData: LineSeries[] | null = null;
  #seriesTpl: HTMLTemplateElement | null = null;
  #shapeTpl: HTMLTemplateElement | null = null;
  #legendItemTpl: HTMLTemplateElement | null = null;
  #xLabelTpl: HTMLTemplateElement | null = null;
  #filterMenuTpl: ReturnType<typeof injectFilterMenu> = null;

  public els = this.cacheElements({
    title: '.chart-title',
    yLabels: { selector: '.y-label', all: true },
    chartArea: { selector: '.chart-area', type: HTMLElement },
    seriesLayer: { selector: '.series-layer', type: HTMLElement },
    xAxis: '.x-axis',
    legend: '.chart-legend',
  });

  /* ── Lifecycle ────────────────────────────────────────────────── */

  override onRender(): void {

    if (!this.hasAttribute('data-viz')) this.setAttribute('data-viz', '');

    // Cloning prototypes live inside the shadow root
    this.#seriesTpl = this.$<HTMLTemplateElement>('template.series-tpl');
    this.#shapeTpl = this.$<HTMLTemplateElement>('template.shape-tpl');
    this.#legendItemTpl = this.$<HTMLTemplateElement>('template.legend-item-tpl');
    this.#xLabelTpl = this.$<HTMLTemplateElement>('template.x-label-tpl');

    this.#syncTitle();
    if (this.#data) this.#render();
  }

  override onConnect(): void {
    super.onConnect();
    this.#filterMenuTpl = injectFilterMenu(this);
    this.addEventListener('toggle-filters', this.#onToggleFilters);
    this.addEventListener('toggle-legend', this.#onToggleLegend);
    this.addEventListener('menu-populate', this.#onMenuPopulate);
  }

  override onDisconnect(): void {
    super.onDisconnect();
    this.removeEventListener('toggle-filters', this.#onToggleFilters);
    this.removeEventListener('toggle-legend', this.#onToggleLegend);
    this.removeEventListener('menu-populate', this.#onMenuPopulate);
    removeFilterMenu(this.#filterMenuTpl);
    this.#filterMenuTpl = null;
  }

  override onAttributeChanged(name: string, oldValue: string | null, newValue: string | null): void {
    if (oldValue === newValue) return;
    super.onAttributeChanged(name, oldValue, newValue);
    if (name === 'data-title') {
      this.#syncTitle();
      const layout = this.$<HTMLElement>('.chart-layout');
      if (layout) layout.setAttribute('aria-label', newValue || 'Line chart');
    }
    if (name === 'data-segment-field' || name === 'data-segment-mode') {
      this.#syncTitle();
      if (this.isAttrReactionSuppressed) return;
      // External attribute change — full re-aggregate needed
      if (this.#contentData) this.reAggregate();
    }
    if (name === 'data-sort-field' || name === 'data-sort-direction') {
      if (this.isAttrReactionSuppressed) return;
      // Local re-sort of existing data
      if (this.#contentData) {
        this.#transformContentData();
        this.#render();
      }
    }
  }

  /* ── Public API ───────────────────────────────────────────────── */

  override async onJsonData(data: LineData | LineContentData): Promise<void> {
    await this.setData(data);
  }

  /**
   * Set chart data and render.
   * Accepts either:
   *   - A content config object (from ContentAttributesMixin.load())
   *   - A direct { labels, series } object
   */
  async setData(data: LineData | LineContentData): Promise<void> {
    await this.rendered;
    const d = data as LineData & LineContentData;

    // Direct { labels, series } — original programmatic API
    if (d && (Array.isArray(d.labels) || Array.isArray(d.series))) {
      this.#data = d;
      this.#render();
      return;
    }

    // Pre-aggregated data from dataset cascade
    if (d?._fromCascade) {
      this.#contentData = d;
      this.#transformContentData();
      this.#render();
      return;
    }

    // Content config from ContentAttributesMixin (legacy)
    const explicitSegmentBy =
      d && Object.prototype.hasOwnProperty.call(d, "segmentBy");
    this.#contentData = d;

    // Apply segmentBy from config
    if (explicitSegmentBy) {
      if (d.segmentBy) {
        this.setAttribute("data-segment-field", d.segmentBy);
        this.setAttribute("data-segment-mode", "on");
      } else {
        this.removeAttribute("data-segment-field");
        this.removeAttribute("data-segment-mode");
      }
    }

    this.#transformContentData();
    this.#render();
  }

  /* ── Private: transform ───────────────────────────────────────── */

  /* ── Sort helpers ──────────────────────────────────────────── */

  #applyLocalSort(data: LineData | null): LineData | null {
    const activeSort = getActiveSort(this);
    if (!activeSort || !data) return data;

    const labels = [...data.labels];
    const series = data.series.map((s) => ({ ...s, values: [...s.values] }));
    if (!labels.length || !series.length) return data;

    const indices = labels.map((_, i) => i);
    const dir = activeSort.dir || 'asc';

    // Sort by time — parse labels as dates
    indices.sort((a, b) => {
      let cmp = 0;
      try {
        cmp = Temporal.PlainDate.compare(
          Temporal.PlainDate.from(labels[a] ?? ''),
          Temporal.PlainDate.from(labels[b] ?? ''),
        );
      } catch { cmp = 0; }
      return dir === 'desc' ? -cmp : cmp;
    });

    return {
      labels: indices.map((i) => labels[i] ?? ''),
      series: series.map((s) => ({
        ...s,
        values: indices.map((i) => s.values[i] ?? 0),
      })),
    };
  }

  /**
   * Transform unified { columns, rows } into { labels, series } for line chart.
   * Uses the category column as X-axis labels, the value column for Y values,
   * and optionally the series column to split into multiple lines.
   *
   * When data-segment-field is active, uses the segment field as the series
   * field, producing one line per unique segment value.
   */
  #transformContentData(): void {
    if (!this.#contentData) { this.#data = null; return; }

    const { columns = [], rows = [] } = this.#contentData;
    if (!rows.length || columns.length < 2) { this.#data = null; return; }

    const segmentField = isSegmentEnabled(this)
      ? getSegmentField(this)
      : null;

    const labelField = this.#resolveLabelField(columns, segmentField);
    const valueField = this.#resolveValueField(columns, labelField, segmentField);
    if (!labelField || !valueField) { this.#data = null; return; }

    // Determine effective grouping field: explicit segment, or implicit series column
    const effectiveSegmentField = segmentField
      || (columns.length > 2
        ? columns.find((c: ChartColumn) => c.field !== labelField && c.field !== valueField)?.field
        : null);

    if (effectiveSegmentField && effectiveSegmentField !== labelField && effectiveSegmentField !== valueField) {
      // Multi-series: one line per unique segment/group value
      const seriesNames = [...new Set(rows.map((r: Record<string, unknown>) => String(r[effectiveSegmentField] ?? '')))].sort();
      const labels = [...new Set(rows.map((r: Record<string, unknown>) => String(r[labelField] ?? '')))];

      const series = seriesNames.map((name: string) => {
        const values = labels.map((label: string) => {
          const matching = rows.filter((r: Record<string, unknown>) =>
            String(r[effectiveSegmentField]) === name && String(r[labelField]) === label
          );
          return matching.reduce((sum: number, r: Record<string, unknown>) => sum + (Number(r[valueField]) || 0), 0);
        });
        return { name, values };
      });

      this.#data = { labels, series };
    } else {
      // Single series — aggregate by label
      const labelOrder: string[] = [];
      const agg = new Map<string, number>();
      for (const row of rows) {
        const l = String(row[labelField] ?? '');
        if (!agg.has(l)) { labelOrder.push(l); agg.set(l, 0); }
        agg.set(l, (agg.get(l) ?? 0) + (Number(row[valueField]) || 0));
      }
      const valueName = columns.find((c: ChartColumn) => c.field === valueField)?.name || valueField || 'Value';
      this.#data = {
        labels: labelOrder,
        series: [{ name: valueName, values: labelOrder.map((l: string) => agg.get(l) ?? 0) }],
      };
    }

    // Apply local sort
    this.#data = this.#applyLocalSort(this.#data);

    // Limit to last 12 data points (mirrors sparkline max)
    if (this.#data && this.#data.labels.length > 12) {
      this.#data = {
        labels: this.#data.labels.slice(-12),
        series: this.#data.series.map((s: LineSeries) => ({
          ...s,
          values: s.values.slice(-12),
        })),
      };
    }
  }

  /* ── Private: field resolution ────────────────────────────────── */

  #resolveLabelField(columns: ChartColumn[], segmentField: string | null): string | null {
    const meta = (this.#contentData?.metadata || {}) as { primaryField?: string };
    if (meta.primaryField && columns.some((c) => c.field === meta.primaryField)) {
      return meta.primaryField;
    }
    // Prefer a datetime or string column that isn't the segment field
    const fallback = columns.find((c) => {
      const type = (c.type || '').toLowerCase();
      return (type === 'datetime' || type === 'string') && c.field !== segmentField;
    });
    return fallback?.field || columns[0]?.field || null;
  }

  #resolveValueField(columns: ChartColumn[], labelField: string | null, segmentField: string | null): string | null {
    const numericCols = columns.filter((c) => {
      const type = (c.type || '').toLowerCase();
      return ['number', 'numeric', 'currency', 'percent'].includes(type);
    });
    const preferred = numericCols.find((c) => c.field !== labelField && c.field !== segmentField);
    if (preferred) return preferred.field ?? null;
    const fallback = numericCols.find((c) => c.field !== segmentField) || numericCols[0];
    return fallback?.field || columns[columns.length - 1]?.field || null;
  }

  /* ── Private: sync ────────────────────────────────────────────── */

  #syncTitle(): void { syncChartTitle(this.els.title ?? null, this); }

  /* ── Private: cap series ──────────────────────────────────────── */

  #capSeries(series: LineSeries[]): LineSeries[] {
    if (series.length <= MAX_SEGMENTS) return series;
    const withTotals = series.map((s) => ({
      ...s,
      _total: s.values.reduce((a, b) => a + b, 0),
    }));
    withTotals.sort((a, b) => b._total - a._total);
    const kept = withTotals.slice(0, MAX_SEGMENTS - 1);
    const rest = withTotals.slice(MAX_SEGMENTS - 1);
    const template = kept[0];
    if (template) {
      const otherValues = template.values.map((_, i) =>
        rest.reduce((s, r) => s + (r.values[i] || 0), 0)
      );
      kept.push({ name: 'Other', values: otherValues, color: OTHER_COLOR, _total: 0 });
    }
    return kept.map(({ _total, ...s }) => s);
  }

  /* ── Private: render ──────────────────────────────────────────── */

  #render(): void {
    const seriesLayer = this.els.seriesLayer;
    if (!seriesLayer || !this.#data) return;

    const { labels = [] } = this.#data;
    let { series = [] } = this.#data;
    series = this.#capSeries(series);
    const pointCount = labels.length;
    if (!pointCount || !series.length) return;

    // Compute global min/max across all series
    let globalMin = Infinity;
    let globalMax = -Infinity;
    for (const s of series) {
      for (const v of s.values) {
        if (v < globalMin) globalMin = v;
        if (v > globalMax) globalMax = v;
      }
    }
    if (globalMin === globalMax) globalMax = globalMin + 1;

    // Add 5% padding and round to include 0 if close
    const range = globalMax - globalMin;
    let yMin = globalMin - range * 0.05;
    const yMax = globalMax + range * 0.05;
    if (yMin > 0 && yMin < range * 0.3) yMin = 0;

    // Set range on host — CSS normalises values from these
    this.style.setProperty('--_min', String(yMin));
    this.style.setProperty('--_range', String(yMax - yMin || 1));

    // ── Y-axis labels (top → bottom = max → min) ────────────────
    const yLabels = Array.from(this.els.yLabels);
    const tickCount = yLabels.length;
    for (let i = 0; i < tickCount; i++) {
      const val = yMax - (yMax - yMin) * (i / (tickCount - 1));
      const yl = yLabels[i];
      if (yl) yl.textContent = this.#formatAxisValue(val);
    }

    // ── X-axis labels ───────────────────────────────────────────
    const xAxis = this.els.xAxis;
    const xLabelTpl = this.#xLabelTpl;
    if (xAxis) {
      xAxis.replaceChildren();
      for (const label of labels) {
        const span = xLabelTpl?.content.firstElementChild?.cloneNode(true) as HTMLElement | undefined;
        if (!span) continue;
        span.textContent = label;
        xAxis.appendChild(span);
      }
    }

    // ── Series (smart diff — only replace changed/new shapes) ───
    // Unchanged shapes are kept in place so their CSS animation does not
    // re-fire. Shapes whose values changed, or brand-new shapes, are
    // created fresh so the rise animation plays only for those segments.
    const prevSeries = this.#prevSeriesData;
    const seriesTpl = this.#seriesTpl;
    const shapeTpl = this.#shapeTpl;

    series.forEach((s, si) => {
      const color = s.color || DEFAULT_COLORS[si % DEFAULT_COLORS.length];
      const prev = prevSeries?.[si];

      // Reuse existing .series element or create a new one
      let seriesEl = seriesLayer.children[si] as HTMLElement | undefined;
      if (!seriesEl) {
        seriesEl = seriesTpl?.content.firstElementChild?.cloneNode(true) as HTMLElement | undefined;
        if (!seriesEl) return;
        seriesLayer.appendChild(seriesEl);
      }
      seriesEl.style.color = color ?? '';

      const segmentCount = Math.max(s.values.length - 1, 0);

      for (let i = 0; i < segmentCount; i++) {
        const vStart = s.values[i];
        const vEnd   = s.values[i + 1];
        const unchanged = prev && prev.values[i] === vStart && prev.values[i + 1] === vEnd;
        const existing  = seriesEl.children[i];

        if (unchanged && existing) {
          // Segment is identical — keep element as-is, no animation
          continue;
        }

        // Build replacement shape (new element triggers CSS rise animation)
        const shape = shapeTpl?.content.firstElementChild?.cloneNode(true) as HTMLElement | undefined;
        if (!shape) continue;
        shape.style.setProperty('--_v-start', String(vStart));
        shape.style.setProperty('--_v-end',   String(vEnd));
        shape.style.setProperty('--_i', String(i));

        const startPt = shape.querySelector<HTMLElement>('.point[data-role="start"]');
        const endPt   = shape.querySelector<HTMLElement>('.point[data-role="end"]');
        if (i === 0 && startPt) startPt.title = `${s.name}: ${this.#formatAxisValue(s.values[0] ?? 0)}`;
        if (endPt) endPt.title = `${s.name}: ${this.#formatAxisValue(s.values[i + 1] ?? 0)}`;

        if (existing) {
          seriesEl.replaceChild(shape, existing);
        } else {
          seriesEl.appendChild(shape);
        }
      }

      // Remove any extra shapes left over from a shorter previous dataset
      while (seriesEl.children.length > segmentCount && seriesEl.lastChild) {
        seriesEl.removeChild(seriesEl.lastChild);
      }
    });

    // Remove extra series elements left over from a dataset with more series
    while (seriesLayer.children.length > series.length && seriesLayer.lastChild) {
      seriesLayer.removeChild(seriesLayer.lastChild);
    }

    // Snapshot current series values for the next diff
    this.#prevSeriesData = series.map((s) => ({ ...s, values: [...s.values] }));

    this.#updateAriaLabel(labels, series);

    // ── Legend ───────────────────────────────────────────────────
    const legend = this.els.legend;
    const legendItemTpl = this.#legendItemTpl;
    if (legend) {
      legend.replaceChildren();
      series.forEach((s, si) => {
        const color = s.color || DEFAULT_COLORS[si % DEFAULT_COLORS.length];
        const item = legendItemTpl?.content.firstElementChild?.cloneNode(true) as HTMLElement | undefined;
        if (!item) return;
        const key = item.querySelector<HTMLElement>('.legend-key');
        if (key) key.style.backgroundColor = color ?? '';
        const lbl = item.querySelector('.legend-label');
        if (lbl) lbl.textContent = s.name || '';
        legend.appendChild(item);
      });
    }
  }

  #updateAriaLabel(labels: string[], series: { name: string }[]): void {
    const title = this.getAttribute('data-title') || 'Line chart';
    const layout = this.$<HTMLElement>('.chart-layout');
    const summary = this.$<HTMLElement>('.chart-sr-summary');
    if (layout) layout.setAttribute('aria-label', title);
    if (summary && labels.length) {
      const seriesNames = series.map((s) => s.name).filter(Boolean).join(', ');
      summary.textContent = seriesNames
        ? `${title}. ${series.length} series: ${seriesNames}. ${labels.length} data points.`
        : `${title}. ${labels.length} data points.`;
    }
  }

  /* ── Private: format ──────────────────────────────────────────── */

  #formatAxisValue(val: number): string {
    const abs = Math.abs(val);
    if (abs >= 1e6) return `${(val / 1e6).toFixed(1)}M`;
    if (abs >= 1e3) return `${(val / 1e3).toFixed(1)}K`;
    if (Number.isInteger(val)) return String(val);
    return val.toFixed(1);
  }

  /* ── Filter menu ─────────────────────────────────────────────────────── */

  #onToggleFilters = (): void => { toggleFilters(this); };
  #onToggleLegend  = (): void => { toggleLegend(this); };
  #onMenuPopulate  = (e: CustomEvent): void => { syncFilterMenuItems(e, this); };
}

customElements.define('sherpa-line-chart', SherpaLineChart);