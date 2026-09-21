/**
 * sherpa-data-grid — a sortable table that composes the Grid Cell model.
 *
 * Give it data with populate({ columns, rows }) and it draws the header and rows.
 * Clicking a sortable column header sorts by it, toggling between ascending and
 * descending. Clicking a row fires row-click.
 *
 * TRAP T-grid-active-flag-is-not-a-tint — data-status="active" on the HEADING
 * only, painted by nothing here; data-filter-fields carries an outside filter.
 * TRAP T-grid-group-drops-the-column — data-group-field, and the two opt-in
 * features it interacts with.
 *
 * @see TRAP T-grid-reports-never-combines
 */
import { SherpaElement, coerceNum, clampNum, markMatch } from '../../core/sherpa-element.js';
// Glyphs, sort and the operator vocabulary are all SHARED, so a bound grid, an
// unbound one and the toolbar cannot disagree.
import { ORGANISE_ICONS } from '../../core/icons.js';
import {
  filterRows, sortRows, type Filter, type SortDirection, type SortSpec,
} from '../../core/store.js';
import { OP_LABELS, OPS_FOR_TYPE } from '../../core/store.js';
// SIDE-EFFECT imports: the template STAMPS these, and an undefined custom
// element renders inert — no shadow root, no menu.
import '../sherpa-quick-filter/sherpa-quick-filter.js';
import '../sherpa-menu/sherpa-menu.js';
import '../sherpa-select-checkbox/sherpa-select-checkbox.js';
import '../sherpa-select-radio/sherpa-select-radio.js';
import '../sherpa-switch/sherpa-switch.js';
import '../sherpa-calendar/sherpa-calendar.js';
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

/**
 * A selection box in this grid — the header's, a group's, or a row's.
 *
 * All three are `sherpa-select-checkbox`, which exposes `checked` and
 * `indeterminate` as properties and re-emits `change` from the HOST. The
 * header box was already the component while the rows were bare `<input>`s,
 * and every query here was typed `HTMLInputElement` regardless — a type that
 * was wrong for the header from the day it changed. This is the shape all
 * three actually share.
 */
type SelectBox = HTMLElement & { checked: boolean; indeterminate: boolean };

/**
 * One action a row offers.
 *
 * DECLARED ONCE and used twice: the per-row menu, and a host's bulk toolbar.
 * That is the point — a toolbar that kept its own list would disagree with the
 * menu the first time one of them changed.
 *
 * TRAP T-grid-actions-are-declared-once-used-twice.
 */
export interface GridAction {
  /** What `row-action` carries back. The host switches on this. */
  id: string;
  label: string;
  /** A Font Awesome class list, e.g. `'fa-regular fa-pen'`. */
  icon?: string;
  /**
   * Whether this action can apply to MANY rows at once.
   *
   * The grid reports it in `actions-change` so a bulk toolbar can offer only
   * what survives a multi-row selection — deleting five users is one action,
   * editing five is not.
   */
  multi?: boolean;
  /** Draws in the critical colour. A destructive action should read as one. */
  danger?: boolean;
}

interface GridConfig {
  columns: GridColumn[];
  rows: GridRow[];
  /**
   * The field that identifies a row. Optional.
   *
   * TRAP T-grid-key-or-position-lies — no key means selection by POSITION.
   */
  key?: string;
  /**
   * Per-row actions. Reveals the pinned trailing column.
   *
   * TRAP T-grid-actions-are-declared-once-used-twice.
   */
  actions?: GridAction[];
}

/**
 * One column heading's filter, as the grid holds it.
 *
 * TRAP T-grid-range-keeps-both-shapes — not a tagged union, so a Range flip
 * and flip back finds the other side's typing still there.
 */
