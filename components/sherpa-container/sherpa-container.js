/**
 * SherpaContainer — Dashboard card with header, metrics, and content area.
 *
 * Extends SherpaElement with full shadow DOM encapsulation. The shadow
 * template defines all structural elements: header, filter bar, 4 fixed
 * metrics, and a default slot for consumer viz children.
 *
 * Content is supplied via inline child elements slotted into the default
 * slot. The container is content-agnostic — it never imports or creates
 * viz components directly. Viz children auto-load their own data via
 * ContentAttributesMixin and seed global filters from the shared
 * global-filters utility.
 *
 * Metrics are fixed in the shadow template and self-populate via
 * ContentAttributesMixin. The container only controls their visibility
 * based on data-col-span (CSS-driven, no JS needed).
 *
 * Architecture — decoupled peer events:
 *   Container owns layout and menu wiring only. All data concerns are
 *   handled by the content components themselves:
 *     vizready             — viz child → filter bar (columns/rows)
 *     containerfilterchange — filter bar → viz children (scoped)
 *     globalfilterchange   — document → viz children (direct)
 *     sortchange           — viz child → filter bar (sort chip sync)
 *     presentationchange   — viz child → sherpa-data-viz (view switch)
 *
 *   Menu template loading is handled by sherpa-button via data-menu-template.
 *   Menu items use data-event for auto-dispatched domain events.
 *   Container listens for those events to handle resize and section toggles.
 *
 * Attributes:
 *   data-variant      — Layout variant: "fit" (default), "resizable", "fill"
 *   data-title        — Container heading text
 *   data-description  — Container description
 *   data-col-span     — Column span (3, 6, 9, 12) — resizable variant only
 *   data-row-span     — Row span (1–6) — resizable variant only
 *   data-menu-open    — Menu state
 *   data-editable     — Edit mode (enables CSS resize grip)
 *
 * Slots (shadow DOM):
 *   (default) — Consumer viz children (sherpa-data-viz wrappers)
 *
 * Cloning prototypes (shadow DOM):
 *   .menu-toggle-tpl  — li > sherpa-menu-item[data-selection="toggle"]
 */

import "../sherpa-header/sherpa-header.js";
import "../sherpa-filter-bar/sherpa-filter-bar.js";
import "../sherpa-filter-chip/sherpa-filter-chip.js";
import "../sherpa-data-viz/sherpa-data-viz.js";
import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";

/* ── Component ─────────────────────────────────────────────────── */

export class SherpaContainer extends SherpaElement {
  static get htmlUrl() {
    return new URL("./sherpa-container.html", import.meta.url).href;
  }

  static get cssUrl() {
    return new URL("./sherpa-container.css", import.meta.url).href;
  }

  #menuContributions = [];
  #resizeObserver = null;
  #resizeDebounce = null;

  /* ── SherpaElement lifecycle hooks ───────────────────────────── */

  onRender() {
    if (!this.dataset.variant) this.dataset.variant = "fit";

    // Set header text from host attributes
    const header = this.$("sherpa-header");
    if (header) {
      header.heading = this.dataset.title || "";
      header.description = this.dataset.description || "";
    }
  }

  onConnect() {
    this.#wireMenuEvents();

    if (this.dataset.variant === "resizable") {
      this.#startResizeObserver();
    }
  }

  onDisconnect() {
    super.onDisconnect();
    this.#stopResizeObserver();
  }

  onAttributeChanged(name, _oldValue, newValue) {
    if (name === "data-title") {
      const header = this.$("sherpa-header");
      if (header) header.heading = newValue || "";
    } else if (name === "data-description") {
      const header = this.$("sherpa-header");
      if (header) header.description = newValue || "";
    }
  }

  static get observedAttributes() {
    return [...super.observedAttributes, "data-title", "data-description"];
  }

  /* ════════════════════════════════════════════════════════════════
     Public API
     ════════════════════════════════════════════════════════════════ */

  /** Column span (3 | 6 | 9 | 12). */
  getColSpan() {
    return parseInt(this.getAttribute("data-col-span") || "3", 10);
  }

  /** Row span (1–6). */
  getRowSpan() {
    return parseInt(this.getAttribute("data-row-span") || "1", 10);
  }

  /* ════════════════════════════════════════════════════════════════
     Grid span constants (used by menu-based resize actions)
     ════════════════════════════════════════════════════════════════ */

  static COL_STOPS = [3, 6, 9, 12];
  static MIN_ROW_SPAN = 1;
  static MAX_ROW_SPAN = 6;

