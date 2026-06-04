/**
 * @element sherpa-data-grid
 * @category data
 * @description Advanced data grid with grouping, selection, sorting, and pagination.
 *   Extends ContentAttributesMixin(SherpaElement) for data pipeline.
 *   Uses native <table> for sticky headers and full-width row backgrounds.
 *
 * @attr {boolean} [data-loading]               — Show loading state
 * @attr {string}  [data-segment-field]          — Field used for row grouping
 * @attr {enum}    [data-segment-mode]            — Segment display mode
 * @attr {string}  [data-sort-field]             — Currently sorted column field
 * @attr {enum}    [data-sort-direction]          — asc | desc
 * @attr {number}  [data-page]                   — Current page (1-based)
 * @attr {number}  [data-page-size]              — Rows per page
 * @attr {boolean} [data-selectable]             — Enable row selection
 * @attr {boolean} [data-show-actions]           — Show row action column
 * @attr {boolean} [data-show-secondary-headers] — Show secondary column headers
 * @attr {boolean} [data-show-pagination]        — Show pagination bar
 *
 * @slot toolbar-leading — Consumer-provided primary action for toolbar
 *
 * @fires selection-change
 *   bubbles: true
 *   detail: { selected: string[], count: number }
 * @fires sort-change
 *   bubbles: true
 *   detail: { field: string, direction: "asc" | "desc" }
 * @fires page-change
 *   bubbles: true
 *   detail: { page: number, pageSize: number }
 * @fires groupexpand
 *   bubbles: true
 *   detail: { groupValue: string, field: string }
 * @fires groupcollapse
 *   bubbles: true
 *   detail: { groupValue: string, field: string }
 * @fires row-action
 *   bubbles: true
 *   detail: { rowId: string, rowData: object }
 * @fires grid-export
 *   bubbles: true, composed: true
 *   detail: none
 * @fires grid-action
 *   bubbles: true, composed: true
 *   detail: { action: string, data: object, selectedRows: object[] }
 *
 * @method setColumnConfig(config) — Set column type/status map config
 * @method setData(config)         — Main data pipeline entry
 * @method expandAllGroups()       — Expand all group rows
 * @method collapseAllGroups()     — Collapse all group rows
 * @method getSelectedRows()       — Returns selected row IDs
 * @method getSelectedRowData()    — Returns data for selected rows
 * @method clearSelection()        — Clear all selections
 * @method getData()               — Returns transferable config
 * @method getColumns()            — Returns column definitions
 * @method getCompoundQuery()      — Returns { group, sort, filters, columnFilters, globalSearch }
 * @method setExternalFilters(f)   — Apply external filters from FilterCoordinator
 * @method setActionMenuItems(sections) — Set secondary action menu items for bulk actions
 */

import {
  ContentAttributesMixin,
  CONTENT_ATTRIBUTES,
  getDateFieldProvider,
} from "../utilities/content-attributes-mixin.js";
import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";
import type { EventHandler } from "../utilities/types.js";
import "../sherpa-button/sherpa-button.js";
import "../sherpa-tag/sherpa-tag.js";
import "../sherpa-input-search/sherpa-input-search.js";

import "../sherpa-empty-state/sherpa-empty-state.js";
import "../sherpa-pagination/sherpa-pagination.js";
import "../sherpa-toolbar/sherpa-toolbar.js";
import "../sherpa-filter-bar/sherpa-filter-bar.js";
import { formatValue } from "../utilities/format-utils.js";
import { getTransferableConfig } from "../utilities/data-utils.js";
import { injectFilterMenu } from "../utilities/filter-menu-utils.js";

const NUMERIC_TYPES = new Set([
  "number",
  "numeric",
  "currency",
  "percent",
  "year",
  "monthNumber",
  "int",
  "integer",
  "float",
  "double",
  "decimal",
]);

const BOOLEAN_FIELDS = new Set();

/** Return a reasonable default column flex-basis (px) by data type. */
function columnWidth(type: string | null | undefined): number {
  switch ((type || "").toLowerCase()) {
    case "boolean":
      return 80;
    case "number":
    case "numeric":
    case "int":
    case "integer":
    case "float":
    case "double":
    case "decimal":
    case "percent":
    case "year":
    case "monthnumber":
      return 110;
    case "currency":
      return 120;
    case "date":
      return 130;
    case "datetime":
    case "timestamp":
      return 170;
    case "status":
      return 120;
    default:
      return 200;
  }
}

/* ── Dataset Interface ─────────────────────────────────────────── */

interface SherpaDataGridDataset extends DOMStringMap {
  loading?: string;
  segmentField?: string;
  segmentMode?: string;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
  page?: string;
  pageSize?: string;
  selectable?: string;
  showActions?: string;
  showSecondaryHeaders?: string;
  showPagination?: string;
  filters?: string;
}

/* ── Domain types ──────────────────────────────────────────────── */

/** A grid column descriptor. */
interface GridColumn {
  field: string;
  name: string;
  type: string;
  _statusMap?: Record<string, string>;
}

/** A grid row — an open record of field → value. */
type GridRow = Record<string, unknown>;

/** A value filter from a filter-bar chip: a field restricted to a value set. */
interface ValueFilter {
  field: string;
  values: string[];
}

/** A group of rows sharing a group-field value. */
interface RowGroup {
  label: string;
  rows: GridRow[];
  count: number;
}

/** Per-field consumer configuration. */
interface ColumnConfigEntry {
  type?: string;
  statusMap?: Record<string, string>;
}

/** The full dataset payload delivered to setData(). */
interface GridData {
  rows?: GridRow[];
  columns?: GridColumn[];
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

interface DataPipelineConfig extends GridData {
  originalOrderBy?: { field: string; direction?: string };
  originalSegmentBy?: string;
  segmentBy?: string;
  orderBy?:
    | string
    | { field?: string; direction?: string }
    | Array<{ field?: string; direction?: string }>;
  orderDirection?: string;
}

class SherpaDataGrid extends ContentAttributesMixin(SherpaElement) {

  override get dataset(): SherpaDataGridDataset {
    return super.dataset as SherpaDataGridDataset;
  }

  static override get cssUrl(): string {
    return new URL("./sherpa-data-grid.css", import.meta.url).href;
  }
  static override get htmlUrl(): string {
    return new URL("./sherpa-data-grid.html", import.meta.url).href;
  }

  static override get observedAttributes(): string[] {
    return [
      ...(super.observedAttributes as string[]),
      "data-loading",
      "data-segment-field",
      "data-segment-mode",
      "data-sort-field",
      "data-sort-direction",
      "data-page",
      "data-page-size",
      "data-selectable",
      "data-show-actions",
      "data-show-secondary-headers",
      "data-show-pagination",
      "data-preset-filters",
      "data-action-menu",
      ...CONTENT_ATTRIBUTES.filter((attr): attr is string => typeof attr === "string"),
    ];
  }

  /* ══════════════════════════════════════════════════════════════
     State
     ══════════════════════════════════════════════════════════════ */

  #data: GridData | null = null; // Full dataset from DataService
  #allRows: GridRow[] = []; // All rows (pre-pagination)
  #columns: GridColumn[] = []; // Column definitions
  #selectedRows = new Set<string>(); // Set of stable _rowId values
  #lastClickedRowId: string | null = null; // For shift-click range selection
  #columnFilters: Record<string, string> = {}; // { field: searchTerm }
  #valueFilters: ValueFilter[] = []; // from filter-bar chips
  #searchDebounce: number | null = null; // column search debounce (window.setTimeout returns number)
  #globalSearchTerm = ""; // Global search term across all columns
  #headersInitialized = false; // Whether #initHeaders has been called
  #searchExpandedGroups = new Set<string>(); // Group values auto-expanded by search
  #externalFilters: ValueFilter[] = []; // External filters from FilterCoordinator
  #hiddenColumns = new Set<string>(); // Column fields hidden via column-select menu
  #originalOrderBy: { field?: string; direction?: string } | null = null; // Original orderBy from config
  #originalSegmentBy: string | null = null; // Original segmentBy from config
  #rowTpl: HTMLTemplateElement | null = null;
  #groupRowTpl: HTMLTemplateElement | null = null;
  #cellTpl: HTMLTemplateElement | null = null;
  #boolCellTpl: HTMLTemplateElement | null = null;
  #linkCellTpl: HTMLTemplateElement | null = null;
  #statusCellTpl: HTMLTemplateElement | null = null;
  #headerCellTpl: HTMLTemplateElement | null = null;
  #searchCellTpl: HTMLTemplateElement | null = null;
  #metadataSpanTpl: HTMLTemplateElement | null = null;
  #expandedGroups = new Set<string>(); // Group values currently expanded
  #seededGroups = new Set<string>(); // Group values whose default mode has been applied
  #columnConfig: Record<string, ColumnConfigEntry> = {}; // Per-field consumer config
  #actionMenuSections: unknown[] = []; // Consumer-defined secondary actions
  #bound = false;

