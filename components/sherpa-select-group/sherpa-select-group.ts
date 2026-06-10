/**
 * sherpa-select-group.ts
 * SherpaSelectGroup — Unified selection group (checkbox or radio).
 *
 * Replaces sherpa-input-checkbox-group and sherpa-input-radio-group.
 * Controlled by data-type; all other attributes are shared.
 *
 * @element sherpa-select-group
 * @category input
 * @description Unified checkbox or radio group with shared label, description, helper, and
 *   validation. Replaces sherpa-input-checkbox-group and sherpa-input-radio-group. Set
 *   data-type="checkbox" for multi-select, "radio" for single-select. Populate options via
 *   the data-options JSON attribute or dynamically via setValue(). The weekdays template
 *   renders a pre-styled day-of-week picker for scheduling forms.
 *
 * @attr {enum}    data-type=checkbox  — checkbox | radio
 * @attr {string}  name               — Field name; auto-generated for radio if omitted
 * @attr {string}  data-label         — Group legend
 * @attr {string}  data-description   — Sub-label below legend
 * @attr {string}  data-helper        — Helper text below options
 * @attr {enum}    data-orientation   — vertical (default) | horizontal
 * @attr {json}    data-options       — [{value,label,description?,disabled?}]
 * @attr {json}    data-value         — Selected values as JSON string array
 * @attr {number}  data-max           — Max selections (checkbox only; omit = unlimited)
 * @attr {boolean} data-select-all    — Show "Select all" header checkbox (checkbox only)
 * @attr {string}  data-template      — default | weekdays (weekdays: checkbox only)
 * @attr {enum}    data-status        — critical | warning | success | info | urgent
 * @attr {boolean} disabled           — Disable all children
 * @attr {boolean} required           — Required constraint
 *
 * @fires change — Selection changed.
 *   bubbles: true, composed: true
 *   detail: { value: string[] }
 *
 * @prop {string[]} value — Selected values. Radio enforces single-element array.
 *
 * @method getValue()      — Returns current value array.
 * @method setValue(arr)   — Replace current value array.
 * @method clear()         — Clear all selections.
 */

import { SherpaInputGroupBase } from '../utilities/sherpa-input-group/sherpa-input-group-base.js';
import '../sherpa-select-checkbox/sherpa-select-checkbox.js';
import '../sherpa-select-radio/sherpa-select-radio.js';

interface SelectChild extends HTMLElement {
  checked: boolean;
  indeterminate?: boolean;
}

let _gid = 0;

export class SherpaSelectGroup extends SherpaInputGroupBase {

  static override get cssUrl(): string  { return new URL('./sherpa-select-group.css', import.meta.url).href; }
  static override get htmlUrl(): string { return new URL('./sherpa-select-group.html', import.meta.url).href; }

  static override get observedAttributes(): string[] {
    return [
      ...super.observedAttributes,
      'data-type', 'data-max', 'data-select-all', 'data-template',
    ];
  }

  /* ── Type helpers ──────────────────────────────────────────────── */

  get type(): 'checkbox' | 'radio' {
    return this.dataset['type'] === 'radio' ? 'radio' : 'checkbox';
  }

  #childTag()      { return this.type === 'radio' ? 'sherpa-select-radio' : 'sherpa-select-checkbox'; }
  #childTagUpper() { return this.type === 'radio' ? 'SHERPA-SELECT-RADIO' : 'SHERPA-SELECT-CHECKBOX'; }

  /* ── Template ──────────────────────────────────────────────────── */

  override get templateId(): string {
    return this.dataset['template'] === 'weekdays' ? 'weekdays' : 'default';
  }

  /* ── Lifecycle ─────────────────────────────────────────────────── */

