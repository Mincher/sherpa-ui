/**
 * @element sherpa-line-chart
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
  CONTENT_ATTRIBUTES,
} from '../utilities/content-attributes-mixin.js';
import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';
import { getSegmentField, isSegmentEnabled, getActiveSort } from '../utilities/chart-utils.js';
import { injectFilterMenu, removeFilterMenu } from '../utilities/filter-menu-utils.js';
import '../sherpa-button/sherpa-button.js';
import '../sherpa-filter-bar/sherpa-filter-bar.js';
import { formatFieldName } from '../utilities/format-utils.js';

const MAX_SEGMENTS = 8;
const OTHER_COLOR = '#9e9ea8';
const MAX_SHAPE_SLOTS = 12;
const MAX_POINT_SLOTS = MAX_SHAPE_SLOTS + 1;

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

  static get cssUrl()  { return new URL('./sherpa-line-chart.css', import.meta.url).href; }
  static get htmlUrl() { return new URL('./sherpa-line-chart.html', import.meta.url).href; }

  static get observedAttributes() {
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
  #titleEl;
  #yLabels;
  #chartArea;
  #seriesLayer;
  #xAxis;
  #legendEl;
  #seriesTpl;
  #legendItemTpl;
  #xLabelTpl;
  #filterMenuTpl = null;

  /* ── Lifecycle ────────────────────────────────────────────────── */

  onRender() {
    if (!this.hasAttribute('data-viz')) this.setAttribute('data-viz', '');
    if (!this.hasAttribute('data-filters')) this.toggleAttribute('data-filters', true);

    this.#titleEl     = this.$('.chart-title');
    this.#yLabels     = this.$$('.y-label');
    this.#chartArea   = this.$('.chart-area');
    this.#seriesLayer = this.$('.series-layer');
    this.#xAxis       = this.$('.x-axis');
    this.#legendEl    = this.$('.chart-legend');

    // Cloning prototypes live inside the shadow root
    const root = this.shadowRoot;
    this.#seriesTpl = root.querySelector('template.series-tpl');
    this.#legendItemTpl = root.querySelector('template.legend-item-tpl');
    this.#xLabelTpl = root.querySelector('template.x-label-tpl');

    this.#syncTitle();
    if (this.#data) this.#render();
  }

  onConnect() {
    super.onConnect();
    this.#filterMenuTpl = injectFilterMenu(this);
    this.addEventListener('toggle-filters', this.#onToggleFilters);
    this.addEventListener('toggle-legend', this.#onToggleLegend);
    this.addEventListener('menu-populate', this.#onMenuPopulate);
  }

  onDisconnect() {
    super.onDisconnect();
    this.removeEventListener('toggle-filters', this.#onToggleFilters);
    this.removeEventListener('toggle-legend', this.#onToggleLegend);
    this.removeEventListener('menu-populate', this.#onMenuPopulate);
    removeFilterMenu(this.#filterMenuTpl);
    this.#filterMenuTpl = null;
  }

  onAttributeChanged(name, oldValue, newValue) {
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
    try {
      this.#contentData = await this.fetchContentData(data);

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
    } catch (e) {
      console.error('SherpaLineChart data error:', e);
      this.#contentData = null;
      this.#data = null;
    }
    this.#render();
  }

  /* ── Private: transform ───────────────────────────────────────── */

  /* ── Sort helpers ──────────────────────────────────────────── */

  #applyLocalSort(data) {
    const activeSort = getActiveSort(this);
    if (!activeSort || !data) return data;

    const labels = [...data.labels];
    const series = data.series.map(s => ({ ...s, values: [...s.values] }));
    if (!labels.length || !series.length) return data;

    const indices = labels.map((_, i) => i);
    const dir = activeSort.dir || 'asc';

    // Sort by time — parse labels as dates
    indices.sort((a, b) => {
      const tA = new Date(labels[a]).getTime() || 0;
      const tB = new Date(labels[b]).getTime() || 0;
      const diff = tA - tB;
      return dir === 'desc' ? -diff : diff;
    });

    return {
      labels: indices.map(i => labels[i]),
      series: series.map(s => ({
        ...s,
        values: indices.map(i => s.values[i]),
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
        ? columns.find(c => c.field !== labelField && c.field !== valueField)?.field
        : null);

    if (effectiveSegmentField && effectiveSegmentField !== labelField && effectiveSegmentField !== valueField) {
      // Multi-series: one line per unique segment/group value
      const seriesNames = [...new Set(rows.map(r => String(r[effectiveSegmentField] ?? '')))].sort();
      const labels = [...new Set(rows.map(r => String(r[labelField] ?? '')))];

      const series = seriesNames.map(name => {
        const values = labels.map(label => {
          const matching = rows.filter(r =>
            String(r[effectiveSegmentField]) === name && String(r[labelField]) === label
          );
          return matching.reduce((sum, r) => sum + (Number(r[valueField]) || 0), 0);
        });
        return { name, values };
      });

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
      const valueName = columns.find(c => c.field === valueField)?.name || valueField || 'Value';
      this.#data = {
        labels: labelOrder,
        series: [{ name: valueName, values: labelOrder.map(l => agg.get(l)) }],
      };
    }

    // Apply local sort
    this.#data = this.#applyLocalSort(this.#data);

    // Limit to last 12 data points (mirrors sparkline max)
    if (this.#data && this.#data.labels.length > 12) {
      this.#data = {
        labels: this.#data.labels.slice(-12),
        series: this.#data.series.map(s => ({
          ...s,
          values: s.values.slice(-12),
        })),
      };
    }
  }

  /* ── Private: field resolution ────────────────────────────────── */

  #resolveLabelField(columns, segmentField) {
    const meta = this.#contentData?.metadata || {};
    if (meta.primaryField && columns.some(c => c.field === meta.primaryField)) {
      return meta.primaryField;
    }
    // Prefer a datetime or string column that isn't the segment field
    const fallback = columns.find(c => {
      const type = (c.type || '').toLowerCase();
      return (type === 'datetime' || type === 'string') && c.field !== segmentField;
    });
    return fallback?.field || columns[0]?.field || null;
  }

  #resolveValueField(columns, labelField, segmentField) {
    const numericCols = columns.filter(c => {
      const type = (c.type || '').toLowerCase();
      return ['number', 'numeric', 'currency', 'percent'].includes(type);
    });
    const preferred = numericCols.find(c => c.field !== labelField && c.field !== segmentField);
    if (preferred) return preferred.field;
    const fallback = numericCols.find(c => c.field !== segmentField) || numericCols[0];
    return fallback?.field || columns[columns.length - 1]?.field || null;
  }

  /* ── Private: sync ────────────────────────────────────────────── */

  #syncTitle() {
    if (this.#titleEl) {
      const base = this.dataset.title || '';
      const segField = isSegmentEnabled(this) ? getSegmentField(this) : null;
      this.#titleEl.textContent = segField
        ? `${base} by ${formatFieldName(segField)}`
        : base;
    }
  }

  /* ── Private: cap series ──────────────────────────────────────── */

  #capSeries(series) {
    if (series.length <= MAX_SEGMENTS) return series;
    const withTotals = series.map(s => ({
      ...s,
      _total: s.values.reduce((a, b) => a + b, 0),
    }));
    withTotals.sort((a, b) => b._total - a._total);
    const kept = withTotals.slice(0, MAX_SEGMENTS - 1);
    const rest = withTotals.slice(MAX_SEGMENTS - 1);
    const otherValues = kept[0].values.map((_, i) =>
      rest.reduce((s, r) => s + (r.values[i] || 0), 0)
    );
    kept.push({ name: 'Other', values: otherValues, color: OTHER_COLOR });
    return kept.map(({ _total, ...s }) => s);
  }

  /* ── Private: render ──────────────────────────────────────────── */

  #render() {
    if (!this.#seriesLayer || !this.#data) return;

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
    let yMax = globalMax + range * 0.05;
    if (yMin > 0 && yMin < range * 0.3) yMin = 0;

    // Set range on host — CSS normalises values from these
    this.style.setProperty('--_min', yMin);
    this.style.setProperty('--_range', yMax - yMin || 1);

    // ── Y-axis labels (top → bottom = max → min) ────────────────
    const yLabels = Array.from(this.#yLabels);
    const tickCount = yLabels.length;
    for (let i = 0; i < tickCount; i++) {
      const val = yMax - (yMax - yMin) * (i / (tickCount - 1));
      yLabels[i].textContent = this.#formatAxisValue(val);
    }

    // ── X-axis labels ───────────────────────────────────────────
    this.#xAxis.replaceChildren();
    for (const label of labels) {
      const span = this.#xLabelTpl.content.firstElementChild.cloneNode(true);
      span.textContent = label;
      this.#xAxis.appendChild(span);
    }

    // ── Series (segment-based, same approach as sparkline) ─────
    this.#seriesLayer.replaceChildren();

    // Chart area pixel dimensions for slope compensation
    const areaRect = this.#chartArea?.getBoundingClientRect();
    const chartW = areaRect?.width || 1;
    const chartH = areaRect?.height || 1;

    series.forEach((s, si) => {
      const color = s.color || DEFAULT_COLORS[si % DEFAULT_COLORS.length];
      const seriesEl = this.#seriesTpl.content.firstElementChild.cloneNode(true);
      seriesEl.style.color = color;

      // Set raw data values as CSS custom properties —
      // CSS normalises and computes clip-path polygons
      for (let i = 0; i < MAX_POINT_SLOTS; i++) {
        if (i < s.values.length) {
          seriesEl.style.setProperty(`--_v${i}`, s.values[i]);
        }
      }

      // Toggle shape visibility and set slope correction factors
      const shapes = seriesEl.querySelectorAll('.shape');
      const segmentCount = Math.max(s.values.length - 1, 0);
      const yRange = yMax - yMin || 1;
      shapes.forEach((shape, idx) => {
        shape.toggleAttribute('hidden', idx >= segmentCount);

        if (idx < segmentCount) {
          // Slope factor: hypot(dx,dy)/dx keeps perpendicular width constant
          const nStart = (s.values[idx]     - yMin) / yRange * 100;
          const nEnd   = (s.values[idx + 1] - yMin) / yRange * 100;
          const dx = chartW / segmentCount;
          const dy = Math.abs(nEnd - nStart) / 100 * chartH;
          const factor = Math.hypot(dx, dy) / dx;
          shape.style.setProperty('--_slope-factor', factor.toFixed(3));

          // Set tooltips on visible points
          if (idx === 0) {
            const startPt = shape.querySelector('.point[data-role="start"]');
            if (startPt) startPt.title = `${s.name}: ${this.#formatAxisValue(s.values[0])}`;
          }
          const endPt = shape.querySelector('.point[data-role="end"]');
          if (endPt) endPt.title = `${s.name}: ${this.#formatAxisValue(s.values[idx + 1])}`;
        }
      });

      this.#seriesLayer.appendChild(seriesEl);
    });

    // ── Legend ───────────────────────────────────────────────────
    this.#legendEl.replaceChildren();
    series.forEach((s, si) => {
      const color = s.color || DEFAULT_COLORS[si % DEFAULT_COLORS.length];
      const item = this.#legendItemTpl.content.firstElementChild.cloneNode(true);
      item.querySelector('.legend-key').style.backgroundColor = color;
      item.querySelector('.legend-label').textContent = s.name || '';
      this.#legendEl.appendChild(item);
    });
  }

  /* ── Private: format ──────────────────────────────────────────── */

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

  #onMenuPopulate = (e) => {
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
