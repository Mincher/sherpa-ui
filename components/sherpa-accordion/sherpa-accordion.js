/**
 * sherpa-accordion.js
 * SherpaAccordion — Collapsible content panel using native <details>/<summary>.
 *
 * The browser handles expand/collapse natively. JS only syncs the
 * data-label and data-icon attributes into the shadow DOM.
 *
 * @element sherpa-accordion
 * @category container
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
import '../sherpa-button/sherpa-button.js';

export class SherpaAccordion extends SherpaElement {

  static get cssUrl()  { return new URL('./sherpa-accordion.css', import.meta.url).href; }
  static get htmlUrl() { return new URL('./sherpa-accordion.html', import.meta.url).href; }

  static get observedAttributes() {
    return [...super.observedAttributes, 'data-label', 'data-icon', 'disabled'];
  }

  #labelEl = null;
  #iconEl = null;
  #chevronBtnEl = null;
  #detailsEl = null;
  #bound = false;

  onRender() {
    this.#labelEl = this.$('.trigger-label');
    this.#iconEl = this.$('.trigger-icon');
    this.#chevronBtnEl = this.$('.chevron-btn');
    this.#detailsEl = this.$('details');

    if (!this.#bound) {
      this.#detailsEl?.addEventListener('toggle', this.#onToggle);
      this.#bound = true;
    }

    this.#syncLabel();
    this.#syncIcon();
    this.#syncOpen();
    this.#syncDisabled();
  }

  onAttributeChanged(name) {
    switch (name) {
      case 'data-label': this.#syncLabel(); break;
      case 'data-icon':  this.#syncIcon(); break;
      case 'disabled':   this.#syncDisabled(); break;
    }
  }

  /* ── Sync ─────────────────────────────────────────────────────── */

  #syncLabel() {
    if (this.#labelEl) this.#labelEl.textContent = this.dataset.label || '';
  }

  #syncDisabled() {
    if (!this.#chevronBtnEl) return;
    this.#chevronBtnEl.toggleAttribute('disabled', this.hasAttribute('disabled'));
  }

  #syncIcon() {
    if (!this.#iconEl) return;
    // data-icon accepts either a Font Awesome class string
    // (e.g. "fa-solid fa-star") or a single FA unicode codepoint.
    const v = this.dataset.icon || '';
    if (/\bfa-/.test(v)) {
      this.#iconEl.className = `trigger-icon ${v}`.trim();
      this.#iconEl.textContent = '';
      this.#iconEl.style.fontFamily = '';
    } else {
      this.#iconEl.className = 'trigger-icon';
      this.#iconEl.textContent = v;
      this.#iconEl.style.fontFamily = v ? '"Font Awesome 6 Free"' : '';
      this.#iconEl.style.fontWeight = v ? '900' : '';
    }
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
