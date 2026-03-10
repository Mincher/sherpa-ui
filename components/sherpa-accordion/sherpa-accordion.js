/**
 * sherpa-accordion.js
 * SherpaAccordion — Collapsible content panel using native <details>/<summary>.
 *
 * The browser handles expand/collapse natively. JS only syncs the
 * data-label and data-icon attributes into the shadow DOM.
 *
 * Usage:
 *   <sherpa-accordion data-label="Section Title">
 *     Panel content goes here.
 *   </sherpa-accordion>
 *
 *   <sherpa-accordion data-label="Details" open>
 *     <p>Initially expanded content.</p>
 *   </sherpa-accordion>
 *
 *   <sherpa-accordion data-label="With icon" data-icon="&#xf013;">
 *     <p>Content with a leading icon.</p>
 *   </sherpa-accordion>
 *
 * Slots:
 *   - actions:  Trailing action buttons in the summary row
 *   - (default): Panel content revealed when expanded
 *
 * Attributes:
 *   - data-label: Heading text for the summary row
 *   - data-icon:  FontAwesome unicode for the optional leading icon
 *   - open:       Native details open attribute (expanded state)
 *   - disabled:   Prevents interaction (CSS pointer-events: none)
 */

import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';

export class SherpaAccordion extends SherpaElement {

  static get cssUrl()  { return new URL('./sherpa-accordion.css', import.meta.url).href; }
  static get htmlUrl() { return new URL('./sherpa-accordion.html', import.meta.url).href; }

  static get observedAttributes() {
    return [...super.observedAttributes, 'data-label', 'data-icon'];
  }

  #labelEl = null;
  #iconEl = null;
  #detailsEl = null;

  onRender() {
    this.#labelEl = this.$('.trigger-label');
    this.#iconEl = this.$('.trigger-icon');
    this.#detailsEl = this.$('details');

    this.#syncLabel();
    this.#syncIcon();
    this.#syncOpen();
  }

  onConnect() {
    this.#detailsEl?.addEventListener('toggle', this.#onToggle);
  }

  onDisconnect() {
    this.#detailsEl?.removeEventListener('toggle', this.#onToggle);
  }

  onAttributeChanged(name) {
    switch (name) {
      case 'data-label': this.#syncLabel(); break;
      case 'data-icon':  this.#syncIcon(); break;
    }
  }

  /* ── Sync ─────────────────────────────────────────────────────── */

  #syncLabel() {
    if (this.#labelEl) this.#labelEl.textContent = this.dataset.label || '';
  }

  #syncIcon() {
    if (this.#iconEl) this.#iconEl.textContent = this.dataset.icon || '';
  }

  /** Mirror the host `open` attribute to the inner <details>. */
  #syncOpen() {
    if (this.#detailsEl) this.#detailsEl.open = this.hasAttribute('open');
  }

  /* ── Events ───────────────────────────────────────────────────── */

  /** Keep the host `open` attribute in sync with the native toggle. */
  #onToggle = () => {
    this.toggleAttribute('open', this.#detailsEl.open);
  };
}

customElements.define('sherpa-accordion', SherpaAccordion);
