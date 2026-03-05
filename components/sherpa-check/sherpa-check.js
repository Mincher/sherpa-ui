/**
 * sherpa-check.js
 * Checkbox and radio button extending SherpaElement.
 *
 * @example
 *   <sherpa-check label="Accept terms" description="Required to continue"></sherpa-check>
 *   <sherpa-check type="radio" name="color" value="red" label="Red"></sherpa-check>
 *   <sherpa-check type="radio" name="color" value="blue" label="Blue" checked></sherpa-check>
 *   <sherpa-check checked indeterminate label="Select all"></sherpa-check>
 *   <sherpa-check disabled label="Unavailable option"></sherpa-check>
 *
 * Attributes:
 *   data-type        — "checkbox" (default) | "radio"
 *   checked          — boolean (native)
 *   indeterminate    — boolean (native, checkbox only)
 *   disabled         — boolean (native)
 *   name             — form field name (native)
 *   value            — form field value (native)
 *   data-label       — visible label text
 *   data-description — help text below the label
 *   data-status      — critical | warning | success | info
 *
 * @fires change — { checked, value }
 */

import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';

export class SherpaCheck extends SherpaElement {

  static get cssUrl()  { return new URL('./sherpa-check.css', import.meta.url).href; }
  static get htmlUrl() { return new URL('./sherpa-check.html', import.meta.url).href; }

  static get observedAttributes() {
    return [
      ...super.observedAttributes,
      'data-type', 'checked', 'indeterminate', 'disabled',
      'name', 'value', 'data-label', 'data-description', 'required'
    ];
  }

  #inputEl = null;
  #labelEl = null;
  #descEl = null;
  #visualEl = null;
  #validationEl = null;
  #interacted = false;

  /* ── Template selection ─────────────────────────────────────── */

  get templateId() {
    return this.dataset.type === 'radio' ? 'radio' : 'checkbox';
  }

  /* ── Lifecycle ──────────────────────────────────────────────── */

  onRender() {
    // Migrate pre-upgrade own properties that shadow prototype accessors.
    // When <sherpa-check> is cloned from a <template>, the element isn't
    // upgraded yet. Setting e.g. `el.checked = true` creates a plain data
    // property that permanently shadows the class getter/setter, so the
    // attribute is never set and the visual CSS never matches. Deleting the
    // own prop and re-assigning routes through the setter correctly.
    for (const prop of ['checked', 'indeterminate', 'disabled']) {
      if (Object.prototype.hasOwnProperty.call(this, prop)) {
        const val = this[prop];
        delete this[prop];
        this[prop] = val;
      }
    }

    this.#inputEl = this.$('.check-native');
    this.#labelEl = this.$('.check-label');
    this.#descEl = this.$('.check-description');
    this.#visualEl = this.$('.check-visual');
    this.#validationEl = this.$('.check-validation');

    this.#syncAll();
  }

