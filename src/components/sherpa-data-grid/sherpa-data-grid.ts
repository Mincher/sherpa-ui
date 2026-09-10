/**
 * sherpa-data-grid — a sortable table that composes the Grid Cell model.
 *
 * Give it data with populate({ columns, rows }) and it draws the header and rows.
 * Clicking a sortable column header sorts by it, toggling between ascending and
 * descending. Clicking a row fires row-click.
 *
 * Two opt-in features mirror the Figma Grid Cell (926:34253):
 *   • data-selectable adds a leading checkbox column (a select-all in the header
 *     and a checkbox per row); toggling emits selection-change.
 *   • data-filterable adds a secondary header row of per-column filter inputs;
 *     typing emits filter-change.
 * Both are CSS-gated — the columns/rows exist in the template always and only JS
 * behaviour (selection tracking, filter dispatch) lives here.
 *
 * @element sherpa-data-grid
 * @attr {enum}    data-sort-field      current sort column field
 * @attr {enum}    data-sort-direction  asc | desc
 * @attr {boolean} data-selectable      show a leading checkbox column
 * @attr {boolean} data-filterable      show a secondary filter-input header row
 *
 * @fires sort-change      — a sortable header is clicked. bubbles + composed. detail: { field: string, direction: 'asc' | 'desc' }
 * @fires row-click        — a row is clicked. bubbles + composed. detail: { index: number, row: object }
 * @fires selection-change — a selection checkbox toggles. bubbles + composed. detail: { selected: string[] }
 * @fires filter-change    — a filter input changes. bubbles + composed. detail: { field: string, value: string }
 */
import { SherpaElement } from '../../core/sherpa-element.js';

export interface GridColumn {
  field: string;
  header?: string;
  /** number → right-aligned mono cells; anything else → default text. */
  type?: string;
  sortable?: boolean;
}

type GridRow = Record<string, unknown>;

interface GridConfig {
  columns: GridColumn[];
  rows: GridRow[];
}

export class SherpaDataGrid extends SherpaElement {
  static override css = new URL('./sherpa-data-grid.css', import.meta.url);
  static override html = new URL('./sherpa-data-grid.html', import.meta.url);
  static override observed = ['data-sort-field', 'data-sort-direction'];

  #columns: GridColumn[] = [];
  #rows: GridRow[] = [];
  /** Active per-column filter text, keyed by field. Empty entries are removed. */
  #filters = new Map<string, string>();

