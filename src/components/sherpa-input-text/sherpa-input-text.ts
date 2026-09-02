/**
 * sherpa-input-text — a text field with a label.
 *
 * JS copies the label, description, error, placeholder, and native attributes
 * onto the real input, exposes its `value`, and re-fires the input and change
 * events. The invalid look is handled by CSS; JS just carries the value.
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
  'pattern',
  'inputmode',
  'autocomplete',
] as const;

type Control = HTMLInputElement | HTMLTextAreaElement;

export class SherpaInputText extends SherpaElement {
  static override css = new URL('./sherpa-input-text.css', import.meta.url);
  static override tokens = new URL('./sherpa-input-text.tokens.css', import.meta.url);
  static override html = new URL('./sherpa-input-text.html', import.meta.url);
  static override observed = ['data-label', 'data-description', 'data-error', ...MIRRORED];

  #control: Control | null = null;

  /**
   * Template selection: the bare inline field (`minimal`), the auto-growing
   * textarea (`multiline`), or the full molecule (`default`). `minimal` wins —
   * it has no description/message rows, so multiline is moot there.
   */
  protected override get templateId(): string | null {
    if (this.dataset['style'] === 'minimal') return 'minimal';
    return this.hasAttribute('data-multiline') ? 'multiline' : 'default';
  }

  override onRender(): void {
    this.#control = this.$<Control>('.control');
    this.#syncText();
    this.#syncAttrs();
    this.#control?.addEventListener('input', this.#onInput);
    this.#control?.addEventListener('change', this.#onChange);
  }

  override onChange(name: string): void {
    if (name.startsWith('data-')) this.#syncText();
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

  /** Mirror native attributes host → inner control. */
  #syncAttrs(): void {
    const c = this.#control;
    if (!c) return;
    for (const attr of MIRRORED) {
      if (attr === 'value') continue; // value is set via the property below
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

customElements.define('sherpa-input-text', SherpaInputText);