interface ColumnFilter {
  op: string;
  value: string;
  range?: boolean;
  from?: string;
  to?: string;
  /** TRAP T-grid-suspend-is-not-clear — kept, but the heading goes dark. */
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
    // VISUAL paging, and only while grouped — see #pageSlots(). The source
    // writes both on every push; the grid reads them rather than being told.
    'data-page',
    'data-page-size',
  ];

  /* ── Column widths ───────────────────────────────────────────────
   * TRAP T-grid-column-width-bounds — 96/480/160 are measured, not chosen.
   */
  static readonly MIN_COL_WIDTH = 96;
  static readonly MAX_COL_WIDTH = 480;
  static readonly DEFAULT_COL_WIDTH = 160;

  #columns: GridColumn[] = [];
  #rows: GridRow[] = [];
  /** The declared row actions — see GridAction. Empty hides the column. */
  #actions: GridAction[] = [];
  /**
   * The row whose menu is open.
   *
   * A RECORD, not an index: one menu serves every row
   * (`T-one-actions-menu-for-every-row`), so it has to remember which row
   * opened it, and an index stops meaning the same thing after a sort.
   */
  #actionRow: GridRow | null = null;
  /** Widths the USER has dragged, keyed by field. Survive a re-populate. */
  #widths = new Map<string, number>();
  /** Active per-column filter text, keyed by field. Empty entries are removed. */
  #filters = new Map<string, string>();

  /**
   * One CLAUSE per column, from the heading filter menus, keyed by field.
   * Held, never applied — see T-grid-reports-never-combines.
   */
  #columnFilters = new Map<string, ColumnFilter>();
  /**
   * The group values the user has collapsed. On the component, not the DOM —
   * every re-render replaces the body and would take the flags with it.
   */
  #collapsed = new Set<string>();
  /**
   * Whether the grid picks ONE row or many. `single` draws radios, holds one
   * record, and shows no head-cell control — "select all" of one is meaningless.
   */
  get #single(): boolean {
    return this.dataset['select'] === 'single';
  }

  /**
   * The radio group's name in single mode. Per INSTANCE so two grids cannot
   * steal each other's pick, and STABLE across re-renders.
   */
  static #uid = 0;
  #selectNameId = ++SherpaDataGrid.#uid;
  get #selectName(): string {
    return `sherpa-grid-select-${this.#selectNameId}`;
  }

  #selected = new Set<GridRow>();
  /** The field identifying a row, when the caller named one — see GridConfig. */
  #key: string | null = null;
  /** Keys a caller asked to select — see T-grid-select-remembers-wanted-keys. */
  #wantedKeys: string[] | null = null;
  /**
   * The last row CLICKED. A RECORD, so it survives a re-render — and not DOM
   * focus, which a click on a row's text never takes.
   */
  #focused: GridRow | null = null;

  override onRender(): void {
    // TRAP T-grid-header-needs-capture — the chip's stopPropagation() would
    // hide the click that IS the sort from a bubbling listener.
    this.$('.head-row')?.addEventListener('click', this.#onHeaderClick, true);
    this.$('.body')?.addEventListener('click', this.#onRowClick);
    // Selection: select-all in the header, per-row boxes delegated on the body.
    this.$('.select-all')?.addEventListener('change', this.#onSelectAll);
    // The advanced checkbox REPORTS a scenario; the grid owns the rows, so the
    // grid is what carries it out.
    this.$('.select-all')?.addEventListener('selection-scenario', this.#onScenario as EventListener);
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
    // TRAP T-grid-chip-vocabulary-stops-here — a bound DataSource would read
    // the chip's quick-filter-change as the WHOLE filter, so it stops here.
    for (const type of ['quick-filter-change', 'quick-filter-click']) {
      this.$('.head-row')?.addEventListener(type, this.#stopChipEvent);
    }
    // The RANGE switch on a number or date menu. sherpa-switch re-dispatches a
    // native `change`, so this is the one event that covers both.
    this.$('.head-row')?.addEventListener('change', this.#onColumnRangeToggle);
    // REMOVE FILTER — the footer's third button. It arrives as menu-select
    // rather than a footer event of its own.
    this.$('.head-row')?.addEventListener('menu-select', this.#onColumnFilterRemove);
    /* ROW ACTIONS. The trigger click is delegated from the body, because the
       body is replaced on every render and a per-trigger listener would be
       re-bound a hundred times. The menu is a single element outside it, so it
       gets a direct listener. */
    this.$('.body')?.addEventListener('click', this.#onActionsClick);
    this.$('.actions-menu')?.addEventListener('menu-select', this.#onActionSelect);
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
    this.#key = typeof cfg.key === 'string' ? cfg.key : null;
    this.#actions = Array.isArray(cfg.actions) ? cfg.actions : [];
    // CSS owns the column's reveal; this is the attribute it selects on.
    this.toggleAttribute('data-actions', this.#actions.length > 0);
    // TRAP T-grid-populate-keeps-column-filters — header-row filters clear;
    // column filters drop only where the COLUMN went; selection re-resolves
    // by KEY.
    this.#filters.clear();
    const fields = new Set(this.#columns.map((c) => c.field));
    for (const field of this.#columnFilters.keys()) {
      if (!fields.has(field)) this.#columnFilters.delete(field);
    }
    this.#resolveSelection();
    this.#focused = null;
    this.#render();
  }

  /* ── Render ─────────────────────────────────────────────────────── */

  #render(): void {
    this.toggleAttribute('data-empty', this.#rows.length === 0);
    /* The header checkbox takes its ADVANCED variant only when there are rows
       to act on: "Select all" against nothing is a control that does nothing.
       CSS owns the caret's reveal; this is the attribute it selects on. */
    const advanced = this.#rows.length > 0;
    this.$('.select-all')?.toggleAttribute('data-advanced', advanced);
    /* …and on the HOST too, so the selection column can widen for the caret.
       `:host(:has(.select-all[data-advanced]))` would be the obvious selector
       and does not PARSE — see sherpa-container's note on the same thing. */
    this.toggleAttribute('data-advanced-select', advanced);
    this.#renderHead();
    this.#renderBody();
    // TRAP T-grid-select-all-is-derived — resetting it here threw the user's
    // selection away on every sort and keystroke.
    this.#syncSelectAll();
    this.#syncGroupSelects();
    // The focused row survives a sort / filter too — it is a record, not a position.
    this.#syncFocused();
    this.#syncPinned();
  }

  /**
   * Flag one cell as part of the frozen leading block. `data-pin-last` is the
   * one that draws the scroll shadow — see T-grid-pin-offset-is-measured.
   */
  #markPinned(cell: HTMLElement, last: boolean): void {
    cell.toggleAttribute('data-pinned', true);
    cell.toggleAttribute('data-pin-last', last);
  }

  /**
   * Settle the frozen columns after a render.
   *
   * TRAP T-grid-pin-offset-is-measured — the pin offset is a measured width,
   * so only a revealed selection cell may claim it.
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

    // TRAP T-grid-pin-offset-needs-subpixel — offsetWidth rounds the
    // 0.5px-bordered 32px cell and leaves a hairline under the pin.
    const probe = this.$('.head-row > .select-cell');
    const offset = selectable && probe ? probe.getBoundingClientRect().width : 0;
    this.style.setProperty('--_pin-offset', `${offset}px`);
  }

  /**
   * Re-exported from `core/icons.ts`, where the quick-filter toolbar reads the
   * same four. A column header and a toolbar chip are two views of ONE sort and
   * must never disagree about what "descending" looks like.
   *
   * TRAP T-fa-pro-renders-nothing — also why `sort-none` is fa-sort, not fa-bars.
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
    return clampNum(Math.round(n), { min: MIN_COL_WIDTH, max: MAX_COL_WIDTH });
  }

  /**
   * Stamp one <col> per drawn column.
   *
   * `table-layout: fixed` reads this, so it runs BEFORE the header cells are
   * rebuilt — a stale colgroup sizes the new columns by the old widths.
   */
  #renderCols(): void {
    // `own-children`, not `replace`: the template's fixed `.select-col` must
    // survive the rebuild.
    this.renderList(
      '.cols',
      'template.col-tpl',
      this.#shownColumns(),
      (node, col) => {
        const el = node as HTMLElement;
        el.dataset['field'] = col.field;
        // TRAP T-col-width-not-inline-size — `width`, never `inline-size`.
        el.style.width = `${this.#widthFor(col)}px`;
      },
      { clear: 'own-children', ownSel: '.cols > .col' },
    );
    /* The ACTIONS <col> is static and sits BEFORE the stamped ones, so it has
       to be moved to the end — a <col> list out of step with the columns hands
       every width to the wrong column, which is exactly what `.select-col`'s
       own comment warns about. */
    const actionsCol = this.$('.cols > .actions-col');
    if (actionsCol) this.$('.cols')?.appendChild(actionsCol);
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
      // A column that is ORDERING or NARROWING what the user can see is flagged
      // with the Style `active` mode. Both are the column acting on the view, so
      // both read the same. The grid's own CSS paints nothing from it — the
      // heading's chips carry the on-state — but the flag is the public door a
      // host reads and may style.
      if (sorted || this.#isFiltered(col.field)) th.dataset['status'] = 'active';

      // TRAP T-grid-sort-glyph-needs-a-third-state — `sort-none` is why an
      // unsortable-looking column is not one.
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
    /* The ACTIONS head is static and sits in the template BEFORE these are
       appended, so it has to be moved to the end — the same re-parenting the
       body cell gets. T-grid-actions-pin-to-the-trailing-edge. */
    const actionsHead = headRow.querySelector('.actions-head');
    if (actionsHead) headRow.appendChild(actionsHead);

    this.#renderFilterRow();
  }

  /**
   * Give one column heading its filter menu.
   *
   * TRAP T-grid-untyped-column-gets-no-filter-button — text|number|date only.
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

    // TRAP T-filter-is-data-not-a-predicate — the keys ARE store FilterOps, so
    // this picker reports a ready clause.
    // TRAP T-ops-follow-the-column-type — which ops a column type may offer.
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

    // TRAP T-grid-slider-spans-real-values — the 0..100 default crushes a
    // spend column at the far left.
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
   * TRAP T-range-switch-swaps-not-rebuilds — an attribute write, never a
   * rebuild, so the other side's typing survives a flip back.
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
   * Clear empties the controls and leaves the menu open; Remove drops the
   * clause, unlights the heading and takes the toolbar chip with it. Reported
   * as a clear, so a host has one path and not two.
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
   * to keep, Clear with nothing.
   * TRAP T-grid-reports-never-combines — it records and reports; it does not
   * filter its own rows.
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
      // Apply lands here too on an empty value or a half-built range, and
      // "Between 5 and …" is unfinished, not a mistake to sweep up.
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
      // TRAP T-grid-number-clause-must-coerce — the text collator sorts "100"
      // below "9".
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
   * TRAP T-grid-empty-clause-is-null — an empty value says nothing, and a range
   * needs both ends.
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
   * TRAP T-grid-number-clause-must-coerce — a NUMBER column's ends are coerced,
   * and a blank one is left as typed.
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
   * Set one column's filter from OUTSIDE — a saved view, a deep link, an agent.
   *
   * TRAP T-grid-read-without-write-is-half-an-api — takes the clause
   * `column-filter-change` reports, and is SILENT.
   */
  setColumnFilter(field: string, clause: unknown[] | null): void {
    if (!clause) {
      this.clearColumnFilter(field);
      return;
    }

    const [, op, value] = clause as [string, string, unknown];
    // `between` is the RANGE shape — its value is the two ends. Everything else
    // is a single condition with one value.
    const held: ColumnFilter =
      op === 'between' && Array.isArray(value)
        ? { op, value: '', range: true, from: String(value[0] ?? ''), to: String(value[1] ?? '') }
        : { op, value: String(value ?? '') };

    // Nothing to filter by is not a filter — the same rule the menu's own
    // commit applies, so a restored empty clause behaves like a cleared one.
    const empty = held.range ? !held.from || !held.to : !held.value;
    if (empty) {
      this.clearColumnFilter(field);
      return;
    }

    this.#columnFilters.set(field, held);
    // The HEADER is rebuilt rather than reached into: #addColumnFilter restores
    // each menu from #columnFilters, so there is one path that writes a menu
    // and it is the same one a re-render uses.
    this.#renderHead();
    this.#syncColumnFilterStatus();
    // …and the cells, because a text filter MARKS its matches.
    this.#renderBody();
  }

  /**
   * One column's current filter, as a ready FilterClause — or null.
   *
   * TRAP T-grid-suspend-is-not-clear — a host puts the clause back when the
   * chip comes on again; only Remove deletes, via `clearColumnFilter`.
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
   * TRAP T-grid-suspend-is-not-clear — the whole ruling, including the marks and
   * why the heading stops reading active. Deleting is `clearColumnFilter`.
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
   * TRAP T-grid-toolbar-chip-borrows-the-menu — why one menu serves both, and
   * why the anchor is passed in.
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
   * TRAP T-grid-clear-from-outside-is-silent — why it reaches back, why it is
   * silent, and what passing nothing means.
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
    // …and the trailing spacer goes back to the end after the new cells land.
    const actionsSpacer = filterRow.querySelector('.actions-cell');
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
    if (actionsSpacer) filterRow.appendChild(actionsSpacer);
  }

  /**
   * The columns the table actually draws.
   *
   * The grouped column is dropped — its value IS the group row's heading. The
   * `#columns` list is left intact so un-grouping needs no re-populate.
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
    const all = this.#visibleRows();
    // …then cut to ONE SCREEN PAGE when the grid is grouped, counting a shut
    // group as a single line. `offset` keeps data-index honest across the cut.
    // TRAP T-grid-collapsed-group-is-one-slot.
    const { rows, offset, pages } = this.#pageWindow(all);
    let lastGroup: string | null = null;

    rows.forEach((record, i) => {
      // A new value in the grouped column opens a new group row. The rows are
      // already ordered by it, so one pass produces every group exactly once.
      if (group) {
        const value = record[group];
        const key = value == null ? '' : String(value);
        if (key !== lastGroup) {
          lastGroup = key;
          // The COUNT is the group's real size across every page, not the part
          // of it this page drew — a group split by a page boundary still says
          // how many rows it holds.
          body.appendChild(this.#groupRow(key, this.#groupSize(all, group, key), columns.length));
        }
      }

      const tr = rowTpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
      tr.dataset['index'] = String(offset + i);
      // Restore this record's own selection. The body is replaced wholesale on
      // every render, so the tick has to come from #selected rather than survive
      // in the DOM.
      // BOTH boxes are stamped; CSS shows one. TRAP T-compose-never-reimplement. The radio needs the shared NAME
      // that makes the browser unpick the previous row for us, and that name is
      // per grid. Setting `checked` on both keeps whichever is visible correct.
      const radio = tr.querySelector<SelectBox>('.row-one');
      if (radio) radio.setAttribute('name', this.#selectName);
      for (const box of tr.querySelectorAll<SelectBox>('.row-select')) {
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
      /* THE ACTIONS CELL GOES LAST, and it is in the template already — so it
         is MOVED rather than created. `appendChild` on a node that is already a
         child re-parents it to the end, which is exactly what is wanted and why
         there is no createElement here. */
      const actionsCell = tr.querySelector('.actions-cell');
      if (actionsCell) tr.appendChild(actionsCell);
      body.appendChild(tr);
    });

    // A re-render (sort, filter keystroke) stamps fresh rows, so re-apply the
    // groups the user had already folded shut.
    if (group) this.#syncGroupVisibility();
    // Folding changes how many pages there ARE, so say so — after the draw, so
    // a host that re-renders on the report finds the DOM already settled.
    this.#reportPages(pages);
  }

  /**
   * Write one cell's text, marking the part a TEXT filter matched.
   *
   * TRAP T-grid-mark-is-substring-only — text + substring ops only, and the
   * CELL's casing wins.
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

    // The CELL's own casing, not the needle's — the reader typed "ana" and the
    // row says "Ana", and the row is the truth. markMatch slices the haystack
    // for exactly that reason.
    markMatch(td, text, at, held.value.length);
  }

  // TRAP T-grid-thead-sticks-as-one-block — no sticky-offset measurement here.

  /** How many visible rows share one group value. */
  #groupSize(rows: GridRow[], field: string, key: string): number {
    return rows.filter((r) => String(r[field] ?? '') === key).length;
  }

  /* ── Visual paging ──────────────────────────────────────────────────
   * TRAP T-grid-collapsed-group-is-one-slot — a SHUT group occupies one line on
   * screen, so it must cost one line of the page. The store's skip/take counts
   * RECORDS and cannot know that; it hands over every matching row while a
   * group field is set, and the grid decides where the page ends.
   *
   * These do nothing when the grid is not grouped: the store's window IS the
   * page, and slicing it again would drop rows nobody asked to hide.
   */

  /** The page size the host asked for, or 0 when it wants no visual paging. */
  get #pageSize(): number {
    return coerceNum(this.dataset['pageSize'], 0, { min: 0, int: true });
  }

  /** The 1-based page the host asked for. */
  get #page(): number {
    return coerceNum(this.dataset['page'], 1, { min: 1, int: true });
  }

  /** Whether the grid — not the store — is deciding where a page ends. */
  get #paginates(): boolean {
    return Boolean(this.dataset['groupField']) && this.#pageSize > 0;
  }

  /**
   * Walk the visible rows and cut them into pages of `size` SCREEN LINES.
   *
   * A group heading is one line. A shut group costs that line and nothing more.
   * An open group costs its heading plus one line per row. A group is never
   * split across a page boundary when it is shut — it cannot be, it is one line
   * — but an OPEN group longer than a page IS split, because the alternative is
   * a page that cannot be drawn.
   *
   * Returns the index into #visibleRows() at which each page starts, so a page
   * is a plain slice and data-index keeps meaning what it always meant.
   */
  #pageStarts(rows: GridRow[], field: string, size: number): number[] {
    const starts: number[] = [0];
    let slots = 0;
    let lastGroup: string | null = null;

    for (let i = 0; i < rows.length; i += 1) {
      const key = String(rows[i]![field] ?? '');
      const opensGroup = key !== lastGroup;
      const collapsed = this.#collapsed.has(key);
      // A shut group's ROWS are drawn but hidden, so they cost nothing. Only the
      // heading is a line.
      const cost = (opensGroup ? 1 : 0) + (collapsed ? 0 : 1);

      // This row does not fit — start a page here. A heading that would land on
      // the last slot of a page with none of its rows below it still starts the
      // page, because the page after it opens with the same heading anyway.
      if (cost > 0 && slots + cost > size && slots > 0) {
        starts.push(i);
        slots = 0;
        lastGroup = null;
        // Re-cost against the fresh page: this row now OPENS its group, because
        // the page it begins has to redraw the heading.
        slots += 1 + (collapsed ? 0 : 1);
        lastGroup = key;
        continue;
      }

      slots += cost;
      lastGroup = key;
    }

    return starts;
  }

  /**
   * The rows this page draws, and the index the first of them holds in the full
   * visible list — so a sliced page still writes TRUE data-index values.
   */
  #pageWindow(rows: GridRow[]): { rows: GridRow[]; offset: number; pages: number } {
    const field = this.dataset['groupField'];
    const size = this.#pageSize;
    if (!field || size <= 0) return { rows, offset: 0, pages: 1 };

    const starts = this.#pageStarts(rows, field, size);
    const pages = starts.length;
    // CLAMP rather than return empty: a shut group can shrink the page count
    // under the page the host is on, and an empty panel is not an answer.
    const index = Math.min(Math.max(this.#page, 1), pages) - 1;
    const from = starts[index]!;
    const to = starts[index + 1] ?? rows.length;
    return { rows: rows.slice(from, to), offset: from, pages };
  }

  /**
   * Tell the host how many pages the CURRENT fold state makes.
   *
   * Opening a group can push the tail onto a new page and shutting one can take
   * a page away, so this is re-derived on every render, never cached.
   *
   * TRAP T-grid-reports-never-combines — a REPORT, per the state-ownership
   * rule: the grid never writes its own data-page.
   */
  #reportPages(pages: number): void {
    if (!this.#paginates) return;
    const page = Math.min(Math.max(this.#page, 1), pages);
    if (String(pages) === this.dataset['totalPages'] && page === this.#page) return;
    this.emit('grid-pages-change', { pages, page });
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
    /* +1 for the leading selection column, which exists in the template whether
       or not data-selectable reveals it; +1 again for the trailing actions
       column when it is shown. A colspan that ignored either would leave the
       group row short, and the pinned cell floating over a gap. */
    cell.colSpan = columnCount + 1 + (this.#actions.length ? 1 : 0);
    tr.querySelector('.group-label')!.textContent = key === '' ? '(none)' : key;
    tr.querySelector('.group-count')!.textContent = String(size);

    const toggle = tr.querySelector('.group-toggle')!;
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.setAttribute('aria-label', `${collapsed ? 'Expand' : 'Collapse'} ${key || 'ungrouped'}`);
    return tr;
  }

  /* ── Row actions ─────────────────────────────────────────────────── */

  /**
   * A click inside the body: was it an actions trigger?
   *
   * DELEGATED, and it stops the event — a click on the trigger is not a click
   * on the row, and letting it bubble would fire `row-click` as well.
   */
  #onActionsClick = (event: Event): void => {
    const trigger = (event.target as HTMLElement).closest<HTMLElement>('.actions-trigger');
    if (!trigger) return;
    // `#onRowClick` already ignores this cell — see its own guard, which is the
    // one that matters, because it is registered first. This stops the click
    // reaching a HOST listener on the grid, which has no such guard.
    event.stopPropagation();
    this.#openActions(trigger);
  };

  /**
   * Open the shared actions menu for one row.
   *
   * TRAP T-one-actions-menu-for-every-row — one popover, not one per row, and
   * why the trigger click is delegated. The menu is re-stamped on each open:
   * the list is the same today, but a per-row filter would live here.
   */
  #openActions(trigger: HTMLElement): void {
    const record = this.#recordFor(trigger);
    if (!record || !this.#actions.length) return;
    const menu = this.$<HTMLElement & { show?: (t?: HTMLElement) => void }>('.actions-menu');
    const tpl = this.$<HTMLTemplateElement>('template.action-item-tpl');
    if (!menu || !tpl) return;

    this.#actionRow = record;
    // The menu's rows are SLOTTED light-DOM buttons, which is what gives them
    // Enter, Space and focus for nothing — see T-menu-rows-stay-native-controls.
    menu.replaceChildren();
    for (const action of this.#actions) {
      const item = tpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
      item.setAttribute('value', action.id);
      item.toggleAttribute('data-danger', !!action.danger);
      const icon = item.querySelector('.action-icon');
      if (icon) {
        if (action.icon) icon.className = `action-icon ${action.icon}`;
        else icon.remove();
      }
      item.querySelector('.action-label')!.textContent = action.label;
      menu.appendChild(item);
    }

    trigger.setAttribute('aria-expanded', 'true');
    menu.show?.(trigger);
  }

  /**
   * A menu row was chosen. Report the action and the row it belongs to.
   *
   * REPORTS, never acts: deleting a record is the host's decision, and a grid
   * that removed the row itself would be deriving state it does not own.
   * TRAP T-grid-reports-never-combines.
   */
  #onActionSelect = (event: Event): void => {
    const id = (event as CustomEvent).detail?.['value'] as string | undefined;
    const record = this.#actionRow;
    this.#closeActions();
    if (!id || !record) return;
    this.emit('row-action', { id, records: [record] });
  };

  /** Shut the menu and put the trigger's aria-expanded back. */
  #closeActions(): void {
    this.#actionRow = null;
    for (const t of this.$$('.actions-trigger')) t.setAttribute('aria-expanded', 'false');
    this.$<HTMLElement & { hide?: () => void }>('.actions-menu')?.hide?.();
  }

  /**
   * The actions that apply to the CURRENT selection.
   *
   * One row: all of them. Two or more: only those declared `multi`, because
   * "edit" on five users is not one action and a toolbar that offered it would
   * be lying. A host reads this to build its bulk bar.
   *
   * TRAP T-grid-actions-are-declared-once-used-twice.
   */
  actionsFor(count: number): GridAction[] {
    if (count <= 0) return [];
    return count === 1 ? [...this.#actions] : this.#actions.filter((a) => a.multi);
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
   * TRAP T-grid-filter-row-uses-store-filterrows — a real clause tree, never a
   * hand-rolled substring match.
   */
  #filteredRows(): GridRow[] {
    if (!this.#filters.size) return this.#rows;

    const clauses: Filter[] = [...this.#filters].map(
      ([field, needle]) => [field, 'contains', needle] as Filter,
    );
    const filter: Filter = clauses.length === 1 ? clauses[0]! : (['and', ...clauses] as Filter);
    return filterRows(this.#rows, filter) as GridRow[];
  }

  /**
   * Order the rows — through the STORE's `sortRows`, not a compare of its own.
   *
   * TRAP T-one-collator-for-the-library — one comparator, nulls pinned last.
   * GROUP goes first as a leading spec so groups are adjacent; sorting BY the
   * grouped column is the one case where the reader's direction IS the groups'.
   */
  #sortRows(rows: GridRow[]): GridRow[] {
    const field = this.dataset['sortField'];
    const group = this.dataset['groupField'];
    if (!field && !group) return rows;
    const direction: SortDirection = this.dataset['sortDirection'] === 'desc' ? 'desc' : 'asc';

    const specs: SortSpec[] = [];
    if (group) specs.push({ field: group, direction: group === field ? direction : 'asc' });
    if (field && field !== group) specs.push({ field, direction });
    return sortRows(rows, specs) as GridRow[];
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

    // TRAP T-grid-sort-is-tri-state — asc → desc → OFF, one column at a time.
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
    /* …and a click in the ACTIONS cell is the menu, for the same reason. It is
       guarded HERE rather than by stopPropagation in the actions handler:
       both listeners sit on `.body`, so they fire in REGISTRATION order, and
       this one is registered first. Stopping the event later would be too late
       — `row-click` would already have gone out. */
    if ((event.target as HTMLElement).closest('.actions-cell')) return;

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
   * Fold one group open or shut. The flag goes on the group ROW and CSS hides
   * the rows; `#collapsed` remembers it across the next body rebuild.
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

    // A sibling selector cannot reach from a group row to the rows after it, so
    // each row carries its own shut/open flag.
    this.#syncGroupVisibility();

    // WHEN THE GRID PAGES, FOLDING CHANGES WHAT IS ON THE PAGE — not just what
    // is visible on it. Shutting a group frees slots, so rows from the next page
    // move up onto this one; opening one pushes the tail off. A visibility sync
    // alone would leave a page of two headings and a hole.
    // TRAP T-grid-collapsed-group-is-one-slot.
    if (this.#paginates) {
      this.#renderBody();
      // The body was replaced, so the ticks and the select-all have to be
      // re-derived from #selected rather than survive in the DOM.
      this.#syncSelectAll();
      this.#syncGroupSelects();
      this.#syncFocused();
    }

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

  /** A drag in flight — one object, so a stray pointermove has one thing to test. */
  #drag: { field: string; startX: number; startWidth: number } | null = null;

  #onGripDown = (event: PointerEvent): void => {
    const grip = (event.target as HTMLElement | null)?.closest?.('.resize-grip');
    if (!grip) return;
    const th = grip.closest<HTMLElement>('.head-cell');
    const field = th?.dataset['field'];
    if (!field) return;

    // TRAP T-grid-grip-captures-the-pointer — neither of these stops the
    // synthetic click; #onGripUp swallows that.
    event.preventDefault();
    event.stopPropagation();

    // The MEASURED width — see T-grid-grip-captures-the-pointer.
    const startWidth = th!.getBoundingClientRect().width;
    this.#drag = { field, startX: event.clientX, startWidth };
    this.toggleAttribute('data-resizing', true);

    // TRAP T-grid-grip-captures-the-pointer — without capture a fast drag drops
    // the column where the cursor escaped.
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
    // Write the <col> DIRECTLY: a #render() per pointermove would rebuild the
    // body 60x/s, and a width changes only the colgroup.
    const col = this.$<HTMLElement>(`.cols > .col[data-field="${CSS.escape(field)}"]`);
    if (col) col.style.width = `${next}px`;
  };

  #onGripUp = (event: PointerEvent): void => {
    const drag = this.#drag;
    this.#drag = null;
    this.toggleAttribute('data-resizing', false);

    // Swallow the click the browser is about to synthesise on this pointerup.
    //
    // TRAP T-swallow-flag-not-listener — a FLAG, never a rival listener.
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
    const checked = (event.target as SelectBox).checked;
    // Only the VISIBLE rows: a select-all cannot reach records a filter is hiding,
    // and it must not silently deselect them either.
    for (const record of this.#visibleRows()) {
      if (checked) this.#selected.add(record);
      else this.#selected.delete(record);
    }
    // Unticking the header box is a CLEAR, so the off-page keys go with it —
    // the same reason the "none" scenario drops them.
    if (!checked) this.#wantedKeys = null;
    this.$$<SelectBox>('.row-select').forEach((box) => (box.checked = checked));
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
      this.#selectGroup(target as SelectBox);
      return;
    }

    if (!target.classList.contains('row-select')) return;
    // Record the choice against the RECORD, so it survives the next re-render.
    const record = this.#recordFor(target);
    if (record) {
      // SINGLE mode holds one — and the GRID has to enforce it now. The radios
      // share a `name`, but each sits in its own shadow root, so the browser
      // sees one group per row and never unticks the previous pick. That was
      // free while these were bare `<input>`s in one tree.
      // TRAP T-radios-in-shadow-roots-are-not-one-group.
      if (this.#single) {
        this.#selected.clear();
        this.#wantedKeys = null;
        for (const other of this.$$<SelectBox>('.row-one')) {
          if (other !== target) other.checked = false;
        }
      }
      if ((target as SelectBox).checked) this.#selected.add(record);
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
  #selectGroup(box: SelectBox): void {
    const key = box.closest<HTMLElement>('.group-row')?.dataset['group'];
    if (key == null) return;
    for (const row of this.$$<HTMLElement>('.row')) {
      if (row.dataset['group'] !== key) continue;
      const rowBox = row.querySelector<SelectBox>('.row-select');
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
   * Reflect all/none/indeterminate on each group checkbox — a group's box has to
   * answer for the rows it heads.
   */
  #syncGroupSelects(): void {
    for (const groupRow of this.$$<HTMLElement>('.group-row')) {
      const key = groupRow.dataset['group'];
      const box = groupRow.querySelector<SelectBox>('.group-select');
      if (!box || key == null) continue;
      const rows = this.$$<HTMLElement>('.row').filter((r) => r.dataset['group'] === key);
      const checked = rows.filter(
        (r) => r.querySelector<SelectBox>('.row-select')?.checked,
      ).length;
      box.checked = checked > 0 && checked === rows.length;
      box.indeterminate = checked > 0 && checked < rows.length;
    }
  }

  /**
   * A selection scenario from the header's advanced checkbox.
   *
   * `page` and `all` differ ONLY when the grid is paging: `page` takes what is
   * drawn, `all` takes every row that survives the current filters. On an
   * unpaged grid they are the same set, and saying so is more honest than
   * hiding one of them.
   *
   * TRAP T-select-all-is-the-visible-rows — neither reaches a record a filter
   * is hiding, because a selection the reader cannot see is one they cannot
   * undo.
   */
  #onScenario = (event: CustomEvent): void => {
    const value = event.detail?.['value'] as string | undefined;
    if (!value) return;

    if (value === 'none') {
      this.#selected.clear();
      // "Clear selection" means EVERYTHING, including records on other pages.
      // Without this the merge in `#rememberSelection` would hand every
      // off-page key straight back — a Clear that cleared only what was drawn.
      // TRAP T-selection-lives-in-the-keys-not-the-objects.
      this.#wantedKeys = null;
    } else {
      // `page` is what the body drew; `all` is every row the filters kept.
      const rows = value === 'page' ? this.#pageRecords() : this.#visibleRows();
      for (const record of rows) this.#selected.add(record);
    }

    this.#renderBody();
    this.#syncSelectAll();
    this.#syncGroupSelects();
    this.#emitSelection();
  };

  /** The records the body actually drew — one page when the grid pages. */
  #pageRecords(): GridRow[] {
    return this.$$<HTMLElement>('.row')
      .map((tr) => this.#visibleRows()[coerceNum(tr.dataset['index'], -1, { int: true })])
      .filter((r): r is GridRow => r !== undefined);
  }

  /** Reflect all/none/indeterminate on the header select-all box. */
  #syncSelectAll(): void {
    const all = this.$$<SelectBox>('.row-select');
    const selectAll = this.$<SelectBox>('.select-all');
    if (!selectAll) return;
    const checked = all.filter((b) => b.checked).length;
    selectAll.checked = checked > 0 && checked === all.length;
    selectAll.indeterminate = checked > 0 && checked < all.length;
  }

  /**
   * Write the current selection back to `#wantedKeys` — the half that SURVIVES.
   *
   * `#selected` holds record OBJECTS, so it is only as durable as those
   * objects. A sort or a group reorders the same objects and it holds; a PAGE
   * change fetches new ones from the store and every identity breaks. The keys
   * are what outlive that, and `#resolveSelection()` already rebuilds
   * `#selected` from them on every populate — but nothing was ever WRITING
   * them except the `select()` API, so a user's own ticks were dropped on the
   * next page.
   *
   * MERGED, not replaced: the grid holds one page, so a record selected on
   * page 1 is simply absent from `#rows` while page 2 is up. Overwriting would
   * silently discard it. Keys for rows the grid CAN see are taken from
   * `#selected`; keys for rows it cannot are carried over untouched.
   *
   * TRAP T-selection-lives-in-the-keys-not-the-objects.
   */
  #rememberSelection(): void {
    if (!this.#key) return; // No key means no durable answer — say nothing.
    const key = this.#key;
    const onPage = new Set(
      this.#rows.map((r) => r[key]).filter((v) => v != null).map(String),
    );
    const chosen = new Set(
      this.selectedRecords.map((r) => r[key]).filter((v) => v != null).map(String),
    );
    // Anything the grid cannot currently see keeps whatever it had.
    for (const k of this.#wantedKeys ?? []) if (!onPage.has(k)) chosen.add(k);
    this.#wantedKeys = chosen.size ? [...chosen] : null;
  }

  /** Emit the current selection as row indices (strings) in sorted-view order. */
  #emitSelection(): void {
    // BEFORE the event: a listener that reads `selectedKeys` must see the
    // choice that was just made, not the one before it.
    this.#rememberSelection();
    const selected = this.$$<SelectBox>('.row-select')
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

  /**
   * The selected rows as KEYS — savable, unlike the indices `selection-change`
   * reports.
   *
   * TRAP T-grid-key-or-position-lies — why indices cannot be saved, and why this
   * is EMPTY without a `key` in `populate()`.
   */
  get selectedKeys(): string[] {
    if (!this.#key) return [];
    // `#wantedKeys` IS the answer, not `selectedRecords`. The records are the
    // rows this grid currently holds, so deriving from them reported an EMPTY
    // selection the moment the reader turned to a page none of them are on —
    // while the selection itself was perfectly intact.
    // TRAP T-selection-lives-in-the-keys-not-the-objects.
    return [...(this.#wantedKeys ?? [])];
  }

  /**
   * Select exactly these rows, by key — a saved view, a deep link, an agent.
   *
   * TRAP T-grid-select-remembers-wanted-keys — REPLACES, ignores unmatched
   * keys, and is SILENT. `select([])` clears.
   */
  select(keys: readonly string[]): void {
    // REPLACES outright — the difference between an explicit `select()` and a
    // user's tick, which merges. T-selection-lives-in-the-keys-not-the-objects.
    this.#wantedKeys = keys.length ? keys.map(String) : null;
    this.#resolveSelection();
    // UNMATCHED keys are dropped, and ONLY here: keep just the keys that
    // resolved to a real row. The caller named these against the rows the grid
    // holds, so a key that matched nothing names a record that is gone, and
    // keeping it would have `selectedKeys` report a selection that can never
    // be shown.
    //
    // NOT `#rememberSelection()`, which MERGES — it would hand the unmatched
    // key straight back. A user's tick needs that merge, because the grid may
    // hold one page and "matched nothing" there means "is on another page".
    //
    // ONLY WHEN THERE WERE ROWS TO CHECK AGAINST. A saved view is restored by
    // calling `select()` on a grid that has not been populated yet, and the
    // data lands afterwards — the whole reason keys exist. Dropping them
    // against an empty grid throws away the selection at exactly the moment it
    // is being restored. TRAP T-selection-lives-in-the-keys-not-the-objects.
    const key = this.#key;
    if (key && this.#rows.length) {
      const resolved = [...this.#selected]
        .map((r) => r[key])
        .filter((v) => v != null)
        .map(String);
      this.#wantedKeys = resolved.length ? resolved : null;
    }
    // The boxes are stamped from #selected on every render, so a rebuild is how
    // the ticks are written — there is one path that sets them, not two.
    this.#renderBody();
    this.#syncSelectAll();
    this.#syncGroupSelects();
  }

  /**
   * Turn the remembered keys into the rows they name, against whatever rows the
   * grid holds NOW — re-run on every populate.
   *
   * TRAP T-grid-select-remembers-wanted-keys — why re-resolving is needed.
   */
  #resolveSelection(): void {
    this.#selected.clear();
    if (!this.#key || !this.#wantedKeys) return;
    const key = this.#key;
    const wanted = new Set(this.#wantedKeys);
    for (const row of this.#rows) {
      const value = row[key];
      if (value != null && wanted.has(String(value))) this.#selected.add(row);
    }
  }

  /** Select nothing. The same as `select([])`, said plainly. */
  clearSelection(): void {
    this.select([]);
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
   * Three sources: `#filters` (its own box), `#columnFilters` (its heading's
   * menu), and `data-filter-fields` (a toolbar it cannot see). Any of them and
   * the column reads active.
   */
  #isFiltered(field: string): boolean {
    if (this.#filters.has(field)) return true;
    // A clause set in this column's own heading menu — unless it is SUSPENDED,
    // in which case the column is narrowing nothing and must not read active.
    const held = this.#columnFilters.get(field);
    if (held && !held.suspended) return true;
    const external = this.dataset['filterFields'];
    // TRAP T-grid-filter-fields-match-whole — `includes` would light `status`
    // for `substatus`.
    return !!external && external.split(/\s+/).includes(field);
  }

  /**
   * Flag (or unflag) one column's HEADING as filtered.
   *
   * TRAP T-grid-active-flag-is-not-a-tint — the heading only, and painted by
   * nothing here. Called per keystroke, so it never rebuilds the header row.
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
   * The needle is normalised to lower case for the `#filters` map key; the
   * matching itself is the store's `filterRows`, which does its own casing.
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
    // TRAP T-grid-no-matches-is-not-empty — data-empty would hide the input
    // being typed in.
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
