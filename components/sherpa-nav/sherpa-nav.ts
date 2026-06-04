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

/* ── Drag-sort (inline — only used here) ────────────────────────── */

interface DragSortOptions {
  itemSelector: string;
  handleSelector: string;
  idAttribute?: string;
  isEnabled?: () => boolean;
  onReorder?: (orderedIds: (string | undefined)[]) => void;
}

function setupDragSort(container: HTMLElement, {
  itemSelector,
  handleSelector,
  idAttribute = 'id',
  isEnabled = () => true,
  onReorder = () => {},
}: DragSortOptions) {
  container.addEventListener('mousedown', (e) => {
    if (!isEnabled()) return;
    const isHandle = e.composedPath().some(
      (n) => n instanceof HTMLElement && n.matches?.(handleSelector)
    );
    if (!isHandle) return;
    const item = e.composedPath().find(
      (n): n is HTMLElement => n instanceof HTMLElement && n.parentElement === container
    );
    if (!item) return;
    item.draggable = true;
    const reset = () => { item.draggable = false; document.removeEventListener('mouseup', reset, true); };
    document.addEventListener('mouseup', reset, true);
  });

  container.querySelectorAll<HTMLElement>(itemSelector).forEach((item) => {
    item.draggable = false;
    item.addEventListener('dragstart', (e) => {
      if (!isEnabled()) { e.preventDefault(); return; }
      item.setAttribute('data-dragging', '');
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', item.dataset[idAttribute] || '');
      }
    });
    item.addEventListener('dragend', () => {
      item.draggable = false;
      item.removeAttribute('data-dragging');
    });
  });

  container.addEventListener('dragover', (e) => {
    if (!isEnabled()) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    const dragging = container.querySelector('[data-dragging]');
    if (!dragging) return;
    const siblings = [...container.querySelectorAll(`${itemSelector}:not([data-dragging])`)];
    const next = siblings.find((s) =>
      e.clientY - s.getBoundingClientRect().top - s.getBoundingClientRect().height / 2 < 0
    );
    container.insertBefore(dragging, next ?? null);
  });

  container.addEventListener('drop', (e) => {
    e.preventDefault();
    const orderedIds = [...container.querySelectorAll<HTMLElement>(itemSelector)].map(
      (el) => el.dataset[idAttribute]
    );
    onReorder(orderedIds);
  });
}

/* ── Domain types ──────────────────────────────────────────────── */

/** The last active selection, replayed after a template re-render. */
type NavSelection =
  | { kind: "item"; itemId: string; sectionId: string | null }
  | { kind: "link"; target: string };

/** Footer-promo configuration. */
interface PromoConfig {
  title?: string;
  message?: string;
  link?: { text?: string; url?: string } | null;
}

/** A nav item descriptor used to stamp the nav-item template. */
interface NavItemData {
  label?: string;
  id?: string;
  icon?: string;
  badge?: string;
  route?: string;
  active?: boolean;
}

export class SherpaNav extends SherpaElement {
  static MODES = { DEFAULT: "default", SEARCH: "search", EDIT: "edit" };

  static override get cssUrl(): string {
    return new URL("./sherpa-nav.css", import.meta.url).href;
  }
  static override get htmlUrl(): string | null {
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

  /** The embedded search input, if the nav template includes one. */
  get #searchField(): (HTMLElement & { value?: string; clear?: () => void }) | null {
    return this.$(".nav-search sherpa-input-search");
  }

  #endingSearch = false; // Guard flag to prevent infinite recursion
  #ready = false;
  #hostClickWired = false;
  #defaultUrl = new URL("./sherpa-nav.html", import.meta.url).href;
  #navItemTpl: HTMLTemplateElement | null = null; // Cached <template class="nav-item-tpl">
  #badgeTpl: HTMLTemplateElement | null = null; // Cached <template class="badge-tpl">
  #defaultOrders: Map<number, string[]> | null = null; // captured at render
  // Last selection requested by the host. Persisted on the instance so we
  // can re-apply the active-state styling after the nav template is
  // swapped via data-src-html or otherwise re-rendered — without this the
  // current page would visually deselect every time the definition
  // changes (the new DOM has no [data-state="selected"] markers).
  #lastSelection: NavSelection | null = null;
  // Last pinned state observed on the host. Captured before a data-src-html
  // swap (and updated whenever the user toggles the pin button) so we
  // can restore it after the new template renders — otherwise the new
  // template's own data-pinned default would clobber the user's choice.
  #lastPinned: string | null = null;
  // Programmatic footer-promo config set via setPromoConfig(); takes
  // precedence over data-promo-* host attributes when present.
  #promoConfig: PromoConfig | null = null;
  #initialized = false;

