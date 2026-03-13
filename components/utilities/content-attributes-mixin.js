/**
 * ContentAttributesMixin — Shared content configuration + dataset cascade.
 *
 * Provides:
 *   • Auto-generated getters/setters for all content config attributes
 *   • getConfig() / setConfig() for serialising/restoring state
 *   • Dataset cascade: listens for `datasetfiltered` on nearest ancestor
 *     with [data-dataset], locally aggregates, and calls this.setData()
 *   • Pluggable date-field provider for metric sparklines
 *   • Self-filtering: containerfilterchange sets host attributes,
 *     segment/sort changes trigger local re-aggregate
 *   • View-switching header/menu helpers
 *
 * Architecture:
 *   App shell loads dataset once → applies global filters → dispatches
 *   `datasetfiltered` on content-area element → mixin receives records →
 *   aggregates locally from HTML attributes → calls this.setData().
 *
 *   Segment changes → full re-aggregate from raw records.
 *   Sort changes → re-sort existing aggregated data.
 *   No network fetches from viz components.
 */

import { formatFieldName } from "./format-utils.js";
import {
  groupAndAggregate,
  agg,
  applyLocalFilters,
  applySort,
  buildColumns,
  computeMetricSummary,
} from "./aggregate.js";

/* ── Pluggable providers ────────────────────────────────────────── */

let _dateFieldProvider = null;

/** @deprecated No-op stub — dataset cascade replaces the data provider pattern. */
export function setDataProvider() {}

export function setDateFieldProvider(fn) {
  _dateFieldProvider = fn;
}
export function getDateFieldProvider() {
  return _dateFieldProvider;
}

/* ── Attribute schema ───────────────────────────────────────────── *
 * Each entry: [attr, type, default]
 *   type: 'string' | 'string?' | 'json' | 'json?' | 'int?' | 'bool'
 *   'string'  → getAttribute() || default
 *   'string?' → getAttribute() || null
 *   'json'    → JSON.parse or default
 *   'json?'   → JSON.parse or null
 *   'int?'    → parseInt or null
 *   'bool'    → getAttribute() !== 'false'
 */
const ATTR_SCHEMA = {
  name:               ["data-label",                "string",  ""],
  datasetName:        ["data-dataset",              "string",  ""],
  category:           ["data-category",             "string?", null],
  series:             ["data-series",               "string?", null],
  valueField:         ["data-value-field",          "string",  ""],
  agg:                ["data-agg",                  "string",  "sum"],
  measures:           ["data-measures",             "json",    []],
  orderBy:            ["data-order-by",             "json",    []],
  segmentField:       ["data-segment-field",        "string?", null],
  dateGroupBy:        ["data-date-group-by",        "string?", null],
  showStatus:         ["data-show-status",          "bool",    true],
  unit:               ["data-unit",                 "string?", ""],
  sortField:          ["data-sort-field",           "string?", null],
  sortDirection:      ["data-sort-direction",       "string",  "asc"],
  limit:              ["data-limit",                "int?",    null],
  filters:            ["data-filters",              "json",    []],
  visible:            ["data-visible",              "bool",    true],
  showHeader:         ["data-show-header",          "bool",    true],
  showHeaderControls: ["data-show-header-controls", "bool",    true],
  showViewMenu:       ["data-show-view-menu",       "bool",    true],
  presentationType:   ["data-presentation-type",    "string?", null],
  fields:             ["data-fields",               "json?",   null],
};

/** Flat list of attribute names (used by observedAttributes). */
export const CONTENT_ATTRIBUTES = Object.values(ATTR_SCHEMA).map(
  ([attr]) => attr,
);

/* ── Getter/setter/config generators ────────────────────────────── */

function parseJsonSafe(raw, fallback) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function makeGetter(attr, type, defaultVal) {
  switch (type) {
    case "string":
      return function () {
        return this.getAttribute(attr) || defaultVal;
      };
    case "string?":
      return function () {
        return this.getAttribute(attr) || null;
      };
    case "json":
      return function () {
        return parseJsonSafe(this.getAttribute(attr), defaultVal);
      };
    case "json?":
      return function () {
        return parseJsonSafe(this.getAttribute(attr), null);
      };
    case "int?":
      return function () {
        const v = this.getAttribute(attr);
        return v ? parseInt(v, 10) : null;
      };
    case "bool":
      return function () {
        return this.getAttribute(attr) !== "false";
      };
  }
}

