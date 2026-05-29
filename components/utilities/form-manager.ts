/**
 * FormManager — Read, write, clear, and validate form fields within a container.
 *
 * Discovers sherpa-input-* fields by their `name` attribute and operates on
 * them generically. Works with any dialog or form container that holds
 * named sherpa input components.
 *
 * @module form-manager
 *
 * @example
 * import { FormManager } from 'sherpa-ui/components/utilities/form-manager.js';
 *
 * const form = new FormManager(dialog);
 * form.clear();
 * form.populate({ device_name: 'WS-01', os: 'WINDOWS' });
 * const values = form.read();
 * const missing = form.validate();
 */

const INPUT_SELECTOR = '[name]';

export class FormManager {
  #container;

  /**
   * @param {HTMLElement} container — The element containing named input fields
   */
  constructor(container) {
    this.#container = container;
  }

  /**
   * Read all named field values.
   * @returns {Object} key-value map of field name → current value
   */
  read() {
    const values = {};
    for (const el of this.#fields()) {
      values[el.getAttribute('name')] = el.value ?? '';
    }
    return values;
  }

  /**
   * Read a single field value.
   * @param {string} name — The field name attribute
   * @returns {string} Current value, or empty string if not found
   */
  get(name) {
    const el = this.#field(name);
    return el?.value ?? '';
  }

  /**
   * Populate fields from an object.
   * Only sets values for fields that exist in the container.
   * @param {Object} data — key-value map of field name → value
   */
  populate(data) {
    if (!data) return;
    for (const [name, value] of Object.entries(data)) {
      const el = this.#field(name);
      if (el) el.value = value ?? '';
    }
  }

  /**
   * Clear all named fields to empty strings.
   */
  clear() {
    for (const el of this.#fields()) {
      el.value = '';
    }
  }

  /**
   * Validate required fields.
   * @returns {string[]} Array of field names that are required but empty. Empty array = valid.
   */
  validate() {
    const missing = [];
    for (const el of this.#fields()) {
      if (el.hasAttribute('required') && !el.value?.trim()) {
        missing.push(el.getAttribute('name'));
      }
    }
    return missing;
  }

  /* ── Private ─────────────────────────────────────────────────── */

  /** @returns {HTMLElement[]} All named input elements */
  #fields() {
    return [...this.#container.querySelectorAll(INPUT_SELECTOR)];
  }

  /** @returns {HTMLElement|null} A single named input element */
  #field(name) {
    return this.#container.querySelector(`[name="${CSS.escape(name)}"]`);
  }
}
