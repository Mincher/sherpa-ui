/**
 * sherpa-sparkline — a tiny inline trend chart.
 *
 * CSS handles the whole look — the line, the fill, the bars, the hover points.
 * The one thing JS does is hand CSS the numbers: it passes the values and their
 * range to CSS, and CSS scales them to fit and draws the shape.
 *
 * @method populate(values: number[]) — the single data path; serialises to data-values
 */
import { SherpaElement } from '../../core/sherpa-element.js';
import { formatTick } from '../../core/format-tick.js';

/** Fixed point slots (0..SLOTS-1); SLOTS-1 segments between them. */
const SLOTS = 8;
/**
 * How much of the box the trend line is allowed to occupy, vertically.
 *
 * TRAP T-sparkline-headroom-is-a-share-of-the-box — a fraction of the BOX, not
 * of the data's spread.
 */
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

  /** populate([10, 25, 15, 30]) — serialises to data-values (the source of truth). */
  protected override renderData(source: unknown): void {
    if (!Array.isArray(source)) return;
    this.dataset['values'] = JSON.stringify(source);
  }

  /* ── Private ─────────────────────────────────────────────────────────── */

  /** Parse data-values (JSON or CSV) into a finite-number list. */
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

  /** Bridge the value list into the --_v0..7 / --_min / --_range custom properties CSS reads. */
  #apply(): void {
    // Keep only the most recent SLOTS values.
    const values = this.#parse().slice(-SLOTS);
    const count = values.length;

    // CSS owns which shapes/points show, via :host([data-len="…"]).
    this.dataset['len'] = String(count);

    if (count === 0) return;

    const min = Math.min(...values);
    const max = Math.max(...values);
    const spread = max - min || 1;

    // HEADROOM below the lowest point, and a little above the peak.
    // TRAP T-sparkline-headroom-is-a-share-of-the-box
    const extra = spread / LINE_SHARE - spread;
    const below = extra * 0.8;
    const paddedMin = min - below;
    const range = spread + extra;

    // JS→CSS-var bridge (geometry, not style): raw values + normalisation range.
    this.style.setProperty('--_min', String(paddedMin));
    this.style.setProperty('--_range', String(range));
    // TRAP T-sparkline-headroom-is-a-share-of-the-box — the COUNT is all the
    // hover dots need; no per-dot x position from JS.
    this.style.setProperty('--_len', String(count));
    for (let i = 0; i < SLOTS; i++) {
      if (i < count) this.style.setProperty(`--_v${i}`, String(values[i]));
      else this.style.removeProperty(`--_v${i}`);
    }

    this.#applyTips(values);
  }

  /**
   * Fill each hover dot's tooltip with its own value.
   *
   * TRAP T-chart-tip-is-a-sibling-of-its-dot — only the TEXT; the dots and the
   * tips are siblings, paired by index, and place themselves in CSS.
   */
  #applyTips(values: number[]): void {
    const tips = this.$$<HTMLElement>('.chart-tip .chart-tip-value');
    tips.forEach((tip, i) => {
      tip.textContent = i < values.length ? formatTick(values[i]!) : '';
    });
  }
}

customElements.define('sherpa-sparkline', SherpaSparkline);
