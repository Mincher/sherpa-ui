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
 *
 * Architecture — decoupled peer events:
 *   Container owns layout. Menu template loading is handled by
 *   sherpa-button via data-menu-src. Menu items use data-event for
 *   auto-dispatched domain events. Container listens for those events
 *   on itself to handle resize, export, and section toggles.
 *
 *   Data filtering, column wiring, and presentation switching are handled
 *   by viz children, sherpa-filter-bar, and sherpa-data-viz via peer events:
 *     vizready             — viz child → filter bar (columns/rows)
 *     containerfilterchange — filter bar → container → viz children
 *     globalfilterchange   — document → viz children (direct)
 *     sortchange            — viz child → filter bar (sort chip sync)
 *     presentationchange   — viz child → sherpa-data-viz (view switch)
 *
 * Templates (sherpa-container.html):
 *   shadow        — Shadow DOM: named slots + cloning prototypes
 *   default       — Light-DOM layout: header + filter bar + content wrapper
 *
 * Menu (sherpa-container-menu.html):
 *   Loaded by sherpa-button via data-menu-src. Container listens for
 *   menu-populate to inject dynamic section toggles, and for named
 *   domain events (containerexport, container-increase-cols, etc.).
 *
 * Attributes:
 *   data-variant      — Layout variant: "fit" (default, hugs content),
 *                        "resizable" (grid-driven spans), "fill" (fills parent)
 *   data-title        — Container heading text
 *   description       — Container description
 *   template          — Layout template id from sherpa-container.html
 *   data-col-span     — Column span (3, 6, 9, 12) — resizable variant only
 *   data-row-span     — Row span (1–6) — resizable variant only
 *   data-menu-open    — Menu state
 *   data-editable     — Edit mode (enables CSS resize grip, resizable variant only)
 *
 * Slots (shadow DOM):
 *   header   — sherpa-header element
 *   filters  — sherpa-filter-bar element
 *   content  — .content wrapper div (metrics + sections)
 *   extra    — Additional consumer content
 *
 * Cloning prototypes (shadow DOM):
 *   .section-tpl      — div.section > div.section-content
 *   .menu-toggle-tpl  — li > sherpa-menu-item[data-selection="toggle"]
 *
 * Events (bubbles: true, composed: true):
 *   containerexport        — Export action triggered
 */

import "../sherpa-header/sherpa-header.js";
import "../sherpa-filter-bar/sherpa-filter-bar.js";
import "../sherpa-filter-chip/sherpa-filter-chip.js";
import "../sherpa-data-viz/sherpa-data-viz.js";
import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";

/* ── Menu template URL (resolved once at module load) ──────────── */

const MENU_SRC = new URL("./sherpa-container-menu.html", import.meta.url).href;

/* ── Component ─────────────────────────────────────────────────── */

/** Number of containers that load eagerly per navigation. */
const EAGER_LIMIT = 4;
let eagerUsed = 0;

/** Shared IntersectionObserver — created lazily. */
let sharedObserver = null;
const observedContainers = new WeakMap();

function getSharedObserver() {
  if (!sharedObserver) {
    sharedObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const container = entry.target;
            sharedObserver.unobserve(container);
            observedContainers.delete(container);
            container._triggerInitialize();
          }
        }
      },
      { rootMargin: "200px" },
    );
  }
  return sharedObserver;
}

export class SherpaContainer extends SherpaElement {
  static get htmlUrl() {
    return new URL("./sherpa-container.html", import.meta.url).href;
  }

  /** Use the shadow template for the shadow root (layout templates are light-DOM). */
  get templateId() {
    return "shadow";
  }

  #initialized = false;

  // ── Pluggable providers (injected by the host app at boot) ──
  static #globalFilterProvider = null;

  /**
   * Register a provider that returns current global filter state.
   * Signature: () => { filters: Array, timerange: Object|null }
   * @param {Function} fn
   */
  static setGlobalFilterProvider(fn) {
    SherpaContainer.#globalFilterProvider = fn;
  }

  /** Reset the eager counter (call before injecting a new view). */
  static resetEagerCount() {
    eagerUsed = 0;
  }

  /* ── SherpaElement lifecycle hooks ───────────────────────────── */

  onRender() {
    if (!this.dataset.variant) this.dataset.variant = "fit";
  }

