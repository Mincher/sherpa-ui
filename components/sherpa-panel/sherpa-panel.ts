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
 * @description Resizable inline column or slide-in overlay drawer with header, optional toolbar,
 *   built-in search, scrollable content, and action footer. Use for persistent side content:
 *   settings, record details, history logs, or AI conversation threads. Inline panels collapse
 *   to a narrow strip with a chevron toggle; overlay panels slide in from the edge. The ai
 *   variant adds a prompt-composer slot and archive/new-chat controls for full chat panel layouts.
 *
 * @attr {enum}    data-variant       — inline | overlay | ai
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
 * @attr {boolean} data-can-archive   — (AI variant) Enables the archive button
 * @attr {boolean} data-busy          — (AI variant) Disables new-chat and archive buttons
 *
 * @slot           — Default slot for panel body content
 * @slot controls  — Header control buttons (placed before the collapse button)
 * @slot metadata  — Metadata row below the heading
 * @slot search    — Overrides the built-in search field (sherpa-input-search)
 * @slot toolbar   — Toolbar row between the header and the content area
 * @slot actions   — Action bar pinned to the bottom of the panel
 * @slot suggestions — (AI variant) Prompt suggestions shown when thread is empty
 * @slot composer  — (AI variant) Prompt-composer pinned above the footer
 * @slot footer    — (AI variant) Disclaimer / branding text
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
 * @fires ai-panel-new-chat — (AI variant) New-chat button clicked
 *   bubbles: true, composed: true
 *   detail: { }
 * @fires ai-panel-archive — (AI variant) Archive button clicked
 *   bubbles: true, composed: true
 *   detail: { }
 *
 * @method clearSearch() — Clear the search field and reset visibility
 * @method open()        — Set data-expanded (AI variant convenience)
 * @method close()       — Remove data-expanded and fire panel-close
 * @method toggle()      — Toggle data-expanded
 */

import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";
import "../sherpa-input-search/sherpa-input-search.js";

const HIGHLIGHT_NAME = "panel-search-match";

class SherpaPanel extends SherpaElement {
  static override get cssUrl(): string {
    return new URL("sherpa-panel.css", import.meta.url).href;
  }

  static override get htmlUrl(): string {
    return new URL("sherpa-panel.html", import.meta.url).href;
  }

  static override get observedAttributes(): string[] {
    return [
      ...super.observedAttributes,
      "data-heading",
      "data-restore-label",
      "data-expanded",
      "data-width",
      "data-empty",
      "data-search-match",
      "data-can-archive",
      "data-busy",
    ];
  }

  /* ── Template selection ───────────────────────────────────── */

  override get templateId(): string | null {
    return this.dataset["variant"] === "ai" ? "ai" : null;
  }

  // Cached shadow DOM elements (typed for better autocomplete)
  els = this.cacheElements({
    heading: { selector: '.header-title', type: HTMLSpanElement },
    restoreLabel: { selector: '.collapse-label', type: HTMLSpanElement },
    closeBtn: { selector: '.close-btn', type: HTMLButtonElement },
    trigger: { selector: '.collapse-trigger', type: HTMLButtonElement },
    search: { selector: '.panel-search', type: HTMLElement },
    empty: '.panel-empty',
    newChatBtn: { selector: '[part="new-chat-btn"]', type: HTMLButtonElement },
    archiveBtn: { selector: '[part="archive-btn"]', type: HTMLButtonElement },
  });

  // Panel state (not cached elements)
  #observer: MutationObserver | null = null;
  #currentFilter = "";
  #bound = false;

  /* ── lifecycle ───────────────────────────────────────────── */

