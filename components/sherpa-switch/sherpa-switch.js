/**
 * sherpa-switch.js
 * SherpaSwitch — Toggle switch component.
 *
 * @element sherpa-switch
 *
 * @attr {enum}    data-state — on | off
 * @attr {boolean} disabled   — Native disabled state
 *
 * @fires change — Fired when toggle state changes
 *   bubbles: true, composed: true
 *   detail: { checked: boolean, state: string }
 *
 * @prop {string}  state    — Current state: "on" or "off" (read/write)
 * @prop {boolean} checked  — Whether switch is on (read/write)
 * @prop {boolean} disabled — Disabled state (read/write)
 */

import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';

export class SherpaSwitch extends SherpaElement {

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
      bubbles: true, composed: true,
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

customElements.define('sherpa-switch', SherpaSwitch);
