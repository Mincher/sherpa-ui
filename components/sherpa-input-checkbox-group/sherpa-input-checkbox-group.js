/**
 * sherpa-input-checkbox-group.js
 * SherpaInputCheckboxGroup — Group of checkboxes with shared label,
 * description, helper, and an optional pre-stamped `weekdays` template.
 *
 * @element sherpa-input-checkbox-group
 *
 * @attr {string}  [name]              — Group field name; cascaded to children
 * @attr {string}  [data-label]        — Group legend
 * @attr {string}  [data-description]  — Sub-label below the legend
 * @attr {string}  [data-helper]       — Helper text below the options
 * @attr {enum}    [data-orientation]  — vertical (default) | horizontal
 * @attr {json}    [data-options]      — [{value,label,description?,disabled?}]
 *                                       (default template only)
 * @attr {json}    [data-value]        — Currently selected values, e.g. ["1","3"]
 * @attr {enum}    [data-status]       — critical | warning | success | info | urgent
 * @attr {string}  [data-template]     — "default" (default) | "weekdays"
 * @attr {boolean} [disabled]          — Disable all children
 * @attr {boolean} [required]          — At least one selection required
 *
 * @fires change — Selection changed.
 *   bubbles: true, composed: true
 *   detail: { value: string[], values: string[] }
 *
 * @prop {string[]} value — Currently selected values (read/write)
 *
 * @method getValue()      — Returns the current value array.
 * @method setValue(arr)   — Replace the current value array.
 * @method clear()         — Uncheck every option.
 */

import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';
import { StatusMixin } from '../utilities/status-mixin.js';

export class SherpaInputCheckboxGroup extends StatusMixin(SherpaElement) {

  static get cssUrl()  { return new URL('./sherpa-input-checkbox-group.css', import.meta.url).href; }
  static get htmlUrl() { return new URL('./sherpa-input-checkbox-group.html', import.meta.url).href; }

  static get observedAttributes() {
    return [
      ...super.observedAttributes,
      'name', 'data-label', 'data-description', 'data-helper',
      'data-options', 'data-value', 'data-template',
      'disabled', 'required',
    ];
  }

  /* ── Template selection ────────────────────────────────────────── */

  get templateId() {
    return this.dataset.template === 'weekdays' ? 'weekdays' : 'default';
  }

  /* ── Lifecycle ─────────────────────────────────────────────────── */

  onRender() {
    this.#syncLegend();
    this.#syncDescription();
    this.#syncHelper();
    this.#stampOptions();
    this.#syncValue();
    this.#syncDisabled();
  }

  onConnect() {
    this.shadow.addEventListener('change', this.#onChildChange);
    this.addEventListener('change', this.#onSlottedChange);
  }

  onDisconnect() {
    this.shadow.removeEventListener('change', this.#onChildChange);
    this.removeEventListener('change', this.#onSlottedChange);
  }

  onAttributeChanged(name, oldValue, newValue) {
    super.onAttributeChanged(name, oldValue, newValue);
    switch (name) {
      case 'data-label':       this.#syncLegend(); break;
      case 'data-description': this.#syncDescription(); break;
      case 'data-helper':      this.#syncHelper(); break;
      case 'data-options':     this.#stampOptions(); this.#syncValue(); break;
      case 'data-value':       this.#syncValue(); break;
      case 'data-template':    this.renderTemplate(this.templateId).then(() => this.onRender()); break;
      case 'disabled':         this.#syncDisabled(); break;
    }
  }

  /* ── Public API ────────────────────────────────────────────────── */

  get value() { return this.#readValue(); }
  set value(arr) { this.setValue(arr); }

  getValue() { return this.#readValue(); }

  setValue(arr) {
    const list = Array.isArray(arr) ? arr.map(String) : [];
    this.dataset.value = JSON.stringify(list);
  }

  clear() { this.setValue([]); }

  /* ── Private ───────────────────────────────────────────────────── */

  #syncLegend() {
    const el = this.$('.group-label');
    if (el) el.textContent = this.dataset.label || '';
  }

  #syncDescription() {
    const el = this.$('.group-description');
    if (el) el.textContent = this.dataset.description || '';
  }

  #syncHelper() {
    const el = this.$('.group-helper');
    if (el) el.textContent = this.dataset.helper || '';
  }

  #stampOptions() {
    if (this.templateId !== 'default') return;
    const host = this.$('.group-options');
    if (!host) return;

    const raw = this.dataset.options;
    if (!raw) return;
    let opts;
    try { opts = JSON.parse(raw); } catch { return; }
    if (!Array.isArray(opts)) return;

    // Replace any previously-stamped checkboxes (children we created).
    // We tag stamped children with data-stamped so consumer-supplied slot
    // children remain untouched.
    [...this.querySelectorAll('sherpa-input-checkbox[data-stamped]')]
      .forEach((n) => n.remove());

    const frag = document.createDocumentFragment();
    for (const opt of opts) {
      const el = document.createElement('sherpa-input-checkbox');
      el.dataset.stamped = '';
      el.setAttribute('value', opt.value);
      if (opt.label) el.dataset.label = opt.label;
      if (opt.description) el.dataset.description = opt.description;
      if (opt.disabled) el.setAttribute('disabled', '');
      const name = this.getAttribute('name');
      if (name) el.setAttribute('name', name);
      frag.appendChild(el);
    }
    this.appendChild(frag);
  }

  #readValue() {
    const inputs = this.#allInputs();
    return inputs.filter((i) => i.checked).map((i) => i.value);
  }

  #syncValue() {
    let target;
    try { target = JSON.parse(this.dataset.value || '[]'); }
    catch { target = []; }
    if (!Array.isArray(target)) target = [];
    const set = new Set(target.map(String));
    for (const input of this.#allInputs()) {
      const should = set.has(String(input.value));
      if (input.checked !== should) input.checked = should;
      // Mirror to host attribute on sherpa-input-checkbox children
      const host = input.closest('sherpa-input-checkbox');
      if (host) {
        should ? host.setAttribute('checked', '')
               : host.removeAttribute('checked');
      }
    }
  }

  #syncDisabled() {
    const disable = this.hasAttribute('disabled');
    for (const input of this.#allInputs()) {
      input.disabled = disable;
      const host = input.closest('sherpa-input-checkbox');
      if (host) {
        disable ? host.setAttribute('disabled', '')
                : host.removeAttribute('disabled');
      }
    }
  }

  /** All native checkbox inputs across both shadow (weekdays) and light DOM. */
  #allInputs() {
    const shadowInputs = [...this.$$('.weekday-input')];
    const lightInputs = [...this.querySelectorAll('sherpa-input-checkbox')]
      .map((el) => el.shadowRoot?.querySelector('.check-input'))
      .filter(Boolean);
    return [...shadowInputs, ...lightInputs];
  }

  #onChildChange = () => this.#emitChange();
  #onSlottedChange = (e) => {
    if (e.target === this) return;        // ignore our own re-dispatch
    if (e.target.tagName === 'SHERPA-INPUT-CHECKBOX') this.#emitChange();
  };

  #emitChange() {
    const value = this.#readValue();
    // Reflect to attribute without triggering observer-triggered re-stamp.
    const serialised = JSON.stringify(value);
    if (this.dataset.value !== serialised) this.dataset.value = serialised;
    this.dispatchEvent(new CustomEvent('change', {
      bubbles: true, composed: true,
      detail: { value, values: value },
    }));
  }
}

customElements.define('sherpa-input-checkbox-group', SherpaInputCheckboxGroup);
