/**
 * @element sherpa-barchart
 * @category media
 * @description Adaptive bar chart with automatic orientation.
 *   Supports stacked bars, category limiting, and responsive legend.
 *   Extends ContentAttributesMixin(SherpaElement) for data pipeline.
 *
 * @attr {boolean} [data-loading]        — Show loading state
 * @attr {boolean} [data-stacked]        — Stack bars by segment
 * @attr {string}  [data-title]          — Chart heading text
 * @attr {enum}    [data-orientation]     — horizontal | vertical (auto-selected)
 * @attr {string}  [data-segment-field]  — Field for bar grouping
 * @attr {enum}    [data-segment-mode]    — Segment display mode
 * @attr {string}  [data-sort-field]     — Sort field
 * @attr {enum}    [data-sort-direction] — asc | desc
 *
 * @fires sort-change
 *   bubbles: true, composed: true
 *   detail: { field: string, direction: "asc" | "desc" }
 * @fires presentation-change
 *   bubbles: true, composed: true
 *   detail: { type: string, data: object }
 *
 * @method getData()             — Returns transferable config
 * @method setData(data)         — Set chart data and render
 * @method getCategoryField()    — Resolved category field name
 */
import { getTransferableConfig } from "../utilities/data-utils.js";
import {
  ContentAttributesMixin,
  // @ts-expect-error - TODO: Fix type
  CONTENT_ATTRIBUTES,
} from "../utilities/content-attributes-mixin.js";
import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";
import "../sherpa-button/sherpa-button.js";
import "../sherpa-filter-bar/sherpa-filter-bar.js";
import {
  escapeHtml,
  formatFieldName,
  formatCompact,
  generateUniqueId,
  cleanTitleBase,
// @ts-expect-error - TODO: Fix type
} from "../utilities/index.js";
import {
  getSegmentField,
  isSegmentEnabled,
  getActiveSort,
} from "../utilities/chart-utils.js";
import { injectFilterMenu } from "../utilities/filter-menu-utils.js";

const CONFIG = {
  maxGridLines: 6,
  numColors: 8,
  maxSegments: 8,
  maxCategories: 8,
  aspectThreshold: 1.2,
};

export class SherpaBarChart extends ContentAttributesMixin(SherpaElement) {
  // @ts-expect-error - TODO: Fix type
  static cssUrl = new URL("./sherpa-barchart.css", import.meta.url).href;
  // @ts-expect-error - TODO: Fix type
  static htmlUrl = new URL("./sherpa-barchart.html", import.meta.url).href;

  static override get observedAttributes(): string[] {
    return [
      ...super.observedAttributes,
      "data-loading",
      "data-stacked",
      "data-title",
      "data-orientation",
      "data-segment-field",
      "data-segment-mode",
      "data-sort-field",
      "data-sort-direction",
    ];
  }

  #data = null;
  #resizeObserver = null;
  #menuId = null;
  #originalOrderBy = null;
  #originalSegmentBy = null;
  #chartRowTpl = null;
  #segmentTpl = null;
  #axisValueTpl = null;
  #legendItemTpl = null;
  // @ts-expect-error - TODO: Fix type
  #filterMenuTpl = null;
  #bound = false;

  els = this.cacheElements({
    tip: 'sherpa-tooltip'
  });

