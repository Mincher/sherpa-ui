/**
 * sherpa-switch — an on/off toggle for settings.
 *
 * Native-first (naming standard D1/D11): the component IS a native
 * <input type="checkbox" role="switch"> wrapped in a <label>. The label forwards
 * clicks and Space toggles the input natively, so there is no JS click handler and
 * no aria to sync — the input's own `checked` is the value and CSS keys off
 * `:checked`. This file only mirrors `checked`/`disabled` onto the inner input and
 * re-dispatches the input's native `change` as a composed `change` (the native one
 * bubbles inside the shadow root but is NOT composed, so app code wouldn't see it).
 *
 * @element sherpa-switch
 * @attr {boolean} checked    — native on/off value (read/write; drives :checked visuals)
 * @attr {enum}    data-style — default (rectangular, ON/OFF label) | simple (pill)
 * @attr {boolean} disabled   — native disabled state (reflected onto the inner input)
 *
 * @fires change — every toggle. bubbles + composed. detail: { checked: boolean }
 *
 * @prop {boolean} checked  — whether the switch is on (delegates to the inner input)
 * @prop {boolean} disabled — disabled state (reflects host attr + inner input)
 */
import { SherpaElement } from '../../core/sherpa-element.js';

export class SherpaSwitch extends SherpaElement {
  static override css = new URL('./sherpa-switch.css', import.meta.url);
  static override html = new URL('./sherpa-switch.html', import.meta.url);

  #input(): HTMLInputElement | null {
    return this.$<HTMLInputElement>('.input');
  }

  override onRender(): void {
    const input = this.#input();
    if (!input) return;
    // Adopt any pre-set host state onto the real control.
    if (this.hasAttribute('checked')) input.checked = true;
    input.disabled = this.hasAttribute('disabled');
    // Re-dispatch the input's native change as a composed component event.
    input.addEventListener('change', this.#onChange);
  }

  /* ── Public API ──────────────────────────────────────────────────────── */

  get checked(): boolean {
    return this.#input()?.checked ?? this.hasAttribute('checked');
  }
  set checked(value: boolean) {
    const input = this.#input();
    if (input) input.checked = value;
    this.toggleAttribute('checked', value);
  }

  get disabled(): boolean {
    return this.hasAttribute('disabled');
  }
  set disabled(value: boolean) {
    this.toggleAttribute('disabled', value);
    const input = this.#input();
    if (input) input.disabled = value;
  }

  /* ── Private ─────────────────────────────────────────────────────────── */

  #onChange = (): void => {
    const checked = this.#input()?.checked ?? false;
    this.toggleAttribute('checked', checked);
    this.emit('change', { checked });
  };
}

customElements.define('sherpa-switch', SherpaSwitch);
