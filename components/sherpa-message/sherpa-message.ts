/**
 * @element sherpa-message
 * @category feedback
 * @description Banner / inline message with status variants.
 *
 * @attr {enum}    [data-status]        — success | critical | warning | info | urgent
 * @attr {string}  [data-label]         — Message text
 * @attr {string}  [data-action-label]  — Inline action link text
 * @attr {string}  [data-action-href]   — Inline action link href
 * @attr {string}  [data-action-icon]   — FA classes for trailing link icon
 *                                        (default: fa-solid fa-arrow-up-right-from-square)
 * @attr {boolean} [data-dismissible]   — Show close button
 *
 * @fires close
 *   bubbles: true, composed: true
 *   detail: none
 *
 * @fires action
 *   bubbles: true, composed: true
 *   detail: { href: string }
 *
 * @method dismiss() — Dispatch close event and remove element
 *
 * @prop {string}  status      — Getter/setter for data-status
 * @prop {boolean} dismissible — Getter/setter for data-dismissible
 */

import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';
import { StatusMixin } from '../utilities/status-mixin.js';
import type { Status } from '../utilities/status-mixin.js';

const DEFAULT_ACTION_ICON = 'fa-solid fa-arrow-up-right-from-square';

export class SherpaMessage extends StatusMixin(SherpaElement) {

  /* ── Config ───────────────────────────────────────────────────── */

  static override get cssUrl(): string  { return new URL('./sherpa-message.css', import.meta.url).href; }
  static override get htmlUrl(): string { return new URL('./sherpa-message.html', import.meta.url).href; }

  static override get observedAttributes(): string[] {
    return [
      ...super.observedAttributes,
      'data-label',
      'data-action-label',
      'data-action-href',
      'data-action-icon',
      'data-dismissible',
    ];
  }

  /* ── Lifecycle ────────────────────────────────────────────────── */

  override onRender(): void {
    this.#syncStatusIcon();
    this.#syncLabel();
    this.#syncAction();
    this.$('.message-close')?.addEventListener('button-click', () => this.dismiss());
    this.$<HTMLElement>('.message-action')?.addEventListener('click', () => {
      this.emit('action', { href: this.dataset["actionHref"] || '' });
    });
  }

  override onAttributeChanged(name: string) {
    if (name === 'data-label') this.#syncLabel();
    else if (name === 'data-action-label' || name === 'data-action-href' || name === 'data-action-icon') this.#syncAction();
  }

  onStatusChanged() {
    this.#syncStatusIcon();
  }

  /* ── Public API ───────────────────────────────────────────────── */

  override get status(): Status | null { return (this.dataset["status"] as Status) || null; }
  override set status(v: Status | null) { v ? (this.dataset["status"] = v) : delete this.dataset["status"]; }

  get dismissible() { return this.hasAttribute('data-dismissible') && this.dataset["dismissible"] !== 'false'; }
  set dismissible(v){ v ? (this.dataset["dismissible"] = 'true') : this.removeAttribute('data-dismissible'); }

  dismiss() {
    this.emit('close');
    this.remove();
  }

  /* ── Private ──────────────────────────────────────────────────── */

  #syncStatusIcon() {
    const iconEl = this.$<HTMLElement>('.default-icon');
    if (!iconEl) return;
    const iconClass = this.statusIcon || (this.constructor as typeof SherpaMessage).statusIcons.info;
    iconEl.className = `${iconClass} sherpa-icon default-icon`;
    iconEl.dataset["size"] = 'sm';
  }

  #syncLabel() {
    const el = this.$('.message-label');
    if (el) el.textContent = this.dataset["label"] || '';
  }

  #syncAction() {
    const link = this.$('.message-action');
    const labelEl = this.$('.message-action-label');
    const iconEl = this.$<HTMLElement>('.message-action-icon');
    if (!link) return;
    const label = this.dataset["actionLabel"] || '';
    const href = this.dataset["actionHref"] || '';
    const iconClass = this.dataset["actionIcon"] || DEFAULT_ACTION_ICON;
     this.toggleAttribute('data-has-action', !!label);
     if (!label) return;
    if (href) link.setAttribute('href', href); else link.removeAttribute('href');
    if (labelEl) labelEl.textContent = label;
    if (iconEl) {
      iconEl.className = `message-action-icon sherpa-icon ${iconClass}`;
      iconEl.dataset["size"] = 'xs';
    }
  }
}

customElements.define('sherpa-message', SherpaMessage);
