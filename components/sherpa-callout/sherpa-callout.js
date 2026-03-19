/**
 * @element sherpa-callout
 * @description Inline contextual callout with status variants and
 *   expandable/dismissible body.
 *
 * @attr {enum}    [data-status]      — info | warning | critical | success | neutral | tip
 * @attr {string}  [data-heading]     — Heading text
 * @attr {boolean} [data-expanded]    — Body visible
 * @attr {boolean} [data-dismissible] — Show toggle button
 * @attr {string}  [data-icon]        — Override status icon (FA class)
 *
 * @slot heading  — Override heading text
 * @slot (default) — Body content
 * @slot action   — Optional action link/button
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

  static get cssUrl()  { return new URL('./sherpa-callout.css', import.meta.url).href; }
  static get htmlUrl() { return new URL('./sherpa-callout.html', import.meta.url).href; }

  static get observedAttributes() {
    return [
      ...super.observedAttributes,
      'data-heading',
      'data-expanded',
      'data-dismissible',
      'data-icon',
    ];
  }

  /** Extend the base icon map with 'tip'. */
  static get statusIcons() {
    return {
      ...super.statusIcons,
      tip: 'fa-solid fa-lightbulb',
    };
  }

  /* ── Element refs ─────────────────────────────────────────────── */

  #headingEl;
  #statusIconEl;
  #toggleBtn;

  /* ── Lifecycle ────────────────────────────────────────────────── */

  onRender() {
    this.#headingEl    = this.$('.heading-text');
    this.#statusIconEl = this.$('.status-icon');
    this.#toggleBtn    = this.$('.toggle-btn');

    // Defaults
    if (!this.dataset.status) this.dataset.status = 'info';
    if (!this.hasAttribute('role')) this.setAttribute('role', 'note');

    // Sync
    this.#syncHeading();
    this.#syncStatusIcon();

    // Events
    this.#toggleBtn?.addEventListener('click', () => this.toggle());
  }

  onAttributeChanged(name) {
    switch (name) {
      case 'data-heading': this.#syncHeading(); break;
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
}

customElements.define('sherpa-callout', SherpaCallout);
