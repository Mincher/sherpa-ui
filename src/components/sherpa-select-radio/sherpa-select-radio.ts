/**
 * sherpa-select-radio — a radio button with a label.
 *
 * A thin wrapper around a real radio button. JS copies the label, description,
 * and native attributes onto it, exposes its checked and value states, and
 * re-fires the change event. Radios sharing the same `name` group up on their
 * own. CSS handles the whole look — the circle, the dot, disabled, and focus.
 */
import { SherpaElement } from '../../core/sherpa-element.js';

/** Native attributes mirrored verbatim from the host onto the inner control. */
const MIRRORED = ['name', 'value', 'required', 'disabled'] as const;

export class SherpaSelectRadio extends SherpaElement {
  static override css = new URL('./sherpa-select-radio.css', import.meta.url);
  static override html = new URL('./sherpa-select-radio.html', import.meta.url);
  static override observed = ['data-label', 'data-description', 'checked', ...MIRRORED];

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

  /** Mirror native attributes + checked host → inner control. */
  #syncState(): void {
    const c = this.#control;
    if (!c) return;
    for (const attr of MIRRORED) {
      if (attr === 'value') continue; // value is a property, set below
      if (this.hasAttribute(attr)) c.setAttribute(attr, this.getAttribute(attr) ?? '');
      else c.removeAttribute(attr);
    }
    c.value = this.getAttribute('value') ?? '';
    c.checked = this.hasAttribute('checked');
  }

  /* ── Public API ────────────────────────────────────────────────────── */

  get checked(): boolean {
    return this.#control?.checked ?? this.hasAttribute('checked');
  }
  set checked(v: boolean) {
    this.toggleAttribute('checked', v);
    if (this.#control) this.#control.checked = v;
  }

  get value(): string {
    return this.#control?.value ?? this.getAttribute('value') ?? '';
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

  /**
   * On selection, re-dispatch change and coordinate the name-group. Native radio
   * grouping does NOT cross shadow-DOM boundaries — each radio's inner <input>
   * lives in its own shadow root, so the browser can't deselect siblings for us.
   * The component does it: when this radio becomes checked, uncheck every other
   * sherpa-select-radio in the document that shares this `name`.
   */
  #onChange = (): void => {
    const c = this.#control;
    if (!c) return;
    this.toggleAttribute('checked', c.checked);
    if (c.checked) this.#deselectGroup();
    this.emit('change', { checked: c.checked, value: this.value });
  };

  /** Uncheck sibling radios sharing this radio's name (document-wide). */
  #deselectGroup(): void {
    const name = this.getAttribute('name');
    if (!name) return;
    const group = document.querySelectorAll<SherpaSelectRadio>(
      `sherpa-select-radio[name="${CSS.escape(name)}"]`
    );
    for (const radio of group) {
      if (radio !== this) radio.checked = false;
    }
  }
}

customElements.define('sherpa-select-radio', SherpaSelectRadio);
