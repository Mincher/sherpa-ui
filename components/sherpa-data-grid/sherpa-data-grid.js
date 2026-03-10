/**
 * SherpaDataGrid — Advanced data grid with grouping, selection, sorting, and pagination.
 *
 * Extends ContentAttributesMixin(SherpaElement) for shadow DOM + data pipeline.
 * Uses native <table> for correct sticky headers and full-width row backgrounds.
 * Groups use JS-toggled hidden rows (no <details>/<summary>).
 *
 * Data flow: config → fetchContentData → #processData → #render
 *
 * External components (sherpa-toolbar, sherpa-filter-bar) are slotted by
 * the content template — this component owns only the grid itself:
 * column headers, scrollable body, and pagination.
 *
 * Events:
 *   vizready        — { columns, rows } (after setData completes)
 *   selectionchange — { selected: string[], count: number }
 *   sortchange      — { field: string, direction: 'asc'|'desc' }
 *   pagechange      — { page: number, pageSize: number }
 *   groupexpand     — { groupValue: string, field: string }
 *   groupcollapse   — { groupValue: string, field: string }
 *   rowaction       — { rowId: string, rowData: object }
 */

import {
  ContentAttributesMixin,
  CONTENT_ATTRIBUTES,
  setDataProvider,
  getDateFieldProvider,
} from "../utilities/content-attributes-mixin.js";
import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";
import "../sherpa-button/sherpa-button.js";
import "../sherpa-tag/sherpa-tag.js";
import "../sherpa-input-search/sherpa-input-search.js";

import "../sherpa-empty-state/sherpa-empty-state.js";
import "../sherpa-pagination/sherpa-pagination.js";
import "../sherpa-toolbar/sherpa-toolbar.js";
import {
  escapeHtml,
  formatValue,
  formatFieldName,
} from "../utilities/index.js";
import { getTransferableConfig } from "../utilities/data-utils.js";

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

/** @deprecated Consumer should provide status mapping via setColumnConfig(). */
const STATUS_MAP = {};

