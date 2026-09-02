/**
 * sherpa-chart-legend — the colour key beside a chart.
 *
 * Give it a list with populate([{ label, value?, colorIndex }]) and it draws one
 * row per item. JS tells each row which colour to use; CSS draws the swatch.
 * Clicking a row toggles it on or off and fires legend-item-click.
 */
import { SherpaElement } from '../../core/sherpa-element.js';

export interface LegendItem {
  label: string;
  value?: string | number;
  colorIndex?: number;
}

/** @tier sub-component — renders inside charts; excluded from the public catalog. */
export class SherpaChartLegend extends SherpaElement {
  static override tier = 'sub-component' as const;
  static override css = new URL('./sherpa-chart-legend.css', import.meta.url);
  static override html = new URL('./sherpa-chart-legend.html', import.meta.url);

  #items: LegendItem[] = [];

  override onRender(): void {
    this.$('.legend')?.addEventListener('click', this.#onClick);
    if (this.#items.length) this.#render();
  }

  /** populate([{ label, value?, colorIndex }]) — the legend entries. */
  protected override renderData(data: unknown): void {
    this.#items = Array.isArray(data) ? (data as LegendItem[]) : [];
    this.#render();
  }

  #render(): void {
    const list = this.$('.legend');
    const tpl = this.$<HTMLTemplateElement>('template.item-tpl');
    if (!list || !tpl) return;

    list.replaceChildren();
    this.#items.forEach((item, i) => {
      const row = tpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
      row.dataset['index'] = String(i);
      // Categorical hue by 1-based index (wraps at 11).
      const n = ((item.colorIndex ?? i + 1) - 1) % 11 + 1;
      row.querySelector<HTMLElement>('.swatch')!.style.setProperty(
        '--_hue',
        `var(--sherpa-categorical-${n})`,
      );
      row.querySelector('.label')!.textContent = item.label;
      row.querySelector('.value')!.textContent = item.value != null ? String(item.value) : '';
      list.appendChild(row);
    });
  }

  #onClick = (event: Event): void => {
    const item = (event.target as HTMLElement).closest<HTMLElement>('.item');
    const raw = item?.dataset['index'];
    if (raw == null) return;
    // Toggle current state (default current → false → true).
    item!.dataset['current'] = item!.dataset['current'] === 'false' ? 'true' : 'false';
    this.emit('legend-item-click', { index: Number(raw), label: this.#items[Number(raw)]?.label ?? '' });
  };
}

customElements.define('sherpa-chart-legend', SherpaChartLegend);
