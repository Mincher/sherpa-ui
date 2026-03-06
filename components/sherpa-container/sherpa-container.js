/**
 * SherpaContainer — Dashboard card with header and content area.
 *
 * Extends SherpaElement. Shadow DOM contains only named slots and cloning
 * prototypes. All visible content lives in light DOM and is projected
 * through the slots. Styling is entirely via the light-DOM stylesheet
 * (sherpa-container.css); no shadow CSS is used.
 *
 * Content is supplied via inline child elements. The container is
 * content-agnostic — it never imports or creates viz components directly.
 * Viz children auto-load their own data via ContentAttributesMixin and
 * seed global filters from the shared global-filters utility.
 *
 * Architecture — decoupled peer events:
 *   Container owns layout and menu wiring only. All data concerns are
 *   handled by the content components themselves:
 *     vizready             — viz child → filter bar (columns/rows)
 *     containerfilterchange — filter bar → viz children (scoped)
 *     globalfilterchange   — document → viz children (direct)
 *     sortchange            — viz child → filter bar (sort chip sync)
 *     presentationchange   — viz child → sherpa-data-viz (view switch)
 *
 *   Menu template loading is handled by sherpa-button via data-menu-template.
 *   Menu items use data-event for auto-dispatched domain events.
 *   Container listens for those events to handle resize and section toggles.
 *
 * Templates (sherpa-container.html):
 *   shadow        — Shadow DOM: named slots + cloning prototypes
 *   default       — Light-DOM layout: header + filter bar + content wrapper
 *
 * Attributes:
 *   data-variant      — Layout variant: "fit" (default), "resizable", "fill"
 *   data-title        — Container heading text
 *   data-description  — Container description
 *   data-template     — Layout template id from sherpa-container.html
 *   data-col-span     — Column span (3, 6, 9, 12) — resizable variant only
 *   data-row-span     — Row span (1–6) — resizable variant only
 *   data-menu-open    — Menu state
 *   data-editable     — Edit mode (enables CSS resize grip)
 *
 * Slots (shadow DOM):
 *   header   — sherpa-header element
 *   filters  — sherpa-filter-bar element
 *   content  — .content wrapper div (metrics + viz children)
 *   extra    — Additional consumer content
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

  /** Use the shadow template for the shadow root (layout templates are light-DOM). */
  get templateId() {
    return "shadow";
  }

  #initialized = false;
  #menuContributions = [];

  /* ── SherpaElement lifecycle hooks ───────────────────────────── */

  onRender() {
    if (!this.dataset.variant) this.dataset.variant = "fit";
  }

  onConnect() {
    if (!this.#initialized) this.#initialize();
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

  /** Valid column span stops. */
  static COL_STOPS = [3, 6, 9, 12];
  static MIN_ROW_SPAN = 1;
  static MAX_ROW_SPAN = 6;

  /* ════════════════════════════════════════════════════════════════
     Initialisation
     ════════════════════════════════════════════════════════════════ */

  #initialize() {
    if (this.#initialized) return;

    // Collect inline viz children before stamping the layout template
    const metrics = [...this.querySelectorAll(":scope > sherpa-metric")];
    const vizChildren = [
      ...this.querySelectorAll(
        ":scope > :is(sherpa-data-viz, sherpa-barchart, sherpa-data-grid)",
      ),
    ];
    metrics.forEach((m) => m.remove());
    vizChildren.forEach((s) => s.remove());
    const title = this.dataset.title || "";
    const description = this.dataset.description || "";

    // Stamp the layout template (creates header + .content wrapper)
    const id = this.dataset.template || "default";
    const layoutHtml = this.getTemplateHtml(id);
    const temp = document.createElement("div");
    temp.innerHTML = layoutHtml;
    while (temp.firstChild) this.appendChild(temp.firstChild);

    // Populate .content wrapper: metrics first, then viz children
    const contentDiv = this.querySelector(".content");

    if (contentDiv) {
      metrics.forEach((m) => contentDiv.appendChild(m));

      // Wrap bare viz children in sherpa-data-viz for presentation switching
      vizChildren.forEach((s, i) => {
        let vizWrapper = s;
        if (s.tagName !== "SHERPA-DATA-VIZ") {
          vizWrapper = document.createElement("sherpa-data-viz");
          vizWrapper.appendChild(s);
        }
        vizWrapper.id = vizWrapper.id || `viz-${i}`;
        contentDiv.appendChild(vizWrapper);
      });
    }

    // Setup header
    const header = this.querySelector("sherpa-header");
    if (header) {
      header.heading = title;
      header.description = description;
    }

    this.#wireMenuEvents();

    this.#initialized = true;
  }

  /* ════════════════════════════════════════════════════════════════
     Menu
     ════════════════════════════════════════════════════════════════ */

  /**
   * Set data-menu-template on the header so the button stamps the container
   * menu template, and wire up domain event listeners + menu-populate for
   * dynamic items.
   */
  #wireMenuEvents() {
    const header = this.querySelector("sherpa-header");
    if (header) {
      header.menuTemplate = "container";
    }

    // Menu open/close — toggle state attribute
    this.addEventListener("menu-open", () => {
      this.dataset.menuOpen = "true";
    });
    this.addEventListener("menu-close", () => {
      this.dataset.menuOpen = "false";
    });

    // Collect viz-child menu contributions (dispatched via menu-contribute)
    this.addEventListener("menu-contribute", (e) => {
      this.#menuContributions.push(e.detail);
    });

    // Dynamic menu content — stamp viz-child contributions
    this.addEventListener("menu-populate", (e) => {
      this.#onMenuPopulate(e.detail.menu);
    });

    // The containerexport event is auto-dispatched by the menu item via
    // data-event and bubbles up through the container to the app.
    // App code can use e.target.closest('sherpa-container') to get the
    // container reference. No interception needed here.

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

    // Viz-child toggle via menu-select (toggle items don't use data-event)
    this.addEventListener("menu-select", (e) => {
      const detail = e.detail ?? {};
      if (detail.action === "toggle-metrics") {
        this.toggleAttribute("data-hide-metrics", !detail.checked);
      } else if (detail.selection === "toggle" && detail.data?.target) {
        const target = this.querySelector(`#${CSS.escape(detail.data.target)}`);
        if (target) target.toggleAttribute("hidden", !detail.checked);
      }
    });
  }

  /**
   * Stamp viz-child menu contributions into the data group.
   * Contributions are collected from `menu-contribute` events dispatched
   * by sherpa-data-viz children on connect.
   */
  #onMenuPopulate(menu) {
    const dataGroup = menu.querySelector('ul[data-group="data"]');
    const dataHeading = menu.querySelector('[data-group-heading="data"]');

    if (!dataGroup) return;

    // Sync metrics toggle: remove if no metrics, else reflect current state
    const metricsToggle = dataGroup.querySelector(
      '[data-action="toggle-metrics"]',
    );
    if (metricsToggle) {
      const hasMetrics = !!this.querySelector("sherpa-metric");
      if (!hasMetrics) {
        metricsToggle.closest("li")?.remove();
      } else {
        metricsToggle.toggleAttribute(
          "checked",
          !this.hasAttribute("data-hide-metrics"),
        );
      }
    }

    // Stamp viz-child contributions
    const toggleTpl = this.$("template.menu-toggle-tpl");
    this.#menuContributions.forEach((c) => {
      const frag = toggleTpl.content.cloneNode(true);
      const item = frag.querySelector("sherpa-menu-item");
      item.dataset.target = c.target;
      item.textContent = c.label;
      // Reflect current visibility
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
