/**
 * sherpa-data-grid — the table; REPORTS sort, filter, paging and selection.
 *
 * `populate()` draws it, and a host owns every one of those — the grid only
 * reports what the reader did.
 *
 * TRAP T-grid-active-flag-is-not-a-tint
 * TRAP T-grid-group-drops-the-column
 *
 * @see TRAP T-grid-reports-never-combines
 *
 * Map:
 * - GridColumn — one column: its field, heading, type, and whether it sorts or filters
 * - GridAction — One action a row offers.
 */
import { kindOf } from '../../core/ui/filter-kind.js';
import {
  DATA_PROPS, SHARED_PROPS, SherpaElement, coerceNum, clampNum, markNeedle,
} from '../../core/ui/sherpa-element.js';
import { ORGANISE_ICONS } from '../../core/ui/shared-constants.js';
import { nextSort, sortDirectionAttr, sortDirectionFrom } from '../../core/data/cycle.js';
import { reduceRows } from '../../core/data/aggregate.js';
import {
  filterRows, sortRows,
  type Filter, type GroupSummary, type SortDirection, type SortSpec,
} from '../../core/data/store.js';
import {
  DEFAULT_OP, OPS_FOR_TYPE, OP_LABELS, OP_TAKES, picksClause, type FilterOp,
} from '../../core/data/store.js';
import {
  readingClause, type FieldReading, type FieldType,
} from '../../core/data/filter-state.js';

/** The `fx` glyph a CONDITION wears, wherever one is drawn. */
const CONDITION_ICON = 'function';
// SIDE-EFFECT imports: an undefined custom element renders inert.
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
   * How this column is ANSWERED — the same three states a filter chip takes.
   * A text column defaults to `true` (a list AND a condition); `'only'` drops
   * the list, for free text nobody picks from. The HOST decides, because how
   * many values is too many is a question about the data.
   * TRAP T-a-wall-of-values-is-not-a-filter
   * TRAP T-a-filter-answers-by-values-conditions-or-both
   */
  conditions?: boolean | 'only';
  /** Which condition this column OPENS on — `'contains'` for free text. */
  op?: FilterOp;
  /** Drawn width in px, clamped. A user drag overrides it for the grid's life. */
  width?: number;
}

type GridRow = Record<string, unknown>;

/** A selection box — all three are `sherpa-select-checkbox`, NOT `HTMLInputElement`. */
type SelectBox = HTMLElement & { checked: boolean; indeterminate: boolean };

/** One action a row offers. TRAP T-grid-actions-are-declared-once-used-twice. */
export interface GridAction {
  /** What `row-action` carries back. */
  id: string;
  label: string;
  /** An icon name, e.g. `'pencil'`. */
  icon?: string;
  /** Can apply to MANY rows at once — a bulk toolbar offers only these. */
  multi?: boolean;
  /** Draws in the critical colour. */
  danger?: boolean;
}

interface GridConfig {
  columns: GridColumn[];
  rows: GridRow[];
  /** TRAP T-grid-key-or-position-lies — no key means selection by POSITION. */
  key?: string;
  /** Per-row actions. Reveals the pinned trailing column. */
  actions?: GridAction[];
  /**
   * THE GROUPS, from whoever owns the data. A grid DRAWS a group heading and
   * collapses it — the same view-side half it owns for paging — but it does
   * not create the group, and a count it works out itself is a count of the
   * rows it happens to hold.
   * TRAP T-a-group-is-a-data-layer-concept
   */
  groups?: GroupSummary[];
}

/**
 * One column heading's filter. TRAP T-grid-range-keeps-both-shapes — not a
 * tagged union, so a Range flip and back finds the other side's typing intact.
 */
interface ColumnFilter {
  op: string;
  value: string;
  range?: boolean;
  from?: string;
  to?: string;
  /** TRAP T-grid-suspend-is-not-clear — kept, but the heading goes dark. */
  suspended?: boolean;
  /** SEVERAL ticked values, for an `in` / `notin` clause. */
  picks?: string[];
}

/** Which body template each column type's filter menu holds — TEXT has none:
    it is the sherpa-menu FILTER variant. TRAP T-one-field-one-filter-menu */
/* ONLY A DATE keeps a body of its own. A calendar projects its stepper into
   the menu's `header` slot, and slot assignment reaches a host's LIGHT DOM
   only — inside the menu's shadow root it has nothing to project into.
   Everything else is the menu's now.
   TRAP T-a-menu-owns-its-own-bodies
   TRAP T-projected-slot-content-crosses-two-shadow-boundaries */
const COLUMN_FILTER_BODIES: Record<string, string | null> = {
  text: null,
  number: null,
  date: 'template.head-date-filter-tpl',
};


export class SherpaDataGrid extends SherpaElement {
  static override css = new URL('./sherpa-data-grid.css', import.meta.url);
  static override html = new URL('./sherpa-data-grid.html', import.meta.url);

  /* DECLARED: CSS-only, so the base class writes nothing. A `:host([data-x])`
     rule is a public API and belongs in one place. */
  static override props = {
    'data-bounds': SHARED_PROPS['data-bounds'],
    'data-total-pages': DATA_PROPS['data-total-pages'],
    'data-column-filters': { type: 'boolean', kind: 'style' },
    'data-filterable': { type: 'boolean', kind: 'style' },
    'data-locked': DATA_PROPS['data-locked'],
  } as const;
  // data-selectable is observed though CSS owns its reveal: the pin offset is a
  // MEASURED width, so it must re-run #syncPinned().
  static override observed = [
    'data-sort-field',
    'data-sort-direction',
    'data-group-field',
    // Fields an EXTERNAL filter narrows — the only way a column filtered from
    // outside can light its own header.
    'data-filter-fields',
    // What a toolbar chip is matching on, so its hits mark in the cells.
    'data-needles',
    // The WHOLE column's values, so a filter menu is never a one-way door.
    'data-column-values',
    'data-selectable',
    // Single vs multiple changes the CONTROL each row draws, so it re-renders.
    'data-select',
    'data-page',
    'data-page-size',
  ];

  /* TRAP T-grid-column-width-bounds — 96/480/160 are measured, not chosen. */
  static readonly MIN_COL_WIDTH = 96;
  static readonly MAX_COL_WIDTH = 480;
  static readonly DEFAULT_COL_WIDTH = 160;

  /** The columns, as populated. */
  #columns: GridColumn[] = [];
  /** The rows, as populated. */
  #rows: GridRow[] = [];
  /** The per-row actions, which reveal the pinned actions column. */
  #actions: GridAction[] = [];
  /** The row whose menu is open. A RECORD, because an index moves on a sort. */
  #actionRow: GridRow | null = null;
  /** Widths the USER has dragged, keyed by field. Survive a re-populate. */
  #widths = new Map<string, number>();
  /** Filter-row text, keyed by field. Empty entries are removed. */
  #filters = new Map<string, string>();

