/**
 * sherpa-input-password — a labelled password field with a show/hide toggle.
 *
 * A thin variation of sherpa-input-text: same label / description / message
 * chrome and value API. The toggle button flips the inner input between
 * `password` and `text`, keeping its own aria-pressed + aria-label in sync (CSS
 * swaps the eye glyph off aria-pressed). Validation LOOK is pure CSS
 * (:user-invalid); JS only carries values and the visibility state.
 *
 * @fires input  detail: { value: string }
 * @fires change detail: { value: string }
 */
import { SherpaElement } from '../../core/sherpa-element.js';

/** Native attributes mirrored verbatim from the host onto the inner control. */
const MIRRORED = [
  'placeholder',
  'name',
  'value',
  'required',
  'disabled',
  'readonly',
  'minlength',
  'maxlength',
  'autocomplete',
] as const;

export class SherpaInputPassword extends SherpaElement {
  static override css = new URL('./sherpa-input-password.css', import.meta.url);
  static override html = new URL('./sherpa-input-password.html', import.meta.url);
  static override observed = ['data-label', 'data-description', 'data-error', ...MIRRORED];

  #control: HTMLInputElement | null = null;
  #toggle: HTMLButtonElement | null = null;
  #visible = false;

  override onRender(): void {
    this.#control = this.$<HTMLInputElement>('.control');
    this.#toggle = this.$<HTMLButtonElement>('.toggle');
    this.#syncText();
    this.#syncAttrs();
    this.#control?.addEventListener('input', this.#onInput);
    this.#control?.addEventListener('change', this.#onChange);
    this.#toggle?.addEventListener('click', this.#onToggle);
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

  /** Mirror native attributes host → inner control (visibility owns `type`). */
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

  /* ── Value property — the form-control surface ─────────────────────── */

  get value(): string {
    return this.#control?.value ?? this.getAttribute('value') ?? '';
  }
  set value(v: string) {
    if (this.#control) this.#control.value = v;
    else this.setAttribute('value', v);
  }

  /** Whether the password is currently shown in plain text. */
  get visible(): boolean {
    return this.#visible;
  }
  set visible(v: boolean) {
    this.#visible = !!v;
    this.#applyVisibility();
  }

  /** Native validity, surfaced for form logic. */
  checkValidity(): boolean {
    return this.#control?.checkValidity() ?? true;
  }

  override focus(): void {
    this.#control?.focus();
  }

  /* ── Internal ──────────────────────────────────────────────────────── */

  #applyVisibility(): void {
    if (this.#control) this.#control.type = this.#visible ? 'text' : 'password';
    if (this.#toggle) {
      this.#toggle.setAttribute('aria-pressed', String(this.#visible));
      this.#toggle.setAttribute('aria-label', this.#visible ? 'Hide password' : 'Show password');
    }
  }

  #onToggle = (): void => {
    this.#visible = !this.#visible;
    this.#applyVisibility();
  };
  #onInput = (): void => this.emit('input', { value: this.value });
  #onChange = (): void => this.emit('change', { value: this.value });
}

customElements.define('sherpa-input-password', SherpaInputPassword);
