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
 * @attr {enum} data-type    — single (default) | range: two thumbs, two value fields
 * @attr {number} value-start — the range's low end (data-type="range")
 * @attr {number} value-end   — the range's high end (data-type="range")
 * @attr {boolean} disabled       — disabled state
 *
 * @prop {number} value — the current value (read/write, clamped to min/max)
 * @prop {[number, number]} range — the two ends (read/write); low end first
 *
 * @fires input  bubbles+composed — while dragging. single: { value }; range: { start, end }
 * @fires change bubbles+composed — on commit.     single: { value }; range: { start, end }
 */
import { SherpaElement, coerceNum, clampNum } from '../../core/sherpa-element.js';

interface SliderData {
  /** Current value (single mode). */
  value?: number;
  /** The range's low end (range mode). */
  start?: number;
  /** The range's high end (range mode). */
  end?: number;
}

export class SherpaSlider extends SherpaElement {
  static override css = new URL('./sherpa-slider.css', import.meta.url);
  static override html = new URL('./sherpa-slider.html', import.meta.url);
  static override props = {
    'data-label': { type: 'string', kind: 'content', to: '.label' },
  } as const;

  static override observed = [
    'min',
    'max',
    'step',
    'value',
    'value-start',
    'value-end',
    'data-type',
    'disabled',
    'data-value-readonly',
  ];

  /**
   * The two native range inputs.
   *
   * In SINGLE mode only `#input` is used and `#endInput` sits hidden, exactly as
   * it always did — range mode reveals the second rather than building one, so
   * there is no createElement and no template switch.
   *
   * In RANGE mode `#input` owns the LOW end and `#endInput` the high one.
   */
  #input: HTMLInputElement | null = null;
  #endInput: HTMLInputElement | null = null;
  /** The editable number field beside the track — the HIGH end in range mode. */
  #valueField: HTMLInputElement | null = null;
  /** The second field, before the track. Range mode only. */
  #startField: HTMLInputElement | null = null;

  override onRender(): void {
    this.#input = this.$<HTMLInputElement>('.range');
    this.#endInput = this.$<HTMLInputElement>('.range-end');
    this.#valueField = this.$<HTMLInputElement>('.value-end');
    this.#startField = this.$<HTMLInputElement>('.value-start');
    // `signal` instead of eight paired removeEventListener calls. The base
    // class aborts it on disconnect, so there is no teardown to keep in step
    // with this list — and nothing to forget when a ninth listener is added.
    const signal = this.signal;
    this.#input?.addEventListener('input', this.#onInput, { signal });
    this.#input?.addEventListener('change', this.#onChange, { signal });
    this.#endInput?.addEventListener('input', this.#onEndInput, { signal });
    this.#endInput?.addEventListener('change', this.#onEndChange, { signal });
    // The editable value fields are the second way to set the value.
    this.#valueField?.addEventListener('input', this.#onFieldInput, { signal });
    this.#valueField?.addEventListener('change', this.#onFieldChange, { signal });
    this.#startField?.addEventListener('input', this.#onStartFieldInput, { signal });
    this.#startField?.addEventListener('change', this.#onStartFieldChange, { signal });
    this.#syncInputAttrs();
    this.#sync();
  }

  override onChange(name: string): void {
    if (
      name === 'min' ||
      name === 'max' ||
      name === 'step' ||
      name === 'disabled' ||
      name === 'data-type' ||
      name === 'data-value-readonly'
    ) {
      this.#syncInputAttrs();
    }
    this.#sync();
  }

