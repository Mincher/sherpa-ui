/**
 * sherpa-input-checkbox.js
 * SherpaInputCheckbox — Atomic checkbox primitive.
 *
 * Single checkbox with label-on-the-right. Designed for both standalone
 * use (e.g. "I accept the terms") and as a child of `sherpa-input-checkbox-group`.
 *
 * @element sherpa-input-checkbox
 *
 * @attr {string}  [name]             — Form field name
 * @attr {string}  [value]            — Submitted value when checked (default "on")
 * @attr {boolean} [checked]          — Initial / current checked state
 * @attr {boolean} [indeterminate]    — Mixed state (overrides checked visually)
 * @attr {boolean} [disabled]         — Disabled state
 * @attr {boolean} [required]         — Required constraint
 * @attr {string}  [data-label]       — Inline label text
 * @attr {string}  [data-description] — Helper line below the label
 * @attr {enum}    [data-status]      — critical | warning | success | info | urgent
 *
 * @fires change — User toggled the checkbox.
 *   bubbles: true, composed: true
 *   detail: { checked: boolean, value: string, indeterminate: boolean }
 *
 * @prop {boolean} checked       — Read/write checked state
 * @prop {boolean} indeterminate — Read/write indeterminate state
 * @prop {string}  value         — Submitted value
 *
 * @method focus() — Move focus to the underlying native input.
 */

import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';
import { StatusMixin } from '../utilities/status-mixin.js';

export class SherpaInputCheckbox extends StatusMixin(SherpaElement) {

  static get cssUrl()  { return new URL('./sherpa-input-checkbox.css', import.meta.url).href; }
  static get htmlUrl() { return new URL('./sherpa-input-checkbox.html', import.meta.url).href; }

  static get observedAttributes() {
    return [
      ...super.observedAttributes,
      'name', 'value', 'checked', 'indeterminate', 'disabled', 'required',
      'data-label', 'data-description',
    ];
  }

  /* ── Lifecycle ─────────────────────────────────────────────────── */

  onRender() {
    this.#syncLabel();
    this.#syncDescription();
    this.#syncNative();
  }

  onConnect() {
    const input = this.#input;
    if (input) input.addEventListener('change', this.#onChange);
  }

  onDisconnect() {
    const input = this.#input;
    if (input) input.removeEventListener('change', this.#onChange);
  }

  onAttributeChanged(name, oldValue, newValue) {
    super.onAttributeChanged(name, oldValue, newValue);
    switch (name) {
      case 'data-label':       this.#syncLabel(); break;
      case 'data-description': this.#syncDescription(); break;
      case 'name':
      case 'value':
      case 'checked':
      case 'indeterminate':
      case 'disabled':
      case 'required':         this.#syncNative(); break;
    }
  }

  /* ── Public API ────────────────────────────────────────────────── */

  get checked()  { return this.hasAttribute('checked'); }
  set checked(v) { v ? this.setAttribute('checked', '') : this.removeAttribute('checked'); }

  get indeterminate()  { return this.hasAttribute('indeterminate'); }
  set indeterminate(v) {
    v ? this.setAttribute('indeterminate', '') : this.removeAttribute('indeterminate');
  }

  get value()  { return this.getAttribute('value') ?? 'on'; }
  set value(v) { v == null ? this.removeAttribute('value') : this.setAttribute('value', String(v)); }

  get disabled()  { return this.hasAttribute('disabled'); }
  set disabled(v) { v ? this.setAttribute('disabled', '') : this.removeAttribute('disabled'); }

  get required()  { return this.hasAttribute('required'); }
  set required(v) { v ? this.setAttribute('required', '') : this.removeAttribute('required'); }

  focus(opts) { this.#input?.focus(opts); }

  /* ── Private ───────────────────────────────────────────────────── */

  get #input() { return this.$('.check-input'); }

  #syncLabel() {
    const el = this.$('.check-text');
    if (el) el.textContent = this.dataset.label || '';
  }

  #syncDescription() {
    const el = this.$('.check-description');
    if (el) el.textContent = this.dataset.description || '';
  }

  #syncNative() {
    const input = this.#input;
    if (!input) return;

    input.checked = this.checked;
    input.indeterminate = this.indeterminate;
    input.disabled = this.disabled;
    input.required = this.required;

    const name = this.getAttribute('name');
    name != null ? input.setAttribute('name', name) : input.removeAttribute('name');
    input.value = this.value;
  }

  #onChange = () => {
    const input = this.#input;
    if (!input) return;

    // Mirror native state back to host attributes
    input.checked
      ? this.setAttribute('checked', '')
      : this.removeAttribute('checked');
    // Native toggling clears indeterminate
    if (this.hasAttribute('indeterminate')) this.removeAttribute('indeterminate');

    this.dispatchEvent(new CustomEvent('change', {
      bubbles: true, composed: true,
      detail: {
        checked: input.checked,
        value: this.value,
        indeterminate: input.indeterminate,
      },
    }));
  };
}

customElements.define('sherpa-input-checkbox', SherpaInputCheckbox);
