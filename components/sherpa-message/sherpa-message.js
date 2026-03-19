/**
 * @element sherpa-message
 * @description Alert / notification message with status variants.
 *
 * @attr {enum}    [data-status]      — success | critical | warning | info | urgent
 * @attr {boolean} [data-dismissible] — Show close button
 *
 * @slot heading  — Optional heading text
 * @slot (default) — Message content
 * @slot action   — Action link or button
 *
 * @fires close
 *   bubbles: true, composed: true
 *   detail: none
 *
 * @method dismiss() — Dispatch close event and remove element
 *
 * @prop {string}  status      — Getter/setter for data-status
 * @prop {boolean} dismissible — Getter/setter for data-dismissible
 */

import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';
import { StatusMixin } from '../utilities/status-mixin.js';

export class SherpaMessage extends StatusMixin(SherpaElement) {

  /* ── Config ───────────────────────────────────────────────────── */

  static get cssUrl()  { return new URL('./sherpa-message.css', import.meta.url).href; }
  static get htmlUrl() { return new URL('./sherpa-message.html', import.meta.url).href; }

  static get observedAttributes() {
    return [...super.observedAttributes, 'data-dismissible'];
  }

  /** Adds `neutral` icon to the base map. */
  static get statusIcons() {
    return {
      ...super.statusIcons,
      neutral: 'fa-regular fa-circle',
    };
  }

  /* ── Lifecycle hooks ──────────────────────────────────────────── */

  onRender() {
    this.#syncStatusIcon();
    this.$('.message-close')?.addEventListener('click', () => this.dismiss());
  }

  onStatusChanged() {
    this.#syncStatusIcon();
  }

  /* ── Public API ───────────────────────────────────────────────── */

  get status()      { return this.dataset.status || 'info'; }
  set status(v)     { v ? (this.dataset.status = v) : delete this.dataset.status; }

  get dismissible() { return this.dataset.dismissible === 'true'; }
  set dismissible(v){ this.dataset.dismissible = v ? 'true' : 'false'; }

  dismiss() {
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
    this.remove();
  }

  /* ── Private ──────────────────────────────────────────────────── */

  #syncStatusIcon() {
    const iconEl = this.$('.default-icon');
    if (!iconEl) return;
    const iconClass = this.statusIcon || this.constructor.statusIcons.info;
    iconEl.className = `${iconClass} sherpa-icon default-icon`;
  }
}

customElements.define('sherpa-message', SherpaMessage);
