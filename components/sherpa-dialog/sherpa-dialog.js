/**
 * sherpa-dialog.js
 * SherpaDialog — Modal dialog built on the native HTML <dialog> element.
 *
 * Uses SherpaElement multi-template support. The default template includes
 * an sherpa-header (type="dialog") and sherpa-footer (type="slot") internally,
 * so consumers only need to set attributes on sherpa-dialog itself.
 *
 * Usage:
 *   <sherpa-dialog heading="Confirm action" dismissible>
 *     Are you sure you want to continue?
 *     <div slot="footer">
 *       <sherpa-button variant="secondary">Cancel</sherpa-button>
 *       <sherpa-button variant="primary">Confirm</sherpa-button>
 *     </div>
 *   </sherpa-dialog>
 *
 * Slots:
 *   - heading:  Custom heading content (replaces default title in sherpa-header)
 *   - (default): Dialog body content
 *   - footer:   Footer action content (rendered inside sherpa-footer)
 *
 * Attributes:
 *   - heading:     Dialog title text
 *   - subtitle:    Dialog subtitle text
 *   - size:        "small" | "medium" | "large" | "full"
 *   - open:        Dialog visibility
 *   - dismissible: Shows close button (default: true)
 *
 * @fires open  — Dialog opened
 * @fires close — Dialog closed
 */

import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';
import '../sherpa-header/sherpa-header.js';
import '../sherpa-footer/sherpa-footer.js';

export class SherpaDialog extends SherpaElement {

  /* ── Config ───────────────────────────────────────────────────── */

  static get cssUrl()  { return new URL('./sherpa-dialog.css', import.meta.url).href; }
  static get htmlUrl() { return new URL('./sherpa-dialog.html', import.meta.url).href; }

  static get observedAttributes() {
    return ['data-label', 'data-subtitle', 'data-size', 'data-open', 'data-dismissible'];
  }

  /* ── Template selection ───────────────────────────────────────── */

  get templateId() {
    return this.dataset.type || 'default';
  }

  /* ── Lifecycle hooks ──────────────────────────────────────────── */

  onRender() {
    const dialog = this.$('.dialog');

    // Sync attributes to internal sherpa-header
    this.#syncHeading();
    this.#syncSubtitle();
    this.#syncDismissible();

    // Native <dialog> fires "close" when closed by .close() or Escape
    dialog?.addEventListener('close', () => {
      delete this.dataset.open;
      this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
    });

    // Click on ::backdrop (detected as click on <dialog> itself) closes
    dialog?.addEventListener('click', (e) => {
      if (e.target === dialog) dialog.close();
    });

    // Listen for header-close from internal sherpa-header
    this.shadowRoot.addEventListener('header-close', () => {
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
      case 'data-dismissible':
        this.#syncDismissible();
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
    const header = this.$('sherpa-header');
    if (header) header.heading = this.heading;
  }

  #syncSubtitle() {
    const header = this.$('sherpa-header');
    if (header) header.description = this.subtitle;
  }

  #syncDismissible() {
    const header = this.$('sherpa-header');
    if (header) header.dismissible = this.dismissible;
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
