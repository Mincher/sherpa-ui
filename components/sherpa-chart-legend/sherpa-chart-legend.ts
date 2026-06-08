/**
 * @element sherpa-chart-legend
 * @category media
 * @description Standalone chart legend with optional interactive link items.
 *
 * @attr {enum}    data-orientation — horizontal | vertical (default: horizontal)
 * @attr {boolean} data-loading     — Show loading state
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

/** A single legend entry. */
interface LegendItem {
  label?: string;
  value?: string | number | null;
  color?: string;
  active?: boolean;
  link?: boolean;
}

const DEFAULT_COLORS = [
  '#7b1ce6', '#16abe2', '#2bd1c1',
  '#ffaa00', '#f3699d', '#c046ff',
];

export class SherpaChartLegend extends SherpaElement {

  /* ── Config ───────────────────────────────────────────────────── */

  static override get cssUrl(): string  { return new URL('./sherpa-chart-legend.css', import.meta.url).href; }
  static override get htmlUrl(): string { return new URL('./sherpa-chart-legend.html', import.meta.url).href; }

  static override get observedAttributes(): string[] {
    return [
      ...super.observedAttributes,
      'data-orientation',
      'data-loading',
    ];
  }

  /* ── State ────────────────────────────────────────────────────── */

  #items: LegendItem[] = [];

  els = this.cacheElements({
    list: '.legend-list',
    itemTpl: { selector: 'template.item-tpl', type: HTMLTemplateElement }
  });

  /* ── Lifecycle ────────────────────────────────────────────────── */

  override onRender(): void {
    if (this.#items.length) this.#render();
  }

  /* ── Public API ───────────────────────────────────────────────── */

  /**
   * Set legend items.
   * @param {Array<{label: string, value?: string, color?: string, active?: boolean, link?: boolean}>} items
   */
  setItems(items: LegendItem[]) {
    this.#items = items || [];
    this.#render();
  }

  /** Get current items. */
  get items() {
    return [...this.#items];
  }

  /* ── Private: render ──────────────────────────────────────────── */

  #render() {
    if (!this.els.list || !this.els.itemTpl) return;

    this.els.list.replaceChildren();

    this.#items.forEach((item, i) => {
      const el = this.els.itemTpl?.content.firstElementChild?.cloneNode(true);
      if (!(el instanceof HTMLElement)) return;
      const color = item.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length];

      // Key swatch
      const key = el.querySelector<HTMLElement>('.legend-key');
      if (key) key.style.backgroundColor = color || '';

      // Label
      const label = el.querySelector('.legend-label');
      if (label) label.textContent = item.label || '';

      // Value (optional)
      if (item.value != null && item.value !== '') {
        el.toggleAttribute('data-has-value', true);
        const valueEl = el.querySelector('.legend-value');
        if (valueEl) valueEl.textContent = String(item.value);
      }

      // Active state (default true)
      if (item.active === false) {
        el.toggleAttribute('data-inactive', true);
      }

      // Link state
      if (item.link) {
        el.toggleAttribute('data-link', true);
        el.addEventListener('click', () => {
          this.emit('legend-item-click', { index: i, label: item.label });
        });
      }

      this.els.list?.appendChild(el);
    });
  }
}

customElements.define('sherpa-chart-legend', SherpaChartLegend);