function makeSetter(attr, type) {
  const pascal = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  switch (type) {
    case "string":
      return function (v) {
        this.setAttribute(attr, v);
        return this;
      };
    case "string?":
      return function (v) {
        v ? this.setAttribute(attr, v) : this.removeAttribute(attr);
        return this;
      };
    case "json":
      return function (v) {
        this.setAttribute(attr, JSON.stringify(v || []));
        return this;
      };
    case "json?":
      return function (v) {
        Array.isArray(v)
          ? this.setAttribute(attr, JSON.stringify(v))
          : this.removeAttribute(attr);
        return this;
      };
    case "int?":
      return function (v) {
        v !== null && v !== undefined
          ? this.setAttribute(attr, String(v))
          : this.removeAttribute(attr);
        return this;
      };
    case "bool":
      return function (v) {
        if (v === undefined || v === null) {
          this.removeAttribute(attr);
        } else {
          this.setAttribute(attr, String(Boolean(v)));
        }
        return this;
      };
  }
}

/* ── Measure normalisation ──────────────────────────────────────── */

function normalizeMeasures(config) {
  if (Array.isArray(config.measures) && config.measures.length) return config.measures;
  if (config.valueField) return [{ field: config.valueField, agg: config.agg || 'sum' }];
  return [];
}

/**
 * Mixin factory: adds content attribute support to a component class.
 *
 * Usage:
 *   class SherpaMetric extends ContentAttributesMixin(SherpaElement) { ... }
 */
