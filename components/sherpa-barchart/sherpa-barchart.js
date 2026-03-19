/**
 * @element sherpa-barchart
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
 * @fires sortchange
 *   bubbles: true, composed: true
 *   detail: { field: string, direction: "asc" | "desc" }
 * @fires presentationchange
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
} from "../utilities/index.js";
import {
  getSegmentField,
  isSegmentEnabled,
  getActiveSort,
} from "../utilities/chart-utils.js";
import { injectFilterMenu, removeFilterMenu } from "../utilities/filter-menu-utils.js";

const CONFIG = {
  maxGridLines: 6,
  numColors: 8,
  maxSegments: 8,
  maxCategories: 8,
  aspectThreshold: 1.2,
};

export class SherpaBarChart extends ContentAttributesMixin(SherpaElement) {
  static cssUrl = new URL("./sherpa-barchart.css", import.meta.url).href;
  static htmlUrl = new URL("./sherpa-barchart.html", import.meta.url).href;

  static get observedAttributes() {
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
  #tipEl = null;
  #filterMenuTpl = null;



  onConnect() {
    super.onConnect();

    // Mark as viz component for container CSS targeting
    if (!this.hasAttribute('data-viz')) this.setAttribute('data-viz', '');
    if (!this.hasAttribute('data-filters')) this.toggleAttribute('data-filters', true);

    // Initialize unique menu ID on first connection
    if (!this.#menuId) {
      this.#menuId = generateUniqueId("barchart");
    }
    this.#resizeObserver = new ResizeObserver((entries) =>
      this.#onResize(entries[0]),
    );
    this.#resizeObserver.observe(this);

    // Inject filter-menu template into light DOM for the header menu
    this.#filterMenuTpl = injectFilterMenu(this);
    this.addEventListener("toggle-filters", this.#onToggleFilters);
    this.addEventListener("toggle-legend", this.#onToggleLegend);
    this.addEventListener("menu-populate", this.#onMenuPopulate);

    // Tooltip element (nested sherpa-tooltip component)
    this.#tipEl = this.$("sherpa-tooltip");

    // Tooltip delegation for chart segments
    this.shadowRoot.addEventListener(
      "pointerenter",
      (e) => {
        const seg = e.target.closest?.(".chart-segment[data-tooltip]");
        if (!seg || !this.#tipEl) return;
        this.#tipEl.showFor(seg, seg.dataset.tooltip);
      },
      true,
    );

    this.shadowRoot.addEventListener(
      "pointerleave",
      (e) => {
        if (e.target.matches?.(".chart-segment")) {
          this.#tipEl?.hide();
        }
      },
      true,
    );
  }

  onAttributeChanged(name, oldValue, newValue) {
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

  onDisconnect() {
    super.onDisconnect();
    this.#resizeObserver?.disconnect();
    this.removeEventListener("toggle-filters", this.#onToggleFilters);
    this.removeEventListener("toggle-legend", this.#onToggleLegend);
    this.removeEventListener("menu-populate", this.#onMenuPopulate);
    removeFilterMenu(this.#filterMenuTpl);
    this.#filterMenuTpl = null;
  }

  #contentData = null; // Standardised data from DataQueryHandler
  #externalFilters = []; // External filters from FilterCoordinator

  // ============ Public API ============

  /** Get the transferable config for switching presentation types */
  getData() {
    if (!this.#contentData) return null;
    const config = getTransferableConfig(this.#contentData, "barchart");
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
    config.segmentField = isSegmentEnabled(this) ? localSeriesField : null;
    config.seriesField = config.segmentField;

    // Preserve original config values for revert after presentation switch
    if (this.#originalOrderBy) config.originalOrderBy = this.#originalOrderBy;
    if (this.#originalSegmentBy)
      config.originalSegmentBy = this.#originalSegmentBy;

    return config;
  }

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

      if (!this.dataset.orientation) {
        const { width, height } = this.getBoundingClientRect();
        if (width && height) {
          this.dataset.orientation =
            width / height > CONFIG.aspectThreshold ? "horizontal" : "vertical";
        } else {
          this.dataset.orientation = "horizontal";
        }
      }

      this.#render();
      return;
    }

    try {
      // Use DataQueryHandler for standardised data preparation
      this.#contentData = await this.fetchContentData(data);

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
    } catch (e) {
      console.error("SherpaBarChart data error:", e);
      this.#contentData = null;
      this.#data = null;
    }

    this.removeAttribute("data-loading");
    await this.rendered;

    // Set default orientation if not yet established by ResizeObserver
    if (!this.dataset.orientation) {
      const { width, height } = this.getBoundingClientRect();
      if (width && height) {
        this.dataset.orientation =
          width / height > CONFIG.aspectThreshold ? "horizontal" : "vertical";
      } else {
        this.dataset.orientation = "horizontal";
      }
    }

    this.#render();
  }

  #validateFieldsAgainstColumns() {
    const columns = this.#contentData?.columns || [];
    const segmentField = getSegmentField(this);

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

    const rows = this.#applyExternalFilters(this.#contentData.rows || []);
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

  #applyOrderByFromConfig(data) {
    // If user has set a sort, skip config orderBy
    const activeSort = getActiveSort(this);
    if (activeSort) return data;

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
      ? data.series.map((s) => ({
          ...s,
          values: Array.isArray(s.values) ? [...s.values] : [],
        }))
      : [];

    if (!categories.length || !series.length) return data;

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
      indices.sort((a, b) => {
        const diff =
          this.#getCategoryTotal(series, a) - this.#getCategoryTotal(series, b);
        return (diff !== 0 ? diff : a - b) * dir;
      });
    } else if (
      field === categoryField ||
      normalizedField === categoryField ||
      String(field).includes("dim_")
    ) {
      indices.sort((a, b) => {
        const diff = String(categories[a]).localeCompare(String(categories[b]));
        return (diff !== 0 ? diff : a - b) * dir;
      });
    } else {
      return data;
    }

    return {
      categories: indices.map((i) => categories[i]),
      series: series.map((s) => ({
        ...s,
        values: indices.map((i) => s.values[i]),
      })),
      stacked: data.stacked,
    };
  }

  #buildSeriesFromSegmentField(field, categoryField, measureField) {
    if (
      !field ||
      !this.#contentData?.columns?.length ||
      !this.#contentData?.rows?.length
    ) {
      return null;
    }

    const rows = this.#contentData.rows;

    if (!categoryField || !field) {
      return null;
    }

    const categories = [];
    const categoryBuckets = new Map();
    const segmentKeys = new Set();

    const ensureCategory = (raw) => {
      const label = this.#formatLabel(raw);
      if (!categoryBuckets.has(label)) {
        categoryBuckets.set(label, new Map());
        categories.push(label);
      }
      return label;
    };

    // Seed with existing category order when available
    if (Array.isArray(this.#contentData.categories)) {
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

    const orderedSegments = [...segmentKeys].sort((a, b) => a.localeCompare(b));

    const series = orderedSegments.map((segLabel) => ({
      name: segLabel,
      field,
      values: categories.map((catLabel) => {
        const bucket = categoryBuckets.get(catLabel);
        return bucket ? bucket.get(segLabel) || 0 : 0;
      }),
    }));

    return {
      categories,
      series,
      stacked: orderedSegments.length > 1,
    };
  }

  #formatLabel(value) {
    if (value === null || value === undefined) return "Unknown";
    const str = String(value);
    return str.trim() === "" ? "Unknown" : str;
  }

  #resolveCategoryField(columns, segmentField) {
    const meta = this.#contentData?.metadata || {};
    if (
      meta.primaryField &&
      columns.some((col) => col.field === meta.primaryField)
    ) {
      return meta.primaryField;
    }

    const categoryField = this.#getCategoryField();
    if (categoryField && columns.some((col) => col.field === categoryField)) {
      return categoryField;
    }

    const fallback = columns.find((col) => {
      const type = (col.type || "").toLowerCase();
      return type === "string" || type === "datetime";
    });

    return fallback?.field || segmentField || null;
  }

  #resolveMeasureField(columns, categoryField, segmentField) {
    const numericCols = columns.filter((col) => {
      const type = (col.type || "").toLowerCase();
      return ["number", "numeric", "currency", "percent"].includes(type);
    });

    const preferred = numericCols.find(
      (col) => col.field !== categoryField && col.field !== segmentField,
    );
    if (preferred) return preferred.field;

    const fallback =
      numericCols.find((col) => col.field !== segmentField) || numericCols[0];
    return fallback?.field || null;
  }

  #onResize({ contentRect: { width, height } }) {
    if (!width || !height) return;

    const isHorizontal = width / height > CONFIG.aspectThreshold;
    const orientation = isHorizontal ? "horizontal" : "vertical";

    if (orientation !== this.dataset.orientation) {
      this.dataset.orientation = orientation;
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

    if (!data?.categories?.length || !data?.series?.length) {
      rows.replaceChildren();
      this.dataset.empty = "";
      if (axisValues) axisValues.replaceChildren();
      if (legend) legend.replaceChildren();
      return;
    }

    delete this.dataset.empty;
    const capped = this.#capCategories(data);
    const { categories } = capped;
    let { series } = capped;
    series = this.#capSeries(series);
    const isStacked = this.hasAttribute("data-stacked") || data.stacked;

    const maxValue = this.#getMaxValue(series, isStacked);
    const niceMax = this.#niceNumber(maxValue);

    this.dataset.barCount = categories.length;
    this.dataset.seriesCount = series.length;

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

    if (!data?.categories?.length || !data?.series?.length) {
      rows.replaceChildren();
      this.dataset.empty = "";
      if (axisValues) axisValues.replaceChildren();
      if (legend) legend.replaceChildren();
      return;
    }

    delete this.dataset.empty;

    const capped = this.#capCategories(data);
    const { categories } = capped;
    let { series } = capped;
    series = this.#capSeries(series);
    const isStacked = this.hasAttribute("data-stacked") || data.stacked;
    const maxValue = this.#getMaxValue(series, isStacked);
    const niceMax = this.#niceNumber(maxValue);

    this.dataset.barCount = categories.length;
    this.dataset.seriesCount = series.length;

    // Try in-place update of existing rows
    const existingRows = rows.querySelectorAll(".chart-row");
    if (existingRows.length !== categories.length) {
      this.#renderChart(rows, categories, series, niceMax, isStacked);
    } else {
      existingRows.forEach((row, catIdx) => {
        const label = row.querySelector(".chart-label");
        if (label) {
          label.textContent = categories[catIdx];
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
            bar.innerHTML = this.#createSegments(
              series,
              catIdx,
              niceMax,
              isStacked,
            );
        } else {
          result.segments.forEach((seg, i) => {
            segmentEls[i].style.setProperty(
              "--_segment-size",
              `${seg.percent}%`,
            );
            segmentEls[i].dataset.tooltip = seg.tooltip;
          });
        }
      });
    }

    this.#renderAxis(axisValues, niceMax);
    this.#renderLegend(legend, series);
  }

  #capCategories(data) {
    const { categories, series } = data;
    if (categories.length <= CONFIG.maxCategories) return data;

    const totals = categories.map((_, i) =>
      series.reduce((sum, s) => sum + (s.values[i] || 0), 0)
    );
    const indices = totals
      .map((t, i) => ({ t, i }))
      .sort((a, b) => b.t - a.t)
      .slice(0, CONFIG.maxCategories)
      .map((e) => e.i)
      .sort((a, b) => a - b);

    return {
      ...data,
      categories: indices.map((i) => categories[i]),
      series: series.map((s) => ({
        ...s,
        values: indices.map((i) => s.values[i]),
      })),
    };
  }

  #capSeries(series) {
    if (series.length <= CONFIG.maxSegments) return series;
    const withTotals = series.map(s => ({
      ...s,
      _total: s.values.reduce((a, b) => a + b, 0),
    }));
    withTotals.sort((a, b) => b._total - a._total);
    const kept = withTotals.slice(0, CONFIG.maxSegments - 1);
    const rest = withTotals.slice(CONFIG.maxSegments - 1);
    const otherValues = kept[0].values.map((_, i) =>
      rest.reduce((s, r) => s + (r.values[i] || 0), 0)
    );
    kept.push({ name: 'Other', field: '__other__', values: otherValues });
    return kept.map(({ _total, ...s }) => s);
  }

  #renderControls() {
    const viewOptions = this.getViewOptions({
      activeType: "barchart",
      canShowChart: true,
    });

    // Append "by X" when segmentation is active
    const baseName = this.#contentData?.name || "";
    const segField = isSegmentEnabled(this) ? getSegmentField(this) : null;
    const displayTitle = segField
      ? `${baseName} by ${formatFieldName(segField)}`
      : baseName;

    this.configureHeader({
      title: escapeHtml(displayTitle),
      viewOptions,
    });

    this.wireContentMenu(this, "barchart");
  }

  #applyLocalSort(data) {
    const activeSort = getActiveSort(this);
    if (!activeSort) return data;

    const categories = Array.isArray(data.categories)
      ? [...data.categories]
      : [];
    const series = Array.isArray(data.series)
      ? data.series.map((s) => ({
          ...s,
          values: Array.isArray(s.values) ? [...s.values] : [],
        }))
      : [];

    if (!categories.length || !series.length) return data;

    const indices = categories.map((_, index) => index);
    const dir = activeSort.dir || "asc";

    // Sort by total bar value across all series
    indices.sort((a, b) => {
      const totalA = this.#getCategoryTotal(series, a);
      const totalB = this.#getCategoryTotal(series, b);
      const diff = totalA - totalB;
      return dir === "desc" ? -diff : diff;
    });

    return {
      categories: indices.map((i) => categories[i]),
      series: series.map((s) => ({
        ...s,
        values: indices.map((i) => s.values[i]),
      })),
      stacked: data.stacked,
    };
  }

  #getCategoryTotal(series, index) {
    return series.reduce((sum, s) => {
      if (!Array.isArray(s.values)) return sum;
      const value = Number(s.values[index]);
      return Number.isFinite(value) ? sum + value : sum;
    }, 0);
  }

  #getMaxValue(series, isStacked) {
    if (isStacked) {
      const len = series[0]?.values.length || 0;
      let max = 0;
      for (let i = 0; i < len; i++) {
        const sum = series.reduce((acc, s) => acc + (s.values[i] || 0), 0);
        if (sum > max) max = sum;
      }
      return max || 1;
    }
    return Math.max(...series.flatMap((s) => s.values), 1);
  }

  /** Calculate nice axis maximum for clean labels */
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

  #renderChart(el, categories, series, niceMax, isStacked) {
    el.innerHTML = categories
      .map((cat, catIdx) => {
        const segments = this.#createSegments(
          series,
          catIdx,
          niceMax,
          isStacked,
        );
        return `<div class="chart-row" style="--_i: ${catIdx}">
        <span class="chart-label" title="${escapeHtml(cat)}">${escapeHtml(cat)}</span>
        <div class="chart-bar">${segments}</div>
      </div>`;
      })
      .join("");
  }

  #renderAxis(el, niceMax) {
    if (!el) return;
    const step = niceMax / (CONFIG.maxGridLines - 1);
    el.innerHTML = Array.from(
      { length: CONFIG.maxGridLines },
      (_, i) =>
        `<span class="chart-value">${formatCompact(Math.round(step * i))}</span>`,
    ).join("");
  }

  #calculateSegmentSizes(series, catIdx, niceMax, isStacked) {
    const segments = [];
    if (isStacked) {
      series.forEach((s, i) => {
        const value = s.values[catIdx] || 0;
        if (value > 0) {
          const pct = niceMax > 0 ? (value / niceMax) * 100 : 0;
          segments.push({
            percent: pct,
            tooltip: `${escapeHtml(s.name)}: ${formatCompact(value)}`,
          });
        }
      });
      return { segments };
    }

    const value = series[0]?.values[catIdx] || 0;
    const pct = Math.max(1, (value / niceMax) * 100);
    segments.push({
      percent: pct,
      tooltip: `${escapeHtml(series[0].name)}: ${formatCompact(value)}`,
    });
    return { segments };
  }

  #createSegments(series, catIdx, niceMax, isStacked) {
    if (isStacked) {
      // Each segment sized as absolute % of niceMax
      return series
        .map((s, i) => {
          const value = s.values[catIdx] || 0;
          if (value === 0) return ""; // Don't render 0-value segments
          const pct = niceMax > 0 ? (value / niceMax) * 100 : 0;
          return this.#segmentHtml(s.name, value, pct, i);
        })
        .join("");
    }

    const value = series[0]?.values[catIdx] || 0;
    const pct = Math.max(1, (value / niceMax) * 100);
    return this.#segmentHtml(series[0].name, value, pct, 0);
  }

  #segmentHtml(name, value, percent, colorIdx) {
    return `<div class="chart-segment color-${(colorIdx % CONFIG.numColors) + 1}" 
                 style="--_segment-size: ${percent}%" 
                 data-tooltip="${escapeHtml(name)}: ${formatCompact(value)}"></div>`;
  }

  #renderLegend(el, series) {
    el.innerHTML = series
      .map((s, i) => {
        // Check if series has any non-zero values
        const hasData = s.values.some((v) => v > 0);
        const disabledAttr = hasData ? "" : " data-disabled";
        return `
      <div class="chart-legend-item"${disabledAttr}>
        <span class="chart-legend-key color-${(i % CONFIG.numColors) + 1}"></span>
        <span class="chart-legend-label">${escapeHtml(s.name)}</span>
      </div>`;
      })
      .join("");
  }

  #resolveFieldAlias(field) {
    if (!field || typeof field !== "string") return null;
    if (field.includes(".")) {
      const [table, col] = field.split(".");
      return `${table}_${col}`;
    }
    return field;
  }

  #getCategoryField() {
    const meta = this.#contentData?.metadata || {};
    if (meta.primaryField) return meta.primaryField;

    const dimensions = Array.isArray(meta.dimensions) ? meta.dimensions : [];
    const resolved =
      dimensions.length > 0 ? this.#resolveFieldAlias(dimensions[0]) : null;
    if (
      resolved &&
      this.#contentData?.columns?.some((col) => col.field === resolved)
    ) {
      return resolved;
    }
    return meta.categoryField || null;
  }

  #getValueField() {
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

    const numericColumn = (this.#contentData?.columns || []).find((col) => {
      const type = (col.type || "").toLowerCase();
      return ["number", "numeric", "currency", "percent"].includes(type);
    });
    return numericColumn?.field || null;
  }

  // ============ External Filters (FilterCoordinator integration) ============

  /** @override Apply external filters and re-render chart. */
  setExternalFilters(externalFilters) {
    this.#externalFilters = Array.isArray(externalFilters)
      ? externalFilters
      : [];
    if (this.#contentData) {
      this.#updateDisplayData();
      this.#render();
    }
  }

  #applyExternalFilters(rows) {
    if (!this.#externalFilters.length) return rows;
    return rows.filter((row) =>
      this.#externalFilters.every(({ field, values }) => {
        const val = row[field];
        if (val == null) return false;
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

  #onMenuPopulate = (e) => {
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
