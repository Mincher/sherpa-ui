/**
 * sherpa-message.js
 * SherpaMessage — Alert / notification message extending SherpaElement.
 *
 * Usage:
 *   <sherpa-message data-status="success">Your changes have been saved.</sherpa-message>
 *
 *   <sherpa-message data-status="critical" data-dismissible="true">
 *     Something went wrong. Please try again.
 *     <a slot="action" href="#">Retry</a>
 *   </sherpa-message>
 *
 *   <sherpa-message data-status="info">
 *     <strong slot="heading">Did you know?</strong>
 *     You can customise your dashboard layout.
 *   </sherpa-message>
 *
 * Slots:
 *   - heading: Optional heading text
 *   - (default): Message content
 *   - action: Action link or button
 *
 * Attributes:
 *   - data-status:      "success" | "critical" | "warning" | "info" | "urgent"
 *   - data-dismissible: "true" | "false" — Shows close button
 *
 * @fires close — When close button is clicked
 */

import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';

export class SherpaMessage extends SherpaElement {

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