  override onRender(): void {
    // Element cache auto-populated on first access

    // Defaults
    if (!this.dataset["variant"]) this.dataset["variant"] = "inline";
    if (!this.dataset["position"]) this.dataset["position"] = "right";

    if (!this.#bound) {
      // Listeners
      this.els.closeBtn?.addEventListener("click", this.#onClose);
      this.els.trigger?.addEventListener("click", this.#onExpand);
      this.els.search?.addEventListener("input", this.#onSearchChange as EventListener);
      this.els.search?.addEventListener("search", this.#onSearchChange as EventListener);
      this.els.newChatBtn?.addEventListener("click", this.#onNewChat);
      this.els.archiveBtn?.addEventListener("click", this.#onArchive);

      // Re-run filter when consumer mutates light-DOM (e.g. async data load).
      this.#observer = new MutationObserver(() => {
        if (this.#currentFilter) this.#applyFilter(this.#currentFilter);
      });
      this.#observer.observe(this, { childList: true, subtree: true });
      this.#bound = true;
    }

    this.#syncHeading();
    this.#syncRestoreLabel();
    this.#syncWidth();
    this.#syncEmptyMessage();
    this.#syncArchive();
    this.#syncBusy();
  }

  override onDisconnect(): void {
    this.#clearHighlights();
  }

  override onAttributeChanged(name: string) {
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
      case "data-can-archive":
        this.#syncArchive();
        break;
      case "data-busy":
        this.#syncBusy();
        break;
    }
  }

  /* ── public api ──────────────────────────────────────────── */

  get expanded() { return this.hasAttribute("data-expanded"); }
  set expanded(v) {
    if (v) this.setAttribute("data-expanded", "");
    else   this.removeAttribute("data-expanded");
  }

  open()   { this.expanded = true; }
  close()  { this.#onClose(); }
  toggle() { this.expanded = !this.expanded; }

  clearSearch() {
    const search = this.els.search as (HTMLElement & { clear?: () => void }) | null;
    if (search && typeof search.clear === "function") {
      search.clear();
    } else {
      this.#applyFilter("");
    }
  }

  /* ── handlers ────────────────────────────────────────────── */

  #onClose = () => {
    delete this.dataset["expanded"];
    this.dispatchEvent(
      new CustomEvent("panel-close", { bubbles: true, composed: true })
    );
  };

  #onExpand = () => {
    this.dataset["expanded"] = "";
  };

  #onSearchChange = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    const value = (detail?.value ?? (e.target as HTMLInputElement | null)?.value ?? "").toString();
    this.#applyFilter(value);
  };

  #onNewChat = () => {
    if (this.hasAttribute("data-busy")) return;
    this.dispatchEvent(
      new CustomEvent("ai-panel-new-chat", { bubbles: true, composed: true })
    );
  };

  #onArchive = () => {
    if (this.hasAttribute("data-busy")) return;
    if (!this.hasAttribute("data-can-archive")) return;
    this.dispatchEvent(
      new CustomEvent("ai-panel-archive", { bubbles: true, composed: true })
    );
  };

  /* ── sync helpers ────────────────────────────────────────── */

  #syncHeading() {
    if (this.els.heading) {
      this.els.heading.textContent = this.dataset["heading"] || "";
    }
  }

  #syncRestoreLabel() {
    if (this.els.restoreLabel) {
      this.els.restoreLabel.textContent =
        this.dataset["restoreLabel"] || this.dataset["heading"] || "";
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
    if (this.dataset["width"]) {
      this.style.setProperty("--_panel-width", this.dataset["width"]);
    } else {
      this.style.removeProperty("--_panel-width");
    }
  }

  #syncEmptyMessage() {
    if (this.els.empty) {
      this.els.empty.textContent = this.dataset["empty"] || "No results";
    }
  }

  #syncArchive() {
    if (!this.els.archiveBtn) return;
    this.els.archiveBtn.disabled =
      !this.hasAttribute("data-can-archive") || this.hasAttribute("data-busy");
  }

  #syncBusy() {
    if (this.els.newChatBtn) {
      this.els.newChatBtn.disabled = this.hasAttribute("data-busy");
    }
    this.#syncArchive();
  }

  /* ── search filter logic ─────────────────────────────────── */

  #getMatchSelector() {
    return this.dataset["searchMatch"] || "sherpa-list-item";
  }

  #applyFilter(rawValue: string) {
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

    const ranges: Range[] = [];
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
  #getMatchText(item: Element) {
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
  #createMatchRange(item: Element, filter: string) {
    const walker = document.createTreeWalker(item, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) =>
        n.textContent && n.textContent.trim()
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT,
    });
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const idx = (node.textContent ?? "").toLowerCase().indexOf(filter);
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