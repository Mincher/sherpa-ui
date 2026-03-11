/**
 * SherpaDataVizContainer — Dashboard card with header, metrics, and content area.
 *
 * Extends SherpaElement via ResizeBehavior mixin with full shadow DOM
 * encapsulation. The shadow template defines structural layout: header,
 * filter bar, and a default slot for consumer content (metrics + viz children).
 *
 * The header is a native <header> element with a <dl> for title and
 * description, plus sherpa-button instances for open-external and the
 * overflow menu (icon-menu type). Visibility of these buttons is
 * CSS-driven via data-open-external and data-menu-button host attributes.
 *
 * Content is supplied via inline child elements in the default slot.
 * The container is content-agnostic — it never imports or creates viz
 * components directly. All content components auto-load their own data
 * via ContentAttributesMixin.
 *
 * Metric visibility is CSS-driven via data-col-span (no JS needed).
 * The metrics area auto-hides when no metric has a data-label attribute.
 *
 * Menu items:
 *   The overflow menu is assembled from light-DOM `<template data-menu>`
 *   children found on the host. ResizeBehavior injects Width/Height
 *   resize items. Consumer view templates
 *   add action items (e.g. Export) via their own `<template data-menu>`.
 *
 * Resize (via ResizeBehavior mixin):
 *   Column stops: 3 → 6 → 9 → 12, row span: 1–6.
 *
 * Architecture — decoupled peer events:
 *   Container owns layout only. All data concerns are handled by the
 *   content components themselves:
 *     containerfilterchange — filter bar → viz children (scoped)
 *     globalfilterchange   — document → viz children (direct)
 *     sortchange           — viz child → filter bar (sort chip sync)
 *     presentationchange   — viz child → consumer (view switch)
 *
 *   Viz children dispatch `columnsready` (bubbles, composed) when
 *   data loads. The filter bar self-populates by listening on
 *   `document` — the container is not involved in column data flow.
 *
 *   Menu items are assembled from light-DOM `<template data-menu>`
 *   children by sherpa-button's composed-tree walking. ResizeBehavior
 *   injects resize items; consumers add action items in view HTML.
 *   Menu events bubble harmlessly if no listener is present.
 *
 * Attributes:
 *   data-variant        — Layout variant: "fit" (default), "resizable", "fill"
 *   data-title          — Container heading text
 *   data-description    — Container description
 *   data-col-span       — Column span (3, 6, 9, 12) — resizable variant only
 *   data-row-span       — Row span (1–6) — resizable variant only
 *   data-menu-open      — Menu state (set by menu-open/menu-close events)
 *   data-editable       — Edit mode (enables CSS resize grip)
 *   data-filters        — Present when filter bar is visible (toggled via menu)
 *   data-available-fields — JSON array forwarded to the embedded filter bar
 *   data-open-external  — "true" — show open-external button (CSS-driven)
 *   data-menu-button    — "true" — show menu button (CSS-driven)
 *   data-drag-handle    — "true" — show drag handle (CSS-driven)
 *
 * Slots:
 *   (default) — Consumer content: sherpa-metric children + viz children
 */

import "../sherpa-filter-bar/sherpa-filter-bar.js";
import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";
import { ResizeBehavior } from "../utilities/resize-behavior.js";

/* ── Component ─────────────────────────────────────────────────── */

export class SherpaDataVizContainer extends ResizeBehavior(SherpaElement) {
  static get htmlUrl() {
    return new URL("./sherpa-data-viz-container.html", import.meta.url).href;
  }

  static get cssUrl() {
    return new URL("./sherpa-data-viz-container.css", import.meta.url).href;
  }

  static get observedAttributes() {
    return [
      ...super.observedAttributes,
      "data-title",
      "data-description",
      "data-available-fields",
    ];
  }

  /** @type {HTMLElement|null} */
  #titleEl = null;
  /** @type {HTMLElement|null} */
  #descriptionEl = null;
  /** @type {HTMLTemplateElement|null} */
  #filterMenuTpl = null;

  /* ── SherpaElement lifecycle hooks ───────────────────────────── */

  onRender() {
    if (!this.dataset.variant) this.dataset.variant = "fit";
    if (!this.dataset.openExternal) this.dataset.openExternal = "true";
    if (!this.dataset.menuButton) this.dataset.menuButton = "true";
    if (!this.hasAttribute("data-filters")) this.toggleAttribute("data-filters", true);

    this.#titleEl = this.$(".header-title");
    this.#descriptionEl = this.$(".header-description");

    this.#syncTitle();
    this.#syncDescription();
    this.#syncAvailableFields();
  }

  onConnect() {
    super.onConnect();
    this.#injectFilterMenu();
    this.addEventListener("menu-open", this.#onMenuOpen);
    this.addEventListener("menu-close", this.#onMenuClose);
    this.addEventListener("menu-populate", this.#onMenuPopulate);
    this.addEventListener("toggle-filters", this.#onToggleFilters);

  }

  onDisconnect() {
    super.onDisconnect();
    this.removeEventListener("menu-open", this.#onMenuOpen);
    this.removeEventListener("menu-close", this.#onMenuClose);
    this.removeEventListener("menu-populate", this.#onMenuPopulate);
    this.removeEventListener("toggle-filters", this.#onToggleFilters);
    this.#filterMenuTpl?.remove();
    this.#filterMenuTpl = null;
  }

  onAttributeChanged(name) {
    if (name === "data-title") this.#syncTitle();
    if (name === "data-description") this.#syncDescription();
    if (name === "data-available-fields") this.#syncAvailableFields();
  }

  /* ── Private sync ────────────────────────────────────────────── */

  #syncTitle() {
    if (this.#titleEl) this.#titleEl.textContent = this.dataset.title || "";
  }

  #syncDescription() {
    if (this.#descriptionEl)
      this.#descriptionEl.textContent = this.dataset.description || "";
  }

  #syncAvailableFields() {
    const bar = this.$("sherpa-filter-bar");
    if (!bar) return;
    const value = this.getAttribute("data-available-fields");
    if (value != null) {
      bar.setAttribute("data-available-fields", value);
    } else {
      bar.removeAttribute("data-available-fields");
    }
  }

  #onMenuOpen = () => {
    this.dataset.menuOpen = "true";
  };

  #onMenuClose = () => {
    delete this.dataset.menuOpen;
  };

  /* ── Filter menu ───────────────────────────────────────────── */

  /** Prepend a <template data-menu> for the filter toggle into light DOM. */
  #injectFilterMenu() {
    if (this.#filterMenuTpl) return;
    const src = this.$("#filter-menu");
    if (!src) return;
    const tpl = document.createElement("template");
    tpl.setAttribute("data-menu", "");
    tpl.content.appendChild(src.content.cloneNode(true));
    this.#filterMenuTpl = tpl;
    this.prepend(tpl);
  }

  #onToggleFilters = () => {
    this.toggleAttribute("data-filters");
  };

  /** Sync checkbox state for the filter-toggle menu item after templates are stamped. */
  #onMenuPopulate = (e) => {
    const menu = e.detail?.menu;
    if (!menu) return;
    const item = menu.querySelector('sherpa-menu-item[data-event="toggle-filters"]');
    if (item) {
      item.toggleAttribute("checked", this.hasAttribute("data-filters"));
    }
  };
}

customElements.define("sherpa-data-viz-container", SherpaDataVizContainer);