  /* ══════════════════════════════════════════════════════════════
     Lifecycle
     ══════════════════════════════════════════════════════════════ */

  override onRender(): void {
    // Mark as viz component for container CSS targeting
    if (!this.hasAttribute('data-viz')) this.setAttribute('data-viz', '');
    if (!this.hasAttribute('data-show-toolbar')) this.toggleAttribute('data-show-toolbar', true);
    if (!this.hasAttribute('data-filters')) this.toggleAttribute('data-filters', true);

    // Cache cloning templates
    this.#rowTpl = this.$<HTMLTemplateElement>("template.row-tpl");
    this.#groupRowTpl = this.$<HTMLTemplateElement>("template.group-row-tpl");
    this.#cellTpl = this.$<HTMLTemplateElement>("template.cell-tpl");
    this.#boolCellTpl = this.$<HTMLTemplateElement>("template.bool-cell-tpl");
    this.#linkCellTpl = this.$<HTMLTemplateElement>("template.link-cell-tpl");
    this.#statusCellTpl = this.$<HTMLTemplateElement>("template.status-cell-tpl");
    this.#headerCellTpl = this.$<HTMLTemplateElement>("template.header-cell-tpl");
    this.#searchCellTpl = this.$<HTMLTemplateElement>("template.search-cell-tpl");
    this.#metadataSpanTpl = this.$<HTMLTemplateElement>("template.metadata-span-tpl");

    if (!this.#bound) {

      // Pagination events — delegated to sherpa-pagination component
      this.addEventListener("click", (e) => this.#onHostClick(e));

      const pagination = this.$<HTMLElement>(".grid-pagination");
      pagination?.addEventListener("page-change", (e: CustomEvent<{ page: number; pageSize: number }>) => {
        const { page, pageSize } = e.detail;
        this.dataset["page"] = String(page);
        this.dataset["pageSize"] = String(pageSize);
        this.#render();
      });

    // Global search input (sherpa-input-search in toolbar center)
      const globalSearch = this.$<HTMLElement & { getInputElement?: () => HTMLInputElement | null }>(
        ".global-search"
      );
      if (globalSearch) {
        globalSearch.addEventListener("input", (event: Event) => {
          const e = event as CustomEvent<{ value: string }>;
          if (this.#searchDebounce !== null) clearTimeout(this.#searchDebounce);
          this.#searchDebounce = window.setTimeout(() => {
            const el = globalSearch.getInputElement?.();
            const val = el?.value ?? e.detail?.value ?? "";
            this.#globalSearchTerm = val.trim().toLowerCase();
            this.dataset["page"] = "1";
            this.#render();
          }, 200);
        });
        // Also handle clear via the search event (Enter/clear button)
        globalSearch.addEventListener("search", (event: Event) => {
          const e = event as CustomEvent<{ value: string }>;
          this.#globalSearchTerm = (e.detail?.value || "").trim().toLowerCase();
          this.dataset["page"] = "1";
          this.#render();
        });
      }

    // Filter bar events — value filters from dynamic filter chips.
    // Sort/segment chips drive data-sort-* / data-segment-* attributes
    // via the ContentAttributesMixin's container-filter-change handler;
    // we only own value-filter state here. The mixin handles
    // container-filter-change (dispatched right after filter-change) by
    // writing the sort/segment attrs with reaction suppressed and then
    // running its own aggregate pipeline — but when the grid has no
    // upstream records (data set directly via setData()), that pipeline
    // is a no-op, so we always re-render here in a microtask to pick up
    // whatever attrs the mixin just wrote.
      this.addEventListener("filter-change", (e: CustomEvent<{ filters?: unknown[] }>) => {
        const filters = e.detail?.filters ?? [];

      // Value filters (text/number/date/boolean chips)
        this.#valueFilters = filters
          .filter((filter): filter is ValueFilter => {
            if (typeof filter !== "object" || filter === null) return false;
            const values = (filter as { values?: unknown }).values;
            return (
              Array.isArray(values)
              && values.length > 0
              && typeof (filter as { field?: unknown }).field === "string"
            );
          })
          .map((filter) => ({ field: filter.field, values: filter.values }));

        this.dataset["page"] = "1";
        queueMicrotask(() => this.#render());
      });

      this.addEventListener("filter-clear", () => {
        this.#valueFilters = [];
        this.dataset["page"] = "1";
        this.#render();
      });

    // Overflow menu
      const overflowBtn = this.$<HTMLElement>(".overflow-menu-btn");
      if (overflowBtn) {
        overflowBtn.addEventListener("menu-open", () =>
          this.#populateOverflowMenu(),
        );
        overflowBtn.addEventListener("menu-select", (event: Event) =>
          this.#onOverflowMenuSelect(event as CustomEvent),
        );
      }

    // Column-select menu
      const colSelectBtn = this.$<HTMLElement>(".column-select-btn");
      if (colSelectBtn) {
        colSelectBtn.addEventListener("menu-open", () =>
          this.#populateColumnSelectMenu(),
        );
        colSelectBtn.addEventListener("menu-select", (event: Event) =>
          this.#onColumnSelectMenuSelect(event as CustomEvent),
        );
      }

    // Actions menu button (shown when rows are selected)
      const actionsBtn = this.$<HTMLElement>(".actions-btn");
      if (actionsBtn) {
        actionsBtn.addEventListener("menu-open", () =>
          this.#populateActionMenu(),
        );
        actionsBtn.addEventListener("menu-select", (event: Event) =>
          this.#onActionMenuSelect(event),
        );
      }

    // Export button
      const exportBtn = this.$(".export-btn");
      if (exportBtn) {
        exportBtn.addEventListener("click", () => {
          this.dispatchEvent(
            new CustomEvent("grid-export", { bubbles: true, composed: true }),
          );
        });
      }

    // Set defaults
      if (!this.dataset["page"]) this.dataset["page"] = "1";
      if (!this.dataset["pageSize"]) this.dataset["pageSize"] = "25";

    // Inject filter-menu template into light DOM for the overflow menu
      injectFilterMenu(this);
      this.addEventListener("toggle-filters", this.#onToggleFilters);
      this.addEventListener("menu-populate", this.#onMenuPopulate);

    // Declarative initial state from attributes (no JS required).
      this.#syncActionMenuFromAttr();
      this.#bound = true;
    }
  }

  override onConnect(): void {
    super.onConnect();
    if (this.hasAttribute("data-src-json")) this.setAttribute("data-loading", "");
  }

  override onDisconnect(): void {
    super.onDisconnect();
    CSS.highlights?.delete("data-grid-search");
    CSS.highlights?.delete("data-grid-col-search");
  }

  override onAttributeChanged(name: string, oldValue: string | null, newValue: string | null): void {
    if (oldValue === newValue) return;
    super.onAttributeChanged(name, oldValue, newValue);
    if (name === "data-src-json") {
      if (newValue) this.setAttribute("data-loading", "");
      return;
    }
    if (name === "data-action-menu") {
      this.#syncActionMenuFromAttr();
      return;
    }
    if (name === "data-preset-filters") {
      const bar = this.$("sherpa-filter-bar");
      if (bar) {
        if (newValue == null) bar.removeAttribute("data-preset-filters");
        else bar.setAttribute("data-preset-filters", newValue);
      }
      return;
    }
    if (
      [
        "data-sort-field",
        "data-sort-direction",
        "data-segment-field",
        "data-segment-mode",
      ].includes(name)
    ) {
      // Skip heavy re-render when the mixin is batch-setting attrs
      // (the mixin calls #aggregate() → setData() afterward).
      if (this.isAttrReactionSuppressed) return;
      // Reset expanded groups when grouping field changes
      if (name === "data-segment-field") {
        this.#expandedGroups.clear();
        this.#searchExpandedGroups.clear();
        this.#seededGroups.clear();
        this.#columnFilters = {};
      }
      // Respond to segment-mode changes
      if (name === "data-segment-mode") {
        // Re-seed against the new default on next render
        this.#seededGroups.clear();
        if (newValue === "collapsed") {
          this.#expandedGroups.clear();
        }
      }
      if (this.#data) {
        this.dataset["page"] = "1";
        this.#render();
      }
    }
  }

  /* ══════════════════════════════════════════════════════════════
     Column Configuration (consumer-provided overrides)
     ══════════════════════════════════════════════════════════════ */

  /**
   * Set per-column configuration overrides.
   * The config object maps field names to column settings:
   *   { fieldName: { type?: string, statusMap?: Record<string, string> } }
   *
   * - type: Override the inferred column type (e.g. "boolean", "status", "link")
   * - statusMap: For "status" columns, maps cell values to status names
   *              e.g. { critical: "critical", high: "warning", medium: "info", low: "success" }
   *
   * Call before setData() to apply overrides when columns are processed.
   * @param {Record<string, {type?: string, statusMap?: Record<string, string>}>} config
   */
  setColumnConfig(config: Record<string, ColumnConfigEntry> | null | undefined): void {
    this.#columnConfig = config && typeof config === "object" ? { ...config } : {};
  }

  /* ══════════════════════════════════════════════════════════════
     Data Pipeline
     ══════════════════════════════════════════════════════════════ */

  async setData(config: DataPipelineConfig | null | undefined): Promise<void> {
    this.setAttribute("data-loading", "");

    // Capture original config values for revert-on-off during presentation switching
    if (config?.originalOrderBy) {
      this.#originalOrderBy = config.originalOrderBy;
    } else if (config?.orderBy) {
      const order = Array.isArray(config.orderBy)
        ? (config.orderBy[0] as { field?: string; direction?: string } | undefined)
        : { field: config.orderBy, direction: config.orderDirection || "asc" };
      if (order?.field && typeof order.field === 'string') {
        this.#originalOrderBy = {
          field: order.field,
          direction: order.direction || "asc",
        };
      }
    }
    if (config?.originalSegmentBy) {
      this.#originalSegmentBy = config.originalSegmentBy;
    } else if (
      config &&
      Object.prototype.hasOwnProperty.call(config, "segmentBy") &&
      config.segmentBy
    ) {
      this.#originalSegmentBy = config.segmentBy;
    }

    // Apply segmentBy from config if explicitly provided
    if (config && Object.prototype.hasOwnProperty.call(config, "segmentBy")) {
      if (config.segmentBy) {
        this.setAttribute("data-segment-field", config.segmentBy);
        this.setAttribute("data-segment-mode", "on");
      } else {
        this.removeAttribute("data-segment-field");
        this.removeAttribute("data-segment-mode");
      }
    }

    this.#data = config ?? null;

    this.removeAttribute("data-loading");

    if (!this.#data || !this.#data.rows?.length) {
      this.#showEmptyState();
      return;
    }

    // Store the raw column + row data
    this.#columns = this.#data.columns || [];
    this.#allRows = this.#data.rows || [];

    // Reset headers so they rebuild with new columns
    this.#headersInitialized = false;

    // Assign stable row IDs for selection persistence across sort/filter
    for (let i = 0; i < this.#allRows.length; i++) {
      const row = this.#allRows[i] as GridRow & { _rowId?: string };
      if (row._rowId == null) {
        row._rowId = String(i);
      }
    }

    // Infer column types for booleans
    this.#inferColumnTypes();

    await this.rendered;

    // Propagate columns + rows to the embedded filter-bar so its
    // Group / Sort / Add filter menus populate from the live dataset.
    const bar = this.$<HTMLElement & { setAvailableColumns?: (columns: GridColumn[], rows: GridRow[]) => void }>("sherpa-filter-bar");
    bar?.setAvailableColumns?.(this.#columns, this.#allRows);
    // Forward declared preset filters to the bar
    const presets = this.getAttribute("data-preset-filters");
    if (bar && presets && bar.getAttribute("data-preset-filters") !== presets) {
      bar.setAttribute("data-preset-filters", presets);
    }

    // Reflect any initial sort/group state from host attributes onto
    // the filter-bar chips so consumers can declare initial state via
    // data-sort-field / data-sort-direction / data-segment-field /
    // data-segment-mode and have the chips light up on first paint.
    (this as { _syncFilterBarState?: () => void })._syncFilterBarState?.();

    this.#render();
  }

  /** Infer boolean column types from column config and data. */
  #inferColumnTypes(): void {
    for (const col of this.#columns) {
      const cfg = this.#columnConfig[col.field];
      // Consumer-provided type override takes precedence
      if (cfg?.type) {
        col.type = cfg.type;
      } else if (BOOLEAN_FIELDS.has(col.field) && col.type === "string") {
        col.type = "boolean";
      }
      // Merge consumer-provided statusMap into the column
      if (cfg?.statusMap) {
        col._statusMap = cfg.statusMap;
      }
    }
  }

  /* ══════════════════════════════════════════════════════════════
     Rendering — Orchestrator
     ══════════════════════════════════════════════════════════════ */

  #render(): void {
    if (!this.#data) return;

    const columns = this.#visibleColumns;
    const rows = this.#allRows;

    if (!columns.length || !rows.length) {
      this.#showEmptyState();
      return;
    }

    this.#hideEmptyState();

    // 1. Apply global search filter
    let filtered = this.#applyGlobalSearch(rows);

    // 2. Apply column search filters
    filtered = this.#applyColumnFilters(filtered);

    // 3. Apply value filters from filter-bar chips
    filtered = this.#applyValueFilters(filtered);

    // 3b. Apply external filters from FilterCoordinator (layered scoping)
    filtered = this.#applyExternalFilters(filtered);

    // 4. Sort — use explicit sort or fall back to chronological default
    const sortField = this.getAttribute("data-sort-field");
    const sortDir = this.getAttribute("data-sort-direction") || "asc";
    if (sortField && sortDir !== "off") {
      filtered = this.#sortRows(filtered, sortField, sortDir);
    } else {
      const chronoSort = this.#getDefaultChronologicalSort();
      if (chronoSort) {
        filtered = this.#sortRows(filtered, chronoSort.field, chronoSort.dir);
      }
    }

    // 5. Group or paginate
    const groupField = this.getAttribute("data-segment-field");
    const segmentMode = this.getAttribute("data-segment-mode");
    const isGrouped = !!groupField && segmentMode !== "off";

    // Init headers once; update sort indicators each cycle
    if (!this.#headersInitialized) {
      this.#initHeaders(columns);
      this.#headersInitialized = true;
    }
    this.#updateHeaderSortState();

    if (isGrouped) {
      // #renderGrouped handles its own pagination internally
      this.#renderGrouped(filtered, columns, groupField);
    } else {
      // Paginate flat rows
      const paginated = this.#paginate(filtered);
      this.#renderFlatRows(paginated, columns);
      // 6. Pagination controls (flat mode)
      this.#renderPagination(filtered.length);
    }

    // 7. Update select-all state
    this.#updateSelectAllState();

    // 7b. Update group-level checkbox states after grouped render
    if (isGrouped) this.#updateGroupCheckStates();

    // 8. Apply CSS Highlight API ranges
    this.#applySearchHighlights();
  }

  /* ══════════════════════════════════════════════════════════════
     Headers
     ══════════════════════════════════════════════════════════════ */

  /** One-time header build — called once after data arrives. */
  #initHeaders(columns: GridColumn[]): void {
    const primaryRow = this.$(".primary-headers");
    const secondaryRow = this.$(".secondary-headers");
    if (!primaryRow) return;

    // Build primary header cells via template cloning
    primaryRow.replaceChildren();

    // Selection header
    const selTh = document.createElement("th");
    selTh.className = "selection-col";
    selTh.scope = "col";
    const selCheck = document.createElement("input");
    selCheck.type = "checkbox";
    selCheck.className = "sherpa-check select-all";
    selCheck.setAttribute("aria-label", "Select all rows");
    selTh.appendChild(selCheck);
    primaryRow.appendChild(selTh);

    for (const col of columns) {
      const isNum = NUMERIC_TYPES.has(col.type);
      const w = columnWidth(col.type);
      const template = this.#headerCellTpl?.content.firstElementChild;
      if (!template) continue;
      const th = template.cloneNode(true) as HTMLElement;
      th.dataset["field"] = col.field;
      if (isNum) th.toggleAttribute("data-numeric", true);
      th.style.width = `${w}px`;
      th.style.minWidth = `${w}px`;
      const label = th.querySelector(".header-cell-label");
      if (label) label.textContent = col.name || col.field;
      primaryRow.appendChild(th);
    }

    // Action header
    const actTh = document.createElement("th");
    actTh.className = "action-col";
    actTh.scope = "col";
    primaryRow.appendChild(actTh);

    // Set table min-width so columns fill when few, scroll when many
    const totalW = columns.reduce((sum, c) => sum + columnWidth(c.type), 0) + 48 + 48;
    const table = primaryRow.closest("table");
    if (table) table.style.minWidth = `${totalW}px`;

    // Wire header click for sorting
    for (const cell of primaryRow.querySelectorAll<HTMLElement>(".header-cell")) {
      cell.addEventListener("click", () => {
        const field = cell.dataset["field"];
        if (typeof field === "string") {
          this.#onColumnSort(field);
        }
      });
    }

    // Wire select-all
    const selectAll = primaryRow.querySelector<HTMLInputElement>(".select-all");
    if (selectAll) {
      selectAll.addEventListener("change", () => {
        this.#onSelectAll(selectAll.checked);
      });
    }

    // Build secondary header cells (per-column search using sherpa-input-search)
    if (secondaryRow) {
      secondaryRow.replaceChildren();

      const secSelTh = document.createElement("th");
      secSelTh.className = "selection-col";
      secondaryRow.appendChild(secSelTh);

      for (const col of columns) {
        const w = columnWidth(col.type);
        const template = this.#searchCellTpl?.content.firstElementChild;
        if (!template) continue;
        const th = template.cloneNode(true) as HTMLElement;
        th.dataset["field"] = col.field;
        th.style.width = `${w}px`;
        th.style.minWidth = `${w}px`;
        const searchEl = th.querySelector<HTMLElement>(".col-search");
        if (searchEl) {
          searchEl.setAttribute("aria-label", `Search ${col.name || col.field}`);
          searchEl.dataset["field"] = col.field;
        }
        secondaryRow.appendChild(th);
      }

      const secActTh = document.createElement("th");
      secActTh.className = "action-col";
      secondaryRow.appendChild(secActTh);

      // Wire sherpa-input-search inputs with debounce
      for (const searchEl of secondaryRow.querySelectorAll<HTMLElement>(".col-search")) {
        const searchInput = searchEl as HTMLElement & {
          getInputElement?: () => HTMLInputElement | null;
        };

        searchInput.addEventListener("input", (event: Event) => {
          const e = event as CustomEvent<{ value: string }>;
          if (this.#searchDebounce !== null) clearTimeout(this.#searchDebounce);
          this.#searchDebounce = window.setTimeout(() => {
            const field = searchInput.getAttribute("data-field") ?? "";
            const inputEl = searchInput.getInputElement?.();
            const val = inputEl?.value ?? e.detail?.value ?? "";
            const trimmed = val.trim();
            if (field) {
              if (trimmed) {
                this.#columnFilters[field] = trimmed.toLowerCase();
              } else {
                Reflect.deleteProperty(this.#columnFilters, field);
              }
            }
            this.dataset["page"] = "1";
            this.#render();
          }, 200);
        });

        // On clear button / Enter key (search event)
        searchInput.addEventListener("search", (event: Event) => {
          const e = event as CustomEvent<{ value: string }>;
          const field = searchInput.getAttribute("data-field") ?? "";
          const val = ((e.detail?.value || "").trim());
          if (field) {
            if (val) {
              this.#columnFilters[field] = val.toLowerCase();
            } else {
              Reflect.deleteProperty(this.#columnFilters, field);
            }
          }
          this.dataset["page"] = "1";
          this.#render();
        });
      }
    }
  }

  /** Per-render sort indicator update — no DOM rebuild. */
  #updateHeaderSortState(): void {
    const primaryRow = this.$(".primary-headers");
    if (!primaryRow) return;

    const sortField = this.getAttribute("data-sort-field");
    const sortDir = this.getAttribute("data-sort-direction") || "asc";

    for (const cell of primaryRow.querySelectorAll<HTMLElement>(".header-cell")) {
      const field = cell.dataset["field"];
      const isSorted = sortField === field;
      cell.toggleAttribute("data-sorted", isSorted);
      cell.setAttribute(
        "aria-sort",
        isSorted ? (sortDir === "asc" ? "ascending" : "descending") : "none",
      );

      const icon = cell.querySelector(".sort-icon");
      if (icon) {
        if (isSorted) {
          icon.textContent = sortDir === "asc" ? "\uf0de" : "\uf0dd";
        } else {
          icon.textContent = "\uf0dc";
        }
      }
    }
  }

  /* ══════════════════════════════════════════════════════════════
     Flat Row Rendering
     ══════════════════════════════════════════════════════════════ */

  #renderFlatRows(rows: GridRow[], columns: GridColumn[]): void {
    const body = this.$(".grid-body");
    if (!body) return;

    const frag = document.createDocumentFragment();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;
      frag.appendChild(this.#createRowElement(row, columns, i));
    }

    body.replaceChildren(frag);
  }

