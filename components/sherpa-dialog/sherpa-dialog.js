/**
 * sherpa-dialog.js
 * SherpaDialog — Modal dialog built on the native HTML <dialog> element.
 *
 * Uses SherpaElement multi-template support. The default template includes
 * a native <header> with a <dl> for title/subtitle and a close button,
 * plus a sherpa-footer for footer content.
 *
 * @element sherpa-dialog
 *
 * @attr {string}  data-label       — Dialog title text
 * @attr {string}  data-subtitle    — Dialog subtitle text
 * @attr {enum}    data-size        — small | medium | large | full
 * @attr {boolean} data-open        — Dialog visibility
 * @attr {boolean} data-dismissible — Shows close button (default: true)
 * @attr {enum}    data-status      — success | critical | warning | info | urgent
 * @attr {enum}    data-template    — default | wizard
 * @attr {number}  data-page        — (wizard) Active 0-based page index
 * @attr {number}  data-pages       — (wizard) Total page count override
 * @attr {string}  data-finish-label— (wizard) Label shown on the next button at last page (default: "Finish")
 *
 * @slot          — Default slot for dialog body content
 * @slot heading  — Custom heading content (replaces attribute-driven title)
 * @slot footer   — Footer action content (inside sherpa-footer)
 *
 * @fires open — Fired when dialog is opened
 *   bubbles: true, composed: true
 *   detail: { }
 * @fires close — Fired when dialog is closed
 *   bubbles: true, composed: true
 *   detail: { }
 *
 * @method show() — Programmatically open the dialog
 *   @returns {void}
 * @method hide() — Programmatically close the dialog
 *   @returns {void}
 * @method toggle() — Toggle dialog visibility
 *   @returns {void}
 *
 * @prop {string}  heading     — Title text (read/write)
 * @prop {string}  subtitle    — Subtitle text (read/write)
 * @prop {string}  size        — Dialog size preset (read/write)
 * @prop {boolean} open        — Open state (read/write)
 * @prop {boolean} dismissible — Close button visibility (read/write)
 */

import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';
import { StatusMixin } from '../utilities/status-mixin.js';
import '../sherpa-footer/sherpa-footer.js';

export class SherpaDialog extends StatusMixin(SherpaElement) {

  /* ── Config ─────────────────────────────────────────── */

  static get cssUrl()  { return new URL('./sherpa-dialog.css', import.meta.url).href; }
  static get htmlUrl() { return new URL('./sherpa-dialog.html', import.meta.url).href; }

  static get observedAttributes() {
    return [...super.observedAttributes, 'data-label', 'data-subtitle', 'data-size', 'data-open', 'data-dismissible', 'data-template', 'data-page', 'data-pages'];
  }

  /** @type {HTMLElement|null} */
  #titleEl = null;
  /** @type {HTMLElement|null} */
  #descriptionEl = null;

  /* ── Template selection ───────────────────────────────────────── */

  get templateId() {
    return this.dataset.template || this.dataset.type || 'default';
  }

  /* ── Lifecycle hooks ──────────────────────────────────────────── */

  onRender() {
    const dialog = this.$('.dialog');

    this.#titleEl = this.$('.header-title');
    this.#descriptionEl = this.$('.header-description');

    this.#syncHeading();
    this.#syncSubtitle();

    // Native <dialog> fires "close" when closed by .close() or Escape
    dialog?.addEventListener('close', () => {
      delete this.dataset.open;
      this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
    });

    // Click on ::backdrop (detected as click on <dialog> itself) closes
    dialog?.addEventListener('click', (e) => {
      if (e.target === dialog) dialog.close();
    });

    // Close button click
    this.$('.close-button')?.addEventListener('click', () => {
      this.$('.dialog')?.close();
    });

    // Wizard navigation
    if (this.templateId === 'wizard') {
      this.$('.wizard-back')?.addEventListener('button-click', () => this.prevPage());
      this.$('.wizard-next')?.addEventListener('button-click', () => {
        if (this.page >= this.pages - 1) {
          this.dispatchEvent(new CustomEvent('dialog-finish', {
            bubbles: true, composed: true,
            detail: { page: this.page, total: this.pages },
          }));
        } else {
          this.nextPage();
        }
      });
      this.#syncWizard();
    }
  }

