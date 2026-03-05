/**
 * SherpaInputBase — Abstract base class for all form input components.
 *
 * Extends SherpaElement to provide shared behaviour for inputs:
 *   • Label + description rendering via <dl>/<dt>/<dd> semantic pattern
 *   • Status icon display alongside description text
 *   • Horizontal / vertical layout via `layout` attribute
 *   • Disabled / readonly / required attribute mirroring to native control
 *   • Value bridging between host attribute and internal <input>/<select>
 *   • Change / input event re-dispatching (bubbles, composed)
 *
 * Subclasses MUST:
 *   • Set static cssUrl / htmlUrl pointing to their own files
 *   • Include a .input-field element in their template
 *   • Call customElements.define() with their tag name
 *
 * Subclasses MAY override:
 *   • onInputRender() — called after base onRender, for type-specific wiring
 *   • onInputConnect() — called after base onConnect, for type-specific setup
 *   • getInputElement() — if the primary native control isn't .input-field
 *
 * Template contract — subclass HTML should provide a <template id="default">
 * whose content is injected INSIDE the base wrapper:
 *
 *   <dl class="input-wrapper">
 *     <div class="input-header">           ← label + description
 *       <dt class="input-label">…</dt>
 *       <dd class="input-description">…</dd>
 *     </div>
 *     <div class="input-content">          ← control + helper
 *       <div class="input-body">           ← border + overflow:hidden
 *         <dd class="input-control">…</dd>
 *         <dd class="input-validation-message">…</dd>
 *       </div>
 *       <dd class="input-helper">…</dd>
 *     </div>
 *   </dl>
 *
 * The base class builds this wrapper in onRender() and injects the template
 * content into .input-control.
 *
 * CSS:
 *   Each subclass CSS file imports sherpa-input-base.css via @import.
 *   The browser handles loading and cascade natively — no JS involvement.
 */

import { SherpaElement } from '../sherpa-element/sherpa-element.js';

/* ── Component ──────────────────────────────────────────────────── */

export class SherpaInputBase extends SherpaElement {

  /* ── Observed attributes ────────────────────────────────────── */

  static get observedAttributes() {
    return [
      ...super.observedAttributes,
      'data-label', 'data-description', 'data-helper', 'data-layout',
      'disabled', 'readonly', 'required',
      'name', 'value', 'placeholder',
      'pattern', 'minlength', 'maxlength',
      'novalidate'
    ];
  }

  /* ── Internal refs ──────────────────────────────────────────── */

  #labelEl = null;
  #descriptionEl = null;
  #helperEl = null;
  #statusIndicatorEl = null;
  #statusIndicatorIconEl = null;
  #inputEl = null;
  #validationEl = null;

  /* ── Lifecycle hooks ────────────────────────────────────────── */

  async onRender() {
    // The subclass template provides the raw control markup.
    // Wrap it in the standard label/description structure.
    this.#buildWrapper();

    // Cache refs
    this.#labelEl = this.$('.input-label-text');
    this.#descriptionEl = this.$('.input-description-text');
    this.#helperEl = this.$('.input-helper-text');
    this.#statusIndicatorEl = this.$('.status-indicator');
    this.#statusIndicatorIconEl = this.$('.status-indicator-icon');
    this.#validationEl = this.$('.input-validation-message');
    this.#inputEl = this.getInputElement();

    // Apply initial attribute values
    this.#syncLabel();
    this.#syncDescription();
    this.#syncHelper();
    this.#syncStatusIndicator();
    this.#syncNativeAttrs();

    // Let subclass do its own post-render work
    await this.onInputRender();
  }

  onConnect() {
    // Wire events on the native input
    this.#inputEl = this.getInputElement();
    if (this.#inputEl) {
      this.#inputEl.addEventListener('input', this.#onInput);
      this.#inputEl.addEventListener('change', this.#onChange);
      this.#inputEl.addEventListener('blur', this.#onBlur);
      this.#inputEl.addEventListener('invalid', this.#onInvalid);
    }
    this.onInputConnect();
  }

  onDisconnect() {
    if (this.#inputEl) {
      this.#inputEl.removeEventListener('input', this.#onInput);
      this.#inputEl.removeEventListener('change', this.#onChange);
      this.#inputEl.removeEventListener('blur', this.#onBlur);
      this.#inputEl.removeEventListener('invalid', this.#onInvalid);
    }
    this.onInputDisconnect();
  }

  onAttributeChanged(name, oldValue, newValue) {
    switch (name) {
      case 'data-label':
        this.#syncLabel();
        break;
      case 'data-description':
        this.#syncDescription();
        break;
      case 'data-helper':
        this.#syncHelper();
        break;
      case 'data-status':
        this.#syncStatusIndicator();
        break;
      case 'disabled':
      case 'readonly':
      case 'required':
      case 'name':
      case 'placeholder':
      case 'pattern':
      case 'minlength':
      case 'maxlength':
        this.#syncNativeAttrs();
        if (name === 'required') this.#syncLabel();
        break;
      case 'value':
        this.#syncValue();
        break;
    }
  }

