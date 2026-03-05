/**
 * sherpa-menu-item.js — Attribute-driven menu item (extends AuxElement).
 *
 * Templates (in sherpa-menu-item.html):
 *   default — icon + label + description + chevron
 *   toggle  — switch + label + description
 *   heading — label only (non-interactive group heading)
 *
 * Attributes: data-type, data-icon, data-action, value, data-selection, checked, disabled,
 *             data-description, data-group, data-keep-open, data-has-submenu
 */

import { AuxElement } from '../utilities/sherpa-element/sherpa-element.js';
import '../sherpa-switch/sherpa-switch.js';

const ROLES = { radio: 'menuitemradio', checkbox: 'menuitemcheckbox', toggle: 'menuitemcheckbox' };

export class AuxMenuItem extends AuxElement {

  static get cssUrl()  { return new URL('./sherpa-menu-item.css', import.meta.url).href; }
  static get htmlUrl() { return new URL('./sherpa-menu-item.html', import.meta.url).href; }

  static get observedAttributes() {
    return [...super.observedAttributes, 'data-type', 'data-icon', 'data-selection', 'checked', 'disabled', 'data-description'];
  }

  get templateId() {
    if (this.dataset.type === 'heading') return 'heading';
    return this.dataset.selection === 'toggle' ? 'toggle' : 'default';
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
    if (name === 'data-selection' && (old === 'toggle') !== (this.templateId === 'toggle')) {
      this.renderTemplate(this.templateId);
    }
    this.#sync();
  }

  #sync() {
    if (this.dataset.type === 'heading') {
      this.setAttribute('role', 'presentation');
      this.removeAttribute('tabindex');
      return;
    }

    const sel  = this.dataset.selection;
    const icon = this.dataset.icon;

    this.setAttribute('role', ROLES[sel] || 'menuitem');
    this.setAttribute('aria-disabled', String(this.hasAttribute('disabled')));

    if (sel === 'radio' || sel === 'checkbox' || sel === 'toggle') {
      this.setAttribute('aria-checked', String(this.hasAttribute('checked')));
    } else {
      this.removeAttribute('aria-checked');
    }

    const iconEl = this.$('.sherpa-icon');
    if (iconEl) {
      if (sel === 'checkbox') {
        // Auto-set checkbox icon based on checked state
        const checked = this.hasAttribute('checked');
        iconEl.className = checked
          ? 'fa-solid fa-square-check sherpa-icon'
          : 'fa-regular fa-square sherpa-icon';
      } else if (sel === 'radio') {
        const checked = this.hasAttribute('checked');
        iconEl.className = checked
          ? 'fa-solid fa-circle-dot sherpa-icon'
          : 'fa-regular fa-circle sherpa-icon';
      } else {
        iconEl.className = icon ? `${icon} sherpa-icon` : 'sherpa-icon';
      }
    }

    const desc = this.$('.description');
    if (desc) desc.textContent = this.dataset.description || '';

    const sw = this.$('sherpa-switch');
    if (sw) sw.dataset.state = this.hasAttribute('checked') ? 'on' : 'off';
  }
}

customElements.define('sherpa-menu-item', AuxMenuItem);