  #createRowElement(row: GridRow, columns: GridColumn[], index: number | string): HTMLElement {
    const rowTemplate = this.#rowTpl?.content;
    if (!rowTemplate) return document.createElement("div");
    const frag = rowTemplate.cloneNode(true) as DocumentFragment;
    const tr = frag.querySelector<HTMLElement>(".grid-row") ?? document.createElement("div");
    const rowId = String(row["_rowId"] ?? index);
    tr.dataset["rowId"] = rowId;

    // Selection checkbox
    const check = tr.querySelector<HTMLInputElement>(".row-check");
    if (check) {
      check.checked = this.#selectedRows.has(rowId);
      if (this.#selectedRows.has(rowId)) tr.dataset["selected"] = "";
      check.addEventListener("change", (ev: Event) => {
        const isChecked = (ev.target as HTMLInputElement).checked;
        this.#onRowSelect(rowId, isChecked, ev);
        if (isChecked) {
          tr.setAttribute("data-selected", "");
        } else {
          tr.removeAttribute("data-selected");
        }
        this.#updateGroupCheckStates();
        this.#updateSelectAllState();
      });
    }

    // Data cells — insert before the action cell
    const actionCell = tr.querySelector(".action-cell");
    for (const col of columns) {
      tr.insertBefore(this.#createCell(row[col.field], col), actionCell);
    }

    return tr;
  }

  /* ══════════════════════════════════════════════════════════════
     Cell Type Renderers
     ══════════════════════════════════════════════════════════════ */

  #cloneCell(tpl: HTMLTemplateElement | null): HTMLElement {
    if (!tpl) return document.createElement("td");
    const cloned = tpl.content.cloneNode(true) as DocumentFragment;
    return cloned.querySelector<HTMLElement>("td") ?? document.createElement("td");
  }

