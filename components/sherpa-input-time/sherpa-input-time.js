/**
 * sherpa-input-time.js
 * Time input using the native browser time picker, extending SherpaInputBase.
 *
 * @example
 *   <sherpa-input-time label="Start Time"></sherpa-input-time>
 *   <sherpa-input-time label="Alarm" value="08:30"></sherpa-input-time>
 *
 * Extra attributes: min, max, step
 *
 * @fires input — { value }
 * @fires change — { value }
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
