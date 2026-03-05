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
 *   Menu template loading is handled by sherpa-button via data-menu-src.
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
 *   content  — .content wrapper div (metrics + sections)
 *   extra    — Additional consumer content
 *
 * Cloning prototypes (shadow DOM):
 *   .section-tpl      — div.section > div.section-content
 *   .menu-toggle-tpl  — li > sherpa-menu-item[data-selection="toggle"]
 */

import "../sherpa-header/sherpa-header.js";
import "../sherpa-filter-bar/sherpa-filter-bar.js";
import "../sherpa-filter-chip/sherpa-filter-chip.js";
import "../sherpa-data-viz/sherpa-data-viz.js";
import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";

/* ── Menu template URL (resolved once at module load) ──────────── */

const MENU_SRC = new URL("./sherpa-container-menu.html", import.meta.url).href;

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
