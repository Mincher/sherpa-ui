/**
 * SherpaNav — Collapsible navigation sidebar with search and edit modes.
 *
 * Architecture: Shadow DOM, template-driven, CSS-first.
 *   • Extends SherpaElement — CSS loaded into shadow root via cssUrl
 *   • Loads an HTML nav template via renderFromUrl() (default: sherpa-nav.html, override: data-src)
 *   • Template is wrapped in .sherpa-nav-root carrying declarative state:
 *       data-pinned, data-mode, data-editable, data-searchable
 *   • CSS reads state from .sherpa-nav-root; JS only toggles attributes + emits events
 *   • SherpaNavItem is zero-JS (slot-driven) — all interaction handled here
 *   • Search highlighting via CSS Highlight API (::highlight(nav-search-match))
 *
 * Modes: default | search | edit
 * States: collapsed (48px) | expanded (320px via hover/focus/mode) | pinned (inline 320px)
 * Host attributes: data-src, data-home-href
 * Wrapper (.sherpa-nav-root) attributes: data-pinned, data-mode, data-editable, data-searchable
 *
 * Custom events (all bubble):
 *   navhome, navsettings         — static link clicks
 *   navitemclick                  — child item click  { itemId, sectionId, route, label }
 *   navitemdelete                 — edit-mode delete   { itemId, sectionId }
 *   navpinchange                  — pin toggled        { pinned }
 *   navmodechange                 — mode switched      { mode, previousMode }
 *   navsectionexpand              — accordion opened   { sectionId }
 *   navsectionreorder             — drag-drop reorder  { groupIndex, sectionOrder }
 *   navfavoritechange             — favorite toggled   { itemId, label, favorite }
 *   naveditconfirm, naveditcancel — edit-mode controls
 */

import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";
import "../sherpa-button/sherpa-button.js";
import "../sherpa-nav-item/sherpa-nav-item.js";
import "../sherpa-nav-promo/sherpa-nav-promo.js";

import { setupDragSort } from "../utilities/drag-sort.js";

export class SherpaNav extends SherpaElement {
  static MODES = { DEFAULT: "default", SEARCH: "search", EDIT: "edit" };
  static DEFAULT_HOME_HREF = "/home.html";

  static get cssUrl() {
    return new URL("./sherpa-nav.css", import.meta.url).href;
  }
  static get htmlUrl() {
    return null;
  }

  static get observedAttributes() {
    return [...super.observedAttributes, "data-src", "data-home-href"];
  }

  #searchField = null;
  #ready = false;
  #hostClickWired = false;
  #defaultUrl = new URL("./sherpa-nav.html", import.meta.url).href;
  #navItemTpl = null; // Cached <template class="nav-item-tpl">
  #badgeTpl = null; // Cached <template class="badge-tpl">