  override onRender(): void {
    // Mark as viz component for container CSS targeting
    if (!this.hasAttribute('data-viz')) this.setAttribute('data-viz', '');
    if (!this.hasAttribute('data-filters')) this.toggleAttribute('data-filters', true);

    // Initialize unique menu ID on first connection
    if (!this.#menuId) {
      this.#menuId = generateUniqueId("barchart");
    }

    // Cache cloning prototypes
    // @ts-expect-error - TODO: Fix type
    this.#chartRowTpl = this.$("template.chart-row-tpl");
    // @ts-expect-error - TODO: Fix type
    this.#segmentTpl = this.$("template.chart-segment-tpl");
    // @ts-expect-error - TODO: Fix type
    this.#axisValueTpl = this.$("template.axis-value-tpl");
    // @ts-expect-error - TODO: Fix type
    this.#legendItemTpl = this.$("template.legend-item-tpl");

    if (!this.#bound) {
      // @ts-expect-error - TODO: Fix type
      this.#resizeObserver = new ResizeObserver((entries) =>
        // @ts-expect-error - TODO: Fix type
        this.#onResize(entries[0]),
      );
      // @ts-expect-error - TODO: Fix type
      this.#resizeObserver.observe(this);

      // Inject filter-menu template into light DOM for the header menu
      // @ts-expect-error - TODO: Fix type
      this.#filterMenuTpl = injectFilterMenu(this);
      this.addEventListener("toggle-filters", this.#onToggleFilters);
      this.addEventListener("toggle-legend", this.#onToggleLegend);
      // @ts-expect-error - TODO: Fix type
      this.addEventListener("menu-populate", this.#onMenuPopulate);

      // Tooltip delegation for chart segments
      // @ts-expect-error - TODO: Fix type
      this.shadowRoot.addEventListener(
        "pointerenter",
        (e) => {
          // @ts-expect-error - TODO: Fix type
          const seg = e.target.closest?.(".chart-segment[data-tooltip]");
          if (!seg || !this.els.tip) return;
          // @ts-expect-error - TODO: Fix type
          this.els.tip.showFor(seg, seg.dataset["tooltip"]);
        },
        true,
      );

      // @ts-expect-error - TODO: Fix type
      this.shadowRoot.addEventListener(
        "pointerleave",
        (e) => {
          // @ts-expect-error - TODO: Fix type
          if (e.target.matches?.(".chart-segment")) {
            // @ts-expect-error - TODO: Fix type
            this.els.tip?.hide();
          }
        },
        true,
      );

      this.#bound = true;
    }
  }

  override onAttributeChanged(name: string, oldValue: string | null, newValue: string | null) {
    if (oldValue === newValue) return;
    super.onAttributeChanged(name, oldValue, newValue);

    switch (name) {
      case "data-title": {
        const titleEl = this.$(".header-title");
        if (titleEl) titleEl.textContent = newValue || "";
        break;
      }
      case "data-segment-field":
      case "data-segment-mode":
        if (this._suppressAttrReaction) break;
        // External attribute change — full re-aggregate needed
        if (this.#contentData) this.reAggregate();
        break;
      case "data-sort-field":
      case "data-sort-direction":
        if (this._suppressAttrReaction) break;
        // Local re-sort of existing data
        this.#updateDisplayData();
        this.#updateChart();
        break;
      case "data-stacked":
      case "data-orientation":
        if (this.#data) {
          this.#render();
        }
        break;
      case "data-loading":
        // CSS handles visual loading state — no re-render needed
        break;
      default:
        break;
    }
  }

  #contentData = null; // Standardised data from DataQueryHandler
  #externalFilters = []; // External filters from FilterCoordinator

  // ============ Public API ============

  /** Get the transferable config for switching presentation types */
  getData() {
    if (!this.#contentData) return null;
    const config = getTransferableConfig(this.#contentData, "barchart");
    // @ts-expect-error - TODO: Fix type
    const meta = this.#contentData.metadata || {};
    const categoryField =
      meta.primaryField ||
      meta.categoryField ||
      this.#getCategoryField() ||
      null;
    const segmentField = getSegmentField(this);
    const localSeriesField = segmentField || meta.seriesField || null;

    config.categoryField = categoryField;
    config.valueField =
      meta.valueField ||
      config.valueField ||
      meta.field ||
      this.#getValueField();
    // @ts-expect-error - TODO: Fix type
    config.segmentField = isSegmentEnabled(this) ? localSeriesField : null;
    // @ts-expect-error - TODO: Fix type
    config.seriesField = config.segmentField;

    // Preserve original config values for revert after presentation switch
    // @ts-expect-error - TODO: Fix type
    if (this.#originalOrderBy) config.originalOrderBy = this.#originalOrderBy;
    if (this.#originalSegmentBy)
      // @ts-expect-error - TODO: Fix type
      config.originalSegmentBy = this.#originalSegmentBy;

    return config;
  }

  // @ts-expect-error - TODO: Fix type
  async setData(data) {
    this.setAttribute("data-loading", "");
    const explicitSegmentBy =
      data && Object.prototype.hasOwnProperty.call(data, "segmentBy");

    // Capture original config values for revert-on-off
    if (data?.originalOrderBy) {
      this.#originalOrderBy = data.originalOrderBy;
    } else if (data?.orderBy) {
      const order = Array.isArray(data.orderBy)
        ? data.orderBy[0]
        : { field: data.orderBy, direction: data.orderDirection || "asc" };
      if (order?.field) {
        // @ts-expect-error - TODO: Fix type
        this.#originalOrderBy = {
          field: order.field,
          direction: order.direction || "asc",
        };
      }
    }
    if (data?.originalSegmentBy) {
      this.#originalSegmentBy = data.originalSegmentBy;
    } else if (explicitSegmentBy && data.segmentBy) {
      this.#originalSegmentBy = data.segmentBy;
    }

    // Pre-aggregated data from dataset cascade
    if (data?._fromCascade) {
      this.#contentData = data;
      this.#validateFieldsAgainstColumns();
      this.#updateDisplayData();

      this.removeAttribute("data-loading");
      await this.rendered;

      if (!this.dataset["orientation"]) {
        const { width, height } = this.getBoundingClientRect();
        if (width && height) {
          this.dataset["orientation"] =
            width / height > CONFIG.aspectThreshold ? "horizontal" : "vertical";
        } else {
          this.dataset["orientation"] = "horizontal";
        }
      }

      this.#render();
      return;
    }

    this.#contentData = data;

    // Apply segmentBy from config
    if (explicitSegmentBy) {
      if (data.segmentBy) {
        this.setAttribute("data-segment-field", data.segmentBy);
        this.setAttribute("data-segment-mode", "on");
      } else {
        this.removeAttribute("data-segment-field");
        this.removeAttribute("data-segment-mode");
      }
    }

    // Validate fields against available columns
    this.#validateFieldsAgainstColumns();
    this.#updateDisplayData();

    this.removeAttribute("data-loading");
    await this.rendered;

    // Set default orientation if not yet established by ResizeObserver
    if (!this.dataset["orientation"]) {
      const { width, height } = this.getBoundingClientRect();
      if (width && height) {
        this.dataset["orientation"] =
          width / height > CONFIG.aspectThreshold ? "horizontal" : "vertical";
      } else {
        this.dataset["orientation"] = "horizontal";
      }
    }

    this.#render();
  }

  #validateFieldsAgainstColumns() {
    // @ts-expect-error - TODO: Fix type
    const columns = this.#contentData?.columns || [];
    const segmentField = getSegmentField(this);

    // @ts-expect-error - TODO: Fix type
    if (segmentField && !columns.some((col) => col.field === segmentField)) {
      this.removeAttribute("data-segment-field");
      this.removeAttribute("data-segment-mode");
    }
  }

  // ============ Private Methods ============

  #updateDisplayData() {
    this.#data = this.#computeDisplayData();
  }

  #computeDisplayData() {
    if (!this.#contentData) {
      return { categories: [], series: [], stacked: false };
    }

    // @ts-expect-error - TODO: Fix type
    const rows = this.#applyExternalFilters(this.#contentData.rows || []);
    // @ts-expect-error - TODO: Fix type
    const columns = this.#contentData.columns || [];

    if (!rows.length) {
      return { categories: [], series: [], stacked: false };
    }

    const segmentField = getSegmentField(this);
    const categoryField = this.#resolveCategoryField(columns, segmentField);
    const measureField = this.#resolveMeasureField(
      columns,
      categoryField,
      segmentField,
    );
    const effectiveSegmentField =
      segmentField && segmentField !== categoryField ? segmentField : null;

    if (!categoryField) {
      return { categories: [], series: [], stacked: false };
    }

    // When segmenting is active, delegate to segment logic
    if (effectiveSegmentField && isSegmentEnabled(this)) {
      const segmented = this.#buildSeriesFromSegmentField(
        effectiveSegmentField,
        categoryField,
        measureField,
      );
      if (segmented) return this.#applyLocalSort(segmented);
    }

    // Extract unique categories from first dimension field (in order of appearance)
    const categories = [];
    const seenCategories = new Set();

    for (const row of rows) {
      if (typeof row !== "object" || row === null) continue;
      const catValue = row[categoryField];
      const catLabel = this.#formatLabel(catValue);

      if (!seenCategories.has(catLabel)) {
        categories.push(catLabel);
        seenCategories.add(catLabel);
      }
    }

    // Aggregate values by category
    const categoryValues = new Map();
    for (const row of rows) {
      if (typeof row !== "object" || row === null) continue;
      const catLabel = this.#formatLabel(row[categoryField]);
      const value = measureField ? Number(row[measureField]) || 0 : 1;
      categoryValues.set(catLabel, (categoryValues.get(catLabel) || 0) + value);
    }

    // Build series with aggregated values
    const seriesValues = categories.map((cat) => categoryValues.get(cat) || 0);
    const series = [
      {
        name: measureField || "count",
        field: measureField || "count",
        values: seriesValues,
      },
    ];

    const ordered = this.#applyOrderByFromConfig({
      categories,
      series,
      stacked: false,
    });

