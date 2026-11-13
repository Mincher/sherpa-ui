/**
 * sherpa-input-text — a text field with a label.
 *
 * JS carries text and value; CSS owns the look and all visibility.
 *
 * Map:
 * - InputOption — One choice in a `data-type="select"` field.
 */
import { SherpaElement, define } from '../../core/ui/sherpa-element.js';
import { renderIcon, hasIcon } from '../../core/ui/render-icon.js';
import { InputTags, splitTags } from './input-tags.js';
import { InputPicks } from './input-picks.js';
import { validateField, type FieldRules } from '../../core/data/validate.js';
// The number type's steppers. Defined before the template stamps them.
import '../sherpa-button/sherpa-button.js';
// A Find's replace menu, and the question Replace all asks.
import '../sherpa-menu/sherpa-menu.js';
// A tags field's tags.
import '../sherpa-chip/sherpa-chip.js';
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


/** The composed pieces a Find reaches for. */
type Popover = HTMLElement & { open?: boolean; show(trigger?: HTMLElement): void; hide(): void };

type Control = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

/** One choice in a `data-type="select"` field. */
export interface InputOption { value: string; label?: string; disabled?: boolean; title?: string; group?: string }

export class SherpaInputText extends SherpaElement {
  static override css = [
    new URL('../../core/sherpa-text-area.css', import.meta.url),
    new URL('./sherpa-input-text.css', import.meta.url),
  ];
  static override html = new URL('./sherpa-input-text.html', import.meta.url);
  static override delegatesFocus = true;

  /* DECLARED: CSS-only, so the base class writes nothing. A `:host([data-x])`
     rule is a public API and belongs in one place. */
  static override props = {
    'data-borderless': { type: 'boolean', kind: 'style' },
    /* A typed field shows Clear by itself while it holds something. This
       opts a TEXT AREA or a SELECT in; `data-no-clear` opts any field out. */
    'data-clearable': { type: 'boolean', kind: 'style' },
    'data-no-clear': { type: 'boolean', kind: 'style' },
    /* Written BY the field: there is something to clear. */
    /* Which control the field draws. `select` is one of a known set — the
       platform's own element, not a re-implemented listbox. */
    'data-type': { type: 'enum', kind: 'template', values: ['minimal', 'select', 'number', 'find', 'tags', 'color'] },
    'data-multiline': { type: 'boolean', kind: 'template' },
    /* A Find offers Find & Replace. TRAP T-a-find-asks-its-host-to-step */
    'data-replace': { type: 'boolean', kind: 'style' },
    /* The VALIDATION state a host reports, styled by the token region. */
    'data-state': { type: 'enum', kind: 'style', values: ['error', 'success', 'warning'] },
    'data-label': { type: 'string', kind: 'content' },
    'data-description': { type: 'string', kind: 'content' },
    'data-error': { type: 'string', kind: 'content' },
    'data-icon-start': { type: 'string', kind: 'content' },
    'data-icon-end': { type: 'string', kind: 'content' },
    'data-rules': { type: 'string', kind: 'behaviour' },
    // How many matches a Find's host found: none, and there is nothing to step to.
    'data-matches': { type: 'number', kind: 'behaviour' },
    // Written BY a tags field: how many of its tags do not fit, and sit behind the +N.
    'data-overflow': { type: 'number', kind: 'behaviour' },
    // A tags field takes only its `.suggestions`: a stranger is refused, and stays typed.
    'data-closed': { type: 'boolean', kind: 'behaviour' },
  } as const;

  /** A form cannot see an <input> through a shadow root. TRAP T-shadow-input-needs-element-internals */
  static readonly formAssociated = true;

  // A host label names this. TRAP T-a-host-label-must-reach-its-control
  static override labelTarget = '.control';
  static override observed = [
    ...MIRRORED,
    'data-matches',
  ];

  #control: Control | null = null;

