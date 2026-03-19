/**
 * sherpa-list-item.js
 * SherpaListItem — Versatile list item with leading, content, and trailing areas.
 *
 * A reusable list item supporting labels, descriptions, icons, drag handles,
 * and slotted trailing actions. Designed for use in lists, menus, settings panels,
 * and selection interfaces.
 *
 * Usage:
 *   <sherpa-list-item data-label="Item Name" data-description="Supporting text">
 *   </sherpa-list-item>
 *
 *   <sherpa-list-item data-label="Draggable" data-draggable data-interactive>
 *     <sherpa-button slot="trailing" data-variant="tertiary" data-size="small" data-label="Edit"></sherpa-button>
 *   </sherpa-list-item>
 *
 *   <sherpa-list-item data-icon="fa-solid fa-file" data-label="Document.pdf"
 *                     data-description="2.4 MB" data-interactive>
 *   </sherpa-list-item>
 *
 * Slots:
 *   - leading:  Custom leading content (avatar, icon override)
 *   - (default): Custom content below label/description
 *   - trailing: Trailing action buttons or badges
 *
 * Attributes:
 *   - data-label:       Primary text
 *   - data-description: Secondary helper text
 *   - data-icon:        FontAwesome class for leading icon
 *   - data-active:      Active/selected visual state
 *   - data-interactive: Enables hover/click behaviour
 *   - data-draggable:   Shows drag handle
 *   - disabled:         Disabled state
 *
 * @fires list-item-click — { label } when interactive item is clicked
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