  #createCell(value: unknown, column: GridColumn): HTMLElement {
    const type = column.type?.toLowerCase() || "string";
    let cell: HTMLElement;

    switch (type) {
      case "boolean":
        cell = this.#cloneCell(this.#cellTpl);
        cell.append(this.#renderBooleanCell(value));
        break;

      case "status":
        cell = this.#cloneCell(this.#statusCellTpl);
        this.#configureStatusCell(cell.querySelector("sherpa-tag"), value, column);
        break;

      case "link": {
        cell = this.#cloneCell(this.#linkCellTpl);
        const a = cell.querySelector<HTMLElement>("a");
        if (a) {
          a.dataset["field"] = column.field;
          a.textContent = value != null ? String(value) : "";
        }
        break;
      }

      case "date":
      case "datetime":
      case "number":
      case "numeric":
      case "currency":
      case "percent":
        cell = this.#cloneCell(this.#cellTpl);
        cell.textContent = formatValue(value, type);
        break;

      default:
        cell = this.#cloneCell(this.#cellTpl);
        cell.textContent = value != null ? String(value) : "";
        break;
    }

    const isNum = NUMERIC_TYPES.has(column.type);
    if (isNum) cell.dataset["numeric"] = "";

    return cell;
  }

  #renderBooleanCell(value: unknown): HTMLElement {
    const isTrue =
      value === true ||
      value === "true" ||
      value === "True" ||
      value === 1 ||
      value === "1" ||
      value === "yes" ||
      value === "Yes";
    const boolTemplate = this.#boolCellTpl?.content.firstElementChild;
    if (!boolTemplate) return document.createElement("span");
    const node = boolTemplate.cloneNode(true) as HTMLElement;
    if (isTrue) {
      node.dataset["bool"] = "true";
      node.textContent = "\uf00c";
      node.setAttribute("aria-label", "Yes");
    } else {
      node.dataset["bool"] = "false";
      node.textContent = "\uf00d";
      node.setAttribute("aria-label", "No");
    }
    return node;
  }

