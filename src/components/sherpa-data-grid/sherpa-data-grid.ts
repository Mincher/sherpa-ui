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
 * data-group-field GROUPS the rows by one column: rows are bunched by their value
 * in that column and each bunch gets a collapsible group row on top (Figma Grid
 * Cell Type=group) carrying that value as its label. The grouped column drops out
 * of the header and the body — its value IS the heading, so repeating it in every
 * row below would be noise.
 *
 * @element sherpa-data-grid
 * @attr {enum}    data-sort-field      current sort column field
 * @attr {enum}    data-sort-direction  asc | desc
 * @attr {enum}    data-group-field     group the rows by this column
 * @attr {boolean} data-selectable      show a leading checkbox column
 * @attr {boolean} data-filterable      show a secondary filter-input header row
 *
 * @fires sort-change      — a sortable header is clicked. bubbles + composed. detail: { field: string, direction: 'asc' | 'desc' }
 * @fires row-click        — a row is clicked. bubbles + composed. detail: { index: number, row: object }
 * @fires selection-change — a selection checkbox toggles. bubbles + composed. detail: { selected: string[] }
 * @fires filter-change    — a filter input changes. bubbles + composed. detail: { field: string, value: string }
 * @fires group-toggle     — a group row is expanded or collapsed. bubbles + composed. detail: { value: string, collapsed: boolean }
 */
