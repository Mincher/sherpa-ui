/**
 * @element sherpa-nav
 * @category shell
 * @description Collapsible navigation sidebar with search and edit modes.
 *   Loads an HTML nav template via renderFromUrl() (default: sherpa-nav.html,
 *   override via data-src-html). CSS Highlight API for search (::highlight(nav-search-match)).
 *
 * @attr {string}  [data-src-html]            — URL for the nav template HTML (default: sherpa-nav.html)
 * @attr {string}  [data-active-target]  — Selector or ID of the currently active nav item
 * @attr {string}  [data-promo-title]    — Footer promo heading text (shows the promo when set)
 * @attr {string}  [data-promo-message]  — Footer promo body message
 * @attr {string}  [data-promo-link-text]— Footer promo CTA link label
 * @attr {string}  [data-promo-link-url] — Footer promo CTA link URL
 *
 * @fires navhome
 *   bubbles: true, composed: true
 *   detail: none
 * @fires navsettings
 *   bubbles: true, composed: true
 *   detail: none
 * @fires navitemclick
 *   bubbles: true, composed: true
 *   detail: { itemId: string, sectionId: string, route: string, label: string }
 * @fires navitemdelete
 *   bubbles: true, composed: true
 *   detail: { itemId: string, sectionId: string }
 * @fires navpinchange
 *   bubbles: true, composed: true
 *   detail: { pinned: boolean }
 * @fires navmodechange
 *   bubbles: true, composed: true
 *   detail: { mode: string, previousMode: string }
 * @fires navsectionexpand
 *   bubbles: true, composed: true
 *   detail: { sectionId: string }
 * @fires navsectionreorder
 *   bubbles: true, composed: true
 *   detail: { groupIndex: number, sectionOrder: Array }
 * @fires navfavoritechange
 *   bubbles: true, composed: true
 *   detail: { itemId: string, label: string, favorite: boolean }
 * @fires naveditconfirm
 *   bubbles: true, composed: true
 *   detail: none
 * @fires naveditcancel
 *   bubbles: true, composed: true
 *   detail: none
 * @fires naveditreset
 *   bubbles: true, composed: true
 *   detail: none
 * @fires navpromodismiss
 *   bubbles: true, composed: true
 *   detail: none
 *
 * @method startSearch           — Enter search mode
 * @method endSearch             — Exit search mode
 * @method setActiveLink(href)   — Highlight the link matching href
 * @method setActiveItem(itemId) — Highlight the item matching itemId
 * @method isFavorite(itemId)    — Returns boolean
 * @method setFavorite(itemId, label, favorite) — Toggle favorite state
 * @method addToRecent(route, label, icon) — Push item to recent list
 * @method setPromoConfig(config) — Populate footer promo: { title, message, link: { text, url } }; pass null to clear
 *
 * @prop {boolean} isPinned   — Whether the sidebar is pinned open
 * @prop {boolean} isSearching — Whether search mode is active
 * @prop {boolean} isEditing  — Whether edit mode is active
 * @prop {string}  mode       — Current mode: "default" | "search" | "edit"
 */

import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";
import "../sherpa-button/sherpa-button.js";
import "../sherpa-nav-item/sherpa-nav-item.js";

import { setupDragSort } from "../utilities/drag-sort.js";

export class SherpaNav extends SherpaElement {
  static MODES = { DEFAULT: "default", SEARCH: "search", EDIT: "edit" };

  static override get cssUrl(): string {
    return new URL("./sherpa-nav.css", import.meta.url).href;
  }
  static override get htmlUrl(): string {
    // @ts-expect-error - TODO: Fix type
    return null;
  }

  static override get observedAttributes(): string[] {
    return [
      ...super.observedAttributes,
      "data-active-target",
      "data-promo-title",
      "data-promo-message",
      "data-promo-link-text",
      "data-promo-link-url",
    ];
  }

  els = this.cacheElements({
    searchField: '.search-field'
  });

  #endingSearch = false; // Guard flag to prevent infinite recursion
  #ready = false;
  #hostClickWired = false;
  #defaultUrl = new URL("./sherpa-nav.html", import.meta.url).href;
  #navItemTpl = null; // Cached <template class="nav-item-tpl">
  #badgeTpl = null; // Cached <template class="badge-tpl">
  #defaultOrders = null; // Map<groupIndex, sortKey[]> captured at render
  // Last selection requested by the host. Persisted on the instance so we
  // can re-apply the active-state styling after the nav template is
  // swapped via data-src-html or otherwise re-rendered — without this the
  // current page would visually deselect every time the definition
  // changes (the new DOM has no [data-state="selected"] markers).
  #lastSelection = null; // { kind: 'item'|'link', itemId?, sectionId?, target? }
  // Last pinned state observed on the host. Captured before a data-src-html
  // swap (and updated whenever the user toggles the pin button) so we
  // can restore it after the new template renders — otherwise the new
  // template's own data-pinned default would clobber the user's choice.
  #lastPinned = null;
  // Programmatic footer-promo config set via setPromoConfig(); takes
  // precedence over data-promo-* host attributes when present.
  #promoConfig = null;
  #initialized = false;

