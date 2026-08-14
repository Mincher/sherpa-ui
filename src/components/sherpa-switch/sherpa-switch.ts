/**
 * sherpa-switch — an immediate binary toggle for settings and preferences.
 *
 * Behaviour only. Appearance (on/off, the simple pill variant, disabled, focus)
 * is CSS keyed off `data-*`. This file toggles `data-state` on click, mirrors the
 * value onto the inner button's `aria-checked`, and emits `change`.
 *
 * @element sherpa-switch
 * @attr {enum}    data-state — on | off       (current value, read/write)
 * @attr {enum}    data-style — default (rectangular, ON/OFF label) | simple (pill)
 * @attr {boolean} disabled   — native disabled state
 *
 * @fires change — every toggle. bubbles + composed. detail: { checked: boolean }
 *
 * @prop {boolean} checked  — whether the switch is on (read/write)
 * @prop {string}  state    — "on" | "off" (read/write)
 * @prop {boolean} disabled — disabled state (read/write)
 */
import { SherpaElement } from '../../core/sherpa-element.js';

export class SherpaSwitch extends SherpaElement {
  static override css = new URL('./sherpa-switch.css', import.meta.url);
  static override tokens = new URL('./sherpa-switch.tokens.css', import.meta.url);
  static override html = new URL('./sherpa-switch.html', import.meta.url);
  static override observed = ['data-state'];

  override onRender(): void {
    if (!this.dataset['state']) this.dataset['state'] = 'off';
    this.$('.track')?.addEventListener('click', this.#onClick);
    this.#syncAria();
  }

  override onChange(name: string): void {
    if (name === 'data-state') this.#syncAria();
  }

  /* ── Public API ──────────────────────────────────────────────────────── */

  get state(): string {
    return this.dataset['state'] === 'on' ? 'on' : 'off';
  }
  set state(value: string) {
    this.dataset['state'] = value === 'on' ? 'on' : 'off';
  }

  get checked(): boolean {
    return this.state === 'on';
  }
  set checked(value: boolean) {
    this.state = value ? 'on' : 'off';
  }

  get disabled(): boolean {
    return this.hasAttribute('disabled');
  }
  set disabled(value: boolean) {
    this.toggleAttribute('disabled', value);
  }

  /* ── Private ─────────────────────────────────────────────────────────── */

  #onClick = (): void => {
    if (this.disabled) return;
    this.state = this.checked ? 'off' : 'on';
    this.emit('change', { checked: this.checked });
  };

  /** Mirror the current value onto the inner switch button for AT. */
  #syncAria(): void {
    this.$('.track')?.setAttribute('aria-checked', String(this.checked));
  }
}

customElements.define('sherpa-switch', SherpaSwitch);
