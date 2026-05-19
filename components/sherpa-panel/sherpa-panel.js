/**
 * sherpa-panel.js
 * SherpaPanel — Inline column or overlay drawer with header, optional toolbar,
 * optional search row, scrollable content area, and optional action-bar footer.
 *
 * Inline panels collapse to a narrow strip with a chevron toggle and an
 * optional vertical restore label. Use the built-in `data-search` flag (or
 * a `slot="search"` override) to turn the panel into a searchable list panel.
 *
 * @element sherpa-panel
 * @category container
 *
 * @attr {enum}    data-variant       — inline | overlay
 * @attr {enum}    data-position      — left | right | both
 * @attr {boolean} data-expanded      — Expanded (visible) state
 * @attr {string}  data-heading       — Heading text
 * @attr {string}  data-restore-label — Vertical label shown on the collapsed strip
 * @attr {string}  data-width         — Custom width (CSS value)
 * @attr {boolean} data-bordered      — Adds a rounded outer border
 * @attr {boolean} data-flush         — Removes content padding (slotted child owns gutters)
 * @attr {boolean} data-search        — Renders a built-in search row and filters slotted items
 * @attr {string}  data-search-match  — CSS selector for searchable items (default: `sherpa-list-item`)
 * @attr {string}  data-empty         — Empty-state message when search yields zero matches (default: `No results`)
 *
 * @slot           — Default slot for panel body content
 * @slot controls  — Header control buttons (placed before the collapse button)
 * @slot metadata  — Metadata row below the heading
 * @slot search    — Overrides the built-in search field (sherpa-input-search)
 * @slot toolbar   — Toolbar row between the header and the content area
 * @slot actions   — Action bar pinned to the bottom of the panel
 *
 * @fires panel-toggle — Fired when expanded state changes
 *   bubbles: true, composed: true
 *   detail: { expanded: boolean }
 * @fires panel-close — Fired when the collapse / close button is clicked
 *   bubbles: true, composed: true
 *   detail: { }
 * @fires panel-search — Fired when the search filter changes
 *   bubbles: true, composed: true
 *   detail: { value: string, matchCount: number }
 *
 * @method clearSearch() — Clear the search field and reset visibility
 */

import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";
import "../sherpa-input-search/sherpa-input-search.js";

const HIGHLIGHT_NAME = "panel-search-match";

class SherpaPanel extends SherpaElement {
  static get cssUrl() {
    return new URL("sherpa-panel.css", import.meta.url).href;
  }

  static get htmlUrl() {
    return new URL("sherpa-panel.html", import.meta.url).href;
  }

  static get observedAttributes() {
    return [
      ...super.observedAttributes,
      "data-heading",
      "data-restore-label",
      "data-expanded",
      "data-width",
      "data-empty",
      "data-search-match",
    ];
  }

  /** @type {HTMLSpanElement|null} */
  #headingEl = null;
  /** @type {HTMLSpanElement|null} */
  #restoreLblEl = null;
  /** @type {HTMLButtonElement|null} */
  #closeBtnEl = null;
  /** @type {HTMLButtonElement|null} */
  #triggerEl = null;
  /** @type {HTMLElement|null} */
  #searchEl = null;
  /** @type {HTMLElement|null} */
  #emptyEl = null;
  /** @type {MutationObserver|null} */
  #observer = null;
  #currentFilter = "";

  /* ── lifecycle ───────────────────────────────────────────── */

  onRender() {
    this.#headingEl = this.$(".header-title");
    this.#restoreLblEl = this.$(".collapse-label");
    this.#closeBtnEl = this.$(".close-btn");
    this.#triggerEl = this.$(".collapse-trigger");
    this.#searchEl = this.$(".panel-search");
    this.#emptyEl = this.$(".panel-empty");

    // Defaults
    if (!this.dataset.variant) this.dataset.variant = "inline";
    if (!this.dataset.position) this.dataset.position = "right";

    // Listeners
    this.#closeBtnEl?.addEventListener("click", this.#onClose);
    this.#triggerEl?.addEventListener("click", this.#onExpand);
    this.#searchEl?.addEventListener("input", this.#onSearchChange);
    this.#searchEl?.addEventListener("search", this.#onSearchChange);

    this.#syncHeading();
    this.#syncRestoreLabel();
    this.#syncWidth();
    this.#syncEmptyMessage();
  }

