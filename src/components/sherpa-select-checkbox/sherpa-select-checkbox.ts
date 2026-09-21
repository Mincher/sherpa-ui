/**
 * sherpa-select-checkbox — a checkbox with a label.
 *
 * A thin wrapper around a real checkbox. JS copies the label, description, and
 * native attributes onto it, exposes its checked, indeterminate, and value
 * states, and re-fires the change event. CSS handles the whole look — the box,
 * the tick, the dash, disabled, and focus.
 */
import { SherpaElement } from '../../core/sherpa-element.js';
// SIDE-EFFECT imports: the template STAMPS these, and an undefined custom
// element renders inert. Only the `data-advanced` variant shows them, but the
// template holds them either way — T-every-element-in-the-template.
import '../sherpa-button/sherpa-button.js';
import '../sherpa-menu/sherpa-menu.js';

/** Native attributes mirrored verbatim from the host onto the inner control. */
const MIRRORED = ['name', 'value', 'required', 'disabled'] as const;

export class SherpaSelectCheckbox extends SherpaElement {
  static override css = new URL('./sherpa-select-checkbox.css', import.meta.url);
  static override html = new URL('./sherpa-select-checkbox.html', import.meta.url);
  /** Label + description text into the shadow (CSS collapses empties). */
  static override props = {
    'data-label': { type: 'string', kind: 'content', to: '.label' },
    'data-description': { type: 'string', kind: 'content', to: '.description' },
  } as const;

  static override observed = [
    'checked',
    'indeterminate',
    // CSS owns the caret's reveal; declared so JS has a typed door to it.
    'data-advanced',
    ...MIRRORED,
  ];

  #control: HTMLInputElement | null = null;

  override onRender(): void {
    this.#control = this.$<HTMLInputElement>('.control');
    this.#syncState();
    this.#control?.addEventListener('change', this.#onChange);
    // The ADVANCED half. Wired unconditionally: the elements are in the template
    // either way, and a listener on a hidden button costs nothing.
    this.$('.caret')?.addEventListener('button-click', this.#onCaret);
    // The menu is SLOTTED, so its event reaches the host by bubbling — this
    // listener is on the host, not on a shadow node that cannot see it.
    this.addEventListener('menu-select', this.#onScenario as EventListener);
  }

  override onChange(): void {
    this.#syncState();
  }

  /** Mirror native attributes + checked/indeterminate host → inner control. */
  #syncState(): void {
    const c = this.#control;
    if (!c) return;
    for (const attr of MIRRORED) {
      if (attr === 'value') continue; // value is a property, set below
      if (this.hasAttribute(attr)) c.setAttribute(attr, this.getAttribute(attr) ?? '');
      else c.removeAttribute(attr);
    }
    c.value = this.getAttribute('value') ?? 'on';
    c.checked = this.hasAttribute('checked');
    c.indeterminate = this.hasAttribute('indeterminate'); // property only — no CSS attr selector
  }

  /* ── Public API ────────────────────────────────────────────────────── */

  get checked(): boolean {
    return this.#control?.checked ?? this.hasAttribute('checked');
  }
  set checked(v: boolean) {
    this.toggleAttribute('checked', v);
    if (this.#control) this.#control.checked = v;
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
  }

  checkValidity(): boolean {
    return this.#control?.checkValidity() ?? true;
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
    // The caret sits OUTSIDE the <label>, so this cannot toggle the box — but
    // the click still reaches a host listener, which has no reason to see it.
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

  /**
   * A scenario was chosen. REPORT it; applying it is the host's job.
   *
   * "Select all rows" means nothing here — this component knows about one
   * checkbox, not a collection. The host owns the rows, so the host decides.
   */
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
    // Native toggling clears indeterminate — keep the host attribute in step.
    if (c.indeterminate === false) this.removeAttribute('indeterminate');
    this.emit('change', {
      checked: c.checked,
      value: this.value,
      indeterminate: c.indeterminate,
    });
  };
}

customElements.define('sherpa-select-checkbox', SherpaSelectCheckbox);
