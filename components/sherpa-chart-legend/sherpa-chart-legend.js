/**
 * @element sherpa-chart-legend
 * @description Standalone chart legend with optional interactive link items.
 *
 * @attr {enum}    [data-orientation] — horizontal | vertical (default: horizontal)
 * @attr {boolean} [data-loading]     — Show loading state
 *
 * @fires legend-item-click
 *   bubbles: true, composed: true
 *   detail: { index: number, label: string }
 *
 * @method setItems(items) — Set legend items: [{ label, value?, color?, active?, link? }]
 *
 * @prop {Array} items — Current legend items (getter-only)
 */

import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';

const DEFAULT_COLORS = [
  '#7b1ce6', '#16abe2', '#2bd1c1',
  '#ffaa00', '#f3699d', '#c046ff',
];

export class SherpaChartLegend extends SherpaElement {

  /* ── Config ───────────────────────────────────────────────────── */

  static get cssUrl()  { return new URL('./sherpa-chart-legend.css', import.meta.url).href; }
  static get htmlUrl() { return new URL('./sherpa-chart-legend.html', import.meta.url).href; }

  static get observedAttributes() {
    return [
      ...super.observedAttributes,
      'data-orientation',
      'data-loading',
    ];
  }

  /* ── State ────────────────────────────────────────────────────── */

  #items = [];
  #listEl;
  #itemTpl;

  /* ── Lifecycle ────────────────────────────────────────────────── */

  onRender() {
    this.#listEl  = this.$('.legend-list');
    this.#itemTpl = this.shadowRoot.querySelector('template.item-tpl');

    if (this.#items.length) this.#render();
  }

  /* ── Public API ───────────────────────────────────────────────── */

  /**
   * Set legend items.
   * @param {Array<{label: string, value?: string, color?: string, active?: boolean, link?: boolean}>} items
   */
  setItems(items) {
    this.#items = items || [];
    this.#render();
  }

  /** Get current items. */
  get items() {
    return [...this.#items];
  }

  /* ── Private: render ──────────────────────────────────────────── */

  #render() {
    if (!this.#listEl || !this.#itemTpl) return;

    this.#listEl.replaceChildren();

    this.#items.forEach((item, i) => {
      const el = this.#itemTpl.content.firstElementChild.cloneNode(true);
      const color = item.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length];

      // Key swatch
      const key = el.querySelector('.legend-key');
      key.style.backgroundColor = color;

      // Label
      const label = el.querySelector('.legend-label');
      label.textContent = item.label || '';

      // Value (optional)
      if (item.value != null && item.value !== '') {
        el.toggleAttribute('data-has-value', true);
        const valueEl = el.querySelector('.legend-value');
        valueEl.textContent = item.value;
      }

      // Active state (default true)
      if (item.active === false) {
        el.toggleAttribute('data-inactive', true);
      }

      // Link state
      if (item.link) {
        el.toggleAttribute('data-link', true);
        el.addEventListener('click', () => {
          this.dispatchEvent(new CustomEvent('legend-item-click', {
            bubbles: true,
            composed: true,
            detail: { index: i, label: item.label },
          }));
        });
      }

      this.#listEl.appendChild(el);
    });
  }
}

customElements.define('sherpa-chart-legend', SherpaChartLegend);