  onConnect() {
    // Re-run filter when consumer mutates light-DOM (e.g. async data load).
    this.#observer = new MutationObserver(() => {
      if (this.#currentFilter) this.#applyFilter(this.#currentFilter);
    });
    this.#observer.observe(this, { childList: true, subtree: true });
  }

  onDisconnect() {
    this.#closeBtnEl?.removeEventListener("click", this.#onClose);
    this.#triggerEl?.removeEventListener("click", this.#onExpand);
    this.#observer?.disconnect();
    this.#observer = null;
    this.#clearHighlights();
  }

  onAttributeChanged(name) {
    switch (name) {
      case "data-heading":
        this.#syncHeading();
        this.#syncRestoreLabel();
        break;
      case "data-restore-label":
        this.#syncRestoreLabel();
        break;
      case "data-expanded":
        this.#syncToggle();
        break;
      case "data-width":
        this.#syncWidth();
        break;
      case "data-empty":
        this.#syncEmptyMessage();
        break;
      case "data-search-match":
        if (this.#currentFilter) this.#applyFilter(this.#currentFilter);
        break;
    }
  }

  /* ── public api ──────────────────────────────────────────── */

  clearSearch() {
    if (this.#searchEl && typeof this.#searchEl.clear === "function") {
      this.#searchEl.clear();
    } else {
      this.#applyFilter("");
    }
  }

  /* ── handlers ────────────────────────────────────────────── */

  #onClose = () => {
    delete this.dataset.expanded;
    this.dispatchEvent(
      new CustomEvent("panel-close", { bubbles: true, composed: true })
    );
  };

  #onExpand = () => {
    this.dataset.expanded = "";
  };

  #onSearchChange = (e) => {
    const value = (e.detail?.value ?? e.target?.value ?? "").toString();
    this.#applyFilter(value);
  };

  /* ── sync helpers ────────────────────────────────────────── */

  #syncHeading() {
    if (this.#headingEl) {
      this.#headingEl.textContent = this.dataset.heading || "";
    }
  }

  #syncRestoreLabel() {
    if (this.#restoreLblEl) {
      this.#restoreLblEl.textContent =
        this.dataset.restoreLabel || this.dataset.heading || "";
    }
  }

  #syncToggle() {
    const expanded = this.hasAttribute("data-expanded");
    this.dispatchEvent(
      new CustomEvent("panel-toggle", {
        bubbles: true,
        composed: true,
        detail: { expanded },
      })
    );
  }

  #syncWidth() {
    if (this.dataset.width) {
      this.style.setProperty("--_panel-width", this.dataset.width);
    } else {
      this.style.removeProperty("--_panel-width");
    }
  }

  #syncEmptyMessage() {
    if (this.#emptyEl) {
      this.#emptyEl.textContent = this.dataset.empty || "No results";
    }
  }

  /* ── search filter logic ─────────────────────────────────── */

  #getMatchSelector() {
    return this.dataset.searchMatch || "sherpa-list-item";
  }

  #applyFilter(rawValue) {
    const filter = (rawValue || "").trim().toLowerCase();
    this.#currentFilter = filter;

    const selector = this.#getMatchSelector();
    const items = Array.from(this.querySelectorAll(selector));

    this.#clearHighlights();

    if (!filter) {
      items.forEach((el) => el.removeAttribute("hidden"));
      this.removeAttribute("data-empty-visible");
      this.dispatchEvent(
        new CustomEvent("panel-search", {
          bubbles: true,
          composed: true,
          detail: { value: "", matchCount: items.length },
        })
      );
      return;
    }

    const ranges = [];
    let matchCount = 0;

    for (const item of items) {
      const haystack = this.#getMatchText(item).toLowerCase();
      const matched = haystack.includes(filter);
      if (matched) {
        item.removeAttribute("hidden");
        matchCount += 1;
        const range = this.#createMatchRange(item, filter);
        if (range) ranges.push(range);
      } else {
        item.setAttribute("hidden", "");
      }
    }

    if (
      ranges.length &&
      typeof CSS !== "undefined" &&
      CSS.highlights &&
      typeof Highlight !== "undefined"
    ) {
      try {
        CSS.highlights.set(HIGHLIGHT_NAME, new Highlight(...ranges));
      } catch {
        /* unsupported — graceful degrade */
      }
    }

    this.toggleAttribute("data-empty-visible", matchCount === 0);

    this.dispatchEvent(
      new CustomEvent("panel-search", {
        bubbles: true,
        composed: true,
        detail: { value: filter, matchCount },
      })
    );
  }

  #clearHighlights() {
    if (typeof CSS !== "undefined" && CSS.highlights) {
      CSS.highlights.delete(HIGHLIGHT_NAME);
    }
  }

  /**
   * Build the searchable haystack for an item. Many sherpa components
   * (e.g. sherpa-list-item) render their visible label inside their own
   * shadow DOM, so the host's light-DOM textContent is empty. Fall back to
   * common text-bearing attributes so the panel can still match those rows.
   */
  #getMatchText(item) {
    return [
      item.textContent || "",
      item.getAttribute("data-label") || "",
      item.getAttribute("data-description") || "",
      item.getAttribute("data-value") || "",
      item.getAttribute("aria-label") || "",
      item.getAttribute("title") || "",
    ].join(" ");
  }

  /** Build a Range for the first occurrence of `filter` in the item's text descendants. */
  #createMatchRange(item, filter) {
    const walker = document.createTreeWalker(item, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) =>
        n.textContent && n.textContent.trim()
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

customElements.define("sherpa-panel", SherpaPanel);
export { SherpaPanel };
