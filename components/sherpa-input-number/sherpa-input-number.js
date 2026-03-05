/**
 * sherpa-input-number.js
 * Numerical input with stepper buttons, extending SherpaInputBase.
 *
 * @example
 *   <sherpa-input-number label="Quantity" min="0" max="100" step="1"></sherpa-input-number>
 *   <sherpa-input-number label="Price" step="0.01" placeholder="0.00"></sherpa-input-number>
 *
 * Extra attributes:
 *   min, max, step
 *
 * @fires input — { value }
 * @fires change — { value }
 */

import { SherpaInputBase } from '../utilities/sherpa-input-base/sherpa-input-base.js';
import '../sherpa-button/sherpa-button.js';

export class SherpaInputNumber extends SherpaInputBase {

  static get cssUrl()  { return new URL('./sherpa-input-number.css', import.meta.url).href; }
  static get htmlUrl() { return new URL('./sherpa-input-number.html', import.meta.url).href; }

  static get observedAttributes() {
    return [...super.observedAttributes, 'min', 'max', 'step'];
  }

  #stepDownBtn = null;
  #stepUpBtn = null;

  async onInputRender() {
    this.#stepDownBtn = this.$('.step-down');
    this.#stepUpBtn = this.$('.step-up');
  }

  onInputConnect() {
    this.#stepDownBtn?.addEventListener('click', this.#onStepDown);
    this.#stepUpBtn?.addEventListener('click', this.#onStepUp);
  }

  onInputDisconnect() {
    this.#stepDownBtn?.removeEventListener('click', this.#onStepDown);
    this.#stepUpBtn?.removeEventListener('click', this.#onStepUp);
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

  get step() { return this.getAttribute('step') || '1'; }
  set step(v) { this.setAttribute('step', v); }

  get valueAsNumber() {
    const v = parseFloat(this.value);
    return isNaN(v) ? 0 : v;
  }

  stepUp(n = 1) { this.#step(n); }
  stepDown(n = 1) { this.#step(-n); }

  /* ── Internal ───────────────────────────────────────────────── */

  #step(direction) {
    if (this.disabled || this.readOnly) return;
    const el = this.getInputElement();
    if (!el) return;

    try {
      // Use native stepUp/stepDown — handles min/max/step natively
      if (direction > 0) el.stepUp(direction);
      else el.stepDown(-direction);
    } catch {
      // stepUp/stepDown throws if value is empty or out of range
      const step = parseFloat(this.step) || 1;
      const min = this.min != null ? parseFloat(this.min) : -Infinity;
      const max = this.max != null ? parseFloat(this.max) : Infinity;
      let next = (parseFloat(el.value) || 0) + (step * direction);
      next = Math.min(Math.max(next, min), max);
      const decimals = (String(step).split('.')[1] || '').length;
      el.value = next.toFixed(decimals);
    }

    this.setAttribute('value', el.value);
    this.#fireEvents();
  }

  #fireEvents() {
    this.dispatchEvent(new CustomEvent('input', {
      bubbles: true, composed: true, detail: { value: this.value }
    }));
    this.dispatchEvent(new CustomEvent('change', {
      bubbles: true, composed: true, detail: { value: this.value }
    }));
  }

  #onStepDown = () => this.stepDown();
  #onStepUp = () => this.stepUp();
}

customElements.define('sherpa-input-number', SherpaInputNumber);
