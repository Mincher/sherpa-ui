/**
 * sherpa-select-checkbox — a checkbox with a label.
 *
 * JS mirrors attributes onto a real checkbox and re-fires change; CSS owns the look.
 */
import { SherpaElement } from '../../core/ui/sherpa-element.js';
import { FormValue } from '../../core/ui/form-value.js';
import { MIRRORED_CONTROL_ATTRS as MIRRORED } from '../../core/ui/shared-constants.js';
// The template stamps these even when `data-advanced` is off — T-every-element-in-the-template.
import '../sherpa-button/sherpa-button.js';
import '../sherpa-menu/sherpa-menu.js';

export class SherpaSelectCheckbox extends SherpaElement {
  static override css = new URL('./sherpa-select-checkbox.css', import.meta.url);
  static override html = new URL('./sherpa-select-checkbox.html', import.meta.url);
  static override props = {
    'data-label': { type: 'string', kind: 'content', to: '.label' },
    'data-description': { type: 'string', kind: 'content', to: '.description' },
  } as const;

  // A host label names this. TRAP T-a-host-label-must-reach-its-control
  static override labelTarget = '.control';
  static override observed = [
    'checked',
    'indeterminate',
    // CSS-only; declared for the typed door.
    'data-advanced',
    ...MIRRORED,
  ];

  /** A form cannot see an <input> through a shadow root. TRAP T-shadow-input-needs-element-internals */
  static readonly formAssociated = true;

  /** The native checkbox. */
  #control: HTMLInputElement | null = null;
  /** Its link to its form. */
  #form = new FormValue(this);

  override onRender(): void {
    this.#control = this.$<HTMLInputElement>('.control');
    this.#syncState();
    this.#control?.addEventListener('change', this.#onChange);
    this.$('.caret')?.addEventListener('button-click', this.#onCaret);
    // The menu is SLOTTED — only the host sees its event, not a shadow node.
    this.addEventListener('menu-select', this.#onScenario as EventListener);
  }

  override onChange(): void {
    this.#syncState();
  }

  /** Mirror native attributes + checked/indeterminate host → inner control. */
  #syncState(): void {
    const c = this.#control;
    if (!c) return;
    // The shared loop; `value` is a property, set below.
    // TRAP T-mirroring-skips-value
    this.mirrorAttrs(c, MIRRORED);
    c.value = this.getAttribute('value') ?? 'on';
    c.checked = this.hasAttribute('checked');
    c.indeterminate = this.hasAttribute('indeterminate'); // property only — no CSS attr selector
    this.#syncForm();
  }

  /** Ticked, it submits its value; unticked, nothing — as a native checkbox.
   *  TRAP T-a-form-value-follows-every-write */
  #syncForm(): void {
    const c = this.#control;
    if (!c) return;
    this.#form.value(c.checked ? c.value : null);
    this.#form.follow(c);
  }

  /* ── Public API ────────────────────────────────────────────────────── */

  get checked(): boolean {
    return this.#control?.checked ?? this.hasAttribute('checked');
  }
  set checked(v: boolean) {
    this.toggleAttribute('checked', v);
    if (this.#control) this.#control.checked = v;
    this.#syncForm();
  }

  get indeterminate(): boolean {
    return this.#control?.indeterminate ?? this.hasAttribute('indeterminate');
  }
  set indeterminate(v: boolean) {
    this.toggleAttribute('indeterminate', v);
    if (this.#control) this.#control.indeterminate = v;
  }

  get value(): string {
    return this.#control?.value ?? this.getAttribute('value') ?? 'on';
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
    return this.#form.checkValidity();
  }

  /** Check, and show the browser's message on the box. */
  reportValidity(): boolean {
    return this.#form.reportValidity();
  }

  override focus(options?: FocusOptions): void {
    this.#control?.focus(options);
  }

  /* ── The advanced variant ─────────────────────────────────────────── */

  /** The menu a host slotted, if any. */
  #menu(): (HTMLElement & { toggle?: (t?: HTMLElement) => void }) | null {
    return this.querySelector('[slot="menu"]');
  }

  /** Open or shut the slotted menu, anchored to the caret. */
  #onCaret = (event: Event): void => {
    event.stopPropagation();
    const menu = this.#menu();
    const caret = this.$('.caret');
    if (!menu || !caret) return;
    menu.toggle?.(caret);
    caret.setAttribute(
      'aria-expanded',
      String((menu as HTMLElement & { open?: boolean }).open ?? false),
    );
  };

  /** A scenario was chosen. REPORT it — the host owns the rows, so it applies it. */
  #onScenario = (event: CustomEvent): void => {
    const value = event.detail?.['value'] as string | undefined;
    if (!value) return;
    event.stopPropagation();
    this.$('.caret')?.setAttribute('aria-expanded', 'false');
    this.emit('selection-scenario', { value });
  };

  /** Mirror the native checked state back to the host, then re-dispatch change. */
  #onChange = (): void => {
    const c = this.#control;
    if (!c) return;
    this.toggleAttribute('checked', c.checked);
    // A click leaves `indeterminate` set, so the dash draws over the tick. Clear
    // the PROPERTY — CSS selects `:indeterminate`. TRAP T-a-click-does-not-clear-indeterminate.
    c.indeterminate = false;
    this.removeAttribute('indeterminate');
    this.#syncForm();
    this.emit('change', {
      checked: c.checked,
      value: this.value,
      indeterminate: false,
    });
  };
}

customElements.define('sherpa-select-checkbox', SherpaSelectCheckbox);
