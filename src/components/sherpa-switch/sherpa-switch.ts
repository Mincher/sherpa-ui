/**
 * sherpa-switch — an on/off toggle. A native checkbox in a label does the work.
 *
 * @prop {boolean} checked  — whether the switch is on (delegates to the inner input)
 * @prop {boolean} disabled — disabled state (reflects host attr + inner input)
 * @prop {string}  value    — what it stands for when on (default "on"), as a checkbox's
 */
import { SherpaElement } from '../../core/ui/sherpa-element.js';
import { FormValue } from '../../core/ui/form-value.js';

export class SherpaSwitch extends SherpaElement {
  static override css = new URL('./sherpa-switch.css', import.meta.url);
  static override html = new URL('./sherpa-switch.html', import.meta.url);

  // A host label names this. TRAP T-a-host-label-must-reach-its-control
  static override labelTarget = '.input';
  /** A form cannot see an <input> through a shadow root. TRAP T-shadow-input-needs-element-internals */
  static readonly formAssociated = true;
  static override observed = [
    'checked',
    'disabled',
    'required',
    'value',
    // CSS-only; declared for the typed door.
    'data-type',
  ];

  /** The native checkbox the switch wraps. */
  #input(): HTMLInputElement | null {
    return this.$<HTMLInputElement>('.input');
  }

  /** Its link to its form. */
  #form = new FormValue(this);

  /** On, it submits its value; off, nothing — as a native checkbox.
   *  TRAP T-a-form-value-follows-every-write */
  #syncForm(): void {
    const input = this.#input();
    if (!input) return;
    this.#form.value(input.checked ? input.value : null);
    this.#form.follow(input);
  }

  override onRender(): void {
    this.#syncState();
    // The native change bubbles inside the shadow root but is not composed.
    this.#input()?.addEventListener('change', this.#onChange);
  }

  override onChange(): void {
    this.#syncState();
  }

  /* ── Public API ──────────────────────────────────────────────────────── */

  get checked(): boolean {
    return this.#input()?.checked ?? this.hasAttribute('checked');
  }
  set checked(value: boolean) {
    const input = this.#input();
    if (input) input.checked = value;
    this.toggleAttribute('checked', value);
    this.#syncForm();
  }

  get disabled(): boolean {
    return this.hasAttribute('disabled');
  }
  set disabled(value: boolean) {
    this.toggleAttribute('disabled', value);
    const input = this.#input();
    if (input) input.disabled = value;
  }

  get value(): string {
    return this.getAttribute('value') ?? 'on';
  }
  set value(v: string) {
    this.setAttribute('value', v);
  }

  checkValidity(): boolean {
    return this.#form.checkValidity();
  }

  /** Check, and show the browser's message on the switch. */
  reportValidity(): boolean {
    return this.#form.reportValidity();
  }

  override focus(options?: FocusOptions): void {
    this.#input()?.focus(options);
  }

  /* ── Private ─────────────────────────────────────────────────────────── */

  /** Mirror checked + disabled host → inner control. */
  #syncState(): void {
    const input = this.#input();
    if (!input) return;
    input.checked = this.hasAttribute('checked');
    input.disabled = this.hasAttribute('disabled');
    input.required = this.hasAttribute('required');
    input.value = this.value;
    this.#syncForm();
  }

  /** Mirror the checkbox onto `checked` and report it. */
  #onChange = (): void => {
    const checked = this.#input()?.checked ?? false;
    this.toggleAttribute('checked', checked);
    this.#syncForm();
    this.emit('change', { checked, value: this.value });
  };
}

customElements.define('sherpa-switch', SherpaSwitch);
