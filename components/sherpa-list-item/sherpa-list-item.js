/**
 * @element sherpa-list-item
 * @description Versatile list item with leading, content, and trailing areas.
 *   Supports labels, descriptions, icons, drag handles, and slotted trailing actions.
 *
 * @attr {string}  [data-label]       — Primary text
 * @attr {string}  [data-description] — Secondary helper text
 * @attr {string}  [data-icon]        — FontAwesome class for leading icon
 * @attr {boolean} [data-active]      — Active/selected visual state
 * @attr {boolean} [data-interactive] — Enables hover/click behaviour
 * @attr {boolean} [data-draggable]   — Shows drag handle
 * @attr {boolean} [disabled]         — Disabled state
 *
 * @slot leading  — Custom leading content (avatar, icon override)
 * @slot (default) — Custom content below label/description
 * @slot trailing — Trailing action buttons or badges
 *
 * @fires list-item-click
 *   bubbles: true, composed: true
 *   detail: { label: string }
 *
 * @prop {string}  label       — Getter/setter for data-label
 * @prop {string}  description — Getter/setter for data-description
 * @prop {boolean} active      — Getter/setter for data-active
 */

import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';

export class SherpaListItem extends SherpaElement {

  /* ── Config ───────────────────────────────────────────────────── */

  static get cssUrl()  { return new URL('./sherpa-list-item.css', import.meta.url).href; }
  static get htmlUrl() { return new URL('./sherpa-list-item.html', import.meta.url).href; }

  static get observedAttributes() {
    return [...super.observedAttributes, 'data-label', 'data-description', 'data-icon', 'data-active', 'data-interactive', 'disabled'];
  }

  /* ── Cached refs ──────────────────────────────────────────────── */

  #labelEl       = null;
  #descriptionEl = null;
  #iconEl        = null;

  /* ── Lifecycle ────────────────────────────────────────────────── */

  onRender() {
    this.#labelEl       = this.$('.label');
    this.#descriptionEl = this.$('.description');
    this.#iconEl        = this.$('.icon');

    this.#syncLabel();
    this.#syncDescription();
    this.#syncIcon();
  }

  onConnect() {
    if (this.dataset.interactive !== undefined) {
      this.#updateInteractive();
    }
    this.addEventListener('click', this.#handleClick);
    this.addEventListener('keydown', this.#handleKeydown);
  }

  onDisconnect() {
    this.removeEventListener('click', this.#handleClick);
    this.removeEventListener('keydown', this.#handleKeydown);
  }

  onAttributeChanged(name) {
    switch (name) {
      case 'data-label':       this.#syncLabel(); break;
      case 'data-description': this.#syncDescription(); break;
      case 'data-icon':        this.#syncIcon(); break;
      case 'data-interactive': this.#updateInteractive(); break;
    }
  }

  /* ── Public API ───────────────────────────────────────────────── */

  get label()       { return this.dataset.label || ''; }
  set label(v)      { v ? (this.dataset.label = v) : delete this.dataset.label; }

  get description() { return this.dataset.description || ''; }
  set description(v){ v ? (this.dataset.description = v) : delete this.dataset.description; }

  get active()      { return this.hasAttribute('data-active'); }
  set active(v)     { this.toggleAttribute('data-active', Boolean(v)); }

  /* ── Sync methods ─────────────────────────────────────────────── */

  #syncLabel() {
    if (this.#labelEl) this.#labelEl.textContent = this.dataset.label || '';
  }

  #syncDescription() {
    if (this.#descriptionEl) this.#descriptionEl.textContent = this.dataset.description || '';
  }

  #syncIcon() {
    if (!this.#iconEl) return;
    const icon = (this.dataset.icon || '').trim();
    this.#iconEl.className = icon ? `icon ${icon}` : 'icon';
  }

  #updateInteractive() {
    if (this.dataset.interactive !== undefined) {
      if (!this.hasAttribute('tabindex')) this.setAttribute('tabindex', '0');
    } else {
      this.removeAttribute('tabindex');
    }
  }

  /* ── Event handlers ───────────────────────────────────────────── */

  #handleClick = () => {
    if (this.dataset.interactive === undefined || this.hasAttribute('disabled')) return;
    this.dispatchEvent(new CustomEvent('list-item-click', {
      bubbles: true,
      composed: true,
      detail: { label: this.label },
    }));
  };

  #handleKeydown = (e) => {
    if (this.dataset.interactive === undefined || this.hasAttribute('disabled')) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.#handleClick();
    }
  };
}

customElements.define('sherpa-list-item', SherpaListItem);
