/**
 * sherpa-select-radio — a labelled wrapper around a native radio input.
 */
import { SherpaElement } from '../../core/ui/sherpa-element.js';
import { MIRRORED_CONTROL_ATTRS as MIRRORED } from '../../core/ui/shared-constants.js';
import { FormValue } from '../../core/ui/form-value.js';

export class SherpaSelectRadio extends SherpaElement {
  static override css = new URL('./sherpa-select-radio.css', import.meta.url);
  static override html = new URL('./sherpa-select-radio.html', import.meta.url);
  static override props = {
    'data-label': { type: 'string', kind: 'content', to: '.label' },
    'data-description': { type: 'string', kind: 'content', to: '.description' },
  } as const;

  // A host label names this. TRAP T-a-host-label-must-reach-its-control
  static override labelTarget = '.control';
  static override observed = ['checked', ...MIRRORED];

  /** A form cannot see an <input> through a shadow root. TRAP T-shadow-input-needs-element-internals */
  static readonly formAssociated = true;

  /** The native radio. */
  #control: HTMLInputElement | null = null;
  /** Its link to its form. */
  #form = new FormValue(this);

  override onRender(): void {
    this.#control = this.$<HTMLInputElement>('.control');
    this.#syncState();
    this.#control?.addEventListener('change', this.#onChange);
  }

  override onChange(): void {
    this.#syncState();
  }

  /** Mirror native attributes + checked from host onto the inner control. */
  #syncState(): void {
    const c = this.#control;
    if (!c) return;
    // The shared loop; `value` is a property, set below.
    // TRAP T-mirroring-skips-value
    this.mirrorAttrs(c, MIRRORED);
    c.value = this.getAttribute('value') ?? '';
    c.checked = this.hasAttribute('checked');
    this.#syncForm();
  }

  /**
   * Ticked, it submits its value under the shared `name`; unticked, nothing —
   * as native radios do (Will, 2026-09-29). REQUIRED is the GROUP's: each
   * inner radio is alone in its shadow root, so its own check would fail every
   * unticked radio while another is ticked.
   * TRAP T-radios-in-shadow-roots-are-not-one-group
   */
  #syncForm(): void {
    const c = this.#control;
    if (!c) return;
    this.#form.value(c.checked ? c.value : null);
    const missing = this.hasAttribute('required') && !this.#group().some((r) => r.checked);
    if (missing) this.#form.validity({ valueMissing: true }, c.validationMessage || 'Select one.', c);
    else this.#form.validity();
  }

  /** The radios sharing this `name` in its form — or its root, outside one. */
  #group(): SherpaSelectRadio[] {
    const name = this.getAttribute('name');
    if (!name) return [this];
    const root = (this.#form.form ?? this.getRootNode()) as ParentNode;
    return [...root.querySelectorAll<SherpaSelectRadio>(`sherpa-select-radio[name="${CSS.escape(name)}"]`)];
  }

  /* ── Public API ────────────────────────────────────────────────────── */

  get checked(): boolean {
    return this.#control?.checked ?? this.hasAttribute('checked');
  }
  set checked(v: boolean) {
    this.toggleAttribute('checked', v);
    if (this.#control) this.#control.checked = v;
    // The group's answer moved, so each member's validity did.
    for (const radio of this.#group()) radio.#syncForm();
  }

  get value(): string {
    return this.#control?.value ?? this.getAttribute('value') ?? '';
  }
  set value(v: string) {
    this.setAttribute('value', v);
    if (this.#control) this.#control.value = v;
    this.#syncForm();
  }

  get disabled(): boolean {
    return this.hasAttribute('disabled');
  }
  set disabled(value: boolean) {
    this.toggleAttribute('disabled', value);
  }

  checkValidity(): boolean {
    this.#syncForm();
    return this.#form.checkValidity();
  }

  /** Check, and show the browser's message on the radio. */
  reportValidity(): boolean {
    this.#syncForm();
    return this.#form.reportValidity();
  }

  override focus(options?: FocusOptions): void {
    this.#control?.focus(options);
  }

  /** Native radio grouping does NOT cross shadow roots — deselect siblings here. */
  #onChange = (): void => {
    const c = this.#control;
    if (!c) return;
    this.toggleAttribute('checked', c.checked);
    if (c.checked) this.#deselectGroup();
    for (const radio of this.#group()) radio.#syncForm();
    this.emit('change', { checked: c.checked, value: this.value });
  };

  /** Uncheck the other radios in its group — in its form, not the whole page. */
  #deselectGroup(): void {
    for (const radio of this.#group()) {
      if (radio !== this) radio.checked = false;
    }
  }
}

customElements.define('sherpa-select-radio', SherpaSelectRadio);
