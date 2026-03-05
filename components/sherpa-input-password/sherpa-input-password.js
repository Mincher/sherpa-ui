/**
 * sherpa-input-password.js
 * Password input with show/hide toggle button, extending AuxInputBase.
 *
 * @example
 *   <sherpa-input-password label="Password" placeholder="Enter a password"></sherpa-input-password>
 *
 * @fires input — { value }
 * @fires change — { value }
 */

import { AuxInputBase } from '../utilities/sherpa-input-base/sherpa-input-base.js';
import '../sherpa-button/sherpa-button.js';

export class AuxInputPassword extends AuxInputBase {

  static get cssUrl()  { return new URL('./sherpa-input-password.css', import.meta.url).href; }
  static get htmlUrl() { return new URL('./sherpa-input-password.html', import.meta.url).href; }

  #toggleBtn = null;
  #visible = false;

  async onInputRender() {
    this.#toggleBtn = this.$('.toggle-visibility');
  }

  onInputConnect() {
    this.#toggleBtn?.addEventListener('click', this.#onToggle);
  }

  onInputDisconnect() {
    this.#toggleBtn?.removeEventListener('click', this.#onToggle);
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
    if (el) el.type = this.#visible ? 'text' : 'password';
    if (this.#toggleBtn) {
      this.#toggleBtn.setAttribute('data-icon-start',
        this.#visible ? '\uf070' : '\uf06e'
      );
      this.#toggleBtn.dataset.label = this.#visible ? 'Hide' : 'Show';
    }
  }
}

customElements.define('sherpa-input-password', AuxInputPassword);