  override onRender(): void {
    this.$('.head-row')?.addEventListener('click', this.#onHeaderClick);
    this.$('.body')?.addEventListener('click', this.#onRowClick);
    // Selection: select-all in the header, per-row boxes delegated on the body.
    this.$('.select-all')?.addEventListener('change', this.#onSelectAll);
    this.$('.body')?.addEventListener('change', this.#onRowSelect);
    // Filter: delegate both the typing and the clear button from the filter row.
    this.$('.filter-row')?.addEventListener('input', this.#onFilterInput);
    this.$('.filter-row')?.addEventListener('click', this.#onFilterClick);
    if (this.#columns.length) this.#render();
  }

  override onChange(): void {
    if (this.#columns.length) this.#render();
  }

  /** populate({ columns, rows }) — the grid config. */
  protected override renderData(data: unknown): void {
    const cfg = (data ?? {}) as Partial<GridConfig>;
    this.#columns = Array.isArray(cfg.columns) ? cfg.columns : [];
    this.#rows = Array.isArray(cfg.rows) ? cfg.rows : [];
    // Fresh data means the old filters may name columns that no longer exist, and
    // silently hiding rows against an invisible filter would look like data loss.
    this.#filters.clear();
    this.#render();
  }

  /* ── Render ─────────────────────────────────────────────────────── */

  #render(): void {
    this.toggleAttribute('data-empty', this.#rows.length === 0);
    this.#renderHead();
    this.#renderBody();
    // Fresh rows stamp unchecked — clear the header select-all to match.
    const selectAll = this.$<HTMLInputElement>('.select-all');
    if (selectAll) {
      selectAll.checked = false;
      selectAll.indeterminate = false;
    }
  }

  #renderHead(): void {
    const headRow = this.$('.head-row');
    const tpl = this.$<HTMLTemplateElement>('template.head-cell-tpl');
    if (!headRow || !tpl) return;
    const sortField = this.dataset['sortField'];
    const sortDir = this.dataset['sortDirection'];

    // Keep the fixed leading select-head <th>; rebuild only the dynamic cells.
    headRow.querySelectorAll('.head-cell').forEach((el) => el.remove());
    for (const col of this.#columns) {
      const th = tpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
      th.dataset['field'] = col.field;
      const sortable = col.sortable !== false;
      th.dataset['sortable'] = String(sortable);
      th.querySelector('.head-label')!.textContent = col.header ?? col.field;
      if (sortable && col.field === sortField) th.dataset['sort'] = sortDir ?? 'asc';
      headRow.appendChild(th);
    }

    this.#renderFilterRow();
  }

  /** Stamp one filter input per column into the secondary header row. */
  #renderFilterRow(): void {
    const filterRow = this.$('.filter-row');
    const tpl = this.$<HTMLTemplateElement>('template.filter-cell-tpl');
    if (!filterRow || !tpl) return;

    // Keep the fixed leading spacer <th>; rebuild only the dynamic filter cells.
    filterRow.querySelectorAll('.filter-cell').forEach((el) => el.remove());
    for (const col of this.#columns) {
      const th = tpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
      th.dataset['field'] = col.field;
      const label = col.header ?? col.field;
      const input = th.querySelector<HTMLInputElement>('.filter-input')!;
      input.placeholder = `Filter ${label}`;
      // The input has no visible <label>, and the placeholder disappears once the
      // user types — so the accessible name has to be an attribute.
      input.setAttribute('aria-label', `Filter ${label}`);
      th.querySelector('.filter-clear')!.setAttribute('aria-label', `Clear ${label} filter`);
      // A rebuilt row starts empty, so any previous filter for this column is gone.
      if (this.#filters.has(col.field)) {
        input.value = this.#filters.get(col.field) ?? '';
        th.toggleAttribute('data-has-value', true);
      }
      filterRow.appendChild(th);
    }
  }

  #renderBody(): void {
    const body = this.$('.body');
    const rowTpl = this.$<HTMLTemplateElement>('template.row-tpl');
    const cellTpl = this.$<HTMLTemplateElement>('template.cell-tpl');
    if (!body || !rowTpl || !cellTpl) return;

    body.replaceChildren();
    // Rows are FILTERED then SORTED, and the index written on each <tr> is the
    // index into THAT visible list — so row-click and selection-change keep
    // pointing at the record the user actually sees.
    this.#visibleRows().forEach((record, i) => {
      const tr = rowTpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
      tr.dataset['index'] = String(i);
      for (const col of this.#columns) {
        const td = cellTpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
        if (col.type) td.dataset['type'] = col.type;
        const value = record[col.field];
        td.textContent = value == null ? '' : String(value);
        tr.appendChild(td);
      }
      body.appendChild(tr);
    });
  }

  /**
   * The rows actually on screen: filtered, then sorted.
   *
   * Every consumer that maps a row INDEX back to a record must use this — a
   * `<tr>`'s data-index is its position in THIS list, so resolving against the
   * unfiltered rows would return a different record once a filter is active.
   */
  #visibleRows(): GridRow[] {
    return this.#sortRows(this.#filteredRows());
  }

  /**
   * Rows matching EVERY active column filter, case-insensitively, by substring.
   *
   * Substring rather than prefix because a table filter is a "find" — typing
   * "example" should find an address that merely contains it. Values are
   * stringified first so a numeric column filters as readily as a text one.
   */
  #filteredRows(): GridRow[] {
    if (!this.#filters.size) return this.#rows;
    return this.#rows.filter((record) =>
      [...this.#filters].every(([field, needle]) => {
        const value = record[field];
        if (value == null) return false;
        return String(value).toLowerCase().includes(needle);
      }),
    );
  }

  #sortRows(rows: GridRow[]): GridRow[] {
    const field = this.dataset['sortField'];
    if (!field) return rows;
    const dir = this.dataset['sortDirection'] === 'desc' ? -1 : 1;
    // Sort the list PASSED IN, not this.#rows — otherwise a filtered list would
    // be silently replaced by the full one and filtering would appear to do nothing.
    return [...rows].sort((a, b) => {
      const av = a[field];
      const bv = b[field];
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }

  /* ── Interaction ────────────────────────────────────────────────── */

  #onHeaderClick = (event: Event): void => {
    const th = (event.target as HTMLElement).closest<HTMLElement>('.head-cell');
    const field = th?.dataset['field'];
    if (!field || th!.dataset['sortable'] === 'false') return;

    // Cycle: not-this-field → asc → desc → asc …
    const active = this.dataset['sortField'] === field;
    const next = active && this.dataset['sortDirection'] === 'asc' ? 'desc' : 'asc';
    this.dataset['sortField'] = field;
    this.dataset['sortDirection'] = next;
    this.emit('sort-change', { field, direction: next });
    // onChange re-renders.
  };

