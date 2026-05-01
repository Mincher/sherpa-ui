/**
 * sherpa-input-radio-group.js
 * SherpaInputRadioGroup — Group of radios with shared label, description,
 * helper and a single selected value.
 *
 * @element sherpa-input-radio-group
 *
 * @attr {string}  [name]              — Field name; cascaded to children
 * @attr {string}  [data-label]        — Group legend
 * @attr {string}  [data-description]  — Sub-label below the legend
 * @attr {string}  [data-helper]       — Helper text below the options
 * @attr {enum}    [data-orientation]  — vertical (default) | horizontal
 * @attr {json}    [data-options]      — [{value,label,description?,disabled?}]
 * @attr {string}  [data-value]        — Currently selected value
 * @attr {enum}    [data-status]       — critical | warning | success | info | urgent
 * @attr {boolean} [disabled]
 * @attr {boolean} [required]
 *
 * @fires change — Selection changed.
 *   bubbles: true, composed: true
 *   detail: { value: string }
 *
 * @prop {string} value — Currently selected value
 *
 * @method getValue()    — Returns current value or null.
 * @method setValue(v)   — Replace current value.
 * @method clear()       — Deselect all.
 */

import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';
import { StatusMixin } from '../utilities/status-mixin.js';

let _gid = 0;

export class SherpaInputRadioGroup extends StatusMixin(SherpaElement) {

  static get cssUrl()  { return new URL('./sherpa-input-radio-group.css', import.meta.url).href; }
  static get htmlUrl() { return new URL('./sherpa-input-radio-group.html', import.meta.url).href; }

  static get observedAttributes() {
    return [
      ...super.observedAttributes,
      'name', 'data-label', 'data-description', 'data-helper',
      'data-options', 'data-value', 'disabled', 'required',
    ];
  }

  /* ── Lifecycle ─────────────────────────────────────────────────── */

  onRender() {
    if (!this.getAttribute('name')) {
      this.setAttribute('name', `sherpa-radio-group-${++_gid}`);
    }
    this.#syncLegend();
    this.#syncDescription();
    this.#syncHelper();
    this.#stampOptions();
    this.#syncValue();
    this.#syncDisabled();
  }

  onConnect() {
    this.addEventListener('change', this.#onChildChange);
  }

  onDisconnect() {
    this.removeEventListener('change', this.#onChildChange);
  }

  onAttributeChanged(name, oldValue, newValue) {
    super.onAttributeChanged(name, oldValue, newValue);
    switch (name) {
      case 'data-label':       this.#syncLegend(); break;
      case 'data-description': this.#syncDescription(); break;
      case 'data-helper':      this.#syncHelper(); break;
      case 'data-options':     this.#stampOptions(); this.#syncValue(); break;
      case 'data-value':       this.#syncValue(); break;
      case 'disabled':         this.#syncDisabled(); break;
      case 'name':             this.#cascadeName(); break;
    }
  }

  /* ── Public API ────────────────────────────────────────────────── */

  get value() { return this.getValue(); }
  set value(v) { this.setValue(v); }

  getValue() {
    const checked = [...this.querySelectorAll('sherpa-input-radio')]
      .find((el) => el.checked);
    return checked?.value ?? null;
  }

  setValue(v) {
    if (v == null) this.removeAttribute('data-value');
    else this.dataset.value = String(v);
  }

  clear() { this.setValue(null); }

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
    const raw = this.dataset.options;
    if (!raw) return;
    let opts;
    try { opts = JSON.parse(raw); } catch { return; }
    if (!Array.isArray(opts)) return;

    [...this.querySelectorAll('sherpa-input-radio[data-stamped]')]
      .forEach((n) => n.remove());

    const name = this.getAttribute('name');
    const frag = document.createDocumentFragment();
    for (const opt of opts) {
      const el = document.createElement('sherpa-input-radio');
      el.dataset.stamped = '';
      el.setAttribute('value', opt.value);
      if (opt.label) el.dataset.label = opt.label;
      if (opt.description) el.dataset.description = opt.description;
      if (opt.disabled) el.setAttribute('disabled', '');
      if (name) el.setAttribute('name', name);
      frag.appendChild(el);
    }
    this.appendChild(frag);
  }

  #cascadeName() {
    const name = this.getAttribute('name');
    for (const el of this.querySelectorAll('sherpa-input-radio')) {
      if (name) el.setAttribute('name', name);
      else el.removeAttribute('name');
    }
  }

  #syncValue() {
    const target = this.dataset.value;
    for (const el of this.querySelectorAll('sherpa-input-radio')) {
      const should = target != null && String(el.value) === String(target);
      if (el.checked !== should) {
        should ? el.setAttribute('checked', '') : el.removeAttribute('checked');
      }
    }
  }

  #syncDisabled() {
    const disable = this.hasAttribute('disabled');
    for (const el of this.querySelectorAll('sherpa-input-radio')) {
      disable ? el.setAttribute('disabled', '') : el.removeAttribute('disabled');
    }
  }

  #onChildChange = (e) => {
    if (e.target === this) return;
    if (e.target.tagName !== 'SHERPA-INPUT-RADIO') return;
    const v = this.getValue();
    if (v != null && this.dataset.value !== String(v)) this.dataset.value = String(v);
    this.dispatchEvent(new CustomEvent('change', {
      bubbles: true, composed: true,
      detail: { value: v },
    }));
  };
}

customElements.define('sherpa-input-radio-group', SherpaInputRadioGroup);
