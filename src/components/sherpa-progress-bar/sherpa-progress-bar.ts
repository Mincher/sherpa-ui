/**
 * sherpa-progress-bar — a bar that fills up as a task runs.
 *
 * A real <progress> owns the value, role and aria-valuenow. No JS-driven width.
 *
 * @prop {number} value — the current percentage (read/write, clamped 0–100)
 */
import { SherpaElement, clampNum } from '../../core/sherpa-element.js';

interface ProgressData {
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
    // `value` is the public API; data-value is the legacy fallback.
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

  /** Push value / indeterminate / label onto the native <progress>. */
  #sync(): void {
    const bar = this.#bar();
    if (!bar) return;

    if (this.hasAttribute('data-indeterminate')) {
      bar.removeAttribute('value'); // absent value IS native indeterminate
    } else {
      bar.value = this.#clamp(this.getAttribute('value') ?? this.dataset['value']);
    }

    const label = this.dataset['label'];
    const el = this.$('.label');
    if (el) el.textContent = label ?? '';
    if (label != null) this.setAttribute('aria-label', label);
  }

  /** Parse whatever arrived, then hold it to 0..100. */
  #clamp(raw: number | string | undefined | null): number {
    const n = typeof raw === 'number' ? raw : parseFloat(raw ?? '');
    if (!Number.isFinite(n)) return 0;
    return clampNum(n, { min: 0, max: 100 });
  }
}

customElements.define('sherpa-progress-bar', SherpaProgressBar);
