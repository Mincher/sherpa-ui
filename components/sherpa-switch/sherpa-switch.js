/**
 * sherpa-switch.js
 * AuxSwitch — Toggle switch extending AuxElement.
 *
 * @example
 *   <sherpa-switch data-state="on"></sherpa-switch>
 *   <sherpa-switch data-state="off" disabled></sherpa-switch>
 *
 * Attributes:
 *   - data-state: "on" | "off"
 *   - disabled: boolean
 *
 * @fires change — { checked, state }
 */

import { AuxElement } from '../utilities/sherpa-element/sherpa-element.js';

export class AuxSwitch extends AuxElement {

  /* ── Config ───────────────────────────────────────────────────── */

  static get cssUrl()  { return new URL('./sherpa-switch.css', import.meta.url).href; }
  static get htmlUrl() { return new URL('./sherpa-switch.html', import.meta.url).href; }

  static get observedAttributes() {
    return ['data-state'];
  }

  /* ── Lifecycle hooks ──────────────────────────────────────────── */

  onRender() {
    if (!this.dataset.state) {
      this.dataset.state = 'off';
    }
    this.#updateDisplay();
  }

  onConnect() {
    this.addEventListener('click', this.#handleClick);
  }

  onDisconnect() {
    this.removeEventListener('click', this.#handleClick);
  }

  onAttributeChanged(name) {
    if (name === 'data-state') {
      this.#updateDisplay();
    }
  }

  /* ── Public API ───────────────────────────────────────────────── */

  get state()     { return this.dataset.state || 'off'; }
  set state(v)    { this.dataset.state = v === 'on' ? 'on' : 'off'; }

  get checked()   { return this.state === 'on'; }
  set checked(v)  { this.state = v ? 'on' : 'off'; }

  get disabled()  { return this.hasAttribute('disabled'); }
  set disabled(v) { v ? this.setAttribute('disabled', '') : this.removeAttribute('disabled'); }

  /* ── Private ──────────────────────────────────────────────────── */

  #handleClick = () => {
    if (this.disabled) return;
    this.state = this.state === 'on' ? 'off' : 'on';
    this.dispatchEvent(new CustomEvent('change', {
      bubbles: true,
      detail: { checked: this.checked, state: this.state },
    }));
  };

  #updateDisplay() {
    const track = this.$('.switch-track');
    const label = this.$('.switch-label');
    if (track) track.setAttribute('aria-checked', String(this.checked));
    if (label) label.textContent = this.state === 'on' ? 'ON' : 'OFF';
  }
}

customElements.define('sherpa-switch', AuxSwitch);
