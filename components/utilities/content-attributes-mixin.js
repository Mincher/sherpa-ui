/**
 * ContentAttributesMixin — Shared content configuration + data pipeline.
 *
 * Provides:
 *   • Standardised getters/setters for all content config attributes
 *   • getConfig() / setConfig() for serialising/restoring state
 *   • Query loading: data-query-src + data-query-key → load() → setData()
 *   • Auto-load on connect when query attributes are present
 *   • Pluggable data provider: setDataProvider(fn) at module level
 *   • fetchContentData(config) — calls the registered provider
 *   • Self-filtering: containerfilterchange + globalfilterchange listeners
 *   • dispatchVizReady() — fires the vizready event for filter bars
 *   • View-switching header/menu helpers: getViewOptions, configureHeader,
 *     wireContentMenu — shared by all viz components that support
 *     presentation switching (table, barchart, metric)
 *
 * Data provider registration (module-level, shared by all viz components):
 *   import { setDataProvider, setDateFieldProvider } from './content-attributes-mixin.js';
 *   setDataProvider(async (config) => { ... });
 *   setDateFieldProvider((datasetName) => dateFieldName);
 */

import { getInitialFilters } from "./global-filters.js";

/* ── Pluggable data providers (shared across all viz components) ── */
let _dataProvider = null;
let _dateFieldProvider = null;

/**
 * Register the data provider function used by all viz components.
 * Signature: async (config) => { name, columns, rows, summary, config, metadata }
 * @param {Function} fn
 */
export function setDataProvider(fn) {
  _dataProvider = fn;
}

/**
 * Register a date-field provider that returns the date field name for a dataset.
 * Signature: (datasetName) => string | null
 * @param {Function} fn
 */
export function setDateFieldProvider(fn) {
  _dateFieldProvider = fn;
}

/**
 * Get the registered date-field provider (used by table for chronological sort).
 * @returns {Function|null}
 */
export function getDateFieldProvider() {
  return _dateFieldProvider;
}

/* ── Query bundle cache (shared across all instances) ───────── */
const queryBundleCache = new Map();

async function fetchQueryBundle(url) {
  if (queryBundleCache.has(url)) return queryBundleCache.get(url);
  const promise = fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });
  queryBundleCache.set(url, promise);
  return promise;
}

export const CONTENT_ATTRIBUTES = [
  // Query source
  "data-query-src",
  "data-query-key",
  // Dataset & field mapping
  "data-label",
  "data-dataset",
  "data-category",
  "data-series",
  "data-value-field",
  "data-agg",
  "data-measures",
  "data-filters",
  "data-order-by",
  "data-limit",
  "data-timerange",
  "data-visible",
  "data-show-status",
  "data-unit",
  "data-show-header",
  "data-show-header-controls",
  "data-show-view-menu",
  // Presentation attributes
  "data-segment-field",
  "data-sort-field",
  "data-sort-direction",
  // Component identity + data-grid fields
  "data-presentation-type",
  "data-fields",
];

/**
 * Mixin to add content attribute support to a component class
 *
 * Usage:
 * class SherpaMetric extends ContentAttributesMixin(HTMLElement) { ... }
 */
