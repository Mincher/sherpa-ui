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
import { advancedOf, kindOf, type OffersAdvanced } from '../../core/ui/filter-kind.js';
import { FILTER_MENU_HTML, menuFor, type FilterMenuDef, type FilterMenuItem } from '../../core/ui/filter-menu.js';
import type { FieldFilter } from '../../core/data/data-source.js';
import {
  DATA_PROPS, SHARED_PROPS, SherpaElement, coerceNum, clampNum, define,
} from '../../core/ui/sherpa-element.js';
import { markNeedles } from '../../core/ui/mark-text.js';
import { ORGANISE_ICONS } from '../../core/ui/shared-constants.js';
import { nextSort, sortDirectionAttr, sortDirectionFrom } from '../../core/data/cycle.js';
import { reduceRows } from '../../core/data/aggregate.js';
import {
  filterRows, sortRows,
  type Filter, type GroupSummary, type SortDirection, type SortSpec,
} from '../../core/data/store.js';
import {
  DEFAULT_OP, OP_LABELS, OP_TAKES, valueKey, type FilterOp,
} from '../../core/data/store.js';
import {
  clauseConditions, fieldState, readingClause, readingRows,
  type FieldReading, type FieldType, type FilterState,
} from '../../core/data/filter-state.js';
import { spellConditions } from '../../core/data/filter-face.js';
import { sameReading } from '../../core/data/query.js';
import { coalesce } from '../../core/data/timing.js';
import type { DataAsk } from '../../core/ui/context.js';
import { report } from '../../core/data/report.js';
import { isStaleKey, keyRow, rowKey } from '../../core/data/row-key.js';

/** The `fx` glyph a CONDITION wears, wherever one is drawn. */
const CONDITION_ICON = 'function';

/** A held CLAUSE op as the op a reader picked: several `eq` picks are `in`,
 *  several `ne` picks `notin`, two ends `between`.
 *  TRAP T-a-held-clause-op-is-not-a-reading-op */
const READING_OPS: Readonly<Record<string, FilterOp>> = { in: 'eq', notin: 'ne', between: DEFAULT_OP };
const readingOp = (op: string): FilterOp => READING_OPS[op] ?? (op as FilterOp);

// SIDE-EFFECT imports: an undefined custom element renders inert.
import '../sherpa-quick-filter/sherpa-quick-filter.js';
import '../sherpa-menu/sherpa-menu.js';
import '../sherpa-select-checkbox/sherpa-select-checkbox.js';
import '../sherpa-select-radio/sherpa-select-radio.js';
import type { SherpaMenu } from '../sherpa-menu/sherpa-menu.js';
import type { SherpaQuickFilter } from '../sherpa-quick-filter/sherpa-quick-filter.js';

export interface GridColumn extends OffersAdvanced {
  field: string;
  header?: string;
  /** number → right-aligned mono cells; anything else → default text. */
  type?: string;
  sortable?: boolean;
  /** Which condition this column OPENS on — `'contains'` for free text. */
  op?: FilterOp;
  /** Drawn width in px, clamped. A user drag overrides it for the grid's life. */
  width?: number;
}

type GridRow = Record<string, unknown>;

/** A selection box — a `sherpa-select-checkbox`, or the one-row `sherpa-select-radio`; NOT `HTMLInputElement`. */
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
  /** The field that names a row. Without it, the data layer's key does —
   *  never a position. TRAP T-a-made-up-key-never-leaves-the-data-layer */
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
  /** Each filterable column's FILTER as its source defines it, by field — so a
   *  heading opens the chip's own menu, the whole value list with it.
   *  TRAP T-a-heading-opens-the-chips-menu */
  filters?: Readonly<Record<string, FieldFilter>>;
}

/** The column types a heading can filter. Every body is the menu's own.
    TRAP T-a-menu-owns-its-own-bodies */
const FILTERABLE: ReadonlySet<string> = new Set(['text', 'number', 'date']);


export class SherpaDataGrid extends SherpaElement {
  static override css = new URL('./sherpa-data-grid.css', import.meta.url);
  static override html = [FILTER_MENU_HTML, new URL('./sherpa-data-grid.html', import.meta.url)];

  /* DECLARED: CSS-only, so the base class writes nothing. A `:host([data-x])`
     rule is a public API and belongs in one place. */
  static override props = {
    'data-bounds': SHARED_PROPS['data-bounds'],
    'data-total-pages': DATA_PROPS['data-total-pages'],
    'data-column-filters': { type: 'boolean', kind: 'style' },
    'data-filterable': { type: 'boolean', kind: 'style' },
    'data-locked': DATA_PROPS['data-locked'],
    'data-apply-on': DATA_PROPS['data-apply-on'],
    'data-sort-field': DATA_PROPS['data-sort-field'],
    'data-sort-direction': DATA_PROPS['data-sort-direction'],
    'data-group-field': DATA_PROPS['data-group-field'],
    // Fields an EXTERNAL filter narrows — the only way a column filtered from
    // outside can light its own header.
    'data-filter-fields': DATA_PROPS['data-filter-fields'],
    'data-page': DATA_PROPS['data-page'],
    'data-page-size': DATA_PROPS['data-page-size'],
    // What a toolbar chip is matching on, so its hits mark in the cells.
    'data-needles': { type: 'string', kind: 'behaviour' },
    // The WHOLE column's values, so a filter menu is never a one-way door.
    'data-column-values': { type: 'string', kind: 'behaviour' },
    'data-selectable': { type: 'boolean', kind: 'style' },
    // Single vs multiple changes the CONTROL each row draws, so it re-renders.
    'data-select': { type: 'enum', kind: 'style', values: ['single', 'multiple'] },
  } as const;

  /* A PAGE of rows, with its groups. Its own header filter row it answers
     itself, so its source never hears `filter-change`.
     TRAP T-a-component-asks-its-provider */
  static override asks: DataAsk = {
    shape: 'rows', own: ['filter-change'], shows: 'grid',
    // Its headings' FILTERS, as the source defines them. TRAP T-a-heading-opens-the-chips-menu
    filters: (el) => ((el as unknown as { columns?: GridColumn[] }).columns ?? [])
      .filter((c) => FILTERABLE.has(c.type ?? 'text'))
      .map((c) => c.field),
  };

  /* CONFIGURATION a page sets once; rows and groups arrive as data beside it.
     TRAP T-configuration-is-not-data */
  static override config = { columns: [], key: null, actions: [] };
  declare columns: GridColumn[];
  /** The field that names a row — selection follows it. */
  declare key: string | null;
  declare actions: GridAction[];

  /** `key` by the name a framework can bind: React and Vue keep `key` for
   *  themselves. TODO 211 */
  get rowKey(): string | null {
    return this.key;
  }
  set rowKey(field: string | null) {
    this.key = field;
  }

  // data-selectable is observed though CSS owns its reveal: the pin offset is a
  // MEASURED width, so it must re-run #measure().

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
  /** Watches the scroll box, so a wider card re-shares its slack. Kept across a
   *  move: onRender runs once, and a detached box simply reports nothing. */
  #fillWatch: ResizeObserver | null = null;
  /** Filter-row text, keyed by field. Empty entries are removed. */
  #filters = new Map<string, string>();

