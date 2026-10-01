/**
 * sherpa-input-text — a text field with a label.
 *
 * JS carries text and value; CSS owns the look and all visibility.
 *
 * Map:
 * - InputOption — One choice in a `data-type="select"` field.
 */
import { SherpaElement } from '../../core/ui/sherpa-element.js';
import { renderIcon, hasIcon } from '../../core/ui/render-icon.js';
import { validateField, type FieldRules } from '../../core/data/validate.js';
import { FormValue } from '../../core/ui/form-value.js';
// The number type's steppers. Defined before the template stamps them.
import '../sherpa-button/sherpa-button.js';
// A Find's replace menu, and the question Replace all asks.
import '../sherpa-menu/sherpa-menu.js';
import '../sherpa-dialog/sherpa-dialog.js';
import '../sherpa-container-footer/sherpa-container-footer.js';

/** Mirrored verbatim from the host onto the inner control. */
const MIRRORED = [
  'placeholder',
  'name',
  // `email`, `url`, `number`: the platform's own check. A select or textarea ignores it.
  'type',
  'value',
  'required',
  'disabled',
  'readonly',
  'minlength',
  'maxlength',
  'pattern',
  'inputmode',
  'autocomplete',
  // A number's bounds and step.
  'min',
  'max',
  'step',
] as const;

/** What an empty number field says. Will, 2026-09-30. */
const NUMBER_PLACEHOLDER = 'Enter a value';
/** What an empty Find says. */
const FIND_PLACEHOLDER = 'Find';

/** The composed pieces a Find reaches for. */
type Popover = HTMLElement & { open?: boolean; show(trigger?: HTMLElement): void; hide(): void };

type Control = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

/** One choice in a `data-type="select"` field. */
export interface InputOption { value: string; label?: string; disabled?: boolean; title?: string }

export class SherpaInputText extends SherpaElement {
  static override css = new URL('./sherpa-input-text.css', import.meta.url);
  static override html = new URL('./sherpa-input-text.html', import.meta.url);

  /* DECLARED: CSS-only, so the base class writes nothing. A `:host([data-x])`
     rule is a public API and belongs in one place. */
  static override props = {
    'data-borderless': { type: 'boolean', kind: 'style' },
    /* A typed field shows Clear by itself while it holds something. This
       opts a TEXT AREA or a SELECT in; `data-no-clear` opts any field out. */
    'data-clearable': { type: 'boolean', kind: 'style' },
    'data-no-clear': { type: 'boolean', kind: 'style' },
    /* Written BY the field: there is something to clear. */
    'data-has-value': { type: 'boolean', kind: 'style' },
    /* Which control the field draws. `select` is one of a known set — the
       platform's own element, not a re-implemented listbox. */
    'data-type': { type: 'enum', kind: 'style', values: ['minimal', 'select', 'number', 'find'] },
    /* A Find offers Find & Replace. TRAP T-a-find-asks-its-host-to-step */
    'data-replace': { type: 'boolean', kind: 'style' },
    /* The VALIDATION state a host reports, styled by the token region. */
    'data-state': { type: 'enum', kind: 'style', values: ['error', 'success', 'warning'] },
    'data-label': { type: 'string', kind: 'content', to: '.label' },
    'data-description': { type: 'string', kind: 'content', to: '.description' },
    'data-error': { type: 'string', kind: 'content', to: '.message' },
  } as const;

  /** A form cannot see an <input> through a shadow root. TRAP T-shadow-input-needs-element-internals */
  static readonly formAssociated = true;

  // A host label names this. TRAP T-a-host-label-must-reach-its-control
  static override labelTarget = '.control';
  static override observed = [
    'data-icon-start',
    'data-icon-end',
    'data-rules',
    // How many matches a Find's host found: none, and there is nothing to step to.
    'data-matches',
    ...MIRRORED,
  ];

  #control: Control | null = null;
  /** Its link to its form. */
  #form = new FormValue(this);

  /** Both pick the tree, so a change to either must re-stamp. */
  static override variantAttrs = ['data-type', 'data-multiline'];

  /** `minimal` wins: it has no message rows, so multiline is moot there. */
  protected override get templateId(): string | null {
    const type = this.dataset['type'];
    if (type === 'minimal') return 'minimal';
    if (type === 'select') return 'select';
    if (type === 'number') return 'number';
    if (type === 'find') return 'find';
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
    // A select filled LATE has a value now. TRAP T-a-form-value-follows-every-write
    this.#syncValue();
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

  /** A stepper: the platform's own step, reported as a keystroke would be.
   *  TRAP T-a-number-input-wears-sherpas-steppers */
  #onStep = (event: Event): void => {
    const control = this.#control;
    const by = Number((event.target as HTMLElement).closest<HTMLElement>('.step')?.dataset['step']);
    if (!(control instanceof HTMLInputElement) || !by || control.disabled || control.readOnly) return;
    const was = control.value;
    if (by > 0) control.stepUp();
    else control.stepDown();
    // At a bound nothing moved, so nothing is reported.
    if (control.value === was) return;
    control.dispatchEvent(new Event('input', { bubbles: true }));
    control.dispatchEvent(new Event('change', { bubbles: true }));
  };

