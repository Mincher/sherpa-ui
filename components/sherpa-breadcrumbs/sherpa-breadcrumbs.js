/**
 * sherpa-breadcrumbs.js
 * SherpaBreadcrumbs — Navigation breadcrumb trail with optional collapse.
 *
 * Reads slotted children (anchors/spans) and renders a styled breadcrumb
 * list with chevron separators. When the number of items exceeds
 * `data-max-items`, middle items are collapsed behind an "…" button.
 *
 * Usage:
 *   <sherpa-breadcrumbs>
 *     <a href="/">Home</a>
 *     <a href="/products">Products</a>
 *     <a href="/products/widgets">Widgets</a>
 *     <span>Widget Details</span>
 *   </sherpa-breadcrumbs>
 *
 *   <!-- Collapsed at 3 visible items -->
 *   <sherpa-breadcrumbs data-max-items="3">
 *     <a href="/">Home</a>
 *     <a href="/a">Level A</a>
 *     <a href="/a/b">Level B</a>
 *     <a href="/a/b/c">Level C</a>
 *     <span>Current</span>
 *   </sherpa-breadcrumbs>
 *
 * Slots:
 *   - (default): Breadcrumb items (<a href="…"> or <span>)
 *
 * Attributes:
 *   - data-max-items: Maximum visible items before collapsing (default: unlimited)
 *
 * @fires breadcrumb-click — { index, href, label } when a breadcrumb is clicked
 */

import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';

export class SherpaBreadcrumbs extends SherpaElement {

  /* ── Config ───────────────────────────────────────────────────── */

  static get cssUrl()  { return new URL('./sherpa-breadcrumbs.css', import.meta.url).href; }
  static get htmlUrl() { return new URL('./sherpa-breadcrumbs.html', import.meta.url).href; }

  static get observedAttributes() {
    return [...super.observedAttributes, 'data-max-items'];
  }

  /* ── Cached refs ──────────────────────────────────────────────── */

  #listEl      = null;
  #crumbTpl    = null;
  #ellipsisEl  = null;
  #crumbs      = [];  // rendered <li> elements
  #items       = [];  // source slotted elements

  /* ── Lifecycle ────────────────────────────────────────────────── */

  onRender() {
    this.#listEl     = this.$('.breadcrumb-list');
    this.#crumbTpl   = this.$('.crumb-tpl');
    this.#ellipsisEl = this.$('.crumb-ellipsis');

    // Wire ellipsis expand button
    const ellipsisBtn = this.$('.ellipsis-btn');
    if (ellipsisBtn) {
      ellipsisBtn.addEventListener('click', this.#handleEllipsisClick);
    }
  }

  onAttributeChanged(name) {
    if (name === 'data-max-items') {
      this.#applyCollapse();
    }
  }

  onSlotChange() {
    this.#buildCrumbs();
  }

  /* ── Public API ───────────────────────────────────────────────── */

  get maxItems() {
    const v = parseInt(this.dataset.maxItems, 10);
    return Number.isFinite(v) && v > 0 ? v : Infinity;
  }
  set maxItems(v) {
    v && Number.isFinite(v) ? (this.dataset.maxItems = String(v)) : delete this.dataset.maxItems;
  }

  /* ── Build breadcrumbs from slotted children ──────────────────── */

  #buildCrumbs() {
    if (!this.#listEl || !this.#crumbTpl) return;

    // Read slotted children
    const slot = this.$('.source-slot');
    const assigned = slot ? slot.assignedElements() : [];
    this.#items = assigned;

    // Remove previous rendered crumbs
    this.#crumbs.forEach(el => el.remove());
    this.#crumbs = [];

    // Clone prototype for each item
    this.#items.forEach((item, i) => {
      const fragment = this.#crumbTpl.content.cloneNode(true);
      const li = fragment.querySelector('.crumb');
      const textEl = li.querySelector('.crumb-text');

      // Use item's text content as the crumb label
      textEl.textContent = item.textContent.trim();
      li.dataset.index = String(i);

      // If source is an anchor, make the crumb clickable
      if (item.tagName === 'A' && item.href) {
        textEl.dataset.href = item.href;
        textEl.addEventListener('click', this.#handleCrumbClick);
      }

      // Insert before the ellipsis element
      this.#listEl.insertBefore(li, this.#ellipsisEl);
      this.#crumbs.push(li);
    });

    this.#applyCollapse();
  }

  #applyCollapse() {
    const max = this.maxItems;
    const total = this.#crumbs.length;

    if (total <= max || max === Infinity) {
      // No collapse needed
      this.removeAttribute('data-collapsed');
      this.#crumbs.forEach(c => c.removeAttribute('data-collapsed-hidden'));
      return;
    }

    // Collapse: show first item, ellipsis, last (max - 1) items
    this.setAttribute('data-collapsed', '');
    const visibleTail = max - 1; // items shown after ellipsis
    this.#crumbs.forEach((c, i) => {
      const isFirst = i === 0;
      const isTail = i >= total - visibleTail;
      c.toggleAttribute('data-collapsed-hidden', !isFirst && !isTail);
    });
  }

  /* ── Event handlers ───────────────────────────────────────────── */

  #handleCrumbClick = (e) => {
    const textEl = e.currentTarget;
    const li = textEl.closest('.crumb');
    const index = parseInt(li?.dataset.index, 10);
    const href = textEl.dataset.href || '';
    const label = textEl.textContent;

    this.dispatchEvent(new CustomEvent('breadcrumb-click', {
      bubbles: true,
      composed: true,
      detail: { index, href, label },
    }));
  };

  #handleEllipsisClick = () => {
    // Expand all crumbs
    this.removeAttribute('data-collapsed');
    this.#crumbs.forEach(c => c.removeAttribute('data-collapsed-hidden'));
  };
}

customElements.define('sherpa-breadcrumbs', SherpaBreadcrumbs);
