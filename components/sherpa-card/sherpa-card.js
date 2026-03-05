/**
 * sherpa-card.js
 * AuxCard — Web Component extending AuxElement base class.
 *
 * Uses an internal <sherpa-header> for the card header area, supporting
 * both attribute-based headings and slotted custom content.
 *
 * Usage:
 *   <sherpa-card>Simple content</sherpa-card>
 *   <sherpa-card heading="Card Title" description="Subtitle">Content</sherpa-card>
 *   <sherpa-card>
 *     <span slot="header">Custom Header</span>
 *     Main content goes here
 *     <div slot="footer">Footer actions</div>
 *   </sherpa-card>
 *   <sherpa-card selected>Selected card</sherpa-card>
 *   <sherpa-card interactive>Clickable card</sherpa-card>
 *
 * Slots:
 *   - header: Custom heading content (forwarded to sherpa-header heading slot)
 *   - (default): Main card content
 *   - footer: Card footer content
 *
 * Attributes:
 *   - heading: Card title text (forwarded to sherpa-header)
 *   - description: Card subtitle text (forwarded to sherpa-header)
 *   - selected: Selected/active state
 *   - interactive: Makes card clickable
 *   - disabled: Disabled state
 *   - elevation: "none" | "sm" | "md" | "lg"
 *
 * @fires card-click — When interactive card is clicked
 */

import { AuxElement } from '../utilities/sherpa-element/sherpa-element.js';
import '../sherpa-header/sherpa-header.js';

export class AuxCard extends AuxElement {

  /* ── Config ───────────────────────────────────────────────────── */

  static get cssUrl()  { return new URL('./sherpa-card.css', import.meta.url).href; }
  static get htmlUrl() { return new URL('./sherpa-card.html', import.meta.url).href; }

  static get observedAttributes() {
    return ['data-selected', 'data-interactive', 'disabled', 'data-elevation', 'data-label', 'data-description'];
  }

  /* ── Lifecycle hooks ──────────────────────────────────────────── */

  onRender() {
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
    const header = this.$('sherpa-header');
    if (header) header.heading = this.heading;
  }

  #syncDescription() {
    const header = this.$('sherpa-header');
    if (header) header.description = this.description;
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

customElements.define('sherpa-card', AuxCard);
