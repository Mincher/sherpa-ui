/**
 * @element sherpa-input-number
 * @extends SherpaInputBase
 * @description Numerical input with stepper buttons. Inherits label, description,
 *   helper, layout, validation, and value management from SherpaInputBase.
 *
 * @attr {number}  [min]   — Minimum allowed value
 * @attr {number}  [max]   — Maximum allowed value
 * @attr {number}  [step]  — Step increment (default: 1)
 *
 * @fires input
 *   bubbles: true, composed: true
 *   detail: { value: string }
 * @fires change
 *   bubbles: true, composed: true
 *   detail: { value: string }
 *
 * @method stepUp(n=1)   — Increment value by n steps
 * @method stepDown(n=1) — Decrement value by n steps
 *
 * @prop {string}  min           — Getter/setter for min attribute
 * @prop {string}  max           — Getter/setter for max attribute
 * @prop {string}  step          — Getter/setter for step attribute
 * @prop {number}  valueAsNumber — Current value as a number (getter-only)
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
    // Propagate min/max/step to the native input on initial render —
    // attributeChangedCallback fires before the input exists, so the
    // host's declared step would otherwise never reach the control
    // (causing e.g. step="0.1" to fall back to step=1 and rejecting
    // decimal entries on validation).
    const el = this.getInputElement();
    if (el) {
      for (const name of ['min', 'max', 'step']) {
        const v = this.getAttribute(name);
        if (v !== null) el.setAttribute(name, v);
      }
    }
  }

  onInputConnect() {
    this.#stepDownBtn?.addEventListener('click', this.#onStepDown);
    this.#stepUpBtn?.addEventListener('click', this.#onStepUp);
    this.getInputElement()?.addEventListener('keydown', this.#onKeyDown);
  }

  onInputDisconnect() {
    this.#stepDownBtn?.removeEventListener('click', this.#onStepDown);
    this.#stepUpBtn?.removeEventListener('click', this.#onStepUp);
    this.getInputElement()?.removeEventListener('keydown', this.#onKeyDown);
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

  /**
   * When `step` is an integer (e.g. "1", "5"), block keystrokes that
   * would let the user type a fractional or scientific value
   * (`.`, `,`, `e`, `E`). Other keys (digits, sign, navigation,
   * shortcuts) are passed through unchanged.
   */
  #onKeyDown = (e) => {
    const step = parseFloat(this.step);
    if (!isFinite(step) || step % 1 !== 0) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === '.' || e.key === ',' || e.key === 'e' || e.key === 'E') {
      e.preventDefault();
    }
  };
}

customElements.define('sherpa-input-number', SherpaInputNumber);
