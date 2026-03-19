/**
 * sherpa-accordion.js
 * SherpaAccordion — Collapsible content panel using native <details>/<summary>.
 *
 * The browser handles expand/collapse natively. JS only syncs the
 * data-label and data-icon attributes into the shadow DOM.
 *
 * @element sherpa-accordion
 *
 * @attr {string}  data-label  — Heading text for the summary row
 * @attr {string}  data-icon   — FontAwesome unicode for optional leading icon
 * @attr {boolean} open        — Native details open/expanded state
 * @attr {boolean} disabled    — Prevents interaction
 *
 * @slot          — Default slot for panel content revealed when expanded
 * @slot actions  — Trailing action buttons in the summary row
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