  override onRender(): void {
    if (!this._bound) {
      this.shadow.addEventListener('change', this.#onShadowChange);
      this.addEventListener('change', this.#onLightChange);
      this._bound = true;
    }
    this.#ensureRadioName();
    this._syncAll();
  }

  protected override _onExtraAttributeChanged(name: string): void {
    switch (name) {
      case 'data-type':     this.#onTypeChange(); break;
      case 'data-template': this.renderTemplate(this.templateId).then(() => this.onRender()); break;
      case 'name':          this.#cascadeName(); break;
    }
  }

  /* ── Public API ────────────────────────────────────────────────── */

  get value(): string[]          { return this.#readValue(); }
  set value(arr: string[])       { this.setValue(arr); }

  getValue(): string[]           { return this.#readValue(); }

  setValue(arr: string[]): void {
    let list = Array.isArray(arr) ? arr.map(String) : [];
    if (this.type === 'radio') list = list.slice(0, 1);
    this.dataset['value'] = JSON.stringify(list);
  }

  clear(): void { this.setValue([]); }

  /* ── Stamp options ─────────────────────────────────────────────── */

  protected override _stampOptions(): void {
    if (this.templateId !== 'default') return;
    if (!this.$('.group-options')) return;
    const opts = this._parseJsonOptions();
    if (!opts) return;

    const tag = this.#childTag();
    [...this.querySelectorAll(`${tag}[data-stamped]`)].forEach(n => n.remove());

    const frag = document.createDocumentFragment();
    const name = this.getAttribute('name');
    for (const opt of opts) {
      const el = document.createElement(tag);
      el.dataset['stamped'] = '';
      el.setAttribute('value', opt.value);
      if (opt.label)       el.dataset['label']       = opt.label;
      if (opt.description) el.dataset['description'] = opt.description;
      if (opt.disabled)    el.setAttribute('disabled', '');
      if (name)            el.setAttribute('name', name);
      frag.appendChild(el);
    }
    this.appendChild(frag);
  }

  /* ── Sync value → children ─────────────────────────────────────── */

  protected override _syncValue(): void {
    const selected = new Set(this.#parseStoredValue());

    if (this.templateId === 'weekdays') {
      for (const input of this.$$<HTMLInputElement>('.weekday-input')) {
        if (input.checked !== selected.has(input.value)) input.checked = selected.has(input.value);
      }
      return;
    }

    for (const el of this.querySelectorAll<SelectChild>(this.#childTag())) {
      const v = el.getAttribute('value') ?? '';
      const should = selected.has(v);
      if (el.checked !== should) el.checked = should;
    }

    if (this.type === 'checkbox') {
      this.#enforceMax(this.#max(), selected);
      this.#syncSelectAll();
    }
  }

  /* ── Sync disabled → children ──────────────────────────────────── */

  protected override _syncDisabled(): void {
    const disable = this.hasAttribute('disabled');
    for (const el of this.querySelectorAll(this.#childTag())) {
      disable ? el.setAttribute('disabled', '') : el.removeAttribute('disabled');
    }
    for (const input of this.$$<HTMLInputElement>('.weekday-input')) {
      input.disabled = disable;
    }
  }

  /* ── Private ───────────────────────────────────────────────────── */

  #max(): number {
    const v = parseInt(this.dataset['max'] ?? '', 10);
    return isNaN(v) ? Infinity : v;
  }

  #ensureRadioName(): void {
    if (this.type === 'radio' && !this.getAttribute('name')) {
      this.setAttribute('name', `sherpa-select-group-${++_gid}`);
    }
  }

  #cascadeName(): void {
    const name = this.getAttribute('name');
    for (const el of this.querySelectorAll(this.#childTag())) {
      name ? el.setAttribute('name', name) : el.removeAttribute('name');
    }
  }

  #onTypeChange(): void {
    // Remove stamped children of the now-old type (opposite of current)
    const oldTag = this.type === 'radio' ? 'sherpa-select-checkbox' : 'sherpa-select-radio';
    [...this.querySelectorAll(`${oldTag}[data-stamped]`)].forEach(n => n.remove());
    this.#ensureRadioName();
    this._stampOptions();
    this._syncValue();
  }

  #readValue(): string[] {
    if (this.templateId === 'weekdays') {
      return [...this.$$<HTMLInputElement>('.weekday-input')]
        .filter(i => i.checked).map(i => i.value);
    }
    return [...this.querySelectorAll<SelectChild>(this.#childTag())]
      .filter(el => el.checked)
      .map(el => el.getAttribute('value') ?? '');
  }

  #parseStoredValue(): string[] {
    try {
      const parsed = JSON.parse(this.dataset['value'] || '[]');
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch { return []; }
  }

  /** Disable unchecked items when at max; restore when below max. */
  #enforceMax(max: number, selected: Set<string>): void {
    if (!isFinite(max)) return;
    const atMax = selected.size >= max;
    for (const el of this.querySelectorAll<HTMLElement>(this.#childTag())) {
      const v = el.getAttribute('value') ?? '';
      const userDisabled = el.hasAttribute('disabled') && !('maxDisabled' in el.dataset);
      if (userDisabled) continue;
      if (atMax && !selected.has(v)) {
        el.setAttribute('disabled', '');
        el.dataset['maxDisabled'] = '';
      } else if ('maxDisabled' in el.dataset) {
        el.removeAttribute('disabled');
        delete el.dataset['maxDisabled'];
      }
    }
  }

  #syncSelectAll(): void {
    const allEl = this.$<SelectChild>('.select-all-checkbox');
    if (!allEl) return;
    const children = [...this.querySelectorAll<SelectChild>(this.#childTag())]
      .filter(el => !el.hasAttribute('disabled') || 'maxDisabled' in (el as HTMLElement).dataset);
    const checkedCount = children.filter(el => el.checked).length;
    const total = children.length;
    const isAll = total > 0 && checkedCount === total;
    const isNone = checkedCount === 0;
    allEl.checked = isAll;
    if (allEl.indeterminate !== undefined) allEl.indeterminate = !isAll && !isNone;
  }

  #onShadowChange = (e: Event) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;

    if (target.classList.contains('select-all-checkbox')) {
      const allEl = target as SelectChild;
      for (const el of this.querySelectorAll<HTMLElement>(this.#childTag())) {
        if (el.hasAttribute('disabled') && !('maxDisabled' in el.dataset)) continue;
        (el as SelectChild).checked = allEl.checked;
      }
      this.#emitChange();
      return;
    }

    if (target.classList.contains('weekday-input')) {
      this.#emitChange();
    }
  };

  #onLightChange = (e: Event) => {
    if (e.target === this) return;
    const target = e.target as HTMLElement | null;
    if (target?.tagName !== this.#childTagUpper()) return;

    if (this.type === 'radio') {
      const v = target.getAttribute('value') ?? '';
      const serialised = JSON.stringify([v]);
      if (this.dataset['value'] !== serialised) this.dataset['value'] = serialised;
      this.emit('change', { value: [v] });
    } else {
      this.#emitChange();
    }
  };

  #emitChange(): void {
    const value = this.#readValue();
    const serialised = JSON.stringify(value);
    if (this.dataset['value'] !== serialised) this.dataset['value'] = serialised;
    this.emit('change', { value });
  }
}

customElements.define('sherpa-select-group', SherpaSelectGroup);
