/**
 * StatusMixin — Adds status attribute support to a SherpaElement subclass.
 *
 * Provides:
 *   • `data-status` in observedAttributes
 *   • `status` getter/setter
 *   • `statusIcon` getter (resolves via `statusIcons` map)
 *   • `static statusIcons` — default status → FA icon class map
 *   • `onStatusChanged(newValue, oldValue)` hook
 *
 * Usage:
 *   import { SherpaElement } from './sherpa-element/sherpa-element.js';
 *   import { StatusMixin } from './status-mixin.js';
 *
 *   class SherpaCallout extends StatusMixin(SherpaElement) { ... }
 *
 * Subclasses can override `static get statusIcons()` to add or replace
 * icons (e.g. toast overrides `critical` to use `fa-circle-xmark`).
 */

/**
 * @param {typeof HTMLElement} Base
 * @returns {typeof HTMLElement}
 */
export const StatusMixin = (Base) =>
  class extends Base {
    static get observedAttributes() {
      return [...super.observedAttributes, "data-status"];
    }

    /**
     * Default status → Font Awesome icon class map.
     * Override in subclass to customise icons.
     */
    static get statusIcons() {
      return {
        success: "fa-solid fa-circle-check",
        error: "fa-solid fa-circle-exclamation",
        critical: "fa-solid fa-circle-exclamation",
        warning: "fa-solid fa-triangle-exclamation",
        info: "fa-solid fa-circle-info",
        neutral: "fa-regular fa-circle",
        urgent: "fa-solid fa-bolt",
        default: null,
        none: null,
      };
    }

    /** Current status value, or null if unset. */
    get status() {
      return this.dataset.status || null;
    }
    set status(v) {
      v ? (this.dataset.status = v) : delete this.dataset.status;
    }

    /** Font Awesome class for the current status icon, or null. */
    get statusIcon() {
      return this.constructor.statusIcons?.[this.status] || null;
    }

    /** Called when status attribute changes. Override for status-specific logic. */
    onStatusChanged(_newValue, _oldValue) {}

    onAttributeChanged(name, oldValue, newValue) {
      if (name === "data-status") {
        this.onStatusChanged(newValue, oldValue);
      }
      super.onAttributeChanged(name, oldValue, newValue);
    }
  };
