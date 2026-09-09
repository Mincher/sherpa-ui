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

  override onRender(): void {
    this.$('.head-row')?.addEventListener('click', this.#onHeaderClick);
    this.$('.body')?.addEventListener('click', this.#onRowClick);
    // Selection: select-all in the header, per-row boxes delegated on the body.
    this.$('.select-all')?.addEventListener('change', this.#onSelectAll);
    this.$('.body')?.addEventListener('change', this.#onRowSelect);
    // Filter: delegate input from the secondary header row.
    this.$('.filter-row')?.addEventListener('input', this.#onFilterInput);
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
      const input = th.querySelector<HTMLInputElement>('.filter-input')!;
      input.placeholder = `Filter ${col.header ?? col.field}`;
      filterRow.appendChild(th);
    }
  }

  #renderBody(): void {
    const body = this.$('.body');
    const rowTpl = this.$<HTMLTemplateElement>('template.row-tpl');
    const cellTpl = this.$<HTMLTemplateElement>('template.cell-tpl');
    if (!body || !rowTpl || !cellTpl) return;

    body.replaceChildren();
    this.#sortedRows().forEach((record, i) => {
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

  /** Rows sorted by the active sort field/direction (a stable copy). */
  #sortedRows(): GridRow[] {
    const field = this.dataset['sortField'];
    if (!field) return this.#rows;
    const dir = this.dataset['sortDirection'] === 'desc' ? -1 : 1;
    return [...this.#rows].sort((a, b) => {
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
    this.emit('row-click', { index, row: this.#sortedRows()[index] });
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
    const field = input.closest<HTMLElement>('.filter-cell')?.dataset['field'];
    if (!field) return;
    this.emit('filter-change', { field, value: (input as HTMLInputElement).value });
  };
}

customElements.define('sherpa-data-grid', SherpaDataGrid);
