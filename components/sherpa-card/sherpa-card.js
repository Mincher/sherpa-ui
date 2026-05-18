/**
 * sherpa-card.js
 * SherpaCard — Container component with header, content, and footer areas.
 *
 * Uses a native <header> with a <dl> for the card header area,
 * supporting both attribute-based headings and slotted custom content.
 *
 * @element sherpa-card
 * @category container
 *
 * @attr {string}  data-label       — Card title text
 * @attr {string}  data-description  — Card subtitle text
 * @attr {boolean} data-selected     — Selected/active state
 * @attr {boolean} data-selectable   — Renders a built-in radio indicator footer; click toggles `data-selected`
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
    return [...super.observedAttributes, 'data-selected', 'data-selectable', 'data-interactive', 'disabled', 'data-elevation', 'data-label', 'data-description'];
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
    // Selectable cards are implicitly interactive.
    if (this.selectable && !this.interactive) {
      this.dataset.interactive = 'true';
    }
    if ((this.interactive || this.selectable) && !this.hasAttribute('tabindex')) {
      this.setAttribute('tabindex', '0');
    }
    this.#syncAria();
    this.addEventListener('keydown', this.#handleKeydown);
    this.addEventListener('click', this.#handleClick);
  }

  onDisconnect() {
    this.removeEventListener('keydown', this.#handleKeydown);
    this.removeEventListener('click', this.#handleClick);
  }

  onAttributeChanged(name) {
    if (name === 'data-interactive' || name === 'data-selectable') {
      this.#updateInteractive();
      this.#syncAria();
    } else if (name === 'data-selected') {
      this.#syncAria();
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

  get selectable() { return this.dataset.selectable === 'true'; }
  set selectable(v){ v ? this.dataset.selectable = 'true' : delete this.dataset.selectable; }

  get disabled()    { return this.hasAttribute('disabled'); }
  set disabled(v)   { v ? this.setAttribute('disabled', '') : this.removeAttribute('disabled'); }

  get elevation()   { return this.dataset.elevation || 'none'; }
  set elevation(v)  { v ? this.dataset.elevation = v : delete this.dataset.elevation; }

  get heading()     { return this.dataset.label || ''; }
  set heading(v)    { v ? this.dataset.label = v : delete this.dataset.label; }

  get description() { return this.dataset.description || ''; }
  set description(v){ v ? this.dataset.description = v : delete this.dataset.description; }

  /* ── Private ──────────────────────────────────────────────────── */

  #updateInteractive() {
    const focusable = this.interactive || this.selectable;
    if (focusable) {
      if (!this.hasAttribute('tabindex')) this.setAttribute('tabindex', '0');
    } else {
      this.removeAttribute('tabindex');
    }
  }

  #syncAria() {
    if (this.selectable) {
      this.setAttribute('role', 'radio');
      this.setAttribute('aria-checked', this.selected ? 'true' : 'false');
    } else if (this.getAttribute('role') === 'radio') {
      this.removeAttribute('role');
      this.removeAttribute('aria-checked');
    }
  }

  #syncHeading() {
    if (this.#titleEl) this.#titleEl.textContent = this.heading;
  }

  #syncDescription() {
    if (this.#descriptionEl) this.#descriptionEl.textContent = this.description;
  }

  #handleClick = () => {
    if (this.disabled) return;
    if (this.selectable) {
      const next = !this.selected;
      this.selected = next;
      this.dispatchEvent(new CustomEvent('card-select', { bubbles: true, composed: true, detail: { selected: next } }));
    }
    if (this.interactive) {
      this.dispatchEvent(new CustomEvent('card-click', { bubbles: true, composed: true }));
    }
  };

  #handleKeydown = (e) => {
    if (this.disabled) return;
    if (!(this.interactive || this.selectable)) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.#handleClick();
    }
  };
}

customElements.define('sherpa-card', SherpaCard);
