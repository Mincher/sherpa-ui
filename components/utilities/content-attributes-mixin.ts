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

import { formatFieldName, getCurrencyCode } from "./format-utils.js";
import {
  groupAndAggregate,
  agg,
  applyLocalFilters,
  applySort,
  buildColumns,
  computeMetricSummary,
} from "./aggregate.js";

/* ── Pluggable providers ────────────────────────────────────────── */

type DateFieldProvider = (() => string | null) | null;

let _dateFieldProvider: DateFieldProvider = null;

export function setDateFieldProvider(fn: DateFieldProvider): void {
  _dateFieldProvider = fn;
}
export function getDateFieldProvider(): DateFieldProvider {
  return _dateFieldProvider;
}

type AttrType = 'string' | 'string?' | 'json' | 'json?' | 'int?' | 'bool';
type AttrDefault = string | number | boolean | null | any[];
type Constructor<T = {}> = new (...args: any[]) => T;

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

/* ── ContentAttributesMixin Interface ───────────────────────────── */

export interface ContentAttributesMixinInterface {
  // Property getters/setters from ATTR_SCHEMA
  name: string;
  datasetName: string;
  category: string | null;
  series: string | null;
  valueField: string;
  agg: string;
  measures: any[];
  orderBy: any[];
  segmentField: string | null;
  dateGroupBy: string | null;
  showStatus: boolean;
  unit: string;
  sortField: string | null;
  sortDirection: string;
  limit: number | null;
  filters: any[];
  visible: boolean;
  showHeader: boolean;
  showHeaderControls: boolean;
  showViewMenu: boolean;
  presentationType: string | null;
  fields: any[] | null;

  // Methods
  getConfig(): any;
  setConfig(config: any): this;
  getDataset(): string;
  setFactTable(): this;
  setDimensions(dims: any[]): this;
  reAggregate(): void;
  _suppressAttrReaction?: boolean;

  // Setters
  setName(v: any): this;
  setDatasetName(v: any): this;
  setCategory(v: any): this;
  setSeries(v: any): this;
  setValueField(v: any): this;
  setAgg(v: any): this;
  setMeasures(v: any): this;
  setOrderBy(v: any): this;
  setSegmentField(v: any): this;
  setDateGroupBy(v: any): this;
  setShowStatus(v: any): this;
  setUnit(v: any): this;
  setSortField(v: any): this;
  setSortDirection(v: any): this;
  setLimit(v: any): this;
  setFilters(v: any): this;
  setVisible(v: any): this;
  setShowHeader(v: any): this;
  setShowHeaderControls(v: any): this;
  setShowViewMenu(v: any): this;
  setPresentationType(v: any): this;
  setFields(v: any): this;
}

/* ── Getter/setter/config generators ────────────────────────────── */

