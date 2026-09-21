/**
 * sherpa-select-group — a labelled group of checkboxes (data-multiple) or radios.
 *
 * Options come from the `options` slot or from populate(); either way they live
 * in the host's LIGHT DOM.
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
    'data-error': { type: 'string', kind: 'content', to: '.validation' },
  } as const;

  static override observed = [
    'data-multiple',
    'disabled',
  ];

  #options: SelectGroupOption[] = [];
  /** Only what populate() stamped, so a re-render spares slotted children. */
  #stamped: HTMLElement[] = [];
  /** Stable name shared by radios so native single-selection groups them. */
  #name = `sherpa-select-group-${++gid}`;

  get #multiple(): boolean {
    return this.hasAttribute('data-multiple');
  }

  #childTag(): 'sherpa-select-checkbox' | 'sherpa-select-radio' {
    return this.#multiple ? 'sherpa-select-checkbox' : 'sherpa-select-radio';
  }

  override onRender(): void {
    // One delegated listener: `change` is composed, so it climbs through the slot.
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

  /** The option children — light DOM either way, so query the host. */
  #children(): SelectChild[] {
    return Array.from(
      this.querySelectorAll<SelectChild>(this.#childTag()),
    );
  }

  /** Stamp the options into light DOM, slot="options". Created by TAG — they are
   *  design-system components, not raw structural DOM. */
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
      if (!this.#multiple) child.setAttribute('name', this.#name);
      this.appendChild(child);
      this.#stamped.push(child);
    }
  }

  #syncDisabled(): void {
    const disabled = this.hasAttribute('disabled');
    for (const child of this.#children()) child.toggleAttribute('disabled', disabled);
  }

  /** A child toggled. `target` is retargeted to the host at the shadow boundary,
   *  so the originating child comes off composedPath(). */
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
