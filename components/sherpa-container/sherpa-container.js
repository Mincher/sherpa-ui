/**
 * SherpaContainer — Dashboard card with header, metrics, and data sections.
 *
 * Extends SherpaElement. Shadow DOM contains only named slots, a resize
 * handle, and a skeleton placeholder. All visible content lives in light
 * DOM and is projected through the slots.
 *
 * Content is defined by a content template (data-content attribute) or by
 * inline child elements (fallback). Content templates live in
 * html/templates/content/<id>.html and use <slot presentation-type="...">
 * elements to declare which data-viz components to create.
 *
 * Templates (sherpa-container.html):
 *   shadow        — Shadow DOM: named slots + resize handle + skeleton
 *   default       — Light-DOM layout: header + filter bar + metrics + sections
 *   metrics-only  — Light-DOM layout: header + metrics only
 *
 * Attributes:
 *   data-content      — Content template id (fetches /html/templates/content/<id>.html)
 *   data-title        — Container heading text (overrides content template title)
 *   description       — Container description (overrides content template description)
 *   template          — Layout template id from sherpa-container.html
 *   data-col-span     — Column span (3, 6, 9, 12)
 *   data-row-span     — Row span (1–6)
 *   data-menu-open    — Menu state
 *   data-editable     — Edit mode (shows resize handles)
 *   data-loading      — Skeleton loading placeholder visible
 *
 * Slots (shadow DOM):
 *   header   — sherpa-header element
 *   filters  — sherpa-filter-bar element
 *   metrics  — .metrics wrapper div
 *   sections — .sections wrapper div
 *   extra    — Additional consumer content
 *
 * Cloning prototypes (shadow DOM):
 *   .section-tpl      — div.section > div.section-content
 *   .menu-toggle-tpl  — li > sherpa-menu-item[data-selection="toggle"]
 *
 * Events (bubbles: true, composed: true):
 *   containercolumnsready  — Columns and rows ready for global filter bar
 *   containerexport        — Export action triggered
 */

import "../sherpa-metric/sherpa-metric.js";
import "../sherpa-base-table/sherpa-base-table.js";
import "../sherpa-barchart/sherpa-barchart.js";
import "../sherpa-data-grid/sherpa-data-grid.js";
import "../sherpa-button/sherpa-button.js";
import "../sherpa-header/sherpa-header.js";
import "../sherpa-menu/sherpa-menu.js";
import "../sherpa-filter-bar/sherpa-filter-bar.js";
import "../sherpa-filter-chip/sherpa-filter-chip.js";
import {
  SherpaElement,
  parseTemplates,
} from "../utilities/sherpa-element/sherpa-element.js";
import { formatFieldName } from "../utilities/index.js";

/* ── Menu + content caches (shared across instances) ───────────── */

const MENU_TPL_URL = new URL("./sherpa-container-menu.html", import.meta.url)
  .href;

let menuTemplateMap = null;

/** Content template cache — keyed by content id, stores HTML strings. */
const contentTemplateCache = new Map();

/** Maps presentation-type attribute values to element tag + slot names. */
const PRESENTATION_MAP = {
  metric: { tag: "sherpa-metric", slot: "metric" },
  table: { tag: "sherpa-base-table", slot: "section" },
  barchart: { tag: "sherpa-barchart", slot: "section" },
  "data-grid": { tag: "sherpa-data-grid", slot: "section" },
};

