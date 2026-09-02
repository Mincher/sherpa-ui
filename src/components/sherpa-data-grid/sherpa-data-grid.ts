/**
 * sherpa-data-grid — a sortable table.
 *
 * Give it data with populate({ columns, rows }) and it draws the header and rows.
 * Clicking a sortable column header sorts by it, toggling between ascending and
 * descending. Clicking a row fires row-click. This is a plain grid — the heavier
 * features (grouping, aggregation, export, selection) are left out on purpose.
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
  }

  #renderHead(): void {
    const headRow = this.$('.head-row');
    const tpl = this.$<HTMLTemplateElement>('template.head-cell-tpl');
    if (!headRow || !tpl) return;
    const sortField = this.dataset['sortField'];
    const sortDir = this.dataset['sortDirection'];

    headRow.replaceChildren();
    for (const col of this.#columns) {
      const th = tpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
      th.dataset['field'] = col.field;
      const sortable = col.sortable !== false;
      th.dataset['sortable'] = String(sortable);
      th.querySelector('.head-label')!.textContent = col.header ?? col.field;
      if (sortable && col.field === sortField) th.dataset['sort'] = sortDir ?? 'asc';
      headRow.appendChild(th);
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
    this.emit('grid-sort-change', { field, direction: next });
    // onChange re-renders.
  };

  #onRowClick = (event: Event): void => {
    const tr = (event.target as HTMLElement).closest<HTMLElement>('.row');
    const raw = tr?.dataset['index'];
    if (raw == null) return;
    const index = Number(raw);
    this.emit('row-click', { index, row: this.#sortedRows()[index] });
  };
}

customElements.define('sherpa-data-grid', SherpaDataGrid);
