/**
 * SherpaNavItem — Attribute-driven navigation item (extends SherpaElement, shadow DOM).
 *
 * Architecture: Minimal JS — icon synced via data-icon attribute, rest is declarative.
 *   • Host element IS the interactive row (role + tabindex set in templates)
 *   • Template children flat in shadow root (no wrapper div)
 *   • Label text projected via default <slot> (element's text content)
 *   • Icon set via data-icon attribute (FontAwesome class string)
 *   • Badge rendered via <sherpa-tag> in shadow DOM, driven by data-badge attribute
 *   • Slot presence auto-detected by SherpaElement (data-has-label)
 *   • All styling via :host([data-*]) selectors in shadow-scoped CSS
 *   • Search highlight, delete handling, and selection managed by SherpaNav
 *
 * Variants (data-variant):
 *   "section"      Section accordion header (chevron shown, no delete)
 *   "subsection"   Subsection accordion header (chevron shown, secondary bg, no delete)
 *   "child"        Leaf item inside a section (secondary background)
 *   (none)         Base item — Home, Settings links
 *
 * Chevron rotation managed by sherpa-nav.css via ::part(chevron)
 * and details[open] — no JS data-mode sync needed.
 *
 * State (data-state):
 *   "selected"     Active — shows indicator pip + active background
 *   (absent)       Unselected (default)
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
