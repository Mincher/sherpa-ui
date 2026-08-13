/**
 * sherpa-input-date — a labelled date field.
 *
 * A thin variation of sherpa-input-text: same label / description / message chrome
 * and value API, but the control is a native <input type="date"> — clean, accessible,
 * and locale-aware for free. data-min / data-max mirror to native min / max;
 * name / value / required / disabled / readonly mirror verbatim. Validation LOOK is
 * pure CSS (:user-invalid); JS only carries values and re-emits input/change.
 * Value format is always YYYY-MM-DD.
 *
 * @fires input  detail: { value: string }
 * @fires change detail: { value: string }
 */
import { SherpaElement } from '../../core/sherpa-element.js';

/** Native attributes mirrored verbatim from the host onto the inner control. */
const MIRRORED = ['name', 'value', 'required', 'disabled', 'readonly'] as const;

/** data-* → native attribute mapping for the date constraints. */
const CONSTRAINTS: ReadonlyArray<readonly [string, string]> = [
  ['data-min', 'min'],
  ['data-max', 'max'],
  ['data-step', 'step'],
];

export class SherpaInputDate extends SherpaElement {
  static override css = new URL('./sherpa-input-date.css', import.meta.url);
  static override html = new URL('./sherpa-input-date.html', import.meta.url);
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

  /** Mirror native attributes + date constraints host → inner control. */
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

  /** Current value as a Date (UTC midnight), or null when empty / invalid. */
  get valueAsDate(): Date | null {
    return this.#control?.valueAsDate ?? null;
  }

  /** Native validity, surfaced for form logic. */
  checkValidity(): boolean {
    return this.#control?.checkValidity() ?? true;
  }

  override focus(): void {
    this.#control?.focus();
  }

  #onInput = (): void => this.emit('input', { value: this.value });
  #onChange = (): void => this.emit('change', { value: this.value });
}

customElements.define('sherpa-input-date', SherpaInputDate);