  onConnect() {
    if (this.#initialized) return;

    if (eagerUsed < EAGER_LIMIT) {
      // First N containers load immediately (above the fold)
      eagerUsed++;
      this.#initialize();
    } else {
      // Deferred containers: wait for visibility
      const observer = getSharedObserver();
      observer.observe(this);
      observedContainers.set(this, true);
    }
  }

  onDisconnect() {
    // Stop observing if still deferred
    if (observedContainers.has(this)) {
      getSharedObserver().unobserve(this);
      observedContainers.delete(this);
    }
  }

  /** Called by the IntersectionObserver when this container scrolls into view. */
  _triggerInitialize() {
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

  async #initialize() {
    if (this.#initialized) return;

    // Collect inline viz children before stamping the layout template
    const metrics = [...this.querySelectorAll(":scope > sherpa-metric")];
    const sections = [
      ...this.querySelectorAll(
        ":scope > :is(sherpa-data-viz, sherpa-base-table, sherpa-barchart, sherpa-data-grid)",
      ),
    ];
    metrics.forEach((m) => m.remove());
    sections.forEach((s) => s.remove());
    const title = this.dataset.title || "";
    const description = this.dataset.description || "";

    // Stamp the layout template (creates header + .content wrapper)
    const id = this.dataset.template || "default";
    const layoutHtml = this.getTemplateHtml(id);
    const temp = document.createElement("div");
    temp.innerHTML = layoutHtml;
    while (temp.firstChild) this.appendChild(temp.firstChild);

    // Populate .content wrapper: metrics first, then .sections div
    const contentDiv = this.querySelector(".content");

    if (contentDiv) {
      // Metrics go directly into .content
      metrics.forEach((m) => contentDiv.appendChild(m));

      // Sections go into a .sections wrapper inside .content
      if (sections.length) {
        const sectionsDiv = document.createElement("div");
        sectionsDiv.className = "sections";

        const sectionTpl = this.$("template.section-tpl");
        if (sectionTpl) {
          sections.forEach((s, i) => {
            const frag = sectionTpl.content.cloneNode(true);
            const wrapper = frag.querySelector(".section");
            wrapper.id = `section-${i}`;

            // Wrap bare viz children in sherpa-data-viz for presentation switching
            let vizWrapper = s;
            if (s.tagName !== "SHERPA-DATA-VIZ") {
              vizWrapper = document.createElement("sherpa-data-viz");
              vizWrapper.appendChild(s);
            }

            frag.querySelector(".section-content").appendChild(vizWrapper);
            sectionsDiv.appendChild(frag);
          });
        }

        contentDiv.appendChild(sectionsDiv);
      }
    }

    // Setup header
    const header = this.querySelector("sherpa-header");
    if (header) {
      header.heading = title;
      header.description = description;
    }

    this.#wireMenuEvents();

    this.#initialized = true;

    // ── Global filter seeding (read BEFORE initial load) ─────
    // Viz children handle ongoing globalfilterchange events themselves,
    // but the first load must be seeded with current global state.
    const initialFilters = [];
    const globalState = SherpaContainer.#globalFilterProvider
      ? SherpaContainer.#globalFilterProvider()
      : { filters: [], timerange: null };
    for (const gf of globalState.filters || []) {
      if (gf.values?.length) {
        initialFilters.push({
          field: gf.field,
          operator: "in",
          values: gf.values,
        });
      }
    }
    if (globalState.timerange) {
      initialFilters.push({ type: "timerange", ...globalState.timerange });
    }

    // Trigger each viz child to load its own data (with pre-seeded filters)
    await Promise.all(
      [...metrics, ...sections].map((el) => {
        if (typeof el.load === "function") return el.load(initialFilters);
      }),
    );
  }

  /* ════════════════════════════════════════════════════════════════
     Menu
     ════════════════════════════════════════════════════════════════ */

  /**
   * Set data-menu-src on the header so the button loads the menu template,
   * and wire up domain event listeners + menu-populate for dynamic items.
   */
  #wireMenuEvents() {
    const header = this.querySelector("sherpa-header");
    if (header) {
      header.menuSrc = MENU_SRC;
    }

    // Menu open/close — toggle state attribute
    this.addEventListener("menu-open", () => {
      this.dataset.menuOpen = "true";
    });
    this.addEventListener("menu-close", () => {
      this.dataset.menuOpen = "false";
    });

    // Dynamic menu content — inject section toggles, strip resize groups
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

    // Section toggle via menu-select (toggle items don't use data-event)
    this.addEventListener("menu-select", (e) => {
      const detail = e.detail ?? {};
      if (detail.selection === "toggle" && detail.data?.target) {
        const targetId = detail.data.target;
        const isVisible = Boolean(detail.checked);
        if (!isVisible) {
          const visible = this.#buildSectionToggles().filter(
            (t) => t.checked,
          ).length;
          if (visible <= 1) return;
        }
        const section = this.querySelector(`.section#${CSS.escape(targetId)}`);
        if (section) section.toggleAttribute("hidden", !isVisible);
      }
    });
  }

  /** Modify the menu content before it’s shown (called via menu-populate). */
  #onMenuPopulate(menu) {
    if (!menu) return;

    // Strip resize groups when not in edit mode
    if (!this.hasAttribute("data-editable")) {
      menu
        .querySelectorAll('[data-group="width"], [data-group="height"]')
        .forEach((el) => el.remove());
      menu
        .querySelectorAll('sherpa-menu-item[data-type="heading"]')
        .forEach((el) => {
          const text = el.textContent.trim();
          if (text === "Width" || text === "Height") el.remove();
        });
    }

    // Build section toggle items for the data group
    const dataGroup = menu.querySelector('ul[data-group="data"]');
    const dataHeading = menu.querySelector('[data-group-heading="data"]');
    const toggles = this.#buildSectionToggles();

    if (dataGroup) {
      if (toggles.length) {
        const toggleTpl = this.$("template.menu-toggle-tpl");
        toggles.forEach((t) => {
          const frag = toggleTpl.content.cloneNode(true);
          const item = frag.querySelector("sherpa-menu-item");
          item.dataset.target = t.target;
          if (t.checked) item.setAttribute("checked", "");
          item.textContent = t.label;
          dataGroup.appendChild(frag);
        });
      } else {
        dataGroup.remove();
        dataHeading?.remove();
      }
    }
  }
  #buildSectionToggles() {
    const sectionEls = this.querySelectorAll(".content > .sections > .section");
    return Array.from(sectionEls).map((sectionEl) => {
      const vizEl = sectionEl.querySelector(
        ".section-content > :is(sherpa-base-table, sherpa-barchart, sherpa-metric)",
      );
      const label = vizEl?.getAttribute("data-label") || sectionEl.id;
      return {
        label,
        target: sectionEl.id,
        checked: !sectionEl.hasAttribute("hidden"),
      };
    });
  }
}

customElements.define("sherpa-container", SherpaContainer);
