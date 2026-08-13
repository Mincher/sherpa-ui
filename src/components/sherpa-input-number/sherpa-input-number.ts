/**
 * sherpa-input-number — a labelled numeric field with optional ± steppers.
 *
 * A thin variation of sherpa-input-text: same label / description / message
 * chrome and value API, but the control is <input type="number"> (right-aligned,
 * mono) and data-min / data-max / data-step mirror to native min / max / step.
 * Steppers (data-steppers) use the native stepUp/stepDown and re-emit input/change.
 * Validation LOOK is pure CSS (:user-invalid); JS only carries values and steps.
 *
 * @fires input  detail: { value: string }
 * @fires change detail: { value: string }
 */
import { SherpaElement } from '../../core/sherpa-element.js';

/** Native attributes mirrored verbatim from the host onto the inner control. */
const MIRRORED = ['placeholder', 'name', 'value', 'required', 'disabled', 'readonly'] as const;

/** data-* → native attribute mapping for the numeric constraints. */
const CONSTRAINTS: ReadonlyArray<readonly [string, string]> = [
  ['data-min', 'min'],
  ['data-max', 'max'],
  ['data-step', 'step'],
];

export class SherpaInputNumber extends SherpaElement {
  static override css = new URL('./sherpa-input-number.css', import.meta.url);
  static override html = new URL('./sherpa-input-number.html', import.meta.url);
  static override observed = [
    'data-label',
    'data-description',
    'data-error',
    'data-min',
    'data-max',
    'data-step',
    ...MIRRORED,
  ];

  #control: HTMLInputElement | null = null;

  override onRender(): void {
    this.#control = this.$<HTMLInputElement>('.control');
    this.#syncText();
    this.#syncAttrs();
    this.#control?.addEventListener('input', this.#onInput);
    this.#control?.addEventListener('change', this.#onChange);
    this.$('.step-down')?.addEventListener('click', this.#onStepDown);
    this.$('.step-up')?.addEventListener('click', this.#onStepUp);
  }

  override onChange(name: string): void {
    if (name === 'data-label' || name === 'data-description' || name === 'data-error') this.#syncText();
    else this.#syncAttrs();
  }

  /** Label / description / error text into the shadow (CSS collapses empties). */
  #syncText(): void {
    const set = (sel: string, value: string | undefined): void => {
      const el = this.$(sel);
      if (el) el.textContent = value ?? '';
    };
    set('.label', this.dataset['label']);
    set('.description', this.dataset['description']);
    set('.message', this.dataset['error']);
  }

  /** Mirror native attributes + numeric constraints host → inner control. */
  #syncAttrs(): void {
    const c = this.#control;
    if (!c) return;
    for (const attr of MIRRORED) {
      if (attr === 'value') continue; // value set via the property below
      if (this.hasAttribute(attr)) c.setAttribute(attr, this.getAttribute(attr) ?? '');
      else c.removeAttribute(attr);
    }
    for (const [dataAttr, nativeAttr] of CONSTRAINTS) {
      if (this.hasAttribute(dataAttr)) c.setAttribute(nativeAttr, this.getAttribute(dataAttr) ?? '');
      else c.removeAttribute(nativeAttr);
    }
    if (this.hasAttribute('value')) c.value = this.getAttribute('value') ?? '';
  }

  /* ── Value property — the form-control surface ─────────────────────── */

  get value(): string {
    return this.#control?.value ?? this.getAttribute('value') ?? '';
  }
  set value(v: string) {
    if (this.#control) this.#control.value = v;
    else this.setAttribute('value', v);
  }

  /** Current value as a number (NaN → 0). */
  get valueAsNumber(): number {
    const n = parseFloat(this.value);
    return Number.isNaN(n) ? 0 : n;
  }

  /** Native validity, surfaced for form logic. */
  checkValidity(): boolean {
    return this.#control?.checkValidity() ?? true;
  }

  /** Increment the value by n native steps. */
  stepUp(n = 1): void {
    this.#step(n);
  }
  /** Decrement the value by n native steps. */
  stepDown(n = 1): void {
    this.#step(-n);
  }

  override focus(): void {
    this.#control?.focus();
  }

  /* ── Internal ──────────────────────────────────────────────────────── */

  #step(direction: number): void {
    const c = this.#control;
    if (!c || this.hasAttribute('disabled') || this.hasAttribute('readonly')) return;
    try {
      if (direction > 0) c.stepUp(direction);
      else c.stepDown(-direction);
    } catch {
      // stepUp/stepDown throws on empty/out-of-range values — fall back manually.
      const step = parseFloat(this.getAttribute('data-step') ?? '') || 1;
      const min = this.hasAttribute('data-min') ? parseFloat(this.getAttribute('data-min')!) : -Infinity;
      const max = this.hasAttribute('data-max') ? parseFloat(this.getAttribute('data-max')!) : Infinity;
      const next = Math.min(Math.max((parseFloat(c.value) || 0) + step * direction, min), max);
      const decimals = (String(step).split('.')[1] ?? '').length;
      c.value = next.toFixed(decimals);
    }
    this.emit('input', { value: this.value });
    this.emit('change', { value: this.value });
  }

  #onStepDown = (): void => this.stepDown();
  #onStepUp = (): void => this.stepUp();
  #onInput = (): void => this.emit('input', { value: this.value });
  #onChange = (): void => this.emit('change', { value: this.value });
}

customElements.define('sherpa-input-number', SherpaInputNumber);
