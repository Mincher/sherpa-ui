/**
 * sherpa-progress-bar — a bar that fills up as a task runs.
 *
 * Native-first: a real <progress> owns the value, role=progressbar and
 * aria-valuenow. JS only sets the inner progress's value/max (or clears value for
 * the indeterminate sweep) and mirrors the label; CSS styles the vendor
 * pseudo-elements. No manual role/aria, no JS-driven width.
 *
 * @element sherpa-progress-bar
 * @attr {number}  value               — 0–100 completion (native <progress value>)
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
  static override observed = ['value', 'data-value', 'data-indeterminate', 'data-label'];

  override onRender(): void {
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
    // The documented public API is the native `value` attribute; keep data-value
    // as a fallback for callers that used the data-* form.
    return this.#clamp(
      this.getAttribute('value') ?? this.#bar()?.value ?? this.dataset['value'],
    );
  }
  set value(v: number) {
    this.setAttribute('value', String(this.#clamp(v)));
    this.#sync();
  }

  /* ── Private ─────────────────────────────────────────────────────────── */

  #bar(): HTMLProgressElement | null {
    return this.$<HTMLProgressElement>('.bar');
  }

  /** Mirror data-value / data-indeterminate onto the native <progress>, + label. */
  #sync(): void {
    const bar = this.#bar();
    if (!bar) return;

    if (this.hasAttribute('data-indeterminate')) {
      bar.removeAttribute('value'); // native indeterminate progress
    } else {
      // Prefer the native `value` attribute (public API), fall back to data-value.
      bar.value = this.#clamp(this.getAttribute('value') ?? this.dataset['value']); // native determinate + aria-valuenow
    }

    // Mirror the text into the label span (CSS shows/hides it off data-label).
    const label = this.dataset['label'];
    const el = this.$('.label');
    if (el) el.textContent = label ?? '';
    if (label != null) this.setAttribute('aria-label', label);
  }

  #clamp(raw: number | string | undefined | null): number {
    const n = typeof raw === 'number' ? raw : parseFloat(raw ?? '');
    if (!Number.isFinite(n)) return 0;
    return Math.min(100, Math.max(0, n));
  }
}

customElements.define('sherpa-progress-bar', SherpaProgressBar);
