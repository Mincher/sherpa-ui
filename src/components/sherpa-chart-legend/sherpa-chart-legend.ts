/**
 * sherpa-chart-legend — the colour key beside a chart.
 *
 * Give it a list with populate([{ label, value?, colorIndex }]) and it draws one
 * entry per item in a three-column grid (swatch · category · value), matching the
 * rebuilt Figma component. JS tells each entry which colour to use; CSS draws the
 * swatch and the grid.
 *
 * Clicking an entry toggles it and fires legend-item-click. The legend does not
 * know what it labels, so the PAGE joins them up — it listens for that event and
 * calls the chart's setSeriesHidden / setSliceHidden.
 * @fires legend-item-click — a legend entry is clicked. bubbles + composed. detail: { index: number, label: string, active: boolean }
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
      // The prototype's root IS the button now (it was an <li> wrapping one), so
      // the clone is the whole entry.
      const entry = tpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
      entry.dataset['index'] = String(i);
      // Categorical hue by 1-based index (wraps at 11).
      const n = ((item.colorIndex ?? i + 1) - 1) % 11 + 1;
      entry.querySelector<HTMLElement>('.swatch')!.style.setProperty(
        '--_hue',
        `var(--sherpa-data-viz-series-${n})`,
      );
      entry.querySelector('.label')!.textContent = item.label;
      entry.querySelector('.value')!.textContent = item.value != null ? String(item.value) : '';
      list.appendChild(entry);
    });
  }

  #onClick = (event: Event): void => {
    const item = (event.target as HTMLElement).closest<HTMLElement>('.item');
    const raw = item?.dataset['index'];
    if (raw == null || !item) return;
    // aria-pressed is BOTH the accessible state and the CSS hook for the dimmed
    // look — one source of truth, so they cannot disagree. (It replaced a
    // data-current attribute that duplicated it.)
    const active = item.getAttribute('aria-pressed') !== 'true';
    item.setAttribute('aria-pressed', String(active));
    this.emit('legend-item-click', {
      index: Number(raw),
      label: this.#items[Number(raw)]?.label ?? '',
      active,
    });
  };
}

customElements.define('sherpa-chart-legend', SherpaChartLegend);