  #onRowClick = (event: Event): void => {
    // A click on a selection checkbox is selection, not row activation.
    if ((event.target as HTMLElement).closest('.select-cell')) return;
    const tr = (event.target as HTMLElement).closest<HTMLElement>('.row');
    const raw = tr?.dataset['index'];
    if (raw == null) return;
    const index = Number(raw);
    // Resolve against the VISIBLE list — data-index is a position in that list,
    // so using the unfiltered one would hand back a different record.
    this.emit('row-click', { index, row: this.#visibleRows()[index] });
  };

  /* ── Selection ──────────────────────────────────────────────────── */

  /** Header select-all: set every row checkbox to match, then broadcast. */
  #onSelectAll = (event: Event): void => {
    const checked = (event.target as HTMLInputElement).checked;
    this.$$<HTMLInputElement>('.row-select').forEach((box) => (box.checked = checked));
    this.#emitSelection();
  };

  /** A single row checkbox toggled: reconcile the select-all state, broadcast. */
  #onRowSelect = (event: Event): void => {
    if (!(event.target as HTMLElement).classList.contains('row-select')) return;
    this.#syncSelectAll();
    this.#emitSelection();
  };

  /** Reflect all/none/indeterminate on the header select-all box. */
  #syncSelectAll(): void {
    const all = this.$$<HTMLInputElement>('.row-select');
    const selectAll = this.$<HTMLInputElement>('.select-all');
    if (!selectAll) return;
    const checked = all.filter((b) => b.checked).length;
    selectAll.checked = checked > 0 && checked === all.length;
    selectAll.indeterminate = checked > 0 && checked < all.length;
  }

  /** Emit the current selection as row indices (strings) in sorted-view order. */
  #emitSelection(): void {
    const selected = this.$$<HTMLInputElement>('.row-select')
      .filter((box) => box.checked)
      .map((box) => box.closest<HTMLElement>('.row')?.dataset['index'] ?? '')
      .filter((id) => id !== '');
    this.emit('selection-change', { selected });
  }

  /* ── Column filters ─────────────────────────────────────────────── */

  #onFilterInput = (event: Event): void => {
    const input = event.target as HTMLElement;
    if (!input.classList.contains('filter-input')) return;
    this.#applyFilter(input as HTMLInputElement);
  };

  /** The trailing clear button: empty its own field, re-filter, restore focus. */
  #onFilterClick = (event: Event): void => {
    const button = (event.target as HTMLElement).closest('.filter-clear');
    if (!button) return;
    const cell = button.closest<HTMLElement>('.filter-cell');
    const input = cell?.querySelector<HTMLInputElement>('.filter-input');
    if (!input) return;
    input.value = '';
    this.#applyFilter(input);
    // Clearing is a step in typing, so hand the caret straight back.
    input.focus();
  };

  /**
   * Record one column's filter text and redraw the body.
   *
   * The needle is lower-cased ONCE here rather than per row in the match loop —
   * with a few hundred rows and a keystroke per character that matters.
   */
  #applyFilter(input: HTMLInputElement): void {
    const cell = input.closest<HTMLElement>('.filter-cell');
    const field = cell?.dataset['field'];
    if (!field) return;

    const value = input.value;
    const needle = value.trim().toLowerCase();
    if (needle) this.#filters.set(field, needle);
    else this.#filters.delete(field);

    // CSS shows the clear button off this flag — JS never touches `display`.
    cell?.toggleAttribute('data-has-value', value.length > 0);

    this.#renderBody();
    // "No matches" is NOT data-empty: that hides the whole <table>, which would
    // take the filter input the user is typing in with it. A separate flag lets CSS
    // keep the header and filter row up and show the message under them.
    const visible = this.#visibleRows().length;
    this.toggleAttribute('data-no-matches', visible === 0 && this.#rows.length > 0);
    // Rows were re-stamped unchecked, so the select-all must not look checked.
    const selectAll = this.$<HTMLInputElement>('.select-all');
    if (selectAll) {
      selectAll.checked = false;
      selectAll.indeterminate = false;
    }

    this.emit('filter-change', {
      field,
      value,
      filters: Object.fromEntries(this.#filters),
      visible,
    });
  }
}

customElements.define('sherpa-data-grid', SherpaDataGrid);