export function ContentAttributesMixin(Base) {
  return class extends Base {
    #parseJsonAttr(name, fallback) {
      const raw = this.getAttribute(name);
      if (!raw) return fallback;
      try {
        return JSON.parse(raw);
      } catch (error) {
        return fallback;
      }
    }

    // Content configuration getters
    get querySrc() {
      return this.getAttribute("data-query-src") || "";
    }
    get queryKey() {
      return this.getAttribute("data-query-key") || "";
    }
    get name() {
      return this.getAttribute("data-label") || "";
    }
    // Avoid clobbering HTMLElement.dataset (DOMStringMap)
    get datasetName() {
      return this.getAttribute("data-dataset") || "";
    }
    get category() {
      return this.getAttribute("data-category") || null;
    }
    get series() {
      return this.getAttribute("data-series") || null;
    }
    get valueField() {
      return this.getAttribute("data-value-field") || "";
    }
    get agg() {
      return this.getAttribute("data-agg") || "sum";
    }
    get measures() {
      return this.#parseJsonAttr("data-measures", []);
    }
    get orderBy() {
      return this.#parseJsonAttr("data-order-by", []);
    }
    get segmentField() {
      return this.getAttribute("data-segment-field") || null;
    }
    get showStatus() {
      return this.getAttribute("data-show-status") !== "false";
    }
    get unit() {
      return this.getAttribute("data-unit") || "";
    }
    get sortField() {
      return this.getAttribute("data-sort-field") || null;
    }
    get sortDirection() {
      return this.getAttribute("data-sort-direction") || "asc";
    }
    get limit() {
      const v = this.getAttribute("data-limit");
      return v ? parseInt(v, 10) : null;
    }
    get filters() {
      return this.#parseJsonAttr("data-filters", []);
    }
    get visible() {
      return this.getAttribute("data-visible") !== "false";
    }
    get showHeader() {
      return this.getAttribute("data-show-header") !== "false";
    }
    get showHeaderControls() {
      return this.getAttribute("data-show-header-controls") !== "false";
    }
    get showViewMenu() {
      return this.getAttribute("data-show-view-menu") !== "false";
    }
    get presentationType() {
      return this.getAttribute("data-presentation-type") || null;
    }
    get fields() {
      return this.#parseJsonAttr("data-fields", null);
    }

    // Legacy getters (map to new format)
    get factTable() {
      return null;
    }
    get dimensions() {
      const cat = this.category;
      const ser = this.series;
      return [cat, ser].filter(Boolean);
    }

    // Content configuration setters (return `this` for chaining)
    setName(name) {
      this.setAttribute("data-label", name);
      return this;
    }
    setDataset(dataset) {
      this.setAttribute("data-dataset", dataset);
      return this;
    }
    setCategory(category) {
      category
        ? this.setAttribute("data-category", category)
        : this.removeAttribute("data-category");
      return this;
    }
    setSeries(series) {
      series
        ? this.setAttribute("data-series", series)
        : this.removeAttribute("data-series");
      return this;
    }
    setValueField(field) {
      this.setAttribute("data-value-field", field);
      return this;
    }
    setAgg(agg) {
      this.setAttribute("data-agg", agg);
      return this;
    }
    setMeasures(measures) {
      this.setAttribute("data-measures", JSON.stringify(measures || []));
      return this;
    }
    setOrderBy(orderBy) {
      this.setAttribute("data-order-by", JSON.stringify(orderBy || []));
      return this;
    }
    getDataset() {
      return this.datasetName;
    }
    setSegmentField(field) {
      field
        ? this.setAttribute("data-segment-field", field)
        : this.removeAttribute("data-segment-field");
      return this;
    }
    setShowStatus(show) {
      this.setAttribute("data-show-status", String(show));
      return this;
    }
    setUnit(unit) {
      unit
        ? this.setAttribute("data-unit", unit)
        : this.removeAttribute("data-unit");
      return this;
    }
    setSortField(field) {
      field
        ? this.setAttribute("data-sort-field", field)
        : this.removeAttribute("data-sort-field");
      return this;
    }
    setSortDirection(dir) {
      this.setAttribute("data-sort-direction", dir);
      return this;
    }
    setLimit(limit) {
      limit !== null
        ? this.setAttribute("data-limit", String(limit))
        : this.removeAttribute("data-limit");
      return this;
    }
    setFilters(filters) {
      this.setAttribute("data-filters", JSON.stringify(filters || []));
      return this;
    }
    setVisible(visible) {
      if (visible === undefined || visible === null) {
        this.removeAttribute("data-visible");
      } else {
        this.setAttribute("data-visible", String(Boolean(visible)));
      }
      return this;
    }
    setShowHeader(show) {
      if (show === undefined || show === null) {
        this.removeAttribute("data-show-header");
      } else {
        this.setAttribute("data-show-header", String(Boolean(show)));
      }
      return this;
    }
    setShowHeaderControls(show) {
      if (show === undefined || show === null) {
        this.removeAttribute("data-show-header-controls");
      } else {
        this.setAttribute("data-show-header-controls", String(Boolean(show)));
      }
      return this;
    }
    setShowViewMenu(show) {
      if (show === undefined || show === null) {
        this.removeAttribute("data-show-view-menu");
      } else {
        this.setAttribute("data-show-view-menu", String(Boolean(show)));
      }
      return this;
    }
    setPresentationType(type) {
      type
        ? this.setAttribute("data-presentation-type", type)
        : this.removeAttribute("data-presentation-type");
      return this;
    }
    setFields(fields) {
      Array.isArray(fields)
        ? this.setAttribute("data-fields", JSON.stringify(fields))
        : this.removeAttribute("data-fields");
      return this;
    }

    // Legacy setters (no-ops or mapped)
    setFactTable() {
      return this;
    }
    setDimensions(dims) {
      if (Array.isArray(dims) && dims.length > 0) this.setCategory(dims[0]);
      if (Array.isArray(dims) && dims.length > 1) this.setSeries(dims[1]);
      return this;
    }

    getConfig() {
      return {
        name: this.name,
        queryKey: this.queryKey,
        querySrc: this.querySrc,
        dataset: this.datasetName,
        category: this.category,
        series: this.series,
        value: this.valueField,
        valueField: this.valueField,
        agg: this.agg,
        measures: this.measures,
        filters: this.filters,
        orderBy: this.orderBy,
        limit: this.limit,
        timerange: this.getAttribute("data-timerange"),
        visible: this.visible,
        showStatus: this.showStatus,
        unit: this.unit,
        showHeader: this.showHeader,
        showHeaderControls: this.showHeaderControls,
        showViewMenu: this.showViewMenu,
        segmentField: this.segmentField,
        sortField: this.sortField,
        sortDirection: this.sortDirection,
        presentationType: this.presentationType,
        fields: this.fields,
      };
    }

    setConfig(config) {
      if (config.name !== undefined) this.setName(config.name);
      if (config.queryKey !== undefined)
        this.setAttribute("data-query-key", config.queryKey);
      if (config.querySrc !== undefined)
        this.setAttribute("data-query-src", config.querySrc);
      if (config.dataset !== undefined) this.setDataset(config.dataset);
      if (config.category !== undefined) this.setCategory(config.category);
      if (config.series !== undefined) this.setSeries(config.series);
      if (config.value !== undefined) this.setValueField(config.value);
      if (config.valueField !== undefined)
        this.setValueField(config.valueField);
      if (config.agg !== undefined) this.setAgg(config.agg);
      if (config.measures !== undefined) this.setMeasures(config.measures);
      if (config.filters !== undefined) this.setFilters(config.filters);
      if (config.orderBy !== undefined) this.setOrderBy(config.orderBy);
      if (config.timerange !== undefined)
        this.setAttribute("data-timerange", config.timerange);
      if (config.segmentField !== undefined)
        this.setSegmentField(config.segmentField);
      if (config.showStatus !== undefined)
        this.setShowStatus(config.showStatus);
      if (config.unit !== undefined) this.setUnit(config.unit);
      if (config.sortField !== undefined) this.setSortField(config.sortField);
      if (config.sortDirection !== undefined)
        this.setSortDirection(config.sortDirection);
      if (config.limit !== undefined) this.setLimit(config.limit);
      if (config.visible !== undefined) this.setVisible(config.visible);
      if (config.showHeader !== undefined)
        this.setShowHeader(config.showHeader);
      if (config.showHeaderControls !== undefined)
        this.setShowHeaderControls(config.showHeaderControls);
      if (config.showViewMenu !== undefined)
        this.setShowViewMenu(config.showViewMenu);
      if (config.presentationType !== undefined)
        this.setPresentationType(config.presentationType);
      if (config.fields !== undefined) this.setFields(config.fields);
      return this;
    }

    /* ══════════════════════════════════════════════════════════
       Data Pipeline — fetch + vizready
       ══════════════════════════════════════════════════════════ */

    /**
     * Fetch data from the registered provider.
     * Sets data-loading while the request is in flight.
     * @param {object} config - Query configuration object
     * @returns {Promise<object|null>} Data result from the provider
     */
    async fetchContentData(config) {
      if (!config) return null;
      if (!_dataProvider) {
        console.warn(
          "[ContentAttributes] No data provider registered. " +
            "Call setDataProvider(fn) at app boot.",
        );
        return null;
      }
      this.setAttribute("data-loading", "");
      const result = await _dataProvider(config);
      this.removeAttribute("data-loading");
      return result;
    }

    /**
     * Dispatch vizready event after data load completes.
     * Filter bars listen for this to auto-populate column menus.
     * Subclasses must implement getContentColumns() and getContentRows().
     */
    dispatchVizReady() {
      const columns =
        typeof this.getContentColumns === "function"
          ? this.getContentColumns()
          : [];
      const rows =
        typeof this.getContentRows === "function" ? this.getContentRows() : [];
      this.dispatchEvent(
        new CustomEvent("vizready", {
          bubbles: true,
          composed: true,
          detail: { columns, rows },
        }),
      );
    }

    /* ══════════════════════════════════════════════════════════
       View-switching — header + menu helpers
       ══════════════════════════════════════════════════════════ */

    #pendingMenuData = null;
    #menuHeadingTpl = null;
    #menuItemTpl = null;
    _menuButton = null;
    _menuBound = false;
    _menuCurrentType = "";

    /**
     * Build the list of view option descriptors for the view-switching menu.
     * Subclasses may override to add/remove options.
     * @param {{ activeType: string, canShowChart?: boolean }} opts
     * @returns {Array<{ type: string, label: string, icon: string, active: boolean, disabled?: boolean, disabledTitle?: string }>}
     */
    getViewOptions({ activeType, canShowChart = true }) {
      return [
        {
          type: "table",
          label: "Table",
          icon: "fa-table",
          active: activeType === "table",
        },
        {
          type: "kpi-metric",
          label: "Metric",
          icon: "fa-chart-bar",
          active: activeType === "kpi-metric",
        },
        {
          type: "barchart",
          label: "Bar Chart",
          icon: "fa-chart-simple",
          active: activeType === "barchart",
          disabled: !canShowChart,
          disabledTitle: canShowChart ? "" : "No primary axis field for chart",
        },
      ];
    }

    /**
     * Configure the sherpa-header child for title + view menu.
     * Sets heading text, toggles menu button via sherpa-header's API,
     * and stashes pending menu data for wireContentMenu().
     * @param {{ title?: string, viewOptions?: Array }} opts
     */
    configureHeader({ title = "", viewOptions = [] } = {}) {
      const headerEl = this.$("sherpa-header");
      if (!headerEl) {
        this.#pendingMenuData = null;
        return;
      }

      const showHeader = this.getAttribute("data-show-header") !== "false";
      if (!showHeader) {
        this.setAttribute("data-show-header", "false");
      } else {
        this.removeAttribute("data-show-header");
      }

      const showControls =
        this.getAttribute("data-show-header-controls") !== "false";
      showControls
        ? headerEl.removeAttribute("data-show-header-controls")
        : headerEl.setAttribute("data-show-header-controls", "false");

      const showViewMenu = this.getAttribute("data-show-view-menu") !== "false";
      showViewMenu
        ? headerEl.removeAttribute("data-show-view-menu")
        : headerEl.setAttribute("data-show-view-menu", "false");

      headerEl.heading = title || "";

      const shouldShowMenu = showViewMenu;
      headerEl.hasMenuButton = shouldShowMenu;

      if (shouldShowMenu) {
        this.#pendingMenuData = {
          showViewMenu,
          viewOptions,
        };
      } else {
        this.#pendingMenuData = null;
      }
    }

    /**
     * Wire the header's menu button for view-switching.
     * Populates the menu on open and binds presentationchange dispatch.
     * @param {HTMLElement} root - Element containing the sherpa-header
     * @param {string} activeType - Currently active presentation type
     */
    async wireContentMenu(root, activeType) {
      if (!this.#pendingMenuData) return;

      const header =
        root.$?.("sherpa-header") || root.querySelector?.("sherpa-header");
      if (!header?.isConnected) return;

      await header.rendered;
      const menuButton = header.menuButtonElement;
      if (!menuButton) return;
      await menuButton.rendered;

      this._menuButton = menuButton;

      if (!this._menuBound) {
        this._menuBound = true;
        this._menuCurrentType = activeType || "";

        menuButton.addEventListener("menu-open", () => {
          this.#populateViewMenu(this._menuCurrentType);
        });

        this.#bindContentMenu(menuButton, activeType);
      } else {
        this._menuCurrentType = activeType || this._menuCurrentType || "";
      }
    }

    #bindContentMenu(menuButton, activeType) {
      menuButton.addEventListener("menu-select", (event) => {
        const detail = event.detail ?? {};
        if (detail.disabled) return;

        const type = detail.data?.type;

        if (type && type !== (this._menuCurrentType || activeType)) {
          this._menuCurrentType = type;
          if (Array.isArray(this.#pendingMenuData?.viewOptions)) {
            this.#pendingMenuData.viewOptions =
              this.#pendingMenuData.viewOptions.map((option) => ({
                ...option,
                active: option.type === type,
              }));
          }

          this.dispatchEvent(
            new CustomEvent("presentationchange", {
              bubbles: true,
              detail: { type, data: this.getData?.() || null },
            }),
          );
        }
      });
    }

    /**
     * Build DOM content for the view-switching menu.
     * Uses cloning prototypes from the component's shadow DOM.
     */
    #populateViewMenu(activeType) {
      const config = this.#pendingMenuData;
      if (!config?.showViewMenu || !config.viewOptions?.length) return;

      // Cache cloning templates on first use
      if (!this.#menuHeadingTpl) {
        this.#menuHeadingTpl = this.$("template.menu-heading-tpl");
        this.#menuItemTpl = this.$("template.menu-item-tpl");
      }

      const frag = document.createDocumentFragment();

      const heading = this.#menuHeadingTpl.content
        .cloneNode(true)
        .querySelector("sherpa-menu-item");
      heading.textContent = "View";
      frag.appendChild(heading);

      const ul = document.createElement("ul");
      ul.dataset.group = "view";

      const normalizeIcon = (icon) => {
        if (!icon) return null;
        if (/fa-(solid|regular|light|thin|duotone|brands)\b/.test(icon))
          return icon;
        return `fa-regular ${icon}`;
      };

      for (const option of config.viewOptions) {
        const itemFrag = this.#menuItemTpl.content.cloneNode(true);
        const item = itemFrag.querySelector("sherpa-menu-item");
        item.setAttribute("data-selection", "radio");
        item.setAttribute("value", option?.type ?? "");
        item.dataset.type = option?.type ?? "";
        if (normalizeIcon(option?.icon))
          item.setAttribute("data-icon", normalizeIcon(option.icon));
        if ((option?.type ?? null) === activeType)
          item.setAttribute("checked", "");
        if (option?.disabled) item.setAttribute("disabled", "");
        if (option?.disabledTitle)
          item.setAttribute("data-description", option.disabledTitle);
        item.textContent = option?.label || "";
        ul.appendChild(itemFrag);
      }

      frag.appendChild(ul);
      this._menuButton?.menuElement?.replaceChildren(frag);
    }

    /* ══════════════════════════════════════════════════════════
       Self-filtering — container + global filter listeners
       ══════════════════════════════════════════════════════════ */

    #containerFilterHandler = null;
    #globalFilterHandler = null;
    #containerEl = null;

    /** Wire listeners for container-scoped and global filter events. */
    #wireFilterListeners() {
      this.#containerEl = this.closest("sherpa-container");

      // Container-scoped filters (sort/segment/value from sibling filter bar)
      if (this.#containerEl) {
        this.#containerFilterHandler = (e) => this.#onContainerFilter(e);
        this.#containerEl.addEventListener(
          "containerfilterchange",
          this.#containerFilterHandler,
        );
      }

      // Global filters (timerange, global filter bar)
      this.#globalFilterHandler = (e) => this.#onGlobalFilter(e);
      document.addEventListener(
        "globalfilterchange",
        this.#globalFilterHandler,
      );
    }

    /** Unwire filter listeners on disconnect. */
    #unwireFilterListeners() {
      if (this.#containerEl && this.#containerFilterHandler) {
        this.#containerEl.removeEventListener(
          "containerfilterchange",
          this.#containerFilterHandler,
        );
      }
      if (this.#globalFilterHandler) {
        document.removeEventListener(
          "globalfilterchange",
          this.#globalFilterHandler,
        );
      }
      this.#containerFilterHandler = null;
      this.#globalFilterHandler = null;
      this.#containerEl = null;
    }

    /**
     * Handle container-scoped filter changes (sort, segment, value filters).
     * Sets attributes for sort/segment; re-queries for value filters.
     */
    #onContainerFilter(e) {
      const filters = e.detail?.filters || [];
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
        }
      }

      // Sort → attributes (triggers onAttributeChanged → re-render)
      if (sortFilter) {
        this.setAttribute("data-sort-field", sortFilter.field);
        this.setAttribute("data-sort-direction", sortFilter.mode || "asc");
      } else {
        this.removeAttribute("data-sort-field");
        this.removeAttribute("data-sort-direction");
      }

      // Segment → attributes (triggers onAttributeChanged → re-render)
      if (segmentFilter) {
        this.setAttribute("data-segment-field", segmentFilter.field);
        this.setAttribute("data-segment-mode", segmentFilter.mode || "on");
      } else {
        this.removeAttribute("data-segment-field");
        this.removeAttribute("data-segment-mode");
      }

      // Value filters → re-query with merged config
      if (valueFilters.length) {
        this.#reQueryWithFilters(valueFilters);
      }
    }

    /**
     * Handle global filter changes (timerange, global filter bar).
     * Re-queries data with merged global filters.
     */
    #onGlobalFilter(e) {
      const globalFilters = e.detail?.filters || [];
      const timerange = e.detail?.timerange || null;
      const filterEntries = [];

      for (const gf of globalFilters) {
        if (gf.values?.length) {
          filterEntries.push({
            field: gf.field,
            operator: "in",
            values: gf.values,
          });
        }
      }
      if (timerange) {
        filterEntries.push({ type: "timerange", ...timerange });
      }
      if (filterEntries.length) {
        this.#reQueryWithFilters(filterEntries);
      }
    }

    /**
     * Re-query this component's data with additional filter entries
     * merged into its original config.
     */
    #reQueryWithFilters(additionalFilters) {
      const config =
        typeof this.getConfig === "function" ? this.getConfig() : null;
      if (!config || typeof this.setData !== "function") return;
      const mergedFilters = [...(config.filters || []), ...additionalFilters];
      const segmentBy = this.getAttribute("data-segment-field") || undefined;
      this.setData({ ...config, filters: mergedFilters, segmentBy });
    }

    /* ══════════════════════════════════════════════════════════
       Lifecycle — auto-load + filter wiring
       ══════════════════════════════════════════════════════════ */

    /**
     * Wire filter listeners and auto-load if query attributes are set.
     * Global filters are seeded from the shared global-filters utility.
     */
    onConnect() {
      super.onConnect?.();
      this.#wireFilterListeners();
      if (this.querySrc && this.queryKey) {
        this.load();
      }
    }

    /**
     * Clean up filter listeners on disconnect.
     */
    onDisconnect() {
      super.onDisconnect?.();
      this.#unwireFilterListeners();
    }

    /* ── Query loading ────────────────────────────────────────── */

    /**
     * Load data from a query bundle.
     *
     * Reads data-query-src and data-query-key, fetches the JSON bundle
     * (cached), extracts the matching entry, merges it with display
     * attributes already on the element, and calls this.setData().
     *
     * When called without arguments (e.g. from auto-load), global
     * filters are seeded from the shared global-filters utility.
     */
    async load(initialFilters) {
      // Seed from global filter state when no explicit filters passed
      if (initialFilters === undefined) {
        initialFilters = getInitialFilters();
      }
      const src = this.querySrc;
      const key = this.queryKey;
      if (!src || !key) return;

      try {
        const bundle = await fetchQueryBundle(src);
        const query = bundle[key];
        if (!query) {
          console.warn(`[ContentAttributes] Key "${key}" not found in ${src}`);
          return;
        }

        // Build config from query fields + element display attributes
        const config = { ...query };

        // Display attributes from the element (always override)
        config.name = this.name || query.name || "";
        config.queryKey = key;
        if (this.hasAttribute("data-show-status"))
          config.showStatus = this.showStatus;
        if (this.hasAttribute("data-unit")) config.unit = this.unit;
        if (this.hasAttribute("data-visible")) config.visible = this.visible;

        // Element-level query overrides (when explicitly set)
        if (this.hasAttribute("data-dataset"))
          config.dataset = this.datasetName;
        if (this.hasAttribute("data-category")) config.category = this.category;
        if (this.hasAttribute("data-series")) config.series = this.series;
        if (this.hasAttribute("data-value-field"))
          config.value = this.valueField;
        if (this.hasAttribute("data-agg")) config.agg = this.agg;
        if (this.hasAttribute("data-filters")) config.filters = this.filters;
        if (this.hasAttribute("data-order-by")) config.orderBy = this.orderBy;
        if (this.hasAttribute("data-limit")) config.limit = this.limit;
        if (this.hasAttribute("data-measures")) config.measures = this.measures;

        // Normalize values → measures for the attribute system
        const attrConfig = { ...config };
        if (
          Array.isArray(config.values) &&
          config.values.length &&
          !config.measures?.length
        ) {
          attrConfig.measures = config.values;
        }
        // Merge any pre-seeded global filters (e.g. default timerange)
        if (initialFilters.length) {
          config.filters = [...(config.filters || []), ...initialFilters];
        }

        // Persist all fields as attributes so getConfig() returns the full picture
        this.setConfig(attrConfig);

        if (typeof this.setData === "function") {
          await this.setData(config);
        }
      } catch (e) {
        console.error(`[ContentAttributes] Failed to load ${src}#${key}:`, e);
      }
    }
  };
}
