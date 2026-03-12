/**
 * sherpa-line-chart.js
 * SherpaLineChart — Line / area chart using CSS clip-path polygons.
 *
 * Supports both direct data and declarative query loading via
 * ContentAttributesMixin (data-query-src + data-query-key).
 *
 * Usage (declarative):
 *   <sherpa-line-chart
 *     data-query-src="/data/queries/overview.json"
 *     data-query-key="detections-over-time"
 *     data-variant="area">
 *   </sherpa-line-chart>
 *
 * Usage (programmatic):
 *   chart.setData({
 *     labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
 *     series: [
 *       { name: 'Revenue', values: [30, 50, 40, 60, 45, 70] },
 *       { name: 'Cost',    values: [20, 30, 25, 40, 35, 50] },
 *     ]
 *   });
 *
 * Attributes:
 *   data-title    — Chart heading text
 *   data-loading  — Boolean
 *   data-variant  — line | area
 *   + all ContentAttributesMixin attributes
 *
 * Methods:
 *   setData(config | { labels, series })
 */

import {
  ContentAttributesMixin,
  CONTENT_ATTRIBUTES,
} from '../utilities/content-attributes-mixin.js';
import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';
import '../sherpa-button/sherpa-button.js';
import '../sherpa-filter-bar/sherpa-filter-bar.js';
import { formatFieldName } from '../utilities/format-utils.js';

const DEFAULT_COLORS = [
  '#7b1ce6', // purple
  '#16abe2', // blue
  '#2bd1c1', // teal
  '#ffaa00', // amber
  '#f3699d', // pink
  '#c046ff', // violet
];

