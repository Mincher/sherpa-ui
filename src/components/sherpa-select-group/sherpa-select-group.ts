/**
 * sherpa-select-group — a labelled group of checkboxes or radios.
 *
 * Set data-multiple for checkboxes (pick many) or leave it off for radios (pick
 * one). Give it options with populate([{ value, label, description? }]) and it
 * draws the rows. The `value` property gives you the current choice — a list of
 * values for checkboxes, or the single value for radios.
 *
 * @fires change — detail: { value } (string[] when multiple, else string | null)
 */
import { SherpaElement } from '../../core/sherpa-element.js';
import '../sherpa-select-checkbox/sherpa-select-checkbox.js';
import '../sherpa-select-radio/sherpa-select-radio.js';

/** A single option in the group. */
export interface SelectGroupOption {
  value: string;
  label?: string;
  description?: string;
  disabled?: boolean;
}

/** Structural surface of a stamped child (checkbox or radio). */
type SelectChild = HTMLElement & { checked: boolean; value: string };

let gid = 0;

export class SherpaSelectGroup extends SherpaElement {
  static override css = new URL('./sherpa-select-group.css', import.meta.url);
  static override html = new URL('./sherpa-select-group.html', import.meta.url);
  static override observed = ['data-label', 'data-description', 'data-multiple', 'disabled'];

  #options: SelectGroupOption[] = [];
  /** Stable name shared by radios so native single-selection groups them. */
  #name = `sherpa-select-group-${++gid}`;

  /** True when rendering checkboxes (multi-select), else radios. */
  get #multiple(): boolean {
    return this.hasAttribute('data-multiple');
  }

  #childTag(): 'sherpa-select-checkbox' | 'sherpa-select-radio' {
    return this.#multiple ? 'sherpa-select-checkbox' : 'sherpa-select-radio';
  }

  override onRender(): void {
    this.#syncText();
    // One delegated listener for every child. `change` is composed, so the real
    // originating child is found via composedPath(), never event.target.
    this.$('.options')?.addEventListener('change', this.#onChange);
    if (this.#options.length) this.#render();
  }

  override onChange(name: string): void {
    if (name === 'data-label' || name === 'data-description') this.#syncText();
    else if (name === 'data-multiple') this.#render();
    else if (name === 'disabled') this.#syncDisabled();
  }

  /** populate([{ value, label, description?, disabled? }]) — the option list. */
  protected override renderData(data: unknown): void {
    this.#options = Array.isArray(data) ? (data as SelectGroupOption[]) : [];
    this.#render();
  }

  /* ── Public API ────────────────────────────────────────────────────── */

  /** Selected value(s): string[] when multiple, else the single value or null. */
  get value(): string[] | string | null {
    const selected = this.#children()
      .filter((c) => c.checked)
      .map((c) => c.value);
    return this.#multiple ? selected : (selected[0] ?? null);
  }

  set value(v: string[] | string | null) {
    const wanted = new Set(
      Array.isArray(v) ? v.map(String) : v == null ? [] : [String(v)],
    );
    for (const child of this.#children()) child.checked = wanted.has(child.value);
  }

  /* ── Rendering ─────────────────────────────────────────────────────── */

  #children(): SelectChild[] {
    return this.$$<SelectChild>(this.#childTag());
  }

  #syncText(): void {
    const label = this.$('.label');
    if (label) label.textContent = this.dataset['label'] ?? '';
    const description = this.$('.description');
    if (description) description.textContent = this.dataset['description'] ?? '';
  }

  #render(): void {
    const list = this.$('.options');
    if (!list) return;

    const tag = this.#childTag();
    const disabled = this.hasAttribute('disabled');
    list.replaceChildren();

    for (const opt of this.#options) {
      const child = document.createElement(tag);
      child.setAttribute('value', String(opt.value));
      if (opt.label != null) child.setAttribute('data-label', String(opt.label));
      if (opt.description != null) {
        child.setAttribute('data-description', String(opt.description));
      }
      if (opt.disabled || disabled) child.setAttribute('disabled', '');
      // Radios need a shared name so native single-selection groups them.
      if (!this.#multiple) child.setAttribute('name', this.#name);
      list.appendChild(child);
    }
  }

  #syncDisabled(): void {
    const disabled = this.hasAttribute('disabled');
    for (const child of this.#children()) child.toggleAttribute('disabled', disabled);
  }

  /**
   * A child toggled. `change` is a composed CustomEvent, so its target is
   * retargeted to the host at the shadow boundary — read the originating child
   * off composedPath() instead, then re-emit the group's aggregate value.
   */
  #onChange = (event: Event): void => {
    const tag = this.#childTag();
    const child = event
      .composedPath()
      .find(
        (n): n is SelectChild =>
          n instanceof HTMLElement && n.localName === tag,
      );
    if (!child) return;
    event.stopPropagation();
    this.emit('change', { value: this.value });
  };
}

customElements.define('sherpa-select-group', SherpaSelectGroup);
