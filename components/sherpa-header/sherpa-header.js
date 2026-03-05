/**
 * sherpa-header.js
 * SherpaHeader — Reusable header component with three template variants.
 *
 * Uses SherpaElement multi-template support to select the appropriate header
 * layout based on the `type` attribute.
 *
 * Templates:
 *   default   — Generic header for containers, dialogs, sections.
 *               The type attribute value drives CSS overrides for variant-
 *               specific styling (e.g. type="dialog" for larger title).
 *   menu      — Popover / dropdown menu header with search support.
 *   data-viz  — Compact data-visualization header (chart, table).
 *
 * Usage:
 *   <!-- Default header (container style) -->
 *   <sherpa-header type="container" heading="Revenue" description="Updated today">
 *     <sherpa-button slot="actions" type="icon" variant="tertiary" size="small"
 *       icon-start="fa-ellipsis-vertical"></sherpa-button>
 *   </sherpa-header>
 *
 *   <!-- Default header (dialog style) -->
 *   <sherpa-header type="dialog" heading="Confirm action" dismissible>
 *   </sherpa-header>
 *
 *   <!-- Default header (section style) -->
 *   <sherpa-header heading="Overview" heading-type="secondary" divider>
 *     <sherpa-tag slot="badge" variant="info">New</sherpa-tag>
 *     <sherpa-button slot="actions" variant="tertiary" size="small">View all</sherpa-button>
 *   </sherpa-header>
 *
 *   <!-- Menu header -->
 *   <sherpa-header type="menu" heading="Settings" description="Configure options"
 *     close-button search></sherpa-header>
 *
 *   <!-- Data-viz header -->
 *   <sherpa-header type="data-viz" heading="Monthly Spend">
 *     <sherpa-filter-chip slot="filters" type="segment">Segment</sherpa-filter-chip>
 *     <sherpa-button slot="actions" type="icon" variant="tertiary" size="small"
 *       icon-start="fa-ellipsis-vertical"></sherpa-button>
 *   </sherpa-header>
 *
 * Attributes:
 *   data-type               — Template / style variant: container | dialog |
 *                              section | menu | data-viz  (default → "default")
 *   data-label              — Title / heading text
 *   data-description        — Subtitle / description text
 *   data-heading-level      — Heading importance: primary | secondary | tertiary
 *   data-divider            — "true" | "false" — show bottom divider
 *   data-drag-handle        — "true" | "false" — show drag handle
 *   data-close-button       — "true" | "false" — show close button
 *   data-close-label        — Accessible label for close button
 *   data-search             — "true" | "false" — show search field (menu template)
 *   data-search-placeholder — Search field placeholder text
 *   data-density            — compact | comfortable
 *   data-dismissible        — "true" | "false" — close button visible (dialog type)
 *   data-open-external      — "true" | "false" — show open-external button
 *   data-menu-button        — "true" | "false" — show menu button
 *
 * Events:
 *   header-close  — Fired when close button is clicked
 *   header-search — Fired when search field value changes (detail: { query })
 *
 * Slots:
 *   heading     — Custom heading content (replaces default title)
 *   description — Custom description content (replaces default text)
 *   actions     — Action buttons (default, data-viz)
 *   badge       — Badge beside heading (default)
 *   filters     — Filter chips (data-viz)
 *   search      — Custom search element (menu)
 *   extra       — Extra content below search (menu)
 */

import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";

/**
 * Maps the `type` attribute value to a template id.
 * container / dialog / section all share the `default` template,
 * with type-specific CSS overrides applied via :host([type="…"]).
 */
const TEMPLATE_MAP = {
  container: "default",
  dialog: "default",
  section: "default",
  card: "default",
  menu: "menu",
  "data-viz": "data-viz",
};

export class SherpaHeader extends SherpaElement {
  /* ── Config ───────────────────────────────────────────────────── */

  static get cssUrl() {
    return new URL("./sherpa-header.css", import.meta.url).href;
  }
  static get htmlUrl() {
    return new URL("./sherpa-header.html", import.meta.url).href;
  }

  static get observedAttributes() {
    return [
      "data-type",
      "data-label",
      "data-description",
      "data-heading-level",
      "data-divider",
      "data-density",
      "data-drag-handle",
      "data-close-button",
      "data-close-label",
      "data-search",
      "data-search-placeholder",
      "data-dismissible",
      "data-open-external",
      "data-menu-button",
    ];
  }

  /* ── Template selection ───────────────────────────────────────── */

  get templateId() {
    const type = this.dataset.type;
    return TEMPLATE_MAP[type] || "default";
  }

  /* ── Lifecycle hooks ──────────────────────────────────────────── */

  onRender() {
    this.#syncHeading();
    this.#syncDescription();
    this.#syncCloseButton();
    this.#syncOpenExternal();
    this.#syncMenuButton();
    this.#syncSearch();
    this.#wireEvents();
  }

  onAttributeChanged(name) {
    switch (name) {
      case "data-label":
        this.#syncHeading();
        break;
      case "data-description":
        this.#syncDescription();
        break;
      case "data-close-button":
      case "data-close-label":
      case "data-dismissible":
        this.#syncCloseButton();
        break;
      case "data-search":
      case "data-search-placeholder":
        this.#syncSearch();
        break;
      case "data-open-external":
        this.#syncOpenExternal();
        break;
      case "data-menu-button":
        this.#syncMenuButton();
        break;
    }
  }

