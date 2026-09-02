/**
 * sherpa-gauge-chart — a half-circle gauge for one value from 0 to 100.
 *
 * From data-value, JS works out how full the gauge is and which way the needle
 * points, then hands those two numbers to CSS. CSS draws the coloured arc and
 * turns the needle. The big number in the middle and the scale labels are text.
 */
import { SherpaElement } from '../../core/sherpa-element.js';

export class SherpaGaugeChart extends SherpaElement {
  static override css = new URL('./sherpa-gauge-chart.css', import.meta.url);
  static override html = new URL('./sherpa-gauge-chart.html', import.meta.url);
  static override observed = ['data-value', 'data-label', 'data-min', 'data-max'];

  override onRender(): void {
    this.#sync();
  }

  override onChange(): void {
    this.#sync();
  }

  /** populate(number) — set the value. */
  protected override renderData(data: unknown): void {
    if (typeof data === 'number') this.dataset['value'] = String(data);
  }

  get value(): number {
    return Number(this.dataset['value'] ?? 0);
  }
  set value(v: number) {
    this.dataset['value'] = String(v);
  }

  #sync(): void {
    const min = Number(this.dataset['min'] ?? 0);
    const max = Number(this.dataset['max'] ?? 100);
    const raw = Number(this.dataset['value'] ?? 0);
    const frac = max > min ? Math.min(1, Math.max(0, (raw - min) / (max - min))) : 0;

    // Fill: 0–50% of the circle covers the visible top half.
    this.style.setProperty('--_fill-pct', `${frac * 50}%`);
    // Needle: -90deg (left) → +90deg (right) across the half.
    this.style.setProperty('--_angle', `${-90 + frac * 180}deg`);

    const value = this.$('.value');
    if (value) value.textContent = this.dataset['label'] ?? String(raw);
    const minEl = this.$('.min');
    if (minEl) minEl.textContent = String(min);
    const maxEl = this.$('.max');
    if (maxEl) maxEl.textContent = String(max);
  }
}

customElements.define('sherpa-gauge-chart', SherpaGaugeChart);
