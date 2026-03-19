/**
 * @element sherpa-input-time
 * @extends SherpaInputBase
 * @description Time input using the native browser time picker.
 *   Inherits label, description, helper, layout, validation from SherpaInputBase.
 *
 * @attr {string}  [min]  — Minimum selectable time (HH:MM)
 * @attr {string}  [max]  — Maximum selectable time (HH:MM)
 * @attr {number}  [step] — Step increment in seconds
 *
 * @fires input
 *   bubbles: true, composed: true
 *   detail: { value: string }
 * @fires change
 *   bubbles: true, composed: true
 *   detail: { value: string }
 *
 * @prop {string} min  — Getter/setter for min attribute
 * @prop {string} max  — Getter/setter for max attribute
 * @prop {string} step — Getter/setter for step attribute
 */

import { SherpaInputBase } from '../utilities/sherpa-input-base/sherpa-input-base.js';

export class SherpaInputTime extends SherpaInputBase {

  static get cssUrl()  { return new URL('./sherpa-input-time.css', import.meta.url).href; }
  static get htmlUrl() { return new URL('./sherpa-input-time.html', import.meta.url).href; }

  static get observedAttributes() {
    return [...super.observedAttributes, 'min', 'max', 'step'];
  }

  onAttributeChanged(name, oldValue, newValue) {
    super.onAttributeChanged(name, oldValue, newValue);
    if (['min', 'max', 'step'].includes(name)) {
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

  get step() { return this.getAttribute('step'); }
  set step(v) { v != null ? this.setAttribute('step', v) : this.removeAttribute('step'); }
}

customElements.define('sherpa-input-time', SherpaInputTime);
