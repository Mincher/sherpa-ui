/**
 * sherpa-button.ts
 * SherpaButton — Multi-template button web component.
 *
 * Two templates (selected via data-type → get templateId()):
 *   default       — Standard button: icon(s) + label + badge
 *   icon          — Icon-only square button
 *
 * For compound button patterns (split, dismissable chip), compose separate
 * sherpa-button elements inside a .grouped-component wrapper.
 *
 * The button is self-managing for its own visual state and broadcasts
 * events so parent components (filter-bar, container) can orchestrate.
 *
 * Menu behaviour:
 *   Any button with data-menu="true" acts as a menu trigger.
 *   If data-menu-template is set, stamps the matching template from
 *   SherpaMenu.getMenuTemplate(id) then dispatches menu-populate.
 *
 * @element sherpa-button
 * @category control
 *
 * @attr {enum}    data-type            — default | icon
 * @attr {string}  data-label           — Button text label
 * @attr {enum}    data-variant         — primary | secondary | tertiary | tertiary-on-color
 * @attr {enum}    data-size            — 2x-small | x-small | small | base | large (default: base)
 * @attr {boolean} data-active          — Active/pressed toggle state
 * @attr {enum}    data-status          — critical | warning | success | info | urgent
 * @attr {string}  data-icon-start      — Leading icon (Font Awesome unicode)
 * @attr {string}  data-icon-end        — Trailing icon (Font Awesome unicode)
 * @attr {enum}    data-icon-weight     — fa-solid | fa-regular | fa-light
 * @attr {number}  data-count           — Badge count
 * @attr {boolean} data-menu            — Enable menu trigger on any button type
 * @attr {enum}    data-menu-position   — Menu placement (top | bottom | left | right)
 * @attr {string}  data-menu-template   — Menu template id to stamp from SherpaMenu
 * @attr {boolean} disabled             — Native disabled state
 *
 * @fires button-click — Main button area clicked
 *   bubbles: true, composed: true
 *   detail: { }
 * @fires menu-open — Menu is about to show
 *   bubbles: true, composed: true
 *   detail: { }
 * @fires menu-close — Menu was dismissed
 *   bubbles: true, composed: true
 *   detail: { }
 * @fires menu-select — Menu item selected
 *   bubbles: true, composed: true
 *   detail: { item: Element, action: string }
 * @fires menu-populate — Menu stamped and ready for dynamic items
 *   bubbles: true, composed: true
 *   detail: { menu: SherpaMenu }
 *
 * @method setMenuItems(items, opts) — Populate menu with items array
 *   @param {Array} items — Flat array or sections format
 *   @param {object} [opts] — Options
 *   @returns {void}
 * @method getSelectedValues() — Get checked menu item values
 *   @returns {string[]}
 * @method clearSelection() — Clear all checked menu items
 *   @returns {void}
 *
 * @prop {boolean} disabled — Disabled state (read/write)
 * @prop {boolean} active — Active/pressed state (read/write)
 * @prop {string} label — Button text label (read/write)
 * @prop {string} templateId — Active template id (read-only)
 * @prop {SherpaMenu} menuElement — The menu instance (read-only)
 */

import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";
import { SherpaMenu } from "../sherpa-menu/sherpa-menu.js";
import type {
  ComponentSize,
  ColorVariant,
  Status,
  MenuItem,
  MenuSection,
  MenuItems,
  MenuOptions,
  PopoverPosition
} from "../utilities/types.js";

/* ── Type Definitions ─────────────────────────────────────────────── */

/** Button types (template variants) */
type ButtonType = 'default' | 'icon' | 'button-menu' | 'icon-menu';

/** Font Awesome icon weights */
type IconWeight = 'fa-solid' | 'fa-regular' | 'fa-light';

/** Button-specific event details */
interface ButtonClickEventDetail {
  timestamp: number;
}

/* ── Dataset Interface ───────────────────────────────────────────── */

