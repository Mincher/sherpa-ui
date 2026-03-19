/**
 * @element sherpa-input-date
 * @extends SherpaInputBase
 * @description Date input using the native browser date picker.
 *   Inherits label, description, helper, layout, validation from SherpaInputBase.
 *
 * @attr {string}  [min] — Minimum selectable date (YYYY-MM-DD)
 * @attr {string}  [max] — Maximum selectable date (YYYY-MM-DD)
 *
 * @fires input
 *   bubbles: true, composed: true
 *   detail: { value: string }
 * @fires change
 *   bubbles: true, composed: true
 *   detail: { value: string }
 *
 * @prop {string}  min         — Getter/setter for min attribute
 * @prop {string}  max         — Getter/setter for max attribute
 * @prop {Date|null} valueAsDate — Current value as Date object (getter-only)
 */

import { SherpaInputBase } from '../utilities/sherpa-input-base/sherpa-input-base.js';

export class SherpaInputDate extends SherpaInputBase {

  static get cssUrl()  { return new URL('./sherpa-input-date.css', import.meta.url).href; }
  static get htmlUrl() { return new URL('./sherpa-input-date.html', import.meta.url).href; }

  static get observedAttributes() {
    return [...super.observedAttributes, 'min', 'max'];
  }

  onAttributeChanged(name, oldValue, newValue) {
    super.onAttributeChanged(name, oldValue, newValue);
    if (name === 'min' || name === 'max') {
      const el = this.getInputElement();
      if (el) {
        newValue !== null ? el.setAttribute(name, newValue) : el.removeAttribute(name);
      }
    }
  }

  /* ── Public API ─────────────────────────────────────────────── */

  get min() { return this.getAttribute('min'); }
  set min(v) { v != null ? this.setAttribute('min', v) : this.removeAttribute('min'); }

  get max() { return this.getAttribute('max'); }
  set max(v) { v != null ? this.setAttribute('max', v) : this.removeAttribute('max'); }

  /** Returns value as Date object, or null. */
  get valueAsDate() {
    const v = this.value;
    if (!v) return null;
    const d = new Date(v + 'T00:00:00');
    return isNaN(d.getTime()) ? null : d;
  }
}

customElements.define('sherpa-input-date', SherpaInputDate);
