/**
 * @element sherpa-input-select
 * @extends SherpaInputBase
 * @description Dropdown select input using native <select>. Options provided
 *   via light DOM <option> elements or programmatically via setOptions().
 *   Inherits label, description, helper, layout, validation from SherpaInputBase.
 *
 * @fires change
 *   bubbles: true, composed: true
 *   detail: { value: string }
 *
 * @method setOptions(options) — Set option list: Array<{ value, label, disabled? }>
 */

import { SherpaInputBase } from "../utilities/sherpa-input-base/sherpa-input-base.js";

export class SherpaInputSelect extends SherpaInputBase {
  static get cssUrl() {
    return new URL("./sherpa-input-select.css", import.meta.url).href;
  }
  static get htmlUrl() {
    return new URL("./sherpa-input-select.html", import.meta.url).href;
  }

  #selectEl = null;
  #pendingOptions = null;

  getInputElement() {
    return this.$(".input-field");
  }

  async onInputRender() {
    this.#selectEl = this.getInputElement();
    // Move slotted <option> elements from light DOM to shadow <select>
    this.#adoptOptions();
    // If setOptions() was called before the inner <select> existed,
    // flush the queued list now.
    if (this.#pendingOptions) {
      const queued = this.#pendingOptions;
      this.#pendingOptions = null;
      this.setOptions(queued);
    }
    // Set initial placeholder option
    this.#ensurePlaceholder();
  }

  onAttributeChanged(name, oldValue, newValue) {
    super.onAttributeChanged(name, oldValue, newValue);
    if (name === "placeholder") {
      this.#ensurePlaceholder();
    }
  }

  /* ── Public API ─────────────────────────────────────────────── */

  /**
   * Programmatically set the option list.
   * @param {Array<{value: string, label: string, disabled?: boolean}>} options
   */
  setOptions(options) {
    if (!this.#selectEl) {
      // Component hasn't finished rendering yet — queue the call so
      // onInputRender() can flush it once the inner <select> exists.
      this.#pendingOptions = options ? [...options] : [];
      return;
    }
    // Keep placeholder, remove the rest
    const placeholder = this.#selectEl.querySelector('option[value=""]');
    this.#selectEl.replaceChildren();
    if (placeholder) this.#selectEl.appendChild(placeholder);

    for (const opt of options || []) {
      const el = document.createElement("option");
      el.value = opt.value ?? "";
      el.textContent = opt.label || opt.value || "";
      if (opt.disabled) el.disabled = true;
      this.#selectEl.appendChild(el);
    }
    // Re-apply pending value from host attribute (if any) now that the
    // matching <option> exists in the DOM.
    const hostValue = this.getAttribute("value");
    if (hostValue && this.#selectEl.value !== hostValue) {
      this.#selectEl.value = hostValue;
    }
  }

  /* ── Internal ───────────────────────────────────────────────── */

  #adoptOptions() {
    if (!this.#selectEl) return;
    // Move <option> children from the host light DOM into the shadow <select>
    const options = this.querySelectorAll("option");
    for (const opt of options) {
      this.#selectEl.appendChild(opt.cloneNode(true));
    }
  }

  #ensurePlaceholder() {
    if (!this.#selectEl) return;
    const ph = this.getAttribute("placeholder");
    let placeholderOpt = this.#selectEl.querySelector('option[value=""]');

    if (ph) {
      if (!placeholderOpt) {
        placeholderOpt = document.createElement("option");
        placeholderOpt.value = "";
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

customElements.define("sherpa-input-select", SherpaInputSelect);