interface SherpaButtonDataset extends DOMStringMap {
  type?: ButtonType;
  label?: string;
  variant?: ColorVariant;
  size?: ComponentSize;
  active?: string;
  status?: Status;
  iconStart?: string;
  iconEnd?: string;
  iconWeight?: IconWeight;
  count?: string;
  menu?: 'true' | 'false';
  menuPosition?: PopoverPosition;
  menuTemplate?: string;
  menuScope?: 'shadow' | 'none';
}

/* ── Component ─────────────────────────────────────────────── */

export class SherpaButton extends SherpaElement {
  static override get cssUrl(): string {
    return new URL("./sherpa-button.css", import.meta.url).href;
  }
  static override get htmlUrl(): string {
    return new URL("./sherpa-button.html", import.meta.url).href;
  }

  static override get observedAttributes(): string[] {
    return [
      ...super.observedAttributes,
      "data-label",
      "data-variant",
      "data-size",
      "data-active",
      "disabled",
      "data-icon-start",
      "data-icon-end",
      "data-count",
      "data-menu",
      "data-menu-position",
      "data-menu-template",
    ];
  }

  /* ── Typed dataset ────────────────────────────────────────────── */

  override get dataset(): SherpaButtonDataset {
    return super.dataset as SherpaButtonDataset;
  }

  /* ── Template selection ───────────────────────────────────────── */

  override get templateId(): string {
    const type = this.dataset["type"];
    // button-menu → default, icon-menu → icon for backward compat
    if (type === "button-menu") return "default";
    if (type === "icon-menu") return "icon";
    return type || "default";
  }

  /* ── Private refs ─────────────────────────────────────────────── */

  // Cached shadow DOM elements
  els = this.cacheElements({
    trigger: '.trigger',
    label: '.label',
    iconStart: '.icon-start',
    iconEnd: '.icon-end',
    badge: '.badge',
  });

  // Menu state (not cached - initialized later via setMenuItems)
  #menuEl: SherpaMenu | null = null;
  #menuClosedAt: number = 0;

  /* ── Lifecycle ────────────────────────────────────────────────── */

  override onRender(): void {
    // Element cache auto-populated on first access

    // Default variant for standard buttons
    const type = this.dataset["type"];
    if (!type && !this.dataset["variant"]) {
      this.dataset["variant"] = "primary";
    }
    if (!this.dataset["size"]) {
      this.dataset["size"] = "base";
    }

    if (this.hasAttribute("disabled")) {
      this.setAttribute("aria-disabled", "true");
    }

    this.#syncLabel();
    this.#syncIcons();
    this.#syncBadge();
    this.els.trigger?.addEventListener("click", this.#onTriggerClick);
  }

  override onAttributeChanged(name: string, _old: string | null, newValue: string | null): void {
    switch (name) {
      case "disabled":
        this.setAttribute("aria-disabled", newValue !== null ? "true" : "false");
        break;

      case "data-label":
        this.#syncLabel();
        break;

      case "data-icon-start":
      case "data-icon-end":
        this.#syncIcons();
        break;

      case "data-count":
        this.#syncBadge();
        break;
    }
  }

  /* ── Label sync ───────────────────────────────────────────────── */

  #syncLabel() {
    if (!this.els.label) return;
    this.els.label.textContent = this.dataset["label"] ?? "";
  }

  /* ── Icons sync ───────────────────────────────────────────────── */

