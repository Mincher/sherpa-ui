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
 *   selectionchange — { selected: string[], count: number }
 *   sortchange      — { field: string, direction: 'asc'|'desc' }
 *   pagechange      — { page: number, pageSize: number }
 *   groupexpand     — { groupValue: string, field: string }
 *   groupcollapse   — { groupValue: string, field: string }
 *   rowaction       — { rowId: string, rowData: object }
 */

import { ContentAttributesMixin, CONTENT_ATTRIBUTES } from '../utilities/content-attributes-mixin.js';
import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';
import '../sherpa-button/sherpa-button.js';
import '../sherpa-check/sherpa-check.js';
import '../sherpa-tag/sherpa-tag.js';
import '../sherpa-input-search/sherpa-input-search.js';

import '../sherpa-empty-state/sherpa-empty-state.js';
import '../sherpa-pagination/sherpa-pagination.js';
import '../sherpa-toolbar/sherpa-toolbar.js';
import { escapeHtml, formatValue, formatFieldName } from '../utilities/index.js';

const NUMERIC_TYPES = new Set([
  'number', 'numeric', 'currency', 'percent', 'year', 'monthNumber',
  'int', 'integer', 'float', 'double', 'decimal',
]);

const BOOLEAN_FIELDS = new Set([
  'has_exploit', 'cisa_kev', 'has_ransomware', 'update_available',
]);

const STATUS_MAP = {
  critical: 'critical',
  high: 'warning',
  medium: 'info',
  low: 'success',
};

/** Return a reasonable default column flex-basis (px) by data type. */
function columnWidth(type) {
  switch ((type || '').toLowerCase()) {
    case 'boolean':                                  return 80;
    case 'number': case 'numeric': case 'int':
    case 'integer': case 'float': case 'double':
    case 'decimal': case 'percent': case 'year':
    case 'monthnumber':                              return 110;
    case 'currency':                                 return 120;
    case 'date':                                     return 130;
    case 'datetime': case 'timestamp':               return 170;
    case 'status':                                   return 120;
    default:                                         return 200;
  }
}


class SherpaDataGrid extends ContentAttributesMixin(SherpaElement) {
  static get cssUrl()  { return new URL('./sherpa-data-grid.css', import.meta.url).href; }
  static get htmlUrl() { return new URL('./sherpa-data-grid.html', import.meta.url).href; }

  // ── Pluggable data provider (injected by the host app at boot) ──
  static #dataProvider = null;

