/**
 * sherpa-footer.js
 * SherpaFooter — Reusable footer component with multiple template variants.
 *
 * Uses SherpaElement multi-template support to select the appropriate footer
 * layout based on the `type` attribute.
 *
 * Usage:
 *   <!-- Action bar (menu footer with cancel/apply) -->
 *   <sherpa-footer type="action-bar" cancel-label="Reset" apply-label="Save"></sherpa-footer>
 *
 *   <!-- Slot passthrough (card/dialog footer) -->
 *   <sherpa-footer type="slot">
 *     <sherpa-button variant="secondary">Cancel</sherpa-button>
 *     <sherpa-button variant="primary">Confirm</sherpa-button>
 *   </sherpa-footer>
 *
 * Attributes:
 *   type            — Template variant: action-bar | slot
 *   cancel-label    — Cancel button text (action-bar)
 *   apply-label     — Apply button text (action-bar)
 *   show-cancel     — Show cancel button (action-bar, true by default)
 *   show-apply      — Show apply button (action-bar, true by default)
 *   apply-closes    — Whether apply auto-closes the parent (action-bar, true by default)
 *
 * Events:
 *   footer-cancel   — Fired when cancel button is clicked
 *   footer-apply    — Fired when apply button is clicked
 *
 * Slots:
 *   start           — Content aligned to the left (action-bar)
 *   (default)       — Passthrough content (slot variant)
 */

import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';

export class SherpaFooter extends SherpaElement {

  /* ── Config ───────────────────────────────────────────────────── */

  static get cssUrl()  { return new URL('./sherpa-footer.css', import.meta.url).href; }
  static get htmlUrl() { return new URL('./sherpa-footer.html', import.meta.url).href; }

  static get observedAttributes() {
    return [
      'data-type', 'data-cancel-label', 'data-apply-label',
      'data-show-cancel', 'data-show-apply', 'data-apply-closes'
    ];
  }

  /* ── Template selection ───────────────────────────────────────── */

  get templateId() {
    return this.dataset.type || 'slot';
  }

  /* ── Lifecycle hooks ──────────────────────────────────────────── */

  onRender() {
    this.#syncLabels();
    this.#syncVisibility();
    this.#wireEvents();
  }

  onAttributeChanged(name) {
    switch (name) {
      case 'data-cancel-label':
      case 'data-apply-label':
        this.#syncLabels();
        break;
      case 'data-show-cancel':
      case 'data-show-apply':
        this.#syncVisibility();
        break;
    }
  }

  /* ── Public API ───────────────────────────────────────────────── */

  get type()         { return this.dataset.type || 'slot'; }
  set type(v)        { this.dataset.type = v; }

  get cancelLabel()  { return this.dataset.cancelLabel || 'Cancel'; }
  set cancelLabel(v) { v ? this.dataset.cancelLabel = v : delete this.dataset.cancelLabel; }

  get applyLabel()   { return this.dataset.applyLabel || 'Apply'; }
  set applyLabel(v)  { v ? this.dataset.applyLabel = v : delete this.dataset.applyLabel; }

  get showCancel()   { return this.dataset.showCancel !== 'false'; }
  set showCancel(v)  { this.dataset.showCancel = v ? 'true' : 'false'; }

  get showApply()    { return this.dataset.showApply !== 'false'; }
  set showApply(v)   { this.dataset.showApply = v ? 'true' : 'false'; }

  get applyCloses()  { return this.dataset.applyCloses !== 'false'; }
  set applyCloses(v) { this.dataset.applyCloses = v ? 'true' : 'false'; }

  /* ── Private ──────────────────────────────────────────────────── */

  #syncLabels() {
    const cancelBtn = this.$('.cancel-button');
    if (cancelBtn) cancelBtn.textContent = this.cancelLabel;

    const applyBtn = this.$('.apply-button');
    if (applyBtn) applyBtn.textContent = this.applyLabel;
  }

  #syncVisibility() {
    const cancelBtn = this.$('.cancel-button');
    if (cancelBtn) cancelBtn.hidden = !this.showCancel;

    const applyBtn = this.$('.apply-button');
    if (applyBtn) applyBtn.hidden = !this.showApply;
  }

  #wireEvents() {
    const cancelBtn = this.$('.cancel-button');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        this.dispatchEvent(new CustomEvent('footer-cancel', { bubbles: true, composed: true }));
      });
    }

    const applyBtn = this.$('.apply-button');
    if (applyBtn) {
      applyBtn.addEventListener('click', () => {
        this.dispatchEvent(new CustomEvent('footer-apply', {
          bubbles: true,
          composed: true,
          detail: { closes: this.applyCloses }
        }));
      });
    }
  }
}

customElements.define('sherpa-footer', SherpaFooter);