  /* ════════════════════════════════════════════════════════════════
     Resize — snap-to-grid (edit mode)
     ════════════════════════════════════════════════════════════════ */

  #startResizeObserver() {
    if (this.#resizeObserver) return;
    this.#resizeObserver = new ResizeObserver(() => {
      if (!this.hasAttribute("data-editable")) return;
      clearTimeout(this.#resizeDebounce);
      this.#resizeDebounce = setTimeout(() => this.#snapToGrid(), 250);
    });
    this.#resizeObserver.observe(this);
  }

  #stopResizeObserver() {
    this.#resizeObserver?.disconnect();
    this.#resizeObserver = null;
    clearTimeout(this.#resizeDebounce);
  }

  #snapToGrid() {
    const parent = this.parentElement;
    if (!parent) return;

    const parentWidth = parent.clientWidth;
    if (!parentWidth) return;

    const colWidth = parentWidth / 12;
    const rawCols = this.offsetWidth / colWidth;
    const stops = SherpaContainer.COL_STOPS;
    const bestCol = stops.reduce((prev, stop) =>
      Math.abs(rawCols - stop) < Math.abs(rawCols - prev) ? stop : prev,
    );

    if (bestCol !== this.getColSpan()) {
      this.setAttribute("data-col-span", String(bestCol));
    }

    this.style.removeProperty("width");
    this.style.removeProperty("height");
  }

  /* ════════════════════════════════════════════════════════════════
     Menu
     ════════════════════════════════════════════════════════════════ */

  #wireMenuEvents() {
    const header = this.$("sherpa-header");
    if (header) {
      header.menuTemplate = "container";
    }

    this.addEventListener("menu-open", () => {
      this.dataset.menuOpen = "true";
    });
    this.addEventListener("menu-close", () => {
      this.dataset.menuOpen = "false";
    });

    this.addEventListener("menu-contribute", (e) => {
      this.#menuContributions.push(e.detail);
    });

    this.addEventListener("menu-populate", (e) => {
      this.#onMenuPopulate(e.detail.menu);
    });

    this.addEventListener("container-increase-cols", () => {
      const stops = SherpaContainer.COL_STOPS;
      const idx = stops.indexOf(this.getColSpan());
      const next = stops[Math.min(idx + 1, stops.length - 1)];
      if (next !== this.getColSpan())
        this.setAttribute("data-col-span", String(next));
    });

    this.addEventListener("container-decrease-cols", () => {
      const stops = SherpaContainer.COL_STOPS;
      const idx = stops.indexOf(this.getColSpan());
      const next = stops[Math.max(idx - 1, 0)];
      if (next !== this.getColSpan())
        this.setAttribute("data-col-span", String(next));
    });

    this.addEventListener("container-increase-rows", () => {
      const next = Math.min(
        SherpaContainer.MAX_ROW_SPAN,
        this.getRowSpan() + 1,
      );
      if (next !== this.getRowSpan())
        this.setAttribute("data-row-span", String(next));
    });

    this.addEventListener("container-decrease-rows", () => {
      const next = Math.max(
        SherpaContainer.MIN_ROW_SPAN,
        this.getRowSpan() - 1,
      );
      if (next !== this.getRowSpan())
        this.setAttribute("data-row-span", String(next));
    });

    this.addEventListener("menu-select", (e) => {
      const detail = e.detail ?? {};
      if (detail.selection === "toggle" && detail.data?.target) {
        const target = this.querySelector(`#${CSS.escape(detail.data.target)}`);
        if (target) target.toggleAttribute("hidden", !detail.checked);
      }
    });
  }

  #onMenuPopulate(menu) {
    const dataGroup = menu.querySelector('ul[data-group="data"]');
    const dataHeading = menu.querySelector('[data-group-heading="data"]');

    if (!dataGroup) return;

    // Stamp viz-child contributions
    const toggleTpl = this.$("template.menu-toggle-tpl");
    this.#menuContributions.forEach((c) => {
      const frag = toggleTpl.content.cloneNode(true);
      const item = frag.querySelector("sherpa-menu-item");
      item.dataset.target = c.target;
      item.textContent = c.label;
      const el = this.querySelector(`#${CSS.escape(c.target)}`);
      if (el && !el.hasAttribute("hidden")) item.setAttribute("checked", "");
      dataGroup.appendChild(frag);
    });

    // Remove data group entirely if empty
    if (!dataGroup.children.length) {
      dataGroup.remove();
      dataHeading?.remove();
    }
  }
}

customElements.define("sherpa-container", SherpaContainer);