  /** One clause per column, from the heading menus. Held, never applied. */
  #columnFilters = new Map<string, FieldReading>();
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
  /** The CURRENT row's key: the last row clicked, or set. Not DOM focus, which a
   *  click never takes. A key, so a re-populate keeps it. */
  #currentKey: string | null = null;

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
    // A re-stamp's observer replaces the last; the select cell too, for a density change.
    this.#fillWatch?.disconnect();
    this.#fillWatch = new ResizeObserver(() => this.#measure(true));
    for (const box of [this.$('.scroller'), this.$('.head-row > .select-cell')]) if (box) this.#fillWatch.observe(box);
    // Both footer buttons commit. Delegated — a heading cell can be made again.
    this.$('.head-row')?.addEventListener('menu-apply', this.#onColumnFilterCommit);
    this.$('.head-row')?.addEventListener('menu-clear', this.#onColumnFilterCommit);
    // TRAP T-grid-chip-vocabulary-stops-here — a bound DataSource would read
    // the chip's quick-filter-change as the WHOLE filter.
    for (const type of ['quick-filter-change', 'quick-filter-click']) {
      this.$('.head-row')?.addEventListener(type, this.#stopChipEvent);
    }
    this.$('.head-row')?.addEventListener('menu-select', this.#onColumnFilterRemove);
    // Delegated: the body is replaced per render. The menu sits outside it.
    this.$('.body')?.addEventListener('click', this.#onActionsClick);
    this.$('.actions-menu')?.addEventListener('menu-select', this.#onActionSelect);
    if (this.#columns.length) this.#render();
  }

  /** Each attribute redraws only what it draws. TODO 355 C3 · TRAP T-a-grid-draws-once-per-moment */
  override onChange(name: string): void {
    switch (name) {
      case 'data-filter-fields':
        this.#syncColumnFilterStatus();
        this.#syncEmpty();
        return;
      // Read when asked, or drawn by CSS.
      case 'data-total-pages': case 'data-locked': case 'data-column-filters': case 'data-filterable':
        return;
      case 'data-needles':
        this.#syncNeedles();
        this.#syncEmpty();
        this.#invalidate('body');
        return;
      case 'data-page': case 'data-page-size':
        this.#invalidate('body');
        return;
      case 'data-column-values':
        this.#syncColumnValues();
        this.#invalidate('head');
        return;
      case 'data-sort-field': case 'data-sort-direction':
        this.#invalidate('head');
        this.#invalidate('body');
        return;
      default:
        this.#syncNeedles();
        this.#syncColumnValues();
        this.#invalidate('all');
    }
  }

  /** The rows are on their way: what the attributes ask for is drawn with them, once. */
  override populate(data: unknown): Promise<void> {
    this.#awaitingData = true;
    return super.populate(data).finally(() => {
      this.#awaitingData = false;
      if (this.#dirty.size) this.#schedule();
    });
  }

  /* ── One render per moment. TODO 355 · TRAP T-a-grid-draws-once-per-moment ── */

  /** What is owed a redraw: all of it, or the heading, or the body. */
  #dirty = new Set<'all' | 'head' | 'body'>();
  /** Rows were given, and are drawn soon: a render owed now waits for them. */
  #awaitingData = false;

  /** Something drawn changed: render once, however many attributes moved. */
  #invalidate(part: 'all' | 'head' | 'body'): void {
    this.#dirty.add(part);
    this.#schedule();
  }

  /** The owed render, at the end of this moment. */
  #schedule = coalesce((): void => {
    if (!this.#awaitingData) this.#flush();
  });

  /** The owed render NOW — before a read of what is drawn. Only the part owed:
   *  a page turned draws the rows, not the heading. */
  #flush(): void {
    const dirty = this.#dirty;
    if (!dirty.size) return;
    if (!this.#columns.length) {
      dirty.clear();
      return;
    }
    if (dirty.has('all') || (dirty.has('head') && dirty.has('body'))) {
      this.#render();
      return;
    }
    const head = dirty.has('head');
    dirty.clear();
    if (head) this.#renderHead();
    else {
      this.#renderBody();
      this.#syncSelected();
      this.#syncGroupSelects();
      this.#syncCurrent();
    }
    this.#pinSelects();
    this.#measure();
  }

  /** populate({ columns, rows }) — the rows, over the configuration the page set. */
  protected override renderData(data: unknown): void {
    this.#awaitingData = false;
    const cfg = (data ?? {}) as Partial<GridConfig>;
    this.#columns = Array.isArray(cfg.columns) ? cfg.columns : [];
    this.#rows = Array.isArray(cfg.rows) ? cfg.rows : [];
    this.#key = typeof cfg.key === 'string' ? cfg.key : null;
    this.#givenFilters = cfg.filters ?? {};
    this.#syncNeedles();
    this.#syncColumnValues();
    this.#actions = Array.isArray(cfg.actions) ? cfg.actions : [];
    this.#groups = Array.isArray(cfg.groups) ? cfg.groups : null;
    this.toggleState('actions', this.#actions.length > 0);
    // TRAP T-grid-populate-keeps-column-filters — header-row filters clear,
    // column filters drop only where the COLUMN went, selection re-resolves by KEY.
    this.#filters.clear();
    const fields = new Set(this.#columns.map((c) => c.field));
    for (const field of this.#columnFilters.keys()) {
      if (!fields.has(field)) this.#columnFilters.delete(field);
    }
    this.#resolveSelection();
    this.#render();
  }

  /* ── Render ─────────────────────────────────────────────────────── */

  /** No rows under a filter or a search — its source's, or its own — is NO MATCHES,
   *  not empty: the headings and their filters stay, with the message under them.
   *  TRAP T-grid-no-matches-is-not-empty */
  #syncEmpty(): void {
    const none = this.#rows.length === 0;
    const filtered = this.hasAttribute('data-filter-fields') || this.hasAttribute('data-needles');
    this.toggleState('empty', none && !filtered);
    this.toggleState('no-matches', none ? filtered : this.#filters.size > 0 && this.#visibleRows().length === 0);
  }

  /** Draw the head and the body. */
  #render(): void {
    this.#dirty.clear();
    this.#syncEmpty();
    // "Select all" of nothing is a control that does nothing.
    const advanced = this.#rows.length > 0;
    this.$('.select-all')?.toggleAttribute('data-advanced', advanced);
    // …and on the HOST, so the column widens for the caret:
    // `:host(:has(.select-all[data-advanced]))` does not PARSE.
    this.toggleState('advanced-select', advanced);
    this.#renderHead();
    this.#renderBody();
    // TRAP T-grid-select-all-is-derived — never reset here, or a sort throws
    // the user's selection away.
    this.#syncSelected();
    this.#syncGroupSelects();
    this.#syncCurrent();
    this.#pinSelects();
    this.#measure();
  }

  /**
   * The frozen offset and the column widths, from ONE layout read — and only
   * when what it reads moved: the columns, their widths, the select column, the
   * actions. `force`: the box was resized, or a column dragged. A card WIDER
   * than its columns gives the slack to the columns the reader has not dragged,
   * in proportion; narrower, each keeps its own width and the box scrolls.
   * Will, TODO 96 (A). TODO 355 C4. TRAP T-col-width-not-inline-size ·
   * TRAP T-grid-pin-offset-is-measured · TRAP T-a-grid-draws-once-per-moment
   */
  #measure(force = false): void {
    const box = this.$('.scroller');
    if (!box) return;
    const selectable = this.hasAttribute('data-selectable');
    const shown = this.#shownColumns();
    const base = shown.map((col) => this.#widthFor(col));
    const key = JSON.stringify([shown.map((c) => c.field), base, [...this.#widths], selectable,
      this.#rows.length > 0, this.#actions.length > 0]);
    if (!force && key === this.#measuredFor) return;
    // READ, all at once. TRAP T-grid-pin-offset-needs-subpixel — offsetWidth rounds the
    // 0.5px-bordered 32px cell and leaves a hairline under the pin.
    const probe = this.$('.head-row > .select-cell');
    const offset = selectable && probe ? probe.getBoundingClientRect().width : 0;
    const edges = this.$$('.head-row > .select-cell, .head-row > .actions-cell')
      .reduce((sum, cell) => sum + cell.getBoundingClientRect().width, 0);
    const room = box.clientWidth;
    // …then WRITE.
    this.style.setProperty('--_pin-offset', `${offset}px`);
    const free = shown.map((col) => !this.#widths.has(col.field));
    const share = base.reduce((sum, w, i) => sum + (free[i] ? w : 0), 0);
    const slack = room - edges - base.reduce((sum, w) => sum + w, 0);
    shown.forEach((col, i) => {
      const el = this.$<HTMLElement>(`.cols > .col[data-field="${CSS.escape(col.field)}"]`);
      const grow = slack > 0 && free[i] && share > 0 ? Math.floor((slack * base[i]!) / share) : 0;
      if (el) el.style.width = `${base[i]! + grow}px`;
    });
    // Drawn while hidden, it measured nothing: it measures again when shown.
    this.#measuredFor = !room || (selectable && !offset) ? '' : key;
  }

  /** What the widths and offset were last measured for. */
  #measuredFor = '';
  /** The shown columns the <col>s were last stamped for. */
  #colsFor = '';

  /** Flag one cell as frozen. `data-pin-last` draws the scroll shadow. */
  #markPinned(cell: HTMLElement, last: boolean): void {
    cell.toggleAttribute('data-pinned', true);
    cell.toggleAttribute('data-pin-last', last);
  }

  /** Freeze the selection cells while they show — writes only; `#measure`
   *  reads the offset. TRAP T-grid-pin-offset-is-measured — only a revealed
   *  selection cell may claim the offset. */
  #pinSelects(): void {
    const selectable = this.hasAttribute('data-selectable');
    for (const cell of this.$$('.select-cell')) {
      if (selectable) this.#markPinned(cell as HTMLElement, false);
      else {
        cell.removeAttribute('data-pinned');
        cell.removeAttribute('data-pin-last');
      }
    }
  }

  /**
   * Shared with the quick-filter toolbar, so a header and a chip cannot disagree
   * about "descending". `sort-none` is the neutral pair: three bars read as a menu.
   */
  static readonly icons = ORGANISE_ICONS;

  /** Drawn width: a dragged width wins, then the config, then the default. */
  #widthFor(col: GridColumn): number {
    const dragged = this.#widths.get(col.field);
    // A drag may END above the maximum: one that began on a column the card had filled.
    if (dragged != null) return Math.max(SherpaDataGrid.MIN_COL_WIDTH, Math.round(dragged));
    return this.#clampWidth(col.width ?? SherpaDataGrid.DEFAULT_COL_WIDTH);
  }

  /** A column width held between the minimum and the maximum. */
  #clampWidth(n: number): number {
    const { MIN_COL_WIDTH, MAX_COL_WIDTH, DEFAULT_COL_WIDTH } = SherpaDataGrid;
    if (!Number.isFinite(n)) return DEFAULT_COL_WIDTH;
    return clampNum(Math.round(n), { min: MIN_COL_WIDTH, max: MAX_COL_WIDTH });
  }

  /** Stamp one <col> per column. Must run BEFORE the header cells are rebuilt. */
  #renderCols(): void {
    // The same columns keep their <col>s, and the widths #measure shared out.
    const shown = JSON.stringify(this.#shownColumns().map((c) => [c.field, this.#widthFor(c)]));
    if (shown === this.#colsFor && this.$('.cols > .col')) return;
    this.#colsFor = shown;
    this.#measuredFor = '';
    // `own-children`, not `replace`: the fixed `.select-col` must survive.
    this.renderItems('.cols', 'template.col-tpl', this.#shownColumns(), {
      clear: 'own-children',
      ownSel: '.cols > .col',
      after: (node, col) => {
        const el = node as HTMLElement;
        el.dataset['field'] = col.field;
        // TRAP T-col-width-not-inline-size — `width`, never `inline-size`.
        el.style.width = `${this.#widthFor(col)}px`;
      },
    });
    // The static ACTIONS <col> sits BEFORE the stamped ones, so it moves to the
    // end — a <col> list out of step gives every width to the wrong column.
    const actionsCol = this.$('.cols > .actions-col');
    if (actionsCol) this.$('.cols')?.appendChild(actionsCol);
  }

  /** Draw the heading row: sort, filter and resize for each column. Each cell is
   *  KEPT, by field, and drawn in place; one is made again only when its column's
   *  type or its filter's shape changed. TODO 355 C5 · TRAP T-a-heading-cell-is-kept */
  #renderHead(): void {
    this.#renderCols();
    const headRow = this.$('.head-row');
    const tpl = this.$<HTMLTemplateElement>('template.head-cell-tpl');
    if (!headRow || !tpl) return;
    const kept = new Map(this.$$<HTMLElement>('.head-row > .head-cell').map((th) => [th.dataset['field'] ?? '', th]));
    // The fixed leading select <th> leads; each cell follows the one before it.
    let before: Element | null = headRow.querySelector(':scope > .select-head');
    this.#shownColumns().forEach((col, i) => {
      const held = this.#shown(col.field);
      const def = FILTERABLE.has(col.type ?? 'text') ? this.#filterDef(col, held) : null;
      const key = this.#cellKey(col, def);
      let th = kept.get(col.field);
      kept.delete(col.field);
      if (!th || this.#cellKeys.get(th) !== key) {
        // Imported, so its menu takes its items at once. TRAP T-custom-element-upgrade
        const made = this.clone(tpl);
        if (!made) return;
        made.dataset['field'] = col.field;
        if (def) this.#buildColumnFilter(made, def);
        // The chip's own flag, so CSS hides it without reaching into its shadow.
        else made.querySelector('.head-filter')?.setAttribute('data-unsupported', '');
        this.#cellKeys.set(made, key);
        // A new menu holds nothing, and has no values yet.
        this.#drawn.delete(col.field);
        this.#itemsFor.delete(col.field);
        th?.remove();
        th = made;
      }
      // Moved only when out of place: a moved node shuts an open popover.
      if (before ? before.nextElementSibling !== th : headRow.firstElementChild !== th) {
        if (before) before.after(th);
        else headRow.prepend(th);
      }
      before = th;
      this.#drawHeadCell(th, col, i, def, held);
    });
    for (const gone of kept.values()) gone.remove();
    // The ACTIONS head stays last. TRAP T-grid-actions-pin-to-the-trailing-edge.
    const actionsHead = headRow.querySelector(':scope > .actions-head');
    if (actionsHead && headRow.lastElementChild !== actionsHead) headRow.appendChild(actionsHead);

    this.#renderFilterRow();
  }

  /** What makes a heading cell: its type, and its filter menu's SHAPE — not its
   *  values, its ends or its days, which a kept menu is told. */
  #cellKey(col: GridColumn, def: FilterMenuDef | null): string {
    if (!def) return JSON.stringify([col.type ?? 'text', false]);
    const { options: _options, min: _min, max: _max, availableDates: _days, ...shape } = def;
    // TRAP T-a-default-is-not-an-override
    return JSON.stringify([col.type ?? 'text', true, { ...shape, range: def.range ?? kindOf(def) === 'number' },
      this.dataset['bounds'] ?? '', this.dataset['applyOn'] ?? '']);
  }
  /** Each heading cell's key, as it was made. */
  #cellKeys = new WeakMap<HTMLElement, string>();
  /** What each heading menu was last told it holds, by field — or what its reader applied. */
  #drawn = new Map<string, FieldReading | null>();
  /** Each heading menu's values, as it was last told them, by field. */
  #itemsFor = new Map<string, string>();
  /** The columns the filter row was last stamped for. */
  #filterRowFor = '';

  /** Draw one heading cell's state — the same for a cell just made and one kept,
   *  so each state is set AND taken away. */
  #drawHeadCell(th: HTMLElement, col: GridColumn, i: number, def: FilterMenuDef | null, held: FieldReading | undefined): void {
    const sortField = this.dataset['sortField'];
    const sortDir = this.dataset['sortDirection'];
    if (col.type) th.dataset['type'] = col.type;
    else delete th.dataset['type'];
    // Not nth-child: the position shifts when a column is dropped.
    if (i === 0) this.#markPinned(th, true);
    else {
      th.removeAttribute('data-pinned');
      th.removeAttribute('data-pin-last');
    }
    if (def) this.#drawColumnFilter(th, col, def, held);
    this.#lightFilterChip(th, col.field);
    const sortable = col.sortable !== false;
    th.dataset['sortable'] = String(sortable);
    const label = th.querySelector('.head-label');
    if (label && label.textContent !== (col.header ?? col.field)) label.textContent = col.header ?? col.field;
    // SORTED means APPLIED, not remembered — a suspended column keeps its
    // field and an empty direction. TRAP T-a-suspended-sort-is-one-owners-job.
    const sorted = sortable && col.field === sortField && sortDir !== '';
    if (sorted) th.dataset['sort'] = sortDir ?? 'asc';
    else delete th.dataset['sort'];
    // The grid's CSS paints nothing from `active`; a host may style it.
    if (sorted || this.#isFiltered(col.field)) th.dataset['status'] = 'active';
    else delete th.dataset['status'];

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
      const name = col.header ?? col.field;
      sortChip.setAttribute(
        'aria-label',
        !sorted
          ? `Sort by ${name}`
          : `Sorted by ${name}, ${sortDir === 'desc' ? 'descending' : 'ascending'}`,
      );
    }
  }

  /** TRAP T-grid-untyped-column-gets-no-filter-button — text|number|date only. */
  /**
   * Give a new heading its filter chip's menu — the CHIP's own menu, made by
   * `menuFor()` from the source's def of its field, so one field opens one
   * menu wherever it is asked. Will, TODO 86. TRAP T-a-heading-opens-the-chips-menu
   */
  #buildColumnFilter(th: HTMLElement, def: FilterMenuDef): void {
    const chip = th.querySelector<HTMLElement>('.head-filter');
    if (!chip) return;
    // A top-layer popover escapes the scroller, inside the HOST's named region.
    const { menu } = menuFor(this.root, def, { bounds: this.dataset['bounds'], live: this.dataset['applyOn'] === 'input' });
    // Clear empties the controls and keeps the menu open; Remove drops the clause.
    menu.setAttribute('data-removable', '');
    chip.appendChild(menu);
    /* Upgraded FIRST: a property set on a plain element hides the setter for good.
       TRAP T-custom-element-upgrade */
    customElements.upgrade(menu);
  }

