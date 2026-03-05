/**
 * SherpaTable - Data table component with sortable columns and collapsible row segments.
 * Serves as the default data visualization and base for other viz types (metric, chart).
 * 
 * Data flow: config → fetchContentData → render
 * 
 * Segment/Sort state is managed via attributes (data-segment-field, data-segment-mode, etc.)
 * Filter chips sync their state to these parent attributes automatically.
 */
import { ContentAttributesMixin, CONTENT_ATTRIBUTES } from "../utilities/content-attributes-mixin.js";
import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";
import "../sherpa-button/sherpa-button.js";
import "../sherpa-header/sherpa-header.js";
import { getTransferableConfig } from "../utilities/data-utils.js";
import { escapeHtml, formatValue, formatFieldName, generateUniqueId } from "../utilities/index.js";

const NUMERIC_TYPES = new Set(["number", "numeric", "currency", "percent", "year", "monthNumber"]);

class SherpaTable extends ContentAttributesMixin(SherpaElement) {
  static get cssUrl()  { return new URL('./sherpa-base-table.css', import.meta.url).href; }
  static get htmlUrl() { return new URL('./sherpa-base-table.html', import.meta.url).href; }

  // ── Pluggable data providers (injected by the host app at boot) ──
  static #dataProvider = null;
  static #dateFieldProvider = null;

  /**
   * Register a data provider function that components call to fetch/prepare data.
   * Signature: async (config) => { name, columns, rows, summary, config, metadata }
   * @param {Function} fn - Data provider function
   */
  static setDataProvider(fn) { SherpaTable.#dataProvider = fn; }

  /**
   * Register a date-field provider that returns the date field name for a dataset.
   * Signature: (datasetName) => string | null
   * @param {Function} fn - Date field provider function
   */
  static setDateFieldProvider(fn) { SherpaTable.#dateFieldProvider = fn; }

  static get observedAttributes() { 
    return [
      ...super.observedAttributes,
      "data-loading",
      "data-segment-field",
      "data-segment-mode",
      "data-sort-field",
      "data-sort-direction",
      ...CONTENT_ATTRIBUTES
    ]; 
  }

  onAttributeChanged(name, oldValue, newValue) {
    // Re-render when segment/sort attributes change
    if (["data-segment-field", "data-segment-mode", "data-sort-field", "data-sort-direction"].includes(name)) {
      if (this.#data) {
        this.#render();
      }
    }
  }

  #data = null;
  #menuId = null;
  #pendingMenuData = null;
  #originalOrderBy = null;
  #originalSegmentBy = null;
  #externalFilters = [];    // External filters from FilterCoordinator (layered scoping)

  // ─────────────────────────────────────────────────────────────
  // Base Component Methods (Shared)
  // ─────────────────────────────────────────────────────────────

  async fetchContentData(config) {
    if (!config) return null;
    if (!SherpaTable.#dataProvider) {
      console.warn('[SherpaTable] No data provider registered. Call SherpaTable.setDataProvider(fn) at app boot.');
      return null;
    }
    this.setAttribute("data-loading", "");
    const result = await SherpaTable.#dataProvider(config);
    this.removeAttribute("data-loading");
    return result;
  }

  #showEmptyState(message = 'No data available') {
    const emptyEl = this.$('.empty-state');
    if (emptyEl) {
      emptyEl.textContent = escapeHtml(message);
      emptyEl.hidden = false;
    }
    const tableContainer = this.$('.table-container');
    if (tableContainer) tableContainer.hidden = true;
    const header = this.$('sherpa-header');
    if (header) header.hidden = true;
  }

  #hideEmptyState() {
    const emptyEl = this.$('.empty-state');
    if (emptyEl) emptyEl.hidden = true;
    const tableContainer = this.$('.table-container');
    if (tableContainer) tableContainer.hidden = false;
  }

  // ─────────────────────────────────────────────────────────────
  // Attribute Helpers
  // ─────────────────────────────────────────────────────────────

