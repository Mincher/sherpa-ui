/**
 * sherpa-input-text — a text field with a label.
 *
 * JS carries text and value; CSS owns the look and all visibility.
 */
import { SherpaElement } from '../../core/sherpa-element.js';
import { validateField, type FieldRules } from '../../core/validate.js';

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
  static override html = new URL('./sherpa-input-text.html', import.meta.url);

  /**
   * A form cannot see an <input> through a shadow root — without this the field
   * is invisible to it. TRAP T-shadow-input-needs-element-internals
   */
  static readonly formAssociated = true;

  static override observed = [
    'data-label',
    'data-description',
    'data-error',
    'data-icon-start',
    'data-icon-end',
    'data-rules',
    ...MIRRORED,
  ];

  #control: Control | null = null;
  #internals: ElementInternals;

  constructor() {
    super();
    this.#internals = this.attachInternals();
  }

  /** Both attributes pick the tree, so a change to either has to re-stamp. */
  static override variantAttrs = ['data-type', 'data-multiline'];

  /** `minimal` wins: it has no message rows, so multiline is moot there. */
  protected override get templateId(): string | null {
    if (this.dataset['type'] === 'minimal') return 'minimal';
    return this.hasAttribute('data-multiline') ? 'multiline' : 'default';
  }

  override onRender(): void {
    this.#control = this.$<Control>('.control');
    this.#syncIds();
    this.#syncText();
    this.#syncAttrs();
    this.#control?.addEventListener('input', this.#onInput);
    this.#control?.addEventListener('change', this.#onChange);
    // Validate on blur, not per keystroke — TRAP T-validate-on-blur-then-every-keystroke.
    this.#control?.addEventListener('blur', this.#onBlur);
    this.#syncValue();
  }

  override onChange(name: string): void {
    if (name.startsWith('data-')) this.#syncText();
    else this.#syncAttrs();
  }

  /* ── Form participation ──────────────────────────────────────────── */

  /**
   * Link the control to its label, description and error for a screen reader.
   *
   * No `role="alert"` / `aria-live` on the message this points at —
   * TRAP T-describedby-must-not-be-a-live-region.
   */
  #syncIds(): void {
    const control = this.#control;
    if (!control) return;
    const uid = `sherpa-field-${++SherpaInputText.#uid}`;
    const desc = this.$('.description');
    const message = this.$('.message');
    if (desc) desc.id = `${uid}-description`;
    if (message) message.id = `${uid}-message`;
    // Both, in reading order.
    control.setAttribute('aria-describedby', `${uid}-description ${uid}-message`);
  }

  static #uid = 0;

  /** Tell the form what this field holds and whether it is acceptable. */
  #syncValue(): void {
    const control = this.#control;
    if (!control) return;
    this.#internals.setFormValue(control.value);

    const message = this.dataset['error'] ?? '';
    if (message) {
      this.#internals.setValidity({ customError: true }, message, control);
      return;
    }
    // No message of ours — defer to the control's OWN native validity.
    if (!control.validity.valid) {
      this.#internals.setValidity(control.validity, control.validationMessage, control);
      return;
    }
    this.#internals.setValidity({});
  }

  /* ── Validation ──────────────────────────────────────────────────── */

  /**
   * Check this field and show the result. Native constraints first, then
   * `data-rules`. True means acceptable, so a caller can gate a submit on it.
   */
  async validate(): Promise<boolean> {
    const control = this.#control;
    if (!control) return true;

    if (!control.validity.valid) {
      this.#setError(control.validationMessage);
      return false;
    }

    const named = this.dataset['rules'];
    if (named) {
      const message = await SherpaInputText.#runNamed(named, control.value);
      this.#setError(message ?? '');
      return !message;
    }

    this.#setError('');
    return true;
  }

  /** The rule sets a host has registered by name. */
  static #ruleSets = new Map<string, FieldRules>();

  static defineRules(name: string, ruleSet: FieldRules): void {
    SherpaInputText.#ruleSets.set(name, ruleSet);
  }

  static async #runNamed(name: string, value: unknown): Promise<string | undefined> {
    const ruleSet = SherpaInputText.#ruleSets.get(name);
    // An unknown name is NOT an error — TRAP T-rules-are-named-not-carried.
    if (!ruleSet) return undefined;
    return validateField(ruleSet, value);
  }

  /** Write the message and let CSS paint the state. */
  #setError(message: string): void {
    if (message) this.dataset['error'] = message;
    else delete this.dataset['error'];
    // The other half of the announcement.
    this.#control?.setAttribute('aria-invalid', message ? 'true' : 'false');
    this.#syncValue();
  }

  #onBlur = (): void => {
    void this.validate();
  };

  /* ── Form lifecycle (called by the browser) ──────────────────────── */

  /** `form.reset()` — put the value back and clear any message. */
  formResetCallback(): void {
    if (this.#control) this.#control.value = this.getAttribute('value') ?? '';
    this.#setError('');
  }

  /** A back-button or session restore — exactly what setFormValue stored. */
  formStateRestoreCallback(state: string): void {
    if (this.#control) this.#control.value = state;
    this.#syncValue();
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
    this.#syncIcon('.icon-start', this.dataset['iconStart']);
    this.#syncIcon('.icon-end', this.dataset['iconEnd']);
  }

  /**
   * Put one icon on the field: a Font Awesome class list or a raw character.
   * NOT `SherpaElement.writeIcon` — TRAP T-input-icon-sink-is-data-glyph.
   */
  #syncIcon(sel: string, value: string | undefined): void {
    const el = this.$(sel);
    if (!el) return;
    const base = sel === '.icon-start' ? 'icon icon-start' : 'icon icon-end';
    if (value && /\bfa-/.test(value)) {
      el.className = `${base} ${value}`;
      el.removeAttribute('data-glyph');
    } else {
      el.className = base;
      el.setAttribute('data-glyph', value ?? '');
    }
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

  #onInput = (): void => {
    // The form's copy follows every keystroke; the CHECK only once it has erred.
    this.#syncValue();
    if (this.dataset['error']) void this.validate();
    this.emit('input', { value: this.value });
  };

  #onChange = (): void => {
    this.#syncValue();
    this.emit('change', { value: this.value });
  };
}

customElements.define('sherpa-input-text', SherpaInputText);