  /* ── Subclass hooks (override these, NOT onRender/onConnect) ── */

  /** Called after base onRender(). Override for type-specific element wiring. */
  async onInputRender() {}

  /** Called after base onConnect(). Override for type-specific event wiring. */
  onInputConnect() {}

  /** Called on disconnect. Override for cleanup. */
  onInputDisconnect() {}

  /** Return the primary native <input> or <select> element. */
  getInputElement() {
    return this.$('.input-field');
  }

  /* ── Public API ─────────────────────────────────────────────── */

  get label() { return this.dataset.label || ''; }
  set label(v) { if (v) { this.dataset.label = v; } else { delete this.dataset.label; } }

  get description() { return this.dataset.description || ''; }
  set description(v) { if (v) { this.dataset.description = v; } else { delete this.dataset.description; } }

  get helper() { return this.dataset.helper || ''; }
  set helper(v) { if (v) { this.dataset.helper = v; } else { delete this.dataset.helper; } }

  get layout() { return this.dataset.layout || 'vertical'; }
  set layout(v) { this.dataset.layout = v; }

  get value() {
    const el = this.getInputElement();
    return el ? el.value : (this.getAttribute('value') || '');
  }
  set value(v) {
    const el = this.getInputElement();
    if (el) el.value = v ?? '';
    this.setAttribute('value', v ?? '');
  }

  get name() { return this.getAttribute('name') || ''; }
  set name(v) { this.setAttribute('name', v); }

  get disabled() { return this.hasAttribute('disabled'); }
  set disabled(v) { v ? this.setAttribute('disabled', '') : this.removeAttribute('disabled'); }

  get readOnly() { return this.hasAttribute('readonly'); }
  set readOnly(v) { v ? this.setAttribute('readonly', '') : this.removeAttribute('readonly'); }

  get required() { return this.hasAttribute('required'); }
  set required(v) { v ? this.setAttribute('required', '') : this.removeAttribute('required'); }

  /** Focus the internal native control. */
  focus(opts) {
    const el = this.getInputElement();
    el ? el.focus(opts) : super.focus(opts);
  }

  /* ── Constraint Validation API (delegates to native input) ──── */

  /** Returns the native ValidityState of the inner control. */
  get validity() {
    return this.getInputElement()?.validity;
  }

  /** The native validation message string. */
  get validationMessage() {
    return this.getInputElement()?.validationMessage || '';
  }

  /** Returns true if the native control satisfies its constraints. */
  checkValidity() {
    return this.getInputElement()?.checkValidity() ?? true;
  }

  /** Like checkValidity but also updates the validation message UI. */
  reportValidity() {
    const el = this.getInputElement();
    if (!el) return true;
    // Run custom hook first (subclasses use setCustomValidity here)
    this.validate(el);
    const valid = el.checkValidity();
    this.#updateValidationMessage(el);
    return valid;
  }

  /**
   * Override in subclasses for custom constraint validation.
   * Call el.setCustomValidity(msg) to mark invalid, or '' to clear.
   * This is invoked on every blur before the native validity check.
   */
  validate(_el) {
    // Default: no custom validation — native constraints are used.
  }

  /* ── Wrapper construction ───────────────────────────────────── */

  #buildWrapper() {
    // Collect existing control content from the subclass template
    // (everything that isn't <link> or <style>)
    const fragment = document.createDocumentFragment();
    const children = [...this.shadow.childNodes].filter(
      n => !(n instanceof HTMLLinkElement) && !(n instanceof HTMLStyleElement)
    );
    for (const child of children) fragment.appendChild(child);

    // Build the wrapper structure
    const wrapper = document.createElement('dl');
    wrapper.className = 'input-wrapper';

    // Header (label + description)
    const header = document.createElement('div');
    header.className = 'input-header';

    const dt = document.createElement('dt');
    dt.className = 'input-label text-label';
    dt.innerHTML = '<span class="input-label-text"></span>';
    header.appendChild(dt);

    const desc = document.createElement('dd');
    desc.className = 'input-description text-body-sm';
    desc.innerHTML = '<span class="input-description-text"></span>';
    header.appendChild(desc);

    wrapper.appendChild(header);

    // Content (input-body + helper)
    const content = document.createElement('div');
    content.className = 'input-content';

    // Body (control + validation)
    const body = document.createElement('div');
    body.className = 'input-body';

    // Control — holds the subclass template content + status indicator at end
    const control = document.createElement('dd');
    control.className = 'input-control';
    control.appendChild(fragment);

    // Status indicator icon (at the end of the control area)
    const indicator = document.createElement('span');
    indicator.className = 'status-indicator';
    indicator.setAttribute('aria-hidden', 'true');
    indicator.innerHTML = '<i class="status-indicator-icon"></i>';
    control.appendChild(indicator);