  /** @returns {HTMLElement|null} The .sherpa-nav-root wrapper inside the shadow root. */
  get #root() {
    return this.$(".sherpa-nav-root");
  }

  // ═══════════════════════ SherpaElement Hooks ═══════════════════════

  async onRender() {
    if (!this.#hostClickWired) {
      this.addEventListener("click", (e) => this.#onHostClick(e));
      this.#hostClickWired = true;
    }
    this.#searchField = this.$(".nav-search sherpa-input-search");
    this.#navItemTpl = this.$("template.nav-item-tpl");
    this.#badgeTpl = this.$("template.badge-tpl");
    this.#attachContentEvents();
    this.#wireToggleListeners();
    this.#setupDragDrop();
    this.#setInitialActiveState();
    this.#syncInitialState();
  }

  async onConnect() {
    const url = this.dataset.src || this.#defaultUrl;
    await this.renderFromUrl(url);
    this.#ready = true;
  }

  onAttributeChanged(name, _oldValue, newValue) {
    if (name === "data-src" && newValue && this.#ready) {
      this.renderFromUrl(newValue);
    }
  }

  // ═══════════════════════════ Public API ═══════════════════════════

  get homeHref() {
    return this.dataset.homeHref || SherpaNav.DEFAULT_HOME_HREF;
  }

  get isPinned() {
    return this.#root?.dataset.pinned === "true";
  }
  set isPinned(v) {
    const root = this.#root;
    if (!root) return;
    const pinned = !!v;
    root.dataset.pinned = pinned ? "true" : "false";
    this.dataset.pinned = root.dataset.pinned;
    this.#onPinnedChange(pinned);
  }

  get isSearching() {
    return this.mode === SherpaNav.MODES.SEARCH;
  }
  get isEditing() {
    return this.mode === SherpaNav.MODES.EDIT;
  }

  get mode() {
    return this.#root?.dataset.mode || SherpaNav.MODES.DEFAULT;
  }
  set mode(v) {
    const root = this.#root;
    if (!root) return;
    const oldMode = root.dataset.mode || SherpaNav.MODES.DEFAULT;
    if (Object.values(SherpaNav.MODES).includes(v)) {
      root.dataset.mode = v;
    } else {
      root.dataset.mode = SherpaNav.MODES.DEFAULT;
    }
    this.dataset.mode = root.dataset.mode;
    this.#onModeChange(root.dataset.mode, oldMode);
  }

  startSearch() {
    this.mode = SherpaNav.MODES.SEARCH;
    this.#searchField?.focus();
  }

  endSearch() {
    this.mode = SherpaNav.MODES.DEFAULT;
    if (this.#searchField) {
      this.#searchField.value = "";
      this.#searchField.clear();
    }
    this.#applySearchFilter("");
  }

  setActiveLink(target) {
    this.#clearAllActiveStates();
    const item = this.$(`[data-nav-target="${target}"]`);
    if (item) item.dataset.state = "selected";
  }

  setActiveItem(itemId, sectionId = null) {
    this.#clearAllActiveStates();
    const sel = sectionId
      ? `.nav-section[data-section-id="${sectionId}"] sherpa-nav-item[data-item-id="${itemId}"]`
      : `sherpa-nav-item[data-item-id="${itemId}"]`;
    const item = this.$(sel);
    if (item) item.dataset.state = "selected";
  }

  // ═══════════════════════ Recents & Favorites ═════════════════════

  isFavorite(itemId) {
    return !!this.$(
      `.nav-section[data-section-id="favorites"] sherpa-nav-item[data-item-id="${itemId}"]`,
    );
  }

  setFavorite(itemId, label, route, on) {
    const sec = this.$('.nav-section[data-section-id="favorites"]');
    if (!sec) return;
    const existing = sec.querySelector(
      `sherpa-nav-item[data-item-id="${itemId}"]`,
    );
    if (on && !existing) {
      sec.appendChild(
        this.#createNavItem(
          { id: itemId, label, route },
          sec.dataset.editable === "true",
        ),
      );
    } else if (!on && existing) {
      existing.remove();
    }
    this.#emit("navfavoritechange", { itemId, label, favorite: on });
  }

  async addToRecent(itemId, label, route) {
    await this.rendered;
    const sec = this.$('.nav-section[data-section-id="recent"]');
    if (!sec) return;
    const max = parseInt(sec.dataset.maxItems, 10) || 5;
    sec.querySelector(`sherpa-nav-item[data-item-id="${itemId}"]`)?.remove();
    const newItem = this.#createNavItem(
      { id: itemId, label, route },
      sec.dataset.editable === "true",
    );
    const summary = sec.querySelector(":scope > summary");
    summary ? summary.after(newItem) : sec.prepend(newItem);
    const items = sec.querySelectorAll(":scope > sherpa-nav-item");
    for (let i = max; i < items.length; i++) items[i].remove();
  }

  // ═══════════════════════ Private — Helpers ══════════════════════

  #emit(name, detail = {}) {
    this.dispatchEvent(new CustomEvent(name, { bubbles: true, detail }));
  }

  #clearAllActiveStates() {
    this.$$('[data-state="selected"]').forEach((el) => delete el.dataset.state);
  }

  // ════════════════════ Private — Template Loading ═════════════════

  /** Wire delegated toggle listener for <details> → emit section-expand events. */
  #wireToggleListeners() {
    const sections = this.$(".nav-sections");
    if (!sections) return;
    sections.addEventListener(
      "toggle",
      (e) => {
        const details = e.target;
        if (!details.matches(".nav-section, .nav-subsection")) return;
        if (details.open && details.matches(".nav-section")) {
          this.#emit("navsectionexpand", {
            sectionId: details.dataset.sectionId,
          });
        }
      },
      true,
    );
  }

  #setInitialActiveState() {
    const p = window.location.pathname;
    const target =
      p === this.homeHref ||
      p.endsWith("/home.html") ||
      p === "/" ||
      p.endsWith("/index.html")
        ? "home"
        : p.endsWith("/settings.html")
          ? "settings"
          : null;
    if (target) this.setActiveLink(target);
  }

  /** Sync button active states and layout from template-declared initial values. */
  #syncInitialState() {
    const root = this.#root;
    if (root) {
      this.dataset.pinned = root.dataset.pinned || "false";
      this.dataset.mode = root.dataset.mode || SherpaNav.MODES.DEFAULT;
    }
    const pinBtn = this.$(".nav-pin-btn");
    if (pinBtn) pinBtn.active = this.isPinned;
    const editBtn = this.$(".nav-edit-btn");
    if (editBtn) editBtn.active = this.isEditing;
    if (this.isPinned)
      this.closest(".sherpa-app-layout")?.setAttribute(
        "data-nav-pinned",
        "true",
      );
  }

  // ═══════════════════════ Private — Events ══════════════════════

  #attachContentEvents() {
    this.$(".nav-pin-btn")?.addEventListener("click", () => {
      this.isPinned = !this.isPinned;
    });
    this.$(".nav-edit-btn")?.addEventListener("click", () => {
      this.mode = this.isEditing
        ? SherpaNav.MODES.DEFAULT
        : SherpaNav.MODES.EDIT;
    });

    const sf = this.#searchField;
    sf?.addEventListener("input", (e) => {
      const value = e.detail?.value ?? sf.value;
      this.#applySearchFilter(value);
      this.mode = value.trim()
        ? SherpaNav.MODES.SEARCH
        : SherpaNav.MODES.DEFAULT;
    });
    sf?.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        this.endSearch();
      }
    });
    sf?.addEventListener("search", (e) => {
      if (!e.detail?.value) this.endSearch();
    });

    this.$(".nav-edit-confirm")?.addEventListener("click", () => {
      this.#emit("naveditconfirm");
      this.mode = SherpaNav.MODES.DEFAULT;
    });
    this.$(".nav-edit-cancel")?.addEventListener("click", () => {
      this.#emit("naveditcancel");
      this.mode = SherpaNav.MODES.DEFAULT;
    });
  }

  /** Delegated host-level click handler — registered once in onRender(). */
  #onHostClick(e) {
    const navItem = e
      .composedPath()
      .find((n) => n instanceof HTMLElement && n.tagName === "SHERPA-NAV-ITEM");
    if (!navItem) return;

    // Delete button (shadow DOM → composedPath)
    if (
      e
        .composedPath()
        .some(
          (n) => n instanceof HTMLElement && n.matches?.(".nav-item-delete"),
        )
    ) {
      e.preventDefault();
      e.stopPropagation();
      const sec = navItem.closest(".nav-section");
      if (navItem.dataset.itemId) {
        this.#emit("navitemdelete", {
          itemId: navItem.dataset.itemId,
          sectionId: sec?.dataset.sectionId || null,
        });
      }
      navItem.remove();
      return;
    }

    // Drag handle — ignore
    if (
      e
        .composedPath()
        .some((n) => n instanceof HTMLElement && n.matches?.(".nav-item-drag"))
    )
      return;

    // Static targets: home, settings, search
    if (navItem.dataset.navTarget) {
      if (navItem.dataset.navTarget === "search") {
        this.startSearch();
        return;
      }
      this.#clearAllActiveStates();
      navItem.dataset.state = "selected";
      this.#emit(`nav${navItem.dataset.navTarget}`);
      return;
    }

    // Section/subsection headers — handled by <details> toggle
    if (
      navItem.dataset.variant === "section" ||
      navItem.dataset.variant === "subsection"
    )
      return;

    // Regular child item
    if (this.isEditing) this.mode = SherpaNav.MODES.DEFAULT;
    if (this.isSearching) this.endSearch();
    this.#emit("navitemclick", {
      itemId: navItem.dataset.itemId,
      sectionId: navItem.closest(".nav-section")?.dataset.sectionId || null,
      route: navItem.dataset.route,
      label: this.#getItemLabel(navItem),
    });
  }

  // ═══════════════════ Private — State Changes ══════════════════

  #onPinnedChange(pinned) {
    this.closest(".sherpa-app-layout")?.setAttribute("data-nav-pinned", pinned);
    const pinBtn = this.$(".nav-pin-btn");
    if (pinBtn) pinBtn.active = pinned;
    this.#emit("navpinchange", { pinned });
  }

  #onModeChange(newMode, oldMode) {
    if (
      oldMode === SherpaNav.MODES.SEARCH &&
      newMode !== SherpaNav.MODES.SEARCH
    )
      this.#applySearchFilter("");
    const editBtn = this.$(".nav-edit-btn");
    if (editBtn) editBtn.active = newMode === SherpaNav.MODES.EDIT;
    this.#emit("navmodechange", { mode: newMode, previousMode: oldMode });
  }

  // ═══════════════════ Private — Item Creation ══════════════════

  #createNavItem(item, editable = false) {
    const el = this.#navItemTpl.content
      .cloneNode(true)
      .querySelector("sherpa-nav-item");
    el.textContent = item.label ?? "";
    if (item.id) el.dataset.itemId = item.id;
    if (item.icon) el.dataset.icon = item.icon;
    if (item.badge) el.appendChild(this.#createBadgeElement(item.badge));
    if (item.route) el.dataset.route = item.route;
    if (editable) el.dataset.editable = "true";
    if (item.active) el.dataset.state = "selected";
    return el;
  }

  #createBadgeElement(text) {
    const tag = this.#badgeTpl.content
      .cloneNode(true)
      .querySelector("sherpa-tag");
    tag.textContent = text;
    return tag;
  }

  // ═════════════════════ Private — Drag & Drop ══════════════════

  #setupDragDrop() {
    this.$$('.nav-group[data-draggable="true"]').forEach((container) => {
      const gi = parseInt(container.dataset.groupIndex, 10);
      setupDragSort(container, {
        itemSelector: ":scope > .nav-section",
        handleSelector: ".nav-item-drag",
        idAttribute: "sectionId",
        isEnabled: () => this.isEditing,
        onReorder: (order) => {
          this.#emit("navsectionreorder", {
            groupIndex: gi,
            sectionOrder: order,
          });
        },
      });
    });
  }

  // ═══════════════════ Private — Search Filter ══════════════════

  #getItemLabel(item) {
    return [...item.childNodes]
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.textContent)
      .join("")
      .trim();
  }

  /** Create a Range highlighting the first occurrence of filterLower in item's text nodes. */
  #createMatchRange(item, filterLower) {
    for (const node of item.childNodes) {
      if (node.nodeType !== Node.TEXT_NODE) continue;
      const idx = node.textContent.toLowerCase().indexOf(filterLower);
      if (idx < 0) continue;
      const range = new Range();
      range.setStart(node, idx);
      range.setEnd(node, idx + filterLower.length);
      return range;
    }
    return null;
  }

  #revealAncestors(node) {
    let el = node instanceof HTMLElement ? node : null;
    while (el) {
      if (el.matches("sherpa-nav-item")) delete el.dataset.searchHidden;
      else if (el.matches(".nav-subsection, .nav-section")) {
        delete el.dataset.searchHidden;
        el.open = true;
      } else if (el.matches(".nav-group")) delete el.dataset.searchHidden;
      el =
        el.parentElement?.closest(
          "sherpa-nav-item, .nav-subsection, .nav-section, .nav-group",
        ) || null;
    }
  }

  #applySearchFilter(value) {
    const scope = this.$(".nav-sections");
    if (!scope) return;

    const filter = (value || "").trim().toLowerCase();
    const items = [
      ...scope.querySelectorAll('sherpa-nav-item[data-variant="child"]'),
    ];
    const headers = [
      ...scope.querySelectorAll(
        'sherpa-nav-item:is([data-variant="section"], [data-variant="subsection"])',
      ),
    ];
    const details = [
      ...scope.querySelectorAll(".nav-section, .nav-subsection"),
    ];
    const groups = [...scope.querySelectorAll(".nav-group")];

    // Reset visibility + highlight
    items.forEach((i) => delete i.dataset.searchHidden);
    headers.forEach((h) => delete h.dataset.searchHidden);
    details.forEach((d) => {
      d.dataset.searchWasOpen ??= d.open ? "true" : "false";
      delete d.dataset.searchHidden;
    });
    groups.forEach((g) => delete g.dataset.searchHidden);
    CSS.highlights.delete("nav-search-match");
    // TODO: migrate to this.shadowRoot.highlights?.delete() once
    // all target browsers support shadow-scoped highlights (Chrome 130+).
    // Currently blocked because nav-item text nodes live in nested
    // shadow roots; the highlight registry must match the tree that
    // owns the text. See https://crbug.com/1480854.

    if (!filter) {
      details.forEach((d) => {
        d.open = d.dataset.searchWasOpen === "true";
        delete d.dataset.searchWasOpen;
      });
      scope
        .querySelectorAll("[data-search-hidden]")
        .forEach((el) => delete el.dataset.searchHidden);
      return;
    }

    const ranges = [];

    items.forEach((i) => (i.dataset.searchHidden = "true"));
    headers.forEach((h) => (h.dataset.searchHidden = "true"));
    details.forEach((d) => {
      d.dataset.searchHidden = "true";
      d.open = true;
    });
    groups.forEach((g) => (g.dataset.searchHidden = "true"));

    items.forEach((item) => {
      if (this.#getItemLabel(item).toLowerCase().includes(filter)) {
        const range = this.#createMatchRange(item, filter);
        if (range) ranges.push(range);
        delete item.dataset.searchHidden;
        this.#revealAncestors(item);
      }
    });

    headers.forEach((h) => {
      if (this.#getItemLabel(h).toLowerCase().includes(filter)) {
        const range = this.#createMatchRange(h, filter);
        if (range) ranges.push(range);
        delete h.dataset.searchHidden;
        const container = h.closest(".nav-subsection, .nav-section");
        if (container) this.#revealAncestors(container);
      }
    });

    if (ranges.length)
      CSS.highlights.set("nav-search-match", new Highlight(...ranges));
    // TODO: migrate to this.shadowRoot.highlights?.set() — see
    // delete call above for rationale.
  }
}

customElements.define("sherpa-nav", SherpaNav);
