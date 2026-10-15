/**
 * sherpa-switch — an on/off toggle. A native checkbox in a label does the work.
 *
 * @prop {boolean} checked  — whether the switch is on (delegates to the inner input)
 * @prop {boolean} disabled — disabled state (reflects host attr + inner input)
 * @prop {string}  value    — what it stands for when on (default "on"), as a checkbox's
 */
import { SherpaElement, define } from '../../core/ui/sherpa-element.js';

export class SherpaSwitch extends SherpaElement {
  static override css = new URL('./sherpa-switch.css', import.meta.url);
  static override html = new URL('./sherpa-switch.html', import.meta.url);
  static override delegatesFocus = true;
  /* Its words beside the track, as a checkbox's. Will, TODO 230. */
  static override props = {
    'data-label': { type: 'string', kind: 'content', to: '.title' },
    'data-description': { type: 'string', kind: 'content', to: '.description' },
    // CSS-only; declared for the typed door.
    'data-type': { type: 'enum', kind: 'style', values: ['default', 'simple'] },
  } as const;

  // A host label names this. TRAP T-a-host-label-must-reach-its-control
  static override labelTarget = '.input';
  /** A form cannot see an <input> through a shadow root. TRAP T-shadow-input-needs-element-internals */
  static readonly formAssociated = true;
  static override observed = [
    'checked',
    'disabled',
    'required',
    'value',
  ];

  /** The native checkbox the switch wraps. */
  #input(): HTMLInputElement | null {
    return this.$<HTMLInputElement>('.input');
  }


  /** On, it submits its value; off, nothing — as a native checkbox.
   *  TRAP T-a-form-value-follows-every-write */
  #syncForm(): void {
    const input = this.#input();
    if (!input) return;
    this.formLink.value(input.checked ? input.value : null);
    this.formLink.follow(input);
  }

  override onRender(): void {
    this.#resetTo = this.hasAttribute('checked');
    this.#syncState();
    // The native change bubbles inside the shadow root but is not composed.
    this.#input()?.addEventListener('change', this.#onChange);
  }

  override onChange(): void {
    this.#syncState();
  }

  /* Form lifecycle — called by the browser. */

  /** Inside a disabled `<fieldset>`, as by its own `disabled`. TRAP T-a-form-control-follows-its-fieldset */
  formDisabledCallback(): void {
    this.#syncState();
  }

  /** A form reset puts back its FIRST `checked`. */
  formResetCallback(): void {
    this.checked = this.#resetTo;
    this.#syncForm();
  }

  /** Its first `checked`: what a form reset puts back. Will, TODO 214, B. */
  #resetTo = false;

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

  /* ── Private ─────────────────────────────────────────────────────────── */

  /** Mirror checked + disabled host → inner control. */
  #syncState(): void {
    const input = this.#input();
    if (!input) return;
    input.checked = this.hasAttribute('checked');
    // The EFFECTIVE state: its own `disabled`, or a disabled fieldset's.
    input.disabled = this.matches(':disabled');
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

define('sherpa-switch', SherpaSwitch);
