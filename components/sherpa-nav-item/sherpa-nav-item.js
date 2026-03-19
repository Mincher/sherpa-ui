/**
 * @element sherpa-nav-item
 * @description Attribute-driven navigation item. Minimal JS — icon synced
 *   via data-icon, rest is declarative. Selection and interaction managed by
 *   parent sherpa-nav. Chevron rotation via CSS ::part(chevron).
 *
 * @attr {string}  [data-icon]    — FontAwesome icon class (e.g. "fa-home")
 * @attr {string}  [data-badge]   — Badge text rendered via internal sherpa-tag
 * @attr {enum}    [data-variant]  — section | subsection | child
 * @attr {enum}    [data-state]    — selected
 *
 * @slot (default) — Label text content
 */

import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';
import '../sherpa-tag/sherpa-tag.js';

export class SherpaNavItem extends SherpaElement {

  static get cssUrl()  { return new URL('./sherpa-nav-item.css', import.meta.url).href; }
  static get htmlUrl() { return new URL('./sherpa-nav-item.html', import.meta.url).href; }

  static get observedAttributes() {
    return [...super.observedAttributes, 'data-icon', 'data-badge'];
  }

  get templateId() { return 'item'; }

  onRender() {
    this.#syncIcon();
    this.#syncBadge();
  }

  onAttributeChanged(name) {
    if (name === 'data-icon') this.#syncIcon();
    if (name === 'data-badge') this.#syncBadge();
  }

  #syncIcon() {
    const iconEl = this.$('.nav-item-icon .sherpa-icon');
    if (!iconEl) return;
    const icon = this.dataset.icon;
    iconEl.className = icon ? `${icon} sherpa-icon` : 'sherpa-icon';
  }

  #syncBadge() {
    const tagEl = this.$('.nav-item-tag');
    if (!tagEl) return;
    const badge = this.dataset.badge;
    tagEl.textContent = badge || '';
    this.toggleAttribute('data-has-badge', !!badge);
  }
}

customElements.define('sherpa-nav-item', SherpaNavItem);
