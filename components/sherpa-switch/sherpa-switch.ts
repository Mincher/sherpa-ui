/**
 * sherpa-switch.js
 * SherpaSwitch — Toggle switch component.
 *
 * @element sherpa-switch
 * @category control
 * @description Immediate binary toggle for settings and preferences. Use instead of a checkbox
 *   when the change takes effect without a submit step — enabling notifications, activating
 *   dark mode, toggling a feature flag. The checked and state properties reflect the current
 *   value. Emits a change event with { checked, state } on every toggle.
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

  #bound = false;

  /* ── Config ───────────────────────────────────────────────────── */

  static override get cssUrl(): string  { return new URL('./sherpa-switch.css', import.meta.url).href; }
  static override get htmlUrl(): string { return new URL('./sherpa-switch.html', import.meta.url).href; }

  static override get observedAttributes(): string[] {
    return ['data-state'];
  }

  /* ── Lifecycle hooks ──────────────────────────────────────────── */

  public override onRender(): void {
    if (!this.#bound) {
      this.addEventListener('click', this.#onClick);
      this.#bound = true;
    }

    if (!this.dataset["state"]) {
      this.dataset["state"] = 'off';
    }
    this.#updateDisplay();
  }

  override onAttributeChanged(name: string): void {
    if (name === 'data-state') {
      this.#updateDisplay();
    }
  }

  /* ── Public API ───────────────────────────────────────────────── */

  get state(): string     { return this.dataset["state"] || 'off'; }
  set state(v: string)    { this.dataset["state"] = v === 'on' ? 'on' : 'off'; }

  get checked(): boolean   { return this.state === 'on'; }
  set checked(v: boolean)  { this.state = v ? 'on' : 'off'; }

  get disabled(): boolean  { return this.hasAttribute('disabled'); }
  set disabled(v: boolean) { if (v) { this.setAttribute('disabled', ''); } else { this.removeAttribute('disabled'); } }

  /* ── Private ──────────────────────────────────────────────────── */

  #onClick = (): void => {
    if (this.disabled) return;
    this.state = this.state === 'on' ? 'off' : 'on';
    this.emit('change', { checked: this.checked, state: this.state });
  };

  #updateDisplay(): void {
    this.$('.switch-track')?.setAttribute('aria-checked', String(this.checked));
  }
}

customElements.define('sherpa-switch', SherpaSwitch);