/** Stroke half-width as % of chart area height (≈ 1px at 234px). */
const STROKE_HALF = 0.45;

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
  #seriesLayer;
  #pointsLayer;
  #xAxis;
  #legendEl;
  #seriesTpl;
  #pointTpl;
  #filterMenuTpl = null;

  /* ── Lifecycle ────────────────────────────────────────────────── */

  onRender() {
    if (!this.hasAttribute('data-viz')) this.setAttribute('data-viz', '');
    if (!this.hasAttribute('data-filters')) this.toggleAttribute('data-filters', true);

    this.#titleEl     = this.$('.chart-title');
    this.#yLabels     = this.$$('.y-label');
    this.#seriesLayer = this.$('.series-layer');
    this.#pointsLayer = this.$('.points-layer');
    this.#xAxis       = this.$('.x-axis');
    this.#legendEl    = this.$('.chart-legend');

    // Cloning prototypes live inside the shadow root
    const root = this.shadowRoot;
    this.#seriesTpl = root.querySelector('template.series-tpl');
    this.#pointTpl  = root.querySelector('template.point-tpl');

    this.#syncTitle();
    if (this.#data) this.#render();
  }

  onConnect() {
    super.onConnect();
    this.#injectFilterMenu();
    this.addEventListener('toggle-filters', this.#onToggleFilters);
    this.addEventListener('toggle-legend', this.#onToggleLegend);
    this.addEventListener('menu-populate', this.#onMenuPopulate);
  }

  onDisconnect() {
    super.onDisconnect();
    this.removeEventListener('toggle-filters', this.#onToggleFilters);
    this.removeEventListener('toggle-legend', this.#onToggleLegend);
    this.removeEventListener('menu-populate', this.#onMenuPopulate);
    this.#filterMenuTpl?.remove();
    this.#filterMenuTpl = null;
  }

  onAttributeChanged(name, oldValue, newValue) {
    if (oldValue === newValue) return;
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

  /* ── Segment helpers ───────────────────────────────────────── */

  #getSegmentField() {
    return this.getAttribute('data-segment-field') || null;
  }

  #isSegmentEnabled() {
    const mode = this.getAttribute('data-segment-mode');
    const field = this.#getSegmentField();
    return mode !== 'off' && !!field;
  }

  /* ── Sort helpers ──────────────────────────────────────────── */

  #getActiveSort() {
    const dir = this.getAttribute('data-sort-direction') || null;
    if (!dir || dir === 'off') return null;
    return { dir };
  }

  #applyLocalSort(data) {
    const activeSort = this.#getActiveSort();
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

    const labelField = columns[0]?.field;
    const valueField = columns[columns.length > 2 ? 2 : 1]?.field;

    // Segment field overrides the implicit series column when active
    const segmentField = this.#isSegmentEnabled()
      ? this.#getSegmentField()
      : (columns.length > 2 ? columns[1]?.field : null);

    if (!labelField || !valueField) { this.#data = null; return; }

    if (segmentField && segmentField !== labelField && segmentField !== valueField) {
      // Multi-series: group by segment/series field
      const seriesNames = [...new Set(rows.map(r => String(r[segmentField] ?? '')))].sort();
      const labels = [...new Set(rows.map(r => String(r[labelField] ?? '')))];

      const series = seriesNames.map(name => {
        const values = labels.map(label => {
          const matching = rows.filter(r =>
            String(r[segmentField]) === name && String(r[labelField]) === label
          );
          return matching.reduce((sum, r) => sum + (Number(r[valueField]) || 0), 0);
        });
        return { name, values };
      });

      this.#data = { labels, series };
    } else {
      // Single series
      const labels = rows.map(r => String(r[labelField] ?? ''));
      const values = rows.map(r => Number(r[valueField]) || 0);
      const name = columns[1]?.name || columns[1]?.field || 'Value';
      this.#data = { labels, series: [{ name, values }] };
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

  /* ── Private: sync ────────────────────────────────────────────── */

  #syncTitle() {
    if (this.#titleEl) {
      const base = this.dataset.title || '';
      const segField = this.#isSegmentEnabled() ? this.#getSegmentField() : null;
      this.#titleEl.textContent = segField
        ? `${base} by ${formatFieldName(segField)}`
        : base;
    }
  }

  /* ── Private: render ──────────────────────────────────────────── */

  #render() {
    if (!this.#seriesLayer || !this.#pointsLayer || !this.#data) return;

    const { labels = [], series = [] } = this.#data;
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
      const span = document.createElement('span');
      span.className = 'x-label';
      span.textContent = label;
      this.#xAxis.appendChild(span);
    }

    // ── Series + points ─────────────────────────────────────────
    this.#seriesLayer.replaceChildren();
    this.#pointsLayer.replaceChildren();

    series.forEach((s, si) => {
      const color = s.color || DEFAULT_COLORS[si % DEFAULT_COLORS.length];

      // Compute normalised positions
      const coords = s.values.map((v, i) => {
        const x = pointCount === 1 ? 50 : (i / (pointCount - 1)) * 100;
        const y = ((v - yMin) / (yMax - yMin)) * 100;
        return { x, y };
      });

      // ── Build stroke polygon ──────────────────────────────────
      // Forward pass (top edge) + reverse pass (bottom edge)
      const fwd = coords.map(c => `${c.x}% ${100 - c.y - STROKE_HALF}%`);
      const rev = [...coords].reverse().map(c => `${c.x}% ${100 - c.y + STROKE_HALF}%`);
      const strokePath = `polygon(${[...fwd, ...rev].join(', ')})`;

      // ── Build area polygon ────────────────────────────────────
      const areaTop = coords.map(c => `${c.x}% ${100 - c.y}%`);
      const areaPath = `polygon(${[...areaTop, '100% 100%', '0% 100%'].join(', ')})`;

      // Clone series
      if (this.#seriesTpl) {
        const seriesEl = this.#seriesTpl.content.firstElementChild.cloneNode(true);
        seriesEl.style.setProperty('--_series-color', color);
        seriesEl.style.setProperty('--_stroke-path', strokePath);
        seriesEl.style.setProperty('--_area-path', areaPath);
        this.#seriesLayer.appendChild(seriesEl);
      }

      // Clone point dots
      if (this.#pointTpl) {
        coords.forEach((c, pi) => {
          const dot = this.#pointTpl.content.firstElementChild.cloneNode(true);
          dot.style.setProperty('--_px', `${c.x}%`);
          dot.style.setProperty('--_py', `${c.y}%`);
          dot.style.setProperty('--_point-color', color);
          dot.title = `${s.name}: ${s.values[pi]}`;
          this.#pointsLayer.appendChild(dot);
        });
      }
    });

    // ── Legend ───────────────────────────────────────────────────
    this.#legendEl.replaceChildren();
    series.forEach((s, si) => {
      const color = s.color || DEFAULT_COLORS[si % DEFAULT_COLORS.length];
      const item = document.createElement('div');
      item.className = 'legend-item';

      const key = document.createElement('span');
      key.className = 'legend-key';
      key.style.backgroundColor = color;

      const label = document.createElement('span');
      label.className = 'legend-label';
      label.textContent = s.name || '';

      item.append(key, label);
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

  #injectFilterMenu() {
    if (this.#filterMenuTpl) return;
    const src = this.$('#filter-menu');
    if (!src) return;
    const tpl = document.createElement('template');
    tpl.setAttribute('data-menu', '');
    tpl.content.appendChild(src.content.cloneNode(true));
    this.#filterMenuTpl = tpl;
    this.append(tpl);
  }

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
