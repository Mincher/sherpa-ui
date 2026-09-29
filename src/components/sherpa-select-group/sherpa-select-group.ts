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
    'name',
  ];

  /** The options, as populated. */
  #options: SelectGroupOption[] = [];
  /** Only what populate() stamped, so a re-render spares slotted children. */
  #stamped: HTMLElement[] = [];
  /** The name its radios share when the group has none — they untick by name. */
  #name = `sherpa-select-group-${++gid}`;
  /** The picks, as DATA — the ticks are drawn from it. Null until something sets
   *  it; a slotted child's own tick answers then. TRAP T-a-value-is-data-the-ticks-are-drawn */
  #picked: string[] | null = null;

  /** What each child submits under: the group's own `name` (Will, 2026-09-29),
   *  else the radios' private one; a nameless checkbox submits nothing. */
  get #childName(): string | null {
    return this.getAttribute('name') ?? (this.#multiple ? null : this.#name);
  }

  get #multiple(): boolean {
    return this.hasAttribute('data-multiple');
  }

  /** Checkboxes when several may be picked, radios when one. */
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
    else if (name === 'name') this.#syncNames();
  }

  /** populate() takes SelectGroupOption[]. */
  protected override renderData(data: unknown): void {
    this.#options = Array.isArray(data) ? (data as SelectGroupOption[]) : [];
    this.#render();
  }

  /* ── Public API ────────────────────────────────────────────────────── */

  /** Selected value(s): string[] when multiple, else the single value or null. */
  get value(): string[] | string | null {
    const picked = this.#picked ?? this.#ticked();
    return this.#multiple ? [...picked] : (picked[0] ?? null);
  }

  set value(v: string[] | string | null) {
    this.#picked = Array.isArray(v) ? v.map(String) : v == null ? [] : [String(v)];
    this.#drawPicks();
  }

  /* ── Rendering ─────────────────────────────────────────────────────── */

  /** What the child boxes have ticked. */
  #ticked(): string[] {
    return this.#children().filter((c) => c.checked).map((c) => c.value);
  }

  /** Tick the children from the picks. One, for radios. */
  #drawPicks(): void {
    if (!this.#picked) return;
    const wanted = new Set(this.#multiple ? this.#picked : this.#picked.slice(0, 1));
    for (const child of this.#children()) child.checked = wanted.has(child.value);
  }

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
      const childName = this.#childName;
      if (childName) child.setAttribute('name', childName);
      this.appendChild(child);
      this.#stamped.push(child);
    }
    this.#drawPicks();
  }

  /** Carry the name down to every option. */
  #syncNames(): void {
    const name = this.#childName;
    for (const child of this.#children()) {
      if (name) child.setAttribute('name', name);
      else child.removeAttribute('name');
    }
  }

  /** Carry `disabled` down to every option. */
  #syncDisabled(): void {
    const disabled = this.hasAttribute('disabled');
    for (const child of this.#children()) child.toggleAttribute('disabled', disabled);
  }

  /** A child's change, read off the composed path. */
  #onChange = (event: Event): void => {
    const child = this.pathFind<SelectChild>(event, this.#childTag());
    if (!child) return;
    event.stopPropagation();
    this.#picked = this.#ticked();
    this.emit('change', { value: this.value });
  };
}

customElements.define('sherpa-select-group', SherpaSelectGroup);
