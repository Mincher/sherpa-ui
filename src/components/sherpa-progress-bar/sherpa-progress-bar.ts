/**
 * sherpa-progress-bar — a horizontal progress indicator for a single ongoing task.
 *
 * Behaviour only. All appearance (track, fill colour, the indeterminate sweep, the
 * disabled look) is CSS keyed off `data-*`. The one thing JS does that CSS cannot is
 * turn the numeric `data-value` into a length: it writes the clamped percentage into
 * the `--_pct` custom property on the host, and CSS uses that for the fill `width`.
 * That is a data→CSS-variable bridge, not a style/visibility toggle — JS never sets
 * `display`, `width` directly, or a class.
 *
 * @element sherpa-progress-bar
 * @attr {number}  data-value          — 0–100 completion percentage (determinate)
 * @attr {boolean} data-indeterminate  — animated sweep when the duration is unknown
 * @attr {string}  data-label          — accessible task label (also drives aria-label)
 * @attr {enum}    data-status         — critical | warning | success | info (colours the fill)
 *
 * @prop {number} value — the current percentage (read/write, clamped 0–100)
 */
import { SherpaElement } from '../../core/sherpa-element.js';

interface ProgressData {
  /** 0–100 completion percentage. */
  value?: number;
}

export class SherpaProgressBar extends SherpaElement {
  static override css = new URL('./sherpa-progress-bar.css', import.meta.url);
  static override html = new URL('./sherpa-progress-bar.html', import.meta.url);
  static override observed = ['data-value', 'data-indeterminate', 'data-label'];

  override onRender(): void {
    this.setAttribute('role', 'progressbar');
    this.setAttribute('aria-valuemin', '0');
    this.setAttribute('aria-valuemax', '100');
    this.#sync();
  }

  override onChange(): void {
    this.#sync();
  }

  /** populate({ value }) sets the percentage — the single data path. */
  protected override renderData(data: unknown): void {
    const { value } = (data ?? {}) as ProgressData;
    if (value != null) this.value = value;
  }

  /* ── Public API ──────────────────────────────────────────────────────── */

  get value(): number {
    return this.#clamp(this.dataset['value']);
  }
  set value(v: number) {
    this.dataset['value'] = String(this.#clamp(v));
  }

  /* ── Private ─────────────────────────────────────────────────────────── */

  /** Bridge data-value → the --_pct custom property CSS reads for the fill width. */
  #sync(): void {
    const indeterminate = this.hasAttribute('data-indeterminate');
    const pct = this.#clamp(this.dataset['value']);

    // JS→CSS-var bridge: the fill width lives in CSS as width: var(--_pct).
    this.style.setProperty('--_pct', `${pct}%`);

    if (indeterminate) this.removeAttribute('aria-valuenow');
    else this.setAttribute('aria-valuenow', String(pct));

    // Mirror the text into the label span (CSS shows/hides it off data-label).
    const label = this.dataset['label'];
    const el = this.$('.label');
    if (el) el.textContent = label ?? '';
    if (label != null) this.setAttribute('aria-label', label);
  }

  #clamp(raw: number | string | undefined): number {
    const n = typeof raw === 'number' ? raw : parseFloat(raw ?? '');
    if (!Number.isFinite(n)) return 0;
    return Math.min(100, Math.max(0, n));
  }
}

customElements.define('sherpa-progress-bar', SherpaProgressBar);
