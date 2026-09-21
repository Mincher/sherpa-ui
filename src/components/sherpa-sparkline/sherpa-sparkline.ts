/**
 * sherpa-sparkline — a tiny inline trend chart. JS hands CSS the numbers and the
 * range; CSS draws the line, fill, bars and dots.
 *
 * @method populate(values: number[]) — the single data path; serialises to data-values
 */
import { SherpaElement } from '../../core/sherpa-element.js';
import { formatTick } from '../../core/format-tick.js';

/** Fixed point slots; SLOTS-1 segments between them. */
const SLOTS = 8;
/** TRAP T-sparkline-headroom-is-a-share-of-the-box — share of the BOX, not of the data. */
const LINE_SHARE = 0.62;

export class SherpaSparkline extends SherpaElement {
  static override css = new URL('./sherpa-sparkline.css', import.meta.url);
  static override html = new URL('./sherpa-sparkline.html', import.meta.url);
  static override observed = ['data-values'];

  override onRender(): void {
    this.#apply();
  }

  override onChange(): void {
    this.#apply();
  }

  /** Serialises to data-values, which is the source of truth. */
  protected override renderData(source: unknown): void {
    if (!Array.isArray(source)) return;
    this.dataset['values'] = JSON.stringify(source);
  }

  /* ── Private ─────────────────────────────────────────────────────────── */

  /** data-values is JSON or CSV; non-finite entries are dropped. */
  #parse(): number[] {
    const raw = this.dataset['values'];
    if (!raw) return [];
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = raw.split(',').map((v) => parseFloat(v.trim()));
    }
    if (!Array.isArray(parsed)) return [];
    return parsed.map(Number).filter((n) => Number.isFinite(n));
  }

  /** Bridge the values into the --_* custom properties CSS reads. */
  #apply(): void {
    const values = this.#parse().slice(-SLOTS);
    const count = values.length;

    // CSS owns which shapes show, via :host([data-len="…"]).
    this.dataset['len'] = String(count);

    if (count === 0) return;

    const min = Math.min(...values);
    const max = Math.max(...values);
    const spread = max - min || 1;

    const extra = spread / LINE_SHARE - spread;
    const below = extra * 0.8;
    const paddedMin = min - below;
    const range = spread + extra;

    this.style.setProperty('--_min', String(paddedMin));
    this.style.setProperty('--_range', String(range));
    this.style.setProperty('--_len', String(count));
    for (let i = 0; i < SLOTS; i++) {
      if (i < count) this.style.setProperty(`--_v${i}`, String(values[i]));
      else this.style.removeProperty(`--_v${i}`);
    }

    this.#applyTips(values);
  }

  /**
   * Fill each hover dot's tooltip — the TEXT only.
   *
   * TRAP T-chart-tip-is-a-sibling-of-its-dot — paired by index, placed by CSS.
   */
  #applyTips(values: number[]): void {
    const tips = this.$$<HTMLElement>('.chart-tip .chart-tip-value');
    tips.forEach((tip, i) => {
      tip.textContent = i < values.length ? formatTick(values[i]!) : '';
    });
  }
}

customElements.define('sherpa-sparkline', SherpaSparkline);
