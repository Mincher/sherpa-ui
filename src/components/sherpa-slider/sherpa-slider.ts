/**
 * sherpa-slider — pick one value, or a range, on a rail.
 *
 * A native range input does the dragging, keys and a11y; this mirrors
 * min/max/step/value onto it and hands CSS the fill percentage.
 *
 * @prop {number} value — the current value (read/write, clamped to min/max)
 * @prop {[number, number]} range — the two ends (read/write); low end first
 */
import { SherpaElement, coerceNum, clampNum } from '../../core/sherpa-element.js';

interface SliderData {
  value?: number;
  start?: number;
  end?: number;
}

export class SherpaSlider extends SherpaElement {
  static override css = new URL('./sherpa-slider.css', import.meta.url);
  static override html = new URL('./sherpa-slider.html', import.meta.url);
  static override props = {
    'data-show-value': { type: 'boolean', kind: 'style' },
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

  /** TRAP T-slider-second-thumb-is-revealed-not-built — the whole control in single mode, the LOW end in range. */
  #input: HTMLInputElement | null = null;
  #endInput: HTMLInputElement | null = null;
  /** Editable number field — the HIGH end in range mode. */
  #valueField: HTMLInputElement | null = null;
  /** Editable number field for the low end. Range mode only. */
  #startField: HTMLInputElement | null = null;

  override onRender(): void {
    this.#input = this.$<HTMLInputElement>('.range');
    this.#endInput = this.$<HTMLInputElement>('.range-end');
    this.#valueField = this.$<HTMLInputElement>('.value-end');
    this.#startField = this.$<HTMLInputElement>('.value-start');
    // TRAP T-abort-controller-per-connect
    const signal = this.signal;
    this.#input?.addEventListener('input', this.#onInput, { signal });
    this.#input?.addEventListener('change', this.#onChange, { signal });
    this.#endInput?.addEventListener('input', this.#onEndInput, { signal });
    this.#endInput?.addEventListener('change', this.#onEndChange, { signal });
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

  /** populate({ value }) or populate({ start, end }). */
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

  get #isRange(): boolean {
    return this.dataset['type'] === 'range';
  }

  /** The two ends, LOW first. TRAP T-range-reads-ordered-but-drags-clamped — reading ORDERS the pair. */
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

  // TRAP T-num-is-stricter-than-parsefloat — a non-numeric bound is rejected, not half-read.
  get #min(): number {
    return this.num('min', 0);
  }
  get #max(): number {
    return this.num('max', 100);
  }
  get #step(): number {
    const n = this.num('step', 1);
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
    for (const el of [this.#input, this.#endInput]) {
      if (!el) continue;
      el.min = min; el.max = max; el.step = step;
      el.disabled = disabled;
    }
    for (const el of [this.#valueField, this.#startField]) {
      if (!el) continue;
      el.min = min; el.max = max; el.step = step;
      el.disabled = disabled;
      el.readOnly = readOnly;
    }
  }

  /** Where a value sits along the rail, as a percentage. */
  #pctOf(value: number): number {
    const span = this.#max - this.#min || 1;
    return ((value - this.#min) / span) * 100;
  }

  /** Write into a native input. TRAP T-never-fight-a-focused-field. */
  #put(el: HTMLInputElement | null, value: number): void {
    if (!el || el === this.shadowRoot?.activeElement) return;
    const text = String(value);
    if (el.value !== text) el.value = text;
  }

  /** Mirror the value(s) onto every input and onto the --_pct fill bridge. */
  #sync(): void {
    if (this.#isRange) {
      const [start, end] = this.range;
      // BOTH written even mid-drag — that is what stops a thumb passing its partner.
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
    this.style.setProperty('--_pct-start', '0%');
    this.style.setProperty('--_pct', `${this.#pctOf(value)}%`);
  }

  /** Set one end and report it. The ends CLAMP here, they do not swap. */
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

  /** A half-typed value — leave it alone. */
  #partial(raw: string): boolean {
    return raw === '' || raw === '-' || raw.endsWith('.');
  }

  #onFieldInput = (): void => {
    const raw = this.#valueField?.value ?? '';
    if (this.#partial(raw)) return;
    if (this.#isRange) return this.#setEnd('end', this.#clamp(raw), 'input');
    const value = this.#clamp(raw);
    this.setAttribute('value', String(value));
    this.emit('input', { value });
  };

  #onFieldChange = (): void => {
    if (this.#isRange) {
      this.#setEnd('end', this.#clamp(this.#valueField?.value ?? ''), 'change');
      if (this.#valueField) this.#valueField.value = String(this.range[1]);
      return;
    }
    const value = this.#clamp(this.#valueField?.value ?? '');
    this.setAttribute('value', String(value));
    if (this.#valueField) this.#valueField.value = String(value);
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