  #configureStatusCell(tag: HTMLElement | null, value: unknown, column: GridColumn): void {
    if (!tag) return;
    const str = String(value ?? "").toLowerCase();
    const map = column?._statusMap || {};
    const status = map[str];
    if (status) tag.dataset["status"] = status;
    tag.textContent = value != null ? String(value) : "";
  }

  /* ══════════════════════════════════════════════════════════════
     Grouping
     ══════════════════════════════════════════════════════════════ */

  #renderGrouped(rows: GridRow[], columns: GridColumn[], groupField: string): void {
    const body = this.$(".grid-body");
    if (!body) return;

    const groups = this.#groupRows(rows, groupField);
    const groupMode = this.getAttribute("data-segment-mode") || "collapsed";
    const hasSearchTerm = !!this.#globalSearchTerm || Object.keys(this.#columnFilters).length > 0;
    const totalCols = columns.length + 2; // +selection +action

    // If search was cleared, remove auto-expanded groups
    if (!hasSearchTerm && this.#searchExpandedGroups.size > 0) {
      for (const g of this.#searchExpandedGroups)
        this.#expandedGroups.delete(g);
      this.#searchExpandedGroups.clear();
    }

    // Apply default mode for groups the first time we see them. Tracking
    // seeded groups separately means the default never re-applies after the
    // user has explicitly toggled a group — click-to-collapse sticks even
    // when data-segment-mode="expanded".
    for (const group of groups) {
      if (!this.#seededGroups.has(group.label)) {
        this.#seededGroups.add(group.label);
        if (groupMode === "expanded") this.#expandedGroups.add(group.label);
      }
      // Auto-expand matching groups during search
      if (hasSearchTerm && !this.#expandedGroups.has(group.label)) {
        this.#expandedGroups.add(group.label);
        this.#searchExpandedGroups.add(group.label);
      }
    }

    // Build flat display list: [{ type: 'parent', group }, { type: 'child', row, group }, ...]
    type GroupListItem =
      | { type: "parent"; group: RowGroup }
      | { type: "child"; row: GridRow; group: RowGroup };
    const displayList: GroupListItem[] = [];
    for (const group of groups) {
      displayList.push({ type: "parent", group });
      if (this.#expandedGroups.has(group.label)) {
        for (const row of group.rows) {
          displayList.push({ type: "child", row, group });
        }
      }
    }

    // Paginate the display list
    const usePagination = this.getAttribute("data-show-pagination") === "true";
    const totalVisible = displayList.length;
    let pageSlice = displayList;

    if (usePagination) {
      const start = (this.#page - 1) * this.#pageSize;
      pageSlice = displayList.slice(start, start + this.#pageSize);
    }

    // Render the paginated slice
    const frag = document.createDocumentFragment();
    // Track which groups we've created parent elements for in this page
    const renderedParents = new Map<string, { parentRow: HTMLElement; childRows: HTMLElement[] }>();

    for (const entry of pageSlice) {
      if (entry.type === "parent") {
        const { parentRow } = this.#createGroupElement(
          entry.group,
          columns,
          "expanded",
          totalCols,
        );
        renderedParents.set(entry.group.label, { parentRow, childRows: [] });
        frag.appendChild(parentRow);
      } else {
        // Child row
        const child = this.#createRowElement(
          entry.row,
          columns,
          `${entry.group.label}-${entry.group.rows.indexOf(entry.row)}`,
        );
        child.dataset["groupChild"] = "";
        child.dataset["group"] = entry.group.label;
        // Children in the display list are always visible (expanded)
        frag.appendChild(child);
        const parentData = renderedParents.get(entry.group.label);
        if (parentData) parentData.childRows.push(child);
      }
    }

    body.replaceChildren(frag);

    // Update pagination with total visible count
    if (usePagination) {
      this.#renderPagination(totalVisible);
    }
  }

  #groupRows(rows: GridRow[], groupField: string): RowGroup[] {
    const map = new Map<string, GridRow[]>();
    for (const row of rows) {
      const key = String(row[groupField] ?? "");
      if (!map.has(key)) map.set(key, []);
      const groupRows = map.get(key);
      if (groupRows) groupRows.push(row);
    }
    return Array.from(map.entries()).map(([label, groupRows]) => ({
      label,
      rows: groupRows,
      count: groupRows.length,
    }));
  }

  #createGroupElement(
    group: RowGroup,
    columns: GridColumn[],
    _defaultMode: string,
    totalCols: number,
  ): { parentRow: HTMLElement; childRows: HTMLElement[] } {
    const isExpanded = this.#expandedGroups.has(group.label);

    // ── Parent row — clone from template ────────────────────────
    const groupTpl = this.#groupRowTpl?.content;
    if (!groupTpl) throw new Error("Missing group row template");
    const tplContent = groupTpl.cloneNode(true) as DocumentFragment;
    const parentRow = tplContent.querySelector<HTMLElement>(".group-parent-row");
    if (!parentRow) throw new Error("Missing group parent row element");
    parentRow.dataset["groupValue"] = group.label;
    if (isExpanded) parentRow.setAttribute("data-expanded", "");

    // Set colspan
    parentRow.querySelector(".group-summary-cell")?.setAttribute("colspan", String(totalCols));

    // Selection checkbox
    const groupCheck = parentRow.querySelector<HTMLInputElement>(".group-check");
    groupCheck?.setAttribute("aria-label", `Select group ${group.label}`);
    parentRow.querySelector(".selection-cell")
      ?.addEventListener("click", (e: Event) => e.stopPropagation());

    // Group label + count
    const labelEl = parentRow.querySelector(".group-label");
    if (labelEl) labelEl.textContent = group.label || "(empty)";

    const countEl = parentRow.querySelector(".group-count");
    if (countEl) countEl.textContent = `(${group.count})`;

    // Aggregate metadata for numeric columns
    const metadataEl = parentRow.querySelector(".group-metadata");
    const numCols = columns.filter((c) => NUMERIC_TYPES.has(c.type));
    for (const col of numCols.slice(0, 3)) {
      const values = group.rows
        .map((r) => Number(r[col.field]))
        .filter((v) => !isNaN(v));
      if (!values.length) continue;
      const sum = values.reduce((a, b) => a + b, 0);
      const spanTemplate = this.#metadataSpanTpl?.content.cloneNode(true) as DocumentFragment;
      const span = spanTemplate?.querySelector<HTMLElement>("span");
      if (span) {
        span.textContent = `${col.name || col.field}: ${formatValue(sum, col.type)}`;
        metadataEl?.appendChild(span);
      }
    }

    // ── Toggle expand/collapse → update state + re-render ───────
    parentRow.addEventListener("click", () => {
      const expanding = !this.#expandedGroups.has(group.label);
      if (expanding) {
        this.#expandedGroups.add(group.label);
      } else {
        this.#expandedGroups.delete(group.label);
      }
      const eventName = expanding ? "groupexpand" : "groupcollapse";
      this.dispatchEvent(
        new CustomEvent(eventName, {
          bubbles: true,
          detail: {
            groupValue: group.label,
            field: this.getAttribute("data-segment-field"),
          },
        }),
      );
      this.#render();
    });

    // ── Group checkbox — selects/deselects all children ─────────
    groupCheck?.addEventListener("change", (e: Event) => {
      const isChecked = (e.target as HTMLInputElement).checked;
      for (const row of group.rows) {
        const rowId = row["_rowId"];
        if (rowId != null) {
          if (isChecked) {
            this.#selectedRows.add(String(rowId));
          } else {
            this.#selectedRows.delete(String(rowId));
          }
        }
      }
      this.#updateSelectAllState();
      this.#emitSelectionChange();
      this.#render();
    });

    return { parentRow, childRows: [] };
  }

  /** Expand all groups. */
  expandAllGroups(): void {
    const groups = this.$$(".group-parent-row") as NodeListOf<HTMLElement>;
    for (const parent of groups) {
      const value = parent.dataset["groupValue"];
      if (typeof value === "string") {
        this.#expandedGroups.add(value);
      }
    }
    this.#render();
  }

  /** Collapse all groups. */
  collapseAllGroups(): void {
    this.#expandedGroups.clear();
    this.#render();
  }

  /* ══════════════════════════════════════════════════════════════
     Column Sorting
     ══════════════════════════════════════════════════════════════ */

  #onColumnSort(field: string): void {
    const currentField = this.getAttribute("data-sort-field");
    const currentDir = this.getAttribute("data-sort-direction") || "asc";

    let newDir;
    if (currentField === field) {
      // Cycle: asc → desc → off
      newDir =
        currentDir === "asc" ? "desc" : currentDir === "desc" ? "off" : "asc";
    } else {
      newDir = "asc";
    }

    if (newDir === "off") {
      this.removeAttribute("data-sort-field");
      this.removeAttribute("data-sort-direction");
    } else {
      this.setAttribute("data-sort-field", field);
      this.setAttribute("data-sort-direction", newDir);
    }

    this.dispatchEvent(
      new CustomEvent("sort-change", {
        bubbles: true,
        detail: { field, direction: newDir },
      }),
    );
  }

  #sortRows(rows: GridRow[], field: string, direction: string): GridRow[] {
    const col = this.#columns.find((c) => c.field === field);
    const colType = col?.type || "string";
    const dir = direction === "desc" ? -1 : 1;

    return [...rows].sort((a: GridRow, b: GridRow) => {
      const aVal = a[field];
      const bVal = b[field];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (NUMERIC_TYPES.has(colType))
        return (Number(aVal) - Number(bVal)) * dir;
      return String(aVal).localeCompare(String(bVal)) * dir;
    });
  }

  /**
   * Returns a default sort by the dataset's dateField (descending) if one
   * exists in the rows, even when it is not a visible column.
   */
  #getDefaultChronologicalSort(): { field: string; dir: "desc" } | null {
    const dataset = this.#data?.metadata?.["dataset"] as string | undefined;
    const dateFieldFn = getDateFieldProvider();
    const dateField = dataset && dateFieldFn ? dateFieldFn(dataset) : null;

    const firstRow = this.#allRows[0];
    if (!firstRow || dateField == null || !(dateField in firstRow)) return null;

    return { field: dateField, dir: "desc" };
  }

  /* ══════════════════════════════════════════════════════════════
     Global Search
     ══════════════════════════════════════════════════════════════ */

  /** Filter rows that match the global search term across any column. */
  #applyGlobalSearch(rows: GridRow[]): GridRow[] {
    if (!this.#globalSearchTerm) return rows;
    const term = this.#globalSearchTerm;
    return rows.filter((row) =>
      this.#columns.some((col) => {
        const val = row[col.field];
        if (val == null) return false;
        return String(val).toLowerCase().includes(term);
      }),
    );
  }

  /**
   * Apply CSS Custom Highlight API ranges for global search and column filters.
   * Scans text nodes inside the grid body and creates Range objects for each match.
   * Called after DOM is fully built (post-render).
   */

  #applySearchHighlights(): void {
    // Clear previous highlights
    CSS.highlights?.delete("data-grid-search");
    CSS.highlights?.delete("data-grid-col-search");

    const body = this.$(".grid-body");
    if (!body) return;

    const globalTerm = this.#globalSearchTerm;
    const colFilters = Object.entries(this.#columnFilters);
    if (!globalTerm && !colFilters.length) return;

    const globalRanges: Range[] = [];
    const colRanges: Range[] = [];

    // Walk all data rows + group labels
    const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const text = node.textContent;
      if (!text) continue;
      const lower = text.toLowerCase();

      // Global search highlight
      if (globalTerm) {
        let idx = 0;
        while ((idx = lower.indexOf(globalTerm, idx)) !== -1) {
          const range = new Range();
          range.setStart(node, idx);
          range.setEnd(node, idx + globalTerm.length);
          globalRanges.push(range);
          idx += globalTerm.length;
        }
      }

      // Column search highlights — match if the cell is in the right column
      if (colFilters.length) {
        const cell = node.parentElement?.closest('td[role="gridcell"]');
        if (cell) {
          const row = cell.closest("tr.grid-row");
          if (row) {
            // Determine column index (skip selection cell)
            const cells = Array.from(
              row.querySelectorAll('td[role="gridcell"]'),
            );
            const colIdx = cells.indexOf(cell);
            const visibleCols = this.#visibleColumns;
            const column = visibleCols[colIdx];
            if (colIdx >= 0 && colIdx < visibleCols.length && column) {
              const field = column.field;
              const colTerm = this.#columnFilters[field];
              if (colTerm) {
                let idx = 0;
                while ((idx = lower.indexOf(colTerm, idx)) !== -1) {
                  const range = new Range();
                  range.setStart(node, idx);
                  range.setEnd(node, idx + colTerm.length);
                  colRanges.push(range);
                  idx += colTerm.length;
                }
              }
            }
          }
        }
      }
    }

    if (globalRanges.length)
      CSS.highlights?.set("data-grid-search", new Highlight(...globalRanges));
    if (colRanges.length)
      CSS.highlights?.set("data-grid-col-search", new Highlight(...colRanges));
  }

  /* ══════════════════════════════════════════════════════════════
     Column Search / Filters
     ══════════════════════════════════════════════════════════════ */

  #applyColumnFilters(rows: GridRow[]): GridRow[] {
    const filters = Object.entries(this.#columnFilters);
    if (!filters.length) return rows;

    return rows.filter((row) =>
      filters.every(([field, term]) => {
        const val = row[field];
        if (val == null) return false;
        return String(val).toLowerCase().includes(term);
      }),
    );
  }

  /** Apply value filters from filter-bar chips. */
  #applyValueFilters(rows: GridRow[]): GridRow[] {
    if (!this.#valueFilters.length) return rows;

    return rows.filter((row) =>
      this.#valueFilters.every(({ field, values }) => {
        const val = row[field];
        if (val == null) return false;
        return values.includes(String(val));
      }),
    );
  }

  /** Apply external filters from FilterCoordinator (layered scoping). */
  #applyExternalFilters(rows: GridRow[]): GridRow[] {
    if (!this.#externalFilters.length) return rows;

    return rows.filter((row) =>
      this.#externalFilters.every(({ field, values }) => {
        const val = row[field];
        if (val == null) return false;
        return values.includes(String(val));
      }),
    );
  }

  /* ══════════════════════════════════════════════════════════════
     Selection
     ══════════════════════════════════════════════════════════════ */

  #onSelectAll(checked: boolean): void {
    const body = this.$(".grid-body");
    if (!body) return;

    for (const check of body.querySelectorAll<HTMLInputElement>(".row-check")) {
      check.checked = checked;
      const rowEl = check.closest<HTMLElement>(".grid-row");
      const rowId = rowEl?.dataset["rowId"];
      if (rowId != null) {
        if (checked) {
          this.#selectedRows.add(rowId);
        } else {
          this.#selectedRows.delete(rowId);
        }
        if (rowEl) {
          if (checked) {
            rowEl.setAttribute("data-selected", "");
          } else {
            rowEl.removeAttribute("data-selected");
          }
        }
      }
    }

    // Sync all group-level checkboxes and parent rows
    for (const groupCheck of body.querySelectorAll<HTMLInputElement>(".group-check")) {
      groupCheck.checked = checked;
      groupCheck.indeterminate = false;
    }
    for (const parentRow of body.querySelectorAll<HTMLElement>(".group-parent-row")) {
      if (checked) {
        parentRow.setAttribute("data-selected", "");
      } else {
        parentRow.removeAttribute("data-selected");
      }
      parentRow.removeAttribute("data-indeterminate");
    }

    this.#emitSelectionChange();
  }

  #onRowSelect(rowId: string, checked: boolean, event: Event): void {
    // Shift-click range selection
    const shiftKey = event instanceof MouseEvent ? event.shiftKey : false;
    if (checked && shiftKey && this.#lastClickedRowId != null) {
      const allRowEls = Array.from(
        this.$$(".grid-body .grid-row") as NodeListOf<HTMLElement>,
      );
      const lastIdx = allRowEls.findIndex(
        (r) => r.dataset["rowId"] === this.#lastClickedRowId,
      );
      const currIdx = allRowEls.findIndex((r) => r.dataset["rowId"] === rowId);
      if (lastIdx !== -1 && currIdx !== -1) {
        const [start, end] =
          lastIdx < currIdx ? [lastIdx, currIdx] : [currIdx, lastIdx];
        for (let i = start; i <= end; i++) {
          const el = allRowEls[i];
          if (!el) continue;
          const id = el.dataset["rowId"];
          if (id != null) {
            this.#selectedRows.add(id);
            el.setAttribute("data-selected", "");
            const check = el.querySelector<HTMLInputElement>(".row-check");
            if (check) check.checked = true;
          }
        }
        this.#lastClickedRowId = rowId;
        this.#emitSelectionChange();
        return;
      }
    }

    if (checked) {
      this.#selectedRows.add(rowId);
    } else {
      this.#selectedRows.delete(rowId);
    }
    this.#lastClickedRowId = checked ? rowId : this.#lastClickedRowId;
    this.#emitSelectionChange();
  }

  #updateSelectAllState(): void {
    const selectAll = this.$<HTMLInputElement>(".select-all");
    if (!selectAll) return;

    const total = this.#allRows.length;
    const checked = this.#selectedRows.size;

    selectAll.checked = total > 0 && checked === total;
    selectAll.indeterminate = checked > 0 && checked < total;
  }

  /** Update each group-level checkbox and parent-row to reflect child row states.
   *  Uses #selectedRows + data model so it works even when the group is collapsed
   *  and child rows are not in the DOM. */
  #updateGroupCheckStates(): void {
    // Build a lookup of group label → rows from the current data
    const groupField = this.getAttribute("data-segment-field");
    const groupMap = new Map<string, GridRow[]>();
    if (groupField) {
      for (const row of this.#allRows) {
        const key = String(row[groupField] ?? "");
        if (!groupMap.has(key)) groupMap.set(key, []);
        const mapped = groupMap.get(key);
        if (mapped) mapped.push(row);
      }
    }

    for (const parentRow of this.$$(".group-parent-row") as NodeListOf<HTMLElement>) {
      const groupCheck = parentRow.querySelector<HTMLInputElement>(".group-check");
      if (!groupCheck) continue;

      const groupValue = parentRow.dataset["groupValue"] ?? "";
      const rows = groupMap.get(groupValue) || [];
      const total = rows.length;
      const checked = rows.filter((r) => {
        const rowId = (r as { _rowId?: string })._rowId;
        return rowId != null && this.#selectedRows.has(rowId);
      }).length;

      const allChecked = total > 0 && checked === total;
      const indeterminate = checked > 0 && checked < total;

      groupCheck.checked = allChecked;
      groupCheck.indeterminate = indeterminate;

      // Visual state on the group parent row
      if (allChecked) {
        parentRow.setAttribute("data-selected", "");
      } else {
        parentRow.removeAttribute("data-selected");
      }
      if (indeterminate) {
        parentRow.setAttribute("data-indeterminate", "");
      } else {
        parentRow.removeAttribute("data-indeterminate");
      }
    }
  }

  #emitSelectionChange(): void {
    const hasSelection = this.#selectedRows.size > 0;
    this.toggleAttribute("data-has-selection", hasSelection);
    this.dispatchEvent(
      new CustomEvent("selection-change", {
        bubbles: true,
        detail: {
          selected: Array.from(this.#selectedRows),
          count: this.#selectedRows.size,
        },
      }),
    );
  }

  getSelectedRows(): string[] {
    return Array.from(this.#selectedRows);
  }

  /** Return actual row data objects for the current selection. */
  getSelectedRowData(): GridRow[] {
    if (!this.#selectedRows.size) return [];
    return this.#allRows.filter((row) => {
      const rowId = (row as { _rowId?: string })._rowId;
      return rowId != null && this.#selectedRows.has(rowId);
    });
  }

  /** Clear all selections. */
  clearSelection(): void {
    this.#selectedRows.clear();
    this.#lastClickedRowId = null;
    for (const check of this.$$(".grid-body .row-check") as NodeListOf<HTMLInputElement>) {
      check.checked = false;
    }
    for (const rowEl of this.$$(".grid-body .grid-row") as NodeListOf<HTMLElement>) {
      rowEl.removeAttribute("data-selected");
    }
    for (const groupCheck of this.$$(".grid-body .group-check") as NodeListOf<HTMLInputElement>) {
      groupCheck.checked = false;
      groupCheck.indeterminate = false;
    }
    for (const parentRow of this.$$(".grid-body .group-parent-row") as NodeListOf<HTMLElement>) {
      parentRow.removeAttribute("data-selected");
      parentRow.removeAttribute("data-indeterminate");
    }
    this.#updateSelectAllState();
    this.#emitSelectionChange();
  }

  /* ══════════════════════════════════════════════════════════════
     Pagination
     ══════════════════════════════════════════════════════════════ */

  get #page(): number {
    return Math.max(1, parseInt(this.getAttribute("data-page") ?? "", 10) || 1);
  }

  get #pageSize(): number {
    return Math.max(1, parseInt(this.getAttribute("data-page-size") ?? "", 10) || 25);
  }

  #paginate(rows: GridRow[]): GridRow[] {
    if (this.getAttribute("data-show-pagination") !== "true") return rows;
    const start = (this.#page - 1) * this.#pageSize;
    return rows.slice(start, start + this.#pageSize);
  }

  #renderPagination(totalFiltered: number): void {
    const pagination = this.$<HTMLElement & { setTotalRows?: (count: number) => void }>(".grid-pagination");
    if (!pagination) return;

    pagination.setAttribute("data-page", String(this.#page));
    pagination.setAttribute("data-page-size", String(this.#pageSize));
    pagination.setTotalRows?.(totalFiltered);
  }

  /* ══════════════════════════════════════════════════════════════
     Host Click Delegation
     ══════════════════════════════════════════════════════════════ */

  /* ══════════════════════════════════════════════════════════════
     Actions Menu (secondary toolbar actions)
     ══════════════════════════════════════════════════════════════ */

  /** Set the menu items shown in the Actions dropdown button.
   *  @param {Array<{heading?: string, items: Array<{value: string, text: string, data?: object}>}>} sections */
  setActionMenuItems(
    sections: Array<{ heading?: string; items: Array<{ value: string; text: string; data?: unknown }> }> | null | undefined,
  ): void {
    this.#actionMenuSections = sections || [];
  }

  /** Parse the JSON `data-action-menu` attribute and load its sections. */
  #syncActionMenuFromAttr(): void {
    const raw = this.getAttribute("data-action-menu");
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) this.setActionMenuItems(parsed);
    } catch (e: unknown) {
      console.warn("sherpa-data-grid: invalid data-action-menu JSON:", e);
    }
  }

  /** Fetch `{ columns, rows }` JSON from the given URL and load it. */
  override async onJsonData(data: DataPipelineConfig | null | undefined): Promise<void> {
    await this.setData(data);
  }

  override onJsonError(_url: string, _e: unknown): void {
    this.removeAttribute("data-loading");
  }

  #populateActionMenu(): void {
    const btn = this.$<HTMLElement & { setMenuItems?: (sections: unknown[]) => void }>(".actions-btn");
    if (!btn) return;
    btn.setMenuItems?.(this.#actionMenuSections);
  }

  #onActionMenuSelect(e: Event): void {
    const detail = (e as CustomEvent<{ value?: string; data?: unknown }>).detail || {};
    this.dispatchEvent(
      new CustomEvent("grid-action", {
        bubbles: true,
        composed: true,
        detail: {
          action: detail.value,
          data: detail.data,
          selectedRows: this.getSelectedRowData(),
        },
      }),
    );
  }

  #onHostClick(e: Event): void {
    const path = e.composedPath();

    // Row action
    const rowAction = path.find(
      (n): n is HTMLElement => n instanceof HTMLElement && n.classList?.contains("row-action"),
    );
    if (rowAction) {
      const rowEl = rowAction.closest<HTMLElement>(".grid-row");
      const rowId = rowEl?.dataset["rowId"];
      const rowData = rowId != null
        ? this.#allRows.find(
            (r) => (r as { _rowId?: string })._rowId === rowId,
          )
        : null;
      this.dispatchEvent(
        new CustomEvent("row-action", {
          bubbles: true,
          detail: { rowId, rowData },
        }),
      );
    }
  }

  /* ══════════════════════════════════════════════════════════════
     Overflow Menu
     ══════════════════════════════════════════════════════════════ */

  #populateOverflowMenu(): void {
    const btn = this.$<HTMLElement & { setMenuItems?: (sections: unknown[]) => void }>(".overflow-menu-btn");
    if (!btn) return;

    const isGrouped =
      !!this.getAttribute("data-segment-field") &&
      this.getAttribute("data-segment-mode") !== "off";
    const density = this.getAttribute("data-density");
    const showSecondary =
      this.getAttribute("data-show-secondary-headers") === "true";

    const sections = [];

    // Group actions
    if (isGrouped) {
      sections.push({
        heading: "Groups",
        items: [
          { value: "expand-all", text: "Expand all", data: { action: "expand-all" } },
          { value: "collapse-all", text: "Collapse all", data: { action: "collapse-all" } },
        ],
      });
    }

    // View actions
    const hasFilters = this.hasAttribute("data-filters");
    const filterBarHidden =
      this.getAttribute("data-hide-filter-bar") === "true";
    const viewItems = [
      {
        value: "toggle-column-search",
        text: showSecondary ? "Hide column search" : "Show column search",
        data: { action: "toggle-column-search" },
      },
    ];
    if (hasFilters) {
      viewItems.push({
        value: "toggle-filter-bar",
        text: filterBarHidden ? "Show filter bar" : "Hide filter bar",
        data: { action: "toggle-filter-bar" },
      });
    }

    const densities: Array<{ value: string; label: string }> = [
      { value: "", label: "Default density" },
      { value: "compact", label: "Compact" },
      { value: "comfortable", label: "Comfortable" },
    ];
    for (const d of densities) {
      viewItems.push({
        value: d.value || "default-density",
        text: d.label,
        selected: (density || "") === (d.value || ""),
        data: { action: "set-density", densityValue: d.value },
      } as any);
    }
    sections.push({ heading: "View", items: viewItems });

    // Selection actions
    if (this.#selectedRows.size > 0) {
      sections.push({
        heading: `Selection (${this.#selectedRows.size})`,
        items: [
          { value: "clear-selection", text: "Clear selection", data: { action: "clear-selection" } },
        ],
      });
    }

    btn.setMenuItems?.(sections);
  }

  #onOverflowMenuSelect(e: CustomEvent): void {
    const data = e?.detail?.data || {};
    const action = data.action;

    switch (action) {
      case "expand-all":
        this.expandAllGroups();
        break;
      case "collapse-all":
        this.collapseAllGroups();
        break;
      case "toggle-column-search": {
        const current =
          this.getAttribute("data-show-secondary-headers") === "true";
        this.setAttribute(
          "data-show-secondary-headers",
          current ? "false" : "true",
        );
        break;
      }
      case "toggle-filter-bar": {
        const current =
          this.getAttribute("data-hide-filter-bar") === "true";
        if (current) {
          this.removeAttribute("data-hide-filter-bar");
        } else {
          this.setAttribute("data-hide-filter-bar", "true");
        }
        break;
      }
      case "set-density": {
        const val = data.densityValue;
        if (val) {
          this.setAttribute("data-density", val);
        } else {
          this.removeAttribute("data-density");
        }
        break;
      }
      case "clear-selection":
        this.clearSelection();
        break;
    }
  }

  /* ══════════════════════════════════════════════════════════════
     Column Visibility
     ══════════════════════════════════════════════════════════════ */

  /** Columns not hidden by the column-select menu. */
  get #visibleColumns(): GridColumn[] {
    if (!this.#hiddenColumns.size) return this.#columns;
    return this.#columns.filter((c) => !this.#hiddenColumns.has(c.field));
  }

  #populateColumnSelectMenu(): void {
    const btn = this.$<HTMLElement & { setMenuItems?: (sections: unknown[]) => void }>(".column-select-btn");
    if (!btn) return;

    const items = [
      {
        value: "select-all-columns",
        text: "Select all",
        selection: "checkbox",
        checked: this.#hiddenColumns.size === 0,
        keepOpen: true,
        data: { action: "select-all-columns" },
      },
    ];

    for (const col of this.#columns) {
      items.push({
        value: col.field,
        text: col.name || col.field,
        selection: "checkbox",
        checked: !this.#hiddenColumns.has(col.field),
        keepOpen: true,
        data: { action: "toggle-column", field: col.field },
      } as any);
    }

    btn.setMenuItems?.([{ heading: "Columns", items }]);
  }

  #onColumnSelectMenuSelect(e: CustomEvent): void {
    const data = e?.detail?.data || {};

    // Handle "Select all"
    if (data.action === "select-all-columns") {
      if (this.#hiddenColumns.size === 0) return; // already all visible
      this.#hiddenColumns.clear();
      this.#headersInitialized = false;
      this.#render();
      return;
    }

    if (data.action !== "toggle-column") return;
    const field = data.field;
    if (!field) return;

    if (this.#hiddenColumns.has(field)) {
      this.#hiddenColumns.delete(field);
    } else {
      // Prevent hiding all columns
      if (this.#hiddenColumns.size >= this.#columns.length - 1) return;
      this.#hiddenColumns.add(field);
    }

    // Rebuild headers and re-render
    this.#headersInitialized = false;
    this.#render();
  }

  /* ══════════════════════════════════════════════════════════════
     Empty State
     ══════════════════════════════════════════════════════════════ */

  #showEmptyState(message = "No data available"): void {
    const emptyEl = this.$<HTMLElement & { heading?: string }>(".empty-state");
    if (emptyEl) emptyEl.heading = message;
    this.dataset["empty"] = "";
  }

  #hideEmptyState(): void {
    delete this.dataset["empty"];
  }

  /* ══════════════════════════════════════════════════════════════
     Public API
     ══════════════════════════════════════════════════════════════ */

  getData(): DataPipelineConfig | null {
    if (!this.#data) return null;

    const config = getTransferableConfig(this.#data, "table") as ReturnType<
      typeof getTransferableConfig
    > & {
      segmentField?: string | null;
      seriesField?: unknown;
      categoryField?: string | null;
      valueField?: string | null;
      originalOrderBy?: unknown;
      originalSegmentBy?: unknown;
    };
    const meta = (this.#data?.metadata || {}) as {
      primaryField?: string;
      categoryField?: string;
      valueField?: string;
      field?: string;
      orderBy?: unknown[];
    };
    const segmentField = this.getAttribute("data-segment-field") || null;
    const segmentMode = this.getAttribute("data-segment-mode");
    const effectiveSegmentField =
      segmentMode !== "off" && segmentField ? segmentField : null;
    const columns = this.#data?.columns ?? [];

    config.segmentField = effectiveSegmentField;
    config.seriesField = null;
    config.categoryField =
      meta.primaryField || meta.categoryField || config.categoryField || null;
    config.valueField =
      meta.valueField || config.valueField || meta.field || null;
    delete config.segmentBy;

    if (!config.category) {
      const primaryField = meta.primaryField || columns[0]?.field || null;
      if (primaryField) config.category = primaryField;
    }

    if (!Array.isArray(config.measures) || config.measures.length === 0) {
      const numericCol = columns.find((col) =>
        NUMERIC_TYPES.has((col.type || "").toLowerCase()),
      );
      if (numericCol?.field)
        config.measures = [{ field: numericCol.field, agg: "sum" }];
    }

    const sortField = this.getAttribute("data-sort-field");
    const sortDir = this.getAttribute("data-sort-direction") || "asc";
    const activeSort =
      sortField && sortDir !== "off"
        ? { field: sortField, dir: sortDir }
        : null;
    config.orderBy = activeSort
      ? [{ field: activeSort.field, direction: activeSort.dir }]
      : this.#originalOrderBy
        ? [this.#originalOrderBy]
        : meta.orderBy || [];

    if (this.#originalOrderBy) config.originalOrderBy = this.#originalOrderBy;
    if (this.#originalSegmentBy) config.originalSegmentBy = this.#originalSegmentBy;

    return config as DataPipelineConfig;
  }

  getColumns(): GridColumn[] {
    return [...this.#columns];
  }

  /**
   * Get the current compound query state — combines group, sort, and value filters.
   * Used by the FilterCoordinator for layered scoping.
   * @returns {{ group: {field, mode}|null, sort: {field, direction}|null, filters: Array<{field, values}> }}
   */
  getCompoundQuery(): {
    group: { field: string; mode: string } | null;
    sort: { field: string; direction: string } | null;
    filters: Array<{ field: string; values: string[] }>;
    columnFilters: Record<string, string>;
    globalSearch: string | null;
  } {
    const groupField = this.getAttribute("data-segment-field");
    const segmentMode = this.getAttribute("data-segment-mode");
    const sortField = this.getAttribute("data-sort-field");
    const sortDir = this.getAttribute("data-sort-direction");

    return {
      group: groupField
        ? { field: groupField, mode: segmentMode || "on" }
        : null,
      sort:
        sortField && sortDir !== "off" && sortDir
          ? { field: sortField, direction: sortDir }
          : null,
      filters: this.#valueFilters.map((f) => ({
        field: f.field,
        values: [...f.values],
      })),
      columnFilters: { ...this.#columnFilters },
      globalSearch: this.#globalSearchTerm || null,
    };
  }

  /**
   * Apply external filters from a FilterCoordinator (layered scoping).
   * These are composed with the component's own filters via AND.
   * @param {Array<{field: string, values: string[]}>} externalFilters
   */
  setExternalFilters(externalFilters: Array<{ field: string; values: string[] }> | null | undefined): void {
    this.#externalFilters = Array.isArray(externalFilters) ? externalFilters : [];
    this.dataset["page"] = "1";
    if (this.#data) this.#render();
  }

  /* ── Filter menu ─────────────────────────────────────────────────────── */

  #onToggleFilters: EventHandler = () => {
    this.toggleAttribute("data-filters");
  };

  #onMenuPopulate: EventHandler<CustomEvent> = (e: CustomEvent) => {
    const menu = e.detail?.menu;
    if (!menu) return;
    const item = menu.querySelector('sherpa-menu-item[data-event="toggle-filters"]');
    if (item) {
      item.toggleAttribute("checked", this.hasAttribute("data-filters"));
    }
  };
}

customElements.define("sherpa-data-grid", SherpaDataGrid);

export { SherpaDataGrid };
export default SherpaDataGrid;