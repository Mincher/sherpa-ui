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
 *
 * A column ACTING on the view — the one being sorted, or one a filter is
 * narrowing — takes the Style `active` mode (data-status="active") on its
 * HEADING. Both are the same kind of thing, so both read the same. The heading
 * carries it because the heading is sticky: the filter box and the 14px sort
 * arrow are both gone by row 40, and the tinted column is not. The filter cell
 * itself never takes it — that row already says what it is doing.
 *
 * data-filter-fields is how a filter set OUTSIDE the grid — a quick-filter
 * toolbar above it — reaches the headers. The grid cannot see that toolbar and
 * populate() hands it only the surviving rows, so the data source writes the
 * narrowed field names here (space separated) and the grid lights those
 * columns. Without it a chip change just shrank the table, saying nothing.
 * Both are CSS-gated — the columns/rows exist in the template always and only JS
 * behaviour (selection tracking, filter dispatch) lives here.
 *
 * data-group-field GROUPS the rows by one column: rows are bunched by their value
 * in that column and each bunch gets a collapsible group row on top (Figma Grid
 * Cell Type=group) carrying that value as its label. The grouped column drops out
 * of the header and the body — its value IS the heading, so repeating it in every
 * row below would be noise. Groups run A→Z and data-sort-field orders the rows
 * WITHIN each group — unless the two name the SAME column, in which case
 * data-sort-direction orders the GROUPS.
 *
 * @element sherpa-data-grid
 * @attr {enum}    data-sort-field      current sort column field
 * @attr {enum}    data-sort-direction  asc | desc
 * @attr {enum}    data-group-field     group the rows by this column
 * @attr {string}  data-filter-fields   space-separated fields an EXTERNAL filter
 *   is narrowing; those columns' headers take data-status="active". Written by
 *   SherpaDataSource — a host driving the grid by hand can write it too.
 * @attr {boolean} data-selectable      show a leading checkbox column
 * @attr {boolean} data-filterable      show a secondary filter-input header row
 * @attr {boolean} data-column-filters  show a FILTER BUTTON in each column
 *   heading, left of the sort control. Clicking it opens a menu that builds one
 *   clause against that column, shaped by the column's `type`:
 *
 *     text    a condition picker + a value box
 *     number  a condition picker + a value box, or TWO boxes in Range mode
 *     date    a calendar — one day, or a start→end span in Range mode
 *
 *   Number and date lead with a RANGE switch: each is one filter with two
 *   shapes ("equals this" / "between these two"), and two separate controls
 *   would make the reader choose the shape before they know which they want.
 *   Any other type gets no button — an affordance that opens nothing is worse
 *   than none. The button is an icon-only <sherpa-quick-filter>, so the menu,
 *   its cross-shadow placement and its Apply footer are the chip's rather than
 *   a second copy living here.
 *
 * @fires sort-change      — the column sort control is clicked. bubbles + composed.
 *   detail: { field, direction } — TRI-STATE, so `field` is null and `direction`
 *   null on the third click, which turns the sort off. Only one column sorts at
 *   a time.
 * @fires row-click        — a row is clicked. bubbles + composed. detail: { index: number, row: object }
 * @fires selection-change — a selection checkbox toggles. bubbles + composed. detail: { selected: string[] }
 * @fires filter-change    — a filter input changes. bubbles + composed. detail: { field: string, value: string }
 * @fires group-toggle     — a group row is expanded or collapsed. bubbles + composed. detail: { value: string, collapsed: boolean }
 * @fires column-resize    — a column header grip is dragged. bubbles + composed. detail: { field: string, width: number }
 * @fires column-filter-change — a column's filter menu was applied or cleared.
 *   bubbles + composed. detail: { field, header, op, value, clause, label }.
 *   `clause` is a ready FilterClause ([field, op, value]) or null when cleared,
 *   so a host can hand it straight to a DataSource. `label` is the chip text a
 *   toolbar should show — "Contains: ana" — and `header` the column's own name,
 *   which together make the "Field: Condition Value" chip.
 *
 *   The grid does NOT filter its own rows off this. It has one column's clause
 *   and no idea what else is filtering the view; whoever owns the query owns
 *   the combining. The grid lights the column (see data-filter-fields) and
 *   says what was asked for.
 *
 * @attr {enum} data-select — multiple (default) | single. Single draws RADIOS and
 *   holds one row; the header cell shows no control, because "select all" is
 *   meaningless where only one can be chosen.
 */
import { SherpaElement, coerceNum } from '../../core/sherpa-element.js';
// The sort/group glyphs are SHARED with the quick-filter toolbar — see core/icons.
import { ORGANISE_ICONS } from '../../core/icons.js';
// The operator vocabulary is SHARED — every query-building surface reads the
// same labels and the same per-type lists, so no second vocabulary can appear.
import { OP_LABELS, OPS_FOR_TYPE } from '../../core/store.js';
// Each column heading carries an icon-only filter chip, and the chip's menu is
// a real <sherpa-menu>. Both must be DEFINED, not merely typed: the template
// stamps the elements, and an undefined custom element renders as an inert
// <sherpa-quick-filter> with no shadow root and no menu.
import '../sherpa-quick-filter/sherpa-quick-filter.js';
import '../sherpa-menu/sherpa-menu.js';
// A NUMBER or DATE column's menu leads with a Range switch, and a date column's
// body IS a calendar. Both are stamped from the template, so both must be
// defined or they render as inert unknown elements.
import '../sherpa-switch/sherpa-switch.js';
import '../sherpa-calendar/sherpa-calendar.js';
// A number column's RANGE shape is a two-ended slider, as the toolbar's is.
import '../sherpa-slider/sherpa-slider.js';

export interface GridColumn {
  field: string;
  header?: string;
  /** number → right-aligned mono cells; anything else → default text. */
  type?: string;
  sortable?: boolean;
  /**
   * Drawn width in px, clamped to MIN_COL_WIDTH..MAX_COL_WIDTH. Absent means
   * DEFAULT_COL_WIDTH. A user drag overrides it for the life of the grid.
   */
  width?: number;
}

type GridRow = Record<string, unknown>;

interface GridConfig {
  columns: GridColumn[];
  rows: GridRow[];
}

