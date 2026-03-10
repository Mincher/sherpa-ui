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
 * Events (bubbles: true, composed: true):
 *   vizready — Dispatched after setData() completes. detail: { columns, rows }
 *
 * Methods:
 *   setData(config | Array<{label, value, color?}>)
 */

import {
  ContentAttributesMixin,
  CONTENT_ATTRIBUTES,
} from '../utilities/content-attributes-mixin.js';
import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';
import { formatCompact } from '../utilities/index.js';

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

  /* ── Lifecycle ────────────────────────────────────────────────── */

  onRender() {
    if (!this.hasAttribute('data-viz')) this.setAttribute('data-viz', '');

    this.#titleEl          = this.$('.chart-title');
    this.#ringEl           = this.$('.donut-ring');
    this.#centreValueEl    = this.$('.centre-value');
    this.#centreSublabelEl = this.$('.centre-sublabel');
    this.#legendEl         = this.$('.chart-legend');

    this.#syncTitle();
    this.#syncCentreLabel();
  }

  onAttributeChanged(name) {
    switch (name) {
      case 'data-title':          this.#syncTitle(); break;
      case 'data-inner-label':
      case 'data-inner-sublabel': this.#syncCentreLabel(); break;
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

    // Content config from ContentAttributesMixin
    try {
      this.#contentData = await this.fetchContentData(data);
      this.#transformContentData();
    } catch (e) {
      console.error('SherpaDonutChart data error:', e);
      this.#contentData = null;
      this.#data = [];
    }
    this.#render();
    this.dispatchVizReady();
  }

  /** Get current data. */
  get data() {
    return [...this.#data];
  }

  getContentColumns() {
    return this.#contentData?.columns || [];
  }

  getContentRows() {
    return this.#contentData?.rows || [];
  }

  /* ── Private: transform ───────────────────────────────────────── */

  /**
   * Transform unified { columns, rows } into [{ label, value }] for donut.
   * Uses the category column as label. When a series column is present,
   * aggregate the value column by the category to produce one slice per
   * category value.
   */
  #transformContentData() {
    if (!this.#contentData) { this.#data = []; return; }

    const { columns = [], rows = [], name = '' } = this.#contentData;
    if (!rows.length || columns.length < 2) { this.#data = []; return; }

    // First column = category (label), last column = value (numeric measure)
    const labelField = columns[0]?.field;
    const valueField = columns[columns.length - 1]?.field;
    if (!labelField || !valueField) { this.#data = []; return; }

    // If there's a series column (3+ columns), aggregate value by category
    if (columns.length > 2) {
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

    // Auto-set centre label to total + sublabel to chart name
    const total = this.#data.reduce((s, d) => s + d.value, 0);
    if (!this.hasAttribute('data-inner-label')) {
      this.dataset.innerLabel = formatCompact(total);
    }
    if (!this.hasAttribute('data-inner-sublabel') && name) {
      this.dataset.innerSublabel = name;
    }
  }

  /* ── Private: sync ────────────────────────────────────────────── */

  #syncTitle() {
    if (this.#titleEl) {
      this.#titleEl.textContent = this.dataset.title || '';
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
}

customElements.define('sherpa-donut-chart', SherpaDonutChart);
