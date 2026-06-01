/**
 * @element sherpa-line-chart
 * @category media
 * @description Line / area chart using CSS clip-path segments.
 *   JS sets raw data as CSS custom properties; CSS normalises via calc()
 *   and renders clip-path polygons. Zero polygon computation in JS.
 *
 * @attr {string}  [data-title]          — Chart heading text
 * @attr {boolean} [data-loading]        — Show loading state
 * @attr {enum}    [data-variant]         — line | area
 * @attr {string}  [data-segment-field]  — Field for series grouping
 * @attr {enum}    [data-segment-mode]    — Segment display mode
 * @attr {string}  [data-sort-field]     — Sort field
 * @attr {enum}    [data-sort-direction] — asc | desc
 *
 * @method setData(data) — Set chart data: { labels, series: [{ name, values }] } or config
 */

import {
  ContentAttributesMixin,
  // @ts-expect-error - TODO: Fix type
  CONTENT_ATTRIBUTES,
} from '../utilities/content-attributes-mixin.js';
import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';
import { getSegmentField, isSegmentEnabled, getActiveSort } from '../utilities/chart-utils.js';
import { injectFilterMenu, removeFilterMenu } from '../utilities/filter-menu-utils.js';
import '../sherpa-button/sherpa-button.js';
import '../sherpa-filter-bar/sherpa-filter-bar.js';
import { formatFieldName, cleanTitleBase } from '../utilities/format-utils.js';