  /** JS writes the flag; CSS owns the Clear button's reveal. */
  #syncHasValue(): void {
    this.toggleAttribute('data-has-value', (this.#control?.value ?? '') !== '');
    this.#syncSteps();
    this.#syncFind();
  }

  /* ── FIND ── Will, TODO 136. The field cannot see what it searches, so it
     ASKS: Previous and Next are `find-step`, Replace is `find-replace`, and
     the host moves the match. TRAP T-a-find-asks-its-host-to-step */

  /** A Find's steppers, keys and replace menu. */
  #wireFind(): void {
    if (this.dataset['type'] !== 'find') return;
    this.$('.steppers')?.addEventListener('button-click', this.#onFindStep);
    this.#control?.addEventListener('keydown', this.#onFindKey);
    this.$('.find-replace')?.addEventListener('button-click', this.#onReplaceToggle);
    const menu = this.$('.replace-menu');
    menu?.addEventListener('button-click', this.#onReplaceAction);
    menu?.addEventListener('menu-select', this.#onReplaceMore);
    for (const type of ['menu-open', 'menu-close']) menu?.addEventListener(type, this.#onReplaceOpen);
    // The REPLACEMENT is the menu's, never this field's value.
    for (const type of ['input', 'change']) {
      this.$('.replace-with')?.addEventListener(type, (event) => event.stopPropagation());
    }
    this.$('.replace-cancel')?.addEventListener('button-click', () => this.$<Popover>('.replace-confirm')?.hide());
    this.$('.replace-all')?.addEventListener('button-click', this.#onReplaceAll);
  }

  /** Nothing to find, or nothing found: nothing to step to or replace. */
  #syncFind(): void {
    if (this.dataset['type'] !== 'find') return;
    const none = !this.value.trim() || this.dataset['matches'] === '0';
    for (const el of this.$$<HTMLElement>('.find-step, .replace-one, .replace-more')) el.toggleAttribute('disabled', none);
  }

  /** Previous or Next, from a stepper or the menu's footer. */
  #onFindStep = (event: Event): void => {
    const by = Number((event.target as HTMLElement).closest<HTMLElement>('.find-step')?.dataset['step']);
    if (by) this.#findStep(by);
  };

  /** Enter is Next and Shift+Enter Previous, as a browser's own find. */
  #onFindKey = (event: Event): void => {
    const { key, shiftKey } = event as KeyboardEvent;
    if (key !== 'Enter') return;
    event.preventDefault();
    this.#findStep(shiftKey ? -1 : 1);
  };

  /** ASK the host to move to the next or previous match. */
  #findStep(direction: number): void {
    if (!this.value.trim() || this.dataset['matches'] === '0') return;
    this.emit('find-step', { direction: direction > 0 ? 1 : -1, value: this.value });
  }

  /** The pencil opens the replace menu, and shuts it. */
  #onReplaceToggle = (): void => {
    const menu = this.$<Popover>('.replace-menu');
    const button = this.$<HTMLElement>('.find-replace');
    if (!menu || !button) return;
    if (menu.open) menu.hide();
    else menu.show(button);
  };

  /** Say to assistive tech whether the menu is open. */
  #onReplaceOpen = (event: Event): void => {
    this.$('.find-replace')?.setAttribute('aria-expanded', String(event.type === 'menu-open'));
  };