  onConnect() {
    if (this.dataset.open === 'true') {
      this.#openDialog();
    }
  }

  onAttributeChanged(name, _oldValue, newValue) {
    switch (name) {
      case 'data-open':
        newValue !== null ? this.#openDialog() : this.#closeDialog();
        break;
      case 'data-label':
        this.#syncHeading();
        break;
      case 'data-subtitle':
        this.#syncSubtitle();
        break;
      case 'data-template':
        this.renderTemplate(this.templateId).then(() => this.onRender());
        break;
      case 'data-page':
      case 'data-pages':
        this.#syncWizard();
        if (name === 'data-page') {
          this.dispatchEvent(new CustomEvent('dialog-page-change', {
            bubbles: true, composed: true,
            detail: { page: this.page, total: this.pages },
          }));
        }
        break;
    }
  }

  /* ── Public API ───────────────────────────────────────────────── */

  get heading()    { return this.dataset.label || ''; }
  set heading(v)   { v ? this.dataset.label = v : delete this.dataset.label; }

  get subtitle()   { return this.dataset.subtitle || ''; }
  set subtitle(v)  { v ? this.dataset.subtitle = v : delete this.dataset.subtitle; }

  get size()       { return this.dataset.size || 'medium'; }
  set size(v)      { this.dataset.size = v; }

  get open()       { return this.dataset.open === 'true'; }
  set open(v)      { v ? this.dataset.open = 'true' : delete this.dataset.open; }

  get dismissible()  { return this.dataset.dismissible !== 'false'; }
  set dismissible(v) { this.dataset.dismissible = v ? 'true' : 'false'; }

  show()   { this.dataset.open = 'true'; }
  hide()   { delete this.dataset.open; }
  toggle() { this.open ? this.hide() : this.show(); }

  /* ── Wizard API ───────────────────────────────────────── */

  get page()  { return parseInt(this.dataset.page  || '0', 10) || 0; }
  get pages() {
    const explicit = parseInt(this.dataset.pages || '', 10);
    if (Number.isFinite(explicit) && explicit > 0) return explicit;
    return this.querySelectorAll('section[data-page]').length || 1;
  }

  setPage(index) {
    const total = this.pages;
    const next = Math.max(0, Math.min(total - 1, Number(index) || 0));
    this.dataset.page = String(next);
  }
  nextPage() { this.setPage(this.page + 1); }
  prevPage() { this.setPage(this.page - 1); }

  /* ── Private ──────────────────────────────────────────────────── */

  #syncHeading() {
    if (this.#titleEl) this.#titleEl.textContent = this.heading;
  }

  #syncSubtitle() {
    if (this.#descriptionEl) this.#descriptionEl.textContent = this.subtitle;
  }

  #openDialog() {
    const dialog = this.$('.dialog');
    if (dialog && !dialog.open) {
      dialog.showModal();
      this.dispatchEvent(new CustomEvent('open', { bubbles: true, composed: true }));
    }
  }

  #closeDialog() {
    const dialog = this.$('.dialog');
    if (dialog?.open) dialog.close();
  }

  #syncWizard() {
    if (this.templateId !== 'wizard') return;
    const ind = this.$('.wizard-step-indicator');
    if (ind) ind.textContent = `Step ${this.page + 1} of ${this.pages}`;
    const back = this.$('.wizard-back');
    const next = this.$('.wizard-next');
    if (back) back.toggleAttribute('disabled', this.page === 0);
    if (next) {
      const last = this.page >= this.pages - 1;
      next.dataset.label = last ? (this.dataset.finishLabel || 'Finish') : 'Next';
    }
  }
}

customElements.define('sherpa-dialog', SherpaDialog);