/**
 * One column heading's filter, as the grid holds it.
 *
 * `range` says which shape it is: a single `op` + `value`, or a `between` over
 * `from`..`to`. Both are kept rather than a tagged union, so flipping the Range
 * switch and flipping back finds what was typed on the other side still there.
 */
interface ColumnFilter {
  op: string;
  value: string;
  range?: boolean;
  from?: string;
  to?: string;
  /**
   * SET but not applied — the reader toggled its toolbar chip off.
   *
   * The clause is kept, so toggling back on restores it without retyping; the
   * heading stops reading active, because the column is narrowing nothing
   * right now and a lit column that filters nothing is a lie.
   */
  suspended?: boolean;
}

/** Which body template each column type's filter menu holds. */
const COLUMN_FILTER_BODIES: Record<string, string> = {
  text: 'template.head-text-filter-tpl',
  number: 'template.head-number-filter-tpl',
  date: 'template.head-date-filter-tpl',
};


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
    // Which fields an EXTERNAL filter is narrowing — a space-separated list,
    // written by the data source. The grid cannot see a quick-filter toolbar's
    // chips, and populate() only ever hands it the surviving rows, so this is
    // the only way a column filtered from outside can light its own header.
    'data-filter-fields',
    'data-selectable',
    // SINGLE vs multiple changes the CONTROL each row draws — a radio cannot be
    // turned into a checkbox by CSS — so a change here re-renders the body.
    'data-select',
  ];

  /* ── Column widths ───────────────────────────────────────────────
   * All three are on the 8px grid. 96 is about six characters of the 14px body
   * face plus its padding — narrower than that and a heading is pure ellipsis.
   * 480 is wide enough for a long address without one column owning the panel.
   * 160 is the default: it fits a name, a date or a mid-length status without
   * clipping, which is most of what a grid holds.
   */
  static readonly MIN_COL_WIDTH = 96;
  static readonly MAX_COL_WIDTH = 480;
  static readonly DEFAULT_COL_WIDTH = 160;

  #columns: GridColumn[] = [];
  #rows: GridRow[] = [];
  /**
   * Widths the USER has dragged, keyed by field.
   *
   * Kept apart from the column config so a re-populate with the same columns
   * does not throw away a resize, and so #widthFor() can state the precedence
   * in one place: drag beats config beats default.
   */
  #widths = new Map<string, number>();
  /** Active per-column filter text, keyed by field. Empty entries are removed. */
  #filters = new Map<string, string>();

  /**
   * One CLAUSE per column, from the heading filter menus, keyed by field.
   *
   * Held rather than applied: the grid reports each clause and lights the
   * column, but does not narrow its own rows off it. It sees one column at a
   * time and cannot know what else is filtering the view, so combining the
   * clauses belongs to whoever owns the query — a DataSource, or the page.
   * Keeping them is what lets a re-opened menu show the pair already set, and
   * what survives the header rebuild that every sort causes.
   */
  #columnFilters = new Map<string, ColumnFilter>();
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
  /**
   * Whether the grid picks ONE row or many.
   *
   * `single` draws radios and holds at most one record. The head cell shows NO
   * control in that mode: "select all" is meaningless where only one can be
   * chosen, and a lone checkbox there would offer something the grid cannot do.
   */
  get #single(): boolean {
    return this.dataset['select'] === 'single';
  }

  /**
   * The radio group's name in single mode.
   *
   * Per INSTANCE, so two grids on one page do not share a group and steal each
   * other's selection. Derived once and kept, because the name has to be stable
   * across re-renders or the browser treats each render as a fresh group.
   */
  static #uid = 0;
  #selectNameId = ++SherpaDataGrid.#uid;
  get #selectName(): string {
    return `sherpa-grid-select-${this.#selectNameId}`;
  }

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
    // CAPTURE. The sort control is a chip, and a chip's caret handler calls
    // stopPropagation() — it is guarding its own menu from the body's toggle.
    // A bubbling listener here would never see the click that IS the sort.
    this.$('.head-row')?.addEventListener('click', this.#onHeaderClick, true);
    this.$('.body')?.addEventListener('click', this.#onRowClick);
    // Selection: select-all in the header, per-row boxes delegated on the body.
    this.$('.select-all')?.addEventListener('change', this.#onSelectAll);
    this.$('.body')?.addEventListener('change', this.#onRowSelect);
    // Filter: delegate both the typing and the clear button from the filter row.
    this.$('.filter-row')?.addEventListener('input', this.#onFilterInput);
    this.$('.filter-row')?.addEventListener('click', this.#onFilterClick);
    // Resize starts on the header row; the move/up pair is captured on the
    // POINTER itself in #onGripDown, so a fast drag that outruns the cursor does
    // not drop out of the gesture.
    this.$('.head-row')?.addEventListener('pointerdown', this.#onGripDown);
    // The column-filter menus live in the header row and their events bubble.
    // BOTH footer buttons end the interaction, so both commit: Apply with a
    // pair to keep, Clear with nothing. Delegated from the row rather than
    // bound per chip, because the header is rebuilt on every sort.
    this.$('.head-row')?.addEventListener('menu-apply', this.#onColumnFilterCommit);
    this.$('.head-row')?.addEventListener('menu-clear', this.#onColumnFilterCommit);
    // A header filter button IS a <sherpa-quick-filter>, so it emits the chip's
    // own composed events — quick-filter-change and quick-filter-click. Those
    // are the TOOLBAR's vocabulary: a DataSource bound to this grid hears
    // quick-filter-change and sets the whole filter from it, wiping everything
    // else the view had folded in. So they stop here. The grid speaks
    // `column-filter-change`, which says which COLUMN and carries a ready
    // clause; anything else leaking out would be a second, rival dialect for
    // the same gesture.
    for (const type of ['quick-filter-change', 'quick-filter-click']) {
      this.$('.head-row')?.addEventListener(type, this.#stopChipEvent);
    }
    // The RANGE switch on a number or date menu. sherpa-switch re-dispatches a
    // native `change`, so this is the one event that covers both.
    this.$('.head-row')?.addEventListener('change', this.#onColumnRangeToggle);
    // REMOVE FILTER — the footer's third button. It arrives as menu-select
    // rather than a footer event of its own.
    this.$('.head-row')?.addEventListener('menu-select', this.#onColumnFilterRemove);
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
    // COLUMN filters drop only where the COLUMN has gone.
    //
    // They cannot be cleared outright the way the header-row filters are,
    // because a column filter is what CAUSES a re-populate: the grid reports
    // the clause, the host queries, and the rows come back through here. Wiping
    // the map on arrival threw away the filter that had just been applied, so
    // the heading went dark and the chip unlit the instant the rows it asked
    // for appeared.
    //
    // The grid does not narrow its own rows, so a stale entry would not hide
    // anything — but it would light a column that is gone and re-stamp a menu
    // for a field the data no longer has.
    const fields = new Set(this.#columns.map((c) => c.field));
    for (const field of this.#columnFilters.keys()) {
      if (!fields.has(field)) this.#columnFilters.delete(field);
    }
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
  /**
   * Re-exported from `core/icons.ts`, where the quick-filter toolbar reads the
   * same four. A column header and a toolbar chip are two views of ONE sort and
   * must never disagree about what "descending" looks like.
   */
  static readonly icons = ORGANISE_ICONS;

  /**
   * The width one column is drawn at.
   *
   * Precedence, stated once: a width the USER dragged wins, then the one the
   * caller configured, then the default. Every route is clamped, so a config
   * of `width: 4` cannot produce a column too thin to read.
   */
  #widthFor(col: GridColumn): number {
    const dragged = this.#widths.get(col.field);
    const raw = dragged ?? col.width ?? SherpaDataGrid.DEFAULT_COL_WIDTH;
    return this.#clampWidth(raw);
  }

  #clampWidth(n: number): number {
    const { MIN_COL_WIDTH, MAX_COL_WIDTH, DEFAULT_COL_WIDTH } = SherpaDataGrid;
    if (!Number.isFinite(n)) return DEFAULT_COL_WIDTH;
    return Math.min(MAX_COL_WIDTH, Math.max(MIN_COL_WIDTH, Math.round(n)));
  }

  /**
   * Stamp one <col> per drawn column.
   *
   * This is what `table-layout: fixed` reads, so it must run BEFORE the header
   * cells are rebuilt — the browser sizes the table from the colgroup and a
   * stale one would size the new columns by the old widths for a frame.
   */
  #renderCols(): void {
    // `own-children`, not `replace`: the leading `.select-col` is a fixed part of
    // the template (it sizes the selection column) and emptying the colgroup
    // would take it with the dynamic ones.
    this.renderList(
      '.cols',
      'template.col-tpl',
      this.#shownColumns(),
      (node, col) => {
        const el = node as HTMLElement;
        el.dataset['field'] = col.field;
        // `width`, NOT `inline-size`. A fixed table sizes its columns from the
        // <col>'s used WIDTH, and Chromium does not feed the logical property
        // into that calculation — a <col> styled with inline-size measured 381px against
        // a set 160px. The physical property is the one tables read.
        el.style.width = `${this.#widthFor(col)}px`;
      },
      { clear: 'own-children', ownSel: '.cols > .col' },
    );
  }

  #renderHead(): void {
    this.#renderCols();
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
      this.#addColumnFilter(th, col);
      const sortable = col.sortable !== false;
      th.dataset['sortable'] = String(sortable);
      th.querySelector('.head-label')!.textContent = col.header ?? col.field;
      const sorted = sortable && col.field === sortField;
      if (sorted) th.dataset['sort'] = sortDir ?? 'asc';
      // A column that is ORDERING or NARROWING what the user can see takes the
      // Style `active` mode. Both are the column acting on the view, so both
      // read the same — one highlight, not two rival ones. The heading is
      // sticky, so it is what still says so once the user is reading row 40.
      if (sorted || this.#isFiltered(col.field)) th.dataset['status'] = 'active';

      // THE SORT GLYPH — a tri-state, from the shared map.
      //
      // A sortable column that is NOT the current sort shows `sort-none`, so it
      // reads as "you can sort by this" before anyone clicks. The old pure-CSS
      // triangle had no third state: it could only be up or down, so an
      // unsorted column showed nothing and looked unsortable.
      const sortChip = th.querySelector<HTMLElement>('.head-sort');
      if (sortChip) {
        const { sortNone, sortAsc, sortDesc } = SherpaDataGrid.icons;
        sortChip.dataset['iconStart'] = !sorted
          ? sortNone
          : (sortDir === 'desc' ? sortDesc : sortAsc);
        // The chip is LOCKED, so the grid sets its on-state: on for the two
        // live directions, off for "not the sort column" — which is what the
        // toolbar's own Sort chip does for its suspended step.
        sortChip.toggleAttribute('data-current', sorted);
        sortChip.toggleAttribute('data-unsupported', !sortable);
        const label = col.header ?? col.field;
        sortChip.setAttribute(
          'aria-label',
          !sorted
            ? `Sort by ${label}`
            : `Sorted by ${label}, ${sortDir === 'desc' ? 'descending' : 'ascending'}`,
        );
      }
      headRow.appendChild(th);
    });

    this.#renderFilterRow();
  }

  /**
   * Give one column heading its filter menu.
   *
   * The chip itself is already in the header template — it is the same element
   * whether the grid offers column filters or not, and CSS hides it when
   * data-column-filters is absent. What JS adds is the MENU, because only JS
   * knows the column's type and its name.
   *
   * Three shapes, one per column type:
   *
   *   text    a condition picker and a value box
   *   number  a condition picker and a value box, or TWO boxes in Range mode
   *   date    a calendar — one day, or a start→end span in Range mode
   *
   * Number and date lead with a RANGE switch, because each is really one filter
   * with two shapes: "equals this" or "between these two". Two separate menus
   * would make the reader choose the shape before they know which they want.
   * That is the toolbar's own number and date chips' rule, followed here so a
   * reader meets one control, not two that behave alike but not the same.
   *
   * Any other type gets no menu and no button — an affordance that opens
   * nothing is worse than none.
   */
  #addColumnFilter(th: HTMLElement, col: GridColumn): void {
    const chip = th.querySelector<HTMLElement>('.head-filter');
    if (!chip) return;

    // `type` is the column's own declaration; an undeclared column is text,
    // which is what the grid already assumes everywhere else.
    const kind = col.type ?? 'text';
    const bodyTpl = COLUMN_FILTER_BODIES[kind];
    if (!bodyTpl) {
      // The flag is the chip's own, so CSS hides it without the grid reaching
      // into the chip's shadow root.
      chip.setAttribute('data-unsupported', '');
      return;
    }

    const menu = this.clone('template.head-menu-tpl');
    const body = this.clone(bodyTpl);
    if (!menu || !body) return;

    // THE CONDITION PICKER, built from the SHARED vocabulary.
    //
    // `OPS_FOR_TYPE` says which operators this column type can sensibly answer
    // and `OP_LABELS` says how each reads; both live beside `FilterOp` in the
    // store. The keys ARE the operators, so what this control reports back is
    // already a clause the store understands — there is no translation table to
    // drift, and a Filter Panel later builds its picker from the same two maps.
    const picker = body.querySelector<HTMLSelectElement>('.head-filter-op');
    const proto = picker?.querySelector('option');
    if (picker && proto) {
      // The template holds ONE <option> as a cloning prototype — the same shape
      // sherpa-pagination's rows <select> uses. Cloned per operator, so no
      // element is created from nothing and no markup is written as a string.
      const ops = OPS_FOR_TYPE[kind] ?? [];
      picker.replaceChildren(
        ...ops.map((op) => {
          const option = proto.cloneNode(false) as HTMLOptionElement;
          option.value = op;
          option.textContent = OP_LABELS[op];
          return option;
        }),
      );
    }

    // REMOVE FILTER in the footer. Clear empties the controls and leaves the
    // menu open to type again; Remove says "I am done with this column" — it
    // drops the clause, unlights the heading and takes the chip off the
    // toolbar. Two different intentions, so two buttons.
    menu.setAttribute('data-removable', '');

    const label = col.header ?? col.field;
    menu.setAttribute('data-heading', `Filter ${label}`);
    // The menu is a popover in the top layer, so it escapes the grid's scroller
    // — but only within the region the HOST names. Passed straight through, as
    // the toolbar passes its own.
    const bounds = this.dataset['bounds'];
    if (bounds) menu.setAttribute('data-bounds', bounds);

    const held = this.#columnFilters.get(col.field);

    // A NUMBER column's slider spans the column's REAL values. Left at the
    // slider's own 0..100 default, a spend column would open with every row
    // crushed at the far left and no way to pick between them.
    if (kind === 'number') {
      const slider = body.querySelector('.head-filter-slider');
      const nums = this.#rows
        .map((row) => Number(row[col.field]))
        .filter((n) => Number.isFinite(n));
      if (slider && nums.length) {
        const min = Math.floor(Math.min(...nums));
        const max = Math.ceil(Math.max(...nums));
        slider.setAttribute('min', String(min));
        slider.setAttribute('max', String(max));
        // A fresh range spans the WHOLE column, so the filter starts by
        // excluding nothing — opening at 0..0 would empty the view before the
        // reader had asked it anything.
        slider.setAttribute('value-start', String(held?.from ?? min));
        slider.setAttribute('value-end', String(held?.to ?? max));
      }
    }

    // NUMBER and DATE lead with the Range switch, above the body it re-points.
    // Reading "between these two" after the two boxes would be backwards.
    if (kind === 'number' || kind === 'date') {
      const range = this.clone('template.head-range-tpl');
      if (range) {
        const sw = range.querySelector('sherpa-switch');
        // The switch starts where the held clause left it, so re-opening a
        // range filter shows a range rather than resetting to single.
        if (held?.range) sw?.setAttribute('checked', '');
        menu.appendChild(range);
      }
      // The MENU carries the mode, because CSS selects the visible shape off it
      // — the same door the toolbar's number chip uses.
      if (held?.range) menu.setAttribute('data-range', '');
    }

    // Restore what this column is already filtered by, so re-opening the menu
    // shows the clause the user set rather than an empty one. The header row is
    // rebuilt on every sort and every keystroke, so without this the menu would
    // forget itself constantly.
    if (held) {
      const op = body.querySelector<HTMLSelectElement>('.head-filter-op');
      if (op) op.value = held.op;
      if (held.range) {
        // A number range's ends went onto the slider above, where its bounds
        // are known; only a calendar's need doing here.
      } else {
        const value = body.querySelector<HTMLInputElement>('.head-filter-value');
        if (value) value.value = held.value;
      }
      // A CALENDAR holds its pick in its own attributes rather than an input.
      const cal = body.querySelector('.head-filter-calendar');
      if (cal) {
        if (held.range) {
          cal.setAttribute('data-type', 'range');
          cal.setAttribute('data-value-start', held.from ?? '');
          cal.setAttribute('data-value-end', held.to ?? '');
        } else {
          cal.setAttribute('data-value', held.value);
        }
      }
      // The chip's own on-state — the same accent a toolbar chip takes.
      chip.setAttribute('data-current', '');
    } else if (kind === 'date') {
      // A fresh RANGE calendar still needs its two-click mode set; without a
      // held clause the block above never runs.
      const cal = body.querySelector('.head-filter-calendar');
      if (cal && menu.hasAttribute('data-range')) cal.setAttribute('data-type', 'range');
    }

    menu.appendChild(body);
    chip.appendChild(menu);
    chip.setAttribute('aria-label', `Filter ${label}`);
  }

  /**
   * The Range switch on a number or date column's menu.
   *
   * It re-points the menu rather than rebuilding it: CSS shows one of the two
   * number shapes off `data-range`, and the calendar owns both of its own modes
   * already. So flipping is an attribute write, and whatever was typed on the
   * other side is still there on the way back.
   */
  #onColumnRangeToggle = (event: Event): void => {
    const sw = (event.target as HTMLElement | null)?.closest?.('.head-filter-range-switch');
    if (!sw) return;
    const menu = (sw as HTMLElement).closest('sherpa-menu');
    if (!menu) return;
    const on = (sw as HTMLElement & { checked?: boolean }).checked
      ?? sw.hasAttribute('checked');
    menu.toggleAttribute('data-range', on);
    // The calendar's two shapes are its own `data-type`, not a CSS reveal —
    // one grid, banded or not, rather than two grids with one hidden.
    const cal = menu.querySelector('.head-filter-calendar');
    if (cal) {
      if (on) cal.setAttribute('data-type', 'range');
      else cal.removeAttribute('data-type');
    }
  };

  /**
   * REMOVE FILTER — the footer button that ends a column's filter outright.
   *
   * Clear empties the controls and leaves the menu open to type again. Remove
   * means "I am done with this column": the clause goes, the heading unlights,
   * and the toolbar chip that stood for it goes with them. It reports as a
   * clear so a host has one path to handle, not two.
   */
  #onColumnFilterRemove = (event: Event): void => {
    if ((event as CustomEvent).detail?.value !== 'remove') return;
    const chip = (event.target as HTMLElement).closest<HTMLElement>('.head-filter');
    if (!chip) return;
    event.stopPropagation();
    chip.querySelector<HTMLElement & { close?: () => void }>('sherpa-menu')?.close?.();
    // Routed through the same handler as Clear, so "removed" and "cleared" are
    // one outcome to everything downstream.
    this.#onColumnFilterCommit(new CustomEvent('menu-clear', { detail: {} , bubbles: false }) as Event, chip);
  };

  /**
   * Swallow a header chip's own events at the header row.
   *
   * The chip is reused for its menu, not for its vocabulary — see onRender.
   */
  #stopChipEvent = (event: Event): void => {
    // BOTH header chips — the filter one and the sort one.
    if (!(event.target as HTMLElement)?.closest?.('.head-filter, .head-sort')) return;
    event.stopPropagation();
  };

  /**
   * Apply or clear one column's filter, from its menu's footer.
   *
   * Both buttons land here because both end the interaction: Apply with a pair
   * to keep, Clear with nothing. The grid records the clause, relights the
   * column, and says what happened — it does not filter its own rows. It holds
   * ONE column's clause and cannot know what else is narrowing the view, so
   * combining them belongs to whoever owns the query.
   */
  #onColumnFilterCommit = (event: Event, explicit?: HTMLElement): void => {
    // `explicit` is for a caller that already knows the chip — the Remove
    // button, whose synthetic event has no target in the tree.
    const chip = explicit ?? (event.target as HTMLElement).closest<HTMLElement>('.head-filter');
    const field = chip?.closest<HTMLElement>('.head-cell')?.dataset['field'];
    if (!chip || !field) return;

    const cleared = event.type === 'menu-clear';
    const held = cleared ? null : this.#readColumnFilter(chip);

    if (held) {
      this.#columnFilters.set(field, held);
      chip.setAttribute('data-current', '');
    } else {
      this.#columnFilters.delete(field);
      chip.removeAttribute('data-current');
      // Only an explicit CLEAR empties the controls. Apply can also land here —
      // an empty value, or a range with one end — and wiping there would take
      // away the half-built entry the reader is still working on. "Between 5
      // and …" is not finished; it is not a mistake to be swept up.
      if (cleared) {
        for (const box of chip.querySelectorAll<HTMLInputElement>('input[type="text"], input[type="number"]')) {
          box.value = '';
        }
        const cal = chip.querySelector('.head-filter-calendar');
        cal?.removeAttribute('data-value');
        cal?.removeAttribute('data-value-start');
        cal?.removeAttribute('data-value-end');
      }
    }

    this.#syncColumnFilterStatus();
    // The cells carry the MATCH MARK, so they are redrawn here rather than left
    // to the host. A host that re-queries will populate again in a moment and
    // redraw them a second time, which is cheap — but one that filters nothing
    // (a grid driven by hand, or a clause the rows already satisfy) would
    // otherwise show a lit column with nothing marked in it.
    this.#renderBody();

    const col = this.#columns.find((c) => c.field === field);
    const header = col?.header ?? field;
    this.emit('column-filter-change', {
      field,
      header,
      op: held?.op ?? null,
      value: held?.range ? null : (held?.value ?? null),
      from: held?.from ?? null,
      to: held?.to ?? null,
      // Ready to hand to a DataSource — the <option> values ARE store FilterOps,
      // and a range is the store's own `between`, whose value is the two ends.
      //
      // A NUMBER column's value is COERCED. The store compares a number row
      // against a string filter with its text collator, where "100" sorts below
      // "9" and "greater than 9" silently misses every three-digit row. The
      // grid is what knows the column's type, so it is what must say so.
      clause: held ? this.#columnClause(field, held, col?.type) : null,
      // What a toolbar chip should read: "Contains: ana", "Between: 10 - 20".
      // The FIELD half of "Field: Condition Value" is `header`, which the
      // toolbar puts on the chip's own label.
      label: held ? this.#columnFilterLabel(held) : null,
    });
  };

  /**
   * Read one column's menu into a clause — or null when it says nothing.
   *
   * Null is the answer for an empty value as much as for a cleared menu:
   * "contains nothing" matches every row, so applying it would light the column
   * and change the view not at all, which reads as the filter being broken. A
   * RANGE needs BOTH ends for the same reason — one end alone is a "greater
   * than" the reader did not ask for.
   */
  #readColumnFilter(chip: HTMLElement): ColumnFilter | null {
    const menu = chip.querySelector('sherpa-menu');
    const range = menu?.hasAttribute('data-range') ?? false;
    const op = chip.querySelector<HTMLSelectElement>('.head-filter-op')?.value ?? 'contains';
    const cal = chip.querySelector<HTMLElement>('.head-filter-calendar');

    if (range) {
      // A calendar reports its span in its own attributes; a number pair in two
      // boxes. Both are "the two ends", so both land in from/to.
      // A calendar reports its span in data-*; a slider in its own value-start /
      // value-end attributes, which it keeps in step with its thumbs.
      const slider = chip.querySelector<HTMLElement>('.head-filter-slider');
      const from = (cal
        ? cal.dataset['valueStart']
        : slider?.getAttribute('value-start')) ?? '';
      const to = (cal
        ? cal.dataset['valueEnd']
        : slider?.getAttribute('value-end')) ?? '';
      if (!from.trim() || !to.trim()) return null;
      return { op: 'between', value: '', range: true, from: from.trim(), to: to.trim() };
    }

    // A DATE column has no condition picker — a calendar answers "which day" by
    // being clicked, so the operator is always equality.
    const value = (cal ? cal.dataset['value'] : chip.querySelector<HTMLInputElement>('.head-filter-value')?.value) ?? '';
    if (!value.trim()) return null;
    return { op: cal ? 'eq' : op, value: value.trim() };
  }

  /**
   * One column filter as a store FilterClause.
   *
   * A NUMBER column's ends are coerced to numbers. `compareValues` only compares
   * numerically when BOTH sides are numbers; a string filter against numeric
   * rows falls through to the text collator, where "100" sorts below "9" — so
   * "greater than 9" would miss every three-digit row and look like a bug in
   * the data. A blank or unparseable entry is left as typed rather than turned
   * into NaN, which would match nothing at all with no way to see why.
   */
  #columnClause(field: string, held: ColumnFilter, type?: string): unknown[] {
    const cast = (raw: string): string | number => {
      if (type !== 'number') return raw;
      const n = Number(raw);
      return raw !== '' && Number.isFinite(n) ? n : raw;
    };
    return held.range
      ? [field, 'between', [cast(held.from ?? ''), cast(held.to ?? '')]]
      : [field, held.op, cast(held.value)];
  }

  /** One column filter as a chip reads it — "Contains: ana", "Between: 10 - 20". */
  #columnFilterLabel(held: ColumnFilter): string {
    const name = OP_LABELS[held.op as keyof typeof OP_LABELS] ?? held.op;
    return held.range ? `${name}: ${held.from} - ${held.to}` : `${name}: ${held.value}`;
  }

  /**
   * One column's current filter, as a ready FilterClause — or null.
   *
   * A column filter shows on the toolbar as a chip, and a chip's body is a
   * TOGGLE: off means "stop applying this", not "delete it". So a host needs
   * to put the clause back when the chip comes on again, and the grid is what
   * still holds it — turning the chip off changes what the query asks for, not
   * what the column is set to.
   *
   *   if (on) source.add(grid.columnClause(field));
   *
   * Only Remove deletes, and that goes through `clearColumnFilter`.
   */
  columnClause(field: string): unknown[] | null {
    // A SUSPENDED clause is returned too: this is what the column is SET to,
    // and the caller asking is the one putting it back into the query.
    const held = this.#columnFilters.get(field);
    if (!held) return null;
    const col = this.#columns.find((c) => c.field === field);
    return this.#columnClause(field, held, col?.type);
  }

  /**
   * Suspend or resume one column's filter without losing it.
   *
   * A column filter shows on the toolbar as a chip, and a chip's body is a
   * TOGGLE: off means "stop applying this", not "delete it". Suspended, the
   * clause is still typed into the menu and still comes back from
   * `columnClause()` — but the heading stops reading active, because the
   * column is narrowing nothing and a lit column that filters nothing is a
   * lie.
   *
   *   qft.addEventListener('quick-filter-change', (e) => {
   *     for (const [id, on] of Object.entries(e.detail.custom ?? {})) {
   *       grid.suspendColumnFilter(id.slice(4), !on);
   *     }
   *   });
   *
   * Deleting is `clearColumnFilter`, which is what Remove does.
   */
  suspendColumnFilter(field: string, suspended = true): void {
    const held = this.#columnFilters.get(field);
    if (!held || !!held.suspended === suspended) return;
    this.#columnFilters.set(field, { ...held, suspended });
    this.#syncColumnFilterStatus();
    // The MATCH MARKS go with it: a suspended filter is hiding no rows, so
    // marking the ones that would have matched claims something untrue.
    this.#renderBody();
  }

  /**
   * Open one column's filter menu, anchored wherever the caller says.
   *
   * The column's clause also shows on the toolbar as a chip, and that chip has
   * to be editable — a reader who sees "Name · Contains: ana" on the bar will
   * click it to change it. Rather than build a second menu there, the toolbar
   * chip borrows THIS one: same controls, same Apply, same Remove, so the two
   * places can never drift or disagree about what the column is filtered by.
   *
   *   qft.addEventListener('quick-filter-click', (e) => {
   *     const id = …;                       // 'col:name'
   *     grid.openColumnFilter(id.slice(4), e.target);
   *   });
   *
   * Pass the element to anchor against — the menu measures its box, because a
   * CSS anchor name cannot cross the shadow boundary between them.
   */
  openColumnFilter(field: string, anchor?: HTMLElement): void {
    const chip = this.$<HTMLElement>(
      `.head-cell[data-field="${CSS.escape(field)}"] .head-filter`,
    );
    const menu = chip?.querySelector<HTMLElement & { toggle?: (t?: HTMLElement) => void }>(
      'sherpa-menu',
    );
    menu?.toggle?.(anchor ?? chip ?? undefined);
  }

  /**
   * Drop one column's heading filter, from OUTSIDE the grid.
   *
   * A column filter shows on the toolbar as a chip, and a chip is removable —
   * so the reader can take the filter off at either end. Removing it there has
   * to reach back here, or the column stays lit and its menu still holds a
   * clause the bar no longer shows.
   *
   *   toolbar.addEventListener('filter-remove', (e) => {
   *     const field = e.detail.id.replace(/^col:/, '');
   *     grid.clearColumnFilter(field);
   *   });
   *
   * It does NOT re-fire column-filter-change: the caller is the one who asked,
   * so telling them what they just did would be an echo, and a host that routes
   * the event back into its query would clear it twice. Pass nothing to clear
   * every column at once — what a toolbar's "clear all" means.
   */
  clearColumnFilter(field?: string): void {
    if (field) {
      if (!this.#columnFilters.delete(field)) return;
    } else {
      if (!this.#columnFilters.size) return;
      this.#columnFilters.clear();
    }
    // The chips hold the pair the menu shows, so they are rebuilt rather than
    // reached into — #renderHead restores each menu from #columnFilters, which
    // is now the truth.
    this.#renderHead();
    this.#syncColumnFilterStatus();
    // The cells' match marks go with the filter that put them there.
    this.#renderBody();
  }

  /**
   * Light every column a filter is acting on — this grid's own column filters
   * included.
   *
   * #renderHead does the same on a rebuild; this is the no-rebuild path, for a
   * menu commit that changed nothing else about the header row.
   */
  #syncColumnFilterStatus(): void {
    for (const cell of this.$$('.head-cell')) {
      const th = cell as HTMLElement;
      const field = th.dataset['field'];
      if (!field) continue;
      const lit = th.hasAttribute('data-sort') || this.#isFiltered(field);
      if (lit) th.dataset['status'] = 'active';
      else delete th.dataset['status'];
    }
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
      if (box) {
        // RADIOS in single mode. A radio cannot be made from a checkbox by CSS,
        // and the native type is what buys the group behaviour: the browser
        // unticks the previous row for us, and arrow keys move the choice.
        // They share a NAME for that, scoped to this grid so two grids on one
        // page cannot fight over the same group.
        if (this.#single) {
          box.type = 'radio';
          box.name = this.#selectName;
          box.setAttribute('aria-label', 'Select this row');
        }
        box.checked = this.#selected.has(record);
      }
      // Which group this row belongs to, so CSS can hide it when that group's
      // row is collapsed — the row itself never needs a `display` write.
      if (group && lastGroup !== null) tr.dataset['group'] = lastGroup;
      columns.forEach((col, c) => {
        const td = cellTpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
        if (col.type) td.dataset['type'] = col.type;
        if (c === 0) this.#markPinned(td, true);
        const value = record[col.field];
        this.#fillCell(td, value == null ? '' : String(value), col);
        tr.appendChild(td);
      });
      body.appendChild(tr);
    });

    // A re-render (sort, filter keystroke) stamps fresh rows, so re-apply the
    // groups the user had already folded shut.
    if (group) this.#syncGroupVisibility();
  }

  /**
   * Write one cell's text, marking the part a TEXT filter matched.
   *
   * A filtered column tells the reader WHICH rows survived; the mark tells them
   * WHY this one did. Scanning a column of long names for the four letters that
   * matched is work the grid can do for them.
   *
   * TEXT columns only. A number or a date matches as a whole value — "between
   * 10 and 50" does not match a SUBSTRING of 42, and underlining the "4" would
   * claim a precision the filter does not have. Those columns are left plain.
   *
   * Built with createElement + replaceChildren rather than innerHTML: <mark> is
   * content, not structure, and this is the same shape sherpa-nav-item's own
   * search highlight uses.
   */
  #fillCell(td: HTMLElement, text: string, col: GridColumn): void {
    const kind = col.type ?? 'text';
    const held = this.#columnFilters.get(col.field);
    // Only the SUBSTRING conditions leave something to point at. `eq` matched
    // the whole cell, so marking it would underline every character; `ne` and
    // `notcontains` matched by NOT being there, and there is nothing to mark.
    const markable = held && !held.range && !held.suspended
      && (held.op === 'contains' || held.op === 'startswith' || held.op === 'endswith');

    if (kind !== 'text' || !markable || !held.value) {
      td.textContent = text;
      return;
    }

    const at = text.toLowerCase().indexOf(held.value.toLowerCase());
    if (at < 0) {
      td.textContent = text;
      return;
    }

    const mark = document.createElement('mark');
    mark.className = 'match';
    // The CELL's own casing, not the needle's — the reader typed "ana" and the
    // row says "Ana", and the row is the truth.
    mark.textContent = text.slice(at, at + held.value.length);
    td.replaceChildren(
      document.createTextNode(text.slice(0, at)),
      mark,
      document.createTextNode(text.slice(at + held.value.length)),
    );
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
    //
    // Groups normally run A→Z whatever the sort column does — the sort orders rows
    // INSIDE a group, not the groups themselves. The exception is sorting BY the
    // grouped column: there the two are the same key, so the direction the user
    // asked for is a direction for the GROUPS, and honouring it is the whole point
    // of the click. The second compare is then a no-op (equal keys) and is skipped.
    const groupDir = group && group === field ? dir : 1;
    return [...rows].sort(
      (a, b) =>
        (group ? compare(a, b, group, groupDir) : 0) ||
        (field && field !== group ? compare(a, b, field, dir) : 0),
    );
  }

  /* ── Interaction ────────────────────────────────────────────────── */

  /** Eat exactly one click — the one a finished resize drag synthesises. */
  #swallowClick = false;

  #onHeaderClick = (event: Event): void => {
    // A RESIZE just ended, and the browser is synthesising the click for it.
    // Sorting a column because the reader dragged its edge is the wrong answer
    // to a gesture that was not a click.
    if (this.#swallowClick) {
      this.#swallowClick = false;
      event.stopPropagation();
      event.preventDefault();
      return;
    }
    // The FILTER button lives in the heading, so its click reaches here too —
    // and sorting a column because the reader opened its filter menu is the
    // wrong answer to the wrong gesture. The chip handles its own click.
    if ((event.target as HTMLElement).closest('.head-filter')) return;
    // The SORT chip, on the other hand, IS the sort control — its click falls
    // straight through to the cycle below. It carries no menu, so there is
    // nothing of its own for it to do.
    const th = (event.target as HTMLElement).closest<HTMLElement>('.head-cell');
    const field = th?.dataset['field'];
    if (!field || th!.dataset['sortable'] === 'false') return;

    // TRI-STATE, matching the quick-filter toolbar's own Sort chip:
    //
    //   not this column  →  ascending
    //   ascending        →  descending
    //   descending       →  OFF (no column sorted)
    //
    // The third step is what the toolbar has and this did not: it cycled
    // asc → desc → asc, so once a column was sorted there was no way back to
    // unsorted without picking a different one. Two controls for one value
    // must agree about how many states that value has.
    //
    // ONLY ONE COLUMN AT A TIME. data-sort-field holds a single field, so
    // sorting a new column replaces the old one rather than stacking.
    const active = this.dataset['sortField'] === field;
    const dir = this.dataset['sortDirection'];
    if (active && dir === 'desc') {
      delete this.dataset['sortField'];
      delete this.dataset['sortDirection'];
      this.emit('sort-change', { field: null, direction: null });
      return;
    }
    const next = active && dir === 'asc' ? 'desc' : 'asc';
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

  /* ── Column resize ──────────────────────────────────────────────── */

  /**
   * A drag in flight. Held as one object so a stray pointermove that arrives
   * outside a gesture has a single thing to test, rather than three loose
   * fields that could disagree.
   */
  #drag: { field: string; startX: number; startWidth: number } | null = null;

  #onGripDown = (event: PointerEvent): void => {
    const grip = (event.target as HTMLElement | null)?.closest?.('.resize-grip');
    if (!grip) return;
    const th = grip.closest<HTMLElement>('.head-cell');
    const field = th?.dataset['field'];
    if (!field) return;

    // preventDefault stops the text-selection drag; stopPropagation keeps the
    // pointerdown off the header. Neither stops the CLICK — the browser still
    // synthesises one on pointerup, and the <th>'s sort handler listens for
    // that — so #onGripUp swallows the next click as well.
    event.preventDefault();
    event.stopPropagation();

    // The MEASURED width, not the configured one: a column can be wider than
    // its <col> says when the table has slack to share, and starting the drag
    // from the config value made the column jump on the first pixel of movement.
    const startWidth = th!.getBoundingClientRect().width;
    this.#drag = { field, startX: event.clientX, startWidth };
    this.toggleAttribute('data-resizing', true);

    // Captured on the GRIP, so the gesture follows the pointer even when it
    // outruns the 8px strip or leaves the grid entirely. Without capture a fast
    // drag dropped the column at whatever width it had when the cursor escaped.
    (grip as HTMLElement).setPointerCapture(event.pointerId);
    grip.addEventListener('pointermove', this.#onGripMove as EventListener);
    grip.addEventListener('pointerup', this.#onGripUp as EventListener, { once: true });
    grip.addEventListener('pointercancel', this.#onGripUp as EventListener, { once: true });
  };

  #onGripMove = (event: PointerEvent): void => {
    if (!this.#drag) return;
    const { field, startX, startWidth } = this.#drag;
    const next = this.#clampWidth(startWidth + (event.clientX - startX));
    this.#widths.set(field, next);
    // Write the <col> DIRECTLY rather than re-rendering. A full #render() on
    // every pointermove would rebuild every row of the body sixty times a
    // second; the colgroup is the only thing a width changes.
    const col = this.$<HTMLElement>(`.cols > .col[data-field="${CSS.escape(field)}"]`);
    if (col) col.style.width = `${next}px`;
  };

  #onGripUp = (event: PointerEvent): void => {
    const drag = this.#drag;
    this.#drag = null;
    this.toggleAttribute('data-resizing', false);

    // Swallow the click the browser is about to synthesise on this pointerup.
    //
    // A FLAG, not a rival listener. This used to add its own capture-phase
    // listener to eat one click — but #onHeaderClick is capture-phase on the
    // same element and was registered first, so it sorted the column before
    // the swallow ever ran. Registration order decides capture order, and the
    // sort listener is bound in onRender, long before any drag.
    this.#swallowClick = true;
    this.$('.head-row')?.addEventListener(
      'click',
      () => { this.#swallowClick = false; },
      { capture: false, once: true },
    );
    (event.target as HTMLElement | null)?.removeEventListener?.(
      'pointermove',
      this.#onGripMove as EventListener,
    );
    if (!drag) return;
    // The frozen first column's offset is a MEASURED width, so a resize of it
    // moves where every later pinned column starts.
    this.#syncPinned();
    this.emit('column-resize', { field: drag.field, width: this.#widths.get(drag.field) });
  };

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
      // SINGLE mode holds one. The browser has already unticked the previous
      // radio, so the set has to follow — left alone it would grow with every
      // pick while only one box showed, and `selected` would name rows the user
      // can no longer see ticked.
      if (this.#single) this.#selected.clear();
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
   * Is this column being narrowed by a filter — from EITHER direction?
   *
   * Three things can filter a column and the grid sees them differently:
   *
   *   • its own header filter box, which it owns — `#filters`
   *   • its column heading's filter MENU — `#columnFilters`
   *   • a quick-filter toolbar somewhere above it, which it cannot see at all.
   *     A data source applies that filter and hands the grid only the rows that
   *     survived, so the grid has no way to work out WHICH column did it. The
   *     source writes the field names onto `data-filter-fields` instead.
   *
   * Either way the column is narrowing the view, so either way it reads active.
   */
  #isFiltered(field: string): boolean {
    if (this.#filters.has(field)) return true;
    // A clause set in this column's own heading menu — unless it is SUSPENDED,
    // in which case the column is narrowing nothing and must not read active.
    const held = this.#columnFilters.get(field);
    if (held && !held.suspended) return true;
    const external = this.dataset['filterFields'];
    // Space-separated, matched WHOLE — a bare `includes` would light `status`
    // for a filter on `substatus`.
    return !!external && external.split(/\s+/).includes(field);
  }

  /**
   * Flag (or unflag) one column's HEADING as filtered.
   *
   * The heading only — never the filter cell under it. That row already says
   * what it is doing: the text is in the box the user just typed into, and a
   * second highlight on the control that IS the filter says nothing the
   * heading is not already saying louder.
   *
   * Called on every keystroke, so it does not rebuild the header row.
   *
   * `data-status` is the system-wide door for a Style mode, so a host reading
   * the shadow DOM sees the same attribute it would on any other component.
   */
  #markFiltered(field: string, on: boolean): void {
    const head = this.$(`.head-cell[data-field="${CSS.escape(field)}"]`);
    if (!head) return;
    // The heading may ALSO be lit because the column is sorted, which typing in
    // a filter box does not change — so the flag comes off only when nothing
    // is acting on that column any more.
    const sorted = head.hasAttribute('data-sort');
    if (on || sorted || this.#isFiltered(field)) {
      (head as HTMLElement).dataset['status'] = 'active';
    } else {
      delete (head as HTMLElement).dataset['status'];
    }
  }

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
    // The heading and the filter cell take the Style `active` mode while the
    // column is narrowing the view. Set on BOTH: the header row is sticky and
    // stays on screen once the filter row has scrolled away, which is exactly
    // when the user needs telling. The whole-row rebuild in #renderHead does
    // the same from #filters, so a sort or a re-render keeps the tint.
    this.#markFiltered(field, needle.length > 0);

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