  /**
   * Slot change handler — delegates to SherpaElement for data-has-* toggling.
   * CSS rule :host([data-has-heading]) .header-title { display: none } handles
   * hiding the default title when custom heading content is slotted.
   */
  onSlotChange(slotEl) {
    super.onSlotChange(slotEl);
  }

  /* ── Public API ───────────────────────────────────────────────── */

  get type() {
    return this.dataset.type || "default";
  }
  set type(v) {
    this.dataset.type = v;
  }

  get heading() {
    return this.dataset.label || "";
  }
  set heading(v) {
    if (v) {
      this.dataset.label = v;
    } else {
      delete this.dataset.label;
    }
  }

  get description() {
    return this.dataset.description || "";
  }
  set description(v) {
    if (v) {
      this.dataset.description = v;
    } else {
      delete this.dataset.description;
    }
  }

  get headingType() {
    return this.dataset.headingLevel || "primary";
  }
  set headingType(v) {
    this.dataset.headingLevel = v;
  }

  get hasDivider() {
    return this.dataset.divider === "true";
  }
  set hasDivider(v) {
    this.dataset.divider = v ? "true" : "false";
  }

  get hasDragHandle() {
    return this.dataset.dragHandle === "true";
  }
  set hasDragHandle(v) {
    this.dataset.dragHandle = v ? "true" : "false";
  }

  get hasCloseButton() {
    return this.dataset.closeButton === "true";
  }
  set hasCloseButton(v) {
    this.dataset.closeButton = v ? "true" : "false";
  }

  get closeLabel() {
    return this.dataset.closeLabel || "Close";
  }
  set closeLabel(v) {
    if (v) {
      this.dataset.closeLabel = v;
    } else {
      delete this.dataset.closeLabel;
    }
  }

  get hasSearch() {
    return this.dataset.search === "true";
  }
  set hasSearch(v) {
    this.dataset.search = v ? "true" : "false";
  }

  get searchPlaceholder() {
    return this.dataset.searchPlaceholder || "Search";
  }
  set searchPlaceholder(v) {
    if (v) {
      this.dataset.searchPlaceholder = v;
    } else {
      delete this.dataset.searchPlaceholder;
    }
  }

  get dismissible() {
    return this.dataset.dismissible !== "false";
  }
  set dismissible(v) {
    this.dataset.dismissible = v ? "true" : "false";
  }

  get hasOpenExternal() {
    return this.dataset.openExternal === "true";
  }
  set hasOpenExternal(v) {
    this.dataset.openExternal = v ? "true" : "false";
  }

  get hasMenuButton() {
    return this.dataset.menuButton === "true";
  }
  set hasMenuButton(v) {
    this.dataset.menuButton = v ? "true" : "false";
  }

  /** Returns the drag handle element (default template only) */
  get dragHandleElement() {
    return this.$(".drag-handle");
  }

  /** Returns the open-external button element (default template only) */
  get openExternalElement() {
    return this.$(".open-external-button");
  }

  /** Returns the menu button element (default template only) */
  get menuButtonElement() {
    return this.$(".menu-button");
  }

  /** Returns the search field element (menu template only) */
  get searchField() {
    return (
      this.$(".search-field") ||
      this.$('slot[name="search"]')?.assignedElements()[0]
    );
  }

  /* ── Private ──────────────────────────────────────────────────── */

  #syncHeading() {
    const el = this.$(".header-title");
    if (el) el.textContent = this.heading;
  }

  #syncDescription() {
    const el = this.$(".header-description");
    if (el) el.textContent = this.description;
  }

  #syncCloseButton() {
    const btn = this.$(".close-button");
    if (!btn) return;

    // Visibility is handled entirely by CSS:
    //   :host([data-close-button="true"]) .close-button { display: inline-flex; }
    //   :host([data-type="dialog"]) .close-button { display: inline-flex; }
    //   :host([data-type="dialog"][data-dismissible="false"]) .close-button { display: none; }

    const label = this.closeLabel;
    btn.setAttribute("aria-label", label);
    btn.setAttribute("data-tooltip", label);
  }

  #syncOpenExternal() {
    // Visibility handled by CSS:
    //   :host([data-open-external="true"]) .open-external-button { display: inline-flex; }
  }

  #syncMenuButton() {
    // Visibility handled by CSS:
    //   :host([data-menu-button="true"]) .menu-button { display: inline-flex; }
  }

  #syncSearch() {
    // Visibility handled by CSS:
    //   :host([data-search="true"]) .search-row { display: flex; }

    const field = this.$(".search-field");
    if (field && this.hasSearch) {
      field.setAttribute("placeholder", this.searchPlaceholder);
    }
  }

  #wireEvents() {
    // Close button
    const closeBtn = this.$(".close-button");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        this.dispatchEvent(
          new CustomEvent("header-close", { bubbles: true, composed: true }),
        );
      });
    }

    // Search field input
    const searchField = this.$(".search-field");
    if (searchField) {
      searchField.addEventListener("input", (e) => {
        this.dispatchEvent(
          new CustomEvent("header-search", {
            bubbles: true,
            composed: true,
            detail: { query: e.detail?.value ?? searchField.value },
          }),
        );
      });

      searchField.addEventListener("search", (e) => {
        if (!e.detail?.value) {
          this.dispatchEvent(
            new CustomEvent("header-search", {
              bubbles: true,
              composed: true,
              detail: { query: "" },
            }),
          );
        }
      });
    }
  }
}

customElements.define("sherpa-header", SherpaHeader);
