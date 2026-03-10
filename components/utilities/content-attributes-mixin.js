/**
 * ContentAttributesMixin — Shared content configuration + data pipeline.
 *
 * Provides:
 *   • Auto-generated getters/setters for all content config attributes
 *   • getConfig() / setConfig() for serialising/restoring state
 *   • Query loading: data-query-src + data-query-key → load() → setData()
 *   • Auto-load on connect when query attributes are present
 *   • Pluggable data provider: setDataProvider(fn) at module level
 *   • fetchContentData(config) — calls the registered provider
 *   • Self-filtering: containerfilterchange + globalfilterchange listeners
 *   • dispatchVizReady() — fires the vizready event for filter bars
 *   • View-switching header/menu helpers
 *
 * Data provider registration (module-level):
 *   import { setDataProvider, setDateFieldProvider } from './content-attributes-mixin.js';
 *   setDataProvider(async (config) => { ... });
 *   setDateFieldProvider((datasetName) => dateFieldName);
 */

import { getInitialFilters } from "./global-filters.js";

/* ── Pluggable data providers ───────────────────────────────────── */

let _dataProvider = null;
let _dateFieldProvider = null;

export function setDataProvider(fn) {
  _dataProvider = fn;
}
export function setDateFieldProvider(fn) {
  _dateFieldProvider = fn;
}
export function getDateFieldProvider() {
  return _dateFieldProvider;
}

