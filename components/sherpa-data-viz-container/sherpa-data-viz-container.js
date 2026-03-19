/**
 * @element sherpa-data-viz-container
 * @description Dashboard card with header, metrics, and content area.
 *   Content-agnostic — never imports or creates viz components directly.
 *   Resize support via ResizeBehavior mixin.
 *
 * @attr {enum}    [data-variant]         — fit | resizable | fill (default: fit)
 * @attr {string}  [data-title]           — Container heading text
 * @attr {string}  [data-description]     — Container description
 * @attr {number}  [data-col-span]        — Column span: 3 | 6 | 9 | 12 (resizable)
 * @attr {number}  [data-row-span]        — Row span: 1–6 (resizable)
 * @attr {boolean} [data-menu-open]       — Menu state
 * @attr {boolean} [data-editable]        — Edit mode (enables resize grip)
 * @attr {boolean} [data-open-external]   — Show open-external button
 * @attr {boolean} [data-menu-button]     — Show menu button
 * @attr {boolean} [data-drag-handle]     — Show drag handle
 *
 * @slot (default) — Consumer content: sherpa-metric children + viz children
 */

import "../sherpa-filter-bar/sherpa-filter-bar.js";
import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";
import { ResizeBehavior } from "../utilities/resize-behavior.js";
import { injectFilterMenu, removeFilterMenu } from "../utilities/filter-menu-utils.js";

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

    this.#titleEl = this.$(".header-title");
    this.#descriptionEl = this.$(".header-description");

    this.#syncTitle();
    this.#syncDescription();
  }

  onConnect() {
    super.onConnect();
    this.#filterMenuTpl = injectFilterMenu(this);
    this.addEventListener("menu-open", this.#onMenuOpen);
    this.addEventListener("menu-close", this.#onMenuClose);
    this.addEventListener("toggle-filters", this.#onToggleFilters);
  }

  onDisconnect() {
    super.onDisconnect();
    this.removeEventListener("menu-open", this.#onMenuOpen);
    this.removeEventListener("menu-close", this.#onMenuClose);
    this.removeEventListener("toggle-filters", this.#onToggleFilters);
    removeFilterMenu(this.#filterMenuTpl);
    this.#filterMenuTpl = null;
  }

  onAttributeChanged(name) {
    if (name === "data-title") this.#syncTitle();
    if (name === "data-description") this.#syncDescription();
  }

  /* ── Private sync ────────────────────────────────────────────── */

  #syncTitle() {
    if (this.#titleEl) this.#titleEl.textContent = this.dataset.title || "";
  }

  #syncDescription() {
    if (this.#descriptionEl)
      this.#descriptionEl.textContent = this.dataset.description || "";
  }

  #onMenuOpen = () => {
    this.dataset.menuOpen = "true";
  };

  #onMenuClose = () => {
    delete this.dataset.menuOpen;
  };

  /* ── Filter menu ───────────────────────────────────────────── */

  #onToggleFilters = () => {
    this.toggleAttribute("data-filters");
  };
}

customElements.define("sherpa-data-viz-container", SherpaDataVizContainer);