  // data-icon-start / data-icon-end accept a Font Awesome class string
  // (e.g. "fa-solid fa-star"). Legacy templates may still pass a single
  // FA unicode codepoint (e.g. "\uf005" via &#xf005;) — in that case the
  // value is rendered as textContent and the global font-family fallback
  // (set inline below) lets FA's @font-face show the glyph.
  #syncIcons(): void {
    if (this.els.iconStart) this.#applyIconValue(this.els.iconStart, 'icon-start', this.dataset["iconStart"]);
    if (this.els.iconEnd) this.#applyIconValue(this.els.iconEnd, 'icon-end', this.dataset["iconEnd"]);
  }

  #applyIconValue(el: HTMLElement, baseClass: string, value: string | undefined): void {
    const v = value || '';
    // FA class strings contain "fa-" tokens. Single-char or short non-class
    // values are treated as unicode glyphs.
    if (/\bfa-/.test(v)) {
      el.className = `${baseClass} ${v}`.trim();
      el.textContent = '';
      el.style.fontFamily = '';
    } else {
      el.className = baseClass;
      el.textContent = v;
      el.style.fontFamily = v ? '"Font Awesome 6 Free"' : '';
      el.style.fontWeight = v ? '900' : '';
    }
  }

  /* ── Badge sync ───────────────────────────────────────────────── */

  #syncBadge(): void {
    if (!this.els.badge) return;
    this.els.badge.textContent = this.dataset["count"] ?? "";
  }

  /* ── Event handlers ───────────────────────────────────────────── */

  #onTriggerClick = (e: MouseEvent): void => {
    if (this.disabled) return;

    // Any button with data-menu="true" acts as a menu trigger
    if (this.dataset["menu"] === "true") {
      e.stopPropagation();
      this.#toggleMenu();
      return;
    }

    this.dispatchEvent(
      new CustomEvent<ButtonClickEventDetail>("button-click", {
        bubbles: true,
        composed: true,
        detail: { timestamp: Date.now() },
      }),
    );
  };

  /** Toggle the menu open/closed with debounce protection. */
  #toggleMenu(): void {
    if (this.#menuEl?.open || Date.now() - this.#menuClosedAt < 50) {
      this.#menuEl?.hide();
    } else {
      this.#showMenu();
    }
  }

  /* ── Menu ─────────────────────────────────────────────────────── */

  /** The button's own <sherpa-menu> element (created lazily). */
  get menuElement(): SherpaMenu {
    return this.#ensureMenu();
  }

  /**
   * Lazily create and wire up the per-button menu instance.
   * Inserted as a sibling so CSS anchor positioning resolves
   * in the same tree scope.
   */
  #ensureMenu(): SherpaMenu {
    if (this.#menuEl) return this.#menuEl;

    const menu = document.createElement("sherpa-menu") as unknown as SherpaMenu;
    menu.setAttribute("popover", "auto");
    this.after(menu);

    menu.addEventListener("menu-select", (e: Event) => {
      e.stopPropagation();
      this.dispatchEvent(
        new CustomEvent("menu-select", {
          bubbles: true,
          composed: true,
          detail: (e as CustomEvent).detail,
        }),
      );
    });

    menu.addEventListener("menu-close", (e) => {
      e.stopPropagation();
      this.removeAttribute("aria-expanded");
      this.#menuClosedAt = Date.now();
      this.dispatchEvent(
        new CustomEvent("menu-close", { bubbles: true, composed: true }),
      );
    });

    this.#menuEl = menu;
    return menu;
  }

  /**
   * Show the button's menu.
   * If data-menu-template is set, stamps the matching template from
   * SherpaMenu's template registry, then fires `menu-populate` for
   * dynamic content injection. Also fires `menu-open`.
   */
  async #showMenu(): Promise<void> {
    this.setAttribute("aria-expanded", "true");
    const menu = this.#ensureMenu();

    // Stamp static template from the menu template registry (if set).
    // Only clear when stamping a template — setMenuItems() content persists.
    const tplId = this.dataset["menuTemplate"];
    if (tplId) {
      menu.replaceChildren();
      await SherpaMenu.ready;
      const html = SherpaMenu.getMenuTemplate(tplId);
      if (html) {
        const frag = document.createRange().createContextualFragment(html);
        menu.append(frag);
      }
    }

    // Collect <template data-menu> from ancestors (composed tree)
    this.#collectAncestorMenuTemplates(menu);

    // Let consumers populate / modify the menu before showing
    this.dispatchEvent(
      new CustomEvent("menu-populate", {
        bubbles: true,
        composed: true,
        detail: { menu },
      }),
    );
    this.dispatchEvent(
      new CustomEvent("menu-open", { bubbles: true, composed: true }),
    );

    await menu.rendered;

    // Ensure menu items have rendered their shadow DOMs (including
    // checkbox/radio inputs) before showing the menu.
    const menuItems = menu.querySelectorAll("sherpa-menu-item");
    if (menuItems.length) {
      interface HasRendered { readonly rendered: Promise<void>; }
      await Promise.all([...menuItems].map((item) =>
        (item as Element & HasRendered).rendered
      ));
    }

    menu.show(this);
  }

  /**
   * Walk the composed tree from this button upward, collecting
   * `<template data-menu>` elements and stamping their content
   * into the menu.
   *
   * When `data-menu-scope="shadow"` is set on the button, collection
   * stops at the immediate shadow host — ancestor templates beyond the
   * host component are not included. This prevents viz children from
   * inheriting their container's menu items.
   */
  #collectAncestorMenuTemplates(menu: SherpaMenu): void {
    // Remove items stamped from a previous open to prevent accumulation
    menu.querySelectorAll("[data-from-ancestor-tpl]").forEach((el: Element) => el.remove());

    // "none" — skip ancestor template collection entirely;
    // this button-menu uses only setMenuItems() content.
    if (this.dataset["menuScope"] === "none") return;

    const scopeToShadow = this.dataset["menuScope"] === "shadow";
    let node: Node | null = (this.getRootNode() as ShadowRoot)?.host ?? this.parentElement;
    while (node) {
      const element = node as Element;
      const templates = element.querySelectorAll?.(
        ":scope > template[data-menu]",
      );
      if (templates) {
        for (const tpl of templates) {
          const clone = tpl.content.cloneNode(true);
          // Mark each top-level node so it can be removed on re-open
          for (const child of clone.children) {
            child.setAttribute("data-from-ancestor-tpl", "");
          }
          menu.append(clone);
        }
      }
      // Stop after the immediate shadow host when scoped
      if (scopeToShadow) break;
      node = node.getRootNode?.()?.host ?? node.parentElement;
    }
  }

  /* ── Public API ──────────────────────────────────────────────── */

  get disabled(): boolean {
    return this.hasAttribute("disabled");
  }
  set disabled(v: boolean) {
    v ? this.setAttribute("disabled", "") : this.removeAttribute("disabled");
  }

  get active(): boolean {
    return this.hasAttribute("data-active");
  }
  set active(val: boolean) {
    this.toggleAttribute("data-active", !!val);
  }

  get label(): string {
    return this.dataset["label"] ?? "";
  }
  set label(val: string) {
    this.dataset["label"] = val;
  }

  /**
   * Programmatically populate the button's menu with items.
   * Creates <sherpa-menu-item> elements inside the menu.
   *
   * Supports two formats:
   *
   * Flat array (simple list):
   *   setMenuItems([{ value, text, selected?, disabled?, keepOpen? }], { selection, group })
   *
   * Sections array (grouped with headings):
   *   setMenuItems([{ heading, items: [...], group?, selection? }])
   *   Each section produces a heading + <ul> with its items.
   *
   * Options:
   *   append  — if true, keep existing menu content (default: false)
   *   marker  — tag new elements for scoped cleanup on re-call; implies append
   */
  setMenuItems(items: MenuItems, opts: Partial<MenuOptions> = {}): void {
    const menu = this.#ensureMenu();
    const { marker } = opts;

    if (marker) {
      // Scoped replace: remove only previously-marked items, keep everything else
      menu.querySelectorAll(`[data-menu-marker="${marker}"]`).forEach((el) => el.remove());
    } else if (!opts.append) {
      menu.replaceChildren();
    }

    if (!items?.length) return;

    // Collect newly built elements so we can tag them with marker
    const before = new Set(menu.children);

    // Detect sections format: first element has a `heading` property
    if ('heading' in (items[0] || {})) {
      this.#buildSections(menu, items as MenuSection[]);
    } else {
      this.#buildFlatList(menu, items as MenuItem[], opts);
    }

    // Tag newly added top-level elements with the marker for scoped cleanup
    if (marker) {
      for (const child of menu.children) {
        if (!before.has(child)) child.setAttribute("data-menu-marker", marker);
      }
    }
  }

  /** Build a flat list of menu items inside a single <ul>. */
  #buildFlatList(menu: SherpaMenu, items: MenuItem[], opts: Partial<MenuOptions> = {}): void {
    const ul = document.createElement("ul");
    if (opts.group) ul.dataset['group'] = opts.group;

    for (const item of items) {
      ul.appendChild(this.#buildMenuItem(item, opts));
    }

    menu.appendChild(ul);
  }

  /** Build grouped sections, each with an optional heading and <ul>. */
  #buildSections(menu: SherpaMenu, sections: MenuSection[]): void {
    for (const section of sections) {
      // Heading
      if (section.heading) {
        const heading = document.createElement("sherpa-menu-item");
        heading.setAttribute("data-type", "heading");
        heading.textContent = section.heading;
        if (section.style) heading.setAttribute("style", section.style);
        menu.appendChild(heading);
      }

      // Items
      if (section.items?.length) {
        const ul = document.createElement("ul");
        if (section.group) ul.dataset['group'] = section.group;
        if (section.style) ul.setAttribute("style", section.style);

        const sectionOpts = {
          selection: section.selection,
          group: section.group,
        };

        for (const item of section.items) {
          ul.appendChild(this.#buildMenuItem(item, sectionOpts));
        }

        menu.appendChild(ul);
      }
    }
  }

  /** Create a single <li><sherpa-menu-item>…</sherpa-menu-item></li>. */
  #buildMenuItem(item: MenuItem, opts: Partial<MenuOptions> = {}): HTMLLIElement {
    const li = document.createElement("li");
    const menuItem = document.createElement("sherpa-menu-item");
    menuItem.setAttribute("value", item.value ?? "");
    menuItem.textContent = item.text ?? item.value ?? "";

    const selection = item.selection || opts.selection;
    if (selection) menuItem.dataset['selection'] = selection;
    if (selection === "radio" && (item.group || opts.group)) {
      menuItem.dataset['group'] = item.group || opts.group || '';
    }
    if (item.selected || item.checked) menuItem.setAttribute("checked", "");
    if (item.disabled) menuItem.setAttribute("disabled", "");
    if (item.description) menuItem.setAttribute("data-description", item.description);
    if (item.keepOpen || selection === "checkbox") {
      menuItem.setAttribute("data-keep-open", "");
    }
    // Forward custom data-* attributes
    if (item.data) {
      for (const [k, v] of Object.entries(item.data)) {
        menuItem.dataset[k] = v;
      }
    }

    li.appendChild(menuItem);
    return li;
  }

  /**
   * Get values of all checked/selected menu items.
   */
  getSelectedValues(): string[] {
    if (!this.#menuEl) return [];
    const checked = this.#menuEl.querySelectorAll("sherpa-menu-item[checked]");
    return Array.from(checked, (item) => item.getAttribute("value") ?? "").filter(Boolean);
  }

  /**
   * Clear all checked/selected menu items.
   */
  clearSelection(): void {
    if (!this.#menuEl) return;
    for (const item of this.#menuEl.querySelectorAll("sherpa-menu-item[checked]")) {
      item.removeAttribute("checked");
    }
  }
}

customElements.define("sherpa-button", SherpaButton);
