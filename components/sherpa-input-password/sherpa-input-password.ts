/**
 * @element sherpa-input-password
 * @category input
 * @extends SherpaInputBase
 * @description Password input with show/hide toggle button. Inherits label,
 *   description, helper, layout, validation from SherpaInputBase.
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
import '../sherpa-button/sherpa-button.js';

/* ── Dataset Interface ─────────────────────────────────────────── */

interface SherpaInputPasswordDataset extends DOMStringMap {
  label?: string;
  description?: string;
  helper?: string;
  layout?: 'horizontal' | 'vertical';
}

export class SherpaInputPassword extends SherpaInputBase {

  override get dataset(): SherpaInputPasswordDataset {
    return super.dataset as SherpaInputPasswordDataset;
  }

  static override get cssUrl(): string { return new URL('./sherpa-input-password.css', import.meta.url).href; }
  static override get htmlUrl(): string { return new URL('./sherpa-input-password.html', import.meta.url).href; }

  els = this.cacheElements({
    toggleBtn: { selector: '.toggle-visibility', type: HTMLButtonElement }
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
    // @ts-expect-error - TODO: Fix type
    if (el) el.type = this.#visible ? 'text' : 'password';
    if (this.els.toggleBtn) {
      this.els.toggleBtn.setAttribute('data-icon-start',
        this.#visible ? '\uf070' : '\uf06e'
      );
      this.els.toggleBtn.dataset["label"] = this.#visible ? 'Hide' : 'Show';
    }
  }
}

customElements.define('sherpa-input-password', SherpaInputPassword);
