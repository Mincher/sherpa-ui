/**
 * sherpa-donut-chart.js
 * SherpaDonutChart — Donut / pie chart using CSS conic-gradient.
 *
 * Usage:
 *   <sherpa-donut-chart data-title="Sales"
 *     data-inner-label="100" data-inner-sublabel="TOTAL">
 *   </sherpa-donut-chart>
 *
 *   // Then in JS:
 *   chart.setData([
 *     { label: 'Apples',  value: 40 },
 *     { label: 'Oranges', value: 30 },
 *     { label: 'Bananas', value: 20 },
 *     { label: 'Grapes',  value: 10 },
 *   ]);
 *
 * Attributes:
 *   data-title          — Chart heading text
 *   data-inner-label    — Centre big text
 *   data-inner-sublabel — Centre small text
 *   data-loading        — Boolean
 *   data-variant        — donut | pie
 *
 * Methods:
 *   setData([{ label, value, color? }])
 */

import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';

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

export class SherpaDonutChart extends SherpaElement {

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
  #titleEl;
  #ringEl;
  #centreValueEl;
  #centreSublabelEl;
  #legendEl;

  /* ── Lifecycle ────────────────────────────────────────────────── */

  onRender() {
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
   * @param {Array<{label: string, value: number, color?: string}>} data
   */
  setData(data) {
    this.#data = data || [];
    this.#render();
  }

  /** Get current data. */
  get data() {
    return [...this.#data];
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