  /** @returns {HTMLElement|null} The .sherpa-nav-root wrapper inside the shadow root. */
  get #root() {
    return this.$(".sherpa-nav-root");
  }

  // ═══════════════════════ SherpaElement Hooks ═══════════════════════

  // @ts-expect-error - TODO: Fix type
  async onRender() {
    if (!this.#initialized) {
      // Guard re-entrant onRender() calls triggered by renderFromUrl().
      // Without this, the first render can recursively refetch the nav
      // template and cause visible flicker.
      this.#initialized = true;
      const url = this.dataset["srcHtml"] || this.#defaultUrl;
      const ok = await this.renderFromUrl(url);
      this.#ready = ok;
      if (!ok) this.#initialized = false;
      return;
    }

    if (!this.#hostClickWired) {
      this.addEventListener("click", (e) => this.#onHostClick(e));
      this.#hostClickWired = true;
    }
    // @ts-expect-error - TODO: Fix type
    this.els.searchField = this.$(".nav-search sherpa-input-search");
    // @ts-expect-error - TODO: Fix type
    this.#navItemTpl = this.$("template.nav-item-tpl") || this.#injectFallbackTemplate(
      "nav-item-tpl",
      '<sherpa-nav-item data-variant="child" tabindex="0" role="button"></sherpa-nav-item>',
    );
    // @ts-expect-error - TODO: Fix type
    this.#badgeTpl = this.$("template.badge-tpl") || this.#injectFallbackTemplate(
      "badge-tpl",
      '<sherpa-tag slot="badge" data-status="success"></sherpa-tag>',
    );
    this.#attachContentEvents();
    this.#wireToggleListeners();
    this.#setupDragDrop();
    this.#syncInitialState();
    this.#hydrateQuickAccess();
    this.#syncSectionBadges();
    this.#wirePromo();
    this.#syncPromo();

    // Apply data-active-target if set before render
    const target = this.dataset["activeTarget"];
    if (target) this.setActiveLink(target);

    // Re-apply the host's last requested selection after a re-render
    // (e.g. data-src-html swap). data-active-target takes precedence if set,
    // otherwise replay whichever setActive* call last fired.
    if (!target && this.#lastSelection) {
      const sel = this.#lastSelection;
      // @ts-expect-error - TODO: Fix type
      if (sel.kind === "item") {
        // @ts-expect-error - TODO: Fix type
        this.#applyActiveItem(sel.itemId, sel.sectionId);
      // @ts-expect-error - TODO: Fix type
      } else if (sel.kind === "link") {
        // @ts-expect-error - TODO: Fix type
        this.#applyActiveLink(sel.target);
      }
    }
  }

  // @ts-expect-error - TODO: Fix type
  override onAttributeChanged(name: string, _oldValue, newValue: string | null) {
    if (name === "data-active-target" && this.#ready) {
      if (newValue) {
        this.setActiveLink(newValue);
      } else {
        this.#clearAllActiveStates();
      }
    }
    if (name.startsWith("data-promo-") && this.#ready) {
      this.#syncPromo();
    }
  }

  // ═══════════════════════════ Public API ═══════════════════════════

  get isPinned() {
    // @ts-expect-error - TODO: Fix type
    return this.#root?.dataset["pinned"] === "true";
  }
  set isPinned(v) {
    const root = this.#root;
    if (!root) return;
    const pinned = !!v;
    // @ts-expect-error - TODO: Fix type
    root.dataset["pinned"] = pinned ? "true" : "false";
    // @ts-expect-error - TODO: Fix type
    this.dataset["pinned"] = root.dataset["pinned"];
    // @ts-expect-error - TODO: Fix type
    this.#lastPinned = root.dataset["pinned"];
    this.#onPinnedChange(pinned);
  }

  get isSearching() {
    return this.mode === SherpaNav.MODES.SEARCH;
  }
  get isEditing() {
    return this.mode === SherpaNav.MODES.EDIT;
  }

  get mode() {
    // @ts-expect-error - TODO: Fix type
    return this.#root?.dataset["mode"] || SherpaNav.MODES.DEFAULT;
  }
  set mode(v) {
    const root = this.#root;
    if (!root) return;
    // @ts-expect-error - TODO: Fix type
    const oldMode = root.dataset["mode"] || SherpaNav.MODES.DEFAULT;
    if (Object.values(SherpaNav.MODES).includes(v)) {
      // @ts-expect-error - TODO: Fix type
      root.dataset["mode"] = v;
    } else {
      // @ts-expect-error - TODO: Fix type
      root.dataset["mode"] = SherpaNav.MODES.DEFAULT;
    }
    // @ts-expect-error - TODO: Fix type
    this.dataset["mode"] = root.dataset["mode"];
    // @ts-expect-error - TODO: Fix type
    this.#onModeChange(root.dataset["mode"], oldMode);
  }

  startSearch() {
    this.mode = SherpaNav.MODES.SEARCH;
    // @ts-expect-error - TODO: Fix type
    this.els.searchField?.focus();
  }

  endSearch() {
    // Guard against infinite recursion (clear() fires search event which calls endSearch again)
    if (this.#endingSearch) return;
    this.#endingSearch = true;

    try {
      this.mode = SherpaNav.MODES.DEFAULT;
      if (this.els.searchField) {
        // @ts-expect-error - TODO: Fix type
        this.els.searchField.value = "";
        // @ts-expect-error - TODO: Fix type
        this.els.searchField.clear();
      }
      this.#applySearchFilter("");
    } finally {
      this.#endingSearch = false;
    }
  }

  // @ts-expect-error - TODO: Fix type
  setActiveLink(target) {
    // @ts-expect-error - TODO: Fix type
    this.#lastSelection = { kind: "link", target };
    this.#applyActiveLink(target);
  }

  // @ts-expect-error - TODO: Fix type
  #applyActiveLink(target) {
    this.#clearAllActiveStates();
    const item = this.$(`[data-nav-target="${target}"]`);
    // @ts-expect-error - TODO: Fix type
    if (item) item.dataset["state"] = "selected";
  }

  // @ts-expect-error - TODO: Fix type
  setActiveItem(itemId, sectionId = null) {
    // @ts-expect-error - TODO: Fix type
    this.#lastSelection = { kind: "item", itemId, sectionId };
    this.#applyActiveItem(itemId, sectionId);
  }

  // @ts-expect-error - TODO: Fix type
  #applyActiveItem(itemId, sectionId = null) {
    this.#clearAllActiveStates();
    // Always highlight every nav item that matches the itemId, so mirrors of
    // the same target inside Favorites / Recents (or any other section) are
    // visually selected alongside the canonical entry. The optional sectionId
    // is still honoured to pick a primary item when callers care about it.
    const root = this.#root;
    if (!root) return;
    const matches = root.querySelectorAll(
      `sherpa-nav-item[data-item-id="${itemId}"]`,
    );
    matches.forEach((el) => {
      // @ts-expect-error - TODO: Fix type
      el.dataset["state"] = "selected";
    });
    if (sectionId) {
      const primary = root.querySelector(
        `.nav-section[data-section-id="${sectionId}"] sherpa-nav-item[data-item-id="${itemId}"]`,
      );
      // @ts-expect-error - TODO: Fix type
      if (primary) primary.dataset["state"] = "selected";
    }
  }

  // ═══════════════════════ Recents & Favorites ═════════════════════

  // @ts-expect-error - TODO: Fix type
  isFavorite(itemId) {
    const secId = this.dataset["favoritesSection"] || 'favorites';
    return !!this.$(
      `.nav-section[data-section-id="${secId}"] sherpa-nav-item[data-item-id="${itemId}"]`,
    );
  }

  // @ts-expect-error - TODO: Fix type
  setFavorite(itemId, label, route, on) {
    const secId = this.dataset["favoritesSection"] || 'favorites';
    const sec = this.$(`.nav-section[data-section-id="${secId}"]`);
    if (!sec) return;
    const existing = sec.querySelector(
      `sherpa-nav-item[data-item-id="${itemId}"]`,
    );
    if (on && !existing) {
      const item = this.#createNavItem(
        { id: itemId, label, route },
        // @ts-expect-error - TODO: Fix type
        sec.dataset["editable"] === "true",
      );
      // Mirror selection state from any other live entry with the same id
      // so the new favorite lights up alongside the canonical nav item.
      if (this.$(`sherpa-nav-item[data-item-id="${itemId}"][data-state="selected"]`)) {
        item.dataset["state"] = 'selected';
      }
      sec.appendChild(item);
    } else if (!on && existing) {
      existing.remove();
    }
    this.#persistQuickAccess('favorites');
    this.#syncSectionBadges();
    this.#emit("navfavoritechange", { itemId, label, favorite: on });
  }

  // @ts-expect-error - TODO: Fix type
  async addToRecent(itemId, label, route) {
    await this.rendered;
    const secId = this.dataset["recentSection"] || 'recent';
    const sec = this.$(`.nav-section[data-section-id="${secId}"]`);
    if (!sec) return;
    // @ts-expect-error - TODO: Fix type
    const max = parseInt(sec.dataset["maxItems"], 10) || 5;
    // If this item is already in the Recents section, leave the existing
    // entry exactly where it is — re-clicking a recent should NOT cause
    // the list to reorder. We still refresh its label/route in case the
    // upstream metadata changed, and re-mirror selection styling below.
    const existing = sec.querySelector(`:scope > sherpa-nav-item[data-item-id="${itemId}"]`);
    if (existing) {
      if (label) existing.setAttribute('data-label', label);
      // @ts-expect-error - TODO: Fix type
      if (route) existing.dataset["route"] = route;
      if (this.$(`sherpa-nav-item[data-item-id="${itemId}"][data-state="selected"]`)) {
        // @ts-expect-error - TODO: Fix type
        existing.dataset["state"] = 'selected';
      }
      this.#persistQuickAccess('recent');
      this.#syncSectionBadges();
      return;
    }
    const newItem = this.#createNavItem(
      { id: itemId, label, route },
      // @ts-expect-error - TODO: Fix type
      sec.dataset["editable"] === "true",
    );
    // If this item is the currently active route, mirror selection so the
    // freshly-inserted recent entry shows the active style immediately.
    if (this.$(`sherpa-nav-item[data-item-id="${itemId}"][data-state="selected"]`)) {
      newItem.dataset["state"] = 'selected';
    }
    const summary = sec.querySelector(":scope > summary");
    summary ? summary.after(newItem) : sec.prepend(newItem);
    const items = sec.querySelectorAll(":scope > sherpa-nav-item");
    // @ts-expect-error - TODO: Fix type
    for (let i = max; i < items.length; i++) items[i].remove();
    this.#persistQuickAccess('recent');
    this.#syncSectionBadges();
  }

  /**
   * Populate the footer promo callout. Pass null/undefined to clear.
   * Takes precedence over data-promo-* host attributes until cleared.
   * @param {{ title?: string, message?: string, link?: { text: string, url: string } } | null} config
   */
  // @ts-expect-error - TODO: Fix type
  setPromoConfig(config) {
    this.#promoConfig = config || null;
    if (this.#ready) this.#syncPromo();
  }

  // ═══════════════════ Footer Promo ════════════════════════════════

  #wirePromo() {
    const close = this.$(".nav-promo .promo-close");
    // @ts-expect-error - TODO: Fix type
    if (!close || close.dataset["wired"] === "true") return;
    // @ts-expect-error - TODO: Fix type
    close.dataset["wired"] = "true";
    close.addEventListener("click", () => {
      const promo = this.$(".nav-promo");
      // @ts-expect-error - TODO: Fix type
      if (promo) promo.dataset["dismissed"] = "";
      this.#emit("navpromodismiss", {});
    });
  }

  #syncPromo() {
    const promo = this.$(".nav-promo");
    if (!promo) return;
    const cfg = this.#promoConfig || this.#promoConfigFromAttrs();
    const titleEl = promo.querySelector(".promo-title");
    const textEl = promo.querySelector(".promo-text");
    const linkEl = promo.querySelector(".promo-link");
    if (titleEl) titleEl.textContent = cfg?.title || "";
    if (textEl) textEl.textContent = cfg?.message || "";
    if (linkEl) {
      linkEl.textContent = cfg?.link?.text || "";
      // @ts-expect-error - TODO: Fix type
      if (cfg?.link?.url) linkEl.dataset["url"] = cfg.link.url;
      // @ts-expect-error - TODO: Fix type
      else delete linkEl.dataset["url"];
    }
    const hasContent = !!(cfg?.title || cfg?.message || cfg?.link?.text);
    promo.toggleAttribute("hidden", !hasContent);
  }

  #promoConfigFromAttrs() {
    const title = this.dataset["promoTitle"];
    const message = this.dataset["promoMessage"];
    const linkText = this.dataset["promoLinkText"];
    const linkUrl = this.dataset["promoLinkUrl"];
    if (!title && !message && !linkText) return null;
    return {
      title: title || "",
      message: message || "",
      link: { text: linkText || "", url: linkUrl || "" },
    };
  }

  // ═══════════════════ Recents & Favorites — Persistence ═══════════

  /**
   * Storage keys are shared across nav templates by default so a user's
   * recents and favorites survive switching between nav definitions. To
   * scope storage per-template (e.g. when item ids collide) set
   * `data-recent-storage-key` / `data-favorites-storage-key` on the host.
   */
  get #recentStorageKey() {
    return this.dataset["recentStorageKey"] || 'sherpa-nav-recent';
  }
  get #favoritesStorageKey() {
    return this.dataset["favoritesStorageKey"] || 'sherpa-nav-favorites';
  }

  // @ts-expect-error - TODO: Fix type
  #readStored(key) {
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  // @ts-expect-error - TODO: Fix type
  #writeStored(key, items) {
    try { localStorage.setItem(key, JSON.stringify(items)); } catch {}
  }

  /** Snapshot the live items in a quick-access section to {id,label,route}. */
  // @ts-expect-error - TODO: Fix type
  #snapshotSection(sec) {
    if (!sec) return [];
    // @ts-expect-error - TODO: Fix type
    const out = [];
    // @ts-expect-error - TODO: Fix type
    sec.querySelectorAll(':scope > sherpa-nav-item').forEach((el) => {
      const id = el.dataset["itemId"];
      if (!id) return;
      out.push({
        id,
        label: (el.textContent || '').trim(),
        route: el.dataset["route"] || '',
      });
    });
    // @ts-expect-error - TODO: Fix type
    return out;
  }

  /** Persist current state of a quick-access section ('recent' | 'favorites'). */
  // @ts-expect-error - TODO: Fix type
  #persistQuickAccess(which) {
    const secId = which === 'favorites'
      ? (this.dataset["favoritesSection"] || 'favorites')
      : (this.dataset["recentSection"] || 'recent');
    const key = which === 'favorites' ? this.#favoritesStorageKey : this.#recentStorageKey;
    const sec = this.$(`.nav-section[data-section-id="${secId}"]`);
    if (!sec) return;
    this.#writeStored(key, this.#snapshotSection(sec));
  }

  /**
   * After each render of the nav template, repopulate Recent and Favorites
   * sections from localStorage so the user's history survives template
   * switches and full page reloads.
   */
  #hydrateQuickAccess() {
    // @ts-expect-error - TODO: Fix type
    const hydrate = (secId, key, max) => {
      const sec = this.$(`.nav-section[data-section-id="${secId}"]`);
      if (!sec) return;
      const stored = this.#readStored(key);
      // Wipe template-declared placeholders before injecting stored entries.
      sec.querySelectorAll(':scope > sherpa-nav-item').forEach((n) => n.remove());
      // @ts-expect-error - TODO: Fix type
      const editable = sec.dataset["editable"] === 'true';
      // @ts-expect-error - TODO: Fix type
      const limit = max ?? (parseInt(sec.dataset["maxItems"], 10) || stored.length);
      stored.slice(0, limit).forEach((item) => {
        if (!item || !item.id) return;
        sec.appendChild(this.#createNavItem(item, editable));
      });
    };
    // @ts-expect-error - TODO: Fix type
    hydrate(this.dataset["recentSection"] || 'recent', this.#recentStorageKey);
    // @ts-expect-error - TODO: Fix type
    hydrate(this.dataset["favoritesSection"] || 'favorites', this.#favoritesStorageKey);
  }

  /**
   * Aggregate child badge state up to each section/subsection summary item.
   * Sections with at least one badged descendant get `data-aggregated-badge`
   * plus a mirrored `data-badge` / `data-badge-status` (highest-severity wins).
   * The aggregated tag remains visible whether the section is open or closed —
   * in collapsed nav state, sherpa-nav-item.css renders it as a status dot.
   */
  #syncSectionBadges() {
    // Severity order from highest → lowest. "success" (New) outranks
    // "brand" (Preview) so that a section parent showing an aggregated
    // status reflects newly-shipped work over previews.
    const PRIORITY = ['critical', 'urgent', 'warning', 'info', 'success', 'brand'];
    // @ts-expect-error - TODO: Fix type
    const rank = (s) => {
      const i = PRIORITY.indexOf(s || 'success');
      return i === -1 ? PRIORITY.length : i;
    };
    const sections = this.$$('.nav-section, .nav-subsection');
    sections.forEach((sec) => {
      const summaryItem = sec.querySelector(':scope > summary > sherpa-nav-item');
      if (!summaryItem) return;
      // Skip items that already have a non-aggregated badge.
      if (summaryItem.hasAttribute('data-badge') &&
          // @ts-expect-error - TODO: Fix type
          summaryItem.dataset["aggregatedBadge"] !== 'true') return;
      // Find badged descendants (any depth, but skip nested section summaries
      // since those are themselves aggregating their own children).
      const descendants = sec.querySelectorAll('sherpa-nav-item[data-badge]');
      // @ts-expect-error - TODO: Fix type
      let best = null;
      descendants.forEach((d) => {
        if (d === summaryItem) return;
        // @ts-expect-error - TODO: Fix type
        if (d.dataset["aggregatedBadge"] === 'true') return;
        // @ts-expect-error - TODO: Fix type
        if (!best || rank(d.dataset["badgeStatus"]) < rank(best.dataset["badgeStatus"])) {
          best = d;
        }
      });
      if (best) {
        // @ts-expect-error - TODO: Fix type
        summaryItem.dataset["aggregatedBadge"] = 'true';
        // @ts-expect-error - TODO: Fix type
        summaryItem.dataset["badge"] = best.dataset["badge"] || '•';
        // @ts-expect-error - TODO: Fix type
        summaryItem.dataset["badgeStatus"] = best.dataset["badgeStatus"] || 'success';
      // @ts-expect-error - TODO: Fix type
      } else if (summaryItem.dataset["aggregatedBadge"] === 'true') {
        // @ts-expect-error - TODO: Fix type
        delete summaryItem.dataset["aggregatedBadge"];
        summaryItem.removeAttribute('data-badge');
        summaryItem.removeAttribute('data-badge-status');
      }
    });
  }

  // ═══════════════════════ Private — Helpers ══════════════════════

  // @ts-expect-error - TODO: Fix type
  #emit(name, detail = {}) {
    this.dispatchEvent(new CustomEvent(name, { bubbles: true, detail }));
  }

  #clearAllActiveStates() {
    this.$$('[data-state="selected"]').forEach((el) => el.removeAttribute('data-state'));
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
        // @ts-expect-error - TODO: Fix type
        if (!details.matches(".nav-section, .nav-subsection")) return;
        // @ts-expect-error - TODO: Fix type
        if (details.open && details.matches(".nav-section")) {
          this.#emit("navsectionexpand", {
            // @ts-expect-error - TODO: Fix type
            sectionId: details.dataset["sectionId"],
          });
        }
      },
      true,
    );
  }

  /** Sync button active states and layout from template-declared initial values. */
  #syncInitialState() {
    const root = this.#root;
    if (root) {
      // Restore the host's last pinned choice across template swaps; fall
      // back to whatever the new template declared on first render.
      // @ts-expect-error - TODO: Fix type
      const pinned = this.#lastPinned ?? root.dataset["pinned"] ?? "false";
      // @ts-expect-error - TODO: Fix type
      root.dataset["pinned"] = pinned;
      this.dataset["pinned"] = pinned;
      // @ts-expect-error - TODO: Fix type
      this.dataset["mode"] = root.dataset["mode"] || SherpaNav.MODES.DEFAULT;
    }
    const pinBtn = this.$(".nav-pin-btn");
    // @ts-expect-error - TODO: Fix type
    if (pinBtn) pinBtn.active = this.isPinned;
    const editBtn = this.$(".nav-edit-btn");
    // @ts-expect-error - TODO: Fix type
    if (editBtn) editBtn.active = this.isEditing;
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

    const sf = this.els.searchField;
    // @ts-expect-error - TODO: Fix type
    sf?.addEventListener("input", (e: CustomEvent) => {
      // @ts-expect-error - TODO: Fix type
      const value = e.detail?.value ?? sf.value;
      this.#applySearchFilter(value);
      this.mode = value.trim()
        ? SherpaNav.MODES.SEARCH
        : SherpaNav.MODES.DEFAULT;
    });
    // @ts-expect-error - TODO: Fix type
    sf?.addEventListener("keydown", (e: CustomEvent) => {
      // @ts-expect-error - TODO: Fix type
      if (e.key === "Escape") {
        e.stopPropagation();
        this.endSearch();
      }
    });
    // @ts-expect-error - TODO: Fix type
    sf?.addEventListener("search", (e: CustomEvent) => {
      if (!e.detail?.value) this.endSearch();
    });

    this.$(".nav-edit-reset")?.addEventListener("click", () => {
      this.resetOrder();
      this.mode = SherpaNav.MODES.DEFAULT;
    });
    // Legacy buttons still wire up if a consumer template hasn't migrated yet.
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
  #onHostClick(e: Event) {
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
      // @ts-expect-error - TODO: Fix type
      const sec = navItem.closest(".nav-section");
      // @ts-expect-error - TODO: Fix type
      if (navItem.dataset["itemId"]) {
        this.#emit("navitemdelete", {
          // @ts-expect-error - TODO: Fix type
          itemId: navItem.dataset["itemId"],
          sectionId: sec?.dataset["sectionId"] || null,
        });
      }
      // @ts-expect-error - TODO: Fix type
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
    // @ts-expect-error - TODO: Fix type
    if (navItem.dataset["navTarget"]) {
      // @ts-expect-error - TODO: Fix type
      if (navItem.dataset["navTarget"] === "search") {
        this.startSearch();
        return;
      }
      this.#clearAllActiveStates();
      // @ts-expect-error - TODO: Fix type
      navItem.dataset["state"] = "selected";
      // @ts-expect-error - TODO: Fix type
      this.#emit(`nav${navItem.dataset["navTarget"]}`);
      return;
    }

    // Section/subsection headers — when the summary has its own route,
    // clicks on the LABEL navigate; clicks anywhere else on the row
    // (icon, chevron, padding) toggle the <details>. Childless headers
    // always behave like leaves. Headers without a route always toggle.
    if (
      // @ts-expect-error - TODO: Fix type
      navItem.dataset["variant"] === "section" ||
      // @ts-expect-error - TODO: Fix type
      navItem.dataset["variant"] === "subsection"
    ) {
      // @ts-expect-error - TODO: Fix type
      const details = navItem.closest("details");
      const hasChildren = details
        ? details.querySelector(":scope > sherpa-nav-item, :scope > :not(summary)")
        : null;
      // @ts-expect-error - TODO: Fix type
      const hasRoute = !!navItem.dataset["route"];
      const onLabel = e.composedPath().some(
        // @ts-expect-error - TODO: Fix type
        (n) => n?.getAttribute && n.getAttribute("part") === "label",
      );
      // No route — pure toggle (default <details> behaviour).
      if (hasChildren && !hasRoute) return;
      // Has route + has children: only the label navigates. Anything
      // else on the row falls through to the native <details> toggle.
      if (hasChildren && hasRoute && !onLabel) return;
      // Either childless, or label-click on a routed parent → navigate.
      e.preventDefault();
      this.#clearAllActiveStates();
      // @ts-expect-error - TODO: Fix type
      navItem.dataset["state"] = "selected";
      if (this.isEditing) this.mode = SherpaNav.MODES.DEFAULT;
      if (this.isSearching) this.endSearch();
      const headerSectionId = details?.dataset["sectionId"]
        || details?.closest(".nav-section")?.dataset["sectionId"]
        || null;
      this.#emit("navitemclick", {
        // @ts-expect-error - TODO: Fix type
        itemId: navItem.dataset["itemId"],
        sectionId: headerSectionId,
        // @ts-expect-error - TODO: Fix type
        route: navItem.dataset["route"],
        label: this.#getItemLabel(navItem),
      });
      this.#trackRecentForLeaf(navItem, headerSectionId);
      return;
    }

    // Regular child item
    if (this.isEditing) this.mode = SherpaNav.MODES.DEFAULT;
    if (this.isSearching) this.endSearch();
    // @ts-expect-error - TODO: Fix type
    const leafSectionId = navItem.closest(".nav-section")?.dataset["sectionId"] || null;
    this.#emit("navitemclick", {
      // @ts-expect-error - TODO: Fix type
      itemId: navItem.dataset["itemId"],
      sectionId: leafSectionId,
      // @ts-expect-error - TODO: Fix type
      route: navItem.dataset["route"],
      label: this.#getItemLabel(navItem),
    });
    this.#trackRecentForLeaf(navItem, leafSectionId);
  }

  /**
   * Push the just-clicked leaf item into the Recents section automatically.
   * Skipped when:
   *  - host opts out via `data-track-recents="false"`
   *  - the item lives inside the Recents section itself (no churn)
   *  - the item is a known utility shortcut (favorites/recent/recents)
   *  - the item has no `data-item-id` (nothing to key on)
   */
  // @ts-expect-error - TODO: Fix type
  #trackRecentForLeaf(navItem, sectionId) {
    if (this.dataset["trackRecents"] === "false") return;
    const itemId = navItem.dataset["itemId"];
    if (!itemId) return;
    const recentSectionId = this.dataset["recentSection"] || "recent";
    if (sectionId && sectionId === recentSectionId) return;
    const utilityIds = new Set(["favorites", "recent", "recents"]);
    if (utilityIds.has(itemId.toLowerCase())) return;
    const label = this.#getItemLabel(navItem);
    const route = navItem.dataset["route"] || "";
    this.addToRecent(itemId, label, route);
  }

  // ═══════════════════ Private — State Changes ══════════════════

  // @ts-expect-error - TODO: Fix type
  #onPinnedChange(pinned) {
    const pinBtn = this.$(".nav-pin-btn");
    // @ts-expect-error - TODO: Fix type
    if (pinBtn) pinBtn.active = pinned;
    this.#emit("navpinchange", { pinned });
  }

  // @ts-expect-error - TODO: Fix type
  #onModeChange(newMode, oldMode) {
    if (
      oldMode === SherpaNav.MODES.SEARCH &&
      newMode !== SherpaNav.MODES.SEARCH
    )
      this.#applySearchFilter("");
    const editBtn = this.$(".nav-edit-btn");
    // @ts-expect-error - TODO: Fix type
    if (editBtn) editBtn.active = newMode === SherpaNav.MODES.EDIT;
    this.#emit("navmodechange", { mode: newMode, previousMode: oldMode });
  }

  // ═══════════════════ Private — Item Creation ══════════════════

  /**
   * Inject a fallback <template> into the shadow root when a custom
   * data-src-html nav HTML omits the cloning templates that the component
   * relies on for hydrating recents/favorites and section headers.
   */
  // @ts-expect-error - TODO: Fix type
  #injectFallbackTemplate(className, innerHTML) {
    const tpl = document.createElement("template");
    tpl.className = className;
    tpl.innerHTML = innerHTML;
    // @ts-expect-error - TODO: Fix type
    (this.$(".sherpa-nav-root") || this.shadowRoot).appendChild(tpl);
    return tpl;
  }

  // @ts-expect-error - TODO: Fix type
  #createNavItem(item, editable = false) {
    // @ts-expect-error - TODO: Fix type
    const el = this.#navItemTpl.content
      .cloneNode(true)
      .querySelector("sherpa-nav-item");
    el.textContent = item.label ?? "";
    if (item.id) el.dataset["itemId"] = item.id;
    if (item.icon) el.dataset["icon"] = item.icon;
    if (item.badge) el.appendChild(this.#createBadgeElement(item.badge));
    if (item.route) el.dataset["route"] = item.route;
    if (editable) el.dataset["editable"] = "true";
    if (item.active) el.dataset["state"] = "selected";
    return el;
  }

  // @ts-expect-error - TODO: Fix type
  #createBadgeElement(text) {
    // @ts-expect-error - TODO: Fix type
    const tag = this.#badgeTpl.content
      .cloneNode(true)
      .querySelector("sherpa-tag");
    tag.textContent = text;
    return tag;
  }

  // ═════════════════════ Private — Drag & Drop ══════════════════

  #setupDragDrop() {
    // Capture the template-declared order for each draggable group BEFORE
    // we apply any persisted user reorder, so resetOrder() can restore it.
    this.#captureDefaultOrders();
    this.$$('.nav-group[data-draggable="true"]').forEach((container) => {
      // @ts-expect-error - TODO: Fix type
      const gi = parseInt(container.dataset["groupIndex"], 10);
      // Mirror sectionId / itemId into a single dataset.sortKey so the
      // generic drag-sort utility reads one attribute for both kinds of
      // draggable item (collapsible section + standalone top-level row).
      const tagSortKeys = () => {
        container
          .querySelectorAll(':scope > .nav-section, :scope > sherpa-nav-item')
          .forEach((el) => {
            // @ts-expect-error - TODO: Fix type
            el.dataset["sortKey"] = el.dataset["sectionId"] || el.dataset["itemId"] || '';
          });
      };
      tagSortKeys();
      new MutationObserver(tagSortKeys).observe(container, { childList: true });

      setupDragSort(container, {
        itemSelector: ':scope > .nav-section, :scope > sherpa-nav-item',
        handleSelector: ".nav-item-drag",
        idAttribute: "sortKey",
        // @ts-expect-error - TODO: Fix type
        isEnabled: () => this.isEditing,
        // @ts-expect-error - TODO: Fix type
        onReorder: (order) => {
          this.#persistGroupOrder(gi, order);
          this.#emit("navsectionreorder", {
            groupIndex: gi,
            sectionOrder: order,
          });
        },
      });
    });
    // Apply any previously-persisted user reorder.
    this.#applyStoredOrders();
  }

  // ═══════════════════ Order persistence ═══════════════════

  /** localStorage key for the user-applied group order, scoped by template src. */
  get #orderStorageKey() {
    const scope = this.dataset["orderStorageKey"]
      || (this.dataset["srcHtml"] ? `sherpa-nav-order::${this.dataset["srcHtml"]}` : 'sherpa-nav-order');
    return scope;
  }

  #captureDefaultOrders() {
    // @ts-expect-error - TODO: Fix type
    if (!this.#defaultOrders) this.#defaultOrders = new Map();
    // Always recapture on render — the template may have changed.
    // @ts-expect-error - TODO: Fix type
    this.#defaultOrders.clear();
    this.$$('.nav-group[data-draggable="true"]').forEach((container) => {
      // @ts-expect-error - TODO: Fix type
      const gi = parseInt(container.dataset["groupIndex"], 10);
      const order = [...container.querySelectorAll(':scope > .nav-section, :scope > sherpa-nav-item')]
        // @ts-expect-error - TODO: Fix type
        .map((el) => el.dataset["sectionId"] || el.dataset["itemId"] || '')
        .filter(Boolean);
      // @ts-expect-error - TODO: Fix type
      this.#defaultOrders.set(gi, order);
    });
  }

  #readOrderStore() {
    try {
      const raw = localStorage.getItem(this.#orderStorageKey);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch { return {}; }
  }

  // @ts-expect-error - TODO: Fix type
  #writeOrderStore(store) {
    try { localStorage.setItem(this.#orderStorageKey, JSON.stringify(store)); } catch {}
  }

  // @ts-expect-error - TODO: Fix type
  #persistGroupOrder(groupIndex, order) {
    const store = this.#readOrderStore();
    store[String(groupIndex)] = order;
    this.#writeOrderStore(store);
  }

  /** Reorder children of each draggable group to match the persisted order. */
  #applyStoredOrders() {
    const store = this.#readOrderStore();
    if (!store || !Object.keys(store).length) return;
    this.$$('.nav-group[data-draggable="true"]').forEach((container) => {
      // @ts-expect-error - TODO: Fix type
      const gi = parseInt(container.dataset["groupIndex"], 10);
      const order = store[String(gi)];
      if (!Array.isArray(order) || !order.length) return;
      this.#applyOrderToContainer(container, order);
    });
  }

  // @ts-expect-error - TODO: Fix type
  #applyOrderToContainer(container, order) {
    const lookup = new Map();
    container
      .querySelectorAll(':scope > .nav-section, :scope > sherpa-nav-item')
      // @ts-expect-error - TODO: Fix type
      .forEach((el) => {
        const key = el.dataset["sectionId"] || el.dataset["itemId"];
        if (key) lookup.set(key, el);
      });
    // @ts-expect-error - TODO: Fix type
    order.forEach((key) => {
      const el = lookup.get(key);
      if (el) container.appendChild(el); // append in order; unknown keys ignored
    });
    // Items not present in the stored order keep their template position
    // relative to the appended block (they remain at the end of the container).
  }

  /**
   * Public API — revert any user reordering of draggable nav groups back
   * to the template-declared defaults, clear persisted order, and notify
   * listeners via `naveditreset`.
   */
  resetOrder() {
    if (!this.#defaultOrders) return;
    this.$$('.nav-group[data-draggable="true"]').forEach((container) => {
      // @ts-expect-error - TODO: Fix type
      const gi = parseInt(container.dataset["groupIndex"], 10);
      // @ts-expect-error - TODO: Fix type
      const order = this.#defaultOrders.get(gi);
      if (order && order.length) this.#applyOrderToContainer(container, order);
    });
    try { localStorage.removeItem(this.#orderStorageKey); } catch {}
    this.#emit('naveditreset');
  }

  // ═══════════════════ Private — Search Filter ══════════════════

  // @ts-expect-error - TODO: Fix type
  #getItemLabel(item) {
    return [...item.childNodes]
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.textContent)
      .join("")
      .trim();
  }

  /** Create a Range highlighting the first occurrence of filterLower in item's text nodes. */
  // @ts-expect-error - TODO: Fix type
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

  // @ts-expect-error - TODO: Fix type
  #revealAncestors(node) {
    let el = node instanceof HTMLElement ? node : null;
    while (el) {
      if (el.matches("sherpa-nav-item")) el.removeAttribute('data-search-hidden');
      else if (el.matches(".nav-subsection, .nav-section")) {
        el.removeAttribute('data-search-hidden');
        // @ts-expect-error - TODO: Fix type
        el.open = true;
      } else if (el.matches(".nav-group")) el.removeAttribute('data-search-hidden');
      el =
        el.parentElement?.closest(
          "sherpa-nav-item, .nav-subsection, .nav-section, .nav-group",
        ) || null;
    }
  }

  // @ts-expect-error - TODO: Fix type
  #applySearchFilter(value) {
    const scope = this.$(".nav-sections");
    if (!scope) return;

    const filter = (value || "").trim().toLowerCase();
    // Headers = section/subsection summary rows (handled separately so a
    // header match can reveal its container without highlighting children).
    // Items = every other nav-item in the scrollable area, including
    // standalone top-level rows that have no data-variant attribute and
    // any non-standard variants. This guarantees every visible nav row
    // participates in search matching.
    const allItems = [...scope.querySelectorAll("sherpa-nav-item")];
    const headers = allItems.filter((i) =>
      i.matches(
        'sherpa-nav-item[data-variant="section"], sherpa-nav-item[data-variant="subsection"]',
      ),
    );
    const headerSet = new Set(headers);
    const items = allItems.filter((i) => !headerSet.has(i));
    const details = [
      ...scope.querySelectorAll(".nav-section, .nav-subsection"),
    ];
    const groups = [...scope.querySelectorAll(".nav-group")];

    // Reset visibility + highlight
    items.forEach((i) => i.removeAttribute('data-search-hidden'));
    headers.forEach((h) => h.removeAttribute('data-search-hidden'));
    details.forEach((d) => {
      // @ts-expect-error - TODO: Fix type
      d.dataset["searchWasOpen"] ??= d.open ? "true" : "false";
      d.removeAttribute('data-search-hidden');
    });
    groups.forEach((g) => g.removeAttribute('data-search-hidden'));
    CSS.highlights.delete("nav-search-match");
    // TODO: migrate to this.shadowRoot.highlights?.delete() once
    // all target browsers support shadow-scoped highlights (Chrome 130+).
    // Currently blocked because nav-item text nodes live in nested
    // shadow roots; the highlight registry must match the tree that
    // owns the text. See https://crbug.com/1480854.

    if (!filter) {
      details.forEach((d) => {
        // @ts-expect-error - TODO: Fix type
        d.open = d.dataset["searchWasOpen"] === "true";
        d.removeAttribute('data-search-was-open');
      });
      scope
        .querySelectorAll("[data-search-hidden]")
        .forEach((el) => el.removeAttribute('data-search-hidden'));
      return;
    }

    // @ts-expect-error - TODO: Fix type
    const ranges = [];

    // @ts-expect-error - TODO: Fix type
    items.forEach((i) => (i.dataset["searchHidden"] = "true"));
    // @ts-expect-error - TODO: Fix type
    headers.forEach((h) => (h.dataset["searchHidden"] = "true"));
    details.forEach((d) => {
      // @ts-expect-error - TODO: Fix type
      d.dataset["searchHidden"] = "true";
      // @ts-expect-error - TODO: Fix type
      d.open = true;
    });
    // @ts-expect-error - TODO: Fix type
    groups.forEach((g) => (g.dataset["searchHidden"] = "true"));

    items.forEach((item) => {
      if (this.#getItemLabel(item).toLowerCase().includes(filter)) {
        const range = this.#createMatchRange(item, filter);
        if (range) ranges.push(range);
        // @ts-expect-error - TODO: Fix type
        delete item.dataset["searchHidden"];
        this.#revealAncestors(item);
      }
    });

    headers.forEach((h) => {
      if (this.#getItemLabel(h).toLowerCase().includes(filter)) {
        const range = this.#createMatchRange(h, filter);
        if (range) ranges.push(range);
        // @ts-expect-error - TODO: Fix type
        delete h.dataset["searchHidden"];
        const container = h.closest(".nav-subsection, .nav-section");
        if (container) this.#revealAncestors(container);
      }
    });

    if (ranges.length)
      // @ts-expect-error - TODO: Fix type
      CSS.highlights.set("nav-search-match", new Highlight(...ranges));
    // TODO: migrate to this.shadowRoot.highlights?.set() — see
    // delete call above for rationale.
  }
}

customElements.define("sherpa-nav", SherpaNav);