async function loadMenuTemplate() {
  if (menuTemplateMap) return menuTemplateMap;
  try {
    const res = await fetch(MENU_TPL_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    menuTemplateMap = parseTemplates(html);
  } catch (e) {
    console.warn("[SherpaContainer] Failed to load menu template", e);
    menuTemplateMap = new Map();
  }
  return menuTemplateMap;
}

/**
 * Fetch and cache a content template HTML string by id.
 * @param {string} contentId — e.g. "regional-sales-overview"
 * @returns {Promise<string>} Raw HTML of the content template.
 */
async function loadContentTemplate(contentId) {
  if (contentTemplateCache.has(contentId))
    return contentTemplateCache.get(contentId);
  const url = `${SherpaContainer.contentBasePath}${contentId}.html`;
  const res = await fetch(url);
  if (!res.ok)
    throw new Error(
      `[SherpaContainer] Content template "${contentId}" not found (${res.status})`,
    );
  const html = await res.text();
  contentTemplateCache.set(contentId, html);
  return html;
}

/**
 * Parse a content template HTML string and return title, description,
 * and an array of materialized viz elements ready for reparenting.
 * @param {string} html — Raw HTML from a content template file.
 * @returns {{ title: string, description: string, metrics: HTMLElement[], sections: HTMLElement[] }}
 */
function materializeContent(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const title = doc.querySelector("title")?.textContent?.trim() || "";
  const description =
    doc.querySelector('meta[name="description"]')?.getAttribute("content") ||
    "";

  const metrics = [];
  const sections = [];

  for (const slot of doc.querySelectorAll("slot[data-presentation-type]")) {
    const type = slot.dataset.presentationType;
    const spec = PRESENTATION_MAP[type];
    if (!spec) {
      console.warn(`[SherpaContainer] Unknown presentation-type "${type}"`);
      continue;
    }
    const el = document.createElement(spec.tag);
    el.setAttribute("slot", spec.slot);

    // Copy all data-* attributes from the slot descriptor to the element
    for (const attr of slot.attributes) {
      if (attr.name.startsWith("data-")) {
        el.setAttribute(attr.name, attr.value);
      }
    }

    if (spec.slot === "metric") {
      metrics.push(el);
    } else {
      sections.push(el);
    }
  }

  return { title, description, metrics, sections };
}

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
  static get cssUrl() {
    return new URL("./sherpa-container-shadow.css", import.meta.url).href;
  }
  static get htmlUrl() {
    return new URL("./sherpa-container.html", import.meta.url).href;
  }

  /** Use the shadow template for the shadow root (layout templates are light-DOM). */
  get templateId() {
    return "shadow";
  }

  #initialized = false;
  #sectionConfigs = new Map();
  #metricConfigs = new Map();
  #resizeHandle = null; // cached in onRender
  #menuBtn = null;
  #filterBar = null; // Container-level filter bar element
  #globalFilters = [];
  #globalTimerange = null;
  #containerValueFilters = [];
  #containerSegmentField = null; // Track segment field for change detection
  #globalFilterHandler = null;
  #syncingSort = false; // Guard: suppress re-entrant filterchange during sort sync

  // ── Pluggable providers (injected by the host app at boot) ──
  static #globalFilterProvider = null;

  /** Base URL for content template fetches. Override in consumer apps. */
  static contentBasePath = "/html/templates/content/";

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
    this.#resizeHandle = this.$(".resize-handle");
  }

  onConnect() {
    if (this.#initialized) return;

    if (eagerUsed < EAGER_LIMIT) {
      // First N containers load immediately (above the fold)
      eagerUsed++;
      this.#initialize();
    } else {
      // Deferred containers: show skeleton, wait for visibility
      this.#showSkeleton();
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
    if (this.#globalFilterHandler) {
      document.removeEventListener(
        "globalfilterchange",
        this.#globalFilterHandler,
      );
      this.#globalFilterHandler = null;
    }
  }

  /** Called by the IntersectionObserver when this container scrolls into view. */
  _triggerInitialize() {
    if (!this.#initialized) this.#initialize();
  }

  /** Show the skeleton placeholder via data-loading attribute (CSS handles visibility). */
  #showSkeleton() {
    this.toggleAttribute("data-loading", true);
  }

  /** Remove the skeleton placeholder. */
  #removeSkeleton() {
    this.removeAttribute("data-loading");
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
     Resize handles (edit mode)
     ════════════════════════════════════════════════════════════════ */

  /** Valid column span stops. */
  static COL_STOPS = [3, 6, 9, 12];
  static MIN_ROW_SPAN = 1;
  static MAX_ROW_SPAN = 6;

  #createResizeHandles() {
    if (this.#resizeHandle) this.#attachResize(this.#resizeHandle);
  }

  /** Single corner handle — free-form resize on both axes simultaneously. */
  #attachResize(handle) {
    let startX = 0;
    let startY = 0;
    let startWidth = 0;
    let startRowSpan = 1;
    let gridColWidth = 0;
    let rowHeight = 0;

    const onMove = (e) => {
      // Column axis
      const dx = e.clientX - startX;
      const newWidth = startWidth + dx;
      const spannedCols = Math.round(newWidth / gridColWidth);
      const stops = SherpaContainer.COL_STOPS;
      let bestCol = stops[0];
      for (const s of stops) {
        if (Math.abs(s - spannedCols) < Math.abs(bestCol - spannedCols))
          bestCol = s;
      }
      if (bestCol !== this.getColSpan()) {
        this.setAttribute("data-col-span", String(bestCol));
      }

      // Row axis
      const dy = e.clientY - startY;
      const deltaRows = Math.round(dy / rowHeight);
      const newSpan = Math.min(
        SherpaContainer.MAX_ROW_SPAN,
        Math.max(SherpaContainer.MIN_ROW_SPAN, startRowSpan + deltaRows),
      );
      if (newSpan !== this.getRowSpan()) {
        this.setAttribute("data-row-span", String(newSpan));
      }
    };

    const onUp = () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      this.style.removeProperty("user-select");
    };

    handle.addEventListener("pointerdown", (e) => {
      if (!this.hasAttribute("data-editable")) return;
      e.preventDefault();
      startX = e.clientX;
      startY = e.clientY;
      startWidth = this.getBoundingClientRect().width;
      startRowSpan = this.getRowSpan();

      // Grid column width
      const grid = this.closest(".sherpa-content-area");
      if (grid) {
        const cols = getComputedStyle(grid).gridTemplateColumns.split(" ");
        gridColWidth = parseFloat(cols[0]) || startWidth / this.getColSpan();
      } else {
        gridColWidth = startWidth / this.getColSpan();
      }

      // Row height
      if (grid) {
        const rows = getComputedStyle(grid).gridAutoRows;
        rowHeight = parseFloat(rows) || 160;
      } else {
        rowHeight = 160;
      }

      // Transient drag interaction — inline style acceptable per guidelines
      this.style.setProperty("user-select", "none");
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    });
  }

  /* ════════════════════════════════════════════════════════════════
     Initialisation
     ════════════════════════════════════════════════════════════════ */

  async #initialize() {
    if (this.#initialized) return;
    this.#removeSkeleton();

    let metrics, sections, title, description;
    const contentId = this.getAttribute("data-content");

    if (contentId) {
      // ── Content template path ───────────────────────────────────
      const html = await loadContentTemplate(contentId);
      const content = materializeContent(html);
      metrics = content.metrics;
      sections = content.sections;
      title = this.dataset.title || content.title;
      description = this.dataset.description || content.description;
    } else {
      // ── Inline children fallback ────────────────────────────────
      metrics = [...this.querySelectorAll(':scope > [slot="metric"]')];
      sections = [...this.querySelectorAll(':scope > [slot="section"]')];
      metrics.forEach((m) => m.remove());
      sections.forEach((s) => s.remove());
      title = this.dataset.title || "";
      description = this.dataset.description || "";
    }

    // Stamp the layout template (creates header + .metrics + .sections wrappers)
    const id = this.dataset.template || "default";
    const layoutHtml = this.getTemplateHtml(id);
    const temp = document.createElement("div");
    temp.innerHTML = layoutHtml;
    while (temp.firstChild) this.appendChild(temp.firstChild);

    // Reparent metric children into .metrics wrapper
    const metricsDiv = this.querySelector(".metrics");
    if (metricsDiv) {
      metrics.forEach((m) => metricsDiv.appendChild(m));
    }

    // Reparent section children into .sections wrapper (clone section-tpl prototype)
    const sectionsDiv = this.querySelector(".sections");
    const sectionTpl = this.$("template.section-tpl");
    if (sectionsDiv && sectionTpl) {
      sections.forEach((s, i) => {
        const frag = sectionTpl.content.cloneNode(true);
        const wrapper = frag.querySelector(".section");
        wrapper.id = `section-${i}`;
        frag.querySelector(".section-content").appendChild(s);
        sectionsDiv.appendChild(frag);
      });
    }

    // Setup header
    const header = this.querySelector("sherpa-header");
    if (header) {
      header.heading = title;
      header.description = description;
    }

    this.#setupMenuButton();
    this.#setupPresentationChangeHandler();
    this.#createResizeHandles();

    this.#initialized = true;

    // ── Global filter awareness (read BEFORE initial load) ─────
    const globalState = SherpaContainer.#globalFilterProvider
      ? SherpaContainer.#globalFilterProvider()
      : { filters: [], timerange: null };
    this.#globalFilters = globalState.filters;
    this.#globalTimerange = globalState.timerange;

    // Build initial global filters so the first data load is already scoped
    const initialFilters = this.#composeGlobalFilters();

    // Trigger each viz child to load its own data (with pre-seeded filters)
    const loadPromises = [...metrics, ...sections].map((el) => {
      if (typeof el.load === "function") return el.load(initialFilters);
    });
    await Promise.all(loadPromises);

    // Store section configs for later filter/presentation changes
    this.#sectionConfigs.clear();
    sections.forEach((s, i) => {
      if (typeof s.getConfig === "function") {
        this.#sectionConfigs.set(`section-${i}`, s.getConfig());
      }
    });

    // Store metric configs for re-query on global filter changes
    this.#metricConfigs.clear();
    metrics.forEach((m) => {
      if (typeof m.getConfig === "function") {
        this.#metricConfigs.set(m, m.getConfig());
      }
    });

    // Wire filter bar to viz children
    this.#wireFilterBar(sections);

    // Listen for future global filter changes
    this.#globalFilterHandler = (e) => {
      this.#globalFilters = e.detail?.filters || [];
      this.#globalTimerange = e.detail?.timerange || null;
      this.#reQueryChildren();
    };
    document.addEventListener("globalfilterchange", this.#globalFilterHandler);
  }

  /* ════════════════════════════════════════════════════════════════
     Filter bar wiring
     ════════════════════════════════════════════════════════════════ */

  /** Collect columns/rows from viz children and configure the container filter bar. */
  #wireFilterBar(sections) {
    this.#filterBar = this.querySelector('sherpa-filter-bar[slot="filters"]');
    if (!this.#filterBar) return;

    // ── Collect unioned columns and all rows from viz children ──
    const columnMap = new Map();
    let allRows = [];

    for (const el of sections) {
      const cols =
        typeof el.getContentColumns === "function"
          ? el.getContentColumns()
          : [];
      const rows =
        typeof el.getContentRows === "function" ? el.getContentRows() : [];
      for (const col of cols) {
        if (!columnMap.has(col.field)) columnMap.set(col.field, col);
      }
      allRows = allRows.concat(rows);
    }

    const columns = [...columnMap.values()];

    // ── Feed columns and rows to filter bar + chips ──
    this.#filterBar.setAvailableColumns(columns, allRows);

    // ── Report to global filter bar via custom event ──
    this.dispatchEvent(
      new CustomEvent("containercolumnsready", {
        bubbles: true,
        composed: true,
        detail: { columns, rows: allRows },
      }),
    );

    // ── Chart group chip hiding ──
    // If all sections are barcharts, hide the group chip when the only
    // valid segment column is the category axis (nothing meaningful to group by).
    this.#maybeHideGroupChip(sections, columns, allRows);

    // ── Seed segment chip from the initial viz element state ──
    const segmentChip = this.#filterBar.querySelector(
      'sherpa-filter-chip[slot="group"]',
    );
    if (segmentChip) {
      const firstViz = sections[0];
      const initSegField = firstViz?.getAttribute("data-segment-field");
      const initSegMode = firstViz?.getAttribute("data-segment-mode");
      if (initSegField && !segmentChip.getField()) {
        segmentChip.setField(initSegField);
        if (initSegMode) segmentChip.setMode(initSegMode);
      }
    }

    // ── Listen for filter changes from the bar ──
    this.addEventListener("filterchange", (e) => {
      // Skip re-entrant events caused by programmatic sort chip updates
      if (this.#syncingSort) return;
      const filters = e.detail?.filters || [];
      this.#applyContainerFilters(filters);
    });

    this.addEventListener("filterclear", () => {
      this.#applyContainerFilters([]);
    });

    // ── 2-way sort binding: viz child column-header sort → filter bar chip ──
    this.addEventListener("sortchange", (e) => {
      const sortChip = this.#filterBar?.querySelector(
        'sherpa-filter-chip[data-type="sort"]',
      );
      if (!sortChip) return;
      const { field, direction } = e.detail || {};
      this.#syncingSort = true;
      if (field && direction !== "off") {
        sortChip.setField(field);
        sortChip.setMode(direction);
      } else {
        sortChip.setField(null);
      }
      this.#syncingSort = false;
    });
  }

  /** Query current viz elements inside section-content wrappers. */
  #getVizElements() {
    return [
      ...this.querySelectorAll(
        ".section-content > :is(sherpa-base-table, sherpa-barchart, sherpa-data-grid)",
      ),
    ];
  }

  /**
   * Push filter state from the container filter bar down to all viz children.
   * Sort → attribute-only.  Segment/value filters → re-query via setData().
   */
  #applyContainerFilters(filters) {
    // Separate by type
    let sortFilter = null;
    let segmentFilter = null;
    const valueFilters = [];

    for (const f of filters) {
      if (f.type === "sort") {
        sortFilter = f;
        continue;
      }
      if (f.type === "segment") {
        segmentFilter = f;
        continue;
      }
      if (f.type === "filter" && f.values?.length) {
        valueFilters.push(f);
        continue;
      }
    }

    for (const el of this.#getVizElements()) {
      // ── Sort ──
      if (sortFilter) {
        el.setAttribute("data-sort-field", sortFilter.field);
        el.setAttribute("data-sort-direction", sortFilter.mode || "asc");
      } else {
        el.removeAttribute("data-sort-field");
        el.removeAttribute("data-sort-direction");
      }

      // ── Segment/group ──
      if (segmentFilter) {
        el.setAttribute("data-segment-field", segmentFilter.field);
        el.setAttribute("data-segment-mode", segmentFilter.mode || "on");
      } else {
        el.removeAttribute("data-segment-field");
        el.removeAttribute("data-segment-mode");
      }
    }

    // ── Segment change → re-query so rows include the segment field ──
    const newSegField = segmentFilter?.field || null;
    if (newSegField !== this.#containerSegmentField) {
      this.#containerSegmentField = newSegField;
      this.#reQueryChildren();
      return; // reQuery already handles value filters
    }

    // ── Value filters → re-query only when value filters changed ──
    const changed =
      JSON.stringify(valueFilters) !==
      JSON.stringify(this.#containerValueFilters);
    this.#containerValueFilters = valueFilters;
    if (changed) {
      this.#reQueryChildren();
    }
  }

  /**
   * Re-query all viz children with composed filters (global + container).
   * Merges filter entries into each child's original config and calls setData()
   * so DataService applies them pre-aggregation.
   */
  /**
   * Build filter entries from global + container state.
   * Timerange is passed as { type:'timerange' } so DataService resolves
   * the correct dateField per dataset.
   */
  #composeGlobalFilters() {
    const out = [];
    for (const gf of this.#globalFilters) {
      if (gf.values?.length)
        out.push({ field: gf.field, operator: "in", values: gf.values });
    }
    if (this.#globalTimerange) {
      out.push({ type: "timerange", ...this.#globalTimerange });
    }
    return out;
  }

  #reQueryChildren() {
    const globalFilters = this.#composeGlobalFilters();
    const containerFilters = [];
    for (const cf of this.#containerValueFilters) {
      if (cf.values?.length) {
        containerFilters.push({
          field: cf.field,
          operator: "in",
          values: cf.values,
        });
      }
    }

    // ── Re-query sections ──
    this.#sectionConfigs.forEach((original, sectionId) => {
      const section = this.querySelector(`#${CSS.escape(sectionId)}`);
      const vizEl = section?.querySelector(
        ".section-content > :is(sherpa-base-table, sherpa-barchart, sherpa-data-grid)",
      );
      if (!vizEl || typeof vizEl.setData !== "function") return;

      const mergedFilters = [
        ...(original.filters || []),
        ...globalFilters,
        ...containerFilters,
      ];

      // Include active segment field (tables use it for column derivation,
      // charts use it for grouping — the table handles visual grouping client-side)
      const segmentBy = vizEl.getAttribute("data-segment-field") || undefined;
      vizEl.setData({ ...original, filters: mergedFilters, segmentBy });
    });

    // ── Re-query metrics ──
    this.#metricConfigs.forEach((original, metricEl) => {
      if (typeof metricEl.setData !== "function") return;
      const mergedFilters = [
        ...(original.filters || []),
        ...globalFilters,
        ...containerFilters,
      ];
      metricEl.setData({ ...original, filters: mergedFilters });
    });
  }

  /**
   * Hide the group (segment) chip when all sections are barcharts and the
   * only non-numeric column with >1 unique value is the category axis.
   */
  #maybeHideGroupChip(sections, columns, allRows) {
    const groupChip = this.#filterBar?.querySelector(
      'sherpa-filter-chip[slot="group"]',
    );
    if (!groupChip) return;

    const allCharts =
      sections.length > 0 &&
      sections.every((el) => el.tagName === "SHERPA-BARCHART");
    if (!allCharts) return;

    // Collect category fields from all barcharts
    const catFields = new Set();
    for (const el of sections) {
      const cat =
        typeof el.getCategoryField === "function"
          ? el.getCategoryField()
          : null;
      if (cat) catFields.add(cat);
    }

    // Filter columns: remove numeric, remove single-value, remove category axis fields
    const NUMERIC_TYPES = new Set([
      "number",
      "numeric",
      "currency",
      "percent",
      "year",
      "monthNumber",
    ]);
    const validSegmentCols = columns.filter((col) => {
      if (NUMERIC_TYPES.has((col.type || "").toLowerCase())) return false;
      if (catFields.has(col.field)) return false;
      // Must have >1 unique value
      const vals = new Set();
      for (const r of allRows) {
        vals.add(r[col.field]);
        if (vals.size > 1) break;
      }
      return vals.size > 1;
    });

    if (validSegmentCols.length === 0) {
      groupChip.toggleAttribute("disabled", true);
      groupChip.removeAttribute("data-field");
      groupChip.removeAttribute("data-mode");
    }
  }

  /* ════════════════════════════════════════════════════════════════
     Summary generation
     ════════════════════════════════════════════════════════════════ */

  #generateSummary(data) {
    if (!data?.dataset) return null;
    // Summary metric uses the category field; transform() will override to count
    const category = data.category || data.categoryField || null;
    return {
      presentationType: "kpi-metric",
      dataset: data.dataset,
      category,
      value: category,
      agg: "count",
      filters: data.filters || [],
      showStatus: false,
    };
  }

  #titleCase(str) {
    if (!str) return "";
    return str
      .replace(/([A-Z])/g, " $1")
      .replace(/[_-]/g, " ")
      .trim()
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  }

  /* ════════════════════════════════════════════════════════════════
     Presentation + dataset change handlers
     ════════════════════════════════════════════════════════════════ */

  #setupPresentationChangeHandler() {
    this.addEventListener("presentationchange", (e) => {
      const { type, data } = e.detail;
      const section = e.target.closest(".section");
      if (!section || !data) return;

      const sectionId = section.id;
      const content = section.querySelector(".section-content");
      if (!content) return;

      const stored = this.#sectionConfigs.get(sectionId);
      if (stored) stored.presentationType = type;

      this.#reloadSectionContent(content, {
        ...(stored || data),
        presentationType: type,
      });
    });

    this.addEventListener("datasetchange", (e) => {
      const { dataset } = e.detail;
      const section = e.target.closest(".section");
      if (!section || !dataset) return;

      const sectionId = section.id;
      const content = section.querySelector(".section-content");
      if (!content) return;

      const stored = this.#sectionConfigs.get(sectionId);
      if (!stored) return;
      stored.dataset = dataset;

      this.#reloadSectionContent(content, { ...stored });
      this.#loadSectionSummary(content, sectionId, { ...stored });
    });
  }

  /**
   * Re-create a section's viz element with a new config.
   * Used by presentation/dataset change handlers.
   */
  #reloadSectionContent(container, data) {
    // Capture chip state from outgoing component
    const CHIP_ATTRS = [
      "data-segment-field",
      "data-segment-mode",
      "data-sort-field",
      "data-sort-direction",
    ];
    const chipState = {};
    const outgoing = container.querySelector(
      "sherpa-base-table, sherpa-barchart, sherpa-metric:not([data-section-summary])",
    );
    if (outgoing) {
      for (const attr of CHIP_ATTRS) {
        const val = outgoing.getAttribute(attr);
        if (val != null) chipState[attr] = val;
      }
    }

    // Clear existing viz (preserve summary metrics)
    container
      .querySelectorAll(
        "sherpa-base-table, sherpa-barchart, sherpa-metric:not([data-section-summary])",
      )
      .forEach((el) => el.remove());

    // Title: auto-generate from dataset name if not already set.
    if (!data.name) {
      data.name = formatFieldName(data.dataset || "");
    }

    const tag = {
      barchart: "sherpa-barchart",
      table: "sherpa-base-table",
      "kpi-metric": "sherpa-metric",
    }[data.presentationType];
    if (!tag) return;

    const el = document.createElement(tag);
    el.setAttribute("slot", "section");
    if (typeof el.setConfig === "function") el.setConfig(data);

    // Restore chip state
    for (const [attr, val] of Object.entries(chipState)) {
      el.setAttribute(attr, val);
    }

    el.setData(data);
    container.appendChild(el);
  }

  #loadSectionSummary(container, sectionId, data) {
    container.querySelector(`[data-section-summary="${sectionId}"]`)?.remove();
    const summary = data.summary || this.#generateSummary(data);
    if (!summary) return;

    const el = document.createElement("sherpa-metric");
    el.setAttribute("data-section-summary", sectionId);
    if (typeof el.setConfig === "function") el.setConfig(summary);
    el.setData(summary);
    container.appendChild(el);
  }

  /* ════════════════════════════════════════════════════════════════
     Menu
     ════════════════════════════════════════════════════════════════ */

  async #setupMenuButton() {
    const header = this.querySelector("sherpa-header");
    if (!header) return;
    await header.rendered;
    const btn = header.menuButtonElement;
    if (!btn) return;
    await btn.rendered;
    this.#menuBtn = btn;

    // Load the HTML menu template
    await loadMenuTemplate();

    btn.addEventListener("menu-open", () => {
      this.dataset.menuOpen = true;
      this.#populateMenu();
    });
    btn.addEventListener("menu-close", () => {
      this.dataset.menuOpen = false;
    });
    this.#attachMenuHandlers(btn);
  }

  #populateMenu() {
    const html = menuTemplateMap?.get("default");
    if (!html) return;

    const frag = document.createRange().createContextualFragment(html);

    // Show width/height resize groups only in edit mode
    if (!this.hasAttribute("data-editable")) {
      frag
        .querySelectorAll('[data-group="width"], [data-group="height"]')
        .forEach((el) => el.remove());
      frag
        .querySelectorAll('sherpa-menu-item[data-type="heading"]')
        .forEach((el) => {
          const text = el.textContent.trim();
          if (text === "Width" || text === "Height") el.remove();
        });
    }

    // Build section toggle items for the data group
    const dataGroup = frag.querySelector('ul[data-group="data"]');
    const dataHeading = frag.querySelector('[data-group-heading="data"]');
    const toggles = this.#buildSectionToggles();

    if (dataGroup) {
      if (toggles.length) {
        const toggleTpl = this.$("template.menu-toggle-tpl");
        toggles.forEach((t) => {
          const frag2 = toggleTpl.content.cloneNode(true);
          const item = frag2.querySelector("sherpa-menu-item");
          item.dataset.target = t.target;
          if (t.checked) item.setAttribute("checked", "");
          item.textContent = t.label;
          dataGroup.appendChild(frag2);
        });
      } else {
        dataGroup.remove();
        dataHeading?.remove();
      }
    }

    this.#menuBtn?.menuElement?.replaceChildren(frag);
  }

  #buildSectionToggles() {
    const sectionEls = this.querySelectorAll(".sections > .section");
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

  #attachMenuHandlers(btn) {
    btn.addEventListener("menu-select", (e) => {
      const detail = e.detail ?? {};
      const action = detail.action;

      if (action === "export") {
        this.dispatchEvent(
          new CustomEvent("containerexport", {
            bubbles: true,
            composed: true,
            detail: { container: this },
          }),
        );
        return;
      }

      // Resize actions (edit mode)
      if (action === "increase-cols" || action === "decrease-cols") {
        const stops = SherpaContainer.COL_STOPS;
        const cur = this.getColSpan();
        const idx = stops.indexOf(cur);
        const next =
          action === "increase-cols"
            ? stops[Math.min(idx + 1, stops.length - 1)]
            : stops[Math.max(idx - 1, 0)];
        if (next !== cur) this.setAttribute("data-col-span", String(next));
        return;
      }

      if (action === "increase-rows" || action === "decrease-rows") {
        const cur = this.getRowSpan();
        const next =
          action === "increase-rows"
            ? Math.min(SherpaContainer.MAX_ROW_SPAN, cur + 1)
            : Math.max(SherpaContainer.MIN_ROW_SPAN, cur - 1);
        if (next !== cur) this.setAttribute("data-row-span", String(next));
        return;
      }

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
}

customElements.define("sherpa-container", SherpaContainer);