  /**
   * Register a data provider function.
   * Signature: async (config) => { name, columns, rows, summary, config, metadata }
   * @param {Function} fn
   */
  static setDataProvider(fn) { SherpaDataGrid.#dataProvider = fn; }

  static get observedAttributes() {
    return [
      ...super.observedAttributes,
      'data-loading',
      'data-segment-field', 'data-segment-mode',
      'data-sort-field', 'data-sort-direction',
      'data-page', 'data-page-size',
      'data-selectable', 'data-show-actions',
      'data-show-secondary-headers', 'data-show-pagination',
      ...CONTENT_ATTRIBUTES,
    ];
  }


  /* ══════════════════════════════════════════════════════════════
     State
     ══════════════════════════════════════════════════════════════ */

  #data = null;           // Full dataset from DataService
  #allRows = [];          // All rows (pre-pagination)
  #columns = [];          // Column definitions
  #selectedRows = new Set(); // Set of stable _rowId values
  #lastClickedRowId = null;  // For shift-click range selection
  #columnFilters = {};    // { field: searchTerm }
  #valueFilters = [];     // [{ field, values: string[] }] from filter-bar chips
  #searchDebounce = null; // Timer id for column search debounce
  #globalSearchTerm = ''; // Global search term across all columns
  #headersInitialized = false; // Whether #initHeaders has been called
  #searchExpandedGroups = new Set(); // Group values auto-expanded by search
  #externalFilters = [];    // External filters from FilterCoordinator (layered scoping)
  #hiddenColumns = new Set(); // Column fields hidden via column-select menu
  #groupRowTpl = null;        // Cached <template class="group-row-tpl">
  #expandedGroups = new Set(); // Group values currently expanded


  /* ══════════════════════════════════════════════════════════════
     Lifecycle
     ══════════════════════════════════════════════════════════════ */

  onRender() {
    // Cache the group-row cloning template
    this.#groupRowTpl = this.$('template.group-row-tpl');
  }

  onConnect() {
    // Pagination events — delegated to sherpa-pagination component
    this.addEventListener('click', (e) => this.#onHostClick(e));

    const pagination = this.$('.grid-pagination');
    pagination?.addEventListener('pagechange', (e) => {
      const { page, pageSize } = e.detail;
      this.dataset.page = String(page);
      this.dataset.pageSize = String(pageSize);
      this.#render();
    });

    // Global search input (sherpa-input-search in toolbar center)
    const globalSearch = this.$('.global-search');
    if (globalSearch) {
      globalSearch.addEventListener('input', (e) => {
        clearTimeout(this.#searchDebounce);
        this.#searchDebounce = setTimeout(() => {
          const el = globalSearch.getInputElement?.();
          const val = el?.value ?? e.detail?.value ?? '';
          this.#globalSearchTerm = val.trim().toLowerCase();
          this.dataset.page = '1';
          this.#render();
        }, 200);
      });
      // Also handle clear via the search event (Enter/clear button)
      globalSearch.addEventListener('search', (e) => {
        this.#globalSearchTerm = (e.detail?.value || '').trim().toLowerCase();
        this.dataset.page = '1';
        this.#render();
      });
    }

    // Filter bar events — value filters from dynamic filter chips
    this.addEventListener('filterchange', (e) => {
      this.#valueFilters = (e.detail?.filters || [])
        .filter(f => f.type === 'filter' && f.values?.length);
      this.dataset.page = '1';
      this.#render();
    });

    this.addEventListener('filterclear', () => {
      this.#valueFilters = [];
      this.dataset.page = '1';
      this.#render();
    });

    // Overflow menu
    const overflowBtn = this.$('.overflow-menu-btn');
    if (overflowBtn) {
      overflowBtn.addEventListener('menu-open', () => this.#populateOverflowMenu());
      overflowBtn.addEventListener('menu-select', (e) => this.#onOverflowMenuSelect(e));
    }

    // Column-select menu
    const colSelectBtn = this.$('.column-select-btn');
    if (colSelectBtn) {
      colSelectBtn.addEventListener('menu-open', () => this.#populateColumnSelectMenu());
      colSelectBtn.addEventListener('menu-select', (e) => this.#onColumnSelectMenuSelect(e));
    }

    // Export button
    const exportBtn = this.$('.export-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        this.dispatchEvent(new CustomEvent('gridexport', { bubbles: true, composed: true }));
      });
    }

    // Set defaults
    if (!this.dataset.page) this.dataset.page = '1';
    if (!this.dataset.pageSize) this.dataset.pageSize = '25';

  }

  onDisconnect() {
    CSS.highlights.delete('data-grid-search');
    CSS.highlights.delete('data-grid-col-search');
  }

  onAttributeChanged(name, oldValue, newValue) {
    if (['data-sort-field', 'data-sort-direction', 'data-segment-field', 'data-segment-mode'].includes(name)) {
      // Reset expanded groups when grouping field changes
      if (name === 'data-segment-field') {
        this.#expandedGroups.clear();
        this.#searchExpandedGroups.clear();
      }
      // Respond to segment-mode changes
      if (name === 'data-segment-mode' && newValue === 'collapsed') {
        this.#expandedGroups.clear();
      }
      if (this.#data) {
        this.dataset.page = '1';
        this.#render();
      }
    }
  }


  /* ══════════════════════════════════════════════════════════════
     Data Pipeline
     ══════════════════════════════════════════════════════════════ */

  async fetchContentData(config) {
    if (!config) return null;
    if (!SherpaDataGrid.#dataProvider) {
      console.warn('[SherpaDataGrid] No data provider registered. Call SherpaDataGrid.setDataProvider(fn) at app boot.');
      return null;
    }
    this.setAttribute('data-loading', '');
    const result = await SherpaDataGrid.#dataProvider(config);
    this.removeAttribute('data-loading');
    return result;
  }

  async setData(config) {
    this.setAttribute('data-loading', '');

    try {
      this.#data = await this.fetchContentData(config);
    } catch (e) {
      console.error('[SherpaDataGrid] Data error:', e);
      this.#data = null;
    }

    this.removeAttribute('data-loading');

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
  }

  /** Infer boolean column types from field names and data. */
  #inferColumnTypes() {
    for (const col of this.#columns) {
      if (BOOLEAN_FIELDS.has(col.field) && col.type === 'string') {
        col.type = 'boolean';
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

    // 4. Sort
    const sortField = this.getAttribute('data-sort-field');
    const sortDir = this.getAttribute('data-sort-direction') || 'asc';
    if (sortField && sortDir !== 'off') {
      filtered = this.#sortRows(filtered, sortField, sortDir);
    }

    // 5. Group or paginate
    const groupField = this.getAttribute('data-segment-field');
    const segmentMode = this.getAttribute('data-segment-mode');
    const isGrouped = !!groupField && segmentMode !== 'off';

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
    const primaryRow = this.$('.primary-headers');
    const secondaryRow = this.$('.secondary-headers');
    if (!primaryRow) return;

    // Build primary header cells as <th> elements
    let headerHtml = '';

    // Selection header
    headerHtml += `<th class="selection-col" scope="col">
      <sherpa-check class="select-all" aria-label="Select all rows"></sherpa-check>
    </th>`;

    for (const col of columns) {
      const isNum = NUMERIC_TYPES.has(col.type);
      const w = columnWidth(col.type);
      headerHtml += `<th class="header-cell" scope="col" data-field="${escapeHtml(col.field)}"
        ${isNum ? 'data-numeric' : ''}
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
    for (const cell of primaryRow.querySelectorAll('.header-cell')) {
      cell.addEventListener('click', () => {
        const field = cell.dataset.field;
        this.#onColumnSort(field);
      });
    }

    // Wire select-all
    const selectAll = primaryRow.querySelector('.select-all');
    if (selectAll) {
      selectAll.addEventListener('change', (e) => {
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
      for (const searchEl of secondaryRow.querySelectorAll('.col-search')) {
        searchEl.addEventListener('input', (e) => {
          clearTimeout(this.#searchDebounce);
          this.#searchDebounce = setTimeout(() => {
            const field = searchEl.getAttribute('data-field');
            const inputEl = searchEl.getInputElement?.();
            const val = inputEl?.value ?? e.detail?.value ?? '';
            const trimmed = val.trim();
            if (trimmed) {
              this.#columnFilters[field] = trimmed.toLowerCase();
            } else {
              delete this.#columnFilters[field];
            }
            this.dataset.page = '1';
            this.#render();
          }, 200);
        });

        // On clear button / Enter key (search event)
        searchEl.addEventListener('search', (e) => {
          const field = searchEl.getAttribute('data-field');
          const val = (e.detail?.value || '').trim();
          if (val) {
            this.#columnFilters[field] = val.toLowerCase();
          } else {
            delete this.#columnFilters[field];
          }
          this.dataset.page = '1';
          this.#render();
        });
      }
    }
  }

  /** Per-render sort indicator update — no DOM rebuild. */
  #updateHeaderSortState() {
    const primaryRow = this.$('.primary-headers');
    if (!primaryRow) return;

    const sortField = this.getAttribute('data-sort-field');
    const sortDir = this.getAttribute('data-sort-direction') || 'asc';

    for (const cell of primaryRow.querySelectorAll('.header-cell')) {
      const field = cell.dataset.field;
      const isSorted = sortField === field;
      cell.toggleAttribute('data-sorted', isSorted);
      cell.setAttribute('aria-sort', isSorted ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none');

      const icon = cell.querySelector('.sort-icon');
      if (icon) {
        if (isSorted) {
          icon.innerHTML = sortDir === 'asc' ? '&#xf0de;' : '&#xf0dd;';
        } else {
          icon.innerHTML = '&#xf0dc;';
        }
      }
    }
  }


  /* ══════════════════════════════════════════════════════════════
     Flat Row Rendering
     ══════════════════════════════════════════════════════════════ */

  #renderFlatRows(rows, columns) {
    const body = this.$('.grid-body');
    if (!body) return;

    const frag = document.createDocumentFragment();

    for (let i = 0; i < rows.length; i++) {
      frag.appendChild(this.#createRowElement(rows[i], columns, i));
    }

    body.replaceChildren(frag);
  }

  #createRowElement(row, columns, index) {
    const tr = document.createElement('tr');
    tr.className = 'grid-row';
    tr.setAttribute('role', 'row');
    const rowId = row._rowId ?? String(index);
    tr.dataset.rowId = rowId;

    // Selection cell
    const selTd = document.createElement('td');
    selTd.className = 'selection-cell';
    const check = document.createElement('sherpa-check');
    check.className = 'row-check';
    check.setAttribute('aria-label', 'Select row');
    check.checked = this.#selectedRows.has(rowId);
    if (this.#selectedRows.has(rowId)) tr.dataset.selected = '';
    check.addEventListener('change', (ev) => {
      const isChecked = ev.detail?.checked ?? check.checked;
      this.#onRowSelect(rowId, isChecked, ev);
      isChecked
        ? tr.setAttribute('data-selected', '')
        : tr.removeAttribute('data-selected');
      this.#updateGroupCheckStates();
      this.#updateSelectAllState();
    });
    selTd.appendChild(check);
    tr.appendChild(selTd);

    // Data cells
    for (const col of columns) {
      tr.appendChild(this.#createCell(row[col.field], col));
    }

    // Action cell
    const actTd = document.createElement('td');
    actTd.className = 'action-cell';
    const actBtn = document.createElement('sherpa-button');
    actBtn.className = 'row-action';
    actBtn.dataset.variant = 'tertiary';
    actBtn.dataset.size = 'small';
    actBtn.dataset.iconStart = '\uf142';
    actBtn.setAttribute('aria-label', 'Row actions');
    actTd.appendChild(actBtn);
    tr.appendChild(actTd);

    return tr;
  }


  /* ══════════════════════════════════════════════════════════════
     Cell Type Renderers
     ══════════════════════════════════════════════════════════════ */

  #createCell(value, column) {
    const cell = document.createElement('td');
    cell.setAttribute('role', 'gridcell');

    const isNum = NUMERIC_TYPES.has(column.type);
    if (isNum) cell.dataset.numeric = '';

    const type = column.type?.toLowerCase() || 'string';

    switch (type) {
      case 'boolean':
        cell.innerHTML = this.#renderBooleanCell(value);
        break;

      case 'status':
        cell.appendChild(this.#renderStatusCell(value));
        break;

      case 'link': {
        const a = document.createElement('a');
        a.href = '#';
        a.dataset.field = column.field;
        a.textContent = value != null ? String(value) : '';
        cell.appendChild(a);
        break;
      }

      case 'date':
      case 'datetime':
      case 'number':
      case 'numeric':
      case 'currency':
      case 'percent':
        cell.textContent = formatValue(value, type);
        break;

      default:
        cell.textContent = value != null ? String(value) : '';
        break;
    }

    return cell;
  }

  #renderBooleanCell(value) {
    const isTrue = value === true || value === 'true' || value === 'True' || value === 1 || value === '1' || value === 'yes' || value === 'Yes';
    if (isTrue) {
      return '<i class="fa-solid fa-check bool-icon bool-true" aria-label="Yes"></i>';
    }
    return '<i class="fa-solid fa-xmark bool-icon bool-false" aria-label="No"></i>';
  }

  #renderStatusCell(value) {
    const tag = document.createElement('sherpa-tag');
    tag.dataset.size = 'small';
    const str = String(value ?? '').toLowerCase();
    const status = STATUS_MAP[str];
    if (status) tag.dataset.status = status;
    tag.textContent = value != null ? String(value) : '';
    return tag;
  }


  /* ══════════════════════════════════════════════════════════════
     Grouping
     ══════════════════════════════════════════════════════════════ */

  #renderGrouped(rows, columns, groupField) {
    const body = this.$('.grid-body');
    if (!body) return;

    const groups = this.#groupRows(rows, groupField);
    const groupMode = this.getAttribute('data-segment-mode') || 'collapsed';
    const hasSearchTerm = !!this.#globalSearchTerm;
    const totalCols = columns.length + 2; // +selection +action

    // If search was cleared, remove auto-expanded groups
    if (!hasSearchTerm && this.#searchExpandedGroups.size > 0) {
      for (const g of this.#searchExpandedGroups) this.#expandedGroups.delete(g);
      this.#searchExpandedGroups.clear();
    }

    // Apply default mode for groups not yet tracked
    for (const group of groups) {
      if (!this.#expandedGroups.has(group.label) && !this.#searchExpandedGroups.has(group.label)) {
        if (groupMode === 'expanded') this.#expandedGroups.add(group.label);
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
      displayList.push({ type: 'parent', group });
      if (this.#expandedGroups.has(group.label)) {
        for (const row of group.rows) {
          displayList.push({ type: 'child', row, group });
        }
      }
    }

    // Paginate the display list
    const usePagination = this.getAttribute('data-show-pagination') === 'true';
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
      if (entry.type === 'parent') {
        const { parentRow, childRows } = this.#createGroupElement(
          entry.group, columns, 'expanded', totalCols
        );
        // childRows are empty here — children come as separate entries
        renderedParents.set(entry.group.label, { parentRow, childRows: [] });
        frag.appendChild(parentRow);
      } else {
        // Child row
        const child = this.#createRowElement(entry.row, columns, `${entry.group.label}-${entry.group.rows.indexOf(entry.row)}`);
        child.classList.add('group-child');
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
      const key = String(row[groupField] ?? '');
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
    const parentRow = tplContent.querySelector('.group-parent-row');
    parentRow.dataset.groupValue = group.label;
    if (isExpanded) parentRow.setAttribute('data-expanded', '');

    // Set colspan
    const summaryCell = parentRow.querySelector('.group-summary-cell');
    summaryCell.setAttribute('colspan', String(totalCols));

    // Selection checkbox
    const groupCheck = parentRow.querySelector('.group-check');
    groupCheck.setAttribute('aria-label', `Select group ${group.label}`);
    const selWrap = parentRow.querySelector('.selection-cell');
    selWrap.addEventListener('click', (e) => e.stopPropagation());

    // Group label + count
    const labelEl = parentRow.querySelector('.group-label');
    labelEl.textContent = group.label || '(empty)';

    const countEl = parentRow.querySelector('.group-count');
    countEl.textContent = `(${group.count})`;

    // Aggregate metadata for numeric columns
    const metadataEl = parentRow.querySelector('.group-metadata');
    const numCols = columns.filter(c => NUMERIC_TYPES.has(c.type));
    for (const col of numCols.slice(0, 3)) {
      const values = group.rows.map(r => Number(r[col.field])).filter(v => !isNaN(v));
      if (!values.length) continue;
      const sum = values.reduce((a, b) => a + b, 0);
      const span = document.createElement('span');
      span.textContent = `${col.name || col.field}: ${formatValue(sum, col.type)}`;
      metadataEl.appendChild(span);
    }

    // ── Toggle expand/collapse → update state + re-render ───────
    parentRow.addEventListener('click', () => {
      const expanding = !this.#expandedGroups.has(group.label);
      if (expanding) {
        this.#expandedGroups.add(group.label);
      } else {
        this.#expandedGroups.delete(group.label);
      }
      const eventName = expanding ? 'groupexpand' : 'groupcollapse';
      this.dispatchEvent(new CustomEvent(eventName, {
        bubbles: true,
        detail: {
          groupValue: group.label,
          field: this.getAttribute('data-segment-field'),
        },
      }));
      this.#render();
    });

    // ── Group checkbox — selects/deselects all children ─────────
    groupCheck.addEventListener('change', (e) => {
      const isChecked = e.detail?.checked ?? e.target.checked;
      for (const row of group.rows) {
        const rowId = row._rowId;
        if (rowId != null) {
          isChecked ? this.#selectedRows.add(rowId) : this.#selectedRows.delete(rowId);
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
    const groups = this.$$('.group-parent-row');
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
    const currentField = this.getAttribute('data-sort-field');
    const currentDir = this.getAttribute('data-sort-direction') || 'asc';

    let newDir;
    if (currentField === field) {
      // Cycle: asc → desc → off
      newDir = currentDir === 'asc' ? 'desc' : currentDir === 'desc' ? 'off' : 'asc';
    } else {
      newDir = 'asc';
    }

    if (newDir === 'off') {
      this.removeAttribute('data-sort-field');
      this.removeAttribute('data-sort-direction');
    } else {
      this.setAttribute('data-sort-field', field);
      this.setAttribute('data-sort-direction', newDir);
    }

    this.dispatchEvent(new CustomEvent('sortchange', {
      bubbles: true,
      detail: { field, direction: newDir },
    }));
  }

  #sortRows(rows, field, direction) {
    const col = this.#columns.find(c => c.field === field);
    const colType = col?.type || 'string';
    const dir = direction === 'desc' ? -1 : 1;

    return [...rows].sort((a, b) => {
      const aVal = a[field];
      const bVal = b[field];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (NUMERIC_TYPES.has(colType)) return (Number(aVal) - Number(bVal)) * dir;
      return String(aVal).localeCompare(String(bVal)) * dir;
    });
  }


  /* ══════════════════════════════════════════════════════════════
     Global Search
     ══════════════════════════════════════════════════════════════ */

  /** Filter rows that match the global search term across any column. */
  #applyGlobalSearch(rows) {
    if (!this.#globalSearchTerm) return rows;
    const term = this.#globalSearchTerm;
    return rows.filter(row =>
      this.#columns.some(col => {
        const val = row[col.field];
        if (val == null) return false;
        return String(val).toLowerCase().includes(term);
      })
    );
  }

  /**
   * Apply CSS Custom Highlight API ranges for global search and column filters.
   * Scans text nodes inside the grid body and creates Range objects for each match.
   * Called after DOM is fully built (post-render).
   */

  #applySearchHighlights() {
    // Clear previous highlights
    CSS.highlights.delete('data-grid-search');
    CSS.highlights.delete('data-grid-col-search');

    const body = this.$('.grid-body');
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
          const row = cell.closest('tr.grid-row');
          if (row) {
            // Determine column index (skip selection cell)
            const cells = Array.from(row.querySelectorAll('td[role="gridcell"]'));
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

    if (globalRanges.length) CSS.highlights.set('data-grid-search', new Highlight(...globalRanges));
    if (colRanges.length) CSS.highlights.set('data-grid-col-search', new Highlight(...colRanges));
  }


  /* ══════════════════════════════════════════════════════════════
     Column Search / Filters
     ══════════════════════════════════════════════════════════════ */

  #applyColumnFilters(rows) {
    const filters = Object.entries(this.#columnFilters);
    if (!filters.length) return rows;

    return rows.filter(row =>
      filters.every(([field, term]) => {
        const val = row[field];
        if (val == null) return false;
        return String(val).toLowerCase().includes(term);
      })
    );
  }

  /** Apply value filters from filter-bar chips. */
  #applyValueFilters(rows) {
    if (!this.#valueFilters.length) return rows;

    return rows.filter(row =>
      this.#valueFilters.every(({ field, values }) => {
        const val = row[field];
        if (val == null) return false;
        return values.includes(String(val));
      })
    );
  }

  /** Apply external filters from FilterCoordinator (layered scoping). */
  #applyExternalFilters(rows) {
    if (!this.#externalFilters.length) return rows;

    return rows.filter(row =>
      this.#externalFilters.every(({ field, values }) => {
        const val = row[field];
        if (val == null) return false;
        return values.includes(String(val));
      })
    );
  }


  /* ══════════════════════════════════════════════════════════════
     Selection
     ══════════════════════════════════════════════════════════════ */

  #onSelectAll(checked) {
    const body = this.$('.grid-body');
    if (!body) return;

    for (const check of body.querySelectorAll('.row-check')) {
      check.checked = checked;
      const rowEl = check.closest('.grid-row');
      const rowId = rowEl?.dataset.rowId;
      if (rowId != null) {
        checked ? this.#selectedRows.add(rowId) : this.#selectedRows.delete(rowId);
        checked
          ? rowEl.setAttribute('data-selected', '')
          : rowEl.removeAttribute('data-selected');
      }
    }

    // Sync all group-level checkboxes and parent rows
    for (const groupCheck of body.querySelectorAll('.group-check')) {
      groupCheck.checked = checked;
      groupCheck.indeterminate = false;
    }
    for (const parentRow of body.querySelectorAll('.group-parent-row')) {
      checked
        ? parentRow.setAttribute('data-selected', '')
        : parentRow.removeAttribute('data-selected');
      parentRow.removeAttribute('data-indeterminate');
    }

    this.#emitSelectionChange();
  }

  #onRowSelect(rowId, checked, event) {
    // Shift-click range selection
    if (checked && event?.shiftKey && this.#lastClickedRowId != null) {
      const allRowEls = Array.from(this.$$('.grid-body .grid-row'));
      const lastIdx = allRowEls.findIndex(r => r.dataset.rowId === this.#lastClickedRowId);
      const currIdx = allRowEls.findIndex(r => r.dataset.rowId === rowId);
      if (lastIdx !== -1 && currIdx !== -1) {
        const [start, end] = lastIdx < currIdx ? [lastIdx, currIdx] : [currIdx, lastIdx];
        for (let i = start; i <= end; i++) {
          const el = allRowEls[i];
          const id = el.dataset.rowId;
          if (id != null) {
            this.#selectedRows.add(id);
            el.setAttribute('data-selected', '');
            const check = el.querySelector('.row-check');
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
    const selectAll = this.$('.select-all');
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
    const groupField = this.getAttribute('data-segment-field');
    const groupMap = new Map();
    if (groupField) {
      for (const row of this.#allRows) {
        const key = String(row[groupField] ?? '');
        if (!groupMap.has(key)) groupMap.set(key, []);
        groupMap.get(key).push(row);
      }
    }

    for (const parentRow of this.$$('.group-parent-row')) {
      const groupCheck = parentRow.querySelector('.group-check');
      if (!groupCheck) continue;

      const groupValue = parentRow.dataset.groupValue;
      const rows = groupMap.get(groupValue) || [];
      const total = rows.length;
      const checked = rows.filter(r => r._rowId != null && this.#selectedRows.has(r._rowId)).length;

      const allChecked = total > 0 && checked === total;
      const indeterminate = checked > 0 && checked < total;

      groupCheck.checked = allChecked;
      groupCheck.indeterminate = indeterminate;

      // Visual state on the group parent row
      allChecked
        ? parentRow.setAttribute('data-selected', '')
        : parentRow.removeAttribute('data-selected');
      indeterminate
        ? parentRow.setAttribute('data-indeterminate', '')
        : parentRow.removeAttribute('data-indeterminate');
    }
  }

  #emitSelectionChange() {
    this.dispatchEvent(new CustomEvent('selectionchange', {
      bubbles: true,
      detail: {
        selected: Array.from(this.#selectedRows),
        count: this.#selectedRows.size,
      },
    }));
  }

  getSelectedRows() {
    return Array.from(this.#selectedRows);
  }

  /** Return actual row data objects for the current selection. */
  getSelectedRowData() {
    if (!this.#selectedRows.size) return [];
    return this.#allRows.filter(row => this.#selectedRows.has(row._rowId));
  }

  /** Clear all selections. */
  clearSelection() {
    this.#selectedRows.clear();
    this.#lastClickedRowId = null;
    for (const check of this.$$('.grid-body .row-check')) {
      check.checked = false;
    }
    for (const rowEl of this.$$('.grid-body .grid-row')) {
      rowEl.removeAttribute('data-selected');
    }
    for (const groupCheck of this.$$('.grid-body .group-check')) {
      groupCheck.checked = false;
      groupCheck.indeterminate = false;
    }
    for (const parentRow of this.$$('.grid-body .group-parent-row')) {
      parentRow.removeAttribute('data-selected');
      parentRow.removeAttribute('data-indeterminate');
    }
    this.#updateSelectAllState();
    this.#emitSelectionChange();
  }


  /* ══════════════════════════════════════════════════════════════
     Pagination
     ══════════════════════════════════════════════════════════════ */

  get #page() {
    return Math.max(1, parseInt(this.getAttribute('data-page'), 10) || 1);
  }

  get #pageSize() {
    return Math.max(1, parseInt(this.getAttribute('data-page-size'), 10) || 25);
  }

  get #totalPages() {
    return Math.max(1, Math.ceil(this.#allRows.length / this.#pageSize));
  }

  #paginate(rows) {
    if (this.getAttribute('data-show-pagination') !== 'true') return rows;
    const start = (this.#page - 1) * this.#pageSize;
    return rows.slice(start, start + this.#pageSize);
  }

  #renderPagination(totalFiltered) {
    const pagination = this.$('.grid-pagination');
    if (!pagination) return;

    pagination.setAttribute('data-page', String(this.#page));
    pagination.setAttribute('data-page-size', String(this.#pageSize));
    pagination.setTotalRows(totalFiltered);
  }


  /* ══════════════════════════════════════════════════════════════
     Host Click Delegation
     ══════════════════════════════════════════════════════════════ */

  #onHostClick(e) {
    const path = e.composedPath();

    // Row action
    const rowAction = path.find(n => n instanceof HTMLElement && n.classList?.contains('row-action'));
    if (rowAction) {
      const rowEl = rowAction.closest('.grid-row');
      const rowId = rowEl?.dataset.rowId;
      const rowData = rowId != null ? this.#allRows.find(r => r._rowId === rowId) : null;
      this.dispatchEvent(new CustomEvent('rowaction', {
        bubbles: true,
        detail: { rowId, rowData },
      }));
    }
  }


  /* ══════════════════════════════════════════════════════════════
     Overflow Menu
     ══════════════════════════════════════════════════════════════ */

  #populateOverflowMenu() {
    const btn = this.$('.overflow-menu-btn');
    if (!btn?.menuElement) return;

    const frag = document.createDocumentFragment();
    const isGrouped = !!this.getAttribute('data-segment-field') && this.getAttribute('data-segment-mode') !== 'off';
    const density = this.getAttribute('data-density');
    const showSecondary = this.getAttribute('data-show-secondary-headers') === 'true';

    // Group actions
    if (isGrouped) {
      const heading = document.createElement('sherpa-menu-item');
      heading.setAttribute('data-type', 'heading');
      heading.textContent = 'Groups';
      frag.appendChild(heading);

      const ul = document.createElement('ul');
      const expandItem = document.createElement('li');
      const expandAction = document.createElement('sherpa-menu-item');
      expandAction.dataset.action = 'expand-all';
      expandAction.textContent = 'Expand all';
      expandItem.appendChild(expandAction);
      ul.appendChild(expandItem);

      const collapseItem = document.createElement('li');
      const collapseAction = document.createElement('sherpa-menu-item');
      collapseAction.dataset.action = 'collapse-all';
      collapseAction.textContent = 'Collapse all';
      collapseItem.appendChild(collapseAction);
      ul.appendChild(collapseItem);
      frag.appendChild(ul);
    }

    // View actions
    const viewHeading = document.createElement('sherpa-menu-item');
    viewHeading.setAttribute('data-type', 'heading');
    viewHeading.textContent = 'View';
    frag.appendChild(viewHeading);

    const viewUl = document.createElement('ul');

    // Toggle column search
    const searchItem = document.createElement('li');
    const searchAction = document.createElement('sherpa-menu-item');
    searchAction.dataset.action = 'toggle-column-search';
    searchAction.textContent = showSecondary ? 'Hide column search' : 'Show column search';
    searchItem.appendChild(searchAction);
    viewUl.appendChild(searchItem);

    // Density options
    const densities = [
      { value: null, label: 'Default density' },
      { value: 'compact', label: 'Compact' },
      { value: 'comfortable', label: 'Comfortable' },
    ];
    for (const d of densities) {
      const li = document.createElement('li');
      const item = document.createElement('sherpa-menu-item');
      item.dataset.action = 'set-density';
      item.dataset.densityValue = d.value || '';
      if ((density || '') === (d.value || '')) item.setAttribute('data-selected', '');
      item.textContent = d.label;
      li.appendChild(item);
      viewUl.appendChild(li);
    }
    frag.appendChild(viewUl);

    // Selection actions
    if (this.#selectedRows.size > 0) {
      const selHeading = document.createElement('sherpa-menu-item');
      selHeading.setAttribute('data-type', 'heading');
      selHeading.textContent = `Selection (${this.#selectedRows.size})`;
      frag.appendChild(selHeading);

      const selUl = document.createElement('ul');
      const clearItem = document.createElement('li');
      const clearAction = document.createElement('sherpa-menu-item');
      clearAction.dataset.action = 'clear-selection';
      clearAction.textContent = 'Clear selection';
      clearItem.appendChild(clearAction);
      selUl.appendChild(clearItem);
      frag.appendChild(selUl);
    }

    btn.menuElement.replaceChildren(frag);
  }

  #onOverflowMenuSelect(e) {
    const data = e?.detail?.data || {};
    const action = data.action;

    switch (action) {
      case 'expand-all':
        this.expandAllGroups();
        break;
      case 'collapse-all':
        this.collapseAllGroups();
        break;
      case 'toggle-column-search': {
        const current = this.getAttribute('data-show-secondary-headers') === 'true';
        this.setAttribute('data-show-secondary-headers', current ? 'false' : 'true');
        break;
      }
      case 'set-density': {
        const val = data.densityValue;
        if (val) {
          this.setAttribute('data-density', val);
        } else {
          this.removeAttribute('data-density');
        }
        break;
      }
      case 'clear-selection':
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
    return this.#columns.filter(c => !this.#hiddenColumns.has(c.field));
  }

  #populateColumnSelectMenu() {
    const btn = this.$('.column-select-btn');
    if (!btn?.menuElement) return;

    const frag = document.createDocumentFragment();

    const heading = document.createElement('sherpa-menu-item');
    heading.setAttribute('data-type', 'heading');
    heading.textContent = 'Columns';
    frag.appendChild(heading);

    // "Select all" toggle
    const selectAllLi = document.createElement('li');
    const selectAll = document.createElement('sherpa-menu-item');
    selectAll.setAttribute('data-selection', 'checkbox');
    selectAll.dataset.action = 'select-all-columns';
    if (this.#hiddenColumns.size === 0) selectAll.setAttribute('checked', '');
    selectAll.textContent = 'Select all';
    selectAllLi.appendChild(selectAll);

    const ul = document.createElement('ul');
    ul.appendChild(selectAllLi);

    for (const col of this.#columns) {
      const li = document.createElement('li');
      const item = document.createElement('sherpa-menu-item');
      item.setAttribute('data-selection', 'checkbox');
      item.dataset.action = 'toggle-column';
      item.dataset.field = col.field;
      if (!this.#hiddenColumns.has(col.field)) {
        item.setAttribute('checked', '');
      }
      item.textContent = col.name || col.field;
      li.appendChild(item);
      ul.appendChild(li);
    }
    frag.appendChild(ul);

    btn.menuElement.replaceChildren(frag);
  }

  #onColumnSelectMenuSelect(e) {
    const data = e?.detail?.data || {};

    // Handle "Select all"
    if (data.action === 'select-all-columns') {
      if (this.#hiddenColumns.size === 0) return; // already all visible
      this.#hiddenColumns.clear();
      this.#headersInitialized = false;
      this.#render();
      return;
    }

    if (data.action !== 'toggle-column') return;
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

  #showEmptyState(message = 'No data available') {
    const emptyEl = this.$('.empty-state');
    if (emptyEl) {
      emptyEl.setAttribute('heading', message);
      emptyEl.hidden = false;
    }
    const container = this.$('.table-container');
    if (container) container.hidden = true;
    const pagination = this.$('.grid-pagination');
    if (pagination) pagination.hidden = true;
  }

  #hideEmptyState() {
    const emptyEl = this.$('.empty-state');
    if (emptyEl) emptyEl.hidden = true;
    const container = this.$('.table-container');
    if (container) container.hidden = false;
    const pagination = this.$('.grid-pagination');
    if (pagination) {
      pagination.hidden = false;
      pagination.removeAttribute('hidden');
    }
  }


  /* ══════════════════════════════════════════════════════════════
     Public API
     ══════════════════════════════════════════════════════════════ */

  getData() {
    return this.#data;
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
    const groupField = this.getAttribute('data-segment-field');
    const segmentMode = this.getAttribute('data-segment-mode');
    const sortField = this.getAttribute('data-sort-field');
    const sortDir = this.getAttribute('data-sort-direction');

    return {
      group: groupField ? { field: groupField, mode: segmentMode || 'on' } : null,
      sort: sortField && sortDir !== 'off' ? { field: sortField, direction: sortDir } : null,
      filters: this.#valueFilters.map(f => ({ field: f.field, values: [...f.values] })),
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
    this.#externalFilters = Array.isArray(externalFilters) ? externalFilters : [];
    this.dataset.page = '1';
    if (this.#data) this.#render();
  }

  // ─────────────────────────────────────────────────────────────
  // Public Data Accessors (for container-level filter bars)
  // ─────────────────────────────────────────────────────────────

  /** @returns {Array<{field: string, label?: string, type?: string}>} */
  getContentColumns() { return this.#columns; }

  /** @returns {Array<Object>} raw (unfiltered) rows */
  getContentRows() { return this.#allRows; }
}

customElements.define('sherpa-data-grid', SherpaDataGrid);

export { SherpaDataGrid };
export default SherpaDataGrid;
