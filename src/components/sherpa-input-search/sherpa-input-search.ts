/**
 * sherpa-input-search — a labelled search field.
 *
 * A thin variation of sherpa-input-text: same label / description / message
 * chrome and value API, plus a leading search glyph (pure CSS) and a clear
 * button that appears only when there's a value. JS keeps the [data-has-value]
 * flag in sync (CSS shows/hides the clear button off it) and emits a `search`
 * event on Enter and on clear. Validation LOOK is pure CSS (:user-invalid).
 *
 * @fires input  detail: { value: string }
 * @fires change detail: { value: string }
 * @fires search detail: { value: string }
 */
import { SherpaElement } from '../../core/sherpa-element.js';

/** Native attributes mirrored verbatim from the host onto the inner control. */
const MIRRORED = ['placeholder', 'name', 'value', 'required', 'disabled', 'readonly'] as const;

export class SherpaInputSearch extends SherpaElement {
  static override css = new URL('./sherpa-input-search.css', import.meta.url);
  static override html = new URL('./sherpa-input-search.html', import.meta.url);
  static override observed = ['data-label', 'data-description', 'data-error', ...MIRRORED];

  #control: HTMLInputElement | null = null;

  override onRender(): void {
    this.#control = this.$<HTMLInputElement>('.control');
    this.#syncText();
    this.#syncAttrs();
    this.#reflectHasValue();
    this.#control?.addEventListener('input', this.#onInput);
    this.#control?.addEventListener('change', this.#onChange);
    this.#control?.addEventListener('keydown', this.#onKeyDown);
    this.$('.clear')?.addEventListener('click', this.#onClear);
  }

  override onChange(name: string): void {
    if (name === 'data-label' || name === 'data-description' || name === 'data-error') this.#syncText();
    else {
      this.#syncAttrs();
      this.#reflectHasValue();
    }
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

  /** Mirror native attributes host → inner control. */
  #syncAttrs(): void {
    const c = this.#control;
    if (!c) return;
    for (const attr of MIRRORED) {
      if (attr === 'value') continue; // value set via the property below
      if (this.hasAttribute(attr)) c.setAttribute(attr, this.getAttribute(attr) ?? '');
      else c.removeAttribute(attr);
    }
    if (this.hasAttribute('value')) c.value = this.getAttribute('value') ?? '';
  }

  /** Toggle [data-has-value] so CSS can show/hide the clear button. */
  #reflectHasValue(): void {
    this.toggleAttribute('data-has-value', !!this.#control?.value);
  }

  /* ── Value property — the form-control surface ─────────────────────── */

  get value(): string {
    return this.#control?.value ?? this.getAttribute('value') ?? '';
  }
  set value(v: string) {
    if (this.#control) this.#control.value = v;
    else this.setAttribute('value', v);
    this.#reflectHasValue();
  }

  /** Native validity, surfaced for form logic. */
  checkValidity(): boolean {
    return this.#control?.checkValidity() ?? true;
  }

  /** Clear the field and emit input + search with an empty value. */
  clear(): void {
    if (this.#control) this.#control.value = '';
    this.#reflectHasValue();
    this.emit('input', { value: '' });
    this.emit('search', { value: '' });
  }

  override focus(): void {
    this.#control?.focus();
  }

  /* ── Internal ──────────────────────────────────────────────────────── */

  #onInput = (): void => {
    this.#reflectHasValue();
    this.emit('input', { value: this.value });
  };
  #onChange = (): void => this.emit('change', { value: this.value });
  #onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Enter') this.emit('search', { value: this.value });
  };
  #onClear = (): void => {
    this.clear();
    this.#control?.focus();
  };
}

customElements.define('sherpa-input-search', SherpaInputSearch);