  /** populate({ value }) or populate({ start, end }) — the one data path. */
  protected override renderData(data: unknown): void {
    const { value, start, end } = (data ?? {}) as SliderData;
    if (start != null || end != null) {
      this.range = [start ?? this.#min, end ?? this.#max];
      return;
    }
    if (value != null) this.value = value;
  }

  /* ── Public API ──────────────────────────────────────────────────────── */

  get value(): number {
    return this.#clamp(this.getAttribute('value'));
  }
  set value(v: number) {
    this.setAttribute('value', String(this.#clamp(v)));
  }

  /** Whether this slider has two ends. */
  get #isRange(): boolean {
    return this.dataset['type'] === 'range';
  }

  /**
   * The two ends, LOW first.
   *
   * Always ordered, whichever way the user dragged: a range whose start is above
   * its end is not a range, and every consumer would otherwise have to sort it
   * again. An absent end defaults to the corresponding bound, so a half-set
   * range still reads as "everything from here" rather than as a broken one.
   */
  get range(): [number, number] {
    const lo = this.#clamp(this.getAttribute('value-start') ?? String(this.#min));
    const hi = this.#clamp(this.getAttribute('value-end') ?? String(this.#max));
    return lo <= hi ? [lo, hi] : [hi, lo];
  }
  set range(next: [number, number]) {
    const [lo, hi] = [this.#clamp(next[0]), this.#clamp(next[1])];
    const [start, end] = lo <= hi ? [lo, hi] : [hi, lo];
    this.setAttribute('value-start', String(start));
    this.setAttribute('value-end', String(end));
  }

  /* ── Bounds ──────────────────────────────────────────────────────────── */

  // Native attribute names (min/max/step), un-prefixed per the naming contract.
  // num() is STRICTER than the parseFloat these used to use: parseFloat('12px')
  // reads 12, num() rejects it. A bound that is not a number is an author error,
  // and quietly reading half of it hides the mistake.
  get #min(): number {
    return this.num('min', 0);
  }
  get #max(): number {
    return this.num('max', 100);
  }
  get #step(): number {
    const n = this.num('step', 1);
    // A step of 0 or less cannot advance the slider, so it falls back rather
    // than clamping — clamping would silently pick a step the author never named.
    return n > 0 ? n : 1;
  }

  #clamp(raw: number | string | undefined | null): number {
    const n = typeof raw === 'number' ? raw : coerceNum(raw, NaN);
    const value = Number.isFinite(n) ? n : this.#min;
    return clampNum(value, { min: this.#min, max: this.#max });
  }

  /* ── Sync ────────────────────────────────────────────────────────────── */

  /** Mirror min/max/step/disabled onto every native input. */
  #syncInputAttrs(): void {
    const min = String(this.#min), max = String(this.#max), step = String(this.#step);
    const disabled = this.hasAttribute('disabled');
    const readOnly = this.hasAttribute('data-value-readonly');
    // Every input shares the SAME bounds, so both rails map a percentage to the
    // same position and the two thumbs can be compared directly.
    for (const el of [this.#input, this.#endInput]) {
      if (!el) continue;
      el.min = min; el.max = max; el.step = step;
      el.disabled = disabled;
    }
    for (const el of [this.#valueField, this.#startField]) {
      if (!el) continue;
      el.min = min; el.max = max; el.step = step;
      el.disabled = disabled;
      // Mirror data-value-readonly onto the native input so it is truly read-only.
      el.readOnly = readOnly;
    }
  }

  /** Where a value sits along the rail, as a percentage. */
  #pctOf(value: number): number {
    const span = this.#max - this.#min || 1;
    return ((value - this.#min) / span) * 100;
  }

  /**
   * Write a value into a native input without fighting a user who is typing in
   * it. A field is left alone while focused; the commit handler snaps it.
   */
  #put(el: HTMLInputElement | null, value: number): void {
    if (!el || el === this.shadowRoot?.activeElement) return;
    const text = String(value);
    if (el.value !== text) el.value = text;
  }

  /** Mirror the value(s) onto every input and onto the --_pct fill bridge. */
  #sync(): void {
    if (this.#isRange) {
      const [start, end] = this.range;
      // The first input carries the LOW end and the second the high one. They
      // are written even while one is being dragged, which is what keeps a thumb
      // from being pushed past its partner.
      this.#put(this.#input, start);
      this.#put(this.#endInput, end);
      this.#put(this.#startField, start);
      this.#put(this.#valueField, end);
      this.style.setProperty('--_pct-start', `${this.#pctOf(start)}%`);
      this.style.setProperty('--_pct', `${this.#pctOf(end)}%`);
      return;
    }

    const value = this.#clamp(this.getAttribute('value'));
    this.#put(this.#input, value);
    this.#put(this.#valueField, value);
    // 0 in single mode, so the fill runs from the rail's head as it always has.
    this.style.setProperty('--_pct-start', '0%');
    this.style.setProperty('--_pct', `${this.#pctOf(value)}%`);
  }

  /**
   * Set one end of the range and report it.
   *
   * The ends CLAMP against each other rather than swapping: dragging the low
   * thumb past the high one stops it at the high one. Swapping would hand the
   * user a thumb they are no longer holding, and the pointer would carry on
   * moving the other end.
   */
  #setEnd(which: 'start' | 'end', raw: number, event: 'input' | 'change'): void {
    const [start, end] = this.range;
    const value = this.#clamp(raw);
    const next: [number, number] =
      which === 'start' ? [Math.min(value, end), end] : [start, Math.max(value, start)];
    this.setAttribute('value-start', String(next[0]));
    this.setAttribute('value-end', String(next[1]));
    this.emit(event, { start: next[0], end: next[1] });
  }

  /* ── Native → re-dispatched events ───────────────────────────────────── */

  #readInput(el: HTMLInputElement | null = this.#input): number {
    const n = parseFloat(el?.value ?? '');
    return this.#clamp(Number.isFinite(n) ? n : this.#min);
  }

