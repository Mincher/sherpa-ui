/**
 * @element sherpa-nav-item
 * @category nav
 * @description A single item inside sherpa-nav. Not used standalone — the parent nav reads these
 *   from its HTML template and manages their interaction and selection state. Supports three
 *   variants: section (top-level), subsection (collapsible group header), and child (leaf link).
 *   Add data-badge for notification counts and data-icon-svg for custom SVG icons registered in
 *   window.__sherpaNavIcons.
 *
 * @attr {string}  data-icon      — FontAwesome icon class (e.g. "fa-home")
 * @attr {string}  data-icon-svg  — Inline SVG markup string or registry key (window.__sherpaNavIcons).
 *                                    Takes precedence over data-icon. Use fill="currentColor" inside SVG.
 * @attr {string}  data-badge     — Badge text rendered via internal sherpa-tag
 * @attr {enum}    data-badge-status — Badge status (critical | info | success | warning | urgent | brand). Defaults to "success".
 * @attr {enum}    data-variant  — section | subsection | child
 * @attr {enum}    data-state    — selected
 * @attr {enum}    data-type     — promo — renders a large CTA-style row
 * @attr {string}  data-description — Promo description text (data-type="promo" only)
 *
 * @slot (default) — Label text content
 *
 * @csspart indicator — Active indicator bar (left edge visual)
 * @csspart drag — Drag handle icon (visible when data-editable is set on parent)
 * @csspart icon — Icon container
 * @csspart dot — Collapsed section dot indicator
 * @csspart label — Text label container
 * @csspart tag — Badge element (sherpa-tag instance)
 * @csspart chevron — Expand/collapse chevron (section/subsection variants)
 * @csspart delete — Delete button (visible when data-editable is set on parent)
 * @csspart heading — Promo heading text (data-type="promo" only)
 * @csspart description — Promo description text (data-type="promo" only)
 */

import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';
import '../sherpa-tag/sherpa-tag.js';

declare global {
  interface Window {
    /** Optional registry mapping svg-icon keys to inline SVG markup. */
    __sherpaNavIcons?: Record<string, string>;
  }
}

export class SherpaNavItem extends SherpaElement {

  static override get cssUrl(): string  { return new URL('./sherpa-nav-item.css', import.meta.url).href; }
  static override get htmlUrl(): string { return new URL('./sherpa-nav-item.html', import.meta.url).href; }

  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, 'data-icon', 'data-icon-svg', 'data-badge', 'data-badge-status', 'data-type', 'data-description'];
  }

  override get templateId(): string { return this.dataset["type"] === 'promo' ? 'promo' : 'item'; }

  override onRender(): void {
    this.#syncIcon();
    this.#syncBadge();
    this.#syncDescription();
  }

  override onAttributeChanged(name: string): void {
    if (name === 'data-type') {
      this.renderTemplate(this.templateId).then(() => {
        this.#syncIcon();
        this.#syncBadge();
        this.#syncDescription();
      });
      return;
    }
    if (name === 'data-icon' || name === 'data-icon-svg') this.#syncIcon();
    if (name === 'data-badge' || name === 'data-badge-status') this.#syncBadge();
    if (name === 'data-description') this.#syncDescription();
  }

  #syncIcon(): void {
    // Promo template: simple icon swap, no SVG/inner-wrapper logic.
    if (this.dataset["type"] === 'promo') {
      const promoIconEl = this.$('.nav-promo-icon .sherpa-icon');
      if (promoIconEl) {
        const icon = this.dataset["icon"];
        promoIconEl.className = icon ? `${icon} sherpa-icon` : 'sherpa-icon';
        if (!promoIconEl.hasAttribute('data-size')) promoIconEl.setAttribute('data-size', 'lg');
      }
      return;
    }
    // The .nav-item-icon-inner scaffold (and its <i>) is declared in the
    // template, so we only ever update it here — never build it.
    const inner = this.$('.nav-item-icon-inner');
    if (!inner) return;
    // data-icon-svg may be an inline SVG string or a key into window.__sherpaNavIcons.
    const iconSvgAttr = this.dataset["iconSvg"] || '';
    const registry = (typeof window !== 'undefined') ? window.__sherpaNavIcons : null;
    const svg = (registry && registry[iconSvgAttr]) || iconSvgAttr;
    if (svg) {
      // Inline SVG mode — replace inner contents with raw SVG markup.
      inner.innerHTML = svg;
      const svgEl = inner.querySelector('svg');
      if (svgEl) {
        svgEl.dataset["navItemSvg"] = 'true';
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
    const icon = this.dataset["icon"];
    iconEl.className = icon ? `${icon} sherpa-icon` : 'sherpa-icon';
  }

  #syncBadge(): void {
    const tagEl = this.$<HTMLElement>('.nav-item-tag');
    if (!tagEl) return;
    const badge = this.dataset["badge"];
    tagEl.textContent = badge || '';
    tagEl.dataset["status"] = this.dataset["badgeStatus"] || 'success';
    this.toggleAttribute('data-has-badge', !!badge);
  }

  #syncDescription(): void {
    const descEl = this.$('.nav-promo-description');
    if (!descEl) return;
    descEl.textContent = this.dataset["description"] || '';
  }
}

customElements.define('sherpa-nav-item', SherpaNavItem);