  /** Draw a heading's filter — its menu kept, so an open one stays open, with its
   *  search, focus and an unapplied draft. Each write only where it changed.
   *  TRAP T-a-heading-menu-opens-on-what-it-holds · TRAP T-both-answers-are-kept */
  #drawColumnFilter(th: HTMLElement, col: GridColumn, def: FilterMenuDef, held: FieldReading | undefined): void {
    const chip = th.querySelector<SherpaQuickFilter>('.head-filter');
    const menu = chip?.querySelector<SherpaMenu>('sherpa-menu');
    if (!chip || !menu) return;
    /* HELD HIGHER: shown, greyed, and refused here — the reader changes it where
       it is held. TRAP T-a-view-held-heading-shows-and-refuses */
    const superseded = this.#superseded.has(col.field);
    const was = chip.hasAttribute('data-superseded');
    chip.toggleAttribute('data-superseded', superseded);
    if (superseded && this.#supersededAt) chip.setAttribute('data-applied-at', this.#supersededAt);
    else chip.removeAttribute('data-applied-at');
    menu.toggleAttribute('data-readonly', superseded);
    chip.setAttribute('aria-label', `Filter ${def.label}`);
    // Its values, its ends, its days — told only when they moved, so the search text stays.
    const items = this.#columnItems(def.options ?? [], held);
    const itemsKey = JSON.stringify(items.map((it) => [it.value, it.label]));
    if (items.length && this.#itemsFor.get(col.field) !== itemsKey) {
      this.#itemsFor.set(col.field, itemsKey);
      // An OPEN menu keeps its reader's draft through new values (Will, G1).
      const draft = menu.open ? menu.values ?? [] : null;
      menu.items(items);
      if (draft) menu.values = draft.filter((v) => items.some((it) => it.value === v));
    }
    if (menu.dataset['body'] === 'number') {
      menu.setAttribute('data-min', String(def.min ?? 0));
      menu.setAttribute('data-max', String(def.max ?? 100));
    }
    if (def.availableDates?.length) menu.setAttribute('data-available', def.availableDates.join(','));
    /* THE MENU HOLDS ITS OWN — both answers and the mode, a date's days too —
       told only when what it holds CHANGED, so a reader's draft survives a push. */
    const drawn = this.#drawn.get(col.field);
    const wrote = !this.#drawn.has(col.field) || !sameReading(drawn, held ?? null);
    if (wrote) {
      this.#drawn.set(col.field, held ?? null);
      // Rows ARE the opt-in reaching the menu. TRAP T-many-conditions-are-one-reading
      if (held && readingRows(held).length) menu.setAttribute('data-advanced', '');
      else if (!advancedOf(def)) menu.removeAttribute('data-advanced');
      if (held) menu.reading = held;
      else if (drawn) {
        // Released from outside: emptied, as Clear empties it.
        if (menu.getAttribute('data-type') === 'filter') menu.setAttribute('data-value', '');
        menu.reading = {};
      }
      // Written while open (Will, G1 A): Cancel now restores THIS. TRAP T-the-baseline-is-taken-at-show
      if (menu.open) menu.takeBaseline();
    }
    // A kept chip draws its face again from what its menu now holds: its tip says so.
    if (wrote || was !== superseded) chip.refresh();
    if (superseded) menu.present = null;
    else this.#markPresent(th);
  }