/** Return a reasonable default column flex-basis (px) by data type. */
function columnWidth(type) {
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

class SherpaDataGrid extends ContentAttributesMixin(SherpaElement) {
  static get cssUrl() {
    return new URL("./sherpa-data-grid.css", import.meta.url).href;
  }
  static get htmlUrl() {
    return new URL("./sherpa-data-grid.html", import.meta.url).href;
  }

  /** @deprecated Use setDataProvider() from content-attributes-mixin.js */
  static setDataProvider(fn) {
    setDataProvider(fn);
  }

  static get observedAttributes() {
    return [
      ...super.observedAttributes,
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
      ...CONTENT_ATTRIBUTES,
    ];
  }

  /* ══════════════════════════════════════════════════════════════
     State
     ══════════════════════════════════════════════════════════════ */

  #data = null; // Full dataset from DataService
  #allRows = []; // All rows (pre-pagination)
  #columns = []; // Column definitions
  #selectedRows = new Set(); // Set of stable _rowId values
  #lastClickedRowId = null; // For shift-click range selection
  #columnFilters = {}; // { field: searchTerm }
  #valueFilters = []; // [{ field, values: string[] }] from filter-bar chips
  #searchDebounce = null; // Timer id for column search debounce
  #globalSearchTerm = ""; // Global search term across all columns
  #headersInitialized = false; // Whether #initHeaders has been called
  #searchExpandedGroups = new Set(); // Group values auto-expanded by search
  #externalFilters = []; // External filters from FilterCoordinator (layered scoping)
  #hiddenColumns = new Set(); // Column fields hidden via column-select menu
  #originalOrderBy = null; // Original orderBy from config (for presentation switching)
  #originalSegmentBy = null; // Original segmentBy from config (for presentation switching)
  #rowTpl = null; // Cached <template class="row-tpl">
  #menuHeadingTpl = null; // Cached <template class="menu-heading-tpl">
  #menuItemTpl = null; // Cached <template class="menu-item-tpl">
  #groupRowTpl = null; // Cached <template class="group-row-tpl">
  #cellTpl = null; // Cached <template class="cell-tpl">
  #linkCellTpl = null; // Cached <template class="link-cell-tpl">
  #statusCellTpl = null; // Cached <template class="status-cell-tpl">
  #metadataSpanTpl = null; // Cached <template class="metadata-span-tpl">
  #expandedGroups = new Set(); // Group values currently expanded
  #columnConfig = {}; // Per-field config from consumer { field: { type?, statusMap? } }

  /* ══════════════════════════════════════════════════════════════
     Lifecycle
     ══════════════════════════════════════════════════════════════ */

  onRender() {
    // Mark as viz component for container CSS targeting
    if (!this.hasAttribute('data-viz')) this.setAttribute('data-viz', '');

    // Cache cloning templates
    this.#rowTpl = this.$("template.row-tpl");
    this.#menuHeadingTpl = this.$("template.menu-heading-tpl");
    this.#menuItemTpl = this.$("template.menu-item-tpl");
    this.#groupRowTpl = this.$("template.group-row-tpl");
    this.#cellTpl = this.$("template.cell-tpl");
    this.#linkCellTpl = this.$("template.link-cell-tpl");
    this.#statusCellTpl = this.$("template.status-cell-tpl");
    this.#metadataSpanTpl = this.$("template.metadata-span-tpl");
  }

  onConnect() {
    super.onConnect();

    // Pagination events — delegated to sherpa-pagination component
    this.addEventListener("click", (e) => this.#onHostClick(e));

    const pagination = this.$(".grid-pagination");
    pagination?.addEventListener("pagechange", (e) => {
      const { page, pageSize } = e.detail;
      this.dataset.page = String(page);
      this.dataset.pageSize = String(pageSize);
      this.#render();
    });

    // Global search input (sherpa-input-search in toolbar center)
    const globalSearch = this.$(".global-search");
    if (globalSearch) {
      globalSearch.addEventListener("input", (e) => {
        clearTimeout(this.#searchDebounce);
        this.#searchDebounce = setTimeout(() => {
          const el = globalSearch.getInputElement?.();
          const val = el?.value ?? e.detail?.value ?? "";
          this.#globalSearchTerm = val.trim().toLowerCase();
          this.dataset.page = "1";
          this.#render();
        }, 200);
      });
      // Also handle clear via the search event (Enter/clear button)
      globalSearch.addEventListener("search", (e) => {
        this.#globalSearchTerm = (e.detail?.value || "").trim().toLowerCase();
        this.dataset.page = "1";
        this.#render();
      });
    }

    // Filter bar events — value filters from dynamic filter chips
    this.addEventListener("filterchange", (e) => {
      this.#valueFilters = (e.detail?.filters || []).filter(
        (f) => f.type === "filter" && f.values?.length,
      );
      this.dataset.page = "1";
      this.#render();
    });

    this.addEventListener("filterclear", () => {
      this.#valueFilters = [];
      this.dataset.page = "1";
      this.#render();
    });

    // Overflow menu
    const overflowBtn = this.$(".overflow-menu-btn");
    if (overflowBtn) {
      overflowBtn.addEventListener("menu-open", () =>
        this.#populateOverflowMenu(),
      );
      overflowBtn.addEventListener("menu-select", (e) =>
        this.#onOverflowMenuSelect(e),
      );
    }

    // Column-select menu
    const colSelectBtn = this.$(".column-select-btn");
    if (colSelectBtn) {
      colSelectBtn.addEventListener("menu-open", () =>
        this.#populateColumnSelectMenu(),
      );
      colSelectBtn.addEventListener("menu-select", (e) =>
        this.#onColumnSelectMenuSelect(e),
      );
    }

    // Export button
    const exportBtn = this.$(".export-btn");
    if (exportBtn) {
      exportBtn.addEventListener("click", () => {
        this.dispatchEvent(
          new CustomEvent("gridexport", { bubbles: true, composed: true }),
        );
      });
    }

    // Set defaults
    if (!this.dataset.page) this.dataset.page = "1";
    if (!this.dataset.pageSize) this.dataset.pageSize = "25";
  }

  onDisconnect() {
    super.onDisconnect();
    this.shadowRoot.highlights?.delete("data-grid-search");
    this.shadowRoot.highlights?.delete("data-grid-col-search");
  }

  onAttributeChanged(name, oldValue, newValue) {
    if (
      [
        "data-sort-field",
        "data-sort-direction",
        "data-segment-field",
        "data-segment-mode",
      ].includes(name)
    ) {
      // Reset expanded groups when grouping field changes
      if (name === "data-segment-field") {
        this.#expandedGroups.clear();
        this.#searchExpandedGroups.clear();
      }
      // Respond to segment-mode changes
      if (name === "data-segment-mode" && newValue === "collapsed") {
        this.#expandedGroups.clear();
      }
      if (this.#data) {
        this.dataset.page = "1";
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
  setColumnConfig(config) {
    this.#columnConfig = config && typeof config === "object" ? { ...config } : {};
  }

  /* ══════════════════════════════════════════════════════════════
     Data Pipeline
     ══════════════════════════════════════════════════════════════ */

  async setData(config) {
    this.setAttribute("data-loading", "");

    // Capture original config values for revert-on-off during presentation switching
    if (config?.originalOrderBy) {
      this.#originalOrderBy = config.originalOrderBy;
    } else if (config?.orderBy) {
      const order = Array.isArray(config.orderBy)
        ? config.orderBy[0]
        : { field: config.orderBy, direction: config.orderDirection || "asc" };
      if (order?.field) {
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
      }
    }

    try {
      this.#data = await this.fetchContentData(config);
    } catch (e) {
      console.error("[SherpaDataGrid] Data error:", e);
      this.#data = null;
    }

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
      if (this.#allRows[i]._rowId == null) {
        this.#allRows[i]._rowId = String(i);
      }
    }

    // Infer column types for booleans
    this.#inferColumnTypes();

    await this.rendered;

    this.#render();

    // Dispatch vizready so filter bars can auto-populate
    this.dispatchVizReady();
  }

  /** Infer boolean column types from column config and data. */
  #inferColumnTypes() {
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

  #render() {
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
  #initHeaders(columns) {
    const primaryRow = this.$(".primary-headers");
    const secondaryRow = this.$(".secondary-headers");
    if (!primaryRow) return;

    // Build primary header cells as <th> elements
    let headerHtml = "";

    // Selection header
    headerHtml += `<th class="selection-col" scope="col">
      <input type="checkbox" class="sherpa-check select-all" aria-label="Select all rows" />
    </th>`;

    for (const col of columns) {
      const isNum = NUMERIC_TYPES.has(col.type);
      const w = columnWidth(col.type);
      headerHtml += `<th class="header-cell" scope="col" data-field="${escapeHtml(col.field)}"
        ${isNum ? "data-numeric" : ""}
        style="width:${w}px;min-width:${w}px"
        role="columnheader" aria-sort="none">
        <div class="header-content">
          <span class="header-cell-label">${escapeHtml(col.name || col.field)}</span>
          <i class="fa-solid sort-icon" aria-hidden="true">&#xf0dc;</i>
        </div>
      </th>`;
    }

    // Action header
    headerHtml += `<th class="action-col" scope="col"></th>`;

    primaryRow.innerHTML = headerHtml;

    // Wire header click for sorting
    for (const cell of primaryRow.querySelectorAll(".header-cell")) {
      cell.addEventListener("click", () => {
        const field = cell.dataset.field;
        this.#onColumnSort(field);
      });
    }

    // Wire select-all
    const selectAll = primaryRow.querySelector(".select-all");
    if (selectAll) {
      selectAll.addEventListener("change", (e) => {
        this.#onSelectAll(e.target.checked);
      });
    }

    // Build secondary header cells (per-column search using sherpa-input-search)
    if (secondaryRow) {
      let secHtml = '<th class="selection-col"></th>';
      for (const col of columns) {
        const w = columnWidth(col.type);
        secHtml += `<th data-field="${escapeHtml(col.field)}" style="width:${w}px;min-width:${w}px">
          <sherpa-input-search class="col-search"
            data-size="small"
            data-density="compact"
            aria-label="Search ${escapeHtml(col.name || col.field)}"
            data-field="${escapeHtml(col.field)}">
          </sherpa-input-search>
        </th>`;
      }
      secHtml += '<th class="action-col"></th>';
      secondaryRow.innerHTML = secHtml;

      // Wire sherpa-input-search inputs with debounce
      for (const searchEl of secondaryRow.querySelectorAll(".col-search")) {
        searchEl.addEventListener("input", (e) => {
          clearTimeout(this.#searchDebounce);
          this.#searchDebounce = setTimeout(() => {
            const field = searchEl.getAttribute("data-field");
            const inputEl = searchEl.getInputElement?.();
            const val = inputEl?.value ?? e.detail?.value ?? "";
            const trimmed = val.trim();
            if (trimmed) {
              this.#columnFilters[field] = trimmed.toLowerCase();
            } else {
              delete this.#columnFilters[field];
            }
            this.dataset.page = "1";
            this.#render();
          }, 200);
        });

        // On clear button / Enter key (search event)
        searchEl.addEventListener("search", (e) => {
          const field = searchEl.getAttribute("data-field");
          const val = (e.detail?.value || "").trim();
          if (val) {
            this.#columnFilters[field] = val.toLowerCase();
          } else {
            delete this.#columnFilters[field];
          }
          this.dataset.page = "1";
          this.#render();
        });
      }
    }
  }

  /** Per-render sort indicator update — no DOM rebuild. */
  #updateHeaderSortState() {
    const primaryRow = this.$(".primary-headers");
    if (!primaryRow) return;

    const sortField = this.getAttribute("data-sort-field");
    const sortDir = this.getAttribute("data-sort-direction") || "asc";

    for (const cell of primaryRow.querySelectorAll(".header-cell")) {
      const field = cell.dataset.field;
      const isSorted = sortField === field;
      cell.toggleAttribute("data-sorted", isSorted);
      cell.setAttribute(
        "aria-sort",
        isSorted ? (sortDir === "asc" ? "ascending" : "descending") : "none",
      );

      const icon = cell.querySelector(".sort-icon");
      if (icon) {
        if (isSorted) {
          icon.innerHTML = sortDir === "asc" ? "&#xf0de;" : "&#xf0dd;";
        } else {
          icon.innerHTML = "&#xf0dc;";
        }
      }
    }
  }

  /* ══════════════════════════════════════════════════════════════
     Flat Row Rendering
     ══════════════════════════════════════════════════════════════ */

  #renderFlatRows(rows, columns) {
    const body = this.$(".grid-body");
    if (!body) return;

    const frag = document.createDocumentFragment();

    for (let i = 0; i < rows.length; i++) {
      frag.appendChild(this.#createRowElement(rows[i], columns, i));
    }

    body.replaceChildren(frag);
  }

  #createRowElement(row, columns, index) {
    const tr = this.#rowTpl.content.cloneNode(true).querySelector(".grid-row");
    const rowId = row._rowId ?? String(index);
    tr.dataset.rowId = rowId;

    // Selection checkbox
    const check = tr.querySelector(".row-check");
    check.checked = this.#selectedRows.has(rowId);
    if (this.#selectedRows.has(rowId)) tr.dataset.selected = "";
    check.addEventListener("change", (ev) => {
      const isChecked = ev.target.checked;
      this.#onRowSelect(rowId, isChecked, ev);
      isChecked
        ? tr.setAttribute("data-selected", "")
        : tr.removeAttribute("data-selected");
      this.#updateGroupCheckStates();
      this.#updateSelectAllState();
    });

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

  #createCell(value, column) {
    const type = column.type?.toLowerCase() || "string";
    let cell;

    switch (type) {
      case "boolean":
        cell = this.#cellTpl.content.cloneNode(true).querySelector("td");
        cell.innerHTML = this.#renderBooleanCell(value);
        break;

      case "status":
        cell = this.#statusCellTpl.content.cloneNode(true).querySelector("td");
        this.#configureStatusCell(cell.querySelector("sherpa-tag"), value, column);
        break;

      case "link": {
        cell = this.#linkCellTpl.content.cloneNode(true).querySelector("td");
        const a = cell.querySelector("a");
        a.dataset.field = column.field;
        a.textContent = value != null ? String(value) : "";
        break;
      }

      case "date":
      case "datetime":
      case "number":
      case "numeric":
      case "currency":
      case "percent":
        cell = this.#cellTpl.content.cloneNode(true).querySelector("td");
        cell.textContent = formatValue(value, type);
        break;

      default:
        cell = this.#cellTpl.content.cloneNode(true).querySelector("td");
        cell.textContent = value != null ? String(value) : "";
        break;
    }

    const isNum = NUMERIC_TYPES.has(column.type);
    if (isNum) cell.dataset.numeric = "";

    return cell;
  }

  #renderBooleanCell(value) {
    const isTrue =
      value === true ||
      value === "true" ||
      value === "True" ||
      value === 1 ||
      value === "1" ||
      value === "yes" ||
      value === "Yes";
    if (isTrue) {
      return '<i class="fa-solid fa-check bool-icon bool-true" aria-label="Yes"></i>';
    }
    return '<i class="fa-solid fa-xmark bool-icon bool-false" aria-label="No"></i>';
  }

  #configureStatusCell(tag, value, column) {
    const str = String(value ?? "").toLowerCase();
    const map = column?._statusMap || STATUS_MAP;
    const status = map[str];
    if (status) tag.dataset.status = status;
    tag.textContent = value != null ? String(value) : "";
  }

  /* ══════════════════════════════════════════════════════════════
     Grouping
     ══════════════════════════════════════════════════════════════ */

  #renderGrouped(rows, columns, groupField) {
    const body = this.$(".grid-body");
    if (!body) return;

    const groups = this.#groupRows(rows, groupField);
    const groupMode = this.getAttribute("data-segment-mode") || "collapsed";
    const hasSearchTerm = !!this.#globalSearchTerm;
    const totalCols = columns.length + 2; // +selection +action

    // If search was cleared, remove auto-expanded groups
    if (!hasSearchTerm && this.#searchExpandedGroups.size > 0) {
      for (const g of this.#searchExpandedGroups)
        this.#expandedGroups.delete(g);
      this.#searchExpandedGroups.clear();
    }

    // Apply default mode for groups not yet tracked
    for (const group of groups) {
      if (
        !this.#expandedGroups.has(group.label) &&
        !this.#searchExpandedGroups.has(group.label)
      ) {
        if (groupMode === "expanded") this.#expandedGroups.add(group.label);
      }
      // Auto-expand matching groups during search
      if (hasSearchTerm && !this.#expandedGroups.has(group.label)) {
        this.#expandedGroups.add(group.label);
        this.#searchExpandedGroups.add(group.label);
      }
    }

    // Build flat display list: [{ type: 'parent', group }, { type: 'child', row, group }, ...]
    const displayList = [];
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
    const renderedParents = new Map(); // label → { parentRow, childRows }

    for (const entry of pageSlice) {
      if (entry.type === "parent") {
        const { parentRow, childRows } = this.#createGroupElement(
          entry.group,
          columns,
          "expanded",
          totalCols,
        );
        // childRows are empty here — children come as separate entries
        renderedParents.set(entry.group.label, { parentRow, childRows: [] });
        frag.appendChild(parentRow);
      } else {
        // Child row
        const child = this.#createRowElement(
          entry.row,
          columns,
          `${entry.group.label}-${entry.group.rows.indexOf(entry.row)}`,
        );
        child.dataset.groupChild = "";
        child.dataset.group = entry.group.label;
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

  #groupRows(rows, groupField) {
    const map = new Map();
    for (const row of rows) {
      const key = String(row[groupField] ?? "");
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(row);
    }
    return Array.from(map.entries()).map(([label, groupRows]) => ({
      label,
      rows: groupRows,
      count: groupRows.length,
    }));
  }

  #createGroupElement(group, columns, defaultMode, totalCols) {
    const isExpanded = this.#expandedGroups.has(group.label);

    // ── Parent row — clone from template ────────────────────────
    const tplContent = this.#groupRowTpl.content.cloneNode(true);
    const parentRow = tplContent.querySelector(".group-parent-row");
    parentRow.dataset.groupValue = group.label;
    if (isExpanded) parentRow.setAttribute("data-expanded", "");

    // Set colspan
    const summaryCell = parentRow.querySelector(".group-summary-cell");
    summaryCell.setAttribute("colspan", String(totalCols));

    // Selection checkbox
    const groupCheck = parentRow.querySelector(".group-check");
    groupCheck.setAttribute("aria-label", `Select group ${group.label}`);
    const selWrap = parentRow.querySelector(".selection-cell");
    selWrap.addEventListener("click", (e) => e.stopPropagation());

    // Group label + count
    const labelEl = parentRow.querySelector(".group-label");
    labelEl.textContent = group.label || "(empty)";

    const countEl = parentRow.querySelector(".group-count");
    countEl.textContent = `(${group.count})`;

    // Aggregate metadata for numeric columns
    const metadataEl = parentRow.querySelector(".group-metadata");
    const numCols = columns.filter((c) => NUMERIC_TYPES.has(c.type));
    for (const col of numCols.slice(0, 3)) {
      const values = group.rows
        .map((r) => Number(r[col.field]))
        .filter((v) => !isNaN(v));
      if (!values.length) continue;
      const sum = values.reduce((a, b) => a + b, 0);
      const span = this.#metadataSpanTpl.content
        .cloneNode(true)
        .querySelector("span");
      span.textContent = `${col.name || col.field}: ${formatValue(sum, col.type)}`;
      metadataEl.appendChild(span);
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
    groupCheck.addEventListener("change", (e) => {
      const isChecked = e.target.checked;
      for (const row of group.rows) {
        const rowId = row._rowId;
        if (rowId != null) {
          isChecked
            ? this.#selectedRows.add(rowId)
            : this.#selectedRows.delete(rowId);
        }
      }
      this.#updateSelectAllState();
      this.#emitSelectionChange();
      this.#render();
    });

    return { parentRow, childRows: [] };
  }

  /** Expand all groups. */
  expandAllGroups() {
    const groups = this.$$(".group-parent-row");
    for (const parent of groups) {
      this.#expandedGroups.add(parent.dataset.groupValue);
    }
    this.#render();
  }

  /** Collapse all groups. */
  collapseAllGroups() {
    this.#expandedGroups.clear();
    this.#render();
  }

  /* ══════════════════════════════════════════════════════════════
     Column Sorting
     ══════════════════════════════════════════════════════════════ */

  #onColumnSort(field) {
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
      new CustomEvent("sortchange", {
        bubbles: true,
        detail: { field, direction: newDir },
      }),
    );
  }

  #sortRows(rows, field, direction) {
    const col = this.#columns.find((c) => c.field === field);
    const colType = col?.type || "string";
    const dir = direction === "desc" ? -1 : 1;

    return [...rows].sort((a, b) => {
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
  #getDefaultChronologicalSort() {
    const dataset = this.#data?.metadata?.dataset;
    const dateFieldFn = getDateFieldProvider();
    const dateField = dataset && dateFieldFn ? dateFieldFn(dataset) : null;
    if (!dateField) return null;

    const firstRow = this.#allRows[0];
    if (!firstRow || !(dateField in firstRow)) return null;

    return { field: dateField, dir: "desc" };
  }

  /* ══════════════════════════════════════════════════════════════
     Global Search
     ══════════════════════════════════════════════════════════════ */

  /** Filter rows that match the global search term across any column. */
  #applyGlobalSearch(rows) {
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

  #applySearchHighlights() {
    // Clear previous highlights (shadow-scoped, requires Chrome 130+)
    this.shadowRoot.highlights?.delete("data-grid-search");
    this.shadowRoot.highlights?.delete("data-grid-col-search");

    const body = this.$(".grid-body");
    if (!body) return;

    const globalTerm = this.#globalSearchTerm;
    const colFilters = Object.entries(this.#columnFilters);
    if (!globalTerm && !colFilters.length) return;

    const globalRanges = [];
    const colRanges = [];

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
            if (colIdx >= 0 && colIdx < visibleCols.length) {
              const field = visibleCols[colIdx].field;
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
      this.shadowRoot.highlights?.set("data-grid-search", new Highlight(...globalRanges));
    if (colRanges.length)
      this.shadowRoot.highlights?.set("data-grid-col-search", new Highlight(...colRanges));
  }

  /* ══════════════════════════════════════════════════════════════
     Column Search / Filters
     ══════════════════════════════════════════════════════════════ */

  #applyColumnFilters(rows) {
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
  #applyValueFilters(rows) {
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

  /* ══════════════════════════════════════════════════════════════
     Selection
     ══════════════════════════════════════════════════════════════ */

  #onSelectAll(checked) {
    const body = this.$(".grid-body");
    if (!body) return;

    for (const check of body.querySelectorAll(".row-check")) {
      check.checked = checked;
      const rowEl = check.closest(".grid-row");
      const rowId = rowEl?.dataset.rowId;
      if (rowId != null) {
        checked
          ? this.#selectedRows.add(rowId)
          : this.#selectedRows.delete(rowId);
        checked
          ? rowEl.setAttribute("data-selected", "")
          : rowEl.removeAttribute("data-selected");
      }
    }

    // Sync all group-level checkboxes and parent rows
    for (const groupCheck of body.querySelectorAll(".group-check")) {
      groupCheck.checked = checked;
      groupCheck.indeterminate = false;
    }
    for (const parentRow of body.querySelectorAll(".group-parent-row")) {
      checked
        ? parentRow.setAttribute("data-selected", "")
        : parentRow.removeAttribute("data-selected");
      parentRow.removeAttribute("data-indeterminate");
    }

    this.#emitSelectionChange();
  }

  #onRowSelect(rowId, checked, event) {
    // Shift-click range selection
    if (checked && event?.shiftKey && this.#lastClickedRowId != null) {
      const allRowEls = Array.from(this.$$(".grid-body .grid-row"));
      const lastIdx = allRowEls.findIndex(
        (r) => r.dataset.rowId === this.#lastClickedRowId,
      );
      const currIdx = allRowEls.findIndex((r) => r.dataset.rowId === rowId);
      if (lastIdx !== -1 && currIdx !== -1) {
        const [start, end] =
          lastIdx < currIdx ? [lastIdx, currIdx] : [currIdx, lastIdx];
        for (let i = start; i <= end; i++) {
          const el = allRowEls[i];
          const id = el.dataset.rowId;
          if (id != null) {
            this.#selectedRows.add(id);
            el.setAttribute("data-selected", "");
            const check = el.querySelector(".row-check");
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

  #updateSelectAllState() {
    const selectAll = this.$(".select-all");
    if (!selectAll) return;

    const total = this.#allRows.length;
    const checked = this.#selectedRows.size;

    selectAll.checked = total > 0 && checked === total;
    selectAll.indeterminate = checked > 0 && checked < total;
  }

  /** Update each group-level checkbox and parent-row to reflect child row states.
   *  Uses #selectedRows + data model so it works even when the group is collapsed
   *  and child rows are not in the DOM. */
  #updateGroupCheckStates() {
    // Build a lookup of group label → rows from the current data
    const groupField = this.getAttribute("data-segment-field");
    const groupMap = new Map();
    if (groupField) {
      for (const row of this.#allRows) {
        const key = String(row[groupField] ?? "");
        if (!groupMap.has(key)) groupMap.set(key, []);
        groupMap.get(key).push(row);
      }
    }

    for (const parentRow of this.$$(".group-parent-row")) {
      const groupCheck = parentRow.querySelector(".group-check");
      if (!groupCheck) continue;

      const groupValue = parentRow.dataset.groupValue;
      const rows = groupMap.get(groupValue) || [];
      const total = rows.length;
      const checked = rows.filter(
        (r) => r._rowId != null && this.#selectedRows.has(r._rowId),
      ).length;

      const allChecked = total > 0 && checked === total;
      const indeterminate = checked > 0 && checked < total;

      groupCheck.checked = allChecked;
      groupCheck.indeterminate = indeterminate;

      // Visual state on the group parent row
      allChecked
        ? parentRow.setAttribute("data-selected", "")
        : parentRow.removeAttribute("data-selected");
      indeterminate
        ? parentRow.setAttribute("data-indeterminate", "")
        : parentRow.removeAttribute("data-indeterminate");
    }
  }

  #emitSelectionChange() {
    this.dispatchEvent(
      new CustomEvent("selectionchange", {
        bubbles: true,
        detail: {
          selected: Array.from(this.#selectedRows),
          count: this.#selectedRows.size,
        },
      }),
    );
  }

  getSelectedRows() {
    return Array.from(this.#selectedRows);
  }

  /** Return actual row data objects for the current selection. */
  getSelectedRowData() {
    if (!this.#selectedRows.size) return [];
    return this.#allRows.filter((row) => this.#selectedRows.has(row._rowId));
  }

  /** Clear all selections. */
  clearSelection() {
    this.#selectedRows.clear();
    this.#lastClickedRowId = null;
    for (const check of this.$$(".grid-body .row-check")) {
      check.checked = false;
    }
    for (const rowEl of this.$$(".grid-body .grid-row")) {
      rowEl.removeAttribute("data-selected");
    }
    for (const groupCheck of this.$$(".grid-body .group-check")) {
      groupCheck.checked = false;
      groupCheck.indeterminate = false;
    }
    for (const parentRow of this.$$(".grid-body .group-parent-row")) {
      parentRow.removeAttribute("data-selected");
      parentRow.removeAttribute("data-indeterminate");
    }
    this.#updateSelectAllState();
    this.#emitSelectionChange();
  }

  /* ══════════════════════════════════════════════════════════════
     Pagination
     ══════════════════════════════════════════════════════════════ */

  get #page() {
    return Math.max(1, parseInt(this.getAttribute("data-page"), 10) || 1);
  }

  get #pageSize() {
    return Math.max(1, parseInt(this.getAttribute("data-page-size"), 10) || 25);
  }

  get #totalPages() {
    return Math.max(1, Math.ceil(this.#allRows.length / this.#pageSize));
  }

  #paginate(rows) {
    if (this.getAttribute("data-show-pagination") !== "true") return rows;
    const start = (this.#page - 1) * this.#pageSize;
    return rows.slice(start, start + this.#pageSize);
  }

  #renderPagination(totalFiltered) {
    const pagination = this.$(".grid-pagination");
    if (!pagination) return;

    pagination.setAttribute("data-page", String(this.#page));
    pagination.setAttribute("data-page-size", String(this.#pageSize));
    pagination.setTotalRows(totalFiltered);
  }

  /* ══════════════════════════════════════════════════════════════
     Host Click Delegation
     ══════════════════════════════════════════════════════════════ */

  #onHostClick(e) {
    const path = e.composedPath();

    // Row action
    const rowAction = path.find(
      (n) => n instanceof HTMLElement && n.classList?.contains("row-action"),
    );
    if (rowAction) {
      const rowEl = rowAction.closest(".grid-row");
      const rowId = rowEl?.dataset.rowId;
      const rowData =
        rowId != null ? this.#allRows.find((r) => r._rowId === rowId) : null;
      this.dispatchEvent(
        new CustomEvent("rowaction", {
          bubbles: true,
          detail: { rowId, rowData },
        }),
      );
    }
  }

  /* ══════════════════════════════════════════════════════════════
     Overflow Menu
     ══════════════════════════════════════════════════════════════ */

  /** Clone a menu heading from the template and set its text. */
  #cloneHeading(text) {
    const el = this.#menuHeadingTpl.content
      .cloneNode(true)
      .querySelector("sherpa-menu-item");
    el.textContent = text;
    return el;
  }

  /** Clone a menu item (li > sherpa-menu-item) from the template. */
  #cloneMenuItem(text, attrs = {}) {
    const frag = this.#menuItemTpl.content.cloneNode(true);
    const item = frag.querySelector("sherpa-menu-item");
    item.textContent = text;
    for (const [k, v] of Object.entries(attrs)) {
      if (
        k.startsWith("data-") ||
        k === "checked" ||
        k === "disabled" ||
        k === "value"
      ) {
        item.setAttribute(k, v);
      } else {
        item.dataset[k] = v;
      }
    }
    return frag;
  }

  #populateOverflowMenu() {
    const btn = this.$(".overflow-menu-btn");
    if (!btn?.menuElement) return;

    const frag = document.createDocumentFragment();
    const isGrouped =
      !!this.getAttribute("data-segment-field") &&
      this.getAttribute("data-segment-mode") !== "off";
    const density = this.getAttribute("data-density");
    const showSecondary =
      this.getAttribute("data-show-secondary-headers") === "true";

    // Group actions
    if (isGrouped) {
      frag.appendChild(this.#cloneHeading("Groups"));
      const ul = document.createElement("ul");
      ul.appendChild(
        this.#cloneMenuItem("Expand all", { action: "expand-all" }),
      );
      ul.appendChild(
        this.#cloneMenuItem("Collapse all", { action: "collapse-all" }),
      );
      frag.appendChild(ul);
    }

    // View actions
    frag.appendChild(this.#cloneHeading("View"));
    const viewUl = document.createElement("ul");
    viewUl.appendChild(
      this.#cloneMenuItem(
        showSecondary ? "Hide column search" : "Show column search",
        { action: "toggle-column-search" },
      ),
    );

    // Density options
    const densities = [
      { value: null, label: "Default density" },
      { value: "compact", label: "Compact" },
      { value: "comfortable", label: "Comfortable" },
    ];
    for (const d of densities) {
      const attrs = { action: "set-density", densityValue: d.value || "" };
      if ((density || "") === (d.value || "")) attrs["data-selected"] = "";
      viewUl.appendChild(this.#cloneMenuItem(d.label, attrs));
    }
    frag.appendChild(viewUl);

    // Selection actions
    if (this.#selectedRows.size > 0) {
      frag.appendChild(
        this.#cloneHeading(`Selection (${this.#selectedRows.size})`),
      );
      const selUl = document.createElement("ul");
      selUl.appendChild(
        this.#cloneMenuItem("Clear selection", { action: "clear-selection" }),
      );
      frag.appendChild(selUl);
    }

    btn.menuElement.replaceChildren(frag);
  }

  #onOverflowMenuSelect(e) {
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
  get #visibleColumns() {
    if (!this.#hiddenColumns.size) return this.#columns;
    return this.#columns.filter((c) => !this.#hiddenColumns.has(c.field));
  }

  #populateColumnSelectMenu() {
    const btn = this.$(".column-select-btn");
    if (!btn?.menuElement) return;

    const frag = document.createDocumentFragment();
    frag.appendChild(this.#cloneHeading("Columns"));

    const ul = document.createElement("ul");

    // "Select all" toggle
    const selectAllAttrs = {
      "data-selection": "checkbox",
      action: "select-all-columns",
    };
    if (this.#hiddenColumns.size === 0) selectAllAttrs.checked = "";
    ul.appendChild(this.#cloneMenuItem("Select all", selectAllAttrs));

    for (const col of this.#columns) {
      const attrs = {
        "data-selection": "checkbox",
        action: "toggle-column",
        field: col.field,
      };
      if (!this.#hiddenColumns.has(col.field)) attrs.checked = "";
      ul.appendChild(this.#cloneMenuItem(col.name || col.field, attrs));
    }

    frag.appendChild(ul);
    btn.menuElement.replaceChildren(frag);
  }

  #onColumnSelectMenuSelect(e) {
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

  #showEmptyState(message = "No data available") {
    const emptyEl = this.$(".empty-state");
    if (emptyEl) emptyEl.setAttribute("heading", message);
    this.dataset.empty = "";
  }

  #hideEmptyState() {
    delete this.dataset.empty;
  }

  /* ══════════════════════════════════════════════════════════════
     Public API
     ══════════════════════════════════════════════════════════════ */

  getData() {
    if (!this.#data) return null;

    const config = getTransferableConfig(this.#data, "table");
    const meta = this.#data?.metadata || {};
    const segmentField = this.getAttribute("data-segment-field") || null;
    const segmentMode = this.getAttribute("data-segment-mode");
    const effectiveSegmentField =
      segmentMode !== "off" && segmentField ? segmentField : null;
    const columns = Array.isArray(this.#data?.columns)
      ? this.#data.columns
      : [];

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
    if (this.#originalSegmentBy)
      config.originalSegmentBy = this.#originalSegmentBy;

    return config;
  }

  getColumns() {
    return [...this.#columns];
  }

  /**
   * Get the current compound query state — combines group, sort, and value filters.
   * Used by the FilterCoordinator for layered scoping.
   * @returns {{ group: {field, mode}|null, sort: {field, direction}|null, filters: Array<{field, values}> }}
   */
  getCompoundQuery() {
    const groupField = this.getAttribute("data-segment-field");
    const segmentMode = this.getAttribute("data-segment-mode");
    const sortField = this.getAttribute("data-sort-field");
    const sortDir = this.getAttribute("data-sort-direction");

    return {
      group: groupField
        ? { field: groupField, mode: segmentMode || "on" }
        : null,
      sort:
        sortField && sortDir !== "off"
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
  setExternalFilters(externalFilters) {
    this.#externalFilters = Array.isArray(externalFilters)
      ? externalFilters
      : [];
    this.dataset.page = "1";
    if (this.#data) this.#render();
  }

  // ─────────────────────────────────────────────────────────────
  // Public Data Accessors (for container-level filter bars)
  // ─────────────────────────────────────────────────────────────

  /** @returns {Array<{field: string, label?: string, type?: string}>} */
  getContentColumns() {
    return this.#columns;
  }

  /** @returns {Array<Object>} raw (unfiltered) rows */
  getContentRows() {
    return this.#allRows;
  }
}

customElements.define("sherpa-data-grid", SherpaDataGrid);

export { SherpaDataGrid };
export default SherpaDataGrid;
