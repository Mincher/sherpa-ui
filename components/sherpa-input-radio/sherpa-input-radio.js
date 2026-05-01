/**
 * sherpa-input-radio.js
 * SherpaInputRadio — Atomic radio primitive.
 *
 * Single radio with label-on-the-right. Use multiple instances sharing a
 * `name` to form a logical group, or wrap in `sherpa-input-radio-group`
 * which manages the shared name + value coordination.
 *
 * @element sherpa-input-radio
 *
 * @attr {string}  [name]             — Form field name (radios sharing a name group together)
 * @attr {string}  [value]            — Value submitted when selected
 * @attr {boolean} [checked]          — Initial / current selected state
 * @attr {boolean} [disabled]         — Disabled state
 * @attr {boolean} [required]         — Required constraint
 * @attr {string}  [data-label]       — Inline label text
 * @attr {string}  [data-description] — Helper line below the label
 * @attr {enum}    [data-status]      — critical | warning | success | info | urgent
 *
 * @fires change — User selected this radio.
 *   bubbles: true, composed: true
 *   detail: { checked: boolean, value: string }
 *
 * @prop {boolean} checked — Read/write checked state
 * @prop {string}  value   — Submitted value
 *
 * @method focus() — Move focus to the underlying native input.
 */

import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';
import { StatusMixin } from '../utilities/status-mixin.js';

export class SherpaInputRadio extends StatusMixin(SherpaElement) {

  static get cssUrl()  { return new URL('./sherpa-input-radio.css', import.meta.url).href; }
  static get htmlUrl() { return new URL('./sherpa-input-radio.html', import.meta.url).href; }

  static get observedAttributes() {
    return [
      ...super.observedAttributes,
      'name', 'value', 'checked', 'disabled', 'required',
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
      case 'disabled':
      case 'required':         this.#syncNative(); break;
    }
  }

  /* ── Public API ────────────────────────────────────────────────── */

  get checked()  { return this.hasAttribute('checked'); }
  set checked(v) { v ? this.setAttribute('checked', '') : this.removeAttribute('checked'); }

  get value()  { return this.getAttribute('value') ?? ''; }
  set value(v) { v == null ? this.removeAttribute('value') : this.setAttribute('value', String(v)); }

  get disabled()  { return this.hasAttribute('disabled'); }
  set disabled(v) { v ? this.setAttribute('disabled', '') : this.removeAttribute('disabled'); }

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
    input.disabled = this.disabled;
    input.required = this.hasAttribute('required');
    const name = this.getAttribute('name');
    name != null ? input.setAttribute('name', name) : input.removeAttribute('name');
    input.value = this.value;
  }

  #onChange = () => {
    const input = this.#input;
    if (!input) return;
    input.checked
      ? this.setAttribute('checked', '')
      : this.removeAttribute('checked');
    this.dispatchEvent(new CustomEvent('change', {
      bubbles: true, composed: true,
      detail: { checked: input.checked, value: this.value },
    }));
  };
}

customElements.define('sherpa-input-radio', SherpaInputRadio);
