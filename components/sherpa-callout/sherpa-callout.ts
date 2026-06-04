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

export class SherpaCallout extends SherpaElement {

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

  els = this.cacheElements({
    heading: '.heading-text',
    statusIcon: '.status-icon',
    actionBtn: { selector: '.action-btn', type: HTMLElement }
  });

  /* ── Lifecycle ────────────────────────────────────────────────── */

  override onRender(): void {
    // Defaults
    if (!this.dataset["status"]) this.dataset["status"] = 'info';
    if (!this.hasAttribute('role')) this.setAttribute('role', 'note');

    // Sync
    this.#syncHeading();
    this.#syncIconOverride();
    this.#syncToggleIcon();

    // Events
    this.els.actionBtn?.addEventListener('button-click', () => this.toggle());
  }

  override onAttributeChanged(name: string) {
    switch (name) {
      case 'data-heading':  this.#syncHeading(); break;
      case 'data-expanded': this.#syncToggleIcon(); break;
      case 'data-icon':     this.#syncIconOverride(); break;
    }
  }

  /* ── Public API ───────────────────────────────────────────────── */

  get expanded() { return this.hasAttribute('data-expanded'); }
  set expanded(v) { this.toggleAttribute('data-expanded', Boolean(v)); }

  toggle() {
    this.expanded = !this.expanded;
    this.emit('callout-toggle', { expanded: this.expanded });
  }

  dismiss() {
    this.emit('callout-dismiss');
    this.remove();
  }

  /* ── Private ──────────────────────────────────────────────────── */

  #syncHeading() {
    if (this.els.heading) {
      this.els.heading.textContent = this.dataset["heading"] || '';
    }
  }

  /** CSS handles default icons via ::after + data-status. JS only applies an override FA class. */
  #syncIconOverride() {
    const el = this.els.statusIcon;
    if (!el) return;
    const override = this.dataset["icon"];
    el.className = override ? `${override} status-icon` : 'status-icon';
  }

  #syncToggleIcon() {
    if (!this.els.actionBtn) return;
    // chevron-up when expanded, chevron-down when collapsed
    this.els.actionBtn.dataset["iconStart"] = this.expanded ? '\uf077' : '\uf078';
  }
}

customElements.define('sherpa-callout', SherpaCallout);
