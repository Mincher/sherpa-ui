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
import '../sherpa-footer/sherpa-footer.js';

export class SherpaDialog extends SherpaElement {

  /* ── Config ───────────────────────────────────────────────────── */

  static get cssUrl()  { return new URL('./sherpa-dialog.css', import.meta.url).href; }
  static get htmlUrl() { return new URL('./sherpa-dialog.html', import.meta.url).href; }

  static get observedAttributes() {
    return [...super.observedAttributes, 'data-label', 'data-subtitle', 'data-size', 'data-open', 'data-dismissible'];
  }

  /** @type {HTMLElement|null} */
  #titleEl = null;
  /** @type {HTMLElement|null} */
  #descriptionEl = null;

  /* ── Template selection ───────────────────────────────────────── */

  get templateId() {
    return this.dataset.type || 'default';
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
}

customElements.define('sherpa-dialog', SherpaDialog);