function parseJsonSafe(raw: string | null, fallback: any): any {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function makeGetter(attr: string, type: AttrType, defaultVal: AttrDefault): (this: HTMLElement) => any {
  switch (type) {
    case "string":
      return function (this: HTMLElement) {
        return this.getAttribute(attr) || defaultVal;
      };
    case "string?":
      return function (this: HTMLElement) {
        return this.getAttribute(attr) || null;
      };
    case "json":
      return function (this: HTMLElement) {
        return parseJsonSafe(this.getAttribute(attr), defaultVal);
      };
    case "json?":
      return function (this: HTMLElement) {
        return parseJsonSafe(this.getAttribute(attr), null);
      };
    case "int?":
      return function (this: HTMLElement) {
        const v = this.getAttribute(attr);
        return v ? parseInt(v, 10) : null;
      };
    case "bool":
      return function (this: HTMLElement) {
        return this.getAttribute(attr) !== "false";
      };
  }
}

function makeSetter(attr: string, type: AttrType): (this: HTMLElement, v: any) => any {
  switch (type) {
    case "string":
      return function (this: HTMLElement, v: any) {
        this.setAttribute(attr, v);
        return this;
      };
    case "string?":
      return function (this: HTMLElement, v: any) {
        v ? this.setAttribute(attr, v) : this.removeAttribute(attr);
        return this;
      };
    case "json":
      return function (this: HTMLElement, v: any) {
        this.setAttribute(attr, JSON.stringify(v || []));
        return this;
      };
    case "json?":
      return function (this: HTMLElement, v: any) {
        Array.isArray(v)
          ? this.setAttribute(attr, JSON.stringify(v))
          : this.removeAttribute(attr);
        return this;
      };
    case "int?":
      return function (this: HTMLElement, v: any) {
        v !== null && v !== undefined
          ? this.setAttribute(attr, String(v))
          : this.removeAttribute(attr);
        return this;
      };
    case "bool":
      return function (this: HTMLElement, v: any) {
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

function normalizeMeasures(config: any): any[] {
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
export function ContentAttributesMixin<T extends Constructor<HTMLElement>>(
  Base: T
): Constructor<ContentAttributesMixinInterface> & T {
  const cls: any = class extends Base {
    /* ── Legacy accessors ───────────────────────────────────── */

    get factTable() {
      return null;
    }
    get dimensions() {
      // @ts-expect-error - TODO: Fix type
      return [this.category, this.series].filter(Boolean);
    }
    getDataset() {
      // @ts-expect-error - TODO: Fix type
      return this.datasetName;
    }
    setFactTable() {
      return this;
    }
    // @ts-expect-error - TODO: Fix type
    setDimensions(dims) {
      // @ts-expect-error - TODO: Fix type
      if (Array.isArray(dims) && dims.length > 0) this.setCategory(dims[0]);
      // @ts-expect-error - TODO: Fix type
      if (Array.isArray(dims) && dims.length > 1) this.setSeries(dims[1]);
      return this;
    }


    /* ── Config serialisation ───────────────────────────────── */

    getConfig() {
      const config = {};
      for (const [prop] of Object.entries(ATTR_SCHEMA)) {
        // @ts-expect-error - TODO: Fix type
        config[prop] = this[prop];
      }
      // Aliases for backward compat
      // @ts-expect-error - TODO: Fix type
      config.dataset = config.datasetName;
      // @ts-expect-error - TODO: Fix type
      config.value = config.valueField;
      // @ts-expect-error - TODO: Fix type
      config.timerange = this.getAttribute("data-timerange");
      return config;
    }

    // @ts-expect-error - TODO: Fix type
    setConfig(config) {
      // @ts-expect-error - TODO: Fix type
      for (const [prop, [attr, type]] of Object.entries(ATTR_SCHEMA)) {
        const val =
          config[prop] ??
          (prop === "datasetName" ? config.dataset : undefined) ??
          (prop === "valueField" ? config.value : undefined);
        if (val !== undefined) {
          const setter = `set${prop.charAt(0).toUpperCase()}${prop.slice(1)}`;
          // @ts-expect-error - TODO: Fix type
          if (typeof this[setter] === "function") {
            // @ts-expect-error - TODO: Fix type
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
      // @ts-expect-error - TODO: Fix type
      if (!this.#records || typeof this.setData !== "function") return;

      // @ts-expect-error - TODO: Fix type
      const isMetric = this.presentationType === "kpi-metric" ||
        this.tagName.toLowerCase() === "sherpa-metric";
      // @ts-expect-error - TODO: Fix type
      const isGrid = this.presentationType === "data-grid" ||
        this.tagName.toLowerCase() === "sherpa-data-grid" ||
        // @ts-expect-error - TODO: Fix type
        Array.isArray(this.fields);

      // Apply component-level preset filters (e.g. metrics with data-filters)
      // @ts-expect-error - TODO: Fix type
      const presetFilters = this.filters;
      const records = presetFilters.length
        ? applyLocalFilters(this.#records, presetFilters)
        : this.#records;

      if (isGrid) this.#aggregateGrid(records, presetFilters);
      else if (isMetric) this.#aggregateMetric(records, presetFilters);
      else this.#aggregateChart(records, presetFilters);
    }

    /** Data Grid: pass raw records (grid does its own filter/sort/group) */
    // @ts-expect-error - TODO: Fix type
    #aggregateGrid(records, presetFilters) {
      // @ts-expect-error - TODO: Fix type
      const fieldNames = Array.isArray(this.fields) && this.fields.length
        // @ts-expect-error - TODO: Fix type
        ? this.fields
        // @ts-expect-error - TODO: Fix type
        : this.#fields.map((f) => f.name);
      const columns = buildColumns(this.#fields, fieldNames);

      let rows = [...records];
      // @ts-expect-error - TODO: Fix type
      if (this.orderBy?.length) rows = applySort(rows, this.orderBy);
      // @ts-expect-error - TODO: Fix type
      if (this.limit && rows.length > this.limit) rows = rows.slice(0, this.limit);

      // @ts-expect-error - TODO: Fix type
      const displayName = this.name || formatFieldName(this.datasetName || '');
      // When the user has toggled segmentation off via the filter bar,
      // data-segment-mode is "off" but data-segment-field is preserved so
      // the chip retains its selection. Honour the off state here by not
      // forwarding segmentBy to the grid — otherwise setData() will flip
      // data-segment-mode back to "on" and re-render groups.
      const segmentMode = this.getAttribute("data-segment-mode");
      const segmentField = segmentMode === "off"
        ? null
        // @ts-expect-error - TODO: Fix type
        : this.segmentField || null;
      // @ts-expect-error - TODO: Fix type
      this.setData({
        _fromCascade: true,
        name: displayName,
        columns,
        // @ts-expect-error - TODO: Fix type
        allColumns: buildColumns(this.#fields, this.#fields.map((f) => f.name)),
        rows,
        segmentBy: segmentField,
        summary: null,
        // @ts-expect-error - TODO: Fix type
        config: { unit: null, showStatus: false, presentationType: this.presentationType || 'data-grid' },
        metadata: {
          // @ts-expect-error - TODO: Fix type
          dataset: this.datasetName,
          // @ts-expect-error - TODO: Fix type
          category: this.category || null,
          segmentBy: segmentField,
          measures: [],
          dimensions: [],
          recordCount: records.length,
          timeRange: null,
          // @ts-expect-error - TODO: Fix type
          orderBy: this.orderBy || [],
          // @ts-expect-error - TODO: Fix type
          limit: this.limit || null,
          filters: presetFilters,
          // @ts-expect-error - TODO: Fix type
          fields: Array.isArray(this.fields) ? this.fields : undefined,
        },
      });
    }

    /** Metric: count records, compute sparkline */
    // @ts-expect-error - TODO: Fix type
    #aggregateMetric(records, presetFilters) {
      let dateField = _dateFieldProvider
        // @ts-expect-error - TODO: Fix type
        ? _dateFieldProvider(this.datasetName)
        : null;

      // Auto-detect date field from metadata when no provider is registered.
      if (!dateField && this.#fields.length) {
        const dateFm = this.#fields.find(
          // @ts-expect-error - TODO: Fix type
          (f) => f.type === 'date' || f.type === 'datetime',
        );
        // @ts-expect-error - TODO: Fix type
        if (dateFm) dateField = dateFm.name;
      }

      const measures = normalizeMeasures(this);

      // Resolve _timerange sentinel entries to the actual date field
      // so computeMetricSummary can derive sparkline range bounds.
      const resolvedFilters = dateField
        ? presetFilters.map((f: any) => {
            if (f.field !== '_timerange' || !f.range) return f;
            return [
              { field: dateField, operator: '>=', value: f.range.start instanceof Date ? f.range.start.toISOString() : String(f.range.start) },
              { field: dateField, operator: '<=', value: f.range.end instanceof Date ? f.range.end.toISOString() : String(f.range.end) },
            ];
          }).flat()
        : presetFilters;

      const summary = computeMetricSummary(records, measures, dateField, resolvedFilters);
      // @ts-expect-error - TODO: Fix type
      const displayName = this.name || formatFieldName(this.datasetName || '');
      // @ts-expect-error - TODO: Fix type
      let unit = this.unit || null;
      if (!unit && measures.length) {
        // @ts-expect-error - TODO: Fix type
        const fm = this.#fields.find((f) => f.name === measures[0].field);
        // @ts-expect-error - TODO: Fix type
        if (fm?.type === 'currency') unit = getCurrencyCode();
        // @ts-expect-error - TODO: Fix type
        else if (fm?.type === 'percent') unit = '%';
      }

      // @ts-expect-error - TODO: Fix type
      this.setData({
        _fromCascade: true,
        name: displayName,
        columns: [],
        // @ts-expect-error - TODO: Fix type
        allColumns: buildColumns(this.#fields, this.#fields.map((f) => f.name)),
        rows: [],
        summary,
        // @ts-expect-error - TODO: Fix type
        config: { unit, showStatus: this.showStatus, presentationType: 'kpi-metric' },
        metadata: {
          // @ts-expect-error - TODO: Fix type
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
    }

    /** Charts: group, aggregate, sort */
    // @ts-expect-error - TODO: Fix type
    #aggregateChart(records, presetFilters) {
      const measures = normalizeMeasures(this);
      if (!measures.length) {
        measures.push({ field: '_count', agg: 'count' });
      }

      const groupByFields = [];
      // @ts-expect-error - TODO: Fix type
      if (this.category) groupByFields.push(this.category);
      // @ts-expect-error - TODO: Fix type
      if (this.series) groupByFields.push(this.series);

      // @ts-expect-error - TODO: Fix type
      const segmentField = this.segmentField;
      if (segmentField && !groupByFields.includes(segmentField)) {
        groupByFields.push(segmentField);
      }

      // @ts-expect-error - TODO: Fix type
      const dateGroupMap = this.dateGroupBy && this.category
        // @ts-expect-error - TODO: Fix type
        ? { [this.category]: this.dateGroupBy }
        : undefined;

      let rows: Record<string, unknown>[];
      if (groupByFields.length) {
        rows = groupAndAggregate(records, groupByFields, measures, dateGroupMap);
      } else {
        const row: Record<string, unknown> = {};
        for (const m of measures) {
          row[m.field] = agg(records.map((r: Record<string, unknown>) => r[m.field]), m.agg);
        }
        rows = [row];
      }

      // @ts-expect-error - TODO: Fix type
      if (this.orderBy?.length) rows = applySort(rows, this.orderBy);

      // Apply limit to unique categories, not raw cross-product rows.
      // When a segment field expands each category into N rows (one per
      // segment value), a flat slice would lose entire categories.
      // @ts-expect-error - TODO: Fix type
      if (this.limit && rows.length > this.limit) {
        // @ts-expect-error - TODO: Fix type
        const primaryField = this.category || groupByFields[0];
        if (segmentField && primaryField && primaryField !== segmentField) {
          const seen = new Set();
          const kept = [];
          for (const row of rows) {
            const cat = row[primaryField];
            if (!seen.has(cat)) {
              // @ts-expect-error - TODO: Fix type
              if (seen.size >= this.limit) break;
              seen.add(cat);
            }
            kept.push(row);
          }
          rows = kept;
        } else {
          // @ts-expect-error - TODO: Fix type
          rows = rows.slice(0, this.limit);
        }
      }

      const visibleFields = [...groupByFields, ...measures.map((m) => m.field)];
      const columns = buildColumns(this.#fields, visibleFields);
      // @ts-expect-error - TODO: Fix type
      const displayName = this.name || formatFieldName(this.datasetName || '');

      // @ts-expect-error - TODO: Fix type
      let unit = this.unit || null;
      if (!unit && measures.length) {
        // @ts-expect-error - TODO: Fix type
        const fm = this.#fields.find((f) => f.name === measures[0].field);
        // @ts-expect-error - TODO: Fix type
        if (fm?.type === 'currency') unit = getCurrencyCode();
        // @ts-expect-error - TODO: Fix type
        else if (fm?.type === 'percent') unit = '%';
      }

      // @ts-expect-error - TODO: Fix type
      this.setData({
        _fromCascade: true,
        name: displayName,
        columns,
        // @ts-expect-error - TODO: Fix type
        allColumns: buildColumns(this.#fields, this.#fields.map((f) => f.name)),
        rows,
        summary: null,
        config: {
          unit,
          // @ts-expect-error - TODO: Fix type
          showStatus: this.showStatus,
          // @ts-expect-error - TODO: Fix type
          presentationType: this.presentationType,
        },
        metadata: {
          // @ts-expect-error - TODO: Fix type
          dataset: this.datasetName,
          // @ts-expect-error - TODO: Fix type
          category: this.category || null,
          // @ts-expect-error - TODO: Fix type
          series: this.series || null,
          value: measures[0]?.field || null,
          agg: measures[0]?.agg || 'sum',
          measures,
          dimensions: groupByFields,
          valueField: measures[0]?.field || null,
          // @ts-expect-error - TODO: Fix type
          categoryField: this.category || null,
          // @ts-expect-error - TODO: Fix type
          primaryField: this.category || null,
          factTable: null,
          timeRange: null,
          // @ts-expect-error - TODO: Fix type
          orderBy: this.orderBy || [],
          segmentBy: segmentField || null,
          // @ts-expect-error - TODO: Fix type
          limit: this.limit || null,
          filters: presetFilters,
          recordCount: records.length,
        },
      });
    }

    /**
     * Handle incoming datasetfiltered event from ancestor.
     */
    // @ts-expect-error - TODO: Fix type
    #onDatasetFiltered(e) {
      const { records, fields } = e.detail || {};
      if (!Array.isArray(records)) return;

      // @ts-expect-error - TODO: Fix type
      this.#records = records;
      // @ts-expect-error - TODO: Fix type
      this.#fields = Array.isArray(fields) ? fields : [];

      // Set the syncing guard BEFORE field sync so the filter bar's
      // MutationObserver doesn't fire containerfilterchange while
      // chips are being populated — that would strip segment attrs.
      const bar = this.shadowRoot?.querySelector("sherpa-filter-bar");
      // @ts-expect-error - TODO: Fix type
      if (bar) bar.dataset["syncing"] = "";

      // Sync chip state BEFORE populating menus so that
      // #populateColumnsMenu sees the current data-field and
      // marks the correct radio item as selected.
      this._syncFilterBarState();

      // Push field metadata to local filter bar (triggers menu population)
      this.#syncFilterBarFields();

      // Aggregate and render
      this.#aggregate();

      // Re-sync after aggregate in case fields changed
      this._syncFilterBarState();
    }

    /**
     * Sync the embedded filter bar's available-fields from dataset fields.
     */
    #syncFilterBarFields() {
      const bar = this.shadowRoot?.querySelector("sherpa-filter-bar");
      if (!bar || !this.#fields.length) return;

      const fields = this.#fields.map((f) => ({
        // @ts-expect-error - TODO: Fix type
        field: f.name,
        // @ts-expect-error - TODO: Fix type
        name: f.label || formatFieldName(f.name),
        // @ts-expect-error - TODO: Fix type
        type: f.type || "string",
      }));
      bar.setAttribute("data-available-fields", JSON.stringify(fields));
    }

    /**
     * Sync the embedded filter bar's segment and sort chips to match
     * the host's current data-segment-field / data-sort-field attributes.
     */
    _syncFilterBarState() {
      const bar = this.shadowRoot?.querySelector("sherpa-filter-bar");
      if (!bar) return;

      // Build a field→displayName map from column metadata
      const fieldNames = new Map();
      try {
        const raw = bar.getAttribute("data-available-fields");
        if (raw) {
          for (const col of JSON.parse(raw)) {
            fieldNames.set(col.field, col.name || col.label || col.field);
          }
        }
      } catch { /* ignore malformed JSON */ }
      // @ts-expect-error - TODO: Fix type
      const displayName = (f) => fieldNames.get(f) || formatFieldName(f);

      // @ts-expect-error - TODO: Fix type
      bar.dataset["syncing"] = "";

      // ── Segment chip ──
      // Chips are now in the filter bar's shadow DOM — use the public
      // accessor which falls back to a light DOM query for back-compat.
      const segChip = bar.querySelector(
        'sherpa-button[data-behavior="segment"]',
      // @ts-expect-error - TODO: Fix type
      ) ?? bar.segmentChip;
      if (segChip) {
        // Effective group field: explicit segment override → chart category fallback
        let field = this.getAttribute("data-segment-field")
          || this.getAttribute("data-category");
        const mode = this.getAttribute("data-segment-mode");

        // Validate field exists in the dataset columns
        if (field && fieldNames.size > 0 && !fieldNames.has(field)) {
          field = null;
        }

        if (field && mode !== "off") {
          segChip.dataset["field"] = field;
          segChip.dataset["label"] = `Group: ${displayName(field)}`;
          segChip.toggleAttribute("data-active", true);
        } else if (field) {
          // Field retained but toggled off — keep field & label, deactivate
          segChip.removeAttribute("data-active");
        } else {
          // Sort fully cleared (e.g. "None" picked) — reset chip completely
          delete segChip.dataset["field"];
          segChip.dataset["label"] = "Group";
          segChip.removeAttribute("data-active");
        }
      }

      // ── Sort chip ──
      // Chips are now in the filter bar's shadow DOM — use the public
      // accessor which falls back to a light DOM query for back-compat.
      const sortChip = bar.querySelector(
        'sherpa-button[data-behavior="sort"]',
      // @ts-expect-error - TODO: Fix type
      ) ?? bar.sortChip;
      if (sortChip) {
        // Prefer sort type declared on the chip itself; fall back to the
        // filter bar host attribute (used when chip is in shadow DOM).
        // @ts-expect-error - TODO: Fix type
        const sortType = sortChip.dataset["sortType"] ?? bar.dataset["sortType"];
        const dir = this.getAttribute("data-sort-direction");

        if (sortType === "time" || sortType === "value") {
          const labels = sortType === "time"
            ? { desc: "Newest first", asc: "Oldest first" }
            : { desc: "Largest first", asc: "Smallest first" };
          if (dir && dir !== "off") {
            sortChip.dataset["mode"] = dir;
            // @ts-expect-error - TODO: Fix type
            sortChip.dataset["label"] = labels[dir] || labels.desc;
            sortChip.dataset["iconStart"] =
              dir === "desc" ? "\uf063" : "\uf062";
            sortChip.toggleAttribute("data-active", true);
          } else {
            // Retain chip label — just deactivate
            sortChip.dataset["mode"] = "off";
            sortChip.dataset["iconStart"] = "\uf0dc";
            sortChip.removeAttribute("data-active");
          }
        } else {
          const field = this.getAttribute("data-sort-field");
          if (field && dir && dir !== "off") {
            sortChip.dataset["field"] = field;
            sortChip.dataset["label"] = `Sort: ${displayName(field)}`;
            sortChip.dataset["mode"] = dir;
            sortChip.dataset["iconStart"] =
              dir === "desc" ? "\uf063" : "\uf062";
            sortChip.toggleAttribute("data-active", true);
          } else if (field) {
            // Field retained but direction is off (cycle-off) — keep field & label, deactivate
            sortChip.dataset["field"] = field;
            sortChip.dataset["label"] = `Sort: ${displayName(field)}`;
            sortChip.dataset["mode"] = "off";
            sortChip.dataset["iconStart"] = "\uf0dc";
            sortChip.removeAttribute("data-active");
          } else {
            // Sort fully cleared (e.g. "None" picked) — reset chip completely
            delete sortChip.dataset["field"];
            sortChip.dataset["label"] = "Sort";
            sortChip.dataset["mode"] = "off";
            sortChip.dataset["iconStart"] = "\uf0dc";
            sortChip.removeAttribute("data-active");
          }
        }
      }

      // @ts-expect-error - TODO: Fix type
      setTimeout(() => { delete bar.dataset["syncing"]; }, 0);
    }

    /* ── View-switching ─────────────────────────────────────── */

    #pendingMenuData = null;
    _menuButton = null;
    _menuBound = false;
    _menuCurrentType = "";

    // @ts-expect-error - TODO: Fix type
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
      // @ts-expect-error - TODO: Fix type
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
      if (shouldShowMenu) this.dataset["menuButton"] = "true";

      if (shouldShowMenu) {
        // @ts-expect-error - TODO: Fix type
        this.#pendingMenuData = { showViewMenu, viewOptions };
      } else {
        this.#pendingMenuData = null;
      }
    }

    // @ts-expect-error - TODO: Fix type
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

    // @ts-expect-error - TODO: Fix type
    #bindContentMenu(menuButton, activeType) {
      // @ts-expect-error - TODO: Fix type
      menuButton.addEventListener("menu-select", (event) => {
        const detail = event.detail ?? {};
        if (detail.disabled) return;

        const type = detail.value;
        if (
          type &&
          type !== (this._menuCurrentType || activeType)
        ) {
          this._menuCurrentType = type;
          // @ts-expect-error - TODO: Fix type
          if (Array.isArray(this.#pendingMenuData?.viewOptions)) {
            // @ts-expect-error - TODO: Fix type
            this.#pendingMenuData.viewOptions =
              // @ts-expect-error - TODO: Fix type
              this.#pendingMenuData.viewOptions.map((opt) => ({
                ...opt,
                active: opt.type === type,
              }));
          }

          this.dispatchEvent(
            new CustomEvent("presentation-change", {
              bubbles: true,
              detail: {
                type,
                // @ts-expect-error - TODO: Fix type
                data: this.getData?.() || null,
              },
            }),
          );
        }
      });
    }

    // @ts-expect-error - TODO: Fix type
    #populateViewMenu(activeType) {
      const config = this.#pendingMenuData;
      // @ts-expect-error - TODO: Fix type
      if (!config?.showViewMenu || !config.viewOptions?.length) return;
      if (!this._menuButton) return;

      // @ts-expect-error - TODO: Fix type
      const viewItems = config.viewOptions.map((option) => ({
        value: option?.type ?? "",
        text: option?.label || "",
        selection: "radio",
        selected: (option?.type ?? null) === activeType,
        disabled: option?.disabled,
        description: option?.disabledTitle,
      }));

      // @ts-expect-error - TODO: Fix type
      this._menuButton.setMenuItems(
        [{ heading: "View", items: viewItems, group: "view" }],
        { marker: "view" },
      );
    }

    /* ── Container filter handling ───────────────────────────── */

    #containerFilterHandler = null;
    #scopeEl = null;

    #wireFilterListeners() {
      // @ts-expect-error - TODO: Fix type
      this.#scopeEl = this;

      // @ts-expect-error - TODO: Fix type
      this.#containerFilterHandler = (e) =>
        this.#onContainerFilter(e);
      // @ts-expect-error - TODO: Fix type
      this.#scopeEl.addEventListener(
        "container-filter-change",
        this.#containerFilterHandler,
      );
    }

    #unwireFilterListeners() {
      if (this.#scopeEl && this.#containerFilterHandler) {
        // @ts-expect-error - TODO: Fix type
        this.#scopeEl.removeEventListener(
          "container-filter-change",
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
    // @ts-expect-error - TODO: Fix type
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
      // @ts-expect-error - TODO: Fix type
      this._suppressAttrReaction = true;

      // Sort attrs
      if (sortFilter && sortFilter.field) {
        this.setAttribute("data-sort-field", sortFilter.field);
        this.setAttribute(
          "data-sort-direction",
          sortFilter.mode === "off" ? "off" : (sortFilter.mode || "asc"),
        );
      } else {
        // Sort fully cleared (e.g. "None" picked) — remove field too
        this.removeAttribute("data-sort-field");
        this.setAttribute("data-sort-direction", "off");
      }

      // Segment attrs
      if (segmentFilter && segmentFilter.field) {
        this.setAttribute(
          "data-segment-field",
          segmentFilter.field,
        );
        // The filter-bar chip only knows "on"/"off"; the host attribute
        // additionally supports "expanded"/"collapsed" as default-state
        // hints. Treat all three of "on"/"expanded"/"collapsed" as "active",
        // so a chip reporting "on" should not downgrade an existing
        // "expanded"/"collapsed" value declared in markup.
        const existing = this.getAttribute("data-segment-mode");
        const chipMode = segmentFilter.mode;
        if (chipMode === "off") {
          this.setAttribute("data-segment-mode", "off");
        } else if (chipMode === "expanded" || chipMode === "collapsed") {
          this.setAttribute("data-segment-mode", chipMode);
        } else if (existing !== "expanded" && existing !== "collapsed") {
          this.setAttribute("data-segment-mode", chipMode || "on");
        }
        // else: preserve existing "expanded"/"collapsed"
      } else {
        // Segment fully cleared (e.g. "None" picked) — remove field too
        this.removeAttribute("data-segment-field");
        this.setAttribute("data-segment-mode", "off");
      }

      // @ts-expect-error - TODO: Fix type
      this._suppressAttrReaction = false;

      // Single authoritative re-aggregate + render.
      this.#aggregate();
      this._syncFilterBarState();
    }

    /* ── Lifecycle ──────────────────────────────────────────── */

    // @ts-expect-error - TODO: Fix type
    onAttributeChanged(name, oldValue, newValue) {
      // @ts-expect-error - TODO: Fix type
      super.onAttributeChanged?.(name, oldValue, newValue);

      // Sync the embedded filter bar whenever segment or sort
      // attributes change from outside the mixin's own batch flow.
      if (
        // @ts-expect-error - TODO: Fix type
        !this._suppressAttrReaction &&
        (name === "data-segment-field" ||
          name === "data-segment-mode" ||
          name === "data-sort-field" ||
          name === "data-sort-direction")
      ) {
        this._syncFilterBarState();
      }
    }

    onConnect() {
      // @ts-expect-error - TODO: Fix type
      super.onConnect?.();
      this.#wireFilterListeners();
      this.#wireDatasetListener();
    }

    onDisconnect() {
      // @ts-expect-error - TODO: Fix type
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
          // @ts-expect-error - TODO: Fix type
          const host = root.host;
          if (host) {
            el = host.closest("[data-dataset]");
            if (el) break;
          }
          root = host?.getRootNode();
        }
      }
      if (!el) return;

      // @ts-expect-error - TODO: Fix type
      this.#datasetAncestor = el;
      // @ts-expect-error - TODO: Fix type
      this.#datasetFilteredHandler = (e) => this.#onDatasetFiltered(e);
      // @ts-expect-error - TODO: Fix type
      el.addEventListener("dataset-filtered", this.#datasetFilteredHandler);

      // If dataset is already loaded, use cached data immediately
      // @ts-expect-error - TODO: Fix type
      if (el._filtered) {
        this.#onDatasetFiltered({
          // @ts-expect-error - TODO: Fix type
          detail: { records: el._filtered, fields: el._fields || [] },
        });
      }
    }

    #unwireDatasetListener() {
      if (this.#datasetAncestor && this.#datasetFilteredHandler) {
        // @ts-expect-error - TODO: Fix type
        this.#datasetAncestor.removeEventListener(
          "dataset-filtered",
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
      // @ts-expect-error - TODO: Fix type
      get: makeGetter(attr, type, defaultVal),
      enumerable: true,
      configurable: true,
    });

    const setterName = `set${prop.charAt(0).toUpperCase()}${prop.slice(1)}`;
    // @ts-expect-error - TODO: Fix type
    cls.prototype[setterName] = makeSetter(attr, type);
  }

  return cls;
}
