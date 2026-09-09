/**
 * sherpa-slider — a slider for picking one value in a range.
 *
 * A real range input does the dragging, keyboard, and accessibility; this class
 * just wraps it. JS copies min/max/step/value onto the input, and hands CSS the
 * one thing it can't work out — how far along the track the fill should reach.
 * It also re-fires the native input and change events with a { value } detail.
 *
 * @element sherpa-slider
 * @attr {string} data-label      — label text above the slider
 * @attr {number} min        — minimum value (default 0)
 * @attr {number} max        — maximum value (default 100)
 * @attr {number} step       — step increment (default 1)
 * @attr {number} value      — current value
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
    'min',
    'max',
    'step',
    'value',
    'disabled',
    'data-value-readonly',
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
    if (
      name === 'min' ||
      name === 'max' ||
      name === 'step' ||
      name === 'disabled' ||
      name === 'data-value-readonly'
    ) {
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
    return this.#clamp(this.getAttribute('value'));
  }
  set value(v: number) {
    this.setAttribute('value', String(this.#clamp(v)));
  }

  /* ── Bounds ──────────────────────────────────────────────────────────── */

  get #min(): number {
    const n = parseFloat(this.getAttribute('min') ?? '');
    return Number.isFinite(n) ? n : 0;
  }
  get #max(): number {
    const n = parseFloat(this.getAttribute('max') ?? '');
    return Number.isFinite(n) ? n : 100;
  }
  get #step(): number {
    const n = parseFloat(this.getAttribute('step') ?? '');
    return n > 0 ? n : 1;
  }

  #clamp(raw: number | string | undefined | null): number {
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
      // Mirror data-value-readonly onto the native input so it is truly read-only.
      this.#valueField.readOnly = this.hasAttribute('data-value-readonly');
    }
  }

  /** Mirror the value onto the range input, the value field, and the --_pct fill bridge. */
  #sync(): void {
    const value = this.#clamp(this.getAttribute('value'));
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
    this.setAttribute('value', String(value)); // triggers #sync via onChange
    this.emit('input', { value });
  };

  #onChange = (): void => {
    const value = this.#readInput();
    this.setAttribute('value', String(value));
    this.emit('change', { value });
  };

  /* ── Editable value field → the value ────────────────────────────────── */

  #onFieldInput = (): void => {
    const raw = this.#valueField?.value ?? '';
    // While typing an intermediate value (empty, "-", "1."), don't fight the user.
    if (raw === '' || raw === '-' || raw.endsWith('.')) return;
    const value = this.#clamp(raw);
    this.setAttribute('value', String(value)); // #sync leaves the focused field alone
    this.emit('input', { value });
  };

  #onFieldChange = (): void => {
    const value = this.#clamp(this.#valueField?.value ?? '');
    this.setAttribute('value', String(value));
    if (this.#valueField) this.#valueField.value = String(value); // snap the field to the clamped value on commit
    this.emit('change', { value });
  };
}

customElements.define('sherpa-slider', SherpaSlider);