  #getSegmentField() {
    return this.getAttribute('data-segment-field') || null;
  }

  #isSegmentEnabled() {
    const mode = this.getAttribute('data-segment-mode');
    const field = this.#getSegmentField();
    return mode !== 'off' && !!field;
  }

  #getSortField() {
    return this.getAttribute('data-sort-field') || null;
  }

  #getSortDir() {
    return this.getAttribute('data-sort-direction') || 'asc';
  }

  #getActiveSort() {
    const field = this.#getSortField();
    if (!field) return null;
    const dir = this.#getSortDir();
    if (dir === 'off') return null;
    return { field, dir };
  }

  #clearAttribute(name) {
    if (this.hasAttribute(name)) {
      this.removeAttribute(name);
    }
  }

  #validateFieldsAgainstColumns(columns) {
    const rows = this.#data?.rows || [];
    const firstRow = rows[0];

    // Clear invalid segment field — but allow it if the field exists
    // in the row data (e.g. flat tables with a limited column set).
    const segmentField = this.#getSegmentField();
    if (segmentField && !columns.some(col => col.field === segmentField)) {
      const fieldInRows = firstRow && (segmentField in firstRow);
      if (!fieldInRows) {
        this.#clearAttribute('data-segment-field');
        this.#clearAttribute('data-segment-mode');
      }
    }

    // Clear invalid sort field
    const sortField = this.#getSortField();
    if (sortField && !columns.some(col => col.field === sortField)) {
      this.#clearAttribute('data-sort-field');
      this.#clearAttribute('data-sort-direction');
    }
  }

  // ─────────────────────────────────────────────────────────────
  // View Options and Header Configuration
  // ─────────────────────────────────────────────────────────────

  getViewOptions({ activeType, canShowChart = true }) {
    return [
      { type: "table", label: "Table", icon: "fa-table", active: activeType === "table" },
      { type: "kpi-metric", label: "Metric", icon: "fa-chart-bar", active: activeType === "kpi-metric" },
      { type: "barchart", label: "Bar Chart", icon: "fa-chart-simple", active: activeType === "barchart", disabled: !canShowChart, disabledTitle: canShowChart ? "" : "No primary axis field for chart" }
    ];
  }

  configureHeader({ title = "", viewOptions = [] } = {}) {
    const headerEl = this.$('sherpa-header');
    if (!headerEl) {
      this.#pendingMenuData = null;
      return;
    }

    const showHeader = this.getAttribute("data-show-header") !== "false";
    headerEl.hidden = !showHeader;

    const showControls = this.getAttribute("data-show-header-controls") !== "false";
    showControls ? headerEl.removeAttribute("data-show-header-controls") : headerEl.setAttribute("data-show-header-controls", "false");

    const showViewMenu = this.getAttribute("data-show-view-menu") !== "false";
    showViewMenu ? headerEl.removeAttribute("data-show-view-menu") : headerEl.setAttribute("data-show-view-menu", "false");

    headerEl.heading = title || "";

    const shouldShowMenu = showViewMenu;
    const menuButton = headerEl.menuButtonElement;
    if (menuButton) {
      menuButton.toggleAttribute('hidden', !shouldShowMenu);
    } else if (shouldShowMenu) {
      headerEl.hasMenuButton = true;
    }

    if (shouldShowMenu) {
      this.#pendingMenuData = {
        showViewMenu,
        viewOptions
      };
    } else {
      this.#pendingMenuData = null;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Menu Wiring
  // ─────────────────────────────────────────────────────────────

  async wireContentMenu(root, activeType) {
    if (!this.#pendingMenuData) return;

    const header = root.$?.("sherpa-header") || root.querySelector?.("sherpa-header");
    if (!header?.isConnected) return;

    await header.rendered;
    const menuButton = header.menuButtonElement;
    if (!menuButton) return;
    await menuButton.rendered;

    this._menuButton = menuButton;

    if (!this._menuBound) {
      this._menuBound = true;
      this._menuCurrentType = activeType || "";

      // Populate menu each time it opens
      menuButton.addEventListener('menu-open', () => {
        this.#populateViewMenu(this._menuCurrentType);
      });

      this.#bindContentMenu(menuButton, activeType);
    } else {
      this._menuCurrentType = activeType || this._menuCurrentType || "";
    }
  }

  #bindContentMenu(menuButton, activeType) {
    menuButton.addEventListener('menu-select', (event) => {
      const detail = event.detail ?? {};
      if (detail.disabled) return;

      const type = detail.data?.type;

      if (type && type !== (this._menuCurrentType || activeType)) {
        this._menuCurrentType = type;
        if (Array.isArray(this.#pendingMenuData?.viewOptions)) {
          this.#pendingMenuData.viewOptions = this.#pendingMenuData.viewOptions.map((option) => ({
            ...option,
            active: option.type === type
          }));
        }

        this.dispatchEvent(new CustomEvent('presentationchange', {
          bubbles: true,
          detail: { type, data: this.getData?.() || null }
        }));
      }
    });
  }

  /**
   * Build DOM content for the view-switching menu and populate the button's menu.
   */
  #populateViewMenu(activeType) {
    const config = this.#pendingMenuData;
    if (!config?.showViewMenu || !config.viewOptions?.length) return;

    const frag = document.createDocumentFragment();

    const heading = document.createElement('sherpa-menu-item');
    heading.setAttribute('data-type', 'heading');
    heading.textContent = 'View';
    frag.appendChild(heading);

    const ul = document.createElement('ul');
    ul.dataset.group = 'view';

    const normalizeIcon = (icon) => {
      if (!icon) return null;
      if (/fa-(solid|regular|light|thin|duotone|brands)\b/.test(icon)) return icon;
      return `fa-regular ${icon}`;
    };

    for (const option of config.viewOptions) {
      const li = document.createElement('li');
      const item = document.createElement('sherpa-menu-item');
      item.setAttribute('data-selection', 'radio');
      item.setAttribute('value', option?.type ?? '');
      item.dataset.type = option?.type ?? '';
      if (normalizeIcon(option?.icon)) item.setAttribute('data-icon', normalizeIcon(option.icon));
      if ((option?.type ?? null) === activeType) item.setAttribute('checked', '');
      if (option?.disabled) item.setAttribute('disabled', '');
      if (option?.disabledTitle) item.setAttribute('data-description', option.disabledTitle);
      item.textContent = option?.label || '';
      li.appendChild(item);
      ul.appendChild(li);
    }

    frag.appendChild(ul);
    this._menuButton?.menuElement?.replaceChildren(frag);
  }

  // ─────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────

  getData() {
    if (!this.#data) return null;
    
    const config = getTransferableConfig(this.#data, 'table');
    const meta = this.#data?.metadata || {};
    const effectiveSegmentField = this.#isSegmentEnabled() ? this.#getSegmentField() : null;
    const columns = Array.isArray(this.#data?.columns) ? this.#data.columns : [];

    config.segmentField = effectiveSegmentField;
    config.seriesField = null;
    config.categoryField = meta.primaryField || meta.categoryField || config.categoryField || null;
    config.valueField = meta.valueField || config.valueField || meta.field || null;
    delete config.segmentBy;

    if (!config.category) {
      const primaryField = meta.primaryField || columns[0]?.field || null;
      if (primaryField) config.category = primaryField;
    }

    if (!Array.isArray(config.measures) || config.measures.length === 0) {
      const numericCol = columns.find(col => NUMERIC_TYPES.has((col.type || '').toLowerCase()));
      if (numericCol?.field) config.measures = [{ field: numericCol.field, agg: 'sum' }];
    }

    const activeSort = this.#getActiveSort();
    config.orderBy = activeSort
      ? [{ field: activeSort.field, direction: activeSort.dir }]
      : (this.#originalOrderBy ? [this.#originalOrderBy] : (meta.orderBy || []));

    // Preserve original config values for revert after presentation switch
    if (this.#originalOrderBy) config.originalOrderBy = this.#originalOrderBy;
    if (this.#originalSegmentBy) config.originalSegmentBy = this.#originalSegmentBy;
    
    return config;
  }

  async setData(config) {
    this.setAttribute("data-loading", "");
    
    if (!this.#menuId) {
      this.#menuId = generateUniqueId('table');
    }

    // Capture original config values for revert-on-off
    // Prefer explicit originalOrderBy/originalSegmentBy from presentation switches
    if (config?.originalOrderBy) {
      this.#originalOrderBy = config.originalOrderBy;
    } else if (config?.orderBy) {
      const order = Array.isArray(config.orderBy) ? config.orderBy[0] : { field: config.orderBy, direction: config.orderDirection || 'asc' };
      if (order?.field) {
        this.#originalOrderBy = { field: order.field, direction: order.direction || 'asc' };
      }
    }
    if (config?.originalSegmentBy) {
      this.#originalSegmentBy = config.originalSegmentBy;
    } else if (config && Object.prototype.hasOwnProperty.call(config, 'segmentBy') && config.segmentBy) {
      this.#originalSegmentBy = config.segmentBy;
    }
    
    // Apply segmentBy from config if explicitly provided
    if (config && Object.prototype.hasOwnProperty.call(config, 'segmentBy')) {
      if (config.segmentBy) {
        this.setAttribute('data-segment-field', config.segmentBy);
        this.setAttribute('data-segment-mode', 'on');
      } else {
        this.#clearAttribute('data-segment-field');
        this.#clearAttribute('data-segment-mode');
      }
    }
    
    // Note: config.orderBy is NOT applied as sort attributes.
    // Tables default to chronological sort (by dataset dateField) unless
    // the user explicitly clicks a column header.
    
    try {
      this.#data = await this.fetchContentData(config);
      const columns = this.#data?.columns || [];

      // Validate and clear invalid fields
      this.#validateFieldsAgainstColumns(columns);

    } catch (e) {
      console.error('[SherpaTable] Data error:', e);
      this.#data = null;
    }
    
    this.removeAttribute("data-loading");
    if (!this.#data) {
      this.#showEmptyState();
      return;
    }

    await this.rendered;
    this.#render();
  }

  // ─────────────────────────────────────────────────────────────
  // Rendering
  // ─────────────────────────────────────────────────────────────

  #render() {
    if (!this.#data) return;

    const { name, columns, rows, segmentField: dataSegmentField, segmentedRows } = this.#data;

    if (!Array.isArray(columns) || columns.length === 0 || !Array.isArray(rows) || rows.length === 0) {
      this.#showEmptyState();
      return;
    }

    this.#hideEmptyState();

    // Read current state from attributes
    const segmentField = this.#getSegmentField();
    const segmentEnabled = this.#isSegmentEnabled();
    const activeSegmentField = segmentEnabled ? (segmentField || dataSegmentField) : null;
    const activeSort = this.#getActiveSort();

    const hideColIdx = activeSegmentField ? columns.findIndex(c => c.field === activeSegmentField) : -1;
    const hiddenCols = new Set(hideColIdx >= 0 ? [hideColIdx] : []);

    // Title comes from DataService — append "by X" when segmentation is active
    const baseName = name || '';
    const displayName = (segmentEnabled && activeSegmentField)
      ? `${baseName} by ${formatFieldName(activeSegmentField)}`
      : baseName;

    // Apply external filters, then sort
    const filtered = this.#applyExternalFilters(rows);

    // Default to chronological sort when no explicit sort is active
    const effectiveSort = activeSort || this.#getDefaultChronologicalSort(columns);
    const sortedRows = this.#sortRows([...filtered], columns, effectiveSort);

    // Build segmented rows from sorted rows so each segment is in sort order
    let activeSegmentedRows = null;
    if (segmentEnabled && activeSegmentField) {
      activeSegmentedRows = new Map();
      for (const row of sortedRows) {
        const key = String(row[activeSegmentField] ?? '');
        if (!activeSegmentedRows.has(key)) activeSegmentedRows.set(key, []);
        activeSegmentedRows.get(key).push(row);
      }
    }

    const useSegmentation = segmentEnabled && activeSegmentField && activeSegmentedRows instanceof Map && activeSegmentedRows.size > 0;

    // Configure header
    this.configureHeader({
      title: displayName,
      viewOptions: this.getViewOptions({ activeType: "table", canShowChart: columns.length > 0 })
    });

    // Render table
    const thead = this.$('.table-container thead');
    const tbody = this.$('.table-container tbody');
    const tfoot = this.$('.table-container tfoot');

    if (thead) {
      thead.innerHTML = this.#renderHeader(columns, hiddenCols, activeSort);
      this.#wireHeaderSort(thead);
    }

    if (tbody) {
      tbody.innerHTML = useSegmentation
        ? this.#renderSegmentedBody(columns, sortedRows, activeSegmentedRows, activeSegmentField, hiddenCols)
        : this.#renderFlatBody(columns, sortedRows, hiddenCols);
    }

    if (tfoot) tfoot.innerHTML = "";

    this.setAttribute('title', displayName);
    this.wireContentMenu(this, "table");
    this.#setupSegmentInteractions();
  }

  #setupSegmentInteractions() {
    const tbody = this.$('.table-container tbody');
    if (!tbody) return;

    tbody.querySelectorAll('.segment-header').forEach(header => {
      header.addEventListener('click', () => {
        const segment = header.closest('.table-segment');
        if (segment) segment.toggleAttribute('data-open');
      });
    });
  }

  #renderHeader(columns, hiddenCols, activeSort) {
    return `<tr>${columns.map((col, i) => {
      if (hiddenCols.has(i)) return '';
      const isNum = NUMERIC_TYPES.has(col.type);
      const isSorted = activeSort?.field === col.field;
      const sortIcon = isSorted ? (activeSort.dir === 'asc' ? '▲' : '▼') : '';
      return `<th scope="col" data-field="${escapeHtml(col.field)}" class="${isNum ? 'numeric' : ''} ${isSorted ? 'sorted' : ''}" style="cursor:pointer">${escapeHtml(col.name || col.field)} ${sortIcon}</th>`;
    }).join('')}</tr>`;
  }

  /** Wire click handlers on header cells for interactive column sorting. */
  #wireHeaderSort(thead) {
    for (const th of thead.querySelectorAll('th[data-field]')) {
      th.addEventListener('click', () => this.#onColumnSort(th.dataset.field));
    }
  }

  /** Cycle sort: asc → desc → off. Dispatch sortchange for parent containers. */
  #onColumnSort(field) {
    const currentField = this.#getSortField();
    const currentDir = this.#getSortDir();

    let newDir;
    if (currentField === field) {
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

  #renderFlatBody(columns, rows, hiddenCols) {
    return rows.map(row => this.#renderRow(columns, row, hiddenCols)).join('');
  }

  #renderSegmentedBody(columns, rows, segmentedRows, segmentField, hiddenCols) {
    let html = '';
    const visibleColCount = columns.length - hiddenCols.size;
    
    for (const [segmentKey, segmentRowData] of segmentedRows) {
      html += `
        <tr class="segment-wrapper">
          <td colspan="${visibleColCount}">
            <div class="table-segment sherpa-motion-expand-vertical" data-open>
              <div class="segment-header expand-header">
                <i class="fa-solid fa-chevron-right sherpa-icon segment-arrow"></i>
                <span class="segment-label">${escapeHtml(segmentKey)}</span>
                <span class="segment-count">(${segmentRowData.length})</span>
              </div>
              <div class="segment-content expand-content">
                <table>
                  ${segmentRowData.map(row => this.#renderRow(columns, row, hiddenCols)).join('')}
                </table>
              </div>
            </div>
          </td>
        </tr>
      `;
    }
    
    return html;
  }

  #renderRow(columns, row, hiddenCols) {
    const visibleColumns = columns.filter((_, i) => !hiddenCols.has(i));
    const firstVisible = visibleColumns[0];
    
    return `<tr>${columns.map((col, i) => {
      if (hiddenCols.has(i)) return '';
      const value = row[col.field];
      const isNum = NUMERIC_TYPES.has(col.type);
      const tag = col === firstVisible ? 'th scope="row"' : 'td';
      return `<${tag} class="${isNum ? 'numeric' : ''}">${formatValue(value, col.type)}</${tag.split(' ')[0]}>`;
    }).join('')}</tr>`;
  }

  // ─────────────────────────────────────────────────────────────
  // Sorting
  // ─────────────────────────────────────────────────────────────

  /**
   * Returns a default sort by the dataset's dateField (descending) if one
   * exists in the rows, even when it is not a visible column.
   */
  #getDefaultChronologicalSort(columns) {
    const dataset = this.#data?.metadata?.dataset;
    const dateField = dataset && SherpaTable.#dateFieldProvider
      ? SherpaTable.#dateFieldProvider(dataset)
      : null;
    if (!dateField) return null;

    // The field must exist in the actual row data (it may not be a visible column)
    const firstRow = this.#data?.rows?.[0];
    if (!firstRow || !(dateField in firstRow)) return null;

    return { field: dateField, dir: 'desc' };
  }

  #sortRows(rows, columns, activeSort) {
    if (!activeSort) return rows;
    
    const sortField = activeSort.field;
    const colType = columns.find(c => c.field === sortField)?.type;
    const dir = activeSort.dir === 'desc' ? -1 : 1;
    
    return rows.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      return this.#compare(aVal, bVal, colType) * dir;
    });
  }

  #compare(a, b, type) {
    if (a == null && b == null) return 0;
    if (a == null) return 1;
    if (b == null) return -1;
    
    if (NUMERIC_TYPES.has(type)) {
      return Number(a) - Number(b);
    }
    return String(a).localeCompare(String(b));
  }

  // ─────────────────────────────────────────────────────────────
  // External Filters (FilterCoordinator integration)
  // ─────────────────────────────────────────────────────────────

  /** Apply external filters from a FilterCoordinator (layered scoping).
   *  These are composed with the component's own segment/sort via AND.
   *  @param {Array<{field: string, values: string[]}>} externalFilters */
  setExternalFilters(externalFilters) {
    this.#externalFilters = Array.isArray(externalFilters) ? externalFilters : [];
    if (this.#data) this.#render();
  }

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

  // ─────────────────────────────────────────────────────────────
  // Public Data Accessors (for container-level filter bars)
  // ─────────────────────────────────────────────────────────────

  /** @returns {Array<{field: string, label?: string, type?: string}>} */
  getContentColumns() { return this.#data?.columns || []; }

  /** @returns {Array<Object>} raw (unfiltered) rows */
  getContentRows() { return this.#data?.rows || []; }
}

customElements.define("sherpa-base-table", SherpaTable);

export { SherpaTable };
export default SherpaTable;
