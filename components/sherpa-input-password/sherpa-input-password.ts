/**
 * @element sherpa-input-password
 * @category input
 * @extends SherpaInputBase
 * @description Password entry field with a show/hide visibility toggle. Use for any secret or
 *   credential input. The toggle button switches the underlying input between masked and plain
 *   text. Inherits all label, helper, validation, and layout chrome from SherpaInputBase.
 *
 * @fires input
 *   bubbles: true, composed: true
 *   detail: { value: string }
 * @fires change
 *   bubbles: true, composed: true
 *   detail: { value: string }
 *
 * @prop {boolean} visible — Whether password text is currently shown in plain text
 */

import { SherpaInputBase } from '../utilities/sherpa-input-base/sherpa-input-base.js';

export class SherpaInputPassword extends SherpaInputBase {

  static override get cssUrl(): string { return new URL('./sherpa-input-password.css', import.meta.url).href; }
  static override get htmlUrl(): string { return new URL('./sherpa-input-password.html', import.meta.url).href; }

  els = this.cacheElements({
    toggleBtn:   { selector: '.toggle-visibility', type: HTMLButtonElement },
    toggleIcon:  { selector: '.toggle-icon',       type: HTMLElement },
    toggleLabel: { selector: '.toggle-label',      type: HTMLElement },
  });

  #visible = false;

  override async onInputRender() {
  }

  override onInputConnect() {
    this.els.toggleBtn?.addEventListener('click', this.#onToggle);
  }

  override onInputDisconnect() {
    this.els.toggleBtn?.removeEventListener('click', this.#onToggle);
  }

  /* ── Public API ─────────────────────────────────────────────── */

  /** Whether the password is currently visible in plain text. */
  get visible() { return this.#visible; }
  set visible(v) {
    this.#visible = !!v;
    this.#updateVisibility();
  }

  /* ── Internal ───────────────────────────────────────────────── */

  #onToggle = () => {
    this.#visible = !this.#visible;
    this.#updateVisibility();
  };

  #updateVisibility() {
    const el = this.getInputElement();
    if (el instanceof HTMLInputElement) el.type = this.#visible ? 'text' : 'password';
    if (this.els.toggleIcon) {
      this.els.toggleIcon.className = this.#visible
        ? 'fa-regular fa-eye-slash toggle-icon'
        : 'fa-regular fa-eye toggle-icon';
    }
    if (this.els.toggleLabel) {
      this.els.toggleLabel.textContent = this.#visible ? 'Hide' : 'Show';
    }
  }
}

customElements.define('sherpa-input-password', SherpaInputPassword);