  // The FIRST input is the whole control in single mode and the LOW end in range
  // mode, so each handler branches once rather than the template carrying two.
  #onInput = (): void => {
    if (this.#isRange) return this.#setEnd('start', this.#readInput(), 'input');
    const value = this.#readInput();
    this.setAttribute('value', String(value)); // triggers #sync via onChange
    this.emit('input', { value });
  };

  #onChange = (): void => {
    if (this.#isRange) return this.#setEnd('start', this.#readInput(), 'change');
    const value = this.#readInput();
    this.setAttribute('value', String(value));
    this.emit('change', { value });
  };

  /* ── The second thumb — range mode only ──────────────────────────────── */

  #onEndInput = (): void => {
    this.#setEnd('end', this.#readInput(this.#endInput), 'input');
  };

  #onEndChange = (): void => {
    this.#setEnd('end', this.#readInput(this.#endInput), 'change');
  };

  /* ── Editable value field → the value ────────────────────────────────── */

  /** A part-typed value the user is still in the middle of. Leave it alone. */
  #partial(raw: string): boolean {
    return raw === '' || raw === '-' || raw.endsWith('.');
  }

  #onFieldInput = (): void => {
    const raw = this.#valueField?.value ?? '';
    // While typing an intermediate value (empty, "-", "1."), don't fight the user.
    if (this.#partial(raw)) return;
    if (this.#isRange) return this.#setEnd('end', this.#clamp(raw), 'input');
    const value = this.#clamp(raw);
    this.setAttribute('value', String(value)); // #sync leaves the focused field alone
    this.emit('input', { value });
  };

  #onFieldChange = (): void => {
    if (this.#isRange) {
      this.#setEnd('end', this.#clamp(this.#valueField?.value ?? ''), 'change');
      // Snap the field to whatever the clamp settled on — the typed number may
      // have been below the low end, or outside the bounds entirely.
      if (this.#valueField) this.#valueField.value = String(this.range[1]);
      return;
    }
    const value = this.#clamp(this.#valueField?.value ?? '');
    this.setAttribute('value', String(value));
    if (this.#valueField) this.#valueField.value = String(value); // snap the field to the clamped value on commit
    this.emit('change', { value });
  };

  /* ── The start field — range mode only ───────────────────────────────── */

  #onStartFieldInput = (): void => {
    const raw = this.#startField?.value ?? '';
    if (this.#partial(raw)) return;
    this.#setEnd('start', this.#clamp(raw), 'input');
  };

  #onStartFieldChange = (): void => {
    this.#setEnd('start', this.#clamp(this.#startField?.value ?? ''), 'change');
    if (this.#startField) this.#startField.value = String(this.range[0]);
  };
}

customElements.define('sherpa-slider', SherpaSlider);
