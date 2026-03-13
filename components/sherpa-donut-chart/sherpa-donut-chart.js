/**
 * sherpa-donut-chart.js
 * SherpaDonutChart — Donut / pie chart using CSS conic-gradient.
 *
 * Supports both direct data and declarative query loading via
 * ContentAttributesMixin (data-query-src + data-query-key).
 *
 * Usage (declarative):
 *   <sherpa-donut-chart
 *     data-query-src="/data/queries/overview.json"
 *     data-query-key="detections-by-severity">
 *   </sherpa-donut-chart>
 *
 * Usage (programmatic):
 *   chart.setData([
 *     { label: 'Apples',  value: 40 },
 *     { label: 'Oranges', value: 30 },
 *   ]);
 *
 * Attributes:
 *   data-title          — Chart heading text
 *   data-inner-label    — Centre big text
 *   data-inner-sublabel — Centre small text
 *   data-loading        — Boolean
 *   data-variant        — donut | pie
 *   + all ContentAttributesMixin attributes
 *
 * Methods:
 *   setData(config | Array<{label, value, color?}>)
 */

import {
  ContentAttributesMixin,
  CONTENT_ATTRIBUTES,
} from '../utilities/content-attributes-mixin.js';
import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';
import { formatCompact, formatFieldName } from '../utilities/index.js';
import '../sherpa-button/sherpa-button.js';
import '../sherpa-filter-bar/sherpa-filter-bar.js';

/** Default palette — falls back to CSS token values, but also needed for
 *  inline conic-gradient stops where tokens can't be used directly. */
const DEFAULT_COLORS = [
  '#7b1ce6', // purple
  '#16abe2', // blue
  '#2bd1c1', // teal
  '#ffaa00', // amber
  '#f3699d', // pink
  '#c046ff', // violet
];

export class SherpaDonutChart extends ContentAttributesMixin(SherpaElement) {

  /* ── Config ───────────────────────────────────────────────────── */

  static get cssUrl()  { return new URL('./sherpa-donut-chart.css', import.meta.url).href; }
  static get htmlUrl() { return new URL('./sherpa-donut-chart.html', import.meta.url).href; }

  static get observedAttributes() {
    return [
      ...super.observedAttributes,
      'data-title',
      'data-inner-label',
      'data-inner-sublabel',
      'data-loading',
      'data-variant',
      'data-segment-field',
      'data-segment-mode',
      'data-sort-field',
      'data-sort-direction',
    ];
  }

  /* ── State ────────────────────────────────────────────────────── */

  #data = [];
  #contentData = null;
  #titleEl;
  #ringEl;
  #centreValueEl;
  #centreSublabelEl;
  #legendEl;
  #filterMenuTpl = null;

  /* ── Lifecycle ────────────────────────────────────────────────── */

