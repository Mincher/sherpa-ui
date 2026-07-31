/**
 * @element sherpa-chart-legend
 * @category media
 * @description Standalone colour-coded legend component, decoupled from any chart. Use when
 *   the legend must render separately from the chart (different grid column, below the chart
 *   in a stacked layout). Call populate() with the same series data used to render the chart.
 *   Make items interactive (link: true) to enable filter/highlight behaviour driven by
 *   legend-item-click events.
 *
 * @attr {enum}    data-orientation — horizontal | vertical (default: horizontal)
 * @attr {boolean} data-loading     — Show loading state
 *
 * @fires legend-item-click
 *   bubbles: true, composed: true
 *   detail: { index: number, label: string }
 *
 * @data {array} [{ label, value?, color?, active?, link? }] — Legend items to render
 * @method populate(items) — Canonical data entry: [{ label, value?, color?, active?, link? }]
 * @method setItems(items) — Deprecated alias for populate()
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

  public els = this.cacheElements({
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
  /**
   * Render the legend items. Dispatched from the unified `populate()` —
   * call `el.populate([{ label, value?, color?, active?, link? }])`.
   */
  protected override renderData(source: unknown): void {
    this.#items = Array.isArray(source) ? (source as LegendItem[]) : [];
    this.#render();
  }

  /** @deprecated Use {@link populate} — retained for back-compat. */
  setItems(items: LegendItem[]): void {
    this.populate(items);
  }

  /** Get current items. */
  get items(): LegendItem[] {
    return [...this.#items];
  }

  /* ── Private: render ──────────────────────────────────────────── */

  #render(): void {
    if (!this.els.list || !this.els.itemTpl) return;

    this.els.list.replaceChildren();

    this.#items.forEach((item, i) => {
      const color = item.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length];
      const hasValue = item.value != null && item.value !== '';
      // Bind label/value/flags/swatch via the Sherpa template binder.
      const frag = this.renderFragment('.item-tpl', {
        label: item.label || '',
        value: hasValue ? String(item.value) : '',
        hasValue: hasValue ? true : null,
        inactive: item.active === false ? true : null,
        link: item.link ? true : null,
        swatchStyle: color ? `background-color: ${color}` : null,
      });
      const el = frag.firstElementChild;
      if (item.link && el instanceof HTMLElement) {
        el.addEventListener('click', () => {
          this.emit('legend-item-click', { index: i, label: item.label });
        });
      }
      this.els.list?.appendChild(frag);
    });
  }
}

customElements.define('sherpa-chart-legend', SherpaChartLegend);