export function ContentAttributesMixin(Base) {
  const cls = class extends Base {
    /* ── Legacy accessors ───────────────────────────────────── */

    get factTable() {
      return null;
    }
    get dimensions() {
      return [this.category, this.series].filter(Boolean);
    }
    getDataset() {
      return this.datasetName;
    }
    setFactTable() {
      return this;
    }
    setDimensions(dims) {
      if (Array.isArray(dims) && dims.length > 0) this.setCategory(dims[0]);
      if (Array.isArray(dims) && dims.length > 1) this.setSeries(dims[1]);
      return this;
    }

    /** @deprecated Stub for legacy callers — returns config as-is. */
    async fetchContentData(config) {
      console.warn('[ContentAttributesMixin] fetchContentData() is deprecated. Use dataset cascade instead.');
      return config || null;
    }

    /* ── Config serialisation ───────────────────────────────── */

    getConfig() {
      const config = {};
      for (const [prop] of Object.entries(ATTR_SCHEMA)) {
        config[prop] = this[prop];
      }
      // Aliases for backward compat
      config.dataset = config.datasetName;
      config.value = config.valueField;
      config.timerange = this.getAttribute("data-timerange");
      return config;
    }

    setConfig(config) {
      for (const [prop, [attr, type]] of Object.entries(ATTR_SCHEMA)) {
        const val =
          config[prop] ??
          (prop === "datasetName" ? config.dataset : undefined) ??
          (prop === "valueField" ? config.value : undefined);
        if (val !== undefined) {
          const setter = `set${prop.charAt(0).toUpperCase()}${prop.slice(1)}`;
          if (typeof this[setter] === "function") {
            this[setter](val);
          }
        }
      }
      return this;
    }

    /* ── Dataset Cascade ────────────────────────────────────── */

    #records = null;
    #fields = [];
    #datasetAncestor = null;
    #datasetFilteredHandler = null;

    /**
     * Aggregate raw records using host attribute config and call setData().
     * This is the single path from records → rendered component.
     */
    #aggregate() {
      if (!this.#records || typeof this.setData !== "function") return;

      const isMetric = this.presentationType === "kpi-metric" ||
        this.tagName.toLowerCase() === "sherpa-metric";
      const isGrid = this.presentationType === "data-grid" ||
        this.tagName.toLowerCase() === "sherpa-data-grid" ||
        Array.isArray(this.fields);

      // Apply component-level preset filters (e.g. metrics with data-filters)
      const presetFilters = this.filters;
      let records = presetFilters.length
        ? applyLocalFilters(this.#records, presetFilters)
        : this.#records;

      // ── Data Grid: pass raw records (grid does its own filter/sort/group) ──
      if (isGrid) {
        const fieldNames = Array.isArray(this.fields) && this.fields.length
          ? this.fields
          : this.#fields.map((f) => f.name);
        const columns = buildColumns(this.#fields, fieldNames);

        // Sort
        let rows = [...records];
        if (this.orderBy?.length) {
          rows = applySort(rows, this.orderBy);
        }
        // Limit
        if (this.limit && rows.length > this.limit) {
          rows = rows.slice(0, this.limit);
        }

        const displayName = this.name || formatFieldName(this.datasetName || '');
        this.setData({
          _fromCascade: true,
          name: displayName,
          columns,
          allColumns: buildColumns(this.#fields, this.#fields.map((f) => f.name)),
          rows,
          summary: null,
          config: { unit: null, showStatus: false, presentationType: this.presentationType || 'data-grid' },
          metadata: {
            dataset: this.datasetName,
            category: this.category || null,
            measures: [],
            dimensions: [],
            recordCount: records.length,
            timeRange: null,
            orderBy: this.orderBy || [],
            limit: this.limit || null,
            filters: presetFilters,
            fields: Array.isArray(this.fields) ? this.fields : undefined,
          },
        });
        return;
      }

      // ── Metric: count records, compute sparkline ──
      if (isMetric) {
        let dateField = _dateFieldProvider
          ? _dateFieldProvider(this.datasetName)
          : null;

        // Auto-detect date field from metadata when no provider is registered
        if (!dateField && this.#fields.length) {
          const dateFm = this.#fields.find(
            (f) => f.type === 'date' || f.type === 'datetime',
          );
          if (dateFm) dateField = dateFm.name;
        }

        const measures = normalizeMeasures(this);
        const summary = computeMetricSummary(records, measures, dateField, presetFilters);
        const displayName = this.name || formatFieldName(this.datasetName || '');
        let unit = this.unit || null;
        if (!unit && measures.length) {
          const fm = this.#fields.find((f) => f.name === measures[0].field);
          if (fm?.type === 'currency') unit = 'USD';
          else if (fm?.type === 'percent') unit = '%';
        }

        this.setData({
          _fromCascade: true,
          name: displayName,
          columns: [],
          allColumns: buildColumns(this.#fields, this.#fields.map((f) => f.name)),
          rows: [],
          summary,
          config: { unit, showStatus: this.showStatus, presentationType: 'kpi-metric' },
          metadata: {
            dataset: this.datasetName,
            measures,
            dimensions: [],
            recordCount: records.length,
            timeRange: null,
            orderBy: [],
            limit: null,
            filters: presetFilters,
          },
        });
        return;
      }

      // ── Charts: group, aggregate, sort ──
      const measures = normalizeMeasures(this);
      if (!measures.length) {
        // Default to count when no value field specified
        measures.push({ field: '_count', agg: 'count' });
      }

      const groupByFields = [];
      if (this.category) groupByFields.push(this.category);
      if (this.series) groupByFields.push(this.series);

      // Segment field adds a grouping dimension
      const segmentField = this.segmentField;
      if (segmentField && !groupByFields.includes(segmentField)) {
        groupByFields.push(segmentField);
      }

      // Date grouping map
      const dateGroupMap = this.dateGroupBy && this.category
        ? { [this.category]: this.dateGroupBy }
        : undefined;

      // Group & aggregate
      let rows;
      if (groupByFields.length) {
        rows = groupAndAggregate(records, groupByFields, measures, dateGroupMap);
      } else {
        const row = {};
        for (const m of measures) {
          row[m.field] = agg(records.map((r) => r[m.field]), m.agg);
        }
        rows = [row];
      }

      // Sort
      if (this.orderBy?.length) {
        rows = applySort(rows, this.orderBy);
      }

      // Limit
      if (this.limit && rows.length > this.limit) {
        rows = rows.slice(0, this.limit);
      }

      // Build columns
      const visibleFields = [...groupByFields, ...measures.map((m) => m.field)];
      const columns = buildColumns(this.#fields, visibleFields);

      const displayName = this.name || formatFieldName(this.datasetName || '');

      // Resolve unit
      let unit = this.unit || null;
      if (!unit && measures.length) {
        const fm = this.#fields.find((f) => f.name === measures[0].field);
        if (fm?.type === 'currency') unit = 'USD';
        else if (fm?.type === 'percent') unit = '%';
      }

      this.setData({
        _fromCascade: true,
        name: displayName,
        columns,
        allColumns: buildColumns(this.#fields, this.#fields.map((f) => f.name)),
        rows,
        summary: null,
        config: {
          unit,
          showStatus: this.showStatus,
          presentationType: this.presentationType,
        },
        metadata: {
          dataset: this.datasetName,
          category: this.category || null,
          series: this.series || null,
          value: measures[0]?.field || null,
          agg: measures[0]?.agg || 'sum',
          measures,
          dimensions: groupByFields,
          valueField: measures[0]?.field || null,
          categoryField: this.category || null,
          primaryField: this.category || null,
          factTable: null,
          timeRange: null,
          orderBy: this.orderBy || [],
          segmentBy: segmentField || null,
          limit: this.limit || null,
          filters: presetFilters,
          recordCount: records.length,
        },
      });
    }

    /**
     * Handle incoming datasetfiltered event from ancestor.
     */
    #onDatasetFiltered(e) {
      const { records, fields } = e.detail || {};
      if (!Array.isArray(records)) return;

      this.#records = records;
      this.#fields = Array.isArray(fields) ? fields : [];

      // Push field metadata to local filter bar
      this.#syncFilterBarFields();

      // Aggregate and render
      this.#aggregate();

      // Sync filter bar chip state
      this.#syncFilterBarState();
    }

    /**
     * Sync the embedded filter bar's available-fields from dataset fields.
     */
    #syncFilterBarFields() {
      const bar = this.shadowRoot?.querySelector("sherpa-filter-bar");
      if (!bar || !this.#fields.length) return;

      const fields = this.#fields.map((f) => ({
        field: f.name,
        name: f.label || formatFieldName(f.name),
        type: f.type || "string",
      }));
      bar.setAttribute("data-available-fields", JSON.stringify(fields));
    }

    /**
     * Sync the embedded filter bar's segment and sort chips to match
     * the host's current data-segment-field / data-sort-field attributes.
     */
    #syncFilterBarState() {
      const bar = this.shadowRoot?.querySelector("sherpa-filter-bar");
      if (!bar) return;

      // Build a field→displayName map from column metadata
      const fieldNames = new Map();
      try {
        const raw = bar.getAttribute("data-available-fields");
        if (raw) {
          for (const col of JSON.parse(raw)) {
            fieldNames.set(col.field, col.name || col.field);
          }
        }
      } catch { /* ignore malformed JSON */ }
      const displayName = (f) => fieldNames.get(f) || formatFieldName(f);

      bar.dataset.syncing = "";

      // ── Segment chip ──
      const segChip = bar.querySelector(
        'sherpa-button[data-behavior="segment"]',
      );
      if (segChip) {
        const field = this.getAttribute("data-segment-field");
        const mode = this.getAttribute("data-segment-mode");
        if (field && mode !== "off") {
          segChip.dataset.field = field;
          segChip.dataset.label = displayName(field);
          segChip.toggleAttribute("data-active", true);
        } else {
          delete segChip.dataset.field;
          segChip.dataset.label = "Group";
          segChip.removeAttribute("data-active");
        }
      }

      // ── Sort chip ──
      const sortChip = bar.querySelector(
        'sherpa-button[data-behavior="sort"]',
      );
      if (sortChip) {
        const sortType = sortChip.dataset.sortType;
        const dir = this.getAttribute("data-sort-direction");

        if (sortType === "time" || sortType === "value") {
          const labels = sortType === "time"
            ? { desc: "Newest first", asc: "Oldest first" }
            : { desc: "Largest first", asc: "Smallest first" };
          if (dir && dir !== "off") {
            sortChip.dataset.mode = dir;
            sortChip.dataset.label = labels[dir] || labels.desc;
            sortChip.dataset.iconStart =
              dir === "desc" ? "\uf063" : "\uf062";
            sortChip.toggleAttribute("data-active", true);
          } else {
            delete sortChip.dataset.mode;
            sortChip.dataset.label = "Sort";
            sortChip.dataset.iconStart = "\uf0dc";
            sortChip.removeAttribute("data-active");
          }
        } else {
          const field = this.getAttribute("data-sort-field");
          if (field) {
            sortChip.dataset.field = field;
            sortChip.dataset.label = displayName(field);
            sortChip.dataset.mode = dir || "asc";
            sortChip.toggleAttribute("data-active", true);
          } else {
            delete sortChip.dataset.field;
            delete sortChip.dataset.mode;
            sortChip.dataset.label = "Sort";
            sortChip.removeAttribute("data-active");
          }
        }
      }

      setTimeout(() => { delete bar.dataset.syncing; }, 0);
    }

    /* ── View-switching ─────────────────────────────────────── */

    #pendingMenuData = null;
    _menuButton = null;
    _menuBound = false;
    _menuCurrentType = "";

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
          disabledTitle: canShowChart
            ? ""
            : "No primary axis field for chart",
        },
      ];
    }

    configureHeader({ title = "", viewOptions = [] } = {}) {
      const titleEl = this.$(".header-title");

      const showHeader =
        this.getAttribute("data-show-header") !== "false";
      if (!showHeader) {
        this.setAttribute("data-show-header", "false");
      } else {
        this.removeAttribute("data-show-header");
      }

      if (titleEl) titleEl.textContent = title || "";

      const showViewMenu =
        this.getAttribute("data-show-view-menu") !== "false";
      const shouldShowMenu = showViewMenu;
      this.toggleAttribute("data-menu-button", shouldShowMenu);
      if (shouldShowMenu) this.dataset.menuButton = "true";

      if (shouldShowMenu) {
        this.#pendingMenuData = { showViewMenu, viewOptions };
      } else {
        this.#pendingMenuData = null;
      }
    }

    async wireContentMenu(root, activeType) {
      if (!this.#pendingMenuData) return;

      const menuButton =
        root.$?.(".menu-button") ||
        root.querySelector?.(".menu-button");
      if (!menuButton?.isConnected) return;

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
        this._menuCurrentType =
          activeType || this._menuCurrentType || "";
      }
    }

    #bindContentMenu(menuButton, activeType) {
      menuButton.addEventListener("menu-select", (event) => {
        const detail = event.detail ?? {};
        if (detail.disabled) return;

        const type = detail.value;
        if (
          type &&
          type !== (this._menuCurrentType || activeType)
        ) {
          this._menuCurrentType = type;
          if (Array.isArray(this.#pendingMenuData?.viewOptions)) {
            this.#pendingMenuData.viewOptions =
              this.#pendingMenuData.viewOptions.map((opt) => ({
                ...opt,
                active: opt.type === type,
              }));
          }

          this.dispatchEvent(
            new CustomEvent("presentationchange", {
              bubbles: true,
              detail: {
                type,
                data: this.getData?.() || null,
              },
            }),
          );
        }
      });
    }

    #populateViewMenu(activeType) {
      const config = this.#pendingMenuData;
      if (!config?.showViewMenu || !config.viewOptions?.length) return;
      if (!this._menuButton) return;

      const viewItems = config.viewOptions.map((option) => ({
        value: option?.type ?? "",
        text: option?.label || "",
        selection: "radio",
        selected: (option?.type ?? null) === activeType,
        disabled: option?.disabled,
        description: option?.disabledTitle,
      }));

      this._menuButton.setMenuItems(
        [{ heading: "View", items: viewItems, group: "view" }],
        { marker: "view" },
      );
    }

    /* ── Container filter handling ───────────────────────────── */

    #containerFilterHandler = null;
    #scopeEl = null;

    #wireFilterListeners() {
      this.#scopeEl = this;

      this.#containerFilterHandler = (e) =>
        this.#onContainerFilter(e);
      this.#scopeEl.addEventListener(
        "containerfilterchange",
        this.#containerFilterHandler,
      );
    }

    #unwireFilterListeners() {
      if (this.#scopeEl && this.#containerFilterHandler) {
        this.#scopeEl.removeEventListener(
          "containerfilterchange",
          this.#containerFilterHandler,
        );
      }
      this.#containerFilterHandler = null;
      this.#scopeEl = null;
    }

    /**
     * Handle local filter bar changes (sort/segment only).
     * Value filters are not used — global filter bar handles all filtering.
     *
     * Sets a guard flag (_suppressAttrReaction) while batch-updating
     * host attributes so that each chart's onAttributeChanged skips
     * redundant heavy processing.  The single #aggregate() call at the
     * end is the authoritative render path.
     */
    #onContainerFilter(e) {
      const filters = e.detail?.filters || [];
      let sortFilter = null;
      let segmentFilter = null;

      for (const f of filters) {
        if (f.type === "sort") { sortFilter = f; continue; }
        if (f.type === "segment") { segmentFilter = f; continue; }
      }

      // Suppress chart onAttributeChanged reactions while we batch-set
      // multiple attributes. Charts check this flag and skip heavy
      // work; the mixin handles the single authoritative re-aggregate.
      this._suppressAttrReaction = true;

      // Sort attrs
      if (sortFilter) {
        if (sortFilter.field) {
          this.setAttribute("data-sort-field", sortFilter.field);
        }
        this.setAttribute(
          "data-sort-direction",
          sortFilter.mode || "asc",
        );
      } else {
        this.removeAttribute("data-sort-field");
        this.removeAttribute("data-sort-direction");
      }

      // Segment attrs
      if (segmentFilter) {
        this.setAttribute(
          "data-segment-field",
          segmentFilter.field,
        );
        this.setAttribute(
          "data-segment-mode",
          segmentFilter.mode || "on",
        );
      } else {
        this.removeAttribute("data-segment-field");
        this.removeAttribute("data-segment-mode");
      }

      this._suppressAttrReaction = false;

      // Single authoritative re-aggregate + render.
      this.#aggregate();
      this.#syncFilterBarState();
    }

    /* ── Lifecycle ──────────────────────────────────────────── */

    onAttributeChanged(name, oldValue, newValue) {
      super.onAttributeChanged?.(name, oldValue, newValue);

      // Sync the embedded filter bar whenever segment or sort
      // attributes change from outside the mixin's own batch flow.
      if (
        !this._suppressAttrReaction &&
        (name === "data-segment-field" ||
          name === "data-segment-mode" ||
          name === "data-sort-field" ||
          name === "data-sort-direction")
      ) {
        this.#syncFilterBarState();
      }
    }

    onConnect() {
      super.onConnect?.();
      this.#wireFilterListeners();
      this.#wireDatasetListener();
    }

    onDisconnect() {
      super.onDisconnect?.();
      this.#unwireFilterListeners();
      this.#unwireDatasetListener();
    }

    /**
     * Find nearest ancestor with [data-dataset] and listen for
     * the datasetfiltered event. If the ancestor already has data
     * cached (._filtered), use it immediately.
     */
    #wireDatasetListener() {
      // Walk up from host to find nearest [data-dataset] content area
      let el = this.closest("[data-dataset]");
      if (!el) {
        // Also check outside shadow roots
        let root = this.getRootNode();
        while (root && root !== document) {
          const host = root.host;
          if (host) {
            el = host.closest("[data-dataset]");
            if (el) break;
          }
          root = host?.getRootNode();
        }
      }
      if (!el) return;

      this.#datasetAncestor = el;
      this.#datasetFilteredHandler = (e) => this.#onDatasetFiltered(e);
      el.addEventListener("datasetfiltered", this.#datasetFilteredHandler);

      // If dataset is already loaded, use cached data immediately
      if (el._filtered) {
        this.#onDatasetFiltered({
          detail: { records: el._filtered, fields: el._fields || [] },
        });
      }
    }

    #unwireDatasetListener() {
      if (this.#datasetAncestor && this.#datasetFilteredHandler) {
        this.#datasetAncestor.removeEventListener(
          "datasetfiltered",
          this.#datasetFilteredHandler,
        );
      }
      this.#datasetAncestor = null;
      this.#datasetFilteredHandler = null;
    }

    /**
     * Re-aggregate from raw records. Called when segment changes.
     * Public so components can force a re-aggregate if needed.
     */
    reAggregate() {
      this.#aggregate();
    }
  };

  /* ── Auto-generate getters and setters from ATTR_SCHEMA ─────── */

  for (const [prop, [attr, type, defaultVal]] of Object.entries(
    ATTR_SCHEMA,
  )) {
    Object.defineProperty(cls.prototype, prop, {
      get: makeGetter(attr, type, defaultVal),
      enumerable: true,
      configurable: true,
    });

    const setterName = `set${prop.charAt(0).toUpperCase()}${prop.slice(1)}`;
    cls.prototype[setterName] = makeSetter(attr, type);
  }

  return cls;
}
