/**
 * @element sherpa-nav-item
 * @description Attribute-driven navigation item. Minimal JS — icon synced
 *   via data-icon, rest is declarative. Selection and interaction managed by
 *   parent sherpa-nav. Chevron rotation via CSS ::part(chevron).
 *
 * @attr {string}  [data-icon]      — FontAwesome icon class (e.g. "fa-home")
 * @attr {string}  [data-icon-svg]  — Inline SVG markup string. Takes precedence over data-icon.
 *                                    Use fill="currentColor" inside the SVG to inherit nav color.
 * @attr {string}  [data-svg-icon]  — Key into window.__sherpaNavIcons registry; resolved to data-icon-svg.
 * @attr {string}  [data-badge]     — Badge text rendered via internal sherpa-tag
 * @attr {enum}    [data-badge-status] — Badge status (critical | info | success | warning | urgent | brand). Defaults to "success".
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
    return [...super.observedAttributes, 'data-icon', 'data-icon-svg', 'data-svg-icon', 'data-badge', 'data-badge-status'];
  }

  get templateId() { return 'item'; }

  onRender() {
    this.#syncIcon();
    this.#syncBadge();
  }

  onAttributeChanged(name) {
    if (name === 'data-icon' || name === 'data-icon-svg' || name === 'data-svg-icon') this.#syncIcon();
    if (name === 'data-badge' || name === 'data-badge-status') this.#syncBadge();
  }

  #syncIcon() {
    const container = this.$('.nav-item-icon');
    if (!container) return;
    let inner = container.querySelector('.nav-item-icon-inner');
    if (!inner) {
      inner = document.createElement('span');
      inner.className = 'nav-item-icon-inner';
      container.prepend(inner);
    }
    // Resolve registry key (data-svg-icon) → data-icon-svg if present.
    const svgKey = this.dataset.svgIcon;
    const registry = (typeof window !== 'undefined') ? window.__sherpaNavIcons : null;
    const svg = this.dataset.iconSvg || (svgKey && registry && registry[svgKey]) || '';
    if (svg) {
      // Inline SVG mode — replace inner contents with raw SVG markup.
      inner.innerHTML = svg;
      const svgEl = inner.querySelector('svg');
      if (svgEl) {
        svgEl.classList.add('sherpa-nav-item-svg');
        svgEl.setAttribute('aria-hidden', 'true');
      }
      return;
    }
    // Restore FontAwesome <i> if previously replaced.
    let iconEl = inner.querySelector('.sherpa-icon');
    if (!iconEl) {
      inner.innerHTML = '';
      iconEl = document.createElement('i');
      iconEl.className = 'sherpa-icon';
      iconEl.setAttribute('data-size', 'xs');
      iconEl.setAttribute('aria-hidden', 'true');
      inner.appendChild(iconEl);
    }
    const icon = this.dataset.icon;
    iconEl.className = icon ? `${icon} sherpa-icon` : 'sherpa-icon';
  }

  #syncBadge() {
    const tagEl = this.$('.nav-item-tag');
    if (!tagEl) return;
    const badge = this.dataset.badge;
    tagEl.textContent = badge || '';
    tagEl.dataset.status = this.dataset.badgeStatus || 'success';
    this.toggleAttribute('data-has-badge', !!badge);
  }
}

customElements.define('sherpa-nav-item', SherpaNavItem);