  /** Replace, Previous or Next, in the menu. */
  #onReplaceAction = (event: Event): void => {
    const target = event.target as HTMLElement;
    if (target.closest('.find-step')) return this.#onFindStep(event);
    if (target.closest('.replace-one')) this.#replace(false);
  };

  /** The split button's menu: Replace all asks first. */
  #onReplaceMore = (event: Event): void => {
    if ((event as CustomEvent).detail?.value !== 'replace-all') return;
    event.stopPropagation();
    const text = this.$('.replace-confirm-text');
    if (text) text.textContent = `Every match of “${this.value}” becomes “${this.#replacement()}”.`;
    this.$<Popover>('.replace-confirm')?.show();
  };

  /** Replace all, confirmed. */
  #onReplaceAll = (): void => {
    this.$<Popover>('.replace-confirm')?.hide();
    this.#replace(true);
  };

  /** What the replace menu's field holds. */
  #replacement(): string {
    return (this.$('.replace-with') as HTMLElement & { value?: string } | null)?.value ?? '';
  }

  /** ASK the host to replace the match in focus, or every one. */
  #replace(all: boolean): void {
    if (!this.value.trim() || this.dataset['matches'] === '0') return;
    this.emit('find-replace', { value: this.value, replacement: this.#replacement(), all });
  }

  /** A stepper with NOWHERE TO GO is inactive: Increase at `max`, Decrease at
   *  `min`, and both while the field is disabled or read-only. An empty field
   *  can step either way. Will, 2026-09-30. */
  #syncSteps(): void {
    const control = this.#control;
    if (!(control instanceof HTMLInputElement) || this.dataset['type'] !== 'number') return;
    const off = control.disabled || control.readOnly;
    const value = control.value === '' ? NaN : Number(control.value);
    const past = (bound: string, by: number): boolean => bound !== '' && Number.isFinite(value) && (value - Number(bound)) * by >= 0;
    for (const step of this.$$<HTMLElement>('.step')) {
      const by = Number(step.dataset['step']);
      step.toggleAttribute('disabled', off || past(by > 0 ? control.max : control.min, by));
    }
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
        // Listed, greyed and refused — with why, on hover. TRAP T-an-and-row-offers-what-the-rows-before-it-leave
        el.disabled = !!option.disabled;
        if (option.title) el.title = option.title;
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
    this.#syncIcons();
    this.#syncAttrs();
    this.$('.clear')?.addEventListener('click', this.#onClear);
    // `button-click`, not `click` — a disabled sherpa-button still gets raw clicks.
    this.$('.steppers')?.addEventListener('button-click', this.#onStep);
    this.#wireFind();
    this.#syncHasValue();
    this.#control?.addEventListener('input', this.#onInput);
    this.#control?.addEventListener('change', this.#onChange);
    // Blur, not per keystroke — TRAP T-validate-on-blur-then-every-keystroke.
    this.#control?.addEventListener('blur', this.#onBlur);
    this.#syncValue();
  }

  override onChange(name: string): void {
    if (name === 'data-matches') this.#syncFind();
    if (!name.startsWith('data-')) {
      this.#syncAttrs();
      // `required`, `value`, a pattern: each moves what the form sees.
      this.#syncValue();
    } else if (name.startsWith('data-icon-')) this.#syncIcons();
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

  /** Tell the form what this field holds and whether it is acceptable — after
   *  EVERY write, or the form reads a stale answer.
   *  TRAP T-a-form-value-follows-every-write */
  #syncValue(): void {
    const control = this.#control;
    if (!control) return;
    this.#form.value(control.value);
    const message = this.dataset['error'] ?? '';
    // Our message wins; without one, the control's own validity.
    if (message) this.#form.validity({ customError: true }, message, control);
    else this.#form.follow(control);
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
    this.#syncHasValue();
    this.#setError('');
  }

  /** Back-button or session restore — what setFormValue stored. */
  formStateRestoreCallback(state: string): void {
    if (this.#control) this.#control.value = state;
    this.#syncHasValue();
    this.#syncValue();
  }

  /** The two icons; the label, description and error are declared props. */
  #syncIcons(): void {
    // A Find's glyph is the search one, unless the host names another.
    this.#syncIcon('.icon-start', this.dataset['iconStart']
      ?? (this.dataset['type'] === 'find' ? 'magnifying-glass' : undefined));
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
    /* A NUMBER keeps what the mirror would take away: its type, and words for
       an empty box. TRAP T-a-number-input-wears-sherpas-steppers */
    if (this.dataset['type'] === 'number') {
      c.setAttribute('type', 'number');
      if (!this.hasAttribute('inputmode')) c.setAttribute('inputmode', 'decimal');
      if (!this.hasAttribute('placeholder')) c.setAttribute('placeholder', NUMBER_PLACEHOLDER);
    }
    // A Find says what it is for; its type is the template's.
    if (this.dataset['type'] === 'find') {
      c.setAttribute('type', 'text');
      if (!this.hasAttribute('placeholder')) c.setAttribute('placeholder', FIND_PLACEHOLDER);
    }
    if (this.hasAttribute('value')) c.value = this.getAttribute('value') ?? '';
    // `min`, `max`, `disabled` or the value moved: so may what a stepper can do.
    this.#syncSteps();
  }

  get value(): string {
    return this.#control?.value ?? this.getAttribute('value') ?? '';
  }
  set value(v: string) {
    if (this.#control) this.#control.value = v;
    else this.setAttribute('value', v);
    // A JS write fires no `input`, so the Clear flag and the form are told here.
    this.#syncHasValue();
    this.#syncValue();
  }

  get disabled(): boolean {
    return this.hasAttribute('disabled');
  }
  set disabled(value: boolean) {
    this.toggleAttribute('disabled', value);
  }

  /** Acceptable, as its form sees it — its own message included. */
  checkValidity(): boolean {
    this.#syncValue();
    return this.#form.checkValidity();
  }

  /** Check, and show the browser's message on the field. */
  reportValidity(): boolean {
    this.#syncValue();
    return this.#form.reportValidity();
  }

  override focus(options?: FocusOptions): void {
    this.#control?.focus(options);
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
