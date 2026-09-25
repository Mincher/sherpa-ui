/**
 * sherpa-select-group — a labelled group of checkboxes (data-multiple) or radios.
 *
 * Options come from the `options` slot or from populate(); either way they live
 * in the host's LIGHT DOM.
 *
 * Map:
 * - SelectGroupOption — A single option in the group.
 */
import { SherpaElement } from '../../core/ui/sherpa-element.js';
import '../sherpa-select-checkbox/sherpa-select-checkbox.js';
import '../sherpa-select-radio/sherpa-select-radio.js';

/** A single option in the group. */
export interface SelectGroupOption {
  value: string;
  label?: string;
  description?: string;
  disabled?: boolean;
}

/** The bit of a checkbox/radio child this component touches. */
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
    // `change` is composed, so one delegated listener catches every slotted child.
    this.$('.options')?.addEventListener('change', this.#onChange);
    if (this.#options.length) this.#render();
  }

  override onChange(name: string): void {
    if (name === 'data-multiple') this.#render();
    else if (name === 'disabled') this.#syncDisabled();
  }

  /** populate() takes SelectGroupOption[]. */
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

  /** Light DOM either way, so query the host, not the shadow root. */
  #children(): SelectChild[] {
    return Array.from(
      this.querySelectorAll<SelectChild>(this.#childTag()),
    );
  }

  /** Created by TAG: these are design-system components, not structural DOM. */
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

  /** `target` retargets to the host, so read the child off composedPath(). */
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
