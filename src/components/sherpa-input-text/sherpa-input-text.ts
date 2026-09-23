/**
 * sherpa-input-text — a text field with a label.
 *
 * JS carries text and value; CSS owns the look and all visibility.
 */
import { SherpaElement } from '../../core/ui/sherpa-element.js';
import { renderIcon, hasIcon } from '../../core/ui/render-icon.js';
import { validateField, type FieldRules } from '../../core/data/validate.js';

/** Mirrored verbatim from the host onto the inner control. */
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

type Control = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

/** One choice in a `data-type="select"` field. */
export interface InputOption { value: string; label?: string }

export class SherpaInputText extends SherpaElement {
  static override css = new URL('./sherpa-input-text.css', import.meta.url);
  static override html = new URL('./sherpa-input-text.html', import.meta.url);

  /* DECLARED: CSS-only, so the base class writes nothing. A `:host([data-x])`
     rule is a public API and belongs in one place. */
  static override props = {
    'data-borderless': { type: 'boolean', kind: 'style' },
    /* Offer a Clear button at the field's trailing edge. OPT-IN: a required
       field, or one a host owns, must not offer to empty itself. */
    'data-clearable': { type: 'boolean', kind: 'style' },
    /* Written BY the field: there is something to clear. */
    'data-has-value': { type: 'boolean', kind: 'style' },
    /* Which control the field draws. `select` is one of a known set — the
       platform's own element, not a re-implemented listbox. */
    'data-type': { type: 'enum', kind: 'style', values: ['minimal', 'select'] },
    /* The VALIDATION state a host reports, styled by the token region. */
    'data-state': { type: 'enum', kind: 'style', values: ['error', 'success', 'warning'] },
  } as const;

  /** A form cannot see an <input> through a shadow root. TRAP T-shadow-input-needs-element-internals */
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

  /** Both pick the tree, so a change to either must re-stamp. */
  static override variantAttrs = ['data-type', 'data-multiline'];

  /** `minimal` wins: it has no message rows, so multiline is moot there. */
  protected override get templateId(): string | null {
    const type = this.dataset['type'];
    if (type === 'minimal') return 'minimal';
    if (type === 'select') return 'select';
    return this.hasAttribute('data-multiline') ? 'multiline' : 'default';
  }

  /**
   * populate([{ value, label }]) — the choices a SELECT field offers.
   *
   * Kept, so a variant re-stamp can put them back: `data-type` replaces the
   * whole tree and the <option>s with it.
   * TRAP T-variant-attrs-or-one-way-door
   */
  protected override renderData(data: unknown): void {
    this.#options = Array.isArray(data) ? (data as InputOption[]) : [];
    this.#syncOptions();
  }

  #options: InputOption[] = [];

  /** Empty the field and report it, as a keystroke would. */
  #onClear = (): void => {
    if (!this.#control || this.#control.value === '') return;
    this.#control.value = '';
    this.#syncHasValue();
    this.#control.dispatchEvent(new Event('input', { bubbles: true }));
    this.#control.dispatchEvent(new Event('change', { bubbles: true }));
    this.#control.focus();
  };