  /**
   * A heading's filter: the SOURCE's def of its field — its Advanced offer, its
   * whole value list and their names, a date's days — else one made from the
   * column, where a text column offers conditions as it always has.
   * TRAP T-a-heading-opens-the-chips-menu
   */
  #filterDef(col: GridColumn, held: FieldReading | undefined): FilterMenuDef {
    const kind = col.type ?? 'text';
    const given = this.#givenFilters[col.field];
    // Its values only where a list shows them: the work is not done to be thrown away. TODO 355
    const listed = !given && kind === 'text' && kindOf(col) !== 'advanced';
    const values = listed ? this.#columnValues.get(col.field) ?? this.#presentValues(col.field).sort() : [];
    const own: FilterMenuDef = given ? { ...given } : {
      // No offer is Advanced too, for a text column.
      ...(kind === 'text'
        ? { advanced: col.advanced ?? true, ...(col.op ? { op: col.op } : {}) }
        : { kind: kind as 'number' | 'date', ...(col.advanced != null ? { advanced: col.advanced } : {}) }),
      ...(listed ? { options: values.map((v) => ({ value: v, label: v })) } : {}),
    };
    /* A NUMBER's slider spans the values it HAS: the 0..100 default crushes a
       spend column at the far left. `reduceRows`, as `null` coerces to 0.
       TRAP T-grid-slider-spans-real-values · TRAP T-number-of-null-is-zero */
    const ends = kind === 'number' && own.min == null && this.#rows.some((row) => {
      const raw = row[col.field];
      return raw != null && raw !== '' && Number.isFinite(Number(raw));
    }) ? { min: Math.floor(reduceRows(this.#rows, 'min', col.field)), max: Math.ceil(reduceRows(this.#rows, 'max', col.field)) } : {};
    return {
      ...own, ...ends, id: col.field, label: col.header ?? own.label ?? col.field, commit: true,
      ...(kind === 'text' && !own.select ? { select: 'multiple' as const } : {}),
      // A HELD shape wins. TRAP T-a-default-is-not-an-override
      ...(kind !== 'text' && held ? { range: !!held.range } : {}),
    };
  }

  /** A text heading's rows, ticked as it holds. What is ruled out is the
   *  SOURCE's to say — one page cannot. TRAP T-a-ruled-out-value-is-greyed */
  #columnItems(items: readonly FilterMenuItem[], held: FieldReading | undefined): FilterMenuItem[] {
    const on = new Set((held?.picked ?? []).map(valueKey));
    return items.map((item) => ({ ...item, selected: on.has(item.value) }));
  }

  /**
   * drawPresent(present, scope) — a bound source says what the filters before
   * each field leave; a heading's menu greys the rest. A field not named is not
   * limited. TRAP T-a-ruled-out-value-is-greyed
   */
  drawPresent(present: Readonly<Record<string, readonly string[]>>): void {
    this.#present = present;
    for (const cell of this.$$<HTMLElement>('.head-cell[data-field]')) this.#markPresent(cell);
  }

  /** drawOffered(offered) — what each serial-set field OFFERS: a heading's menu
   *  removes the rest, but keeps a pick. TRAP T-a-filter-set-groups-or-chains */
  drawOffered(offered: Readonly<Record<string, readonly string[]>>): void {
    this.#offered = offered;
    for (const cell of this.$$<HTMLElement>('.head-cell[data-field]')) this.#markPresent(cell);
  }
  /** What each chained field offers, as last drawn. */
  #offered: Readonly<Record<string, readonly string[]>> = {};

  /** One heading's menu, told what the filters before its field leave and what
   *  its chain offers. Its chip is never greyed for it: a filter whose every pick
   *  is ruled out stays in force (Will, 2026-10-20). TRAP T-a-ruled-out-value-is-greyed */
  #markPresent(cell: HTMLElement): void {
    const field = cell.dataset['field']!;
    const menu = cell.querySelector<SherpaMenu>('.head-filter sherpa-menu');
    if (!menu || this.#superseded.has(field)) return;
    menu.present = this.#present[field] ?? null;
    menu.offered = this.#offered[field] ?? null;
  }
  /** What the filters before each field leave, as the source last said. */
  #present: Readonly<Record<string, readonly string[]>> = {};

  /** The values the ROWS on screen carry. */
  #presentValues(field: string): string[] {
    return [...new Set(this.#rows.map((row) => row[field]).filter((v) => v != null && v !== '').map((v) => String(v)))];
  }

  /** The WHOLE column's values, by field, from `data-column-values`. */
  #columnValues = new Map<string, string[]>();

  /** Each heading's filter as its source defines it, as the last populate gave them. */
  #givenFilters: Readonly<Record<string, FieldFilter>> = {};

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

  /** REMOVE FILTER — ends a column's filter. Reported as a clear, so a host has one path. */
  #onColumnFilterRemove = (event: Event): void => {
    if ((event as CustomEvent).detail?.value !== 'remove') return;
    const chip = (event.target as HTMLElement).closest<HTMLElement>('.head-filter');
    if (!chip) return;
    event.stopPropagation();
    chip.querySelector<SherpaMenu>('sherpa-menu')?.close?.();
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
    const held = cleared ? null : this.#readColumnFilter(chip);

    if (held) {
      this.#columnFilters.set(field, held);
    } else {
      this.#columnFilters.delete(field);
      chip.removeAttribute('data-current');
      // Only an explicit CLEAR empties the controls: Apply lands here on a
      // half-built range, which is unfinished, not wrong.
      if (cleared) {
        /* The shared filter menu keeps its typed value in an ATTRIBUTE, which
           is the whole reason it survives a re-stamp — so clearing has to
           reach that, not only the boxes. TRAP T-one-field-one-filter-menu */
        const fm = chip.querySelector<SherpaMenu>('sherpa-menu');
        if (fm?.getAttribute('data-type') === 'filter') fm.setAttribute('data-value', '');
        // The MENU empties its own answer, whatever its body: ticks, rows, a number, a day.
        if (fm) fm.reading = {};
        // And Cancel's answer with it: a kept menu that closes must not tick the old answer back. TRAP T-a-heading-cell-is-kept
        fm?.takeBaseline();
      }
    }

    // What the menu holds now is what it was drawn: a push of the same answer writes nothing.
    this.#drawn.set(field, held ? { ...held } : null);
    this.#syncColumnFilterStatus();
    this.#renderBody();

    const col = this.#columns.find((c) => c.field === field);
    const header = col?.header ?? field;
    // TRAP T-grid-number-clause-must-coerce — the clause is the data layer's.
    const clause = held ? this.#columnClause(field, held) : null;
    const lead = held ? this.#inForce(field, held).rows[0] : undefined;
    const single = !!clause && clause[0] !== 'and' && clause[0] !== 'or';
    const ends = lead?.op === 'between' ? (lead.picked ?? []).map(String) : null;
    const one = (lead?.picked ?? []).length === 1 ? String(lead!.picked![0]) : '';
    const value = held && !ends ? (lead?.text ?? one) : null;
    this.emit('column-filter-change', {
      field,
      header,
      op: single ? String(clause![1]) : (lead?.op ?? null),
      value,
      from: ends?.[0] ?? null,
      to: ends?.[1] ?? null,
      clause,
      // …and as a READING, which the data layer keeps. TRAP T-one-query-one-owner
      reading: held ? { ...held } : null,
      // What a toolbar chip shows: "Contains: ana". The field half is `header`.
      label: held ? this.#columnFilterLabel(field, held) : null,
    });
  };

  /**
   * Read one column's menu into what it holds — both answers and the mode.
   * TRAP T-grid-empty-clause-is-null — nothing typed or ticked holds nothing,
   * and a range needs both ends. TRAP T-both-answers-are-kept
   */
  #readColumnFilter(chip: HTMLElement): FieldReading | null {
    const menu = chip.querySelector<SherpaMenu>('sherpa-menu');
    if (!menu) return null;
    const reading = menu.reading;
    // A RANGE of days needs both ends: one is unfinished, not wrong.
    if (menu.dataset['body'] === 'date' && reading.range && (reading.picked ?? []).length < 2) return null;
    return answersAnything(reading) ? reading : null;
  }

  /** One column's answer IN FORCE, as the data layer reads it. */
  #inForce(field: string, held: FieldReading): FilterState {
    // What it WOULD filter by; whether it is suspended is asked on its own.
    return fieldState(this.#facts(field), { ...held, suspended: false });
  }

  /** What the grid knows of a field: its name and its column type. */
  #facts(field: string): { field: string; type?: FieldType } {
    const type = this.#columns.find((c) => c.field === field)?.type;
    return { field, ...(type ? { type: type as FieldType } : {}) };
  }

  /**
   * One column filter as a store FilterClause, or null. THE DATA LAYER BUILDS
   * IT — the casting, the range and the picks-to-`in` rule live once.
   * TRAP T-the-field-type-decides-the-clause
   */
  #columnClause(field: string, held: FieldReading): unknown[] | null {
    // A SUSPENDED clause is returned too. TRAP T-grid-suspend-is-not-clear
    return (readingClause(this.#facts(field), { ...held, suspended: false }) as unknown[] | undefined) ?? null;
  }

  /** One column filter as a chip reads it — "Contains: ana", "Between: 10 - 20". */
  #columnFilterLabel(field: string, held: FieldReading): string {
    const state = this.#inForce(field, held);
    // A chain says itself: `Contains: Da or Starts with: R`.
    if (state.rows.length > 1) return spellConditions({ ...state, conditions: state.rows });
    const row = state.rows[0];
    if (!row) return '';
    const picks = (row.picked ?? []).map(String);
    // Several picks read as the clause does: "Is one of", "Is not one of".
    const op = picks.length > 1 && row.op === 'eq' ? 'in' : picks.length > 1 && row.op === 'ne' ? 'notin' : row.op;
    const name = OP_LABELS[op as keyof typeof OP_LABELS] ?? op;
    if (row.op === 'between') return `${name}: ${picks[0]} - ${picks[1]}`;
    if ((OP_TAKES[row.op] ?? 'list') === 'text') return `${name}: ${row.text ?? ''}`;
    // A COUNT, not a list: "Is one of: 4" beats a chip that runs off the bar.
    return picks.length === 1 ? `${name}: ${picks[0]}` : `${name}: ${picks.length}`;
  }

  /**
   * Set one column's filter from OUTSIDE. TRAP
   * T-grid-read-without-write-is-half-an-api — SILENT, and takes the clause
   * `column-filter-change` reports.
   */
  setColumnFilter(field: string, clause: unknown[] | null): void {
    const held = clause ? this.#readingFromClause(field, clause) : null;
    if (!held) {
      this.clearColumnFilter(field);
      return;
    }
    this.#columnFilters.set(field, held);
    // The HEADER is rebuilt, not reached into: one path writes a menu.
    this.#renderHead();
    this.#syncColumnFilterStatus();
    this.#renderBody();
  }

  /** A clause as what a heading HOLDS, or null when it filters by nothing. */
  #readingFromClause(field: string, clause: unknown[]): FieldReading | null {
    /* A CHAIN — `['or', a, b]` from a chip's rows — held as its rows.
       TRAP T-a-heading-holds-a-whole-reading */
    if (clause[0] === 'and' || clause[0] === 'or') {
      const rows = clauseConditions(clause as Filter);
      if (!rows) {
        report({
          code: 'unheld-column-clause',
          message: 'setColumnFilter: a chained clause these rows cannot say was not held.',
          at: { field, clause: JSON.stringify(clause) },
        });
        return null;
      }
      return { conditions: rows, mode: 'advanced' };
    }
    const [, clauseOp, value] = clause as [string, string, unknown];
    if (clauseOp === 'between' && Array.isArray(value)) {
      const [from, to] = value.map((v) => String(v ?? ''));
      return from && to ? { picked: [from, to], range: true } : null;
    }
    const op = readingOp(clauseOp);
    const picked = (Array.isArray(value) ? value : [value]).map((v) => String(v ?? '')).filter(Boolean);
    if (!picked.length) return null;
    if ((OP_TAKES[op] ?? 'list') === 'text') return { op, text: picked[0]!, range: false };
    // `eq` is Simple's ticks; `ne` and the rest stay an op over the picks.
    return op === DEFAULT_OP ? { picked, range: false } : { op, picked, range: false };
  }

  /**
   * supersedeColumns(readings, appliedAt) — the fields a HIGHER scope holds,
   * each with the answer it holds there. A named heading SHOWS that answer,
   * read-only, with the superseded look and tip, so no contradicting pick can
   * be made in it; a heading not named is released. Will, 2026-09-26.
   * TRAP T-a-view-held-heading-shows-and-refuses
   */
  supersedeColumns(readings: Readonly<Record<string, FieldReading>>, appliedAt?: string): void {
    // The same answer again rebuilds nothing — a host sends it on every change.
    const key = JSON.stringify([readings, appliedAt ?? null]);
    if (key === this.#supersededKey) return;
    this.#supersededKey = key;
    this.#superseded = new Map(Object.entries(readings));
    this.#supersededAt = appliedAt;
    this.#renderHead();
    this.#syncColumnFilterStatus();
    // The MARKS follow the answer that filters.
    this.#renderBody();
  }

  /** The fields a higher scope holds, and its answer for each. */
  #superseded = new Map<string, FieldReading>();

  /** Where they are held, for each chip's tip. */
  #supersededAt: string | undefined;

  /** What `supersedeColumns` was last given, as one comparable string. */
  #supersededKey = '';

  /** What a heading SHOWS: a higher scope's answer when it holds the field, else its own. */
  #shown(field: string): FieldReading | undefined {
    return this.#superseded.get(field) ?? this.#columnFilters.get(field);
  }

  /**
   * One column's filter as a ready FilterClause, or null. TRAP
   * T-grid-suspend-is-not-clear — a SUSPENDED clause is returned too.
   */
  columnClause(field: string): unknown[] | null {
    const held = this.#columnFilters.get(field);
    return held ? this.#columnClause(field, held) : null;
  }

  /** One column's filter as a READING, or null — what a saved view set on it. */
  columnReading(field: string): FieldReading | null {
    const held = this.#columnFilters.get(field);
    return held ? { ...held } : null;
  }

  /**
   * drawReading(field, reading) — a bound source tells this grid one column's
   * answer, whoever set it: a chip, the panel, a restored Query. SILENT.
   * TRAP T-one-query-one-owner
   */
  drawReading(field: string, reading: FieldReading): void {
    /* HELD AS IT IS — both answers and the mode. Through a clause only the
       answer in force came back. TRAP T-both-answers-are-kept */
    if (!answersAnything(reading)) {
      this.clearColumnFilter(field);
      return;
    }
    // The answer it holds already: nothing to draw. TODO 355
    if (sameReading(this.#columnFilters.get(field), reading)) return;
    // Kept even before the columns arrive — a restore draws first.
    this.#columnFilters.set(field, { ...reading });
    this.#renderHead();
    this.#syncColumnFilterStatus();
    this.#renderBody();
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
    return held ? this.#columnFilterLabel(field, held) : null;
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
    this.#flush();
    const chip = this.$<SherpaQuickFilter>(
      `.head-cell[data-field="${CSS.escape(field)}"] .head-filter`,
    );
    /* Ask the CHIP, not its menu: the chip owns the light-dismiss-safe open, and
       reaching past it to `menu.toggle()` brought the stuck-open bug back
       through this door. The anchor still travels — a toolbar chip borrows this
       menu and must see it over ITSELF.
       TRAP T-a-trigger-click-follows-light-dismiss · T-grid-toolbar-chip-borrows-the-menu */
    chip?.toggleMenu?.(anchor);
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
    // Drawn from the map — #renderHead tells each kept menu what it now holds.
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
       "starts with" — wears the `fx` glyph, so a reader can tell a typed rule from a ticked list without opening it.
       An icon-only chip falls back to its funnel when no icon is named.
       TRAP T-a-condition-badge-says-that-not-which */
    const held = this.#shown(field);
    /* THE SAME ANSWER a toolbar chip reads — `state.condition`, from this
       column's reading. TRAP T-one-condition-system */
    const condition = held ? this.#inForce(field, held).condition : null;
    if (condition === 'advanced') chip.setAttribute('data-icon-start', CONDITION_ICON);
    else chip.removeAttribute('data-icon-start');
    /* The chip is TOLD its condition too, from the SAME answer as the glyph.
       TRAP T-a-conditioned-chip-reads-as-active
       TRAP T-an-external-chip-caret-must-open-its-condition */
    if (condition) chip.dataset['condition'] = condition;
    else chip.removeAttribute('data-condition');
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

  /** Stamp one filter input per column into the secondary header row — again only
   *  when the columns changed; else each input shows what it holds, in place. */
  #renderFilterRow(): void {
    const filterRow = this.$('.filter-row');
    const tpl = this.$<HTMLTemplateElement>('template.filter-cell-tpl');
    if (!filterRow || !tpl) return;
    const shownKey = JSON.stringify(this.#shownColumns().map((c) => [c.field, c.header ?? '', c.type ?? '']));
    if (shownKey === this.#filterRowFor && filterRow.querySelector('.filter-cell')) {
      for (const th of this.$$<HTMLElement>('.filter-row > .filter-cell')) {
        const text = this.#filters.get(th.dataset['field'] ?? '') ?? '';
        const input = th.querySelector<HTMLInputElement>('.filter-input');
        if (input && input.value !== text) input.value = text;
        th.toggleAttribute('data-has-value', text !== '');
      }
      return;
    }
    this.#filterRowFor = shownKey;

    // Keep the fixed leading spacer <th>; rebuild only the dynamic filter cells.
    filterRow.querySelectorAll('.filter-cell').forEach((el) => el.remove());
    const actionsSpacer = filterRow.querySelector('.actions-cell');
    this.#shownColumns().forEach((col, i) => {
      const th = this.clone(tpl);
      if (!th) return;
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
    // Each row's selection cell is drawn frozen: no caller has to pin it after.
    const selectable = this.hasAttribute('data-selectable');

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
      // One NAME per grid: the radio's group. TRAP T-radios-in-shadow-roots-are-not-one-group
      const radio = tr.querySelector<SelectBox>('.row-one');
      if (radio) radio.setAttribute('name', this.#selectName);
      const ticked = this.#selected.has(record);
      for (const box of tr.querySelectorAll<SelectBox>('.row-select')) box.checked = ticked;
      tr.toggleAttribute('data-selected', ticked);
      const select = tr.querySelector<HTMLElement>('.select-cell');
      if (selectable && select) this.#markPinned(select, false);
      // Its group, so CSS hides it when that group is shut — no `display` write.
      if (group && lastGroup !== null) tr.dataset['groupKey'] = lastGroup;
      columns.forEach((col, c) => {
        const td = this.clone(cellTpl);
        if (!td) return;
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
    // A Find that stepped off the last page lands on this one's first match.
    if (this.#landing) this.#land();
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
    // What FILTERS here: the View's answer while it holds the field, else the heading's own.
    // TRAP T-a-view-held-heading-shows-and-refuses
    const held = this.#shown(col.field);
    // EVERY row's string, not the first. TRAP T-a-condition-marks-every-match
    const own = (held && !held.suspended ? this.#inForce(col.field, held).rows : [])
      .flatMap((row) => (row.text ? [{ op: row.op, text: row.text }] : []));
    /* A toolbar chip's condition reaches here through `data-needles`, because
       the grid cannot see the bar that holds it. Without this a chip filtering
       "Contains Ravi" narrowed the rows and marked nothing.
       TRAP T-a-needle-comes-from-either-direction */
    markNeedles(td, text, [...(own.length ? own : this.#needles.get(col.field) ?? []), ...this.#needles.get('*') ?? []]);
  }

  /* ── FIND ── Will, TODO 136. TRAP T-a-find-asks-its-host-to-step */

  /** Where a Find lands once the page it asked for is drawn. */
  #landing: 'first' | 'last' | null = null;

  /** Every mark on this page, in reading order. */
  #marks(): HTMLElement[] {
    return this.$$<HTMLElement>('.cell mark.match');
  }

  /**
   * findStep(direction) — move to the next or previous MATCH, and show it.
   * Past this page's last it asks for the next page (`page-change`) and lands
   * on its first; before the first, the previous page's last — round from the
   * end to the start, as a browser's own find. Answers where it is on this
   * page: `{ index, count }`, `index` -1 while a page loads.
   */
  findStep(direction: 1 | -1 = 1): { index: number; count: number } {
    this.#flush();
    const marks = this.#marks();
    const at = marks.findIndex((m) => m.hasAttribute('data-current'));
    let next = at < 0 ? (direction > 0 ? 0 : marks.length - 1) : at + direction;
    const pages = Math.max(1, this.num('data-total-pages', 1));
    if (marks.length && pages > 1 && (next < 0 || next >= marks.length)) {
      const page = Math.max(1, this.num('data-page', 1));
      this.#landing = direction > 0 ? 'first' : 'last';
      this.emit('page-change', { page: ((page - 1 + direction + pages) % pages) + 1 });
      return { index: -1, count: marks.length };
    }
    if (!marks.length) return { index: -1, count: 0 };
    next = (next + marks.length) % marks.length;
    this.#showMatch(marks, next);
    return { index: next, count: marks.length };
  }

  /** The asked-for page is drawn: its first or last match. */
  #land(): void {
    const marks = this.#marks();
    const to = this.#landing === 'last' ? marks.length - 1 : 0;
    this.#landing = null;
    if (marks.length) this.#showMatch(marks, to);
  }

  /** Mark ONE match as the one a Find is on, and bring it into view. */
  #showMatch(marks: readonly HTMLElement[], index: number): void {
    for (const [i, mark] of marks.entries()) mark.toggleAttribute('data-current', i === index);
    marks[index]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  /** Needles from OUTSIDE, by field — see `data-needles`. */
  #needles = new Map<string, { op: string; text: string }[]>();

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
      const field = entry.slice(0, at);
      this.#needles.set(field, [...this.#needles.get(field) ?? [], { op: rest.slice(0, opAt), text: rest.slice(opAt + 1) }]);
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
   * its own tally is a page tally. The grid's OWN tally where its filter row
   * hides rows — the data layer does not know of those — and for a grid
   * populated by hand, with no source behind it.
   * TRAP T-a-group-is-a-data-layer-concept
   */
  #groupSize(rows: GridRow[], field: string, key: string): number {
    const told = this.#filters.size ? undefined : this.#groups?.find((g) => g.key === key);
    if (told) return told.count;
    return rows.filter((r) => String(r[field] ?? '') === key).length;
  }

  /* ── Visual paging ──────────────────────────────────────────────────
   * TRAP T-grid-collapsed-group-is-one-slot — a page is `data-page-size` ROWS,
   * grouped or not; a SHUT group is one line, so it costs one. The store
   * counts RECORDS and cannot know what is shut.
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
   * Cut the visible rows into pages of `size` ROWS, returning each page's
   * start index, so a page stays a plain slice. A ROW is one slot; an open
   * group's heading is free, so a page holds the rows the pager says. A SHUT
   * group is one slot, whatever it holds. An OPEN group longer than a page IS
   * split.
   */
  #pageStarts(rows: GridRow[], field: string, size: number): number[] {
    const starts: number[] = [0];
    let slots = 0;
    let lastGroup: string | null = null;

    for (let i = 0; i < rows.length; i += 1) {
      const key = String(rows[i]![field] ?? '');
      // A shut group's ROWS are drawn but hidden: its first one pays for the heading.
      const cost = this.#collapsed.has(key) ? (key !== lastGroup ? 1 : 0) : 1;
      if (cost > 0 && slots + cost > size && slots > 0) {
        starts.push(i);
        slots = 0;
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
    const menu = this.$<SherpaMenu>('.actions-menu');
    const tpl = this.$<HTMLTemplateElement>('template.action-item-tpl');
    if (!menu || !tpl) return;

    this.#actionRow = record;
    // SLOTTED light-DOM buttons, which is what gives them Enter, Space and
    // focus for nothing — T-menu-rows-stay-native-controls.
    menu.replaceChildren();
    for (const action of this.#actions) {
      const item = this.clone(tpl);
      if (!item) continue;
      item.setAttribute('value', action.id);
      item.toggleAttribute('data-danger', !!action.danger);
      const icon = item.querySelector('.action-icon');
      if (icon) {
        // DRAWN: a class paints nothing.
        if (action.icon) this.writeIcon(icon, action.icon);
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
    this.$<SherpaMenu>('.actions-menu')?.hide?.();
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
      this.#flush();
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
    this.#currentKey = record ? this.#keyOf(record) ?? null : null;
    this.#syncCurrent();
    this.emit('row-select', { index, row: record });
  };

  /** Mark the CURRENT row — one of many, the house word; CSS owns the tint. */
  #syncCurrent(): void {
    const rows = this.#visibleRows();
    for (const tr of this.$$<HTMLElement>('.row')) {
      const row = rows[coerceNum(tr.dataset['index'], -1, { int: true })];
      tr.toggleAttribute('data-current', !!row && this.#currentKey !== null && this.#keyOf(row) === this.#currentKey);
    }
  }

  /** The current row's key, or null. Setting it is silent, as `select()` is. */
  get currentKey(): string | null {
    return this.#currentKey;
  }
  set currentKey(key: string | null) {
    this.#currentKey = key == null || key === '' ? null : String(key);
    this.#syncCurrent();
  }

  /** The current RECORD among the rows held now — null when it is not one of them. */
  get current(): GridRow | null {
    return this.#rows.find((r) => this.#keyOf(r) === this.#currentKey) ?? null;
  }

  /** The row `by` rows from the current one, in the order drawn — or null. */
  neighbour(by: number): GridRow | null {
    const rows = this.#visibleRows();
    const at = rows.findIndex((r) => this.#keyOf(r) === this.#currentKey);
    return at < 0 ? null : rows[at + by] ?? null;
  }

  /** Move the current row `by` rows. Silent; returns the new one, or null at an end. */
  stepCurrent(by: number): GridRow | null {
    const next = this.neighbour(by);
    if (next) this.currentKey = this.#keyOf(next) ?? null;
    return next;
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
      this.#syncSelected();
      this.#syncGroupSelects();
      this.#syncCurrent();
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
    this.toggleState('resizing', true);

    (grip as HTMLElement).setPointerCapture(event.pointerId);
    grip.addEventListener('pointermove', this.#onGripMove as EventListener);
    grip.addEventListener('pointerup', this.#onGripUp as EventListener, { once: true });
    grip.addEventListener('pointercancel', this.#onGripUp as EventListener, { once: true });
  };

  /** Dragging a grip: size the column live. */
  #onGripMove = (event: PointerEvent): void => {
    if (!this.#drag) return;
    const { field, startX, startWidth } = this.#drag;
    /* A column the card FILLED past the maximum shrinks from where it is drawn,
       and grows no wider — it does not jump down to the maximum. TODO 96 */
    const next = clampNum(Math.round(startWidth + (event.clientX - startX)), {
      min: SherpaDataGrid.MIN_COL_WIDTH, max: Math.max(SherpaDataGrid.MAX_COL_WIDTH, startWidth),
    });
    this.#widths.set(field, next);
    /* The COLGROUP only: a #render() per pointermove rebuilds the body 60x/s.
       The columns not dragged re-share what is left. */
    this.#measure(true);
  };

  /** The grip was let go: keep the width and report it. */
  #onGripUp = (event: PointerEvent): void => {
    const drag = this.#drag;
    this.#drag = null;
    this.toggleState('resizing', false);

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
    this.#measure(true);
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
    this.#syncSelected();
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
      // SINGLE mode holds one record; the radio unticks its own group.
      if (this.#single) {
        this.#selected.clear();
        this.#wantedKeys = null;
      }
      if ((target as SelectBox).checked) this.#selected.add(record);
      else this.#selected.delete(record);
    }
    this.#syncSelected();
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
    this.#syncSelected();
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
    } else if (value === 'all' && this.#askEvery()) {
      return;
    } else {
      const rows = value === 'page' ? this.#pageRecords() : this.#visibleRows();
      for (const record of rows) this.#selected.add(record);
    }

    this.#renderBody();
    this.#syncSelected();
    this.#syncGroupSelects();
    this.#emitSelection();
  };

  /**
   * "Select all rows" on a grid its SOURCE pages: it holds one page, so it asks
   * for the rest. True when a host took the ask. TODO 238 · TRAP T-select-all-is-the-visible-rows
   */
  #askEvery(): boolean {
    if (this.#paginates || this.num('data-total-pages', 1) <= 1) return false;
    return !this.emit('select-all-request', { answer: (rows: readonly GridRow[]): void => this.#selectEvery(rows) }, { cancelable: true });
  }

  /** Tick every row its source answered, the ones on other pages too. */
  #selectEvery(rows: readonly GridRow[]): void {
    const keys = rows.map((r) => this.#keyOf(r)).filter((k): k is string => !!k);
    this.#wantedKeys = [...new Set([...(this.#wantedKeys ?? []), ...keys])];
    this.#resolveSelection();
    this.#renderBody();
    this.#syncSelected();
    this.#syncGroupSelects();
    this.#emitSelection();
  }

  /** The records the body actually drew — one page when the grid pages. */
  #pageRecords(): GridRow[] {
    return this.$$<HTMLElement>('.row')
      .map((tr) => this.#visibleRows()[coerceNum(tr.dataset['index'], -1, { int: true })])
      .filter((r): r is GridRow => r !== undefined);
  }

  /** Mark each ticked ROW, which CSS paints, and reflect all / some / none on
   *  the header box. TRAP T-firefox-never-rereads-a-has-after-host */
  #syncSelected(): void {
    const all = this.#rowBoxes();
    for (const box of all) box.closest('.row')?.toggleAttribute('data-selected', box.checked);
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
    const onPage = new Set(this.#rows.map((r) => this.#keyOf(r)).filter((k): k is string => !!k));
    const chosen = new Set(this.selectedRecords.map((r) => this.#keyOf(r)).filter((k): k is string => !!k));
    // Anything the grid cannot currently see keeps whatever it had.
    for (const k of this.#wantedKeys ?? []) if (!onPage.has(k)) chosen.add(k);
    this.#wantedKeys = chosen.size ? [...chosen] : null;
  }

  /** Emit the current selection BY KEY — every row has one now.
   *  TRAP T-a-made-up-key-never-leaves-the-data-layer */
  #emitSelection(): void {
    // BEFORE the event: a listener reading `selectedKeys` must see this choice.
    this.#rememberSelection();
    this.emit('selection-change', { selected: this.selectedKeys, records: this.selectedRecords });
  }

  /**
   * The key a row goes by: its `key` field when the grid was given one, else
   * the data layer's — a store's, or one made up beside the row. Never a
   * position, which a sort or a filter changes.
   * TRAP T-a-made-up-key-never-leaves-the-data-layer
   */
  #keyOf(row: GridRow): string | undefined {
    if (!this.#key) return rowKey(row) ?? keyRow(row);
    const own = row[this.#key];
    return own != null && own !== '' ? String(own) : undefined;
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
    /* A made-up key from ANOTHER page load names no row now — it would pick
       the wrong ones if its number were reused, so it is dropped and said.
       TRAP T-a-made-up-key-never-leaves-the-data-layer */
    const stale = keys.filter(isStaleKey);
    if (stale.length) {
      report({
        code: 'stale-made-up-key',
        message: 'select: a made-up row key from an earlier page load names no row; it was not kept.',
        at: { keys: stale.slice(0, 5).join(', ') },
      });
    }
    const fresh = keys.map(String).filter((k) => !isStaleKey(k));
    // REPLACES outright — unlike a user's tick, which merges.
    this.#wantedKeys = fresh.length ? fresh : null;
    this.#resolveSelection();
    // Drop UNMATCHED keys here, not via `#rememberSelection()`, which MERGES.
    // ONLY WHEN THERE WERE ROWS TO CHECK AGAINST: a saved view calls `select()`
    // before populate, so dropping against an empty grid throws the selection
    // away as it is restored. TRAP T-selection-lives-in-the-keys-not-the-objects.
    if (this.#rows.length) {
      const resolved = [...this.#selected].map((r) => this.#keyOf(r)).filter((k): k is string => !!k);
      this.#wantedKeys = resolved.length ? resolved : null;
    }
    // The boxes are stamped from #selected on every render, so a rebuild writes
    // the ticks — one path, not two.
    this.#renderBody();
    this.#syncSelected();
    this.#syncGroupSelects();
  }

  /**
   * Resolve the remembered keys against the rows the grid holds NOW — re-run on
   * every populate. TRAP T-grid-select-remembers-wanted-keys.
   */
  #resolveSelection(): void {
    this.#selected.clear();
    if (!this.#wantedKeys) return;
    const wanted = new Set(this.#wantedKeys);
    for (const row of this.#rows) {
      const key = this.#keyOf(row);
      if (key && wanted.has(key)) this.#selected.add(row);
    }
  }

  /** Select nothing. The same as `select([])`, said plainly. */
  clearSelection(): void {
    this.select([]);
  }

  /** The ticked rows by KEY — the name every ticked set shares (a transfer
   *  list's too). Setting it is `select()`: silent, and it replaces. */
  get selected(): string[] {
    return this.selectedKeys;
  }
  set selected(keys: readonly string[]) {
    this.select(keys);
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
    if (held && !held.suspended && this.#inForce(field, held).rows.length) return true;
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
    this.toggleState('no-matches', visible === 0 && this.#rows.length > 0);
    // DERIVE the select-all: a filter changes what is VISIBLE, not what is chosen.
    this.#syncSelected();
    this.#syncGroupSelects();

    this.emit('filter-change', {
      field,
      value,
      filters: Object.fromEntries(this.#filters),
      visible,
    });
  }
}

define('sherpa-data-grid', SherpaDataGrid);

/** Does a reading hold ANY answer — a tick, typed text or a row — in either mode? */
function answersAnything(reading: FieldReading): boolean {
  return (reading.picked ?? []).length > 0 || (reading.text ?? '').trim() !== ''
    || readingRows(reading).length > 0;
}
