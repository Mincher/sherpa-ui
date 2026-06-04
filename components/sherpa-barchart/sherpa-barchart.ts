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
import { ContentAttributesMixin } from "../utilities/content-attributes-mixin.js";
import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";
import "../sherpa-button/sherpa-button.js";
import "../sherpa-filter-bar/sherpa-filter-bar.js";
import {
  escapeHtml,
  formatFieldName,
  formatCompact,
  generateUniqueId,
  cleanTitleBase,
} from "../utilities/format-utils.js";
import {
  getSegmentField,
  isSegmentEnabled,
  getActiveSort,
  applySegmentBy,
} from "../utilities/chart-utils.js";
import { injectFilterMenu, toggleFilters, toggleLegend, syncFilterMenuItems } from "../utilities/filter-menu-utils.js";

const CONFIG = {
  maxGridLines: 6,
  numColors: 8,
  maxSegments: 8,
  maxCategories: 8,
  aspectThreshold: 1.2,
};

/** A column descriptor from the content payload. */
interface ChartColumn {
  field?: string;
  name?: string;
  type?: string;
}

/** A bar series (one per segment, or a single default series). */
interface BarSeries {
  name?: string;
  values?: number[];
  color?: string;
  [key: string]: unknown;
}

/** Transformed bar-chart data. */
interface BarData {
  categories: string[];
  series: BarSeries[];
  stacked: boolean;
  [key: string]: unknown;
}

/** Metadata accompanying the content payload (field resolution hints). */
interface ChartMetadata {
  primaryField?: string;
  categoryField?: string;
  seriesField?: string;
  valueField?: string;
  field?: string;
  dimensions?: unknown[];
  measures?: unknown[];
  orderBy?: Array<{ field: string; direction?: string }>;
  [key: string]: unknown;
}

/** Aggregated content payload delivered via the dataset cascade. */
interface BarContentData {
  columns?: ChartColumn[];
  rows?: Record<string, unknown>[];
  categories?: unknown[];
  name?: string;
  metadata?: ChartMetadata;
  segmentBy?: string | null;
  originalSegmentBy?: string | null;
  orderBy?: Array<{ field: string; direction?: string }> | string;
  orderDirection?: string;
  originalOrderBy?: { field?: string; direction?: string };
  _fromCascade?: boolean;
  [key: string]: unknown;
}

export class SherpaBarChart extends ContentAttributesMixin(SherpaElement) {
  static override get cssUrl(): string { return new URL("./sherpa-barchart.css", import.meta.url).href; }
  static override get htmlUrl(): string { return new URL("./sherpa-barchart.html", import.meta.url).href; }

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

  #data: BarData | null = null;
  #resizeObserver: ResizeObserver | null = null;
  #menuId: string | null = null;
  #originalOrderBy: { field?: string; direction?: string } | null = null;
  #originalSegmentBy: string | null = null;
  #chartRowTpl: HTMLTemplateElement | null = null;
  #segmentTpl: HTMLTemplateElement | null = null;
  #axisValueTpl: HTMLTemplateElement | null = null;
  #legendItemTpl: HTMLTemplateElement | null = null;
  #bound = false;

