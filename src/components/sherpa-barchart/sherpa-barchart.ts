/**
 * sherpa-barchart — a vertical bar chart for comparing categories.
 *
 * Give it data with populate([{ label, value, colorIndex? }]). JS draws one bar
 * per item and hands two numbers to CSS: the bar's height (as a percent of the
 * tallest) and its colour. CSS grows each bar up from the baseline. Clicking a
 * bar fires bar-click.
 * @fires bar-click — a bar is clicked. bubbles + composed. detail: { index: number, label: string, value: number }
 */
import { SherpaElement } from '../../core/sherpa-element.js';

export interface BarDatum {
  label: string;
  value: number;
  colorIndex?: number;
}

export class SherpaBarchart extends SherpaElement {
  static override css = new URL('./sherpa-barchart.css', import.meta.url);
  static override html = new URL('./sherpa-barchart.html', import.meta.url);
  static override observed = ['data-max'];

  #data: BarDatum[] = [];

  override onRender(): void {
    this.$('.bars')?.addEventListener('click', this.#onClick);
    if (this.#data.length) this.#render();
  }

  override onChange(): void {
    this.#render();
  }

  /** populate([{ label, value, colorIndex? }]) — the bars. */
  protected override renderData(data: unknown): void {
    this.#data = Array.isArray(data) ? (data as BarDatum[]) : [];
    this.#render();
  }

  #render(): void {
    const bars = this.$('.bars');
    const tpl = this.$<HTMLTemplateElement>('template.bar-tpl');
    if (!bars || !tpl) return;

    const explicitMax = Number(this.dataset['max']);
    const max = Number.isFinite(explicitMax) && explicitMax > 0
      ? explicitMax
      : Math.max(1, ...this.#data.map((d) => d.value));

    bars.replaceChildren();
    this.#data.forEach((d, i) => {
      const col = tpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
      col.dataset['index'] = String(i);
      const n = ((d.colorIndex ?? i + 1) - 1) % 11 + 1;
      const bar = col.querySelector<HTMLElement>('.bar')!;
      bar.style.setProperty('--_h', `${Math.max(0, Math.min(100, (d.value / max) * 100))}%`);
      bar.style.setProperty('--_hue', `var(--sherpa-data-viz-series-${n})`);
      col.querySelector('.bar-label')!.textContent = d.label;
      bars.appendChild(col);
    });
  }

  #onClick = (event: Event): void => {
    const col = (event.target as HTMLElement).closest<HTMLElement>('.bar-col');
    const raw = col?.dataset['index'];
    if (raw == null) return;
    const i = Number(raw);
    const d = this.#data[i];
    this.emit('bar-click', { index: i, label: d?.label ?? '', value: d?.value ?? 0 });
  };
}

customElements.define('sherpa-barchart', SherpaBarchart);
