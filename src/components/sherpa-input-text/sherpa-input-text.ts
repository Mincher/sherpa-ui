/**
 * sherpa-input-text — a text field with a label.
 *
 * JS copies the label, description, error, icon glyphs, placeholder, and native
 * attributes onto the shadow DOM, exposes the control's `value`, and re-fires
 * the input and change events. The control-row look, icon/actions visibility,
 * and the filled critical validation bar are all handled by CSS; JS just carries
 * the text and value.
 *
 * The `actions` slot (trailing steppers/buttons) needs no JS — SherpaElement
 * auto-sets data-has-actions on the host from slot presence and CSS gates it.
 *
 * @fires input — on each keystroke. detail: { value: string }
 * @fires change — on commit (blur/enter). detail: { value: string }
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
   * THIS ELEMENT IS A FORM CONTROL.
   *
   * Without it the field is invisible to the form around it: its value is left
   * out of FormData, `form.reset()` does not clear it, and `form.checkValidity()`
   * reports nothing about it. The real <input> is inside a shadow root, and a
   * form cannot see through one — that is the gap ElementInternals closes.
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

  /**
   * Template selection: the bare inline field (`minimal`), the auto-growing
   * textarea (`multiline`), or the full molecule (`default`). `minimal` wins —
   * it has no description/message rows, so multiline is moot there.
   */
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
    // VALIDATE ON BLUR, not on every keystroke. Telling someone their email is
    // wrong while they are still typing the @ is nagging; telling them when they
    // leave the field is help. Once a field has ERRED, #onInput re-checks on
    // every keystroke so the message clears the moment it is fixed.
    this.#control?.addEventListener('blur', this.#onBlur);
    this.#syncValue();
  }

  override onChange(name: string): void {
    if (name.startsWith('data-')) this.#syncText();
    else this.#syncAttrs();
  }

  /* ── Form participation ──────────────────────────────────────────── */

  /**
   * Link the control to its own label, description and error for a screen
   * reader.
   *
   * `aria-describedby` is what makes the hint and the error text reach someone
   * who cannot see them beside the box. The ids are per INSTANCE, because two
   * fields on a page would otherwise both claim `#description` and a reader
   * would be told the wrong thing.
   *
   * NOTE what is NOT here: `role="alert"` or `aria-live` on the message.
   * Putting either on the element `aria-describedby` points at causes
   * DOUBLE-SPEAK in JAWS and NVDA — the live region fires, then the description
   * fires again on focus — and has been seen to make VoiceOver drop the
   * association entirely. A live region belongs on a form-level summary, once,
   * on a failed submit.
   */
  #syncIds(): void {
    const control = this.#control;
    if (!control) return;
    const uid = `sherpa-field-${++SherpaInputText.#uid}`;
    const desc = this.$('.description');
    const message = this.$('.message');
    if (desc) desc.id = `${uid}-description`;
    if (message) message.id = `${uid}-message`;
    // Both, in reading order: the hint explains the field, the error says what
    // went wrong with it. An empty one is harmless — a describedby pointing at
    // empty text announces nothing.
    control.setAttribute('aria-describedby', `${uid}-description ${uid}-message`);
  }

  static #uid = 0;

  /**
   * Tell the FORM what this field holds and whether it is acceptable.
   *
   * Two separate things, both through ElementInternals:
   *  - `setFormValue` puts the value into FormData under the host's `name`.
   *  - `setValidity` is what `form.checkValidity()` and a submit both read.
   *
   * The ANCHOR (third argument) is the inner control, so the browser scrolls to
   * and focuses the real box when a submit is blocked — without it the focus
   * lands on the host and the caret is nowhere.
   */
  #syncValue(): void {
    const control = this.#control;
    if (!control) return;
    this.#internals.setFormValue(control.value);

    const message = this.dataset['error'] ?? '';
    if (message) {
      // `customError`, because this message came from OUR rules. The native
      // flags (valueMissing, patternMismatch) describe the browser's own checks,
      // and claiming one of those would misreport why it failed.
      this.#internals.setValidity({ customError: true }, message, control);
      return;
    }
    // No message of ours — defer to the control's OWN native validity, which is
    // already doing `required`, `pattern`, `minlength` and the rest for free.
    if (!control.validity.valid) {
      this.#internals.setValidity(control.validity, control.validationMessage, control);
      return;
    }
    this.#internals.setValidity({});
  }

  /* ── Validation ──────────────────────────────────────────────────── */

  /**
   * Check this field and show the result.
   *
   * Runs the NATIVE constraints first — `required`, `pattern`, `minlength` are
   * mirrored onto the real control and the browser already checks them — then
   * `data-rules`, which is where a rule the platform has no idea about goes.
   *
   * Returns true when the field is acceptable, so a caller can gate a submit on
   * it without reading the DOM.
   */
  async validate(): Promise<boolean> {
    const control = this.#control;
    if (!control) return true;

    // NATIVE FIRST. It is free, it is localised by the browser, and a field with
    // `required` should say the browser's own "Please fill in this field" rather
    // than a second wording of our own.
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

  /**
   * The rule sets a host has registered by name.
   *
   * `data-rules` names one rather than carrying it: an attribute is a string,
   * and a rule is a function. Naming keeps the markup declarative while the
   * rules stay real code — and two fields checking the same thing share one
   * definition rather than two copies that can drift.
   *
   *   SherpaInputText.defineRules('email', [required(), email()]);
   *   <sherpa-input-text data-rules="email">
   */
  static #ruleSets = new Map<string, FieldRules>();

  static defineRules(name: string, ruleSet: FieldRules): void {
    SherpaInputText.#ruleSets.set(name, ruleSet);
  }

  static async #runNamed(name: string, value: unknown): Promise<string | undefined> {
    const ruleSet = SherpaInputText.#ruleSets.get(name);
    // An unknown name is NOT an error. A field naming a rule set the app has not
    // registered yet (script order, a lazy view) should stay usable rather than
    // refusing every value — the store's own guard is the line that must hold.
    if (!ruleSet) return undefined;
    return validateField(ruleSet, value);
  }

  /** Write the message and let CSS paint the state. */
  #setError(message: string): void {
    if (message) this.dataset['error'] = message;
    else delete this.dataset['error'];
    // aria-invalid is the OTHER half of the announcement: describedby says what
    // is wrong, this says THAT something is.
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

  /**
   * The browser restoring a value — a back-button navigation, or a session
   * restore. It hands back exactly what setFormValue stored.
   */
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
    // Icons — a Font Awesome CLASS LIST or a raw glyph character.
    this.#syncIcon('.icon-start', this.dataset['iconStart']);
    this.#syncIcon('.icon-end', this.dataset['iconEnd']);
  }

  /**
   * Put one icon on the field.
   *
   * Accepts either form, matching sherpa-button: a Font Awesome class list
   * ("fa-solid fa-magnifying-glass") or a raw character ("+"). Only the
   * character path can go through `data-glyph`, whose CSS is
   * `content: attr(data-glyph)` — handed a class list it printed the class list
   * as text, which is exactly what a menu's search field showed.
   *
   * The two components took different forms until now, which is a trap for
   * anyone composing one into the other: the same attribute name meant two
   * different things.
   *
   * NOT `SherpaElement.writeIcon`, deliberately. `writeIcon`'s glyph sink is
   * `textContent`; this component's is the `data-glyph` attribute, because its
   * CSS draws the character with `content: attr(data-glyph)` (see the
   * `.icon[data-glyph]::before` rule). Migrating would empty that attribute and
   * the raw-character icons would vanish.
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
    // The FORM's copy of the value follows every keystroke, so a submit mid-typing
    // sends what is on screen rather than what was there at the last blur.
    this.#syncValue();
    // RE-CHECK ONLY ONCE IT HAS ERRED. Validating from the first keystroke tells
    // someone their email is wrong while they are still typing the @; once a
    // message is already showing, the opposite is true — it should disappear the
    // moment they fix it rather than linger until they leave the field.
    if (this.dataset['error']) void this.validate();
    this.emit('input', { value: this.value });
  };

  #onChange = (): void => {
    this.#syncValue();
    this.emit('change', { value: this.value });
  };
}

customElements.define('sherpa-input-text', SherpaInputText);