  /** A tags field's tags: `value` is their comma string. TRAP T-a-tag-field-counts-what-css-clips */
  readonly #tagger = new InputTags({
    $: (sel) => this.$(sel),
    $$: (sel) => this.$$(sel),
    on: (target, type, handler) => this.on(target, type, handler),
    set: (attr, value) => this.set(attr, value),
    toggleState: (name, on) => this.toggleState(name, on),
    control: () => (this.#control instanceof HTMLInputElement ? this.#control : null),
    closed: () => this.hasAttribute('data-closed'),
    refusal: () => void this.validate(),
    word: (key) => this.word(key),
    readOnly: () => this.hasAttribute('readonly'),
    off: () => this.matches(':disabled'),
    changed: (detail) => {
      this.#syncHasValue();
      this.#syncValue();
      if (this.dataset['error']) void this.validate();
      this.emit('tags-change', detail);
      this.emit('input', { value: this.value });
      this.emit('change', { value: this.value });
    },
  });

  get #isTags(): boolean {
    return this.dataset['type'] === 'tags';
  }

  /** A select that picks several (`multiple`, HTML's own name): its face, and the tags menu of ticks. Never mirrored onto
   *  the native select, which would draw a list box. TRAP T-a-multi-select-is-one-row */
  readonly #picks = new InputPicks({
    $: (sel) => this.$(sel),
    on: (target, type, handler) => this.on(target, type, handler),
    options: () => this.#options,
    option: () => this.clone<HTMLOptionElement>(this.$<HTMLTemplateElement>('template.option-tpl')),
    all: () => this.word('all'),
    readOnly: () => this.hasAttribute('readonly'),
    off: () => this.matches(':disabled'),
    changed: () => {
      this.#syncHasValue();
      this.#syncValue();
      this.emit('input', { value: this.value });
      this.emit('change', { value: this.value });
    },
  });

  get #isPicks(): boolean {
    return this.dataset['type'] === 'select' && this.hasAttribute('multiple');
  }

  /** A select with `multiple`: the values ticked. A write says nothing, as `value` does not. */
  get values(): string[] {
    return this.#picks.values;
  }
  set values(values: readonly string[]) {
    this.#picks.set(values);
    this.#syncHasValue();
    this.#syncValue();
  }

  /** The tags of a `data-type="tags"` field. A write says nothing, as `value` does not. */
  get tags(): string[] {
    return this.#tagger.tags;
  }
  set tags(tags: readonly string[]) {
    this.#tagger.set(tags);
    this.#syncHasValue();
    this.#syncValue();
  }

  /** What a tags field's menu offers beside its tags, `{ value, label }`; with `data-closed`, the only values it takes. */
  get suggestions(): { value: string; label?: string }[] {
    return this.#suggested;
  }
  set suggestions(list: readonly { value: string; label?: string }[]) {
    this.#suggested = [...list];
    this.#tagger.suggest(this.#suggested);
  }
  /** What `.suggestions` was given, as given. */
  #suggested: { value: string; label?: string }[] = [];

  /** A tags field's focus is its text, never a tag. */
  override focus(options?: FocusOptions): void {
    if (this.#isTags && this.#control) this.#control.focus(options);
    else super.focus(options);
  }

  /** Both pick the tree, so a change to either must re-stamp. */
  static override variantAttrs = ['data-type', 'data-multiline'];

  /** `minimal` wins: it has no message rows, so multiline is moot there. */
  protected override get templateId(): string | null {
    const type = this.dataset['type'];
    if (type === 'minimal') return 'minimal';
    if (type === 'select') return 'select';
    if (type === 'number') return 'number';
    if (type === 'color') return 'color';
    if (type === 'find') return 'find';
    if (type === 'tags') return 'tags';
    return this.hasAttribute('data-multiline') ? 'multiline' : 'default';
  }

  /** Its `<option>` children, as a SELECT field's choices. */
  protected override childData(): InputOption[] | undefined {
    const options = [...this.querySelectorAll<HTMLOptionElement>(':scope > option')];
    return options.length
      ? options.map((o) => ({ value: o.value, label: o.textContent?.trim() ?? o.value, ...(o.disabled ? { disabled: true } : {}) }))
      : undefined;
  }

  /**
   * populate([{ value, label, group }]) — the choices a SELECT field offers, a `group`'s in its <optgroup>. Or its `<option>` children
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
  /** A SELECT value asked for before its option arrived: held, reported, then
   *  applied. TRAP T-a-value-before-the-first-render-is-held */
  #held: string | null = null;

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
    const typed = (this.#control?.value ?? '') !== '';
    this.toggleState('has-value', typed || (this.#isTags && this.#tagger.tags.length > 0));
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
    // A pick of several shows ONE option, its picks; its choices are its menu's.
    if (this.#isPicks) return this.#picks.face();
    const wanted = this.#held ?? this.getAttribute('value') ?? select.value;
    this.#held = null;
    const tpl = this.$<HTMLTemplateElement>('template.option-tpl');
    const groupTpl = this.$<HTMLTemplateElement>('template.optgroup-tpl');
    // Options in a `group` stand in its <optgroup>, in the order the groups first come.
    const groups = new Map<string, HTMLOptGroupElement>();
    select.replaceChildren(
      ...this.#options.flatMap((option) => {
        const el = this.clone<HTMLOptionElement>(tpl);
        if (!el) return [];
        el.value = option.value;
        el.textContent = option.label ?? option.value;
        // Listed, greyed and refused — with why, on hover.
        el.disabled = !!option.disabled;
        if (option.title) el.title = option.title;
        if (!option.group) return [el];
        const held = groups.get(option.group);
        if (held) { held.append(el); return []; }
        const group = this.clone<HTMLOptGroupElement>(groupTpl);
        if (!group) return [el];
        group.label = option.group;
        group.append(el);
        groups.set(option.group, group);
        return [group];
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
    // The tags are read before the attributes: `value` is theirs here. Without one, tags a host set before this render stay.
    if (this.#isTags) {
      this.#tagger.set(this.hasAttribute('value') ? splitTags(this.getAttribute('value') ?? '') : this.#tagger.tags);
      // Rendered now: its chips are drawn, whether or not the tags changed (the same tags set again draw nothing).
      this.#tagger.draw();
    }
    this.#syncAttrs();
    this.$('.clear')?.addEventListener('click', this.#onClear);
    // `button-click`, not `click` — a disabled sherpa-button still gets raw clicks.
    this.$('.steppers')?.addEventListener('button-click', this.#onStep);
    this.#wireFind();
    if (this.#isTags) this.#tagger.wire();
    // A pick of several stamps its menu of ticks once, from its prototype.
    if (this.#isPicks && this.stampOnce('template.picks-menu-tpl', true)) this.#picks.wire();
    this.#syncHasValue();
    this.#control?.addEventListener('input', this.#onInput);
    this.#control?.addEventListener('change', this.#onChange);
    this.#control?.addEventListener('keydown', this.#onReadOnlyKey);
    // Blur, not per keystroke — TRAP T-validate-on-blur-then-every-keystroke.
    this.#control?.addEventListener('blur', this.#onBlur);
    this.#syncValue();
  }

  override onChange(name: string): void {
    if (name === 'data-matches') this.#syncFind();
    if (name === 'value' && this.#isTags) this.#tagger.set(splitTags(this.getAttribute('value') ?? ''));
    if (!name.startsWith('data-')) {
      this.#syncAttrs();
      if (this.#isTags) this.#tagger.draw();
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
    this.formLink.value(this.value);
    const message = this.dataset['error'] ?? '';
    // Our message wins; without one, the control's own validity.
    if (message) this.formLink.validity({ customError: true }, message, control);
    else if (this.#noTags) this.formLink.validity({ valueMissing: true }, this.word('required'), control);
    else this.formLink.follow(control);
  }

  /** A required tags field with no tag: its text box is empty by design, so `required` is read here. */
  get #noTags(): boolean {
    return this.#isTags && this.hasAttribute('required') && this.#tagger.tags.length === 0;
  }

  /** Check this field and show the result. True means acceptable. */
  async validate(): Promise<boolean> {
    const control = this.#control;
    if (!control) return true;
    if (this.#noTags) {
      this.#setError(this.word('required'));
      return false;
    }
    const refused = this.#isTags ? this.#tagger.refused : null;
    if (refused !== null) {
      this.#setError(`“${refused}” ${this.word('stranger')}`);
      return false;
    }

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

  /** Write the message; CSS paints the state. A message a HOST wrote is the host's: a pass here leaves it.
   *  TRAP T-a-host-error-is-the-hosts */
  #setError(message: string): void {
    // While the host's shows, this field's own waits behind it.
    const hosts = this.dataset['error'] !== undefined && this.dataset['error'] !== this.#wrote;
    if (!hosts) {
      this.set('data-error', message || null);
      this.#wrote = message || null;
    }
    this.#control?.setAttribute('aria-invalid', message || this.dataset['error'] ? 'true' : 'false');
    this.#syncValue();
  }

  /** The message this field last wrote itself. */
  #wrote: string | null = null;

  #onBlur = (): void => {
    void this.validate();
  };

  /* Form lifecycle — called by the browser. */

  /** Inside a disabled `<fieldset>`, as by its own `disabled`. TRAP T-a-form-control-follows-its-fieldset */
  formDisabledCallback(): void {
    this.#syncAttrs();
  }

  formResetCallback(): void {
    if (this.#isTags) this.#tagger.set(splitTags(this.getAttribute('value') ?? ''));
    if (this.#control) this.#control.value = this.#isTags ? '' : (this.getAttribute('value') ?? '');
    this.#syncHasValue();
    this.#setError('');
  }

  /** Back-button or session restore — what setFormValue stored. */
  formStateRestoreCallback(state: string): void {
    if (this.#isTags) this.#tagger.set(splitTags(state));
    else if (this.#control) this.#control.value = state;
    this.#syncHasValue();
    this.#syncValue();
  }

  /** The two icons; the label, description and error are declared props. */
  #syncIcons(): void {
    this.#syncIcon('.icon-start', this.dataset['iconStart']);
    this.#syncIcon('.icon-end', this.dataset['iconEnd']);
  }

  /** One icon: an icon name, or a raw character via `data-glyph`.
   *  NOT `SherpaElement.writeIcon` — TRAP T-input-icon-sink-is-data-glyph. */
  #syncIcon(sel: string, value: string | undefined): void {
    const el = this.$(sel);
    if (!el) return;
    // None given: the template's own glyph (a Find's search one), else none.
    value ??= el.dataset['icon'];
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
    // The EFFECTIVE state: its own `disabled`, or a disabled fieldset's.
    c.disabled = this.matches(':disabled');
    /* A NUMBER keeps what the mirror would take away: its type, and words for
       an empty box. TRAP T-a-number-input-wears-sherpas-steppers */
    if (this.dataset['type'] === 'number') {
      c.setAttribute('type', 'number');
      if (!this.hasAttribute('inputmode')) c.setAttribute('inputmode', 'decimal');
      if (!this.hasAttribute('placeholder')) c.setAttribute('placeholder', this.word('placeholder'));
    }
    // A colour keeps its type: the mirror would take it away.
    if (this.dataset['type'] === 'color') c.setAttribute('type', 'color');
    // A Find says what it is for; its type is the template's.
    if (this.dataset['type'] === 'find') {
      c.setAttribute('type', 'text');
      if (!this.hasAttribute('placeholder')) c.setAttribute('placeholder', this.word('placeholder'));
    }
    // A tags field's `value` is its tags; the text box holds only what is being typed, and `required` is read above.
    if (this.#isTags) c.removeAttribute('required');
    else if (this.hasAttribute('value')) c.value = this.getAttribute('value') ?? '';
    // `min`, `max`, `disabled` or the value moved: so may what a stepper can do.
    this.#syncSteps();
  }

  get value(): string {
    if (this.#isTags) return this.#tagger.text;
    if (this.#isPicks) return this.#picks.values.join(',');
    return this.#held ?? this.#control?.value ?? this.getAttribute('value') ?? '';
  }
  set value(v: string) {
    if (this.#isPicks) {
      this.values = splitTags(v);
      return;
    }
    if (this.#isTags) {
      this.#tagger.set(splitTags(v));
      this.#syncHasValue();
      this.#syncValue();
      return;
    }
    // A select whose option has not arrived would drop it, and show its FIRST.
    const select = this.#control instanceof HTMLSelectElement ? this.#control : null;
    this.#held = select && v && !this.#options.some((o) => o.value === v) ? v : null;
    if (this.#control) this.#control.value = v;
    else this.setAttribute('value', v);
    // A JS write fires no `input`, so the Clear flag and the form are told here.
    this.#syncHasValue();
    this.#syncValue();
  }

  protected override syncFormValue(): void {
    this.#syncValue();
  }

  get disabled(): boolean {
    return this.hasAttribute('disabled');
  }
  set disabled(value: boolean) {
    this.toggleAttribute('disabled', value);
  }

  #onInput = (event: Event): void => {
    // The reader's own answer wins over one still held.
    this.#held = null;
    /* The native `input` is COMPOSED, so it crossed the shadow root as well as
       this one: two per keystroke. The host's own is the one that goes on.
       TRAP T-a-composed-native-event-goes-out-twice */
    event.stopPropagation();
    // A tags field's words are not its value: only its tags are reported.
    if (this.#isTags) {
      this.#syncHasValue();
      return;
    }
    // The form's copy follows every keystroke; the check only once it has erred.
    this.#syncValue();
    this.#syncHasValue();
    if (this.dataset['error']) void this.validate();
    this.emit('input', { value: this.value });
  };

  #onChange = (event: Event): void => {
    if (this.#isTags) {
      event.stopPropagation();
      return;
    }
    this.#held = null;
    this.#syncValue();
    this.emit('change', { value: this.value });
  };

  /** A select has no readonly of its own: read only, a key that would open it or step its value does nothing; Tab moves on. TODO 962 */
  #onReadOnlyKey = (event: Event): void => {
    if (this.#control instanceof HTMLSelectElement && this.hasAttribute('readonly') && (event as KeyboardEvent).key !== 'Tab') event.preventDefault();
  };
}

define('sherpa-input-text', SherpaInputText);
