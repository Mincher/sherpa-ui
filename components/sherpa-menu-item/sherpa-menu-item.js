/**
 * sherpa-menu-item.js — Attribute-driven menu item (extends SherpaElement).
 *
 * Templates (in sherpa-menu-item.html):
 *   default  — label + description + chevron (plain action item)
 *   checkbox — native checkbox input + label + description
 *   radio    — native radio input + label + description
 *   toggle   — sherpa-switch + label + description
 *   heading  — label only (non-interactive group heading)
 *
 * Attributes: data-type, data-action, value, data-selection, checked, disabled,
 *             data-description, data-group, data-keep-open, data-has-submenu, name
 */

import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';
import '../sherpa-switch/sherpa-switch.js';

const ROLES = { radio: 'menuitemradio', checkbox: 'menuitemcheckbox', toggle: 'menuitemcheckbox' };

export class SherpaMenuItem extends SherpaElement {

  static get cssUrl()  { return new URL('./sherpa-menu-item.css', import.meta.url).href; }
  static get htmlUrl() { return new URL('./sherpa-menu-item.html', import.meta.url).href; }

  static get observedAttributes() {
    return [...super.observedAttributes, 'data-type', 'data-selection', 'checked', 'disabled', 'data-description', 'name'];
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
  }
}

customElements.define('sherpa-menu-item', SherpaMenuItem);