    return this.#applyLocalSort(ordered);
  }

  // @ts-expect-error - TODO: Fix type
  #applyOrderByFromConfig(data) {
    // If user has set a sort, skip config orderBy
    const activeSort = getActiveSort(this);
    if (activeSort) return data;

    // @ts-expect-error - TODO: Fix type
    const orderBy = this.#contentData?.metadata?.orderBy;
    if (!Array.isArray(orderBy) || orderBy.length === 0) return data;

    const { field, direction = "asc" } = orderBy[0] || {};
    if (!field) return data;

    const normalizedField = this.#resolveFieldAlias(field);

    const dir = direction === "desc" ? -1 : 1;
    const categories = Array.isArray(data.categories)
      ? [...data.categories]
      : [];
    const series = Array.isArray(data.series)
      // @ts-expect-error - TODO: Fix type
      ? data.series.map((s) => ({
          ...s,
          values: Array.isArray(s.values) ? [...s.values] : [],
        }))
      : [];

    if (!categories.length || !series.length) return data;

    // @ts-expect-error - TODO: Fix type
    const columns = this.#contentData?.columns || [];
    const segmentField = getSegmentField(this);
    const categoryField = this.#resolveCategoryField(columns, segmentField);
    const measureField = this.#resolveMeasureField(
      columns,
      categoryField,
      segmentField,
    );

    const indices = categories.map((_, index) => index);

    if (field === measureField || normalizedField === measureField) {
      indices.sort((a: any, b: any) => {
        const diff =
          this.#getCategoryTotal(series, a) - this.#getCategoryTotal(series, b);
        return (diff !== 0 ? diff : a - b) * dir;
      });
    } else if (
      field === categoryField ||
      normalizedField === categoryField ||
      String(field).includes("dim_")
    ) {
      indices.sort((a: any, b: any) => {
        const diff = String(categories[a]).localeCompare(String(categories[b]));
        return (diff !== 0 ? diff : a - b) * dir;
      });
    } else {
      return data;
    }

    return {
      categories: indices.map((i) => categories[i]),
      // @ts-expect-error - TODO: Fix type
      series: series.map((s) => ({
        ...s,
        values: indices.map((i) => s.values[i]),
      })),
      stacked: data.stacked,
    };
  }

  // @ts-expect-error - TODO: Fix type
  #buildSeriesFromSegmentField(field, categoryField, measureField) {
    if (
      !field ||
      // @ts-expect-error - TODO: Fix type
      !this.#contentData?.columns?.length ||
      // @ts-expect-error - TODO: Fix type
      !this.#contentData?.rows?.length
    ) {
      return null;
    }

    // @ts-expect-error - TODO: Fix type
    const rows = this.#contentData.rows;

    if (!categoryField || !field) {
      return null;
    }

    // @ts-expect-error - TODO: Fix type
    const categories = [];
    const categoryBuckets = new Map();
    const segmentKeys = new Set();

    // @ts-expect-error - TODO: Fix type
    const ensureCategory = (raw) => {
      const label = this.#formatLabel(raw);
      if (!categoryBuckets.has(label)) {
        categoryBuckets.set(label, new Map());
        categories.push(label);
      }
      return label;
    };

    // Seed with existing category order when available
    // @ts-expect-error - TODO: Fix type
    if (Array.isArray(this.#contentData.categories)) {
      // @ts-expect-error - TODO: Fix type
      this.#contentData.categories.forEach((cat) => ensureCategory(cat));
    }

    // Use object field access instead of array indices
    for (const row of rows) {
      if (typeof row !== "object" || row === null) continue;
      const catLabel = ensureCategory(row[categoryField]);
      const segLabel = this.#formatLabel(row[field]);
      const value = measureField ? Number(row[measureField]) || 0 : 1;
      const bucket = categoryBuckets.get(catLabel);
      bucket.set(segLabel, (bucket.get(segLabel) || 0) + value);
      segmentKeys.add(segLabel);
    }

    if (!segmentKeys.size) {
      return null;
    }

    const orderedSegments = [...segmentKeys].sort((a: any, b: any) => a.localeCompare(b));

    const series = orderedSegments.map((segLabel) => ({
      name: segLabel,
      field,
      // @ts-expect-error - TODO: Fix type
      values: categories.map((catLabel) => {
        const bucket = categoryBuckets.get(catLabel);
        return bucket ? bucket.get(segLabel) || 0 : 0;
      }),
    }));

    return {
      // @ts-expect-error - TODO: Fix type
      categories,
      series,
      stacked: orderedSegments.length > 1,
    };
  }

  // @ts-expect-error - TODO: Fix type
  #formatLabel(value) {
    if (value === null || value === undefined) return "Unknown";
    const str = String(value);
    return str.trim() === "" ? "Unknown" : str;
  }

  // @ts-expect-error - TODO: Fix type
  #resolveCategoryField(columns, segmentField) {
    // @ts-expect-error - TODO: Fix type
    const meta = this.#contentData?.metadata || {};
    if (
      meta.primaryField &&
      // @ts-expect-error - TODO: Fix type
      columns.some((col) => col.field === meta.primaryField)
    ) {
      return meta.primaryField;
    }

    const categoryField = this.#getCategoryField();
    // @ts-expect-error - TODO: Fix type
    if (categoryField && columns.some((col) => col.field === categoryField)) {
      return categoryField;
    }

    // @ts-expect-error - TODO: Fix type
    const fallback = columns.find((col) => {
      const type = (col.type || "").toLowerCase();
      return type === "string" || type === "datetime";
    });

    return fallback?.field || segmentField || null;
  }

  // @ts-expect-error - TODO: Fix type
  #resolveMeasureField(columns, categoryField, segmentField) {
    // @ts-expect-error - TODO: Fix type
    const numericCols = columns.filter((col) => {
      const type = (col.type || "").toLowerCase();
      return ["number", "numeric", "currency", "percent"].includes(type);
    });

    const preferred = numericCols.find(
      // @ts-expect-error - TODO: Fix type
      (col) => col.field !== categoryField && col.field !== segmentField,
    );
    if (preferred) return preferred.field;

    const fallback =
      // @ts-expect-error - TODO: Fix type
      numericCols.find((col) => col.field !== segmentField) || numericCols[0];
    return fallback?.field || null;
  }

  // @ts-expect-error - TODO: Fix type
  #onResize({ contentRect: { width, height } }) {
    if (!width || !height) return;

    const isHorizontal = width / height > CONFIG.aspectThreshold;
    const orientation = isHorizontal ? "horizontal" : "vertical";

    if (orientation !== this.dataset["orientation"]) {
      this.dataset["orientation"] = orientation;
      if (this.#data) this.#render();
    }
  }

  #render() {
    const rows = this.$(".chart-rows");
    const axisValues = this.$(".chart-axis-values");
    const legend = this.$(".chart-legend");

    if (!rows) return;

    const data = this.#data;
    this.#renderControls();

    // @ts-expect-error - TODO: Fix type
    if (!data?.categories?.length || !data?.series?.length) {
      rows.replaceChildren();
      this.dataset["empty"] = "";
      if (axisValues) axisValues.replaceChildren();
      if (legend) legend.replaceChildren();
      return;
    }

    delete this.dataset["empty"];
    const capped = this.#capCategories(data);
    const { categories } = capped;
    let { series } = capped;
    series = this.#capSeries(series);
    // @ts-expect-error - TODO: Fix type
    const isStacked = this.hasAttribute("data-stacked") || data.stacked;

    const maxValue = this.#getMaxValue(series, isStacked);
    const niceMax = this.#niceNumber(maxValue);

    this.dataset["barCount"] = categories.length;
    this.dataset["seriesCount"] = series.length;

    this.#renderChart(rows, categories, series, niceMax, isStacked);
    this.#renderAxis(axisValues, niceMax);
    this.#renderLegend(legend, series);
  }

  #updateChart() {
    const rows = this.$(".chart-rows");
    const axisValues = this.$(".chart-axis-values");
    const legend = this.$(".chart-legend");

    if (!rows) return;

    const data = this.#data;
    this.#renderControls();

    // @ts-expect-error - TODO: Fix type
    if (!data?.categories?.length || !data?.series?.length) {
      rows.replaceChildren();
      this.dataset["empty"] = "";
      if (axisValues) axisValues.replaceChildren();
      if (legend) legend.replaceChildren();
      return;
    }

    delete this.dataset["empty"];

    const capped = this.#capCategories(data);
    const { categories } = capped;
    let { series } = capped;
    series = this.#capSeries(series);
    // @ts-expect-error - TODO: Fix type
    const isStacked = this.hasAttribute("data-stacked") || data.stacked;
    const maxValue = this.#getMaxValue(series, isStacked);
    const niceMax = this.#niceNumber(maxValue);

    this.dataset["barCount"] = categories.length;
    this.dataset["seriesCount"] = series.length;

    // Try in-place update of existing rows
    const existingRows = rows.querySelectorAll(".chart-row");
    if (existingRows.length !== categories.length) {
      this.#renderChart(rows, categories, series, niceMax, isStacked);
    } else {
      existingRows.forEach((row, catIdx) => {
        const label = row.querySelector(".chart-label");
        if (label) {
          label.textContent = categories[catIdx];
          // @ts-expect-error - TODO: Fix type
          label.title = categories[catIdx];
        }
        const result = this.#calculateSegmentSizes(
          series,
          catIdx,
          niceMax,
          isStacked,
        );
        const segmentEls = row.querySelectorAll(".chart-segment");
        if (segmentEls.length !== result.segments.length) {
          const bar = row.querySelector(".chart-bar");
          if (bar)
            bar.replaceChildren(
              ...this.#createSegmentNodes(series, catIdx, niceMax, isStacked),
            );
        } else {
          result.segments.forEach((seg, i) => {
            // @ts-expect-error - TODO: Fix type
            segmentEls[i].style.setProperty(
              "--_segment-size",
              `${seg.percent}%`,
            );
            // @ts-expect-error - TODO: Fix type
            segmentEls[i].dataset["tooltip"] = seg.tooltip;
          });
        }
      });
    }

    this.#renderAxis(axisValues, niceMax);
    this.#renderLegend(legend, series);
  }

  // @ts-expect-error - TODO: Fix type
  #capCategories(data) {
    const { categories, series } = data;
    if (categories.length <= CONFIG.maxCategories) return data;

    // @ts-expect-error - TODO: Fix type
    const totals = categories.map((_, i) =>
      series.reduce((sum: any, s: any) => sum + (s.values[i] || 0), 0)
    );
    const indices = totals
      // @ts-expect-error - TODO: Fix type
      .map((t, i) => ({ t, i }))
      .sort((a: any, b: any) => b.t - a.t)
      .slice(0, CONFIG.maxCategories)
      // @ts-expect-error - TODO: Fix type
      .map((e) => e.i)
      .sort((a: any, b: any) => a - b);

    return {
      ...data,
      // @ts-expect-error - TODO: Fix type
      categories: indices.map((i) => categories[i]),
      // @ts-expect-error - TODO: Fix type
      series: series.map((s) => ({
        ...s,
        // @ts-expect-error - TODO: Fix type
        values: indices.map((i) => s.values[i]),
      })),
    };
  }

  // @ts-expect-error - TODO: Fix type
  #capSeries(series) {
    if (series.length <= CONFIG.maxSegments) return series;
    const withTotals = series.map((s: any) => ({
      ...s,
      _total: s.values.reduce((a: any, b: any) => a + b, 0),
    }));
    withTotals.sort((a: any, b: any) => b._total - a._total);
    const kept = withTotals.slice(0, CONFIG.maxSegments - 1);
    const rest = withTotals.slice(CONFIG.maxSegments - 1);
    // @ts-expect-error - TODO: Fix type
    const otherValues = kept[0].values.map((_, i) =>
      rest.reduce((s: any, r: any) => s + (r.values[i] || 0), 0)
    );
    kept.push({ name: 'Other', field: '__other__', values: otherValues });
    // @ts-expect-error - TODO: Fix type
    return kept.map(({ _total, ...s }) => s);
  }

  #renderControls() {
    // @ts-expect-error - TODO: Fix type
    const viewOptions = this.getViewOptions({
      activeType: "barchart",
      canShowChart: true,
    });

    // Always clean the base name; layer the active group dynamically
    // @ts-expect-error - TODO: Fix type
    const entity = cleanTitleBase(this.#contentData?.name || "");
    const segMode = this.getAttribute("data-segment-mode");
    const groupField = this.getAttribute("data-segment-field")
      || this.getAttribute("data-category");
    const hasActiveGroup = segMode !== "off" && !!groupField;
    const displayTitle = hasActiveGroup
      ? `${entity} by ${formatFieldName(groupField)}`
      : `All ${entity}`;

    // @ts-expect-error - TODO: Fix type
    this.configureHeader({
      title: escapeHtml(displayTitle),
      viewOptions,
    });

    // @ts-expect-error - TODO: Fix type
    this.wireContentMenu(this, "barchart");
  }

  // @ts-expect-error - TODO: Fix type
  #applyLocalSort(data) {
    const activeSort = getActiveSort(this);
    if (!activeSort) return data;

    const categories = Array.isArray(data.categories)
      ? [...data.categories]
      : [];
    const series = Array.isArray(data.series)
      // @ts-expect-error - TODO: Fix type
      ? data.series.map((s) => ({
          ...s,
          values: Array.isArray(s.values) ? [...s.values] : [],
        }))
      : [];

    if (!categories.length || !series.length) return data;

    const indices = categories.map((_, index) => index);
    const dir = activeSort.dir || "asc";

    // Sort by total bar value across all series
    indices.sort((a: any, b: any) => {
      const totalA = this.#getCategoryTotal(series, a);
      const totalB = this.#getCategoryTotal(series, b);
      const diff = totalA - totalB;
      return dir === "desc" ? -diff : diff;
    });

    return {
      categories: indices.map((i) => categories[i]),
      // @ts-expect-error - TODO: Fix type
      series: series.map((s) => ({
        ...s,
        values: indices.map((i) => s.values[i]),
      })),
      stacked: data.stacked,
    };
  }

  // @ts-expect-error - TODO: Fix type
  #getCategoryTotal(series, index) {
    return series.reduce((sum: any, s: any) => {
      if (!Array.isArray(s.values)) return sum;
      const value = Number(s.values[index]);
      return Number.isFinite(value) ? sum + value : sum;
    }, 0);
  }

  // @ts-expect-error - TODO: Fix type
  #getMaxValue(series, isStacked) {
    if (isStacked) {
      const len = series[0]?.values.length || 0;
      let max = 0;
      for (let i = 0; i < len; i++) {
        const sum = series.reduce((acc: any, s: any) => acc + (s.values[i] || 0), 0);
        if (sum > max) max = sum;
      }
      return max || 1;
    }
    // @ts-expect-error - TODO: Fix type
    return Math.max(...series.flatMap((s) => s.values), 1);
  }

  /** Calculate nice axis maximum for clean labels */
  // @ts-expect-error - TODO: Fix type
  #niceNumber(value) {
    if (value <= 0) return 100;

    const gridLines = CONFIG.maxGridLines;
    const intervals = gridLines - 1; // Number of intervals on axis

    // Calculate the raw interval size needed
    const rawInterval = value / intervals;

    // Find the magnitude of the interval
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawInterval)));

    // Normalize to 1-10 range
    const normalized = rawInterval / magnitude;

    // Choose a nice interval from finer-grained options
    // This gives us tighter bounds than just 1, 2, 5, 10
    let niceInterval;
    if (normalized <= 1) niceInterval = 1;
    else if (normalized <= 1.5) niceInterval = 1.5;
    else if (normalized <= 2) niceInterval = 2;
    else if (normalized <= 2.5) niceInterval = 2.5;
    else if (normalized <= 3) niceInterval = 3;
    else if (normalized <= 4) niceInterval = 4;
    else if (normalized <= 5) niceInterval = 5;
    else if (normalized <= 6) niceInterval = 6;
    else if (normalized <= 8) niceInterval = 8;
    else niceInterval = 10;

    // Calculate the nice max
    const niceMax = niceInterval * magnitude * intervals;

    // Ensure we cover the actual max value
    return niceMax >= value
      ? niceMax
      : niceInterval * magnitude * (intervals + 1);
  }

  // @ts-expect-error - TODO: Fix type
  #renderChart(el, categories, series, niceMax, isStacked) {
    // @ts-expect-error - TODO: Fix type
    const rows = categories.map((cat, catIdx) => {
      // @ts-expect-error - TODO: Fix type
      const row = this.#chartRowTpl.content.firstElementChild.cloneNode(true);
      row.style.setProperty("--_i", catIdx);
      const label = row.querySelector(".chart-label");
      label.textContent = cat;
      label.title = cat;
      const bar = row.querySelector(".chart-bar");
      bar.append(...this.#createSegmentNodes(series, catIdx, niceMax, isStacked));
      return row;
    });
    el.replaceChildren(...rows);
  }

  // @ts-expect-error - TODO: Fix type
  #renderAxis(el, niceMax) {
    if (!el) return;
    const step = niceMax / (CONFIG.maxGridLines - 1);
    const nodes = Array.from({ length: CONFIG.maxGridLines }, (_, i) => {
      // @ts-expect-error - TODO: Fix type
      const node = this.#axisValueTpl.content.firstElementChild.cloneNode(true);
      node.textContent = formatCompact(Math.round(step * i));
      return node;
    });
    el.replaceChildren(...nodes);
  }

  // @ts-expect-error - TODO: Fix type
  #calculateSegmentSizes(series, catIdx, niceMax, isStacked) {
    // @ts-expect-error - TODO: Fix type
    const segments = [];
    if (isStacked) {
      // @ts-expect-error - TODO: Fix type
      series.forEach((s, i) => {
        const value = s.values[catIdx] || 0;
        if (value > 0) {
          const pct = niceMax > 0 ? (value / niceMax) * 100 : 0;
          segments.push({
            percent: pct,
            tooltip: `${s.name}: ${formatCompact(value)}`,
          });
        }
      });
      // @ts-expect-error - TODO: Fix type
      return { segments };
    }

    const value = series[0]?.values[catIdx] || 0;
    const pct = Math.max(1, (value / niceMax) * 100);
    segments.push({
      percent: pct,
      tooltip: `${series[0].name}: ${formatCompact(value)}`,
    });
    return { segments };
  }

  /** @returns {HTMLElement[]} */
  // @ts-expect-error - TODO: Fix type
  #createSegmentNodes(series, catIdx, niceMax, isStacked) {
    if (isStacked) {
      // @ts-expect-error - TODO: Fix type
      const nodes = [];
      // @ts-expect-error - TODO: Fix type
      series.forEach((s, i) => {
        const value = s.values[catIdx] || 0;
        if (value === 0) return; // Don't render 0-value segments
        const pct = niceMax > 0 ? (value / niceMax) * 100 : 0;
        nodes.push(this.#buildSegment(s.name, value, pct, i));
      });
      // @ts-expect-error - TODO: Fix type
      return nodes;
    }

    const value = series[0]?.values[catIdx] || 0;
    const pct = Math.max(1, (value / niceMax) * 100);
    return [this.#buildSegment(series[0].name, value, pct, 0)];
  }

  // @ts-expect-error - TODO: Fix type
  #buildSegment(name, value, percent, colorIdx) {
    // @ts-expect-error - TODO: Fix type
    const node = this.#segmentTpl.content.firstElementChild.cloneNode(true);
    node.dataset["colorIndex"] = String((colorIdx % CONFIG.numColors) + 1);
    node.style.setProperty("--_segment-size", `${percent}%`);
    node.dataset["tooltip"] = `${name}: ${formatCompact(value)}`;
    return node;
  }

  // @ts-expect-error - TODO: Fix type
  #renderLegend(el, series) {
    // @ts-expect-error - TODO: Fix type
    const items = series.map((s, i) => {
      // @ts-expect-error - TODO: Fix type
      const node = this.#legendItemTpl.content.firstElementChild.cloneNode(true);
      // @ts-expect-error - TODO: Fix type
      const hasData = s.values.some((v) => v > 0);
      if (!hasData) node.dataset["disabled"] = "";
      node.querySelector(".chart-legend-key").dataset["colorIndex"] = String((i % CONFIG.numColors) + 1);
      node.querySelector(".chart-legend-label").textContent = s.name;
      return node;
    });
    el.replaceChildren(...items);
  }

  // @ts-expect-error - TODO: Fix type
  #resolveFieldAlias(field) {
    if (!field || typeof field !== "string") return null;
    if (field.includes(".")) {
      const [table, col] = field.split(".");
      return `${table}_${col}`;
    }
    return field;
  }

  #getCategoryField() {
    // @ts-expect-error - TODO: Fix type
    const meta = this.#contentData?.metadata || {};
    if (meta.primaryField) return meta.primaryField;

    const dimensions = Array.isArray(meta.dimensions) ? meta.dimensions : [];
    const resolved =
      dimensions.length > 0 ? this.#resolveFieldAlias(dimensions[0]) : null;
    if (
      resolved &&
      // @ts-expect-error - TODO: Fix type
      this.#contentData?.columns?.some((col) => col.field === resolved)
    ) {
      return resolved;
    }
    return meta.categoryField || null;
  }

  #getValueField() {
    // @ts-expect-error - TODO: Fix type
    const meta = this.#contentData?.metadata || {};
    if (meta.valueField) return meta.valueField;
    if (meta.field) return meta.field;

    const measures = Array.isArray(meta.measures) ? meta.measures : [];
    if (measures.length > 0) {
      const field = measures[0]?.field;
      if (field) {
        return field.includes(".") ? field.split(".").pop() : field;
      }
    }

    // @ts-expect-error - TODO: Fix type
    const numericColumn = (this.#contentData?.columns || []).find((col) => {
      const type = (col.type || "").toLowerCase();
      return ["number", "numeric", "currency", "percent"].includes(type);
    });
    return numericColumn?.field || null;
  }

  // ============ External Filters (FilterCoordinator integration) ============

  /** @override Apply external filters and re-render chart. */
  // @ts-expect-error - TODO: Fix type
  setExternalFilters(externalFilters) {
    // @ts-expect-error - TODO: Fix type
    this.#externalFilters = Array.isArray(externalFilters)
      ? externalFilters
      : [];
    if (this.#contentData) {
      this.#updateDisplayData();
      this.#render();
    }
  }

  // @ts-expect-error - TODO: Fix type
  #applyExternalFilters(rows) {
    if (!this.#externalFilters.length) return rows;
    // @ts-expect-error - TODO: Fix type
    return rows.filter((row) =>
      this.#externalFilters.every(({ field, values }) => {
        const val = row[field];
        if (val == null) return false;
        // @ts-expect-error - TODO: Fix type
        return values.includes(String(val));
      }),
    );
  }

  // ============ Public Data Accessors ============

  /** Public accessor for resolved category field name. */
  getCategoryField() {
    return this.#getCategoryField();
  }

  /* ── Filter menu ─────────────────────────────────────────────── */

  #onToggleFilters = () => {
    this.toggleAttribute("data-filters");
  };

  #onToggleLegend = () => {
    this.toggleAttribute("data-hide-legend");
  };

  #onMenuPopulate = (e: CustomEvent) => {
    const menu = e.detail?.menu;
    if (!menu) return;
    const filterItem = menu.querySelector('sherpa-menu-item[data-event="toggle-filters"]');
    if (filterItem) {
      filterItem.toggleAttribute("checked", this.hasAttribute("data-filters"));
    }
    const legendItem = menu.querySelector('sherpa-menu-item[data-event="toggle-legend"]');
    if (legendItem) {
      legendItem.toggleAttribute("checked", !this.hasAttribute("data-hide-legend"));
    }
  };
}

customElements.define("sherpa-barchart", SherpaBarChart);