  onRender() {
    if (!this.hasAttribute('data-viz')) this.setAttribute('data-viz', '');
    if (!this.hasAttribute('data-filters')) this.toggleAttribute('data-filters', true);

    this.#titleEl          = this.$('.chart-title');
    this.#ringEl           = this.$('.donut-ring');
    this.#centreValueEl    = this.$('.centre-value');
    this.#centreSublabelEl = this.$('.centre-sublabel');
    this.#legendEl         = this.$('.chart-legend');

    this.#syncTitle();
    this.#syncCentreLabel();
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
    super.onAttributeChanged(name, oldValue, newValue);
    switch (name) {
      case 'data-title':          this.#syncTitle(); break;
      case 'data-inner-label':
      case 'data-inner-sublabel': this.#syncCentreLabel(); break;
      case 'data-segment-field':
      case 'data-segment-mode':
        this.#syncTitle();
        if (this._suppressAttrReaction) break;
        // External attribute change — full re-aggregate needed
        if (this.#contentData) this.reAggregate();
        break;
      case 'data-sort-field':
      case 'data-sort-direction':
        if (this._suppressAttrReaction) break;
        // Local re-sort of existing data
        if (this.#contentData) {
          this.#transformContentData();
          this.#render();
        }
        break;
    }
  }

  /* ── Public API ───────────────────────────────────────────────── */

  /**
   * Set chart data and render.
   * Accepts either:
   *   - A content config object (from ContentAttributesMixin.load())
   *   - A direct array of { label, value, color? }
   */
  async setData(data) {
    await this.rendered;

    // Direct array — original programmatic API
    if (Array.isArray(data)) {
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
      console.error('SherpaDonutChart data error:', e);
      this.#contentData = null;
      this.#data = [];
    }
    this.#render();
  }

  /** Get current data. */
  get data() {
    return [...this.#data];
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
    if (!activeSort || !data.length) return data;

    const sorted = [...data];
    const dir = activeSort.dir || 'asc';

    // Sort slices by numerical value
    sorted.sort((a, b) => {
      const diff = (Number(a.value) || 0) - (Number(b.value) || 0);
      return dir === 'desc' ? -diff : diff;
    });

    return sorted;
  }

  /**
   * Transform unified { columns, rows } into [{ label, value }] for donut.
   * Uses the category column as label. When a series column is present,
   * aggregate the value column by the category to produce one slice per
   * category value.
   *
   * When data-segment-field is active, re-aggregates by the segment field
   * so each unique segment value becomes one donut slice.
   */
  #transformContentData() {
    if (!this.#contentData) { this.#data = []; return; }

    const { columns = [], rows = [], name = '' } = this.#contentData;
    if (!rows.length || columns.length < 2) { this.#data = []; return; }

    // First column = category (label), last column = value (numeric measure)
    const labelField = columns[0]?.field;
    const valueField = columns[columns.length - 1]?.field;
    if (!labelField || !valueField) { this.#data = []; return; }

    // Segment-driven aggregation: slices = unique segment values
    const segmentField = this.#getSegmentField();
    if (segmentField && this.#isSegmentEnabled() && segmentField !== labelField) {
      const agg = new Map();
      for (const row of rows) {
        const key = String(row[segmentField] ?? '');
        agg.set(key, (agg.get(key) || 0) + (Number(row[valueField]) || 0));
      }
      this.#data = [...agg.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([label, value]) => ({ label, value }));
    } else if (columns.length > 2) {
      // If there's a series column (3+ columns), aggregate value by category
      const agg = new Map();
      for (const row of rows) {
        const key = String(row[labelField] ?? '');
        agg.set(key, (agg.get(key) || 0) + (Number(row[valueField]) || 0));
      }
      this.#data = [...agg.entries()].map(([label, value]) => ({ label, value }));
    } else {
      this.#data = rows.map(row => ({
        label: String(row[labelField] ?? ''),
        value: Number(row[valueField]) || 0,
      }));
    }

    // Apply local sort
    this.#data = this.#applyLocalSort(this.#data);

    // Auto-set centre label to total + sublabel to chart name
    const total = this.#data.reduce((s, d) => s + d.value, 0);
    this.dataset.innerLabel = formatCompact(total);
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

  #syncCentreLabel() {
    if (this.#centreValueEl) {
      this.#centreValueEl.textContent = this.dataset.innerLabel || '';
    }
    if (this.#centreSublabelEl) {
      this.#centreSublabelEl.textContent = this.dataset.innerSublabel || '';
    }
  }

  /* ── Private: render ──────────────────────────────────────────── */

  #render() {
    if (!this.#ringEl || !this.#legendEl) return;

    const total = this.#data.reduce((sum, d) => sum + (d.value || 0), 0);
    if (!total) {
      this.#ringEl.style.setProperty('--_conic', 'conic-gradient(#e0e0e0 0% 100%)');
      this.#legendEl.replaceChildren();
      return;
    }

    // Build conic-gradient stops
    const stops = [];
    let cumulative = 0;

    this.#data.forEach((d, i) => {
      const color = d.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length];
      const pct = (d.value / total) * 100;
      const start = cumulative;
      cumulative += pct;
      stops.push(`${color} ${start}% ${cumulative}%`);
    });

    this.#ringEl.style.setProperty(
      '--_conic',
      `conic-gradient(${stops.join(', ')})`
    );

    // Build legend
    this.#legendEl.replaceChildren();

    this.#data.forEach((d, i) => {
      const color = d.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length];
      const item = document.createElement('div');
      item.className = 'legend-item';

      const key = document.createElement('span');
      key.className = 'legend-key';
      key.style.backgroundColor = color;

      const label = document.createElement('span');
      label.className = 'legend-label';
      label.textContent = d.label || '';

      const value = document.createElement('span');
      value.className = 'legend-value';
      value.textContent = d.value != null ? d.value.toLocaleString() : '';

      item.append(key, label, value);
      this.#legendEl.appendChild(item);
    });
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

customElements.define('sherpa-donut-chart', SherpaDonutChart);