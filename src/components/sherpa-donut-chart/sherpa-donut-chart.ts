/**
 * sherpa-donut-chart — a donut (or pie) showing parts of a whole.
 *
 * Give it data with populate([{ label, value, colorIndex? }]). JS works out how
 * big each slice's share of the circle is and builds the ring of colours; CSS
 * draws that ring and cuts out the hole in the middle.
 */
import { SherpaElement } from '../../core/sherpa-element.js';

export interface DonutSlice {
  label: string;
  value: number;
  colorIndex?: number;
}

export class SherpaDonutChart extends SherpaElement {
  static override css = new URL('./sherpa-donut-chart.css', import.meta.url);
  static override html = new URL('./sherpa-donut-chart.html', import.meta.url);
  static override observed = ['data-label', 'data-sublabel'];

  #slices: DonutSlice[] = [];

  override onRender(): void {
    this.#syncCentre();
    if (this.#slices.length) this.#renderRing();
  }

  override onChange(): void {
    this.#syncCentre();
  }

  /** populate([{ label, value, colorIndex? }]) — the slices. */
  protected override renderData(data: unknown): void {
    this.#slices = Array.isArray(data) ? (data as DonutSlice[]) : [];
    this.#renderRing();
  }

  get slices(): DonutSlice[] {
    return [...this.#slices];
  }

  #renderRing(): void {
    const total = this.#slices.reduce((sum, s) => sum + Math.max(0, s.value), 0);
    if (total <= 0) {
      this.style.setProperty('--_ring', 'conic-gradient(var(--sherpa-style-border-base, #d5d5d5) 0 100%)');
      return;
    }
    const stops: string[] = [];
    let acc = 0;
    this.#slices.forEach((slice, i) => {
      const start = (acc / total) * 100;
      acc += Math.max(0, slice.value);
      const end = (acc / total) * 100;
      const n = ((slice.colorIndex ?? i + 1) - 1) % 11 + 1;
      stops.push(`var(--sherpa-categorical-${n}) ${start}% ${end}%`);
    });
    this.style.setProperty('--_ring', `conic-gradient(${stops.join(', ')})`);
  }

  #syncCentre(): void {
    const value = this.$('.value');
    if (value) value.textContent = this.dataset['label'] ?? '';
    const sub = this.$('.sub');
    if (sub) sub.textContent = this.dataset['sublabel'] ?? '';
  }
}

customElements.define('sherpa-donut-chart', SherpaDonutChart);