  /** JS writes the flag; CSS owns the Clear button's reveal. */
  #syncHasValue(): void {
    this.toggleAttribute('data-has-value', (this.#control?.value ?? '') !== '');
  }

  /** Write the choices into a select control, keeping the current value. */
  #syncOptions(): void {
    const select = this.#control;
    if (!(select instanceof HTMLSelectElement)) return;
    const wanted = this.getAttribute('value') ?? select.value;
    select.replaceChildren(
      ...this.#options.map((option) => {
        const el = document.createElement('option');
        el.value = option.value;
        el.textContent = option.label ?? option.value;
        return el;
      }),
    );
    if (wanted && this.#options.some((o) => o.value === wanted)) select.value = wanted;
  }

  override onRender(): void {
    this.#control = this.$<Control>('.control');
    // A re-stamp lost the <option>s; the kept list puts them back.
    this.#syncOptions();
    this.#syncIds();
    this.#syncText();
    this.#syncAttrs();
    this.$('.clear')?.addEventListener('click', this.#onClear);
    this.#syncHasValue();
    this.#control?.addEventListener('input', this.#onInput);
    this.#control?.addEventListener('change', this.#onChange);
    // Blur, not per keystroke — TRAP T-validate-on-blur-then-every-keystroke.
    this.#control?.addEventListener('blur', this.#onBlur);
    this.#syncValue();
  }

  override onChange(name: string): void {
    if (name.startsWith('data-')) this.#syncText();
    else this.#syncAttrs();
  }

  /**
   * Link the control to its description and error for a screen reader.
   *
   * No `role="alert"` / `aria-live` on the message — TRAP T-describedby-must-not-be-a-live-region.
   */
  #syncIds(): void {
    const control = this.#control;
    if (!control) return;
    const uid = `sherpa-field-${++SherpaInputText.#uid}`;
    const desc = this.$('.description');
    const message = this.$('.message');
    if (desc) desc.id = `${uid}-description`;
    if (message) message.id = `${uid}-message`;
    // Both ids, in reading order.
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
    // No message of ours — defer to the control's own native validity.
    if (!control.validity.valid) {
      this.#internals.setValidity(control.validity, control.validationMessage, control);
      return;
    }
    this.#internals.setValidity({});
  }

  /** Check this field and show the result. True means acceptable. */
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

  /** Write the message; CSS paints the state. */
  #setError(message: string): void {
    if (message) this.dataset['error'] = message;
    else delete this.dataset['error'];
    this.#control?.setAttribute('aria-invalid', message ? 'true' : 'false');
    this.#syncValue();
  }

  #onBlur = (): void => {
    void this.validate();
  };

  /* Form lifecycle — called by the browser. */

  formResetCallback(): void {
    if (this.#control) this.#control.value = this.getAttribute('value') ?? '';
    this.#setError('');
  }

  /** Back-button or session restore — what setFormValue stored. */
  formStateRestoreCallback(state: string): void {
    if (this.#control) this.#control.value = state;
    this.#syncValue();
  }

  /** Text into the shadow; CSS collapses the empties. */
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

  /** One icon: an icon name, or a raw character via `data-glyph`.
   *  NOT `SherpaElement.writeIcon` — TRAP T-input-icon-sink-is-data-glyph. */
  #syncIcon(sel: string, value: string | undefined): void {
    const el = this.$(sel);
    if (!el) return;
    // TRAP T-icon-box-is-not-the-glyph — rewriting className erases the shared
    // box class, so it is restated here; and a NAME must be drawn, never left
    // as classes, which paint nothing now the icons are SVG.
    const side = sel === '.icon-start' ? 'icon-start' : 'icon-end';
    el.className = `icon sherpa-icon-box ${side}`;
    el.replaceChildren();
    if (value && hasIcon(value)) {
      el.removeAttribute('data-glyph');
      renderIcon(el, value);
    } else {
      // The raw-character sink stays the `data-glyph` ATTRIBUTE, because the
      // CSS draws it with `content: attr(data-glyph)`.
      el.setAttribute('data-glyph', value ?? '');
    }
  }

  /** Mirror the native attributes onto the inner control. */
  #syncAttrs(): void {
    const c = this.#control;
    if (!c) return;
    // The shared loop; `value` is a property, set below.
    // TRAP T-mirroring-skips-value
    this.mirrorAttrs(c, MIRRORED);
    if (this.hasAttribute('value')) c.value = this.getAttribute('value') ?? '';
  }

  get value(): string {
    return this.#control?.value ?? this.getAttribute('value') ?? '';
  }
  set value(v: string) {
    if (this.#control) this.#control.value = v;
    else this.setAttribute('value', v);
    // A JS write fires no `input`, so the Clear flag is set here too.
    this.#syncHasValue();
  }

  checkValidity(): boolean {
    return this.#control?.checkValidity() ?? true;
  }

  override focus(): void {
    this.#control?.focus();
  }

  #onInput = (): void => {
    // The form's copy follows every keystroke; the check only once it has erred.
    this.#syncValue();
    this.#syncHasValue();
    if (this.dataset['error']) void this.validate();
    this.emit('input', { value: this.value });
  };

  #onChange = (): void => {
    this.#syncValue();
    this.emit('change', { value: this.value });
  };
}

customElements.define('sherpa-input-text', SherpaInputText);
