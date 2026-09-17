/**
 * sherpa-select-group — a labelled group of checkboxes or radios.
 *
 * Set data-multiple for checkboxes (pick many) or leave it off for radios (pick
 * one). Options arrive two ways: author them declaratively in the `options`
 * slot, or call populate([{ value, label, description? }]) — populate stamps the
 * same children into light DOM so they project through the slot. The `value`
 * property gives you the current choice — a list of values for checkboxes, or
 * the single value for radios.
 *
 * A divider rule sits under the legend, and a validation line sits below the
 * options; set data-error to show the message (or set data-status to re-ink it
 * via the status cascade).
 *
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
  static override props = {
    'data-label': { type: 'string', kind: 'content', to: '.label' },
    'data-description': { type: 'string', kind: 'content', to: '.description' },
    // The validation LINE reads its text from data-error; CSS reveals the row.
    'data-error': { type: 'string', kind: 'content', to: '.validation' },
  } as const;

  static override observed = [
    'data-multiple',
    'disabled',
  ];

  #options: SelectGroupOption[] = [];
  /** Children this component stamped from populate() — tracked so a re-render
   *  replaces only them and leaves declaratively-slotted children alone. */
  #stamped: HTMLElement[] = [];
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
    // One delegated listener for every child. `change` is composed, so it climbs
    // the composed path (through the slot into this shadow tree) and the real
    // originating child is found via composedPath(), never event.target.
    this.$('.options')?.addEventListener('change', this.#onChange);
    if (this.#options.length) this.#render();
  }

  override onChange(name: string): void {
    if (name === 'data-multiple') this.#render();
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

  /**
   * The option children. They live in the host's LIGHT DOM (slotted through the
   * `options` slot) whether authored declaratively or stamped by populate(), so
   * this queries the host, not the shadow root.
   */
  #children(): SelectChild[] {
    return Array.from(
      this.querySelectorAll<SelectChild>(this.#childTag()),
    );
  }

  /**
   * Stamp the populate() options into the host's light DOM, assigned to the
   * `options` slot so they project into the shadow layout. Replaces only the
   * children this method previously stamped (tracked in #stamped) — declaratively
   * authored slot children are left untouched. The children ARE design-system
   * components (composition), so they are created by tag, not raw structural DOM.
   */
  #render(): void {
    const tag = this.#childTag();
    const disabled = this.hasAttribute('disabled');

    for (const prev of this.#stamped) prev.remove();
    this.#stamped = [];

    for (const opt of this.#options) {
      const child = document.createElement(tag);
      child.setAttribute('slot', 'options');
      child.setAttribute('value', String(opt.value));
      if (opt.label != null) child.setAttribute('data-label', String(opt.label));
      if (opt.description != null) {
        child.setAttribute('data-description', String(opt.description));
      }
      if (opt.disabled || disabled) child.setAttribute('disabled', '');
      // Radios need a shared name so native single-selection groups them.
      if (!this.#multiple) child.setAttribute('name', this.#name);
      this.appendChild(child);
      this.#stamped.push(child);
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
