/**
 * @element sherpa-menu-item
 * @description Attribute-driven menu item with multiple template variants.
 *   Templates: default, checkbox, radio, toggle, heading.
 *
 * @attr {enum}    [data-type]        — checkbox | radio | toggle | heading (default: action)
 * @attr {enum}    [data-variant]     — null | "danger" (red destructive treatment)
 * @attr {string}  [data-icon]        — Font Awesome icon name (e.g. "trash")
 * @attr {enum}    [data-icon-weight] — solid (default) | regular | light | thin | brands
 * @attr {string}  [data-action]      — Action identifier dispatched in menu-select
 * @attr {string}  [value]            — Value associated with this item
 * @attr {enum}    [data-selection]    — single | multiple
 * @attr {boolean} [checked]          — Whether checkbox/radio/toggle is checked
 * @attr {boolean} [disabled]         — Whether the item is disabled
 * @attr {string}  [data-description] — Secondary description text
 * @attr {string}  [data-group]       — Group identifier for radio grouping
 * @attr {boolean} [data-keep-open]   — Keep menu open after selection
 * @attr {boolean} [data-has-submenu] — Whether the item opens a submenu
 * @attr {string}  [name]             — Form-compatible name for radio/checkbox
 *
 * @slot (default) — Label text content
 *
 * @prop {Element} inputElement — Reference to internal input (checkbox/radio/switch)
 */

import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';
import '../sherpa-switch/sherpa-switch.js';

const ROLES = { radio: 'menuitemradio', checkbox: 'menuitemcheckbox', toggle: 'menuitemcheckbox' };

export class SherpaMenuItem extends SherpaElement {

  static get cssUrl()  { return new URL('./sherpa-menu-item.css', import.meta.url).href; }
  static get htmlUrl() { return new URL('./sherpa-menu-item.html', import.meta.url).href; }

  static get observedAttributes() {
    return [...super.observedAttributes, 'data-type', 'data-selection', 'checked', 'disabled', 'data-description', 'name', 'data-icon', 'data-icon-weight'];
  }

  get templateId() {
    if (this.dataset.type === 'heading') return 'heading';
    const sel = this.dataset.selection;
    if (sel === 'checkbox') return 'checkbox';
    if (sel === 'radio') return 'radio';
    if (sel === 'toggle') return 'toggle';
    return 'default';
  }

  /** @returns {HTMLInputElement|null} The native checkbox or radio input, if present. */
  get inputElement() {
    return this.$('.input');
  }

  onRender() {
    if (this.dataset.type !== 'heading' && !this.hasAttribute('tabindex')) {
      this.setAttribute('tabindex', '-1');
    }
    this.#sync();
  }

  onAttributeChanged(name, old) {
    if (name === 'data-type') {
      this.renderTemplate(this.templateId);
      return;
    }
    if (name === 'data-selection') {
      this.renderTemplate(this.templateId);
      return;
    }
    this.#sync();
  }

  #sync() {
    if (this.dataset.type === 'heading') {
      this.setAttribute('role', 'presentation');
      this.removeAttribute('tabindex');
      return;
    }

    const sel = this.dataset.selection;

    this.setAttribute('role', ROLES[sel] || 'menuitem');
    this.setAttribute('aria-disabled', String(this.hasAttribute('disabled')));

    if (sel === 'radio' || sel === 'checkbox' || sel === 'toggle') {
      this.setAttribute('aria-checked', String(this.hasAttribute('checked')));
    } else {
      this.removeAttribute('aria-checked');
    }

    // Sync native checkbox/radio input
    const input = this.$('.input');
    if (input) {
      input.checked = this.hasAttribute('checked');
      if (sel === 'radio' && this.hasAttribute('name')) {
        input.name = this.getAttribute('name');
      }
    }

    const desc = this.$('.description');
    if (desc) desc.textContent = this.dataset.description || '';

    const sw = this.$('sherpa-switch');
    if (sw) sw.dataset.state = this.hasAttribute('checked') ? 'on' : 'off';

    const icon = this.$('.menu-item-icon');
    if (icon) {
      const name = this.dataset.icon;
      if (name) {
        const weight = this.dataset.iconWeight || 'solid';
        icon.className = `menu-item-icon sherpa-icon fa-${weight} fa-${name}`;
      } else {
        icon.className = 'menu-item-icon sherpa-icon';
      }
    }
  }
}

customElements.define('sherpa-menu-item', SherpaMenuItem);