/* ── Query bundle cache ─────────────────────────────────────────── */

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
  querySrc:           ["data-query-src",            "string",  ""],
  queryKey:           ["data-query-key",            "string",  ""],
  name:               ["data-label",                "string",  ""],
  datasetName:        ["data-dataset",              "string",  ""],
  category:           ["data-category",             "string?", null],
  series:             ["data-series",               "string?", null],
  valueField:         ["data-value-field",          "string",  ""],
  agg:                ["data-agg",                  "string",  "sum"],
  measures:           ["data-measures",             "json",    []],
  orderBy:            ["data-order-by",             "json",    []],
  segmentField:       ["data-segment-field",        "string?", null],
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
        // Check both canonical and legacy alias names
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

    /* ── Data Pipeline ──────────────────────────────────────── */

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

    dispatchVizReady() {
      const columns =
        typeof this.getContentColumns === "function"
          ? this.getContentColumns()
          : [];
      const rows =
        typeof this.getContentRows === "function"
          ? this.getContentRows()
          : [];
      this.dispatchEvent(
        new CustomEvent("vizready", {
          bubbles: true,
          composed: true,
          detail: { columns, rows },
        }),
      );
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

      // Show/hide the entire header row via host attribute (CSS handles display)
      const showHeader =
        this.getAttribute("data-show-header") !== "false";
      if (!showHeader) {
        this.setAttribute("data-show-header", "false");
      } else {
        this.removeAttribute("data-show-header");
      }

      // Set title text directly on the native element
      if (titleEl) titleEl.textContent = title || "";

      // Show/hide menu button via host attribute (CSS handles display)
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

        const type = detail.data?.type;
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

      const frag = document.createDocumentFragment();

      const heading = document.createElement("sherpa-menu-item");
      heading.setAttribute("data-type", "heading");
      heading.textContent = "View";
      frag.appendChild(heading);

      const ul = document.createElement("ul");
      ul.dataset.group = "view";

      for (const option of config.viewOptions) {
        const li = document.createElement("li");
        const item = document.createElement("sherpa-menu-item");
        item.setAttribute("data-selection", "radio");
        item.setAttribute("value", option?.type ?? "");
        item.dataset.group = "view";
        if ((option?.type ?? null) === activeType)
          item.setAttribute("checked", "");
        if (option?.disabled) item.setAttribute("disabled", "");
        if (option?.disabledTitle)
          item.setAttribute("data-description", option.disabledTitle);
        item.textContent = option?.label || "";
        li.appendChild(item);
        ul.appendChild(li);
      }

      frag.appendChild(ul);
      this._menuButton?.menuElement?.prepend(frag);
    }

    /* ── Self-filtering ─────────────────────────────────────── */

    #containerFilterHandler = null;
    #globalFilterHandler = null;
    #scopeEl = null;

    #wireFilterListeners() {
      // Listen on parent element for containerfilterchange (no tag-name coupling).
      // The filter-bar dispatches with bubbles:true, so it reaches any ancestor.
      this.#scopeEl = this.parentElement;

      if (this.#scopeEl) {
        this.#containerFilterHandler = (e) =>
          this.#onContainerFilter(e);
        this.#scopeEl.addEventListener(
          "containerfilterchange",
          this.#containerFilterHandler,
        );
      }

      this.#globalFilterHandler = (e) => this.#onGlobalFilter(e);
      document.addEventListener(
        "globalfilterchange",
        this.#globalFilterHandler,
      );
    }

    #unwireFilterListeners() {
      if (this.#scopeEl && this.#containerFilterHandler) {
        this.#scopeEl.removeEventListener(
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
      this.#scopeEl = null;
    }

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
        // New API types (text, number, number-range, datetime-range)
        // and legacy type ("filter") — all go to valueFilters
        valueFilters.push(f);
      }

      if (sortFilter) {
        this.setAttribute("data-sort-field", sortFilter.field);
        this.setAttribute(
          "data-sort-direction",
          sortFilter.mode || "asc",
        );
      } else {
        this.removeAttribute("data-sort-field");
        this.removeAttribute("data-sort-direction");
      }

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

      if (valueFilters.length) {
        this.#reQueryWithFilters(valueFilters);
      }
    }

    #onGlobalFilter(e) {
      const filters = e.detail?.filters || [];
      // Pass all filter entries through to the data pipeline.
      // New API entries are self-describing: { field, type, operator, value, values, range }
      // Legacy entries may include { type: "timeframe", rangeKey, range }
      if (filters.length) {
        this.#reQueryWithFilters(filters);
      }
    }

    #reQueryWithFilters(additionalFilters) {
      const config =
        typeof this.getConfig === "function"
          ? this.getConfig()
          : null;
      if (!config || typeof this.setData !== "function") return;
      const mergedFilters = [
        ...(config.filters || []),
        ...additionalFilters,
      ];
      const segmentBy =
        this.getAttribute("data-segment-field") || undefined;
      this.setData({ ...config, filters: mergedFilters, segmentBy });
    }

    /* ── Lifecycle ──────────────────────────────────────────── */

    onConnect() {
      super.onConnect?.();
      this.#wireFilterListeners();
      if (this.querySrc && this.queryKey) {
        this.load();
      }
    }

    onDisconnect() {
      super.onDisconnect?.();
      this.#unwireFilterListeners();
    }

    /* ── Query loading ──────────────────────────────────────── */

    async load(initialFilters) {
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
          console.warn(
            `[ContentAttributes] Key "${key}" not found in ${src}`,
          );
          return;
        }

        const config = { ...query };

        // Display attributes from the element (always override)
        config.name = this.name || query.name || "";
        config.queryKey = key;
        if (this.hasAttribute("data-show-status"))
          config.showStatus = this.showStatus;
        if (this.hasAttribute("data-unit")) config.unit = this.unit;
        if (this.hasAttribute("data-visible"))
          config.visible = this.visible;

        // Element-level query overrides
        if (this.hasAttribute("data-dataset"))
          config.dataset = this.datasetName;
        if (this.hasAttribute("data-category"))
          config.category = this.category;
        if (this.hasAttribute("data-series"))
          config.series = this.series;
        if (this.hasAttribute("data-value-field"))
          config.value = this.valueField;
        if (this.hasAttribute("data-agg")) config.agg = this.agg;
        if (this.hasAttribute("data-filters"))
          config.filters = this.filters;
        if (this.hasAttribute("data-order-by"))
          config.orderBy = this.orderBy;
        if (this.hasAttribute("data-limit"))
          config.limit = this.limit;
        if (this.hasAttribute("data-measures"))
          config.measures = this.measures;

        // Normalize values → measures
        const attrConfig = { ...config };
        if (
          Array.isArray(config.values) &&
          config.values.length &&
          !config.measures?.length
        ) {
          attrConfig.measures = config.values;
        }
        // Merge pre-seeded global filters
        if (initialFilters.length) {
          config.filters = [
            ...(config.filters || []),
            ...initialFilters,
          ];
        }

        this.setConfig(attrConfig);

        if (typeof this.setData === "function") {
          await this.setData(config);
        }
      } catch (e) {
        console.error(
          `[ContentAttributes] Failed to load ${src}#${key}:`,
          e,
        );
      }
    }
  };

  /* ── Auto-generate getters and setters from ATTR_SCHEMA ─────── */

  for (const [prop, [attr, type, defaultVal]] of Object.entries(
    ATTR_SCHEMA,
  )) {
    // Getter
    Object.defineProperty(cls.prototype, prop, {
      get: makeGetter(attr, type, defaultVal),
      enumerable: true,
      configurable: true,
    });

    // Setter method: setPropertyName(value) { return this; }
    const setterName = `set${prop.charAt(0).toUpperCase()}${prop.slice(1)}`;
    cls.prototype[setterName] = makeSetter(attr, type);
  }

  return cls;
}