  /** The .sherpa-nav-root wrapper inside the shadow root. */
  get #root(): HTMLElement | null {
    return this.$<HTMLElement>(".sherpa-nav-root");
  }

  // ═══════════════════════ SherpaElement Hooks ═══════════════════════

  override async onRender(): Promise<void> {
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
    this.#navItemTpl = this.$<HTMLTemplateElement>("template.nav-item-tpl") || this.#injectFallbackTemplate(
      "nav-item-tpl",
      '<sherpa-nav-item data-variant="child" tabindex="0" role="button"></sherpa-nav-item>',
    );
    this.#badgeTpl = this.$<HTMLTemplateElement>("template.badge-tpl") || this.#injectFallbackTemplate(
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
      if (sel.kind === "item") {
        this.#applyActiveItem(sel.itemId, sel.sectionId);
      } else if (sel.kind === "link") {
        this.#applyActiveLink(sel.target);
      }
    }
  }

  override onAttributeChanged(name: string, _oldValue: string | null, newValue: string | null): void {
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
    return this.#root?.dataset["pinned"] === "true";
  }
  set isPinned(v: boolean) {
    const root = this.#root;
    if (!root) return;
    const pinned = !!v;
    root.dataset["pinned"] = pinned ? "true" : "false";
    this.dataset["pinned"] = root.dataset["pinned"];
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
    return this.#root?.dataset["mode"] || SherpaNav.MODES.DEFAULT;
  }
  set mode(v: string) {
    const root = this.#root;
    if (!root) return;
    const oldMode = root.dataset["mode"] || SherpaNav.MODES.DEFAULT;
    if (Object.values(SherpaNav.MODES).includes(v)) {
      root.dataset["mode"] = v;
    } else {
      root.dataset["mode"] = SherpaNav.MODES.DEFAULT;
    }
    this.dataset["mode"] = root.dataset["mode"];
    this.#onModeChange(root.dataset["mode"], oldMode);
  }

  startSearch() {
    this.mode = SherpaNav.MODES.SEARCH;
    this.#searchField?.focus();
  }

  endSearch() {
    // Guard against infinite recursion (clear() fires search event which calls endSearch again)
    if (this.#endingSearch) return;
    this.#endingSearch = true;

    try {
      this.mode = SherpaNav.MODES.DEFAULT;
      if (this.#searchField) {
        this.#searchField.value = "";
        this.#searchField.clear?.();
      }
      this.#applySearchFilter("");
    } finally {
      this.#endingSearch = false;
    }
  }

  setActiveLink(target: string): void {
    this.#lastSelection = { kind: "link", target };
    this.#applyActiveLink(target);
  }

  #applyActiveLink(target: string): void {
    this.#clearAllActiveStates();
    const item = this.$<HTMLElement>(`[data-nav-target="${target}"]`);
    if (item) item.dataset["state"] = "selected";
  }

  setActiveItem(itemId: string, sectionId: string | null = null): void {
    this.#lastSelection = { kind: "item", itemId, sectionId };
    this.#applyActiveItem(itemId, sectionId);
  }

  #applyActiveItem(itemId: string, sectionId: string | null = null): void {
    this.#clearAllActiveStates();
    // Always highlight every nav item that matches the itemId, so mirrors of
    // the same target inside Favorites / Recents (or any other section) are
    // visually selected alongside the canonical entry. The optional sectionId
    // is still honoured to pick a primary item when callers care about it.
    const root = this.#root;
    if (!root) return;
    const matches = root.querySelectorAll<HTMLElement>(
      `sherpa-nav-item[data-item-id="${itemId}"]`,
    );
    matches.forEach((el) => {
      el.dataset["state"] = "selected";
    });
    if (sectionId) {
      const primary = root.querySelector<HTMLElement>(
        `.nav-section[data-section-id="${sectionId}"] sherpa-nav-item[data-item-id="${itemId}"]`,
      );
      if (primary) primary.dataset["state"] = "selected";
    }
  }

  // ═══════════════════════ Recents & Favorites ═════════════════════

  isFavorite(itemId: string): boolean {
    const secId = this.dataset["favoritesSection"] || 'favorites';
    return !!this.$<HTMLElement>(
      `.nav-section[data-section-id="${secId}"] sherpa-nav-item[data-item-id="${itemId}"]`,
    );
  }

  setFavorite(itemId: string, label: string, route: string | undefined, on: boolean): void {
    const secId = this.dataset["favoritesSection"] || 'favorites';
    const sec = this.$<HTMLElement>(`.nav-section[data-section-id="${secId}"]`);
    if (!sec) return;
    const existing = sec.querySelector<HTMLElement>(
      `sherpa-nav-item[data-item-id="${itemId}"]`,
    );
    if (on && !existing) {
      const item = this.#createNavItem(
        { id: itemId, label, route },
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

  async addToRecent(itemId: string, label?: string, route?: string): Promise<void> {
    await this.rendered;
    const secId = this.dataset["recentSection"] || 'recent';
    const sec = this.$<HTMLElement>(`.nav-section[data-section-id="${secId}"]`);
    if (!sec) return;
    const max = parseInt(sec.dataset["maxItems"] || '', 10) || 5;
    // If this item is already in the Recents section, leave the existing
    // entry exactly where it is — re-clicking a recent should NOT cause
    // the list to reorder. We still refresh its label/route in case the
    // upstream metadata changed, and re-mirror selection styling below.
    const existing = sec.querySelector<HTMLElement>(`:scope > sherpa-nav-item[data-item-id="${itemId}"]`);
    if (existing) {
      if (label) existing.setAttribute('data-label', label);
      if (route) existing.dataset["route"] = route;
      if (this.$(`sherpa-nav-item[data-item-id="${itemId}"][data-state="selected"]`)) {
        existing.dataset["state"] = 'selected';
      }
      this.#persistQuickAccess('recent');
      this.#syncSectionBadges();
      return;
    }
    const newItem = this.#createNavItem(
      { id: itemId, label, route },
      sec.dataset["editable"] === "true",
    );
    // If this item is the currently active route, mirror selection so the
    // freshly-inserted recent entry shows the active style immediately.
    if (this.$(`sherpa-nav-item[data-item-id="${itemId}"][data-state="selected"]`)) {
      newItem.dataset["state"] = 'selected';
    }
    const summary = sec.querySelector<HTMLElement>(":scope > summary");
    if (summary) summary.after(newItem);
    else sec.prepend(newItem);
    const items = sec.querySelectorAll<HTMLElement>(":scope > sherpa-nav-item");
    for (let i = max; i < items.length; i++) {
      const item = items[i];
      if (item) item.remove();
    }
    this.#persistQuickAccess('recent');
    this.#syncSectionBadges();
  }

  /**
   * Populate the footer promo callout. Pass null/undefined to clear.
   * Takes precedence over data-promo-* host attributes until cleared.
   * @param {{ title?: string, message?: string, link?: { text: string, url: string } } | null} config
   */
  setPromoConfig(config: PromoConfig | null): void {
    this.#promoConfig = config || null;
    if (this.#ready) this.#syncPromo();
  }

  // ═══════════════════ Footer Promo ════════════════════════════════

  #wirePromo(): void {
    const close = this.$<HTMLElement>(".nav-promo .promo-close");
    if (!close || close.dataset["wired"] === "true") return;
    close.dataset["wired"] = "true";
    close.addEventListener("click", () => {
      const promo = this.$<HTMLElement>(".nav-promo");
      if (promo) promo.dataset["dismissed"] = "";
      this.#emit("navpromodismiss", {});
    });
  }

  #syncPromo(): void {
    const promo = this.$(".nav-promo");
    if (!promo) return;
    const cfg = this.#promoConfig || this.#promoConfigFromAttrs();
    const titleEl = promo.querySelector<HTMLElement>(".promo-title");
    const textEl = promo.querySelector<HTMLElement>(".promo-text");
    const linkEl = promo.querySelector<HTMLElement>(".promo-link");
    if (titleEl) titleEl.textContent = cfg?.title || "";
    if (textEl) textEl.textContent = cfg?.message || "";
    if (linkEl) {
      linkEl.textContent = cfg?.link?.text || "";
      if (cfg?.link?.url) linkEl.dataset["url"] = cfg.link.url;
      else delete linkEl.dataset["url"];
    }
    const hasContent = !!(cfg?.title || cfg?.message || cfg?.link?.text);
    promo.toggleAttribute("hidden", !hasContent);
  }

  #promoConfigFromAttrs(): PromoConfig | null {
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

  #readStored(key: string): Array<{ id?: string; label?: string; route?: string }> {
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  #writeStored(key: string, items: Array<{ id?: string; label?: string; route?: string }>): void {
    try { localStorage.setItem(key, JSON.stringify(items)); } catch {
      /* noop */
    }
  }

  /** Snapshot the live items in a quick-access section to {id,label,route}. */
  #snapshotSection(sec: HTMLElement | null): Array<{ id: string; label: string; route: string }> {
    if (!sec) return [];
    const out: Array<{ id: string; label: string; route: string }> = [];
    sec.querySelectorAll<HTMLElement>(':scope > sherpa-nav-item').forEach((el) => {
      const id = el.dataset["itemId"];
      if (!id) return;
      out.push({
        id,
        label: (el.textContent || '').trim(),
        route: el.dataset["route"] || '',
      });
    });
    return out;
  }

  /** Persist current state of a quick-access section ('recent' | 'favorites'). */
  #persistQuickAccess(which: 'favorites' | 'recent'): void {
    const secId = which === 'favorites'
      ? (this.dataset["favoritesSection"] || 'favorites')
      : (this.dataset["recentSection"] || 'recent');
    const key = which === 'favorites' ? this.#favoritesStorageKey : this.#recentStorageKey;
    const sec = this.$<HTMLElement>(`.nav-section[data-section-id="${secId}"]`);
    if (!sec) return;
    this.#writeStored(key, this.#snapshotSection(sec));
  }

  /**
   * After each render of the nav template, repopulate Recent and Favorites
   * sections from localStorage so the user's history survives template
   * switches and full page reloads.
   */
  #hydrateQuickAccess(): void {
    const hydrate = (secId: string, key: string, max?: number): void => {
      const sec = this.$<HTMLElement>(`.nav-section[data-section-id="${secId}"]`);
      if (!sec) return;
      const stored = this.#readStored(key);
      sec.querySelectorAll<HTMLElement>(':scope > sherpa-nav-item').forEach((n) => n.remove());
      const editable = sec.dataset["editable"] === 'true';
      const limit = max ?? (parseInt(sec.dataset["maxItems"] || '', 10) || stored.length);
      stored.slice(0, limit).forEach((item) => {
        if (!item || !item.id) return;
        sec.appendChild(this.#createNavItem(item, editable));
      });
    };
    hydrate(this.dataset["recentSection"] || 'recent', this.#recentStorageKey);
    hydrate(this.dataset["favoritesSection"] || 'favorites', this.#favoritesStorageKey);
  }

  /**
   * Aggregate child badge state up to each section/subsection summary item.
   * Sections with at least one badged descendant get `data-aggregated-badge`
   * plus a mirrored `data-badge` / `data-badge-status` (highest-severity wins).
   * The aggregated tag remains visible whether the section is open or closed —
   * in collapsed nav state, sherpa-nav-item.css renders it as a status dot.
   */
  #syncSectionBadges(): void {
    // Severity order from highest → lowest. "success" (New) outranks
    // "brand" (Preview) so that a section parent showing an aggregated
    // status reflects newly-shipped work over previews.
    const PRIORITY = ['critical', 'urgent', 'warning', 'info', 'success', 'brand'];
    const rank = (s: string | undefined): number => {
      const i = PRIORITY.indexOf(s || 'success');
      return i === -1 ? PRIORITY.length : i;
    };
    const sections = Array.from(this.$$('.nav-section, .nav-subsection')) as HTMLElement[];
    sections.forEach((sec) => {
      const summaryItem = sec.querySelector<HTMLElement>(':scope > summary > sherpa-nav-item');
      if (!summaryItem) return;
      if (summaryItem.hasAttribute('data-badge') && summaryItem.dataset['aggregatedBadge'] !== 'true') return;
      const descendants = Array.from(sec.querySelectorAll<HTMLElement>('sherpa-nav-item[data-badge]'));
      let best: HTMLElement | undefined = undefined;
      let bestRank = Infinity;
      for (const d of descendants) {
        if (d === summaryItem) continue;
        if (d.dataset['aggregatedBadge'] === 'true') continue;
        const dRank = rank(d.dataset['badgeStatus']);
        if (dRank < bestRank) {
          best = d;
          bestRank = dRank;
        }
      }
      if (best) {
        const bestBadge = best.dataset['badge'];
        const bestStatus = best.dataset['badgeStatus'];
        summaryItem.dataset['aggregatedBadge'] = 'true';
        summaryItem.dataset['badge'] = bestBadge || '•';
        summaryItem.dataset['badgeStatus'] = bestStatus || 'success';
      } else if (summaryItem.dataset['aggregatedBadge'] === 'true') {
        delete summaryItem.dataset['aggregatedBadge'];
        summaryItem.removeAttribute('data-badge');
        summaryItem.removeAttribute('data-badge-status');
      }
    });
  }

  // ═══════════════════════ Private — Helpers ══════════════════════

  #emit(name: string, detail: Record<string, unknown> = {}): void {
    this.dispatchEvent(new CustomEvent(name, { bubbles: true, detail }));
  }

  #clearAllActiveStates(): void {
    this.$$('[data-state="selected"]').forEach((el) => el.removeAttribute('data-state'));
  }

  // ════════════════════ Private — Template Loading ═════════════════

  /** Wire delegated toggle listener for <details> → emit section-expand events. */
  #wireToggleListeners(): void {
    const sections = this.$(".nav-sections");
    if (!sections) return;
    sections.addEventListener(
      "toggle",
      (e) => {
        const details = e.target as HTMLElement | null;
        if (!details || !details.matches(".nav-section, .nav-subsection")) return;
        if ((details as HTMLDetailsElement).open && details.matches(".nav-section")) {
          this.#emit("navsectionexpand", {
            sectionId: details.dataset["sectionId"],
          });
        }
      },
      true,
    );
  }

  /** Sync button active states and layout from template-declared initial values. */
  #syncInitialState(): void {
    const root = this.#root;
    if (root) {
      // Restore the host's last pinned choice across template swaps; fall
      // back to whatever the new template declared on first render.
      const pinned = this.#lastPinned ?? root.dataset["pinned"] ?? "false";
      root.dataset["pinned"] = pinned;
      this.dataset["pinned"] = pinned;
      this.dataset["mode"] = root.dataset["mode"] || SherpaNav.MODES.DEFAULT;
    }
    const pinBtn = this.$<HTMLElement>(".nav-pin-btn") as HTMLElement & { active?: boolean } | null;
    if (pinBtn) pinBtn.active = this.isPinned;
    const editBtn = this.$<HTMLElement>(".nav-edit-btn") as HTMLElement & { active?: boolean } | null;
    if (editBtn) editBtn.active = this.isEditing;
  }

  // ═══════════════════════ Private — Events ══════════════════════

  #attachContentEvents(): void {
    this.$(".nav-pin-btn")?.addEventListener("click", () => {
      this.isPinned = !this.isPinned;
    });
    this.$(".nav-edit-btn")?.addEventListener("click", () => {
      this.mode = this.isEditing
        ? SherpaNav.MODES.DEFAULT
        : SherpaNav.MODES.EDIT;
    });

    const sf = this.#searchField as HTMLElement & { value?: string } | null;
    sf?.addEventListener("input", (e: Event) => {
      const customEvent = e as CustomEvent<{ value?: string }>;
      const value = customEvent.detail?.value ?? sf?.value ?? "";
      this.#applySearchFilter(value);
      this.mode = value.trim()
        ? SherpaNav.MODES.SEARCH
        : SherpaNav.MODES.DEFAULT;
    });
    sf?.addEventListener("keydown", (e: Event) => {
      const keyboardEvent = e as KeyboardEvent;
      if (keyboardEvent.key === "Escape") {
        keyboardEvent.stopPropagation();
        this.endSearch();
      }
    });
    sf?.addEventListener("search", (e: Event) => {
      const customEvent = e as CustomEvent<{ value?: string }>;
      if (!customEvent.detail?.value) this.endSearch();
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
  #onHostClick(e: Event): void {
    const navItem = e
      .composedPath()
      .find(
        (n): n is HTMLElement =>
          n instanceof HTMLElement && n.tagName === "SHERPA-NAV-ITEM",
      );
    if (!navItem) return;

    if (
      e
        .composedPath()
        .some(
          (n) => n instanceof HTMLElement && n.matches?.(".nav-item-delete"),
        )
    ) {
      e.preventDefault();
      e.stopPropagation();
      const sec = navItem.closest<HTMLElement>(".nav-section");
      if (navItem.dataset["itemId"]) {
        this.#emit("navitemdelete", {
          itemId: navItem.dataset["itemId"],
          sectionId: sec?.dataset["sectionId"] || null,
        });
      }
      navItem.remove();
      return;
    }

    if (
      e
        .composedPath()
        .some((n) => n instanceof HTMLElement && n.matches?.(".nav-item-drag"))
    )
      return;

    if (navItem.dataset["navTarget"]) {
      if (navItem.dataset["navTarget"] === "search") {
        this.startSearch();
        return;
      }
      this.#clearAllActiveStates();
      navItem.dataset["state"] = "selected";
      this.#emit(`nav${navItem.dataset["navTarget"]}`);
      return;
    }

    if (
      navItem.dataset["variant"] === "section" ||
      navItem.dataset["variant"] === "subsection"
    ) {
      const details = navItem.closest<HTMLDetailsElement>("details");
      const hasChildren = details
        ? details.querySelector<HTMLElement>(
            ":scope > sherpa-nav-item, :scope > :not(summary)",
          )
        : null;
      const hasRoute = !!navItem.dataset["route"];
      const onLabel = e.composedPath().some(
        (n) => n instanceof HTMLElement && n.getAttribute("part") === "label",
      );
      if (hasChildren && !hasRoute) return;
      if (hasChildren && hasRoute && !onLabel) return;
      e.preventDefault();
      this.#clearAllActiveStates();
      navItem.dataset["state"] = "selected";
      if (this.isEditing) this.mode = SherpaNav.MODES.DEFAULT;
      if (this.isSearching) this.endSearch();
      const headerSectionId =
        details?.dataset["sectionId"] ||
        details?.closest<HTMLElement>(".nav-section")?.dataset["sectionId"] ||
        null;
      this.#emit("navitemclick", {
        itemId: navItem.dataset["itemId"],
        sectionId: headerSectionId,
        route: navItem.dataset["route"],
        label: this.#getItemLabel(navItem),
      });
      this.#trackRecentForLeaf(navItem, headerSectionId);
      return;
    }

    if (this.isEditing) this.mode = SherpaNav.MODES.DEFAULT;
    if (this.isSearching) this.endSearch();
    const leafSectionId =
      navItem.closest<HTMLElement>(".nav-section")?.dataset["sectionId"] || null;
    this.#emit("navitemclick", {
      itemId: navItem.dataset["itemId"],
      sectionId: leafSectionId,
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
  #trackRecentForLeaf(navItem: HTMLElement, sectionId: string | null): void {
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

  #onPinnedChange(pinned: boolean): void {
    const pinBtn = this.$<HTMLElement>(".nav-pin-btn") as HTMLElement & { active?: boolean } | null;
    if (pinBtn) pinBtn.active = pinned;
    this.#emit("navpinchange", { pinned });
  }

  #onModeChange(newMode: string, oldMode: string): void {
    if (
      oldMode === SherpaNav.MODES.SEARCH &&
      newMode !== SherpaNav.MODES.SEARCH
    )
      this.#applySearchFilter("");
    const editBtn = this.$<HTMLElement>(".nav-edit-btn") as HTMLElement & { active?: boolean } | null;
    if (editBtn) editBtn.active = newMode === SherpaNav.MODES.EDIT;
    this.#emit("navmodechange", { mode: newMode, previousMode: oldMode });
  }

  // ═══════════════════ Private — Item Creation ══════════════════

  /**
   * Inject a fallback <template> into the shadow root when a custom
   * data-src-html nav HTML omits the cloning templates that the component
   * relies on for hydrating recents/favorites and section headers.
   */
  #injectFallbackTemplate(className: string, innerHTML: string): HTMLTemplateElement {
    const tpl = document.createElement("template");
    tpl.className = className;
    tpl.innerHTML = innerHTML;
    (this.$(".sherpa-nav-root") || this.shadow).appendChild(tpl);
    return tpl;
  }

  #createNavItem(item: NavItemData, editable = false): HTMLElement {
    const navItemTpl = this.#navItemTpl;
    if (!navItemTpl) throw new Error("Missing nav item template");
    const el = (navItemTpl.content.cloneNode(true) as DocumentFragment)
      .querySelector<HTMLElement>("sherpa-nav-item");
    if (!el) throw new Error("Missing nav item element in template");
    el.textContent = item.label ?? "";
    if (item.id) el.dataset["itemId"] = item.id;
    if (item.icon) el.dataset["icon"] = item.icon;
    if (item.badge) el.appendChild(this.#createBadgeElement(item.badge));
    if (item.route) el.dataset["route"] = item.route;
    if (editable) el.dataset["editable"] = "true";
    if (item.active) el.dataset["state"] = "selected";
    return el;
  }

  #createBadgeElement(text: string): HTMLElement {
    const badgeTpl = this.#badgeTpl;
    if (!badgeTpl) throw new Error("Missing badge template");
    const tag = (badgeTpl.content.cloneNode(true) as DocumentFragment)
      .querySelector<HTMLElement>("sherpa-tag");
    if (!tag) throw new Error("Missing badge element in template");
    tag.textContent = text;
    return tag;
  }

  // ═════════════════════ Private — Drag & Drop ══════════════════

  #setupDragDrop(): void {
    // Capture the template-declared order for each draggable group BEFORE
    // we apply any persisted user reorder, so resetOrder() can restore it.
    this.#captureDefaultOrders();
    this.$$<HTMLElement>('.nav-group[data-draggable="true"]').forEach((container) => {
      const gi = parseInt(container.dataset["groupIndex"] || "", 10);
      const tagSortKeys = () => {
        container
          .querySelectorAll<HTMLElement>(':scope > .nav-section, :scope > sherpa-nav-item')
          .forEach((el) => {
            el.dataset["sortKey"] = el.dataset["sectionId"] || el.dataset["itemId"] || '';
          });
      };
      tagSortKeys();
      new MutationObserver(tagSortKeys).observe(container, { childList: true });

      setupDragSort(container, {
        itemSelector: ':scope > .nav-section, :scope > sherpa-nav-item',
        handleSelector: ".nav-item-drag",
        idAttribute: "sortKey",
        isEnabled: () => this.isEditing,
        onReorder: (order) => {
          const filteredOrder = order.filter((id): id is string => id !== undefined);
          this.#persistGroupOrder(gi, filteredOrder);
          this.#emit("navsectionreorder", {
            groupIndex: gi,
            sectionOrder: filteredOrder,
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

  #captureDefaultOrders(): void {
    if (!this.#defaultOrders) this.#defaultOrders = new Map();
    this.#defaultOrders.clear();
    this.$$<HTMLElement>('.nav-group[data-draggable="true"]').forEach((container) => {
      const gi = parseInt(container.dataset["groupIndex"] || "", 10);
      const order = [...container.querySelectorAll<HTMLElement>(':scope > .nav-section, :scope > sherpa-nav-item')]
        .map((el) => el.dataset["sectionId"] || el.dataset["itemId"] || '')
        .filter((key): key is string => Boolean(key));
      this.#defaultOrders!.set(gi, order);
    });
  }

  #readOrderStore(): Record<string, unknown> {
    try {
      const raw = localStorage.getItem(this.#orderStorageKey);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch { return {}; }
  }

  #writeOrderStore(store: Record<string, unknown>): void {
    try { localStorage.setItem(this.#orderStorageKey, JSON.stringify(store)); } catch {
      /* noop */
    }
  }

  #persistGroupOrder(groupIndex: number, order: string[]): void {
    const store = this.#readOrderStore();
    store[String(groupIndex)] = order;
    this.#writeOrderStore(store);
  }

  /** Reorder children of each draggable group to match the persisted order. */
  #applyStoredOrders(): void {
    const store = this.#readOrderStore();
    if (!store || !Object.keys(store).length) return;
    this.$$<HTMLElement>('.nav-group[data-draggable="true"]').forEach((container) => {
      const gi = parseInt(container.dataset["groupIndex"] || "", 10);
      const order = store[String(gi)];
      if (!Array.isArray(order) || !order.length) return;
      this.#applyOrderToContainer(container, order);
    });
  }

  #applyOrderToContainer(container: HTMLElement, order: string[]): void {
    const lookup = new Map<string, HTMLElement>();
    container
      .querySelectorAll<HTMLElement>(':scope > .nav-section, :scope > sherpa-nav-item')
      .forEach((el) => {
        const key = el.dataset["sectionId"] || el.dataset["itemId"];
        if (key) lookup.set(key, el);
      });
    order.forEach((key) => {
      const el = lookup.get(key);
      if (el) container.appendChild(el);
    });
  }

  /**
   * Public API — revert any user reordering of draggable nav groups back
   * to the template-declared defaults, clear persisted order, and notify
   * listeners via `naveditreset`.
   */
  resetOrder(): void {
    if (!this.#defaultOrders) return;
    this.$$<HTMLElement>('.nav-group[data-draggable="true"]').forEach((container) => {
      const gi = parseInt(container.dataset["groupIndex"] || "", 10);
      const order = this.#defaultOrders!.get(gi);
      if (order && order.length) this.#applyOrderToContainer(container, order);
    });
    try { localStorage.removeItem(this.#orderStorageKey); } catch {
      /* noop */
    }
    this.#emit('naveditreset');
  }

  // ═══════════════════ Private — Search Filter ══════════════════

  #getItemLabel(item: HTMLElement): string {
    return [...item.childNodes]
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.textContent || "")
      .join("")
      .trim();
  }

  /** Create a Range highlighting the first occurrence of filterLower in item's text nodes. */
  #createMatchRange(item: HTMLElement, filterLower: string): Range | null {
    for (const node of item.childNodes) {
      if (node.nodeType !== Node.TEXT_NODE) continue;
      const text = node.textContent || '';
      const idx = text.toLowerCase().indexOf(filterLower);
      if (idx < 0) continue;
      const range = new Range();
      range.setStart(node, idx);
      range.setEnd(node, idx + filterLower.length);
      return range;
    }
    return null;
  }

  #revealAncestors(node: Node | null): void {
    let el = node instanceof HTMLElement ? node : null;
    while (el) {
      if (el.matches("sherpa-nav-item")) el.removeAttribute('data-search-hidden');
      else if (el.matches(".nav-subsection, .nav-section")) {
        el.removeAttribute('data-search-hidden');
        (el as HTMLDetailsElement).open = true;
      } else if (el.matches(".nav-group")) el.removeAttribute('data-search-hidden');
      el =
        el.parentElement?.closest(
          "sherpa-nav-item, .nav-subsection, .nav-section, .nav-group",
        ) || null;
    }
  }

  #applySearchFilter(value: string): void {
    const scope = this.$<HTMLElement>(".nav-sections");
    if (!scope) return;

    const filter = (value || "").trim().toLowerCase();
    const allItems = [...scope.querySelectorAll<HTMLElement>("sherpa-nav-item")];
    const headers = allItems.filter((i) =>
      i.matches(
        'sherpa-nav-item[data-variant="section"], sherpa-nav-item[data-variant="subsection"]',
      ),
    );
    const headerSet = new Set(headers);
    const items = allItems.filter((i) => !headerSet.has(i));
    const details = [...scope.querySelectorAll<HTMLDetailsElement>(".nav-section, .nav-subsection")];
    const groups = [...scope.querySelectorAll<HTMLElement>(".nav-group")];

    items.forEach((i) => i.removeAttribute('data-search-hidden'));
    headers.forEach((h) => h.removeAttribute('data-search-hidden'));
    details.forEach((d) => {
      d.dataset['searchWasOpen'] ??= d.open ? "true" : "false";
      d.removeAttribute('data-search-hidden');
    });
    groups.forEach((g) => g.removeAttribute('data-search-hidden'));
    CSS.highlights.delete("nav-search-match");

    if (!filter) {
      details.forEach((d) => {
        d.open = d.dataset['searchWasOpen'] === "true";
        d.removeAttribute('data-search-was-open');
      });
      scope
        .querySelectorAll("[data-search-hidden]")
        .forEach((el) => el.removeAttribute('data-search-hidden'));
      return;
    }

    const ranges: Range[] = [];

    items.forEach((i) => (i.dataset['searchHidden'] = "true"));
    headers.forEach((h) => (h.dataset['searchHidden'] = "true"));
    details.forEach((d) => {
      d.dataset['searchHidden'] = "true";
      d.open = true;
    });
    groups.forEach((g) => (g.dataset['searchHidden'] = "true"));

    items.forEach((item) => {
      if (this.#getItemLabel(item).toLowerCase().includes(filter)) {
        const range = this.#createMatchRange(item, filter);
        if (range) ranges.push(range);
        delete item.dataset['searchHidden'];
        this.#revealAncestors(item);
      }
    });

    headers.forEach((h) => {
      if (this.#getItemLabel(h).toLowerCase().includes(filter)) {
        const range = this.#createMatchRange(h, filter);
        if (range) ranges.push(range);
        delete h.dataset['searchHidden'];
        const container = h.closest<HTMLElement>(".nav-subsection, .nav-section");
        if (container) this.#revealAncestors(container);
      }
    });

    if (ranges.length)
      CSS.highlights.set("nav-search-match", new Highlight(...ranges));
  }
}

customElements.define("sherpa-nav", SherpaNav);