  /** The shared tooltip element (a sherpa-tooltip). */
  get #tip(): (HTMLElement & { showFor?: (el: Element, text?: string | null) => void; hide?: () => void }) | null {
    return this.$('sherpa-tooltip');
  }

  override onRender(): void {
    // Mark as viz component for container CSS targeting
    if (!this.hasAttribute('data-viz')) this.setAttribute('data-viz', '');
    if (!this.hasAttribute('data-filters')) this.toggleAttribute('data-filters', true);

    // Initialize unique menu ID on first connection
    if (!this.#menuId) {
      this.#menuId = generateUniqueId("barchart");
    }

    // Cache cloning prototypes
    this.#chartRowTpl = this.$<HTMLTemplateElement>("template.chart-row-tpl");
    this.#segmentTpl = this.$<HTMLTemplateElement>("template.chart-segment-tpl");
    this.#axisValueTpl = this.$<HTMLTemplateElement>("template.axis-value-tpl");
    this.#legendItemTpl = this.$<HTMLTemplateElement>("template.legend-item-tpl");

    if (!this.#bound) {
      this.#resizeObserver = new ResizeObserver((entries) => {
        if (entries[0]) this.#onResize(entries[0]);
      });
      this.#resizeObserver.observe(this);

      // Inject filter-menu template into light DOM for the header menu
      injectFilterMenu(this);
      this.addEventListener("toggle-filters", this.#onToggleFilters);
      this.addEventListener("toggle-legend", this.#onToggleLegend);
      this.addEventListener("menu-populate", this.#onMenuPopulate);

      // Tooltip delegation for chart segments
      this.shadow.addEventListener(
        "pointerenter",
        (e) => {
          const seg = (e.target as HTMLElement | null)?.closest?.<HTMLElement>(".chart-segment[data-tooltip]");
          if (!seg || !this.#tip) return;
          this.#tip.showFor?.(seg, seg.dataset["tooltip"]);
        },
        true,
      );

      this.shadow.addEventListener(
        "pointerleave",
        (e) => {
          if ((e.target as HTMLElement | null)?.matches?.(".chart-segment")) {
            this.#tip?.hide?.();
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
        const layout = this.$<HTMLElement>('.chart-layout');
        if (layout) layout.setAttribute('aria-label', newValue || 'Bar chart');
        break;
      }
      case "data-segment-field":
      case "data-segment-mode":
        if (this.isAttrReactionSuppressed) break;
        // External attribute change — full re-aggregate needed
        if (this.#contentData) this.reAggregate();
        break;
      case "data-sort-field":
      case "data-sort-direction":
        if (this.isAttrReactionSuppressed) break;
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

  #contentData: BarContentData | null = null; // Standardised data from DataQueryHandler
  #externalFilters: Array<{ field: string; values: string[] }> = []; // External filters

  // ============ Public API ============

  /** Get the transferable config for switching presentation types */
  getData() {
    if (!this.#contentData) return null;
    const config = getTransferableConfig(this.#contentData, "barchart") as ReturnType<typeof getTransferableConfig> & {
      segmentField?: string | null;
      seriesField?: string | null;
      originalOrderBy?: { field?: string; direction?: string };
      originalSegmentBy?: string | null;
    };
    const meta: ChartMetadata = this.#contentData.metadata || {};
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

  async setData(data: BarContentData) {
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
      await this.#finalizeDataSetup();
      return;
    }

    this.#contentData = data;

    applySegmentBy(this, data);

    // Validate fields against available columns
    this.#validateFieldsAgainstColumns();
    this.#updateDisplayData();
    await this.#finalizeDataSetup();
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

  #applyOrderByFromConfig(data: BarData): BarData {
    // If user has set a sort, skip config orderBy
    const activeSort = getActiveSort(this);
    if (activeSort) return data;

    const orderBy = this.#contentData?.metadata?.orderBy;
    if (!Array.isArray(orderBy) || orderBy.length === 0) return data;

    const { field, direction = "asc" } = orderBy[0] || {};
    if (!field) return data;

    const normalizedField = this.#resolveFieldAlias(field);

    const dir = direction === "desc" ? -1 : 1;
    const cloned = this.#cloneBarArrays(data);
    if (!cloned) return data;
    const { categories, series } = cloned;

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

    return this.#reorderByIndices(data, categories, series, indices);
  }

  #buildSeriesFromSegmentField(field: string, categoryField: string, measureField: string | null): BarData | null {
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

    const categories: string[] = [];
    const categoryBuckets = new Map<string, Map<string, number>>();
    const segmentKeys = new Set<string>();

    const ensureCategory = (raw: unknown): string => {
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
      const bucket = categoryBuckets.get(catLabel)!;
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

  #formatLabel(value: unknown): string {
    if (value === null || value === undefined) return "Unknown";
    const str = String(value);
    return str.trim() === "" ? "Unknown" : str;
  }

  #resolveCategoryField(columns: ChartColumn[], segmentField: string | null): string | null {
    const meta: ChartMetadata = this.#contentData?.metadata || {};
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

  #resolveMeasureField(columns: ChartColumn[], categoryField: string | null, segmentField: string | null): string | null {
    const numericCols = columns.filter((col) => {
      const type = (col.type || "").toLowerCase();
      return ["number", "numeric", "currency", "percent"].includes(type);
    });

    const preferred = numericCols.find(
      (col) => col.field !== categoryField && col.field !== segmentField,
    );
    if (preferred) return preferred.field ?? null;

    const fallback = numericCols.find((col) => col.field !== segmentField) || numericCols[0];
    return fallback?.field ?? null;
  }

  #onResize({ contentRect: { width, height } }: ResizeObserverEntry) {
    if (!width || !height) return;

    const isHorizontal = width / height > CONFIG.aspectThreshold;
    const orientation = isHorizontal ? "horizontal" : "vertical";

    if (orientation !== this.dataset["orientation"]) {
      this.dataset["orientation"] = orientation;
      if (this.#data) this.#render();
    }
  }

  #prepareChartData() {
    const data = this.#data;
    if (!data?.categories?.length || !data?.series?.length) return null;

    const capped = this.#capCategories(data);
    const { categories } = capped;
    let { series } = capped;
    series = this.#capSeries(series);
    const isStacked = this.hasAttribute("data-stacked") || data.stacked;

    const maxValue = this.#getMaxValue(series, isStacked);
    const niceMax = this.#niceNumber(maxValue);

    this.dataset["barCount"] = String(categories.length);
    this.dataset["seriesCount"] = String(series.length);

    return { categories, series, niceMax, isStacked };
  }

  async #finalizeDataSetup() {
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
  }

  #getChartRenderContext() {
    const rows = this.$<HTMLElement>(".chart-rows");
    const axisValues = this.$<HTMLElement>(".chart-axis-values");
    const legend = this.$<HTMLElement>(".chart-legend");
    if (!rows) return null;
    this.#renderControls();
    const prepared = this.#prepareChartData();
    if (!prepared) {
      rows.replaceChildren();
      this.dataset["empty"] = "";
      if (axisValues) axisValues.replaceChildren();
      if (legend) legend.replaceChildren();
      return null;
    }
    delete this.dataset["empty"];
    return { rows, axisValues, legend, ...prepared };
  }

  #render() {
    const ctx = this.#getChartRenderContext();
    if (!ctx) return;
    const { rows, axisValues, legend, categories, series, niceMax, isStacked } = ctx;
    this.#renderChart(rows, categories, series, niceMax, isStacked);
    if (axisValues) this.#renderAxis(axisValues, niceMax);
    if (legend) this.#renderLegend(legend, series);
    this.#updateAriaLabel(categories, series);
  }

  #updateAriaLabel(categories: string[], series: BarSeries[]) {
    const title = this.getAttribute('data-title') || 'Bar chart';
    const layout = this.$<HTMLElement>('.chart-layout');
    const summary = this.$<HTMLElement>('.chart-sr-summary');
    if (layout) layout.setAttribute('aria-label', title);
    if (summary && categories.length) {
      const totalSeries = series.length;
      const seriesNames = totalSeries > 1 ? ` with ${totalSeries} series` : '';
      summary.textContent = `${title}. ${categories.length} categories${seriesNames}.`;
    }
  }

  #updateChart() {
    const ctx = this.#getChartRenderContext();
    if (!ctx) return;
    const { rows, axisValues, legend, categories, series, niceMax, isStacked } = ctx;

    // Try in-place update of existing rows
    const existingRows = rows.querySelectorAll(".chart-row");
    if (existingRows.length !== categories.length) {
      this.#renderChart(rows, categories, series, niceMax, isStacked);
    } else {
      existingRows.forEach((row, catIdx) => {
        const label = row.querySelector<HTMLElement>(".chart-label");
        if (label) {
          label.textContent = categories[catIdx] ?? "";
          label.title = categories[catIdx] ?? "";
        }
        const result = this.#calculateSegmentSizes(
          series,
          catIdx,
          niceMax,
          isStacked,
        );
        const segmentEls = row.querySelectorAll<HTMLElement>(".chart-segment");
        if (segmentEls.length !== result.segments.length) {
          const bar = row.querySelector(".chart-bar");
          if (bar)
            bar.replaceChildren(
              ...this.#createSegmentNodes(series, catIdx, niceMax, isStacked),
            );
        } else {
          result.segments.forEach((seg, i) => {
            const segEl = segmentEls[i];
            if (!segEl) return;
            segEl.style.setProperty("--_segment-size", `${seg.percent}%`);
            segEl.dataset["tooltip"] = seg.tooltip;
          });
        }
      });
    }

    if (axisValues) this.#renderAxis(axisValues, niceMax);
    if (legend) this.#renderLegend(legend, series);
  }

  #capCategories(data: BarData): BarData {
    const { categories, series } = data;
    if (categories.length <= CONFIG.maxCategories) return data;

    const totals = categories.map((_, i) =>
      series.reduce((sum: any, s: any) => sum + (s.values[i] || 0), 0)
    );
    const indices = totals
      .map((t, i) => ({ t, i }))
      .sort((a: any, b: any) => b.t - a.t)
      .slice(0, CONFIG.maxCategories)
      .map((e) => e.i)
      .sort((a: any, b: any) => a - b);

    return {
      ...data,
      categories: indices.map((i) => categories[i] ?? ""),
      series: series.map((s) => ({
        ...s,
        values: indices.map((i) => s.values?.[i] ?? 0),
      })),
    } satisfies BarData;
  }

  #capSeries(series: BarSeries[]): BarSeries[] {
    if (series.length <= CONFIG.maxSegments) return series;
    type WithTotal = BarSeries & { _total: number };
    const withTotals: WithTotal[] = series.map((s) => ({
      ...s,
      _total: (s.values ?? []).reduce((a, b) => a + b, 0),
    }));
    withTotals.sort((a, b) => b._total - a._total);
    const kept = withTotals.slice(0, CONFIG.maxSegments - 1);
    const rest = withTotals.slice(CONFIG.maxSegments - 1);
    const otherValues = (kept[0]?.values ?? []).map((_, i) =>
      rest.reduce((s, r) => s + (r.values?.[i] || 0), 0)
    );
    kept.push({ name: 'Other', field: '__other__', values: otherValues } as unknown as WithTotal);
    return kept.map(({ _total: _, ...s }) => s);
  }

  #renderControls() {
    const viewOptions = this.getViewOptions({
      activeType: "barchart",
      canShowChart: true,
    });

    // Always clean the base name; layer the active group dynamically
    const entity = cleanTitleBase(this.#contentData?.name || "");
    const segMode = this.getAttribute("data-segment-mode");
    const groupField = this.getAttribute("data-segment-field")
      || this.getAttribute("data-category");
    const hasActiveGroup = segMode !== "off" && !!groupField;
    const displayTitle = hasActiveGroup
      ? `${entity} by ${formatFieldName(groupField)}`
      : `All ${entity}`;

    this.configureHeader({
      title: escapeHtml(displayTitle),
      viewOptions,
    });

    this.wireContentMenu(this, "barchart");
  }

  #applyLocalSort(data: BarData): BarData {
    const activeSort = getActiveSort(this);
    if (!activeSort) return data;

    const cloned = this.#cloneBarArrays(data);
    if (!cloned) return data;
    const { categories, series } = cloned;

    const indices = categories.map((_, index) => index);
    const dir = activeSort.dir || "asc";

    // Sort by total bar value across all series
    indices.sort((a: any, b: any) => {
      const totalA = this.#getCategoryTotal(series, a);
      const totalB = this.#getCategoryTotal(series, b);
      const diff = totalA - totalB;
      return dir === "desc" ? -diff : diff;
    });

    return this.#reorderByIndices(data, categories, series, indices);
  }

  #cloneBarArrays(data: BarData): { categories: string[]; series: BarSeries[] } | null {
    const categories = Array.isArray(data.categories) ? [...data.categories] : [];
    const series = Array.isArray(data.series)
      ? data.series.map((s) => ({ ...s, values: Array.isArray(s.values) ? [...s.values] : [] }))
      : [];
    if (!categories.length || !series.length) return null;
    return { categories, series };
  }

  #reorderByIndices(data: BarData, categories: string[], series: BarSeries[], indices: number[]): BarData {
    return {
      categories: indices.map((i) => categories[i] ?? ""),
      series: series.map((s) => ({
        ...s,
        values: indices.map((i) => s.values?.[i] ?? 0),
      })),
      stacked: data.stacked,
    };
  }

  #getCategoryTotal(series: BarSeries[], index: number): number {
    return series.reduce((sum, s) => {
      if (!Array.isArray(s.values)) return sum;
      const value = Number(s.values[index]);
      return Number.isFinite(value) ? sum + value : sum;
    }, 0);
  }

  #getMaxValue(series: BarSeries[], isStacked: boolean): number {
    if (isStacked) {
      const len = series[0]?.values?.length || 0;
      let max = 0;
      for (let i = 0; i < len; i++) {
        const sum = series.reduce((acc, s) => acc + (s.values?.[i] || 0), 0);
        if (sum > max) max = sum;
      }
      return max || 1;
    }
    return Math.max(...series.flatMap((s) => s.values ?? []), 1);
  }

  /** Calculate nice axis maximum for clean labels */
  #niceNumber(value: number): number {
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

  #renderChart(el: HTMLElement, categories: string[], series: BarSeries[], niceMax: number, isStacked: boolean) {
    const rows = categories.map((cat, catIdx) => {
      const row = this.#chartRowTpl!.content.firstElementChild!.cloneNode(true) as HTMLElement;
      row.style.setProperty("--_i", String(catIdx));
      const label = row.querySelector<HTMLElement>(".chart-label");
      if (label) {
        label.textContent = cat;
        label.title = cat;
      }
      const bar = row.querySelector(".chart-bar");
      bar?.append(...this.#createSegmentNodes(series, catIdx, niceMax, isStacked));
      return row;
    });
    el.replaceChildren(...rows);
  }

  #renderAxis(el: Element | null, niceMax: number) {
    if (!el) return;
    const step = niceMax / (CONFIG.maxGridLines - 1);
    const nodes = Array.from({ length: CONFIG.maxGridLines }, (_, i) => {
      const node = this.#axisValueTpl!.content.firstElementChild!.cloneNode(true) as HTMLElement;
      node.textContent = formatCompact(Math.round(step * i));
      return node;
    });
    el.replaceChildren(...nodes);
  }

  #calculateSegmentSizes(series: BarSeries[], catIdx: number, niceMax: number, isStacked: boolean): { segments: Array<{ percent: number; tooltip: string }> } {
    const segments: Array<{ percent: number; tooltip: string }> = [];
    if (isStacked) {
      series.forEach((s) => {
        const value = s.values?.[catIdx] || 0;
        if (value > 0) {
          const pct = niceMax > 0 ? (value / niceMax) * 100 : 0;
          segments.push({
            percent: pct,
            tooltip: `${s.name}: ${formatCompact(value)}`,
          });
        }
      });
      return { segments };
    }

    const s0 = series[0];
    const value = s0?.values?.[catIdx] || 0;
    const pct = Math.max(1, (value / niceMax) * 100);
    segments.push({
      percent: pct,
      tooltip: `${s0?.name ?? ""}: ${formatCompact(value)}`,
    });
    return { segments };
  }

  #createSegmentNodes(series: BarSeries[], catIdx: number, niceMax: number, isStacked: boolean): HTMLElement[] {
    if (isStacked) {
      const nodes: HTMLElement[] = [];
      series.forEach((s, i) => {
        const value = s.values?.[catIdx] || 0;
        if (value === 0) return; // Don't render 0-value segments
        const pct = niceMax > 0 ? (value / niceMax) * 100 : 0;
        nodes.push(this.#buildSegment(s.name ?? "", value, pct, i));
      });
      return nodes;
    }

    const s0 = series[0];
    const value = s0?.values?.[catIdx] || 0;
    const pct = Math.max(1, (value / niceMax) * 100);
    return [this.#buildSegment(s0?.name ?? "", value, pct, 0)];
  }

  #buildSegment(name: string, value: number, percent: number, colorIdx: number): HTMLElement {
    const node = this.#segmentTpl!.content.firstElementChild!.cloneNode(true) as HTMLElement;
    node.dataset["colorIndex"] = String((colorIdx % CONFIG.numColors) + 1);
    node.style.setProperty("--_segment-size", `${percent}%`);
    node.dataset["tooltip"] = `${name}: ${formatCompact(value)}`;
    return node;
  }

  #renderLegend(el: HTMLElement, series: BarSeries[]) {
    const items = series.map((s, i) => {
      const node = this.#legendItemTpl!.content.firstElementChild!.cloneNode(true) as HTMLElement;
      const hasData = (s.values ?? []).some((v) => v > 0);
      if (!hasData) node.dataset["disabled"] = "";
      const key = node.querySelector<HTMLElement>(".chart-legend-key");
      if (key) key.dataset["colorIndex"] = String((i % CONFIG.numColors) + 1);
      const lbl = node.querySelector(".chart-legend-label");
      if (lbl) lbl.textContent = s.name ?? "";
      return node;
    });
    el.replaceChildren(...items);
  }

  #resolveFieldAlias(field: string | null): string | null {
    if (!field || typeof field !== "string") return null;
    if (field.includes(".")) {
      const [table, col] = field.split(".");
      return `${table}_${col}`;
    }
    return field;
  }

  #getCategoryField() {
    const meta: ChartMetadata = this.#contentData?.metadata || {};
    if (meta.primaryField) return meta.primaryField;

    const dimensions = Array.isArray(meta.dimensions) ? meta.dimensions : [];
    const resolved =
      dimensions.length > 0 ? this.#resolveFieldAlias(String(dimensions[0] ?? "")) : null;
    if (
      resolved &&
      this.#contentData?.columns?.some((col) => col.field === resolved)
    ) {
      return resolved;
    }
    return meta.categoryField || null;
  }

  #getValueField() {
    const meta: ChartMetadata = this.#contentData?.metadata || {};
    if (meta.valueField) return meta.valueField;
    if (meta.field) return meta.field;

    const measures = (Array.isArray(meta.measures) ? meta.measures : []) as Array<{ field?: string }>;
    if (measures.length > 0) {
      const field = measures[0]?.field;
      if (field) {
        return field.includes(".") ? (field.split(".").pop() ?? field) : field;
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
  setExternalFilters(externalFilters: Array<{ field: string; values: string[] }>) {
    this.#externalFilters = Array.isArray(externalFilters)
      ? externalFilters
      : [];
    if (this.#contentData) {
      this.#updateDisplayData();
      this.#render();
    }
  }

  #applyExternalFilters(rows: Record<string, unknown>[]): Record<string, unknown>[] {
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

  #onToggleFilters = () => toggleFilters(this);
  #onToggleLegend  = () => toggleLegend(this);
  #onMenuPopulate  = (e: CustomEvent) => syncFilterMenuItems(e, this);
}

customElements.define("sherpa-barchart", SherpaBarChart);