/**
 * sherpa-input-select.js
 * Dropdown select input extending AuxInputBase using native <select>.
 *
 * @example
 *   <sherpa-input-select label="Country" placeholder="Select a country">
 *     <option value="us">United States</option>
 *     <option value="gb">United Kingdom</option>
 *   </sherpa-input-select>
 *
 * Options can be provided via:
 *   1. Light DOM <option> elements (slotted into the <select>)
 *   2. setOptions([{ value, label, disabled? }]) method
 *
 * Extra attributes: none beyond base.
 *
 * @fires change — { value }
 */

import { AuxInputBase } from '../utilities/sherpa-input-base/sherpa-input-base.js';

export class AuxInputSelect extends AuxInputBase {

  static get cssUrl()  { return new URL('./sherpa-input-select.css', import.meta.url).href; }
  static get htmlUrl() { return new URL('./sherpa-input-select.html', import.meta.url).href; }

  #selectEl = null;

  getInputElement() {
    return this.$('.input-field');
  }

  async onInputRender() {
    this.#selectEl = this.getInputElement();
    // Move slotted <option> elements from light DOM to shadow <select>
    this.#adoptOptions();
    // Set initial placeholder option
    this.#ensurePlaceholder();
  }

  onAttributeChanged(name, oldValue, newValue) {
    super.onAttributeChanged(name, oldValue, newValue);
    if (name === 'placeholder') {
      this.#ensurePlaceholder();
    }
  }

  /* ── Public API ─────────────────────────────────────────────── */

  /**
   * Programmatically set the option list.
   * @param {Array<{value: string, label: string, disabled?: boolean}>} options
   */
  setOptions(options) {
    if (!this.#selectEl) return;
    // Keep placeholder, remove the rest
    const placeholder = this.#selectEl.querySelector('option[value=""]');
    this.#selectEl.innerHTML = '';
    if (placeholder) this.#selectEl.appendChild(placeholder);

    for (const opt of (options || [])) {
      const el = document.createElement('option');
      el.value = opt.value ?? '';
      el.textContent = opt.label || opt.value || '';
      if (opt.disabled) el.disabled = true;
      this.#selectEl.appendChild(el);
    }
  }

  /* ── Internal ───────────────────────────────────────────────── */

  #adoptOptions() {
    if (!this.#selectEl) return;
    // Move <option> children from the host light DOM into the shadow <select>
    const options = this.querySelectorAll('option');
    for (const opt of options) {
      this.#selectEl.appendChild(opt.cloneNode(true));
    }
  }

  #ensurePlaceholder() {
    if (!this.#selectEl) return;
    const ph = this.getAttribute('placeholder');
    let placeholderOpt = this.#selectEl.querySelector('option[value=""]');

    if (ph) {
      if (!placeholderOpt) {
        placeholderOpt = document.createElement('option');
        placeholderOpt.value = '';
        this.#selectEl.prepend(placeholderOpt);
      }
      placeholderOpt.textContent = ph;
      placeholderOpt.disabled = true;
      placeholderOpt.hidden = true;
      if (!this.#selectEl.value) {
        placeholderOpt.selected = true;
      }
    }
  }
}

customElements.define('sherpa-input-select', AuxInputSelect);
