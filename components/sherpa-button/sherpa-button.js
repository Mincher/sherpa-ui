/**
 * sherpa-button.js
 * Multi-template button web component.
 *
 * Four templates (selected via data-type → get templateId()):
 *   default       — Standard button: icon(s) + label + badge + optional close
 *   icon          — Icon-only square button
 *   button-menu   — Button + menu trigger side by side (action menu)
 *   icon-menu     — Icon-only menu trigger (overflow menus)
 *
 * The button is self-managing for its own visual state and broadcasts
 * events so parent components (filter-bar, container) can orchestrate.
 *
 * Menu:
 *   button-menu and icon-menu types are inherently menu triggers — no
 *   `data-menu="true"` attribute is needed. For default/icon types, add
 *   `data-menu="true"` to enable menu trigger behavior.
 *
 *   button-menu has two modes:
 *     Unified (default): clicking anywhere opens the menu.
 *     Split (data-split): left = buttonclick, right chevron = menu.
 *
 *   If `data-menu-template` is set (e.g. "container"), the button stamps
 *   the matching template from SherpaMenu.getMenuTemplate(id) into the
 *   menu, then dispatches `menu-populate` so consumers can inject dynamic
 *   items. Without `data-menu-template`, consumers populate on `menu-open`.
 *
 *   Re-dispatches `menu-select` and `menu-close` on the button.
 *   Named `data-event` events from sherpa-menu also bubble through.
 *
 * Events dispatched:
 *   buttonclick    — Trigger button clicked. detail: { }
 *   chipremove     — Close button clicked.   detail: { }
 *   menu-open      — Menu is about to show. detail: { }
 *   menu-close     — Menu was dismissed. detail: { }
 *   menu-select    — Menu item selected. detail: { item, action, ... }
 *   menu-populate  — Menu is ready for dynamic items. detail: { menu }
 *
 * Attributes:
 *   data-type, data-label, data-variant, data-size, data-active,
 *   data-status, data-icon-start, data-icon-end, data-icon-weight,
 *   data-dismissable, data-count, data-split, disabled,
 *   data-menu, data-menu-position, data-menu-template
 */

import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";
import { SherpaMenu } from "../sherpa-menu/sherpa-menu.js";

/* ── Component ─────────────────────────────────────────────────── */

export class SherpaButton extends SherpaElement {
  static get cssUrl() {
    return new URL("./sherpa-button.css", import.meta.url).href;
  }
  static get htmlUrl() {
    return new URL("./sherpa-button.html", import.meta.url).href;
  }

  static get observedAttributes() {
    return [
      ...super.observedAttributes,
      "data-label",
      "data-variant",
      "data-size",
      "data-active",
      "disabled",
      "data-icon-start",
      "data-icon-end",
      "data-dismissable",
      "data-count",
      "data-menu",
      "data-menu-position",
      "data-menu-template",
    ];
  }

  /* ── Template selection ───────────────────────────────────────── */

  get templateId() {
    return this.dataset.type || "default";
  }

  /* ── Private refs ─────────────────────────────────────────────── */

  #triggerEl = null;
  #labelEl = null;
  #iconStartEl = null;
  #iconEndEl = null;
  #badgeEl = null;
  #closeEl = null;
  #menuTriggerEl = null;
  #menuEl = null;
  #menuClosedAt = 0;

  /* ── Lifecycle ────────────────────────────────────────────────── */

  onRender() {
    this.#triggerEl = this.$(".trigger");
    this.#labelEl = this.$(".label");
    this.#iconStartEl = this.$(".icon-start");
    this.#iconEndEl = this.$(".icon-end");
    this.#badgeEl = this.$(".badge");
    this.#closeEl = this.$(".close");
    this.#menuTriggerEl = this.$(".menu-trigger");

    // Default variant for standard buttons (not button-menu / icon-menu)
    const type = this.dataset.type;
    if (!type && !this.dataset.variant) {
      this.dataset.variant = "primary";
    }

    if (this.hasAttribute("disabled")) {
      this.setAttribute("aria-disabled", "true");
    }

    this.#syncLabel();
    this.#syncIcons();
    this.#syncBadge();
  }

  onConnect() {
    this.#triggerEl?.addEventListener("click", this.#onTriggerClick);
    this.#closeEl?.addEventListener("click", this.#onCloseClick);
    this.#menuTriggerEl?.addEventListener("click", this.#onMenuTriggerClick);
  }

  onDisconnect() {
    this.#triggerEl?.removeEventListener("click", this.#onTriggerClick);
    this.#closeEl?.removeEventListener("click", this.#onCloseClick);
    this.#menuTriggerEl?.removeEventListener("click", this.#onMenuTriggerClick);

    if (this.#menuEl) {
      if (this.#menuEl.open) this.#menuEl.hide();
      this.#menuEl.remove();
      this.#menuEl = null;
    }
  }

  onAttributeChanged(name, _old, newValue) {
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
    if (!this.#labelEl) return;
    this.#labelEl.textContent = this.dataset.label ?? "";
  }

  /* ── Icons sync ───────────────────────────────────────────────── */

  #syncIcons() {
    if (this.#iconStartEl) {
      this.#iconStartEl.textContent = this.dataset.iconStart ?? "";
    }
    if (this.#iconEndEl) {
      this.#iconEndEl.textContent = this.dataset.iconEnd ?? "";
    }
  }

  /* ── Badge sync ───────────────────────────────────────────────── */

  #syncBadge() {
    if (!this.#badgeEl) return;
    this.#badgeEl.textContent = this.dataset.count ?? "";
  }

  /* ── Event handlers ───────────────────────────────────────────── */

  #onTriggerClick = (e) => {
    if (this.disabled) return;

    const type = this.dataset.type;

    // icon-menu is always a menu trigger
    if (type === "icon-menu") {
      e.stopPropagation();
      this.#toggleMenu();
      return;
    }

    // button-menu: unified mode opens menu on trigger; split mode fires buttonclick
    if (type === "button-menu") {
      if (!this.hasAttribute("data-split")) {
        e.stopPropagation();
        this.#toggleMenu();
        return;
      }
      // Split mode — left side dispatches buttonclick (fall through)
    }

    // Legacy menu support for default/icon types
    if (this.dataset.menu === "true") {
      e.stopPropagation();
      this.#toggleMenu();
      return;
    }

    this.dispatchEvent(
      new CustomEvent("buttonclick", {
        bubbles: true,
        composed: true,
        detail: {},
      }),
    );
  };