import { SherpaElement, coerceNum } from '../../core/sherpa-element.js';

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
  // data-selectable is observed even though CSS owns its reveal: the frozen
  // columns' inline-start offset is the MEASURED width of the selection cell, so
  // showing or hiding that column has to re-run #syncPinned().
  static override observed = [
    'data-sort-field',
    'data-sort-direction',
    'data-group-field',
    'data-selectable',
  ];

  #columns: GridColumn[] = [];
  #rows: GridRow[] = [];
  /** Active per-column filter text, keyed by field. Empty entries are removed. */
  #filters = new Map<string, string>();
  /**
   * The group values the user has collapsed.
   *
   * Kept on the component rather than read back off the DOM, so a re-render (a
   * sort, a filter keystroke) redraws the same groups still shut. Reading the flag
   * off the old rows would lose it the moment the body is replaced.
   */
  #collapsed = new Set<string>();
  /**
   * The selected RECORDS, held by object identity.
   *
   * Not by row index and not read back off the checkboxes: every re-render
   * (a sort, a filter keystroke, a quick-filter toggle) replaces the whole body,
   * so DOM-held selection vanished and an index would point at a different record
   * once the order changed. A record reference survives both.
   */
  #selected = new Set<GridRow>();
  /**
   * The last row CLICKED — the "focused" state.
   *
   * Held as the record, like the selection, so it survives a re-render. It is not
   * DOM focus: clicking a row's text does not focus anything focusable, and the
   * design calls for the last-clicked row to stay marked while the user works
   * elsewhere.
   */
  #focused: GridRow | null = null;

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
    // New records are new objects, so nothing selected or focused can still be
    // present.
    this.#selected.clear();
    this.#focused = null;
    this.#render();
  }

  /* ── Render ─────────────────────────────────────────────────────── */

  #render(): void {
    this.toggleAttribute('data-empty', this.#rows.length === 0);
    this.#renderHead();
    this.#renderBody();
    // The select-all is DERIVED from what is selected, not reset. Clearing it here
    // (as this used to) threw the user's selection away on every sort, filter
    // keystroke and quick-filter toggle.
    this.#syncSelectAll();
    this.#syncGroupSelects();
    // The focused row survives a sort / filter too — it is a record, not a position.
    this.#syncFocused();
    this.#syncPinned();
  }

  /**
   * Flag one cell as part of the frozen leading block.
   *
   * `data-pin-last` names the LAST pinned cell in the row — the only one that
   * draws the scroll shadow, so that a two-column freeze shows one edge and not
   * two. #syncPinned() moves the flag once the real set is known.
   */
  #markPinned(cell: HTMLElement, last: boolean): void {
    cell.toggleAttribute('data-pinned', true);
    cell.toggleAttribute('data-pin-last', last);
  }

  /**
   * Settle the frozen columns after a render.
   *
   * Two jobs, both of which need the DOM to exist:
   *
   *  1. The SELECTION cells join the frozen block, but only while
   *     data-selectable reveals them — a hidden `display: none` cell must not be
   *     pinned, or it would still claim the inline-start offset.
   *  2. The second pinned column's offset is the MEASURED width of the selection
   *     cell. The data column auto-sizes to its content, so no CSS value can
   *     express "clear whatever is pinned before me"; JS writes the one number
   *     and CSS does the rest. Written as a custom property on the host, so it is
   *     state, not a style decision.
   */
  #syncPinned(): void {
    const selectable = this.hasAttribute('data-selectable');
    for (const cell of this.$$('.select-cell')) {
      // The select cell is the FIRST pinned column, so it is only the last one
      // when there is no data column beside it — which cannot happen once the
      // grid has any columns at all.
      if (selectable) this.#markPinned(cell as HTMLElement, false);
      else {
        cell.removeAttribute('data-pinned');
        cell.removeAttribute('data-pin-last');
      }
    }

    // getBoundingClientRect rather than offsetWidth: the select cell's width is a
    // 0.5px-bordered 32px box, so the real laid-out width is fractional and
    // rounding it left a hairline of the scrolling column visible under the pin.
    const probe = this.$('.head-row > .select-cell');
    const offset = selectable && probe ? probe.getBoundingClientRect().width : 0;
    this.style.setProperty('--_pin-offset', `${offset}px`);
  }

  /**
   * Will's four new Figma icons, mapped to Font Awesome.
   *
   * The SAME map the quick-filter toolbar's organise chips use. Kept as one
   * public static rather than copied, so the grid's sort arrow and the
   * toolbar's sort chip can never drift into two different glyphs for one
   * state — which is the whole reason the map exists.
   *
   *   group            fa-layer-group
   *   sort-none        fa-sort
   *   sort-ascending   fa-arrow-up-wide-short
   *   sort-descending  fa-arrow-down-wide-short
   *
   * `sort-none` was fa-bars, which IS the hamburger-menu glyph — three equal
   * rules. On a column header that reads as a menu affordance, not "this column
   * can be sorted". fa-sort is the neutral up/down pair the state actually means.
   */
  static readonly icons = {
    group: 'fa-solid fa-layer-group',
    sortNone: 'fa-solid fa-sort',
    sortAsc: 'fa-solid fa-arrow-up-wide-short',
    sortDesc: 'fa-solid fa-arrow-down-wide-short',
  } as const;

  #renderHead(): void {
    const headRow = this.$('.head-row');
    const tpl = this.$<HTMLTemplateElement>('template.head-cell-tpl');
    if (!headRow || !tpl) return;
    const sortField = this.dataset['sortField'];
    const sortDir = this.dataset['sortDirection'];

    // Keep the fixed leading select-head <th>; rebuild only the dynamic cells.
    headRow.querySelectorAll('.head-cell').forEach((el) => el.remove());
    this.#shownColumns().forEach((col, i) => {
      const th = tpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
      th.dataset['field'] = col.field;
      // The header carries its column's TYPE too, so a numeric column's label can
      // align with the digits under it. A right-aligned column of numbers under a
      // left-aligned heading reads as two different columns.
      if (col.type) th.dataset['type'] = col.type;
      // The FIRST drawn column is frozen. Marked here rather than selected in CSS
      // with nth-child, because the position shifts by one when data-selectable
      // is absent and #shownColumns() can drop the grouped column.
      if (i === 0) this.#markPinned(th, true);
      const sortable = col.sortable !== false;
      th.dataset['sortable'] = String(sortable);
      th.querySelector('.head-label')!.textContent = col.header ?? col.field;
      const active = sortable && col.field === sortField;
      if (active) th.dataset['sort'] = sortDir ?? 'asc';

      // THE SORT GLYPH — a tri-state, from the shared map.
      //
      // A sortable column that is NOT the current sort shows `sort-none`, so it
      // reads as "you can sort by this" before anyone clicks. The old pure-CSS
      // triangle had no third state: it could only be up or down, so an
      // unsorted column showed nothing and looked unsortable.
      const icon = th.querySelector('.sort-icon');
      if (icon) {
        const { sortNone, sortAsc, sortDesc } = SherpaDataGrid.icons;
        icon.className = sortable
          ? `sort-icon ${!active ? sortNone : (sortDir === 'desc' ? sortDesc : sortAsc)}`
          : 'sort-icon';
      }
      headRow.appendChild(th);
    });

    this.#renderFilterRow();
  }

  /** Stamp one filter input per column into the secondary header row. */
  #renderFilterRow(): void {
    const filterRow = this.$('.filter-row');
    const tpl = this.$<HTMLTemplateElement>('template.filter-cell-tpl');
    if (!filterRow || !tpl) return;

    // Keep the fixed leading spacer <th>; rebuild only the dynamic filter cells.
    filterRow.querySelectorAll('.filter-cell').forEach((el) => el.remove());
    this.#shownColumns().forEach((col, i) => {
      const th = tpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
      th.dataset['field'] = col.field;
      if (col.type) th.dataset['type'] = col.type;
      if (i === 0) this.#markPinned(th, true);
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
    });
  }

  /**
   * The columns the table actually draws.
   *
   * The grouped column is dropped: its value is the group row's own heading, so
   * repeating it in every row underneath adds a column of identical text. The
   * `#columns` list is left intact, because un-grouping must bring the column
   * straight back without the caller re-populating.
   */
  #shownColumns(): GridColumn[] {
    const group = this.dataset['groupField'];
    if (!group) return this.#columns;
    return this.#columns.filter((c) => c.field !== group);
  }

  #renderBody(): void {
    const body = this.$('.body');
    const rowTpl = this.$<HTMLTemplateElement>('template.row-tpl');
    const cellTpl = this.$<HTMLTemplateElement>('template.cell-tpl');
    if (!body || !rowTpl || !cellTpl) return;

    const group = this.dataset['groupField'];
    const columns = this.#shownColumns();
    body.replaceChildren();

    // Rows are FILTERED then SORTED, and the index written on each <tr> is the
    // index into THAT visible list — so row-click and selection-change keep
    // pointing at the record the user actually sees.
    const rows = this.#visibleRows();
    let lastGroup: string | null = null;

    rows.forEach((record, i) => {
      // A new value in the grouped column opens a new group row. The rows are
      // already ordered by that column (see #sortRows), so one pass over them in
      // order produces every group exactly once — no separate bucketing step that
      // could disagree with the row order on screen.
      if (group) {
        const value = record[group];
        const key = value == null ? '' : String(value);
        if (key !== lastGroup) {
          lastGroup = key;
          body.appendChild(this.#groupRow(key, this.#groupSize(rows, group, key), columns.length));
        }
      }

      const tr = rowTpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
      tr.dataset['index'] = String(i);
      // Restore this record's own selection. The body is replaced wholesale on
      // every render, so the tick has to come from #selected rather than survive
      // in the DOM.
      const box = tr.querySelector<HTMLInputElement>('.row-select');
      if (box) box.checked = this.#selected.has(record);
      // Which group this row belongs to, so CSS can hide it when that group's
      // row is collapsed — the row itself never needs a `display` write.
      if (group && lastGroup !== null) tr.dataset['group'] = lastGroup;
      columns.forEach((col, c) => {
        const td = cellTpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
        if (col.type) td.dataset['type'] = col.type;
        if (c === 0) this.#markPinned(td, true);
        const value = record[col.field];
        td.textContent = value == null ? '' : String(value);
        tr.appendChild(td);
      });
      body.appendChild(tr);
    });

    // A re-render (sort, filter keystroke) stamps fresh rows, so re-apply the
    // groups the user had already folded shut.
    if (group) this.#syncGroupVisibility();
  }

  // No sticky-offset measurement. The WHOLE <thead> sticks as one block now, so
  // its two rows stay in normal flow relative to each other and nothing has to
  // know the label row's height. Measuring it and offsetting the filter row was
  // the bug: a sticky offset is measured from the SCROLLPORT, so it applied at
  // scroll 0 too and left a phantom empty band between the two header rows.

  /** How many visible rows share one group value. */
  #groupSize(rows: GridRow[], field: string, key: string): number {
    return rows.filter((r) => String(r[field] ?? '') === key).length;
  }

  /** One group heading row, spanning every drawn column. */
  #groupRow(key: string, size: number, columnCount: number): HTMLElement {
    const tr = this.clone('template.group-row-tpl');
    if (!tr) throw new Error('sherpa-data-grid: template.group-row-tpl is missing or empty');
    tr.dataset['group'] = key;
    const collapsed = this.#collapsed.has(key);
    // CSS draws the chevron rotation and hides the group's rows off this flag.
    tr.toggleAttribute('data-collapsed', collapsed);

    const cell = tr.querySelector<HTMLTableCellElement>('.group-cell')!;
    // +1 for the leading selection column, which exists in the template whether
    // or not data-selectable reveals it — a colspan that ignored it would leave
    // the group row one column short of the rows below.
    cell.colSpan = columnCount + 1;
    tr.querySelector('.group-label')!.textContent = key === '' ? '(none)' : key;
    tr.querySelector('.group-count')!.textContent = String(size);

    const toggle = tr.querySelector('.group-toggle')!;
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.setAttribute('aria-label', `${collapsed ? 'Expand' : 'Collapse'} ${key || 'ungrouped'}`);
    return tr;
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
    const group = this.dataset['groupField'];
    if (!field && !group) return rows;
    const dir = this.dataset['sortDirection'] === 'desc' ? -1 : 1;

    const compare = (a: GridRow, b: GridRow, key: string, direction: number): number => {
      const av = a[key];
      const bv = b[key];
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * direction;
      return String(av).localeCompare(String(bv)) * direction;
    };

    // Sort the list PASSED IN, not this.#rows — otherwise a filtered list would
    // be silently replaced by the full one and filtering would appear to do nothing.
    //
    // The GROUP key sorts first. That is what lets #renderBody find each group in
    // one pass: rows sharing a group value are guaranteed adjacent, so a change of
    // value is exactly a group boundary. The sort column then orders rows WITHIN
    // their group.
    return [...rows].sort(
      (a, b) =>
        (group ? compare(a, b, group, 1) : 0) || (field ? compare(a, b, field, dir) : 0),
    );
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

    // A group row is a heading, not a record: clicking it (anywhere, not just the
    // chevron) folds its rows away. It has no data-index, so it could never have
    // resolved to a record anyway.
    const groupRow = (event.target as HTMLElement).closest<HTMLElement>('.group-row');
    if (groupRow) {
      if ((event.target as HTMLElement).closest('.group-select')) return;
      this.#toggleGroup(groupRow);
      return;
    }

    const tr = (event.target as HTMLElement).closest<HTMLElement>('.row');
    const raw = tr?.dataset['index'];
    if (raw == null) return;
    const index = Number(raw);
    // Resolve against the VISIBLE list — data-index is a position in that list,
    // so using the unfiltered one would hand back a different record.
    const record = this.#visibleRows()[index];
    // FOCUSED: the last row clicked. CSS paints the tint off the flag; the record
    // is remembered so the next re-render can re-apply it.
    this.#focused = record ?? null;
    this.#syncFocused();
    this.emit('row-click', { index, row: record });
  };

  /** Mark the focused row; CSS owns the tint. */
  #syncFocused(): void {
    const rows = this.#visibleRows();
    for (const tr of this.$$<HTMLElement>('.row')) {
      const i = coerceNum(tr.dataset['index'], -1, { int: true });
      tr.toggleAttribute('data-focused', !!this.#focused && rows[i] === this.#focused);
    }
  }

  /* ── Grouping ───────────────────────────────────────────────────── */

  /**
   * Fold one group open or shut.
   *
   * The flag goes on the group ROW and CSS hides the matching rows off it, so JS
   * never writes `display`. The value is also remembered in `#collapsed`, because
   * the next sort or filter keystroke replaces the whole body and the flag on the
   * old rows would go with it.
   */
  #toggleGroup(groupRow: HTMLElement): void {
    const key = groupRow.dataset['group'] ?? '';
    const collapsed = !groupRow.hasAttribute('data-collapsed');
    groupRow.toggleAttribute('data-collapsed', collapsed);
    if (collapsed) this.#collapsed.add(key);
    else this.#collapsed.delete(key);

    const toggle = groupRow.querySelector('.group-toggle');
    toggle?.setAttribute('aria-expanded', String(!collapsed));
    toggle?.setAttribute('aria-label', `${collapsed ? 'Expand' : 'Collapse'} ${key || 'ungrouped'}`);

    // CSS needs to know WHICH groups are shut to hide their rows, and a sibling
    // selector cannot reach from a group row to the rows after it. So the set of
    // shut groups is written on each row instead.
    this.#syncGroupVisibility();
    this.emit('group-toggle', { value: key, collapsed });
  }

  /** Mark every row whose group is collapsed; CSS hides them. */
  #syncGroupVisibility(): void {
    for (const row of this.$$<HTMLElement>('.row')) {
      const key = row.dataset['group'];
      row.toggleAttribute('data-hidden', key != null && this.#collapsed.has(key));
    }
  }

  /* ── Selection ──────────────────────────────────────────────────── */

  /** Header select-all: set every row checkbox to match, then broadcast. */
  #onSelectAll = (event: Event): void => {
    const checked = (event.target as HTMLInputElement).checked;
    // Only the VISIBLE rows: a select-all cannot reach records a filter is hiding,
    // and it must not silently deselect them either.
    for (const record of this.#visibleRows()) {
      if (checked) this.#selected.add(record);
      else this.#selected.delete(record);
    }
    this.$$<HTMLInputElement>('.row-select').forEach((box) => (box.checked = checked));
    // Every group is now wholly in or wholly out, so its own box must say so.
    this.#syncGroupSelects();
    this.#emitSelection();
  };

  /** A single row checkbox toggled: reconcile the select-all state, broadcast. */
  #onRowSelect = (event: Event): void => {
    const target = event.target as HTMLElement;

    // A GROUP checkbox selects (or clears) every row in that group — the group row
    // is a heading for those rows, so its box is their select-all.
    if (target.classList.contains('group-select')) {
      this.#selectGroup(target as HTMLInputElement);
      return;
    }

    if (!target.classList.contains('row-select')) return;
    // Record the choice against the RECORD, so it survives the next re-render.
    const record = this.#recordFor(target);
    if (record) {
      if ((target as HTMLInputElement).checked) this.#selected.add(record);
      else this.#selected.delete(record);
    }
    this.#syncSelectAll();
    // A row's own box may have completed or broken its group's set.
    this.#syncGroupSelects();
    this.#emitSelection();
  };

  /** The record a row control belongs to, resolved through the VISIBLE list. */
  #recordFor(el: HTMLElement): GridRow | undefined {
    const raw = el.closest<HTMLElement>('.row')?.dataset['index'];
    if (raw == null) return undefined;
    return this.#visibleRows()[Number(raw)];
  }

  /** Set every row in one group to match its group checkbox, then broadcast. */
  #selectGroup(box: HTMLInputElement): void {
    const key = box.closest<HTMLElement>('.group-row')?.dataset['group'];
    if (key == null) return;
    for (const row of this.$$<HTMLElement>('.row')) {
      if (row.dataset['group'] !== key) continue;
      const rowBox = row.querySelector<HTMLInputElement>('.row-select');
      if (rowBox) rowBox.checked = box.checked;
      const record = this.#recordFor(row);
      if (!record) continue;
      if (box.checked) this.#selected.add(record);
      else this.#selected.delete(record);
    }
    this.#syncSelectAll();
    this.#emitSelection();
  }

  /**
   * Reflect all/none/indeterminate on each group checkbox.
   *
   * A group's box has to answer for its rows, so ticking rows one by one must fill
   * it in — otherwise the box and the rows it heads would disagree.
   */
  #syncGroupSelects(): void {
    for (const groupRow of this.$$<HTMLElement>('.group-row')) {
      const key = groupRow.dataset['group'];
      const box = groupRow.querySelector<HTMLInputElement>('.group-select');
      if (!box || key == null) continue;
      const rows = this.$$<HTMLElement>('.row').filter((r) => r.dataset['group'] === key);
      const checked = rows.filter(
        (r) => r.querySelector<HTMLInputElement>('.row-select')?.checked,
      ).length;
      box.checked = checked > 0 && checked === rows.length;
      box.indeterminate = checked > 0 && checked < rows.length;
    }
  }

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
    // `records` is the durable answer: a row index is a position in the CURRENTLY
    // VISIBLE list, so it changes meaning the moment a sort or filter does, and it
    // cannot describe a selected record a filter is hiding.
    this.emit('selection-change', { selected, records: this.selectedRecords });
  }

  /**
   * The selected RECORDS, including any a filter is currently hiding.
   *
   * Selection is a choice about records, not about rows on screen — filtering
   * changes what is visible, not what is chosen.
   */
  get selectedRecords(): GridRow[] {
    // Returned in the caller's original row order, so the list is stable rather
    // than in whatever order the boxes happened to be ticked.
    return this.#rows.filter((r) => this.#selected.has(r));
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
    // DERIVE the select-all from what is still selected. It used to be reset here,
    // which threw the user's selection away on every keystroke — a filter changes
    // which records are VISIBLE, not which are chosen.
    this.#syncSelectAll();
    this.#syncGroupSelects();

    this.emit('filter-change', {
      field,
      value,
      filters: Object.fromEntries(this.#filters),
      visible,
    });
  }
}

customElements.define('sherpa-data-grid', SherpaDataGrid);
