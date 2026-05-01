/**
 * @element sherpa-list-panel
 * @description Searchable panel that wraps consumer-projected list content.
 *   Composes sherpa-input-search at the top; the search field string-matches
 *   text within slotted children (similar to sherpa-nav search). Items whose
 *   text does not contain the filter are hidden via the native `hidden`
 *   attribute on the light-DOM element. Matched text is highlighted via the
 *   CSS Highlight API (`::highlight(list-panel-match)`).
 *
 *   Does NOT render accordion sections — section grouping is left to the
 *   consumer (e.g. by projecting <sherpa-list> blocks or <details> blocks).
 *
 * @attr {string} [data-match=sherpa-list-item] CSS selector identifying the
 *                                              "rows" that participate in
 *                                              search filtering.
 * @attr {string} [data-empty="No results"]      Empty-state message shown when
 *                                              search yields zero matches.
 * @attr {flag}   [data-bordered]                Adds a rounded outer border.
 *
 * @slot (default) — Panel body content (typically <sherpa-list> blocks
 *                   containing <sherpa-list-item> children, or any custom
 *                   content matching the data-match selector).
 * @slot search    — Optional override for the default sherpa-input-search.
 *
 * @fires list-panel-search
 *   bubbles: true, composed: true
 *   detail: { value: string, matchCount: number }
 *
 * @method clearSearch() — Clear the search field and reset visibility.
 */

import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';
import '../sherpa-input-search/sherpa-input-search.js';

const HIGHLIGHT_NAME = 'list-panel-match';

export class SherpaListPanel extends SherpaElement {
  static get cssUrl()  { return new URL('./sherpa-list-panel.css', import.meta.url).href; }
  static get htmlUrl() { return new URL('./sherpa-list-panel.html', import.meta.url).href; }

  static get observedAttributes() {
    return [...super.observedAttributes, 'data-match', 'data-empty'];
  }

  /** @type {HTMLElement|null} */
  #searchEl  = null;
  /** @type {HTMLElement|null} */
  #emptyEl   = null;
  /** @type {MutationObserver|null} */
  #observer  = null;
  #currentFilter = '';

  /* ── lifecycle ─────────────────────────────────────────── */

  onRender() {
    this.#searchEl = this.$('.panel-search');
    this.#emptyEl  = this.$('.panel-empty');
    this.#syncEmptyMessage();

    this.#searchEl?.addEventListener('input',  this.#onSearchChange);
    this.#searchEl?.addEventListener('search', this.#onSearchChange);
  }

  onConnect() {
    // Re-run filter when consumer mutates light-DOM (e.g. async data load).
    this.#observer = new MutationObserver(() => {
      if (this.#currentFilter) this.#applyFilter(this.#currentFilter);
    });
    this.#observer.observe(this, { childList: true, subtree: true });
  }

  onDisconnect() {
    this.#observer?.disconnect();
    this.#observer = null;
    this.#clearHighlights();
  }

  onAttributeChanged(name) {
    if (name === 'data-empty') this.#syncEmptyMessage();
    if (name === 'data-match' && this.#currentFilter) {
      this.#applyFilter(this.#currentFilter);
    }
  }

  /* ── public api ────────────────────────────────────────── */

  clearSearch() {
    if (this.#searchEl && typeof this.#searchEl.clear === 'function') {
      this.#searchEl.clear();
    } else {
      this.#applyFilter('');
    }
  }

  /* ── handlers ──────────────────────────────────────────── */

  #onSearchChange = (e) => {
    const value = (e.detail?.value ?? e.target?.value ?? '').toString();
    this.#applyFilter(value);
  };

  /* ── filter logic ──────────────────────────────────────── */

  #syncEmptyMessage() {
    if (!this.#emptyEl) return;
    this.#emptyEl.textContent = this.dataset.empty || 'No results';
  }

  #getMatchSelector() {
    return this.dataset.match || 'sherpa-list-item';
  }

  #applyFilter(rawValue) {
    const filter = (rawValue || '').trim().toLowerCase();
    this.#currentFilter = filter;

    const selector = this.#getMatchSelector();
    const items = Array.from(this.querySelectorAll(selector));

    this.#clearHighlights();

    if (!filter) {
      items.forEach((el) => el.removeAttribute('hidden'));
      this.removeAttribute('data-empty-visible');
      this.dispatchEvent(new CustomEvent('list-panel-search', {
        bubbles: true, composed: true,
        detail: { value: '', matchCount: items.length },
      }));
      return;
    }

    const ranges = [];
    let matchCount = 0;

    for (const item of items) {
      const haystack = this.#getMatchText(item).toLowerCase();
      const matched = haystack.includes(filter);
      if (matched) {
        item.removeAttribute('hidden');
        matchCount += 1;
        const range = this.#createMatchRange(item, filter);
        if (range) ranges.push(range);
      } else {
        item.setAttribute('hidden', '');
      }
    }

    if (ranges.length && typeof CSS !== 'undefined' && CSS.highlights && typeof Highlight !== 'undefined') {
      try {
        CSS.highlights.set(HIGHLIGHT_NAME, new Highlight(...ranges));
      } catch { /* unsupported — graceful degrade */ }
    }

    this.toggleAttribute('data-empty-visible', matchCount === 0);

    this.dispatchEvent(new CustomEvent('list-panel-search', {
      bubbles: true, composed: true,
      detail: { value: filter, matchCount },
    }));
  }

  #clearHighlights() {
    if (typeof CSS !== 'undefined' && CSS.highlights) {
      CSS.highlights.delete(HIGHLIGHT_NAME);
    }
  }

  /**
   * Build the searchable haystack for an item. Many sherpa list components
   * (e.g. <sherpa-list-item>) render their visible label inside their own
   * shadow DOM, so the host's light-DOM textContent is empty. Fall back to
   * common text-bearing attributes so the panel can still match those rows.
   */
  #getMatchText(item) {
    const parts = [
      item.textContent || '',
      item.getAttribute('data-label') || '',
      item.getAttribute('data-description') || '',
      item.getAttribute('data-value') || '',
      item.getAttribute('aria-label') || '',
      item.getAttribute('title') || '',
    ];
    return parts.join(' ');
  }

  /** Build a Range for the first occurrence of `filter` in the item's text descendants. */
  #createMatchRange(item, filter) {
    const walker = document.createTreeWalker(item, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.textContent && n.textContent.trim())
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT,
    });
    let node;
    while ((node = walker.nextNode())) {
      const idx = node.textContent.toLowerCase().indexOf(filter);
      if (idx < 0) continue;
      const range = new Range();
      range.setStart(node, idx);
      range.setEnd(node, idx + filter.length);
      return range;
    }
    return null;
  }
}

customElements.define('sherpa-list-panel', SherpaListPanel);