  /** Click handler for the .menu-trigger div (button-menu template). */
  #onMenuTriggerClick = (e) => {
    if (this.disabled) return;
    e.stopPropagation();
    this.#toggleMenu();
  };

  /** Toggle the menu open/closed with debounce protection. */
  #toggleMenu() {
    if (this.#menuEl?.open || Date.now() - this.#menuClosedAt < 50) {
      this.#menuEl?.hide();
    } else {
      this.#showMenu();
    }
  }

  #onCloseClick = (e) => {
    e.stopPropagation();
    this.dispatchEvent(
      new CustomEvent("chipremove", {
        bubbles: true,
        composed: true,
        detail: {},
      }),
    );
  };

  /* ── Menu ─────────────────────────────────────────────────────── */

  /** The button's own <sherpa-menu> element (created lazily). */
  get menuElement() {
    return this.#ensureMenu();
  }

  /**
   * Lazily create and wire up the per-button menu instance.
   * Inserted as a sibling so CSS anchor positioning resolves
   * in the same tree scope.
   */
  #ensureMenu() {
    if (this.#menuEl) return this.#menuEl;

    const menu = document.createElement("sherpa-menu");
    menu.setAttribute("popover", "auto");
    this.after(menu);

    menu.addEventListener("menu-select", (e) => {
      e.stopPropagation();
      this.dispatchEvent(
        new CustomEvent("menu-select", {
          bubbles: true,
          composed: true,
          detail: e.detail,
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
  async #showMenu() {
    this.setAttribute("aria-expanded", "true");
    const menu = this.#ensureMenu();

    // Stamp static template from the menu template registry (if set).
    // Only clear when stamping a template — setMenuItems() content persists.
    const tplId = this.dataset.menuTemplate;
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
      await Promise.all([...menuItems].map((item) => item.rendered));
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
  #collectAncestorMenuTemplates(menu) {
    // Remove items stamped from a previous open to prevent accumulation
    menu.querySelectorAll("[data-from-ancestor-tpl]").forEach((el) => el.remove());

    const scopeToShadow = this.dataset.menuScope === "shadow";
    let node = this.getRootNode()?.host ?? this.parentElement;
    while (node) {
      const templates = node.querySelectorAll?.(
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

  get disabled() {
    return this.hasAttribute("disabled");
  }
  set disabled(v) {
    v ? this.setAttribute("disabled", "") : this.removeAttribute("disabled");
  }

  get active() {
    return this.hasAttribute("data-active");
  }
  set active(val) {
    this.toggleAttribute("data-active", !!val);
  }

  get label() {
    return this.dataset.label ?? "";
  }
  set label(val) {
    this.dataset.label = val;
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
   *
   * @param {Array} items — flat item array OR sections array (detected by first element having `heading`)
   * @param {{ selection?: "checkbox"|"radio"|"toggle", group?: string, append?: boolean, marker?: string }} [opts]
   */
  setMenuItems(items, opts = {}) {
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
    if (items[0]?.heading !== undefined) {
      this.#buildSections(menu, items);
    } else {
      this.#buildFlatList(menu, items, opts);
    }

    // Tag newly added top-level elements with the marker for scoped cleanup
    if (marker) {
      for (const child of menu.children) {
        if (!before.has(child)) child.setAttribute("data-menu-marker", marker);
      }
    }
  }

  /** Build a flat list of menu items inside a single <ul>. */
  #buildFlatList(menu, items, opts = {}) {
    const ul = document.createElement("ul");
    if (opts.group) ul.dataset.group = opts.group;

    for (const item of items) {
      ul.appendChild(this.#buildMenuItem(item, opts));
    }

    menu.appendChild(ul);
  }

  /** Build grouped sections, each with an optional heading and <ul>. */
  #buildSections(menu, sections) {
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
        if (section.group) ul.dataset.group = section.group;
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
  #buildMenuItem(item, opts = {}) {
    const li = document.createElement("li");
    const menuItem = document.createElement("sherpa-menu-item");
    menuItem.setAttribute("value", item.value ?? "");
    menuItem.textContent = item.text ?? item.value ?? "";

    const selection = item.selection || opts.selection;
    if (selection) menuItem.dataset.selection = selection;
    if (selection === "radio" && (item.group || opts.group)) {
      menuItem.dataset.group = item.group || opts.group;
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
   * @returns {string[]}
   */
  getSelectedValues() {
    if (!this.#menuEl) return [];
    const checked = this.#menuEl.querySelectorAll("sherpa-menu-item[checked]");
    return Array.from(checked, (item) => item.getAttribute("value") ?? "").filter(Boolean);
  }

  /**
   * Clear all checked/selected menu items.
   */
  clearSelection() {
    if (!this.#menuEl) return;
    for (const item of this.#menuEl.querySelectorAll("sherpa-menu-item[checked]")) {
      item.removeAttribute("checked");
    }
  }
}

customElements.define("sherpa-button", SherpaButton);