    body.appendChild(control);

    // Validation message — coloured status bar below the input
    const validation = document.createElement('dd');
    validation.className = 'input-validation-message';
    validation.setAttribute('aria-live', 'polite');
    body.appendChild(validation);

    content.appendChild(body);

    // Helper text — below the input body
    const helper = document.createElement('dd');
    helper.className = 'input-helper text-body-sm';
    helper.innerHTML = '<span class="input-helper-text"></span>';
    content.appendChild(helper);

    wrapper.appendChild(content);

    this.shadow.appendChild(wrapper);
  }

  /* ── Sync helpers ───────────────────────────────────────────── */

  #syncLabel() {
    if (!this.#labelEl) return;
    const label = this.dataset.label || '';
    const req = this.hasAttribute('required');
    this.#labelEl.textContent = label;
    // Add/remove required asterisk
    let asterisk = this.#labelEl.parentElement.querySelector('.input-required');
    if (req && label) {
      if (!asterisk) {
        asterisk = document.createElement('span');
        asterisk.className = 'input-required';
        asterisk.textContent = ' *';
        asterisk.setAttribute('aria-hidden', 'true');
        this.#labelEl.after(asterisk);
      }
    } else if (asterisk) {
      asterisk.remove();
    }
  }

  #syncDescription() {
    if (!this.#descriptionEl) return;
    this.#descriptionEl.textContent = this.dataset.description || '';
  }

  #syncHelper() {
    if (!this.#helperEl) return;
    this.#helperEl.textContent = this.dataset.helper || '';
  }

  /**
   * Update the status indicator icon in the input-control area.
   * The icon class is determined by the host's status attribute.
   */
  #syncStatusIndicator() {
    if (!this.#statusIndicatorIconEl) return;
    const status = this.status;
    const iconCls = status ? (this.constructor.statusIcons?.[status] || '') : '';
    if (iconCls) {
      this.#statusIndicatorIconEl.className = `status-indicator-icon ${iconCls}`;
    } else {
      this.#statusIndicatorIconEl.className = 'status-indicator-icon';
    }
  }

  #syncNativeAttrs() {
    const el = this.getInputElement();
    if (!el) return;

    // Boolean attributes
    for (const attr of ['disabled', 'readonly', 'required']) {
      this.hasAttribute(attr) ? el.setAttribute(attr, '') : el.removeAttribute(attr);
    }
    // Value attributes
    for (const attr of ['name', 'placeholder', 'pattern', 'minlength', 'maxlength']) {
      const val = this.getAttribute(attr);
      val !== null ? el.setAttribute(attr, val) : el.removeAttribute(attr);
    }
  }

  #syncValue() {
    const el = this.getInputElement();
    if (!el) return;
    const v = this.getAttribute('value') ?? '';
    if (el.value !== v) el.value = v;
  }

  /* ── Event forwarding ───────────────────────────────────────── */

  #onInput = (e) => {
    this.dispatchEvent(new CustomEvent('input', {
      bubbles: true,
      composed: true,
      detail: { value: e.target.value }
    }));
  };

  #onChange = (e) => {
    this.dispatchEvent(new CustomEvent('change', {
      bubbles: true,
      composed: true,
      detail: { value: e.target.value }
    }));
  };

  /* ── Validation ─────────────────────────────────────────────── */

  /**
   * Blur handler — run the subclass validate() hook, then populate
   * the validation message text from the native validationMessage.
   * The border colour change is handled entirely by CSS :user-invalid.
   * Also updates the status indicator icon for native validation errors.
   */
  #onBlur = () => {
    if (this.hasAttribute('novalidate')) return;
    const el = this.getInputElement();
    if (!el) return;

    // Let subclasses set custom validity (e.g. range checks)
    this.validate(el);
    this.#updateValidationMessage(el);

    // For native validation (no explicit status), show/hide the critical icon
    if (!this.dataset.status && this.#statusIndicatorIconEl) {
      const errorIconCls = this.constructor.statusIcons?.critical || this.constructor.statusIcons?.error || 'fa-solid fa-circle-exclamation';
      if (!el.validity.valid) {
        this.#statusIndicatorIconEl.className = `status-indicator-icon ${errorIconCls}`;
      } else {
        this.#statusIndicatorIconEl.className = 'status-indicator-icon';
      }
    }
  };

  /**
   * Suppress the browser's built-in validation tooltip so only
   * our custom message element is displayed.
   */
  #onInvalid = (e) => {
    e.preventDefault();
  };

  /**
   * Copy the browser's validationMessage into our shadow DOM element.
   * CSS shows/hides the element based on :user-invalid.
   */
  #updateValidationMessage(el) {
    if (this.#validationEl) {
      this.#validationEl.textContent = el.validationMessage || '';
    }
  }
}
