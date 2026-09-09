/**
 * sherpa-select-checkbox — a checkbox with a label.
 *
 * A thin wrapper around a real checkbox. JS copies the label, description, and
 * native attributes onto it, exposes its checked, indeterminate, and value
 * states, and re-fires the change event. CSS handles the whole look — the box,
 * the tick, the dash, disabled, and focus.
 * @fires change — checked/indeterminate changes. bubbles + composed. detail: { checked: boolean, value: string, indeterminate: boolean }
 */
import { SherpaElement } from '../../core/sherpa-element.js';

/** Native attributes mirrored verbatim from the host onto the inner control. */
const MIRRORED = ['name', 'value', 'required', 'disabled'] as const;

export class SherpaSelectCheckbox extends SherpaElement {
  static override css = new URL('./sherpa-select-checkbox.css', import.meta.url);
  static override html = new URL('./sherpa-select-checkbox.html', import.meta.url);
  static override observed = [
    'data-label',
    'data-description',
    'checked',
    'indeterminate',
    ...MIRRORED,
  ];

  #control: HTMLInputElement | null = null;

  override onRender(): void {
    this.#control = this.$<HTMLInputElement>('.control');
    this.#syncText();
    this.#syncState();
    this.#control?.addEventListener('change', this.#onChange);
  }

  override onChange(name: string): void {
    if (name === 'data-label' || name === 'data-description') this.#syncText();
    else this.#syncState();
  }

  /** Label + description text into the shadow (CSS collapses empties). */
  #syncText(): void {
    const label = this.$('.label');
    if (label) label.textContent = this.dataset['label'] ?? '';
    const description = this.$('.description');
    if (description) description.textContent = this.dataset['description'] ?? '';
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
