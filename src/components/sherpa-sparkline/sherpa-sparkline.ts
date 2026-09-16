/**
 * sherpa-sparkline — a tiny inline trend chart.
 *
 * CSS handles the whole look — the line, the fill, the bars, the hover points.
 * The one thing JS does is hand CSS the numbers: it passes the values and their
 * range to CSS, and CSS scales them to fit and draws the shape.
 *
 * @element sherpa-sparkline
 * @attr {string} data-values  — comma-separated or JSON array (e.g. "10,25,15,30")
 * @attr {enum}   data-type — line (default) | bar
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
 * The normalisation window is padded so the lowest point sits well clear of the
 * floor and the area beneath it reads as a filled shape. Expressed as a fraction
 * of the BOX rather than of the data's spread, because that is what governs how
 * the fill looks: a fraction of the spread gave the same 11.5% every time, which
 * on a 28px sparkline is only 3.2px of fill — a sliver.
 *
 * At 0.62 the line uses the top ~62% of the box and the lowest point sits ~30% up,
 * so roughly a third of the height is fill. The trend still reads clearly; a
 * larger share would flatten it.
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

    // Data length reflected on the host; CSS owns which shapes/points show
    // via :host([data-len="…"]) selectors.
    this.dataset['len'] = String(count);

    if (count === 0) return;

    const min = Math.min(...values);
    const max = Math.max(...values);
    const spread = max - min || 1;

    // HEADROOM below the lowest point, and a little above the peak.
    //
    // Normalising to exactly min..max puts the lowest value at 0% — flat against
    // the bottom edge — so the area fill has nothing to fill under it and the
    // trend reads as a line clipped at the floor.
    //
    // The window is sized so the data occupies LINE_SHARE of the box: the extra
    // range is (spread / share − spread), split so most of it goes BELOW the
    // minimum (that is the fill) and a little above the peak (so the line does
    // not touch the top edge either).
    const extra = spread / LINE_SHARE - spread;
    const below = extra * 0.8;
    const paddedMin = min - below;
    const range = spread + extra;

    // JS→CSS-var bridge (geometry, not style): raw values + normalisation range.
    this.style.setProperty('--_min', String(paddedMin));
    this.style.setProperty('--_range', String(range));
    // The point COUNT, which CSS cannot count for itself. The hover dots space
    // themselves across the box with `--_i / (--_len - 1)`, so this one number is
    // all they need — no per-dot x position from JS.
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
   * Only the TEXT — the dots position themselves in CSS off the same --_vN bridge
   * the line uses, and their tooltips place themselves with anchor positioning
   * (see .chart-tip in core/sherpa-base.css). Nothing here measures anything.
   */
  #applyTips(values: number[]): void {
    // The tips are SIBLINGS of the dots now, not children, so they are selected
    // in their own right and paired by index.
    const tips = this.$$<HTMLElement>('.chart-tip .chart-tip-value');
    tips.forEach((tip, i) => {
      tip.textContent = i < values.length ? formatTick(values[i]!) : '';
    });
  }
}

customElements.define('sherpa-sparkline', SherpaSparkline);
