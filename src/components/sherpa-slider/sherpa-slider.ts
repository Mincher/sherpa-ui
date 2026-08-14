/**
 * sherpa-slider — a single-value range control.
 *
 * A native <input type=range> owns interaction, keyboard, and accessibility;
 * this class is a thin coordinator. It mirrors data-min/max/step/value onto the
 * input, and the ONE thing CSS cannot compute — the fill length — is written to
 * the --_pct custom property (data-value → --_pct), which CSS uses for the fill
 * width. That is a data→CSS-variable bridge, not styling. JS never sets
 * display/width/colour; it re-dispatches the native input/change as unprefixed
 * events with a { value } detail.
 *
 * @element sherpa-slider
 * @attr {string} data-label      — label text above the slider
 * @attr {number} data-min        — minimum value (default 0)
 * @attr {number} data-max        — maximum value (default 100)
 * @attr {number} data-step       — step increment (default 1)
 * @attr {string} data-value      — current value
 * @attr {boolean} data-show-value — show the editable value input beside the track
 * @attr {boolean} data-value-readonly — make the value display read-only (no typing)
 * @attr {boolean} disabled       — disabled state
 *
 * @prop {number} value — the current value (read/write, clamped to min/max)
 *
 * @fires input  bubbles+composed, detail { value: number } — while dragging
 * @fires change bubbles+composed, detail { value: number } — on commit
 */
import { SherpaElement } from '../../core/sherpa-element.js';

interface SliderData {
  /** Current value. */
  value?: number;
}

export class SherpaSlider extends SherpaElement {
  static override css = new URL('./sherpa-slider.css', import.meta.url);
  static override html = new URL('./sherpa-slider.html', import.meta.url);
  static override observed = [
    'data-label',
    'data-min',
    'data-max',
    'data-step',
    'data-value',
    'disabled',
  ];

  #input: HTMLInputElement | null = null;
  #valueField: HTMLInputElement | null = null;

  override onRender(): void {
    this.#input = this.$<HTMLInputElement>('.range');
    this.#valueField = this.$<HTMLInputElement>('.value-input');
    this.#input?.addEventListener('input', this.#onInput);
    this.#input?.addEventListener('change', this.#onChange);
    // The editable value field is the second way to set the value.
    this.#valueField?.addEventListener('input', this.#onFieldInput);
    this.#valueField?.addEventListener('change', this.#onFieldChange);
    this.#syncInputAttrs();
    this.#sync();
  }

  override onDisconnect(): void {
    this.#input?.removeEventListener('input', this.#onInput);
    this.#input?.removeEventListener('change', this.#onChange);
    this.#valueField?.removeEventListener('input', this.#onFieldInput);
    this.#valueField?.removeEventListener('change', this.#onFieldChange);
  }

  override onChange(name: string): void {
    if (name === 'data-min' || name === 'data-max' || name === 'data-step' || name === 'disabled') {
      this.#syncInputAttrs();
    }
    this.#sync();
  }

  /** populate({ value }) sets the value — the single data path. */
  protected override renderData(data: unknown): void {
    const { value } = (data ?? {}) as SliderData;
    if (value != null) this.value = value;
  }

  /* ── Public API ──────────────────────────────────────────────────────── */

  get value(): number {
    return this.#clamp(this.dataset['value']);
  }
  set value(v: number) {
    this.dataset['value'] = String(this.#clamp(v));
  }

  /* ── Bounds ──────────────────────────────────────────────────────────── */

  get #min(): number {
    const n = parseFloat(this.dataset['min'] ?? '');
    return Number.isFinite(n) ? n : 0;
  }
  get #max(): number {
    const n = parseFloat(this.dataset['max'] ?? '');
    return Number.isFinite(n) ? n : 100;
  }
  get #step(): number {
    const n = parseFloat(this.dataset['step'] ?? '');
    return n > 0 ? n : 1;
  }

  #clamp(raw: number | string | undefined): number {
    const n = typeof raw === 'number' ? raw : parseFloat(raw ?? '');
    const value = Number.isFinite(n) ? n : this.#min;
    return Math.min(this.#max, Math.max(this.#min, value));
  }

  /* ── Sync ────────────────────────────────────────────────────────────── */

  /** Mirror min/max/step/disabled onto the native range + the value field. */
  #syncInputAttrs(): void {
    const min = String(this.#min), max = String(this.#max), step = String(this.#step);
    const disabled = this.hasAttribute('disabled');
    if (this.#input) {
      this.#input.min = min; this.#input.max = max; this.#input.step = step;
      this.#input.disabled = disabled;
    }
    if (this.#valueField) {
      this.#valueField.min = min; this.#valueField.max = max; this.#valueField.step = step;
      this.#valueField.disabled = disabled;
    }
  }

  /** Mirror the value onto the range input, the value field, and the --_pct fill bridge. */
  #sync(): void {
    const value = this.#clamp(this.dataset['value']);
    if (this.#input && this.#input.value !== String(value)) {
      this.#input.value = String(value);
    }
    // Don't clobber the value field while the user is typing in it.
    if (this.#valueField && this.#valueField !== this.shadowRoot?.activeElement && this.#valueField.value !== String(value)) {
      this.#valueField.value = String(value);
    }

    const range = this.#max - this.#min || 1;
    const pct = ((value - this.#min) / range) * 100;

    // JS→CSS-var bridge: the fill width lives in CSS as width: var(--_pct).
    this.style.setProperty('--_pct', `${pct}%`);

    const label = this.$('.label');
    if (label) label.textContent = this.dataset['label'] ?? '';
  }

  /* ── Native → re-dispatched events ───────────────────────────────────── */

  #readInput(): number {
    const n = parseFloat(this.#input?.value ?? '');
    return this.#clamp(Number.isFinite(n) ? n : this.#min);
  }

  #onInput = (): void => {
    const value = this.#readInput();
    this.dataset['value'] = String(value); // triggers #sync via onChange
    this.emit('input', { value });
  };

  #onChange = (): void => {
    const value = this.#readInput();
    this.dataset['value'] = String(value);
    this.emit('change', { value });
  };

  /* ── Editable value field → the value ────────────────────────────────── */

  #onFieldInput = (): void => {
    const raw = this.#valueField?.value ?? '';
    // While typing an intermediate value (empty, "-", "1."), don't fight the user.
    if (raw === '' || raw === '-' || raw.endsWith('.')) return;
    const value = this.#clamp(raw);
    this.dataset['value'] = String(value); // #sync leaves the focused field alone
    this.emit('input', { value });
  };

  #onFieldChange = (): void => {
    const value = this.#clamp(this.#valueField?.value ?? '');
    this.dataset['value'] = String(value);
    if (this.#valueField) this.#valueField.value = String(value); // snap the field to the clamped value on commit
    this.emit('change', { value });
  };
}

customElements.define('sherpa-slider', SherpaSlider);
