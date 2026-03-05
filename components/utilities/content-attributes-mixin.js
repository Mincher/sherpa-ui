/**
 * ContentAttributesMixin - Shared content configuration attribute handling
 *
 * Provides standardized getters and setters for all content configuration attributes
 * across sherpa-metric, sherpa-base-table, and sherpa-barchart components.
 *
 * Query loading:
 *   data-query-src  — URL to a JSON bundle of named queries
 *   data-query-key  — Key within the bundle to use for this component
 *   load()          — Fetches the bundle, extracts the entry, merges with
 *                     display attributes on the element, and calls setData().
 *
 * Auto-loading:
 *   Components using this mixin auto-call load() when they connect to the
 *   DOM (via onConnect) if data-query-src and data-query-key are both set.
 *   Global filters are seeded from the shared global-filters utility.
 */

import { getInitialFilters } from "./global-filters.js";

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

    /* ── Auto-load on connect ────────────────────────────────── */

    /**
     * If query attributes are present when the element connects,
     * automatically load data. Global filters are seeded from the
     * shared global-filters utility.
     */
    onConnect() {
      super.onConnect?.();
      if (this.querySrc && this.queryKey) {
        this.load();
      }
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