  /** One clause per column, from the heading menus. Held, never applied. */
  #columnFilters = new Map<string, ColumnFilter>();
  /** Collapsed group values. Off the DOM, which a re-render replaces. */
  #collapsed = new Set<string>();
  /** `single` draws radios, holds one record, and shows no select-all. */
  get #single(): boolean {
    return this.dataset['select'] === 'single';
  }

  /** The radio group name in single mode. Per instance, stable across renders. */
  static #uid = 0;
  /** This grid's own number, so its radio group name is unique on the page. */
  #selectNameId = ++SherpaDataGrid.#uid;
  get #selectName(): string {
    return `sherpa-grid-select-${this.#selectNameId}`;
  }

  /** The selected rows. */
  #selected = new Set<GridRow>();
  /** The field that identifies a row, or null to select by position. */
  #key: string | null = null;
  /** Keys a caller asked to select. */
  #wantedKeys: string[] | null = null;
  /** The last row CLICKED. A record, not DOM focus, which a click never takes. */
  #focused: GridRow | null = null;

  override onRender(): void {
    // TRAP T-grid-header-needs-capture — the chip's stopPropagation() hides the
    // click that IS the sort from a bubbling listener.
    this.$('.head-row')?.addEventListener('click', this.#onHeaderClick, true);
    this.$('.body')?.addEventListener('click', this.#onRowClick);
    this.$('.select-all')?.addEventListener('change', this.#onSelectAll);
    this.$('.select-all')?.addEventListener('selection-scenario', this.#onScenario as EventListener);
    this.$('.body')?.addEventListener('change', this.#onRowSelect);
    this.$('.filter-row')?.addEventListener('input', this.#onFilterInput);
    this.$('.filter-row')?.addEventListener('click', this.#onFilterClick);
    this.$('.head-row')?.addEventListener('pointerdown', this.#onGripDown);
    // Both footer buttons commit. Delegated — the header is rebuilt per sort.
    this.$('.head-row')?.addEventListener('menu-apply', this.#onColumnFilterCommit);
    this.$('.head-row')?.addEventListener('menu-clear', this.#onColumnFilterCommit);
    // TRAP T-grid-chip-vocabulary-stops-here — a bound DataSource would read
    // the chip's quick-filter-change as the WHOLE filter.
    for (const type of ['quick-filter-change', 'quick-filter-click']) {
      this.$('.head-row')?.addEventListener(type, this.#stopChipEvent);
    }
    // sherpa-switch re-dispatches a native `change`, so this covers both.
    this.$('.head-row')?.addEventListener('change', this.#onColumnRangeToggle);
    this.$('.head-row')?.addEventListener('menu-select', this.#onColumnFilterRemove);
    // Delegated: the body is replaced per render. The menu sits outside it.
    this.$('.body')?.addEventListener('click', this.#onActionsClick);
    this.$('.actions-menu')?.addEventListener('menu-select', this.#onActionSelect);
    if (this.#columns.length) this.#render();
  }

  override onChange(): void {
    this.#syncNeedles();
    this.#syncColumnValues();
    if (this.#columns.length) this.#render();
  }

  /** populate({ columns, rows }) — the grid config. */
  protected override renderData(data: unknown): void {
    const cfg = (data ?? {}) as Partial<GridConfig>;
    this.#columns = Array.isArray(cfg.columns) ? cfg.columns : [];
    this.#rows = Array.isArray(cfg.rows) ? cfg.rows : [];
    this.#key = typeof cfg.key === 'string' ? cfg.key : null;
    this.#syncNeedles();
    this.#syncColumnValues();
    this.#actions = Array.isArray(cfg.actions) ? cfg.actions : [];
    this.#groups = Array.isArray(cfg.groups) ? cfg.groups : null;
    this.toggleAttribute('data-actions', this.#actions.length > 0);
    // TRAP T-grid-populate-keeps-column-filters — header-row filters clear,
    // column filters drop only where the COLUMN went, selection re-resolves by KEY.
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

  /** Draw the head and the body. */
  #render(): void {
    this.toggleAttribute('data-empty', this.#rows.length === 0);
    // "Select all" of nothing is a control that does nothing.
    const advanced = this.#rows.length > 0;
    this.$('.select-all')?.toggleAttribute('data-advanced', advanced);
    // …and on the HOST, so the column widens for the caret:
    // `:host(:has(.select-all[data-advanced]))` does not PARSE.
    this.toggleAttribute('data-advanced-select', advanced);
    this.#renderHead();
    this.#renderBody();
    // TRAP T-grid-select-all-is-derived — never reset here, or a sort throws
    // the user's selection away.
    this.#syncSelectAll();
    this.#syncGroupSelects();
    this.#syncFocused();
    this.#syncPinned();
  }

  /** Flag one cell as frozen. `data-pin-last` draws the scroll shadow. */
  #markPinned(cell: HTMLElement, last: boolean): void {
    cell.toggleAttribute('data-pinned', true);
    cell.toggleAttribute('data-pin-last', last);
  }

  /**
   * Settle the frozen columns after a render. TRAP T-grid-pin-offset-is-measured
   * — only a revealed selection cell may claim the offset.
   */
  #syncPinned(): void {
    const selectable = this.hasAttribute('data-selectable');
    for (const cell of this.$$('.select-cell')) {
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
   * Shared with the quick-filter toolbar, so a header and a chip cannot disagree
   * about "descending". TRAP T-fa-pro-renders-nothing — `sort-none` is fa-sort.
   */
  static readonly icons = ORGANISE_ICONS;

  /** Drawn width: a dragged width wins, then the config, then the default. */
  #widthFor(col: GridColumn): number {
    const dragged = this.#widths.get(col.field);
    const raw = dragged ?? col.width ?? SherpaDataGrid.DEFAULT_COL_WIDTH;
    return this.#clampWidth(raw);
  }

  /** A column width held between the minimum and the maximum. */
  #clampWidth(n: number): number {
    const { MIN_COL_WIDTH, MAX_COL_WIDTH, DEFAULT_COL_WIDTH } = SherpaDataGrid;
    if (!Number.isFinite(n)) return DEFAULT_COL_WIDTH;
    return clampNum(Math.round(n), { min: MIN_COL_WIDTH, max: MAX_COL_WIDTH });
  }

  /** Stamp one <col> per column. Must run BEFORE the header cells are rebuilt. */
  #renderCols(): void {
    // `own-children`, not `replace`: the fixed `.select-col` must survive.
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
    // The static ACTIONS <col> sits BEFORE the stamped ones, so it moves to the
    // end — a <col> list out of step gives every width to the wrong column.
    const actionsCol = this.$('.cols > .actions-col');
    if (actionsCol) this.$('.cols')?.appendChild(actionsCol);
  }

  /** Draw the heading row: sort, filter and resize for each column. */
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
      this.upgradeClonedIcons(th);
      th.dataset['field'] = col.field;
      if (col.type) th.dataset['type'] = col.type;
      // Not nth-child: the position shifts when a column is dropped.
      if (i === 0) this.#markPinned(th, true);
      this.#addColumnFilter(th, col);
      this.#lightFilterChip(th, col.field);
      const sortable = col.sortable !== false;
      th.dataset['sortable'] = String(sortable);
      th.querySelector('.head-label')!.textContent = col.header ?? col.field;
      // SORTED means APPLIED, not remembered — a suspended column keeps its
      // field and an empty direction. TRAP T-a-suspended-sort-is-one-owners-job.
      const sorted = sortable && col.field === sortField && sortDir !== '';
      if (sorted) th.dataset['sort'] = sortDir ?? 'asc';
      else delete th.dataset['sort'];
      // The grid's CSS paints nothing from `active`; a host may style it.
      if (sorted || this.#isFiltered(col.field)) th.dataset['status'] = 'active';

      // TRAP T-grid-sort-glyph-needs-a-third-state.
      const sortChip = th.querySelector<HTMLElement>('.head-sort');
      if (sortChip) {
        const { sortNone, sortAsc, sortDesc } = SherpaDataGrid.icons;
        sortChip.dataset['iconStart'] = !sorted
          ? sortNone
          : (sortDir === 'desc' ? sortDesc : sortAsc);
        // The chip is LOCKED, so the grid sets its on-state.
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
    // The static ACTIONS head sits in the template BEFORE these, so it is moved
    // to the end. TRAP T-grid-actions-pin-to-the-trailing-edge.
    const actionsHead = headRow.querySelector('.actions-head');
    if (actionsHead) headRow.appendChild(actionsHead);

    // Every heading is in the table now, so its menu has upgraded.
    this.#flushItems();

    this.#renderFilterRow();
  }

  /** TRAP T-grid-untyped-column-gets-no-filter-button — text|number|date only. */
  /** Give a heading its filter chip and menu, for the column's type. */
  #addColumnFilter(th: HTMLElement, col: GridColumn): void {
    const chip = th.querySelector<HTMLElement>('.head-filter');
    if (!chip) return;

    const kind = col.type ?? 'text';
    if (!(kind in COLUMN_FILTER_BODIES)) {
      // The chip's own flag, so CSS hides it without reaching into its shadow.
      chip.setAttribute('data-unsupported', '');
      return;
    }
    const bodyTpl = COLUMN_FILTER_BODIES[kind];

    const menu = this.clone('template.head-menu-tpl');
    if (!menu) return;
    const body = bodyTpl ? this.clone(bodyTpl) : null;
    if (bodyTpl && !body) return;

    /* THE MENU DRAWS THE OPERATOR SELECT. This heading only NAMES the set, from
       the ONE vocabulary in store.ts — the same list the condition rows read.
       TRAP T-ops-follow-the-column-type · TRAP T-a-menu-owns-its-own-bodies */
    if (kind === 'number') {
      const ops = OPS_FOR_TYPE[kind] ?? [];
      if (ops.length) menu.setAttribute('data-conditions', ops.join(','));
    }

    // Clear empties the controls and keeps the menu open; Remove drops the clause.
    menu.setAttribute('data-removable', '');

    const label = col.header ?? col.field;
    /* The FIELD, as a filter chip's own menu heads itself. The card is plainly
       a filter menu — a condition row, value rows and Apply — so a "Filter "
       prefix names the verb twice and makes one menu read unlike the other.
       The CHIP on the heading keeps its `aria-label` of "Filter <field>", which
       is where that verb belongs. TRAP T-one-field-one-filter-menu */
    menu.setAttribute('data-heading', label);
    // A top-layer popover escapes the scroller, inside the HOST's named region.
    const bounds = this.dataset['bounds'];
    if (bounds) menu.setAttribute('data-bounds', bounds);

    const held = this.#columnFilters.get(col.field);

    // TRAP T-grid-slider-spans-real-values — the 0..100 default crushes a
    // spend column at the far left.
    if (kind === 'number') {
      menu.setAttribute('data-body', 'number');
      /* `reduceRows`, not a hand-rolled Number() sweep: `null` and `''` coerce
         to a FINITE 0, so counting them gave a Spend column of 120..340 a
         slider starting at 0 — the very crush the comment above warns about.
         TRAP T-number-of-null-is-zero */
      const hasNumbers = this.#rows.some((row) => {
        const raw = row[col.field];
        return raw != null && raw !== '' && Number.isFinite(Number(raw));
      });
      if (hasNumbers) {
        menu.setAttribute('data-min', String(Math.floor(reduceRows(this.#rows, 'min', col.field))));
        menu.setAttribute('data-max', String(Math.ceil(reduceRows(this.#rows, 'max', col.field))));
      }
    }

    if (kind === 'number' || kind === 'date') {
      // A HELD clause wins — `held?.range || …` would force a saved single
      // filter back to a range. TRAP T-a-default-is-not-an-override.
      const asRange = held ? !!held.range : kind === 'number';

      // The MENU carries the mode, because CSS selects the shape off it.
      if (asRange) menu.setAttribute('data-range', '');
    }

    /* A TEXT column IS the shared filter menu: the condition row comes from
       sherpa-menu's own `filter` template, and the rows below are this
       column's distinct values — the same question a filter chip asks.
       TRAP T-one-field-one-filter-menu */
    if (kind === 'text') {
      menu.setAttribute('data-type', 'filter');
      /* A TEXT COLUMN always offers conditions. This is the one place they are
         never noise: a column of free text is exactly what a reader asks
         "starts with" of. A chip over a closed set opts in instead.
         TRAP T-conditions-are-opt-in-per-field */
      menu.setAttribute('data-conditional', '');
      /* VALUES, CONDITIONS, OR BOTH — the column says which, because how many
         values is too many is a question about the data.
         TRAP T-a-filter-answers-by-values-conditions-or-both */
      /* WHAT IT IS, from the ONE derivation the chips read.
         TRAP T-a-chip-knows-what-kind-it-is */
      if (kindOf(col) === 'conditional') {
        menu.setAttribute('data-conditions-only', '');
        menu.setAttribute('data-mode', 'condition');
      }
      menu.setAttribute('data-search', '');
      /* THE SAME MENU a filter chip opens for this field, so it carries the
         same flags: MULTIPLE values (checkbox rows, and several picks become
         `in`), and a Clear, which is the only way back to "no filter" once a
         value is ticked. TRAP T-one-field-one-filter-menu */
      menu.setAttribute('data-select', 'multiple');
      menu.setAttribute('data-clearable', '');
      /* `in` / `notin` are how SEVERAL picks read; the menu's own condition
         stays `eq` / `ne`, because its dropdown offers no "is one of" — the
         ticked list IS the "one of". */
      const op = held?.op ?? col.op ?? DEFAULT_OP;
      menu.setAttribute('data-op', op === 'in' ? 'eq' : op === 'notin' ? 'ne' : op);
      /* The header is rebuilt on every sort and keystroke, so what the reader
         TYPED has to be written back or it is lost. A PROPERTY, replayed after
         upgrade. TRAP T-custom-element-upgrade */
      // An ATTRIBUTE, so the menu's own re-stamp cannot lose it.
      if (held && (OP_TAKES[held.op as FilterOp] ?? 'list') === 'text') {
        menu.setAttribute('data-value', held.value);
      }
      /* NO WALL OF ROWS. A conditions-only column has no list to tick, so
         stamping its 240 values is work nobody sees.
         TRAP T-a-wall-of-values-is-not-a-filter */
      if (kindOf(col) !== 'conditional') this.#addColumnValues(menu, col.field, held);
    }

    // Restore the held clause — the header is rebuilt per sort and keystroke,
    // so the menu would otherwise forget itself.
    if (held) {
      /* THE MENU HOLDS ITS OWN. A number body reads `data-op` and `data-value`;
         only the calendar is still this heading's to fill.
         TRAP T-a-menu-owns-its-own-bodies */
      if (kind === 'number') {
        menu.setAttribute('data-op', held.op);
        if (!held.range) menu.setAttribute('data-value', held.value);
        else {
          menu.setAttribute('data-from', held.from ?? '');
          menu.setAttribute('data-to', held.to ?? '');
        }
      }
      const cal = body?.querySelector('.head-filter-calendar');
      if (cal) {
        if (held.range) {
          cal.setAttribute('data-type', 'range');
          cal.setAttribute('data-value-start', held.from ?? '');
          cal.setAttribute('data-value-end', held.to ?? '');
        } else {
          cal.setAttribute('data-value', held.value);
        }
      }
      chip.setAttribute('data-current', '');
    } else if (kind === 'date' && body) {
      // A fresh RANGE calendar still needs its two-click mode set.
      const cal = body.querySelector('.head-filter-calendar');
      if (cal && menu.hasAttribute('data-range')) cal.setAttribute('data-type', 'range');
    }

    if (body) menu.appendChild(body);
    chip.appendChild(menu);
    chip.setAttribute('aria-label', `Filter ${label}`);
  }

  /**
   * A text column's distinct values, as the filter menu's rows.
   *
   * The filter CHIP over the same field offers exactly this list, so a reader
   * is asked the same question whichever they open.
   * TRAP T-one-field-one-filter-menu
   */
  #addColumnValues(menu: HTMLElement, field: string, held?: ColumnFilter): void {
    const on = new Set(
      held && (OP_TAKES[held.op as FilterOp] ?? 'list') === 'list'
        ? (held.picks ?? (held.value ? [held.value] : []))
        : [],
    );

    // What the ROWS ON SCREEN carry — everything else is unreachable RIGHT NOW.
    const present = new Set(
      this.#rows
        .map((row) => row[field])
        .filter((v) => v != null && v !== '')
        .map((v) => String(v)),
    );

    /* The WHOLE column, when a host supplies it. Building the list from the
       drawn rows alone made every filter a one-way door: narrow on another
       field and three of four owners vanished from the Owner menu, with no way
       to tick them back. TRAP T-unavailable-value-sorts-below-a-divider */
    const declared = this.#columnValues.get(field);
    const values = declared?.length ? [...declared] : [...present].sort();

    /* THE MENU draws its own items from this DATA, choosing the control from
       its own `data-select`. Stamping rows here is what let a column heading
       and a filter chip end up with different markup over the same field.
       TRAP T-one-field-one-filter-menu */
    this.#pendingItems.push([
      menu,
      values.map((value) => ({
        value,
        selected: on.has(value),
        available: present.has(value),
      })),
    ]);
  }

  /** Menus whose items wait for their heading to enter the table. */
  #pendingItems: Array<[HTMLElement, unknown[]]> = [];

  /**
   * Hand each waiting menu its items.
   *
   * A cloned `<sherpa-menu>` upgrades only on entering the page, so an
   * `items()` call made while its heading was detached stamps nothing.
   * TRAP T-custom-element-upgrade
   */
  #flushItems(): void {
    for (const [menu, items] of this.#pendingItems) {
      (menu as HTMLElement & { items?: (i: unknown[]) => void }).items?.(items);
    }
    this.#pendingItems = [];
  }

  /** The WHOLE column's values, by field — see `data-column-values`. */
  #columnValues = new Map<string, string[]>();

  /**
   * Parse `data-column-values`: `field:a|b|c` per entry, newline separated.
   *
   * A pipe inside an entry and a newline between them, because a value may
   * hold a comma or a space — a customer name is exactly that.
   */
  #syncColumnValues(): void {
    this.#columnValues.clear();
    for (const entry of (this.dataset['columnValues'] ?? '').split('\n')) {
      const at = entry.indexOf(':');
      if (at < 1) continue;
      const values = entry.slice(at + 1).split('|').filter(Boolean);
      if (values.length) this.#columnValues.set(entry.slice(0, at), values);
    }
  }

  /**
   * The Range switch. TRAP T-range-switch-swaps-not-rebuilds — an attribute
   * write, never a rebuild, so the other side's typing survives a flip back.
   */
  #onColumnRangeToggle = (event: Event): void => {
    const sw = (event.target as HTMLElement | null)?.closest?.('.head-filter-range-switch');
    if (!sw) return;
    const menu = (sw as HTMLElement).closest('sherpa-menu');
    if (!menu) return;
    const on = (sw as HTMLElement & { checked?: boolean }).checked
      ?? sw.hasAttribute('checked');
    menu.toggleAttribute('data-range', on);
    // The calendar's two shapes are its own `data-type`, not a CSS reveal.
    const cal = menu.querySelector('.head-filter-calendar');
    if (cal) {
      if (on) cal.setAttribute('data-type', 'range');
      else cal.removeAttribute('data-type');
    }
  };

  /** REMOVE FILTER — ends a column's filter. Reported as a clear, so a host has one path. */
  #onColumnFilterRemove = (event: Event): void => {
    if ((event as CustomEvent).detail?.value !== 'remove') return;
    const chip = (event.target as HTMLElement).closest<HTMLElement>('.head-filter');
    if (!chip) return;
    event.stopPropagation();
    chip.querySelector<HTMLElement & { close?: () => void }>('sherpa-menu')?.close?.();
    this.#onColumnFilterCommit(new CustomEvent('menu-clear', { detail: {} , bubbles: false }) as Event, chip);
  };

  /** Swallow a header chip's own events — it is reused for its menu, not its vocabulary. */
  #stopChipEvent = (event: Event): void => {
    if (!(event.target as HTMLElement)?.closest?.('.head-filter, .head-sort')) return;
    event.stopPropagation();
  };

  /**
   * Apply or clear one column's filter, from its menu's footer.
   * TRAP T-grid-reports-never-combines — it records and reports, never filters.
   */
  #onColumnFilterCommit = (event: Event, explicit?: HTMLElement): void => {
    // `explicit` is for Remove, whose synthetic event has no target in the tree.
    const chip = explicit ?? (event.target as HTMLElement).closest<HTMLElement>('.head-filter');
    const field = chip?.closest<HTMLElement>('.head-cell')?.dataset['field'];
    if (!chip || !field) return;

    const cleared = event.type === 'menu-clear';
    const held = cleared ? null : this.#readColumnFilter(chip, field);

    if (held) {
      this.#columnFilters.set(field, held);
      chip.setAttribute('data-current', '');
    } else {
      this.#columnFilters.delete(field);
      chip.removeAttribute('data-current');
      // Only an explicit CLEAR empties the controls: Apply lands here on a
      // half-built range, which is unfinished, not wrong.
      if (cleared) {
        /* The shared filter menu keeps its typed value in an ATTRIBUTE, which
           is the whole reason it survives a re-stamp — so clearing has to
           reach that, not only the boxes. TRAP T-one-field-one-filter-menu */
        const fm = chip.querySelector('sherpa-menu');
        if (fm?.getAttribute('data-type') === 'filter') {
          fm.setAttribute('data-value', '');
          // The MENU owns its rows; `values = []` unticks every one.
          (fm as HTMLElement & { values?: string[] }).values = [];
        }
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
      // Ready for a DataSource — the <option> values ARE store FilterOps.
      // TRAP T-grid-number-clause-must-coerce.
      clause: held ? this.#columnClause(field, held, col?.type) : null,
      // What a toolbar chip shows: "Contains: ana". The field half is `header`.
      label: held ? this.#columnFilterLabel(held) : null,
    });
  };

  /**
   * Read one column's menu into a clause. TRAP T-grid-empty-clause-is-null — an
   * empty value says nothing, and a range needs both ends.
   */
  #readColumnFilter(chip: HTMLElement, field = ''): ColumnFilter | null {
    const menu = chip.querySelector('sherpa-menu');
    const range = menu?.hasAttribute('data-range') ?? false;
    /* The condition lives in the MENU for a TEXT column — it is the shared
       filter menu now — and in the cloned body for number and date. `menu.op`
       answers `eq` for any menu, so only a FILTER menu may be asked.
       TRAP T-one-field-one-filter-menu */
    const isFilterMenu = menu?.getAttribute('data-type') === 'filter';
    /* THE MENU ANSWERS FOR ITS OWN BODY. A number body carries the operator
       select and the value; only the calendar is still slotted here.
       TRAP T-a-menu-owns-its-own-bodies */
    const own = menu as (HTMLElement & { op?: string; values?: string[] }) | null;
    const op = own?.op ?? DEFAULT_OP;
    const cal = chip.querySelector<HTMLElement>('.head-filter-calendar');

    if (range) {
      // A calendar reports its span in data-*; a number body reports both ends.
      const both = cal
        ? [cal.dataset['valueStart'] ?? '', cal.dataset['valueEnd'] ?? '']
        : (own?.values ?? []);
      const from = String(both[0] ?? '').trim();
      const to = String(both[1] ?? '').trim();
      if (!from || !to) return null;
      return { op: 'between', value: '', range: true, from, to };
    }

    /* A LIST condition is answered by the TICKED ROWS, a typing one by the
       menu's own box. TRAP T-an-operator-decides-pick-or-type */
    if (!cal && isFilterMenu) {
      if ((OP_TAKES[op as FilterOp] ?? 'list') === 'text') {
        const typed = (menu as HTMLElement & { conditionValue?: string })
          .conditionValue ?? '';
        return typed.trim() ? { op, value: typed.trim() } : null;
      }
      /* ASK THE MENU. It owns its rows, so reading them here would be a
         second answer to "what is ticked". TRAP T-one-field-one-filter-menu */
      const picks = [...((menu as HTMLElement & { values?: string[] }).values ?? [])];
      /* ONE rule for picks → a clause: one is `eq`, several are `in`, because
         `eq` against a list can never match. In store.ts, beside the grammar. */
      const clause = picksClause(field, picks, op as FilterOp);
      if (!clause) return null;
      const [, clauseOp, value] = clause;
      return Array.isArray(value)
        ? { op: clauseOp, value: '', picks: value.map(String) }
        : { op: clauseOp, value: String(value) };
    }

    // A DATE column has no condition picker, so the operator is equality.
    const value = (cal ? cal.dataset['value'] : (own?.values ?? [])[0]) ?? '';
    if (!value.trim()) return null;
    return { op: cal ? 'eq' : op, value: value.trim() };
  }

  /**
   * One column filter as a store FilterClause. TRAP
   * T-grid-number-clause-must-coerce — a blank end is left as typed.
   */
  #columnClause(field: string, held: ColumnFilter, type?: string): unknown[] {
    /* THE DATA LAYER BUILDS IT. This column menu holds its own facts — it is
       not the source's selection — so it hands over a READING and gets the
       clause back. The casting, the range and the picks-to-`in` rule all live
       once. TRAP T-the-field-type-decides-the-clause */
    const facts = { field, ...(type ? { type: type as FieldType } : {}) };
    const clause = readingClause(facts, this.#columnReading(held));
    /* A column filter is SET, so it always says something — `stateClause`
       returns nothing only for a reading nobody answered. */
    return (clause as unknown[]) ?? [field, held.op, held.value];
  }

  /** One column's filter as a reading — what a reader gave, not a query. */
  #columnReading(held: ColumnFilter): FieldReading {
    const op = held.op as FilterOp;
    if (held.range) {
      return { op, range: true, picked: [held.from ?? '', held.to ?? ''] };
    }
    if ((OP_TAKES[op] ?? 'list') === 'text') return { op, text: held.value };
    // SEVERAL ticked values ride as a list, which is what `in` / `notin` take.
    return { op, range: false, picked: held.picks ?? [held.value] };
  }

  /** One column filter as a chip reads it — "Contains: ana", "Between: 10 - 20". */
  #columnFilterLabel(held: ColumnFilter): string {
    const name = OP_LABELS[held.op as keyof typeof OP_LABELS] ?? held.op;
    if (held.range) return `${name}: ${held.from} - ${held.to}`;
    // A COUNT, not a list: "Is one of: 4" beats a chip that runs off the bar.
    if (held.picks) {
      return held.picks.length === 1
        ? `${name}: ${held.picks[0]}`
        : `${name}: ${held.picks.length}`;
    }
    return `${name}: ${held.value}`;
  }

  /**
   * Set one column's filter from OUTSIDE. TRAP
   * T-grid-read-without-write-is-half-an-api — SILENT, and takes the clause
   * `column-filter-change` reports.
   */
  setColumnFilter(field: string, clause: unknown[] | null): void {
    if (!clause) {
      this.clearColumnFilter(field);
      return;
    }

    const [, op, value] = clause as [string, string, unknown];
    let held: ColumnFilter;
    if (op === 'between' && Array.isArray(value)) {
      held = { op, value: '', range: true, from: String(value[0] ?? ''), to: String(value[1] ?? '') };
    } else if (Array.isArray(value)) {
      // SEVERAL values: the ticked rows of a list condition.
      held = { op, value: '', picks: value.map((v) => String(v)) };
    } else {
      held = { op, value: String(value ?? '') };
    }

    // Nothing to filter by is not a filter — as the menu's own commit says.
    const empty = held.range
      ? !held.from || !held.to
      : held.picks ? !held.picks.length : !held.value;
    if (empty) {
      this.clearColumnFilter(field);
      return;
    }

    this.#columnFilters.set(field, held);
    // The HEADER is rebuilt, not reached into: one path writes a menu.
    this.#renderHead();
    this.#syncColumnFilterStatus();
    this.#renderBody();
  }

  /**
   * One column's filter as a ready FilterClause, or null. TRAP
   * T-grid-suspend-is-not-clear — a SUSPENDED clause is returned too.
   */
  columnClause(field: string): unknown[] | null {
    const held = this.#columnFilters.get(field);
    if (!held) return null;
    const col = this.#columns.find((c) => c.field === field);
    return this.#columnClause(field, held, col?.type);
  }

  /**
   * One column filter AS A READER SEES IT — "Contains: ana", "Is not: churned".
   *
   * The clause was readable and its wording was not, so a host restoring a
   * saved view could apply a column filter and had nothing to put on a chip:
   * the grid narrowed and the toolbar said nothing. `column-filter-change`
   * carries this same string, so an interaction and a restore now describe a
   * filter identically.
   * TRAP T-grid-read-without-write-is-half-an-api
   * TRAP T-a-restored-filter-still-needs-its-chip
   */
  columnLabel(field: string): string | null {
    const held = this.#columnFilters.get(field);
    return held ? this.#columnFilterLabel(held) : null;
  }

  /** Suspend or resume, never lose. TRAP T-grid-suspend-is-not-clear. */
  suspendColumnFilter(field: string, suspended = true): void {
    const held = this.#columnFilters.get(field);
    if (!held || !!held.suspended === suspended) return;
    this.#columnFilters.set(field, { ...held, suspended });
    this.#syncColumnFilterStatus();
    // The MATCH MARKS go too: a suspended filter hides no rows, so marking what
    // would have matched claims something untrue.
    this.#renderBody();
  }

  /**
   * Open one column's filter menu, anchored where the caller says. TRAP
   * T-grid-toolbar-chip-borrows-the-menu — one menu serves both.
   */
  openColumnFilter(field: string, anchor?: HTMLElement): void {
    const chip = this.$<HTMLElement>(
      `.head-cell[data-field="${CSS.escape(field)}"] .head-filter`,
    );
    /* Ask the CHIP, not its menu: the chip owns the light-dismiss-safe open, and
       reaching past it to `menu.toggle()` brought the stuck-open bug back
       through this door. The anchor still travels — a toolbar chip borrows this
       menu and must see it over ITSELF.
       TRAP T-a-trigger-click-follows-light-dismiss · T-grid-toolbar-chip-borrows-the-menu */
    (chip as (HTMLElement & { toggleMenu?: (a?: HTMLElement) => void }) | null)
      ?.toggleMenu?.(anchor);
  }

  /**
   * Drop one column's heading filter from OUTSIDE; nothing drops them all.
   * TRAP T-grid-clear-from-outside-is-silent.
   */
  clearColumnFilter(field?: string): void {
    if (field) {
      if (!this.#columnFilters.delete(field)) return;
    } else {
      if (!this.#columnFilters.size) return;
      this.#columnFilters.clear();
    }
    // Rebuilt, not reached into — #renderHead restores each menu from the map.
    this.#renderHead();
    this.#syncColumnFilterStatus();
    this.#renderBody();
  }

  /**
   * Turn one column's FILTER CHIP on or off. THE CHIP IS THE SIGNAL — the
   * heading is deliberately not tinted, and `#isFiltered` knows the whole
   * answer, a filter arriving through the QUERY included. The chip is
   * `data-locked`, so the GRID owns its on-state.
   * TRAP T-the-column-chip-is-the-only-signal.
   */
  #lightFilterChip(th: HTMLElement, field: string): void {
    const chip = th.querySelector<HTMLElement>('.head-filter');
    if (!chip) return;
    chip.toggleAttribute('data-current', this.#isFiltered(field));
    /* THE GLYPH SAYS WHICH KIND. A column answered by a CONDITION — "contains",
       "starts with" — wears the `fx` mark the chips and the panel already use,
       so a reader can tell a typed rule from a ticked list without opening it.
       An icon-only chip falls back to its funnel when no icon is named.
       TRAP T-a-condition-badge-says-that-not-which */
    const held = this.#columnFilters.get(field);
    const typed = !!held && !held.range
      && (OP_TAKES[held.op as FilterOp] ?? 'list') === 'text';
    if (typed) chip.setAttribute('data-icon-start', CONDITION_ICON);
    else chip.removeAttribute('data-icon-start');
    /* THE COLOUR SAYS IT TOO. The glyph alone left the chip in the plain active
       purple, so a column answered by a condition looked like one answered by
       a ticked list. Written from the SAME `typed`, so the two can never
       disagree. TRAP T-a-conditioned-chip-reads-as-info
       TRAP T-a-custom-chip-caret-must-open-its-condition */
    chip.toggleAttribute('data-conditioned', typed);
  }

  /** Re-light every heading without rebuilding the header row. */
  #syncColumnFilterStatus(): void {
    for (const cell of this.$$('.head-cell')) {
      const th = cell as HTMLElement;
      const field = th.dataset['field'];
      if (!field) continue;
      const lit = th.hasAttribute('data-sort') || this.#isFiltered(field);
      if (lit) th.dataset['status'] = 'active';
      else delete th.dataset['status'];
      this.#lightFilterChip(th, field);
    }
  }

  /** Stamp one filter input per column into the secondary header row. */
  #renderFilterRow(): void {
    const filterRow = this.$('.filter-row');
    const tpl = this.$<HTMLTemplateElement>('template.filter-cell-tpl');
    if (!filterRow || !tpl) return;

    // Keep the fixed leading spacer <th>; rebuild only the dynamic filter cells.
    filterRow.querySelectorAll('.filter-cell').forEach((el) => el.remove());
    const actionsSpacer = filterRow.querySelector('.actions-cell');
    this.#shownColumns().forEach((col, i) => {
      const th = tpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
      this.upgradeClonedIcons(th);
      th.dataset['field'] = col.field;
      if (col.type) th.dataset['type'] = col.type;
      if (i === 0) this.#markPinned(th, true);
      const label = col.header ?? col.field;
      const input = th.querySelector<HTMLInputElement>('.filter-input')!;
      input.placeholder = `Filter ${label}`;
      // No visible <label>, and the placeholder goes once the user types.
      input.setAttribute('aria-label', `Filter ${label}`);
      th.querySelector('.filter-clear')!.setAttribute('aria-label', `Clear ${label} filter`);
      if (this.#filters.has(col.field)) {
        input.value = this.#filters.get(col.field) ?? '';
        th.toggleAttribute('data-has-value', true);
      }
      filterRow.appendChild(th);
    });
    if (actionsSpacer) filterRow.appendChild(actionsSpacer);
  }

  /**
   * The columns the table draws. The grouped one is dropped — its value IS the
   * group heading — but `#columns` stays intact, so un-grouping needs no populate.
   */
  #shownColumns(): GridColumn[] {
    const group = this.dataset['groupField'];
    if (!group) return this.#columns;
    return this.#columns.filter((c) => c.field !== group);
  }

  /** Draw the rows — with a group heading at each change, when grouped. */
  #renderBody(): void {
    const body = this.$('.body');
    const rowTpl = this.$<HTMLTemplateElement>('template.row-tpl');
    const cellTpl = this.$<HTMLTemplateElement>('template.cell-tpl');
    if (!body || !rowTpl || !cellTpl) return;

    const group = this.dataset['groupField'];
    const columns = this.#shownColumns();
    body.replaceChildren();

    // Each <tr>'s index is its place in the FILTERED, SORTED list, so row-click
    // and selection-change name the row the user sees.
    const all = this.#visibleRows();
    // …then cut to ONE SCREEN PAGE when grouped. `offset` keeps data-index
    // honest across the cut. TRAP T-grid-collapsed-group-is-one-slot.
    const { rows, offset, pages } = this.#pageWindow(all);
    let lastGroup: string | null = null;

    rows.forEach((record, i) => {
      if (group) {
        const value = record[group];
        const key = value == null ? '' : String(value);
        if (key !== lastGroup) {
          lastGroup = key;
          // The COUNT spans every page, so a group split by a boundary still
          // says how many rows it holds.
          body.appendChild(this.#groupRow(key, this.#groupSize(all, group, key), columns.length));
        }
      }

      const tr = rowTpl.content.firstElementChild!.cloneNode(true) as HTMLElement;

      // Cloned from a prototype, so its icons are still bare <i>.
      // TRAP T-a-cloned-prototype-needs-its-icons-upgraded
      this.upgradeClonedIcons(tr);
      tr.dataset['index'] = String(offset + i);
      // BOTH boxes are stamped; CSS shows one. TRAP T-compose-never-reimplement.
      // The radio needs the shared per-grid NAME that unpicks the previous row.
      const radio = tr.querySelector<SelectBox>('.row-one');
      if (radio) radio.setAttribute('name', this.#selectName);
      for (const box of tr.querySelectorAll<SelectBox>('.row-select')) {
        box.checked = this.#selected.has(record);
      }
      // Its group, so CSS hides it when that group is shut — no `display` write.
      if (group && lastGroup !== null) tr.dataset['groupKey'] = lastGroup;
      columns.forEach((col, c) => {
        const td = cellTpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
        this.upgradeClonedIcons(td);
        if (col.type) td.dataset['type'] = col.type;
        if (c === 0) this.#markPinned(td, true);
        const value = record[col.field];
        this.#fillCell(td, value == null ? '' : String(value), col);
        tr.appendChild(td);
      });
      /* The actions cell is in the template already, so it is MOVED, not
         created — appendChild on an existing child re-parents it to the end. */
      const actionsCell = tr.querySelector('.actions-cell');
      if (actionsCell) tr.appendChild(actionsCell);
      body.appendChild(tr);
    });

    if (group) this.#syncGroupVisibility();
    // Folding changes how many pages there ARE. After the draw, so a host that
    // re-renders finds the DOM settled.
    this.#reportPages(pages);
  }

  /**
   * Write one cell's text, marking what a TEXT filter matched. TRAP
   * T-grid-mark-is-substring-only — substring ops only, and the CELL's casing wins.
   */
  #fillCell(td: HTMLElement, text: string, col: GridColumn): void {
    if ((col.type ?? 'text') !== 'text') {
      td.textContent = text;
      return;
    }
    const held = this.#columnFilters.get(col.field);
    if (held && !held.range && !held.suspended) {
      markNeedle(td, text, held.value, held.op);
      return;
    }
    /* A toolbar chip's condition reaches here through `data-needles`, because
       the grid cannot see the bar that holds it. Without this a chip filtering
       "Contains Ravi" narrowed the rows and marked nothing.
       TRAP T-a-needle-comes-from-either-direction */
    const outside = this.#needles.get(col.field);
    if (outside) {
      markNeedle(td, text, outside.value, outside.op);
      return;
    }
    td.textContent = text;
  }

  /** Needles from OUTSIDE, by field — see `data-needles`. */
  #needles = new Map<string, { op: string; value: string }>();

  /**
   * Parse `data-needles`: `field:op:value` per entry, newline separated.
   *
   * A newline, because a value may hold a comma or a space and a filter the
   * reader typed is exactly where that happens.
   */
  #syncNeedles(): void {
    this.#needles.clear();
    for (const entry of (this.dataset['needles'] ?? '').split('\n')) {
      const at = entry.indexOf(':');
      if (at < 1) continue;
      const rest = entry.slice(at + 1);
      const opAt = rest.indexOf(':');
      if (opAt < 1) continue;
      this.#needles.set(entry.slice(0, at), {
        op: rest.slice(0, opAt), value: rest.slice(opAt + 1),
      });
    }
  }

  // TRAP T-grid-thead-sticks-as-one-block — no sticky-offset measurement here.

  /** The groups the data layer named, by key. Null until it names them. */
  #groups: GroupSummary[] | null = null;

  /** Every group in force, as the data layer counted them. */
  get groups(): GroupSummary[] {
    return this.#groups ? this.#groups.map((g) => ({ ...g })) : [];
  }

  /**
   * How many rows share one group value.
   *
   * THE DATA LAYER'S COUNT where it gave one: this grid may hold a page, so
   * its own tally is a page tally. The fallback is for a grid populated by
   * hand, with no source behind it.
   * TRAP T-a-group-is-a-data-layer-concept
   */
  #groupSize(rows: GridRow[], field: string, key: string): number {
    const told = this.#groups?.find((g) => g.key === key);
    if (told) return told.count;
    return rows.filter((r) => String(r[field] ?? '') === key).length;
  }

  /* ── Visual paging ──────────────────────────────────────────────────
   * TRAP T-grid-collapsed-group-is-one-slot — a SHUT group is one line, so it
   * costs one line of the page. The store counts RECORDS and cannot know that.
   * Ungrouped these do nothing: the store's window IS the page.
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
   * Cut the visible rows into pages of `size` SCREEN LINES, returning each
   * page's start index, so a page stays a plain slice. A heading is one line; a
   * shut group costs only that. An OPEN group longer than a page IS split.
   */
  #pageStarts(rows: GridRow[], field: string, size: number): number[] {
    const starts: number[] = [0];
    let slots = 0;
    let lastGroup: string | null = null;

    for (let i = 0; i < rows.length; i += 1) {
      const key = String(rows[i]![field] ?? '');
      const opensGroup = key !== lastGroup;
      const collapsed = this.#collapsed.has(key);
      // A shut group's ROWS are drawn but hidden, so they cost nothing.
      const cost = (opensGroup ? 1 : 0) + (collapsed ? 0 : 1);

      // A heading on a page's last slot still starts the page — the next page
      // redraws it anyway.
      if (cost > 0 && slots + cost > size && slots > 0) {
        starts.push(i);
        slots = 0;
        lastGroup = null;
        // Re-cost against the fresh page: this row now OPENS its group.
        slots += 1 + (collapsed ? 0 : 1);
        lastGroup = key;
        continue;
      }

      slots += cost;
      lastGroup = key;
    }

    return starts;
  }

  /** The page's rows plus their offset, so data-index stays TRUE after a slice. */
  #pageWindow(rows: GridRow[]): { rows: GridRow[]; offset: number; pages: number } {
    const field = this.dataset['groupField'];
    const size = this.#pageSize;
    if (!field || size <= 0) return { rows, offset: 0, pages: 1 };

    const starts = this.#pageStarts(rows, field, size);
    const pages = starts.length;
    // CLAMP, never empty: a shut group can shrink the count under the host's page.
    const index = Math.min(Math.max(this.#page, 1), pages) - 1;
    const from = starts[index]!;
    const to = starts[index + 1] ?? rows.length;
    return { rows: rows.slice(from, to), offset: from, pages };
  }

  /**
   * Tell the host how many pages the CURRENT fold state makes. Re-derived on
   * every render, never cached — folding adds and removes pages.
   *
   * TRAP T-grid-reports-never-combines — a REPORT; the grid never writes its
   * own data-page.
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
    tr.dataset['groupKey'] = key;
    const collapsed = this.#collapsed.has(key);
    // CSS draws the chevron rotation and hides the group's rows off this flag.
    tr.toggleAttribute('data-collapsed', collapsed);

    const cell = tr.querySelector<HTMLTableCellElement>('.group-cell')!;
    /* +1 for the leading selection column, which exists whether or not
       data-selectable reveals it; +1 again for the trailing actions column when
       shown. A short colspan leaves the pinned cell floating over a gap. */
    cell.colSpan = columnCount + 1 + (this.#actions.length ? 1 : 0);
    tr.querySelector('.group-label')!.textContent = key === '' ? '(none)' : key;
    tr.querySelector('.group-count')!.textContent = String(size);

    const toggle = tr.querySelector('.group-toggle')!;
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.setAttribute('aria-label', `${collapsed ? 'Expand' : 'Collapse'} ${key || 'ungrouped'}`);
    return tr;
  }

  /* ── Row actions ─────────────────────────────────────────────────── */

  /** A click inside the body: was it an actions trigger? */
  #onActionsClick = (event: Event): void => {
    const trigger = (event.target as HTMLElement).closest<HTMLElement>('.actions-trigger');
    if (!trigger) return;
    // `#onRowClick` ignores this cell already; this stops the click reaching a
    // HOST listener, which has no such guard.
    event.stopPropagation();
    this.#openActions(trigger);
  };

  /**
   * Open the shared actions menu for one row. TRAP
   * T-one-actions-menu-for-every-row — one popover, re-stamped on each open.
   */
  #openActions(trigger: HTMLElement): void {
    const record = this.#recordFor(trigger);
    if (!record || !this.#actions.length) return;
    const menu = this.$<HTMLElement & { show?: (t?: HTMLElement) => void }>('.actions-menu');
    const tpl = this.$<HTMLTemplateElement>('template.action-item-tpl');
    if (!menu || !tpl) return;

    this.#actionRow = record;
    // SLOTTED light-DOM buttons, which is what gives them Enter, Space and
    // focus for nothing — T-menu-rows-stay-native-controls.
    menu.replaceChildren();
    for (const action of this.#actions) {
      const item = tpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
      this.upgradeClonedIcons(item);
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
   * A menu row was chosen. REPORTS, never acts — deleting a record is the
   * host's decision. TRAP T-grid-reports-never-combines.
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
   * The actions for the CURRENT selection — one row: all; two or more: only
   * `multi`. TRAP T-grid-actions-are-declared-once-used-twice.
   */
  actionsFor(count: number): GridAction[] {
    if (count <= 0) return [];
    return count === 1 ? [...this.#actions] : this.#actions.filter((a) => a.multi);
  }

  /**
   * The rows on screen: filtered, then sorted. Anything mapping a row INDEX
   * back to a record must use this — data-index is a position in THIS list.
   */
  #visibleRows(): GridRow[] {
    return this.#sortRows(this.#filteredRows());
  }

  /**
   * Rows matching EVERY filter-row box. TRAP
   * T-grid-filter-row-uses-store-filterrows — a real clause tree, never a hand-rolled match.
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
   * Order the rows through the STORE's `sortRows`. TRAP
   * T-one-collator-for-the-library. GROUP leads, so groups stay adjacent.
   */
  #sortRows(rows: GridRow[]): GridRow[] {
    // SUSPENDED: the column is remembered, the sort is not applied — an empty
    // direction is what says so. TRAP T-a-suspended-sort-is-one-owners-job.
    const field = this.dataset['sortDirection'] === '' ? undefined : this.dataset['sortField'];
    const group = this.dataset['groupField'];
    if (!field && !group) return rows;
    /* The shared reader, not a second spelling of it. `?? 'asc'` is the
       DEFAULT for a column with no direction yet; the suspend is handled on
       the line above, where the empty string drops the field.
       TRAP T-one-cycle-for-one-value */
    const direction: SortDirection =
      sortDirectionFrom(this.dataset['sortDirection']) ?? 'asc';

    const specs: SortSpec[] = [];
    if (group) specs.push({ field: group, direction: group === field ? direction : 'asc' });
    if (field && field !== group) specs.push({ field, direction });
    return sortRows(rows, specs) as GridRow[];
  }

  /* ── Interaction ────────────────────────────────────────────────── */

  /** Eat exactly one click — the one a finished resize drag synthesises. */
  #swallowClick = false;

  /** A heading was clicked: cycle its sort — unless a resize just ended. */
  #onHeaderClick = (event: Event): void => {
    // A RESIZE just ended and the browser is synthesising its click.
    if (this.#swallowClick) {
      this.#swallowClick = false;
      event.stopPropagation();
      event.preventDefault();
      return;
    }
    // The FILTER button is in the heading, so its click reaches here. The chip
    // handles its own.
    if ((event.target as HTMLElement).closest('.head-filter')) return;
    // The SORT chip carries no menu, so its click falls through to the cycle.
    const th = (event.target as HTMLElement).closest<HTMLElement>('.head-cell');
    const field = th?.dataset['field'];
    if (!field || th!.dataset['sortable'] === 'false') return;

    /* ONE CYCLE, stated in `core/cycle.ts` — asc → desc → suspended → asc. The
       third step KEEPS the column: `sort-change` carries `field: null` because
       the QUERY loses its sort, while the field survives to resume on.
       TRAP T-grid-sort-is-tri-state, TRAP T-a-chip-body-cycles-its-states,
       TRAP T-one-cycle-for-one-value. */
    const next = nextSort(field, this.dataset['sortField'], sortDirectionFrom(this.dataset['sortDirection']));

    /* REPORT, then let the owner write it back. A BOUND grid is `data-locked`;
       UNBOUND there is no owner but this, so it writes only when nothing else
       will. TRAP T-bind-locks-what-it-owns. */
    if (!this.hasAttribute('data-locked')) {
      this.set('data-sort-field', next.field ?? null);
      this.set('data-sort-direction', sortDirectionAttr(next) ?? null);
      this.#render();
    }

    // The INTENT, always. `field: null` on a suspend is what the query hears;
    // the source remembers the column.
    this.emit('sort-change', {
      field: next.direction === null ? null : next.field,
      direction: next.direction,
    });
  };

  /** A row was clicked: report it — unless it was the select box or the actions. */
  #onRowClick = (event: Event): void => {
    // A click on a selection checkbox is selection, not row activation.
    if ((event.target as HTMLElement).closest('.select-cell')) return;
    /* …and a click in the ACTIONS cell is the menu. Guarded HERE, not by
       stopPropagation there: both listeners sit on `.body` and fire in
       REGISTRATION order, so stopping it later is too late. */
    if ((event.target as HTMLElement).closest('.actions-cell')) return;

    // A group row is a heading, not a record: clicking it anywhere folds it.
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
    // Resolve against the VISIBLE list — data-index is a position in that list.
    const record = this.#visibleRows()[index];
    // FOCUSED: the last row clicked, remembered so a re-render re-applies it.
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

  /** Fold a group. `#collapsed` remembers it across the next body rebuild. */
  #toggleGroup(groupRow: HTMLElement): void {
    const key = groupRow.dataset['groupKey'] ?? '';
    const collapsed = !groupRow.hasAttribute('data-collapsed');
    groupRow.toggleAttribute('data-collapsed', collapsed);
    if (collapsed) this.#collapsed.add(key);
    else this.#collapsed.delete(key);

    const toggle = groupRow.querySelector('.group-toggle');
    toggle?.setAttribute('aria-expanded', String(!collapsed));
    toggle?.setAttribute('aria-label', `${collapsed ? 'Expand' : 'Collapse'} ${key || 'ungrouped'}`);

    // A sibling selector cannot reach past a group row, so each row carries its
    // own shut/open flag.
    this.#syncGroupVisibility();

    // WHEN THE GRID PAGES, FOLDING CHANGES WHAT IS ON THE PAGE: shutting a
    // group frees slots, so rows move up. A visibility sync leaves a hole.
    // TRAP T-grid-collapsed-group-is-one-slot.
    if (this.#paginates) {
      this.#renderBody();
      // The body was replaced, so re-derive from #selected.
      this.#syncSelectAll();
      this.#syncGroupSelects();
      this.#syncFocused();
    }

    this.emit('group-toggle', { value: key, collapsed });
  }

  /** Mark every row whose group is collapsed; CSS hides them. */
  #syncGroupVisibility(): void {
    for (const row of this.$$<HTMLElement>('.row')) {
      const key = row.dataset['groupKey'];
      row.toggleAttribute('data-hidden', key != null && this.#collapsed.has(key));
    }
  }

  /* ── Column resize ──────────────────────────────────────────────── */

  /** A drag in flight — one object, so a stray pointermove has one thing to test. */
  #drag: { field: string; startX: number; startWidth: number } | null = null;

  /** A resize grip was grabbed: start the drag. */
  #onGripDown = (event: PointerEvent): void => {
    const grip = (event.target as HTMLElement | null)?.closest?.('.resize-grip');
    if (!grip) return;
    const th = grip.closest<HTMLElement>('.head-cell');
    const field = th?.dataset['field'];
    if (!field) return;

    // TRAP T-grid-grip-captures-the-pointer — neither of these stops the
    // synthetic click (#onGripUp does); capture holds a fast drag.
    event.preventDefault();
    event.stopPropagation();

    const startWidth = th!.getBoundingClientRect().width;
    this.#drag = { field, startX: event.clientX, startWidth };
    this.toggleAttribute('data-resizing', true);

    (grip as HTMLElement).setPointerCapture(event.pointerId);
    grip.addEventListener('pointermove', this.#onGripMove as EventListener);
    grip.addEventListener('pointerup', this.#onGripUp as EventListener, { once: true });
    grip.addEventListener('pointercancel', this.#onGripUp as EventListener, { once: true });
  };

  /** Dragging a grip: size the column live. */
  #onGripMove = (event: PointerEvent): void => {
    if (!this.#drag) return;
    const { field, startX, startWidth } = this.#drag;
    const next = this.#clampWidth(startWidth + (event.clientX - startX));
    this.#widths.set(field, next);
    // Write the <col> DIRECTLY: a #render() per pointermove rebuilds the body
    // 60x/s, and a width changes only the colgroup.
    const col = this.$<HTMLElement>(`.cols > .col[data-field="${CSS.escape(field)}"]`);
    if (col) col.style.width = `${next}px`;
  };

  /** The grip was let go: keep the width and report it. */
  #onGripUp = (event: PointerEvent): void => {
    const drag = this.#drag;
    this.#drag = null;
    this.toggleAttribute('data-resizing', false);

    // Swallow the click the browser is about to synthesise on this pointerup.
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
    // The frozen column's offset is MEASURED, so a resize moves the later pins.
    this.#syncPinned();
    this.emit('column-resize', { field: drag.field, width: this.#widths.get(drag.field) });
  };

  /* ── Selection ──────────────────────────────────────────────────── */

  /** Header select-all: set every row checkbox to match, then broadcast. */
  #onSelectAll = (event: Event): void => {
    const checked = (event.target as SelectBox).checked;
    // Only the VISIBLE rows: a select-all neither reaches nor deselects records
    // a filter is hiding.
    for (const record of this.#visibleRows()) {
      if (checked) this.#selected.add(record);
      else this.#selected.delete(record);
    }
    // Unticking the header box is a CLEAR, so the off-page keys go with it.
    if (!checked) this.#wantedKeys = null;
    // BOTH boxes on purpose — a write, not a count. CSS decides which shows.
    this.$$<SelectBox>('.row-select').forEach((box) => (box.checked = checked));
    this.#syncGroupSelects();
    this.#emitSelection();
  };

  /** A single row checkbox toggled: reconcile the select-all state, broadcast. */
  #onRowSelect = (event: Event): void => {
    const target = event.target as HTMLElement;

    // A GROUP checkbox is the select-all for the rows it heads.
    if (target.classList.contains('group-select')) {
      this.#selectGroup(target as SelectBox);
      return;
    }

    if (!target.classList.contains('row-select')) return;
    // Record the choice against the RECORD, so it survives the next re-render.
    const record = this.#recordFor(target);
    if (record) {
      // SINGLE mode holds one, and the GRID enforces it: the radios share a
      // `name` but each sits in its own shadow root, so the browser sees one
      // group per row. TRAP T-radios-in-shadow-roots-are-not-one-group.
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
    this.#syncGroupSelects();
    this.#emitSelection();
  };

  /**
   * The SHOWN selection box — the checkbox, or the radio in single mode. Every
   * row stamps BOTH, so `.row-select` matches two per row: anything that COUNTS
   * or READS must ask for the visible one.
   * TRAP T-a-row-holds-two-selection-boxes.
   */
  #rowBox(row: Element): SelectBox | null {
    return row.querySelector<SelectBox>(this.#single ? '.row-one' : '.row-multi');
  }

  /** Every SHOWN row box, in row order. */
  #rowBoxes(): SelectBox[] {
    return this.$$<SelectBox>(this.#single ? '.row-one' : '.row-multi');
  }

  /** The record a row control belongs to, resolved through the VISIBLE list. */
  #recordFor(el: HTMLElement): GridRow | undefined {
    const raw = el.closest<HTMLElement>('.row')?.dataset['index'];
    if (raw == null) return undefined;
    return this.#visibleRows()[Number(raw)];
  }

  /** Set every row in one group to match its group checkbox, then broadcast. */
  #selectGroup(box: SelectBox): void {
    const key = box.closest<HTMLElement>('.group-row')?.dataset['groupKey'];
    if (key == null) return;
    for (const row of this.$$<HTMLElement>('.row')) {
      if (row.dataset['groupKey'] !== key) continue;
      const rowBox = this.#rowBox(row);
      if (rowBox) rowBox.checked = box.checked;
      const record = this.#recordFor(row);
      if (!record) continue;
      if (box.checked) this.#selected.add(record);
      else this.#selected.delete(record);
    }
    this.#syncSelectAll();
    this.#emitSelection();
  }

  /** Reflect all/none/indeterminate on each group checkbox. */
  #syncGroupSelects(): void {
    for (const groupRow of this.$$<HTMLElement>('.group-row')) {
      const key = groupRow.dataset['groupKey'];
      const box = groupRow.querySelector<SelectBox>('.group-select');
      if (!box || key == null) continue;
      const rows = this.$$<HTMLElement>('.row').filter((r) => r.dataset['groupKey'] === key);
      const checked = rows.filter((r) => this.#rowBox(r)?.checked).length;
      box.checked = checked > 0 && checked === rows.length;
      box.indeterminate = checked > 0 && checked < rows.length;
    }
  }

  /**
   * A selection scenario from the header's advanced checkbox. `page` and `all`
   * differ only while paging. TRAP T-select-all-is-the-visible-rows — neither
   * reaches a record a filter hides, which the reader could not undo.
   */
  #onScenario = (event: CustomEvent): void => {
    const value = event.detail?.['value'] as string | undefined;
    if (!value) return;

    if (value === 'none') {
      this.#selected.clear();
      // "Clear" means EVERYTHING, other pages included — without this the merge
      // in `#rememberSelection` hands every off-page key back.
      // TRAP T-selection-lives-in-the-keys-not-the-objects.
      this.#wantedKeys = null;
    } else {
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
    const all = this.#rowBoxes();
    const selectAll = this.$<SelectBox>('.select-all');
    if (!selectAll) return;
    const checked = all.filter((b) => b.checked).length;
    selectAll.checked = checked > 0 && checked === all.length;
    selectAll.indeterminate = checked > 0 && checked < all.length;
  }

  /**
   * Write the selection back to `#wantedKeys` — the half that SURVIVES a page
   * change, which replaces every record OBJECT. MERGED, not replaced: a record
   * chosen on page 1 is absent from `#rows` while page 2 is up.
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
    // BEFORE the event: a listener reading `selectedKeys` must see this choice.
    this.#rememberSelection();
    const selected = this.#rowBoxes()
      .filter((box) => box.checked)
      .map((box) => box.closest<HTMLElement>('.row')?.dataset['index'] ?? '')
      .filter((id) => id !== '');
    // `records` is the durable answer: an index is a position in the VISIBLE
    // list, and cannot name a record a filter hides.
    this.emit('selection-change', { selected, records: this.selectedRecords });
  }

  /** The selected RECORDS, filter-hidden ones included, in original row order. */
  get selectedRecords(): GridRow[] {
    return this.#rows.filter((r) => this.#selected.has(r));
  }

  /**
   * The selected rows as KEYS — savable, unlike indices. TRAP
   * T-grid-key-or-position-lies — EMPTY without a `key` in `populate()`.
   */
  get selectedKeys(): string[] {
    if (!this.#key) return [];
    // `#wantedKeys` IS the answer: deriving from `selectedRecords` reports
    // EMPTY on a page none of them are on, while the selection is intact.
    // TRAP T-selection-lives-in-the-keys-not-the-objects.
    return [...(this.#wantedKeys ?? [])];
  }

  /**
   * Select exactly these rows, by key. TRAP T-grid-select-remembers-wanted-keys
   * — REPLACES, ignores unmatched keys, and is SILENT. `select([])` clears.
   */
  select(keys: readonly string[]): void {
    // REPLACES outright — unlike a user's tick, which merges.
    this.#wantedKeys = keys.length ? keys.map(String) : null;
    this.#resolveSelection();
    // Drop UNMATCHED keys here, not via `#rememberSelection()`, which MERGES.
    // ONLY WHEN THERE WERE ROWS TO CHECK AGAINST: a saved view calls `select()`
    // before populate, so dropping against an empty grid throws the selection
    // away as it is restored. TRAP T-selection-lives-in-the-keys-not-the-objects.
    const key = this.#key;
    if (key && this.#rows.length) {
      const resolved = [...this.#selected]
        .map((r) => r[key])
        .filter((v) => v != null)
        .map(String);
      this.#wantedKeys = resolved.length ? resolved : null;
    }
    // The boxes are stamped from #selected on every render, so a rebuild writes
    // the ticks — one path, not two.
    this.#renderBody();
    this.#syncSelectAll();
    this.#syncGroupSelects();
  }

  /**
   * Resolve the remembered keys against the rows the grid holds NOW — re-run on
   * every populate. TRAP T-grid-select-remembers-wanted-keys.
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

  /** Typing in a header filter box. */
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
    // Clearing is a step in typing, so hand the caret back.
    input.focus();
  };

  /**
   * Is this column narrowed, from EITHER direction? Its own box, its heading's
   * menu (unless SUSPENDED), or `data-filter-fields` from a toolbar it cannot see.
   */
  #isFiltered(field: string): boolean {
    if (this.#filters.has(field)) return true;
    const held = this.#columnFilters.get(field);
    if (held && !held.suspended) return true;
    const external = this.dataset['filterFields'];
    // TRAP T-grid-filter-fields-match-whole — `includes` lights `status` for `substatus`.
    return !!external && external.split(/\s+/).includes(field);
  }

  /**
   * Flag one column's HEADING as filtered. TRAP T-grid-active-flag-is-not-a-tint
   * — the heading only, and never a header rebuild: this runs per keystroke.
   */
  #markFiltered(field: string, on: boolean): void {
    const head = this.$(`.head-cell[data-field="${CSS.escape(field)}"]`);
    if (!head) return;
    // A sorted heading is lit too, so the flag comes off only when nothing is
    // acting on the column.
    const sorted = head.hasAttribute('data-sort');
    if (on || sorted || this.#isFiltered(field)) {
      (head as HTMLElement).dataset['status'] = 'active';
    } else {
      delete (head as HTMLElement).dataset['status'];
    }
  }

  /**
   * Record one column's filter text and redraw. The needle is lower-cased for
   * the map key only — `filterRows` does its own casing.
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
    // BOTH heading and filter cell: the header is sticky and stays on screen
    // once the filter row has scrolled away.
    this.#markFiltered(field, needle.length > 0);

    this.#renderBody();
    // TRAP T-grid-no-matches-is-not-empty — data-empty hides the input being typed in.
    const visible = this.#visibleRows().length;
    this.toggleAttribute('data-no-matches', visible === 0 && this.#rows.length > 0);
    // DERIVE the select-all: a filter changes what is VISIBLE, not what is chosen.
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
