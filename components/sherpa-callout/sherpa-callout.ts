/**
 * @element sherpa-callout
 * @category feedback
 * @description Inline contextual callout with status variants and
 *   expandable/dismissible body.
 *
 * @attr {enum}    [data-status]      — info | warning | critical | success
 * @attr {string}  [data-heading]     — Heading text
 * @attr {boolean} [data-expanded]    — Body visible
 * @attr {boolean} [data-dismissible] — Show toggle button
 * @attr {string}  [data-icon]        — Override status icon (FA class)
 *
 * @slot heading   — Override heading text
 * @slot (default) — Body content
 * @slot action    — Optional action link/button
 *
 * @fires callout-toggle
 *   bubbles: true, composed: true
 *   detail: { expanded: boolean }
 * @fires callout-dismiss
 *   bubbles: true, composed: true
 *   detail: none
 *
 * @method toggle()  — Toggle expanded state
 * @method dismiss() — Dispatch dismiss event and remove element
 *
 * @prop {boolean} expanded — Getter/setter for data-expanded
 */

import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';
import { StatusMixin } from '../utilities/status-mixin.js';

export class SherpaCallout extends StatusMixin(SherpaElement) {

  /* ── Config ───────────────────────────────────────────────────── */

  static override get cssUrl(): string  { return new URL('./sherpa-callout.css', import.meta.url).href; }
  static override get htmlUrl(): string { return new URL('./sherpa-callout.html', import.meta.url).href; }

  static override get observedAttributes(): string[] {
    return [
      ...super.observedAttributes,
      'data-heading',
      'data-expanded',
      'data-dismissible',
      'data-icon',
    ];
  }

  /* ── Element refs ─────────────────────────────────────────────── */

  #headingEl;
  #statusIconEl;
  #actionBtnEl;

  /* ── Lifecycle ────────────────────────────────────────────────── */

  override onRender(): void {
    this.#headingEl    = this.$('.heading-text');
    this.#statusIconEl = this.$('.status-icon');
    this.#actionBtnEl  = this.$('.action-btn');

    // Defaults
    if (!this.dataset.status) this.dataset.status = 'info';
    if (!this.hasAttribute('role')) this.setAttribute('role', 'note');

    // Sync
    this.#syncHeading();
    this.#syncStatusIcon();
    this.#syncToggleIcon();

    // Events
    this.#actionBtnEl?.addEventListener('button-click', () => this.toggle());
  }

  onAttributeChanged(name) {
    switch (name) {
      case 'data-heading':  this.#syncHeading(); break;
      case 'data-expanded': this.#syncToggleIcon(); break;
      case 'data-status':
      case 'data-icon':    this.#syncStatusIcon(); break;
    }
  }

  onStatusChanged() {
    this.#syncStatusIcon();
  }

  /* ── Public API ───────────────────────────────────────────────── */

  get expanded() { return this.hasAttribute('data-expanded'); }
  set expanded(v) { this.toggleAttribute('data-expanded', Boolean(v)); }

  toggle() {
    this.expanded = !this.expanded;
    this.dispatchEvent(new CustomEvent('callout-toggle', {
      bubbles: true,
      composed: true,
      detail: { expanded: this.expanded },
    }));
  }

  dismiss() {
    this.dispatchEvent(new CustomEvent('callout-dismiss', {
      bubbles: true,
      composed: true,
    }));
    this.remove();
  }

  /* ── Private ──────────────────────────────────────────────────── */

  #syncHeading() {
    if (this.#headingEl) {
      this.#headingEl.textContent = this.dataset.heading || '';
    }
  }

  #syncStatusIcon() {
    if (!this.#statusIconEl) return;
    const override = this.dataset.icon;
    const iconClass = override || this.statusIcon || 'fa-solid fa-circle-info';
    this.#statusIconEl.className = `${iconClass} status-icon`;
  }

  #syncToggleIcon() {
    if (!this.#actionBtnEl) return;
    // chevron-up when expanded, chevron-down when collapsed
    this.#actionBtnEl.dataset.iconStart = this.expanded ? '\uf077' : '\uf078';
  }
}

customElements.define('sherpa-callout', SherpaCallout);