const MAX_SEGMENTS = 8;
const OTHER_COLOR = '#9e9ea8';
// @ts-expect-error - TODO: Fix type
const MAX_SHAPE_SLOTS = 12;

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

  #data = null;
  #contentData = null;
  #prevSeriesData = null;
  // @ts-expect-error - TODO: Fix type
  #titleEl;
  // @ts-expect-error - TODO: Fix type
  #yLabelEls;
  // @ts-expect-error - TODO: Fix type
  #chartAreaEl;
  // @ts-expect-error - TODO: Fix type
  #seriesLayerEl;
  // @ts-expect-error - TODO: Fix type
  #xAxisEl;
  // @ts-expect-error - TODO: Fix type
  #legendEl;
  // @ts-expect-error - TODO: Fix type
  #seriesTpl;
  // @ts-expect-error - TODO: Fix type
  #shapeTpl;
  // @ts-expect-error - TODO: Fix type
  #legendItemTpl;
  // @ts-expect-error - TODO: Fix type
  #xLabelTpl;
  #filterMenuTpl = null;

  /* ── Lifecycle ────────────────────────────────────────────────── */

  override onRender(): void {

    if (!this.hasAttribute('data-viz')) this.setAttribute('data-viz', '');

    // @ts-expect-error - TODO: Fix type
    this.els.title     = this.$('.chart-title');
    // @ts-expect-error - TODO: Fix type
    this.els.yLabels   = this.$$('.y-label');
    // @ts-expect-error - TODO: Fix type
    this.els.chartArea = this.$('.chart-area');
    // @ts-expect-error - TODO: Fix type
    this.els.seriesLayer = this.$('.series-layer');
    // @ts-expect-error - TODO: Fix type
    this.els.xAxis     = this.$('.x-axis');
    // @ts-expect-error - TODO: Fix type
    this.els.legend    = this.$('.chart-legend');

    // Cloning prototypes live inside the shadow root
    const root = this.shadowRoot;
    // @ts-expect-error - TODO: Fix type
    this.#seriesTpl = root.querySelector('template.series-tpl');
    // @ts-expect-error - TODO: Fix type
    this.#shapeTpl   = root.querySelector('template.shape-tpl');
    // @ts-expect-error - TODO: Fix type
    this.#legendItemTpl = root.querySelector('template.legend-item-tpl');
    // @ts-expect-error - TODO: Fix type
    this.#xLabelTpl = root.querySelector('template.x-label-tpl');

    this.#syncTitle();
    if (this.#data) this.#render();
  }

  override onConnect(): void {
    super.onConnect();
    // @ts-expect-error - TODO: Fix type
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

  override onAttributeChanged(name: string, oldValue: string | null, newValue: string | null) {
    if (oldValue === newValue) return;
    super.onAttributeChanged(name, oldValue, newValue);
    if (name === 'data-title') this.#syncTitle();
    if (name === 'data-segment-field' || name === 'data-segment-mode') {
      this.#syncTitle();
      if (this._suppressAttrReaction) return;
      // External attribute change — full re-aggregate needed
      if (this.#contentData) this.reAggregate();
    }
    if (name === 'data-sort-field' || name === 'data-sort-direction') {
      if (this._suppressAttrReaction) return;
      // Local re-sort of existing data
      if (this.#contentData) {
        this.#transformContentData();
        this.#render();
      }
    }
  }

  /* ── Public API ───────────────────────────────────────────────── */

  /**
   * Set chart data and render.
   * Accepts either:
   *   - A content config object (from ContentAttributesMixin.load())
   *   - A direct { labels, series } object
   */
  // @ts-expect-error - TODO: Fix type
  async setData(data) {
    await this.rendered;

    // Direct { labels, series } — original programmatic API
    if (data && (Array.isArray(data.labels) || Array.isArray(data.series))) {
      this.#data = data;
      this.#render();
      return;
    }

    // Pre-aggregated data from dataset cascade
    if (data?._fromCascade) {
      this.#contentData = data;
      this.#transformContentData();
      this.#render();
      return;
    }

    // Content config from ContentAttributesMixin (legacy)
    const explicitSegmentBy =
      data && Object.prototype.hasOwnProperty.call(data, "segmentBy");
    this.#contentData = data;

    // Apply segmentBy from config
    if (explicitSegmentBy) {
      if (data.segmentBy) {
        this.setAttribute("data-segment-field", data.segmentBy);
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

  // @ts-expect-error - TODO: Fix type
  #applyLocalSort(data) {
    const activeSort = getActiveSort(this);
    if (!activeSort || !data) return data;

    const labels = [...data.labels];
    const series = data.series.map((s: any) => ({ ...s, values: [...s.values] }));
    if (!labels.length || !series.length) return data;

    const indices = labels.map((_, i) => i);
    const dir = activeSort.dir || 'asc';

    // Sort by time — parse labels as dates
    indices.sort((a: any, b: any) => {
      const tA = new Date(labels[a]).getTime() || 0;
      const tB = new Date(labels[b]).getTime() || 0;
      const diff = tA - tB;
      return dir === 'desc' ? -diff : diff;
    });

    return {
      labels: indices.map((i: any) => labels[i]),
      series: series.map((s: any) => ({
        ...s,
        values: indices.map((i: any) => s.values[i]),
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
  #transformContentData() {
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
        // @ts-expect-error - TODO: Fix type
        ? columns.find((c: any) => c.field !== labelField && c.field !== valueField)?.field
        : null);

    if (effectiveSegmentField && effectiveSegmentField !== labelField && effectiveSegmentField !== valueField) {
      // Multi-series: one line per unique segment/group value
      const seriesNames = [...new Set(rows.map((r: any) => String(r[effectiveSegmentField] ?? '')))].sort();
      const labels = [...new Set(rows.map((r: any) => String(r[labelField] ?? '')))];

      const series = seriesNames.map((name: any) => {
        const values = labels.map((label: any) => {
          const matching = rows.filter((r: any) =>
            String(r[effectiveSegmentField]) === name && String(r[labelField]) === label
          );
          return matching.reduce((sum: any, r: any) => sum + (Number(r[valueField]) || 0), 0);
        });
        return { name, values };
      });

      // @ts-expect-error - TODO: Fix type
      this.#data = { labels, series };
    } else {
      // Single series — aggregate by label
      const labelOrder = [];
      const agg = new Map();
      for (const row of rows) {
        const l = String(row[labelField] ?? '');
        if (!agg.has(l)) { labelOrder.push(l); agg.set(l, 0); }
        agg.set(l, agg.get(l) + (Number(row[valueField]) || 0));
      }
      // @ts-expect-error - TODO: Fix type
      const valueName = columns.find((c: any) => c.field === valueField)?.name || valueField || 'Value';
      // @ts-expect-error - TODO: Fix type
      this.#data = {
        labels: labelOrder,
        series: [{ name: valueName, values: labelOrder.map((l: any) => agg.get(l)) }],
      };
    }

    // Apply local sort
    this.#data = this.#applyLocalSort(this.#data);

    // Limit to last 12 data points (mirrors sparkline max)
    // @ts-expect-error - TODO: Fix type
    if (this.#data && this.#data.labels.length > 12) {
      // @ts-expect-error - TODO: Fix type
      this.#data = {
        // @ts-expect-error - TODO: Fix type
        labels: this.#data.labels.slice(-12),
        // @ts-expect-error - TODO: Fix type
        series: this.#data.series.map((s: any) => ({
          ...s,
          values: s.values.slice(-12),
        })),
      };
    }
  }

  /* ── Private: field resolution ────────────────────────────────── */

  // @ts-expect-error - TODO: Fix type
  #resolveLabelField(columns, segmentField) {
    // @ts-expect-error - TODO: Fix type
    const meta = this.#contentData?.metadata || {};
    if (meta.primaryField && columns.some((c: any) => c.field === meta.primaryField)) {
      return meta.primaryField;
    }
    // Prefer a datetime or string column that isn't the segment field
    const fallback = columns.find((c: any) => {
      const type = (c.type || '').toLowerCase();
      return (type === 'datetime' || type === 'string') && c.field !== segmentField;
    });
    return fallback?.field || columns[0]?.field || null;
  }

  // @ts-expect-error - TODO: Fix type
  #resolveValueField(columns, labelField, segmentField) {
    const numericCols = columns.filter((c: any) => {
      const type = (c.type || '').toLowerCase();
      return ['number', 'numeric', 'currency', 'percent'].includes(type);
    });
    const preferred = numericCols.find((c: any) => c.field !== labelField && c.field !== segmentField);
    if (preferred) return preferred.field;
    const fallback = numericCols.find((c: any) => c.field !== segmentField) || numericCols[0];
    return fallback?.field || columns[columns.length - 1]?.field || null;
  }

  /* ── Private: sync ────────────────────────────────────────────── */

  #syncTitle() {
    // @ts-expect-error - TODO: Fix type
    if (this.els.title) {
      const entity = cleanTitleBase(this.dataset["title"] || '');
      const segMode = this.getAttribute('data-segment-mode');
      const groupField = this.getAttribute('data-segment-field')
        || this.getAttribute('data-category');
      const hasActiveGroup = segMode !== 'off' && !!groupField;
      // @ts-expect-error - TODO: Fix type
      this.els.title.textContent = hasActiveGroup
        ? `${entity} by ${formatFieldName(groupField)}`
        : `All ${entity}`;
    }
  }

  /* ── Private: cap series ──────────────────────────────────────── */

  // @ts-expect-error - TODO: Fix type
  #capSeries(series) {
    if (series.length <= MAX_SEGMENTS) return series;
    const withTotals = series.map((s: any) => ({
      ...s,
      _total: s.values.reduce((a: any, b: any) => a + b, 0),
    }));
    withTotals.sort((a: any, b: any) => b._total - a._total);
    const kept = withTotals.slice(0, MAX_SEGMENTS - 1);
    const rest = withTotals.slice(MAX_SEGMENTS - 1);
    // @ts-expect-error - TODO: Fix type
    const otherValues = kept[0].values.map((_, i) =>
      rest.reduce((s: any, r: any) => s + (r.values[i] || 0), 0)
    );
    kept.push({ name: 'Other', values: otherValues, color: OTHER_COLOR });
    // @ts-expect-error - TODO: Fix type
    return kept.map(({ _total, ...s }) => s);
  }

  /* ── Private: render ──────────────────────────────────────────── */

  #render() {
    // @ts-expect-error - TODO: Fix type
    if (!this.els.seriesLayer || !this.#data) return;

    const { labels = [] } = this.#data;
    let { series = [] } = this.#data;
    series = this.#capSeries(series);
    const pointCount = labels.length;
    if (!pointCount || !series.length) return;

    // Compute global min/max across all series
    let globalMin = Infinity;
    let globalMax = -Infinity;
    for (const s of series) {
      // @ts-expect-error - TODO: Fix type
      for (const v of s.values) {
        if (v < globalMin) globalMin = v;
        if (v > globalMax) globalMax = v;
      }
    }
    if (globalMin === globalMax) globalMax = globalMin + 1;

    // Add 5% padding and round to include 0 if close
    const range = globalMax - globalMin;
    let yMin = globalMin - range * 0.05;
    let yMax = globalMax + range * 0.05;
    if (yMin > 0 && yMin < range * 0.3) yMin = 0;

    // Set range on host — CSS normalises values from these
    // @ts-expect-error - TODO: Fix type
    this.style.setProperty('--_min', yMin);
    // @ts-expect-error - TODO: Fix type
    this.style.setProperty('--_range', yMax - yMin || 1);

    // ── Y-axis labels (top → bottom = max → min) ────────────────
    // @ts-expect-error - TODO: Fix type
    const yLabels = Array.from(this.els.yLabels);
    const tickCount = yLabels.length;
    for (let i = 0; i < tickCount; i++) {
      const val = yMax - (yMax - yMin) * (i / (tickCount - 1));
      // @ts-expect-error - TODO: Fix type
      yLabels[i].textContent = this.#formatAxisValue(val);
    }

    // ── X-axis labels ───────────────────────────────────────────
    // @ts-expect-error - TODO: Fix type
    this.els.xAxis.replaceChildren();
    for (const label of labels) {
      const span = this.#xLabelTpl.content.firstElementChild.cloneNode(true);
      span.textContent = label;
      // @ts-expect-error - TODO: Fix type
      this.els.xAxis.appendChild(span);
    }

    // ── Series (smart diff — only replace changed/new shapes) ───
    // Unchanged shapes are kept in place so their CSS animation does not
    // re-fire. Shapes whose values changed, or brand-new shapes, are
    // created fresh so the rise animation plays only for those segments.
    const prevSeries = this.#prevSeriesData;

    series.forEach((s, si) => {
      // @ts-expect-error - TODO: Fix type
      const color = s.color || DEFAULT_COLORS[si % DEFAULT_COLORS.length];
      const prev = prevSeries?.[si];

      // Reuse existing .series element or create a new one
      // @ts-expect-error - TODO: Fix type
      let seriesEl = this.els.seriesLayer.children[si];
      if (!seriesEl) {
        seriesEl = this.#seriesTpl.content.firstElementChild.cloneNode(true);
        // @ts-expect-error - TODO: Fix type
        this.els.seriesLayer.appendChild(seriesEl);
      }
      seriesEl.style.color = color;

      // @ts-expect-error - TODO: Fix type
      const segmentCount = Math.max(s.values.length - 1, 0);

      for (let i = 0; i < segmentCount; i++) {
        // @ts-expect-error - TODO: Fix type
        const vStart = s.values[i];
        // @ts-expect-error - TODO: Fix type
        const vEnd   = s.values[i + 1];
        // @ts-expect-error - TODO: Fix type
        const unchanged = prev && prev.values[i] === vStart && prev.values[i + 1] === vEnd;
        const existing  = seriesEl.children[i];

        if (unchanged && existing) {
          // Segment is identical — keep element as-is, no animation
          continue;
        }

        // Build replacement shape (new element triggers CSS rise animation)
        const shape = this.#shapeTpl.content.firstElementChild.cloneNode(true);
        shape.style.setProperty('--_v-start', vStart);
        shape.style.setProperty('--_v-end',   vEnd);
        shape.style.setProperty('--_i', i);

        const startPt = shape.querySelector('.point[data-role="start"]');
        const endPt   = shape.querySelector('.point[data-role="end"]');
        // @ts-expect-error - TODO: Fix type
        if (i === 0 && startPt) startPt.title = `${s.name}: ${this.#formatAxisValue(s.values[0])}`;
        // @ts-expect-error - TODO: Fix type
        if (endPt) endPt.title = `${s.name}: ${this.#formatAxisValue(s.values[i + 1])}`;

        if (existing) {
          seriesEl.replaceChild(shape, existing);
        } else {
          seriesEl.appendChild(shape);
        }
      }

      // Remove any extra shapes left over from a shorter previous dataset
      while (seriesEl.children.length > segmentCount) {
        seriesEl.removeChild(seriesEl.lastChild);
      }
    });

    // Remove extra series elements left over from a dataset with more series
    // @ts-expect-error - TODO: Fix type
    while (this.els.seriesLayer.children.length > series.length) {
      // @ts-expect-error - TODO: Fix type
      this.els.seriesLayer.removeChild(this.els.seriesLayer.lastChild);
    }

    // Snapshot current series values for the next diff
    // @ts-expect-error - TODO: Fix type
    this.#prevSeriesData = series.map((s: any) => ({ ...s, values: [...s.values] }));

    // ── Legend ───────────────────────────────────────────────────
    // @ts-expect-error - TODO: Fix type
    this.els.legend.replaceChildren();
    series.forEach((s, si) => {
      // @ts-expect-error - TODO: Fix type
      const color = s.color || DEFAULT_COLORS[si % DEFAULT_COLORS.length];
      const item = this.#legendItemTpl.content.firstElementChild.cloneNode(true);
      item.querySelector('.legend-key').style.backgroundColor = color;
      // @ts-expect-error - TODO: Fix type
      item.querySelector('.legend-label').textContent = s.name || '';
      // @ts-expect-error - TODO: Fix type
      this.els.legend.appendChild(item);
    });
  }

  /* ── Private: format ──────────────────────────────────────────── */

  // @ts-expect-error - TODO: Fix type
  #formatAxisValue(val) {
    const abs = Math.abs(val);
    if (abs >= 1e6) return `${(val / 1e6).toFixed(1)}M`;
    if (abs >= 1e3) return `${(val / 1e3).toFixed(1)}K`;
    if (Number.isInteger(val)) return String(val);
    return val.toFixed(1);
  }

  /* ── Filter menu ─────────────────────────────────────────────────────── */

  #onToggleFilters = () => {
    this.toggleAttribute('data-filters');
  };

  #onToggleLegend = () => {
    this.toggleAttribute('data-hide-legend');
  };

  #onMenuPopulate = (e: CustomEvent) => {
    const menu = e.detail?.menu;
    if (!menu) return;
    const filterItem = menu.querySelector('sherpa-menu-item[data-event="toggle-filters"]');
    if (filterItem) {
      filterItem.toggleAttribute('checked', this.hasAttribute('data-filters'));
    }
    const legendItem = menu.querySelector('sherpa-menu-item[data-event="toggle-legend"]');
    if (legendItem) {
      legendItem.toggleAttribute('checked', !this.hasAttribute('data-hide-legend'));
    }
  };
}

customElements.define('sherpa-line-chart', SherpaLineChart);