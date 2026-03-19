/**
 * sherpa-card.js
 * SherpaCard — Container component with header, content, and footer areas.
 *
 * Uses a native <header> with a <dl> for the card header area,
 * supporting both attribute-based headings and slotted custom content.
 *
 * @element sherpa-card
 *
 * @attr {string}  data-label       — Card title text
 * @attr {string}  data-description  — Card subtitle text
 * @attr {boolean} data-selected     — Selected/active state
 * @attr {boolean} data-interactive  — Makes card clickable
 * @attr {enum}    data-elevation    — none | sm | md | lg
 * @attr {boolean} disabled          — Native disabled state
 *
 * @slot         — Default slot for main card content
 * @slot header  — Custom heading content (replaces attribute-driven title)
 * @slot footer  — Card footer content
 *
 * @fires card-click — Fired when interactive card is clicked or activated via keyboard
 *   bubbles: true, composed: true
 *   detail: { }
 *
 * @prop {boolean} selected    — Selected state (read/write)
 * @prop {boolean} interactive — Clickable state (read/write)
 * @prop {boolean} disabled    — Disabled state (read/write)
 * @prop {string}  elevation   — Shadow level (read/write)
 * @prop {string}  heading     — Title text (read/write)
 * @prop {string}  description — Subtitle text (read/write)
 */

import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';

export class SherpaCard extends SherpaElement {

  /* ── Config ───────────────────────────────────────────────────── */

  static get cssUrl()  { return new URL('./sherpa-card.css', import.meta.url).href; }
  static get htmlUrl() { return new URL('./sherpa-card.html', import.meta.url).href; }

  static get observedAttributes() {
    return [...super.observedAttributes, 'data-selected', 'data-interactive', 'disabled', 'data-elevation', 'data-label', 'data-description'];
  }

  /** @type {HTMLElement|null} */
  #titleEl = null;
  /** @type {HTMLElement|null} */
  #descriptionEl = null;

  /* ── Lifecycle hooks ──────────────────────────────────────────── */

  onRender() {
    this.#titleEl = this.$('.header-title');
    this.#descriptionEl = this.$('.header-description');
    this.#syncHeading();
    this.#syncDescription();
  }

  onConnect() {
    if (this.interactive && !this.hasAttribute('tabindex')) {
      this.setAttribute('tabindex', '0');
    }
    this.addEventListener('keydown', this.#handleKeydown);
    this.addEventListener('click', this.#handleClick);
  }

  onDisconnect() {
    this.removeEventListener('keydown', this.#handleKeydown);
    this.removeEventListener('click', this.#handleClick);
  }

  onAttributeChanged(name) {
    if (name === 'data-interactive') {
      this.#updateInteractive();
    } else if (name === 'data-label') {
      this.#syncHeading();
    } else if (name === 'data-description') {
      this.#syncDescription();
    }
  }

  /* ── Public API ───────────────────────────────────────────────── */

  get selected()    { return this.dataset.selected === 'true'; }
  set selected(v)   { this.dataset.selected = v ? 'true' : 'false'; }

  get interactive() { return this.dataset.interactive === 'true'; }
  set interactive(v){ this.dataset.interactive = v ? 'true' : 'false'; }

  get disabled()    { return this.hasAttribute('disabled'); }
  set disabled(v)   { v ? this.setAttribute('disabled', '') : this.removeAttribute('disabled'); }

  get elevation()   { return this.dataset.elevation || 'sm'; }
  set elevation(v)  { v ? this.dataset.elevation = v : delete this.dataset.elevation; }

  get heading()     { return this.dataset.label || ''; }
  set heading(v)    { v ? this.dataset.label = v : delete this.dataset.label; }

  get description() { return this.dataset.description || ''; }
  set description(v){ v ? this.dataset.description = v : delete this.dataset.description; }

  /* ── Private ──────────────────────────────────────────────────── */

  #updateInteractive() {
    if (this.interactive) {
      if (!this.hasAttribute('tabindex')) this.setAttribute('tabindex', '0');
    } else {
      this.removeAttribute('tabindex');
    }
  }

  #syncHeading() {
    if (this.#titleEl) this.#titleEl.textContent = this.heading;
  }

  #syncDescription() {
    if (this.#descriptionEl) this.#descriptionEl.textContent = this.description;
  }

  #handleClick = () => {
    if (this.interactive && !this.disabled) {
      this.dispatchEvent(new CustomEvent('card-click', { bubbles: true, composed: true }));
    }
  };

  #handleKeydown = (e) => {
    if (this.disabled || !this.interactive) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.dispatchEvent(new CustomEvent('card-click', { bubbles: true, composed: true }));
    }
  };
}

customElements.define('sherpa-card', SherpaCard);
