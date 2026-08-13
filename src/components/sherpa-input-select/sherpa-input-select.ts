/**
 * sherpa-input-select — a labelled dropdown backed by a native <select>.
 *
 * Same field skeleton as sherpa-input-text (label / description / message +
 * native attribute mirroring), but the control is a styled <select>. Options
 * are stamped from populate([{ value, label, selected?, disabled? }]) — the one
 * bit of structural DOM this component creates, which the golden rules allow for
 * data-driven rows. Everything visual (the chevron included) is pure CSS.
 */
import { SherpaElement } from '../../core/sherpa-element.js';

/** A single option in the select list. */
export interface SelectOption {
  value: string;
  label?: string;
  selected?: boolean;
  disabled?: boolean;
}

/** Native attributes mirrored verbatim from the host onto the inner <select>. */
const MIRRORED = ['name', 'required', 'disabled'] as const;

export class SherpaInputSelect extends SherpaElement {
  static override css = new URL('./sherpa-input-select.css', import.meta.url);
  static override html = new URL('./sherpa-input-select.html', import.meta.url);
  static override observed = ['data-label', 'data-description', 'data-error', ...MIRRORED];

  #select: HTMLSelectElement | null = null;

  override onRender(): void {
    this.#select = this.$<HTMLSelectElement>('.control');
    this.#syncText();
    this.#syncAttrs();
    this.#select?.addEventListener('change', this.#onChange);
  }

  override onChange(name: string): void {
    if (name.startsWith('data-')) this.#syncText();
    else this.#syncAttrs();
  }

  /** populate([{ value, label, selected?, disabled? }]) — the option list. */
  protected override renderData(data: unknown): void {
    this.setOptions(Array.isArray(data) ? (data as SelectOption[]) : []);
  }

  /** Stamp a fresh set of <option>s into the inner <select>. */
  setOptions(options: SelectOption[]): void {
    const select = this.#select;
    if (!select) return;
    select.replaceChildren();
    for (const opt of options) {
      const el = document.createElement('option');
      el.value = opt.value ?? '';
      el.textContent = opt.label ?? opt.value ?? '';
      if (opt.disabled) el.disabled = true;
      if (opt.selected) el.selected = true;
      select.appendChild(el);
    }
    // Honour a host value attribute now that the matching option exists.
    const hostValue = this.getAttribute('value');
    if (hostValue && select.value !== hostValue) select.value = hostValue;
  }

  /** Label / description / error text into the shadow (CSS collapses empties). */
  #syncText(): void {
    const set = (sel: string, value: string | undefined): void => {
      const el = this.$(sel);
      if (el) el.textContent = value ?? '';
    };
    set('.label', this.dataset['label']);
    set('.description', this.dataset['description']);
    set('.message', this.dataset['error']);
  }

  /** Mirror native attributes host → inner <select>. */
  #syncAttrs(): void {
    const c = this.#select;
    if (!c) return;
    for (const attr of MIRRORED) {
      if (this.hasAttribute(attr)) c.setAttribute(attr, this.getAttribute(attr) ?? '');
      else c.removeAttribute(attr);
    }
    if (this.hasAttribute('value')) c.value = this.getAttribute('value') ?? '';
  }

  /* ── Value property — the form-control surface ─────────────────────── */

  get value(): string {
    return this.#select?.value ?? this.getAttribute('value') ?? '';
  }
  set value(v: string) {
    if (this.#select) this.#select.value = v;
    else this.setAttribute('value', v);
  }

  override focus(): void {
    this.#select?.focus();
  }

  #onChange = (): void => this.emit('change', { value: this.value });
}

customElements.define('sherpa-input-select', SherpaInputSelect);