  onConnect() {
    this.$('.check-wrapper')?.addEventListener('click', this.#onClick);
    this.$('.check-wrapper')?.addEventListener('keydown', this.#onKeyDown);
    this.$('.check-wrapper')?.addEventListener('focusout', this.#onBlur);
  }

  onDisconnect() {
    this.$('.check-wrapper')?.removeEventListener('click', this.#onClick);
    this.$('.check-wrapper')?.removeEventListener('keydown', this.#onKeyDown);
    this.$('.check-wrapper')?.removeEventListener('focusout', this.#onBlur);
  }

  onAttributeChanged(name) {
    switch (name) {
      case 'data-type':
        this.renderTemplate(this.templateId);
        break;
      case 'checked':
      case 'indeterminate':
        this.#syncState();
        this.#validateCheck();
        break;
      case 'disabled':
        this.#syncDisabled();
        break;
      case 'required':
        this.#syncRequired();
        this.#validateCheck();
        break;
      case 'data-label':
        this.#syncLabel();
        break;
      case 'data-description':
        this.#syncDescription();
        break;
      case 'name':
      case 'value':
        this.#syncNameValue();
        break;
    }
  }

  /* ── Public API ─────────────────────────────────────────────── */

  get type() { return this.dataset.type || 'checkbox'; }
  set type(v) { this.dataset.type = v; }

  get checked() { return this.hasAttribute('checked'); }
  set checked(v) { v ? this.setAttribute('checked', '') : this.removeAttribute('checked'); }

  get indeterminate() { return this.hasAttribute('indeterminate'); }
  set indeterminate(v) { v ? this.setAttribute('indeterminate', '') : this.removeAttribute('indeterminate'); }

  get disabled() { return this.hasAttribute('disabled'); }
  set disabled(v) { v ? this.setAttribute('disabled', '') : this.removeAttribute('disabled'); }

  get name() { return this.getAttribute('name') || ''; }
  set name(v) { this.setAttribute('name', v); }

  get value() { return this.getAttribute('value') || 'on'; }
  set value(v) { this.setAttribute('value', v); }

  get label() { return this.dataset.label || ''; }
  set label(v) { if (v) { this.dataset.label = v; } else { delete this.dataset.label; } }

  get description() { return this.dataset.description || ''; }
  set description(v) { if (v) { this.dataset.description = v; } else { delete this.dataset.description; } }

  get required() { return this.hasAttribute('required'); }
  set required(v) { v ? this.setAttribute('required', '') : this.removeAttribute('required'); }

  /* ── Constraint Validation API ──────────────────────────────── */

  get validity()          { return this.#inputEl?.validity; }
  get validationMessage() { return this.#inputEl?.validationMessage || ''; }
  checkValidity()         { return this.#inputEl?.checkValidity() ?? true; }
  reportValidity() {
    this.#interacted = true;
    this.#validateCheck();
    return this.checkValidity();
  }

  /* ── Internal ───────────────────────────────────────────────── */

  #onClick = (e) => {
    if (this.disabled) return;
    e.preventDefault();
    this.#interacted = true;
    this.#toggle();
  };

  #onKeyDown = (e) => {
    if (this.disabled) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      this.#interacted = true;
      this.#toggle();
    }
  };

  #onBlur = () => {
    this.#interacted = true;
    this.#validateCheck();
  };

  #toggle() {
    if (this.type === 'radio') {
      // Radios can only be set, not unset by clicking
      if (this.checked) return;
      // Uncheck siblings with the same name
      if (this.name) {
        const siblings = document.querySelectorAll(`sherpa-check[data-type="radio"][name="${CSS.escape(this.name)}"]`);
        siblings.forEach(s => { if (s !== this) s.removeAttribute('checked'); });
      }
      this.checked = true;
    } else {
      // Checkbox toggles + clears indeterminate
      this.removeAttribute('indeterminate');
      this.checked = !this.checked;
    }

    this.dispatchEvent(new CustomEvent('change', {
      bubbles: true,
      composed: true,
      detail: { checked: this.checked, value: this.value }
    }));
  }

  #syncAll() {
    this.#syncState();
    this.#syncDisabled();
    this.#syncRequired();
    this.#syncLabel();
    this.#syncDescription();
    this.#syncNameValue();
  }

  #syncState() {
    if (this.#inputEl) {
      this.#inputEl.checked = this.checked;
      this.#inputEl.indeterminate = this.indeterminate;
    }
  }

  #syncDisabled() {
    if (this.#inputEl) this.#inputEl.disabled = this.disabled;
  }

  #syncLabel() {
    if (this.#labelEl) this.#labelEl.textContent = this.dataset.label || '';
  }

  #syncDescription() {
    if (this.#descEl) {
      const desc = this.dataset.description || '';
      this.#descEl.textContent = desc;
      this.#descEl.toggleAttribute('hidden', !desc);
    }
  }

  #syncNameValue() {
    if (!this.#inputEl) return;
    const name = this.getAttribute('name');
    const value = this.getAttribute('value');
    name ? this.#inputEl.setAttribute('name', name) : this.#inputEl.removeAttribute('name');
    this.#inputEl.value = value || 'on';
  }

  #syncRequired() {
    if (!this.#inputEl) return;
    this.hasAttribute('required')
      ? this.#inputEl.setAttribute('required', '')
      : this.#inputEl.removeAttribute('required');
  }

  /**
   * After user interaction, check native validity on the hidden input.
   * Set/remove data-user-invalid so CSS can style the visual control.
   * Populate the validation message element with the native message.
   */
  #validateCheck() {
    if (!this.#interacted || !this.#inputEl) return;
    const valid = this.#inputEl.checkValidity();
    this.toggleAttribute('data-user-invalid', !valid);

    // Update validation message text
    if (this.#validationEl) {
      this.#validationEl.textContent = valid ? '' : this.#inputEl.validationMessage;
      this.#validationEl.toggleAttribute('hidden', valid);
    }
  }
}

customElements.define('sherpa-check', SherpaCheck);
