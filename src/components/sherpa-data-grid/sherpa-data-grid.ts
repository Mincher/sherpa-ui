/**
 * sherpa-data-grid — the table; REPORTS sort, filter, paging and selection.
 *
 * `populate()` draws it, and a host owns every one of those — the grid only
 * reports what the reader did. What it draws, the data layer says (`ColumnFacts`);
 * its seams are modules beside it: grid-filters, grid-cells, grid-find,
 * grid-groups, grid-selection, grid-actions, grid-widths, grid-details. Plan 695 P4
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
import { advancedOf, type OffersAdvanced } from '../../core/ui/filter-kind.js';
import { FILTER_MENU_HTML, type FilterMenuDef } from '../../core/ui/filter-menu.js';
import type { FieldFilter } from '../../core/data/data-source.js';
import { DATA_PROPS, SHARED_PROPS, SherpaElement, define } from '../../core/ui/sherpa-element.js';
import { ORGANISE_ICONS, movedTo } from '../../core/ui/shared-constants.js';
import { nextSort, sortDirectionAttr, sortDirectionFrom } from '../../core/data/cycle.js';
import { ColumnFacts } from '../../core/data/column-facts.js';
import { offerAxis, type AxisOffer } from '../../core/data/query.js';
import { readField, valueKey, type FilterOp, type GroupSummary } from '../../core/data/store.js';
import type { ValueFacts } from '../../core/data/format-value.js';
import type { FieldReading } from '../../core/data/filter-state.js';
import { coalesce } from '../../core/data/timing.js';
import type { DataAsk, Take } from '../../core/ui/context.js';
import { GridActions } from './grid-actions.js';
import { GridCells } from './grid-cells.js';
import { GridDetails, type GridDetail } from './grid-details.js';
import { GridFilters, filterable } from './grid-filters.js';
import { GridFind } from './grid-find.js';
import { GridGroups } from './grid-groups.js';
import type { GridHost } from './grid-host.js';
import { GridSelection, type SelectBox } from './grid-selection.js';
import { GridWidths } from './grid-widths.js';

// SIDE-EFFECT imports: an undefined custom element renders inert.
import '../sherpa-quick-filter/sherpa-quick-filter.js';
import '../sherpa-button/sherpa-button.js';
import '../sherpa-menu/sherpa-menu.js';
import '../sherpa-select-checkbox/sherpa-select-checkbox.js';
import '../sherpa-select-radio/sherpa-select-radio.js';
import type { SherpaQuickFilter } from '../sherpa-quick-filter/sherpa-quick-filter.js';

export interface GridColumn extends OffersAdvanced {
  field: string;
  /** None: its source's label for the field, else the field. */
  header?: string;
  /** `server`: its filter is asked of the store; its provider tells the source. 345 phase 6 */
  fetch?: 'server';
  /** number → right-aligned mono cells; date → its day in words; anything else → default text. */
  type?: string;
  sortable?: boolean;
  /** false: its heading and cells offer no filter — a count, not a field. TODO 571 */
  filterable?: boolean;
  /** Which condition this column OPENS on — `'contains'` for free text. */
  op?: FilterOp;
  /** Drawn width in px, clamped. A user drag overrides it for the grid's life. */
  width?: number;
  /** Fields its cells draw as a second row of TAGS; its heading menu joins their
   *  lists. While `data-multi-field` is set. Will, TODO 490 */
  tags?: string[];
}

type GridRow = Record<string, unknown>;

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

/** What a page configures once, as properties. TRAP T-configuration-is-not-data */
interface Configured {
  columns: GridColumn[];
  key: string | null;
  actions: GridAction[];
}

interface GridConfig {
  columns: GridColumn[];
  rows: GridRow[];
  /** The field that names a row. Without it, the data layer's key does —
   *  never a position. TRAP T-a-made-up-key-never-leaves-the-data-layer */
  key?: string | null;
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
  /** Each row's OWN rows, by its key: a row OPENS on a sub-grid of them, under
   *  these columns. Will, TODO 570 */
  detail?: GridDetail;
  /** Each filterable column's FILTER as its source defines it, by field — so a
   *  heading opens the chip's own menu, the whole value list with it.
   *  TRAP T-a-heading-opens-the-chips-menu */
  filters?: Readonly<Record<string, FieldFilter>>;
  /** Each field's label as its source names it, for a heading with no filter (`filterable: false`). Plan 960 U2 */
  headings?: Readonly<Record<string, string>>;
  /** The fields its Group offers, as its app's `axes` leave them: a heading's Group
   *  button too. Will, TODO 662 */
  groupOffer?: AxisOffer;
}

/** What a row's sub-grid sends: none leaves the grid but its filter, sort and
 *  group, which are the grid's own. TODOs 570, 571, 574 · TRAP T-an-inner-event-stops-at-its-host */
const DETAIL_EVENTS = ['context-request', 'column-filter-change', 'column-resize', 'sort-change', 'row-select',
  'selection-change', 'group-toggle', 'group-change', 'row-action', 'page-change', 'grid-pages-change', 'select-all-request'];
const DETAIL_ASKS = ['column-filter-change', 'sort-change', 'group-change'] as const;
/** A literal type, so the spec reads the names it emits. */
const asks = (type: string): type is typeof DETAIL_ASKS[number] => (DETAIL_ASKS as readonly string[]).includes(type);


export class SherpaDataGrid extends SherpaElement {
  static override css = [
    new URL('../../core/sherpa-checkbox-look.css', import.meta.url),
    new URL('./sherpa-data-grid.css', import.meta.url),
  ];
  static override html = [FILTER_MENU_HTML, new URL('./sherpa-data-grid.html', import.meta.url)];

  /* DECLARED: CSS-only, so the base class writes nothing. A `:host([data-x])`
     rule is a public API and belongs in one place. */
  static override props = {
    'data-scroll-shadow': SHARED_PROPS['data-scroll-shadow'],
    'data-bounds': SHARED_PROPS['data-bounds'],
    // The fields the STORE answers, space-separated; read by its provider. 345 phase 6
    'data-fetch-fields': { type: 'string', kind: 'behaviour' },
    'data-total-pages': DATA_PROPS['data-total-pages'],
    'data-column-filters': { type: 'boolean', kind: 'style' },
    // A heading offers Group by its field. Will, TODO 500
    'data-heading-group': { type: 'boolean', kind: 'style' },
    // A heading shows its buttons only while hovered or focused. Will, TODO 501
    'data-heading-hover': { type: 'boolean', kind: 'style' },
    // A column's `tags` draw, and its heading menu joins their lists. Will, TODO 490
    'data-multi-field': { type: 'boolean', kind: 'behaviour' },
    // Its slot's Primary: the column that leads, pinned. Written by its provider. Will, TODO 548
    'data-primary-field': { type: 'string', kind: 'behaviour' },
    'data-locked': DATA_PROPS['data-locked'],
    'data-apply-on': DATA_PROPS['data-apply-on'],
    'data-sort-field': DATA_PROPS['data-sort-field'],
    'data-sort-direction': DATA_PROPS['data-sort-direction'],
    'data-group-field': DATA_PROPS['data-group-field'],
    // Fields an EXTERNAL filter narrows — the only way a column filtered from
    // outside can light its own header.
    'data-filter-fields': DATA_PROPS['data-filter-fields'],
    // The fields its source says wait for Apply, or could not be read: its headings say so.
    'data-pending': { type: 'string', kind: 'behaviour' },
    'data-failed': { type: 'string', kind: 'behaviour' },
    'data-page': DATA_PROPS['data-page'],
    'data-page-size': DATA_PROPS['data-page-size'],
    // What a toolbar chip is matching on, so its hits mark in the cells.
    'data-needles': { type: 'string', kind: 'behaviour' },
    // The WHOLE column's values, so a filter menu is never a one-way door.
    'data-selectable': { type: 'boolean', kind: 'style' },
    // Single vs multiple changes the CONTROL each row draws, so it re-renders.
    'data-select': { type: 'enum', kind: 'style', values: ['single', 'multiple'] },
    // The provider's Limit switches: its heading menus hide what Limit rules out. TODO 305
    'data-limit-options': { type: 'enum', kind: 'behaviour', values: ['on', 'off'] },
    'data-hide-unmatched': { type: 'enum', kind: 'behaviour', values: ['on', 'off'] },
  } as const;
  static override observed = [
    'data-bounds', 'data-primary-field', 'data-apply-on', 'data-sort-field',
    'data-sort-direction', 'data-group-field', 'data-filter-fields', 'data-pending', 'data-failed',
    'data-page', 'data-page-size', 'data-needles', 'data-select', 'data-limit-options', 'data-hide-unmatched',
  ];

  /* A PAGE of rows, with its groups. TRAP T-a-component-asks-its-provider */
  static override asks: DataAsk = {
    shape: 'rows',
    // Its headings' FILTERS, as the source defines them. TRAP T-a-heading-opens-the-chips-menu
    filters: (el) => [...new Set(((el as unknown as { columns?: GridColumn[] }).columns ?? [])
      .flatMap((c) => [...(filterable(c) ? [c.field] : []), ...c.tags ?? []]))],
    // What its cells read, tags too, and its row key; no columns yet, every field. TRAP T-a-held-set-reads-the-pages-fields
    fields: (el) => {
      const { columns = [], key } = el as unknown as { columns?: GridColumn[]; key?: string | null };
      return columns.length ? [...new Set([...columns.flatMap((c) => [c.field, ...c.tags ?? []]), ...(key ? [key] : [])])] : undefined;
    },
  };
  // …and a hover's matches.
  static takes: readonly Take[] = ['highlight'];
  // Show as's Data Grid: any chart's data, as a table, its headings and cells filtering. Will, TODOs 548, 621
  static override presents = { kind: 'grid', accepts: ['segments', 'series', 'aggregate'], is: { 'data-column-filters': '', 'data-scroll-shadow': '' } } as const;
  // The app's settings it reads: its headings' Limit, Group, hover and tags. TODOs 178, 500, 501, 490
  static override settings = {
    'data-limit-options': 'limitOptions', 'data-hide-unmatched': 'hideUnmatched', 'data-heading-group': 'headingGroup',
    'data-heading-hover': 'headingHover', 'data-multi-field': 'multiFieldColumns',
  };

  /* CONFIGURATION a page sets once; rows and groups arrive as data beside it.
     TRAP T-configuration-is-not-data */
  #config: Configured = { columns: [], key: null, actions: [] };
  /** The last data, less what it configured: what a new setting redraws beside. */
  #lastData: unknown = {};
  /** A redraw for new settings is queued. */
  #reconfiguring = false;

  get columns(): GridColumn[] {
    return this.#config.columns;
  }
  set columns(columns: GridColumn[]) {
    this.#configure({ columns });
  }
  /** The field that names a row — selection follows it. */
  get key(): string | null {
    return this.#config.key;
  }
  set key(key: string | null) {
    this.#configure({ key });
  }
  get actions(): GridAction[] {
    return this.#config.actions;
  }
  set actions(actions: GridAction[]) {
    this.#configure({ actions });
  }

  /** Every setting made in one moment redraws ONCE — three setters in a row
   *  would each draw the config the one before had not drawn yet. */
  #configure(set: Partial<Configured>): void {
    this.#config = { ...this.#config, ...set };
    if (this.#reconfiguring) return;
    this.#reconfiguring = true;
    queueMicrotask(() => {
      this.#reconfiguring = false;
      // Not populate(): what the caller last gave stays theirs.
      void this.rendered.then(() => this.renderData(this.#lastData));
    });
  }

  /** Data over the configuration: a name it carries is SET, the rest arrives
   *  beside what the page configured. Rows alone are rows. */
  #withConfig(data: unknown): Partial<GridConfig> & { pivot?: Partial<GridConfig> } {
    if (!data || typeof data !== 'object') return {};
    this.#lastData = data;
    if (Array.isArray(data)) return { ...this.#config, rows: data as GridRow[] };
    const rest: Record<string, unknown> = {};
    for (const [name, value] of Object.entries(data)) {
      if (name in this.#config) this.#config = { ...this.#config, [name]: value };
      else rest[name] = value;
    }
    this.#lastData = rest;
    return { ...this.#config, ...rest };
  }

  /** `key` by the name a framework can bind: React and Vue keep `key` for
   *  themselves. TODO 211 */
  get rowKey(): string | null {
    return this.key;
  }
  set rowKey(field: string | null) {
    this.key = field;
  }

  // data-selectable is observed though CSS owns its reveal: the pin offset is a
  // MEASURED width, so it must re-run its measure.

  /* TRAP T-grid-column-width-bounds — CSS sets the bounds in `ch`; 160 is measured, not chosen. */
  static readonly DEFAULT_COL_WIDTH = 160;

  /**
   * Shared with the quick-filter toolbar, so a header and a chip cannot disagree
   * about "descending". `sort-none` is the neutral pair: three bars read as a menu.
   */
  static readonly icons = ORGANISE_ICONS;

  /** The columns, as populated. */
  #columns: GridColumn[] = [];
  /** The rows, as populated. */
  #rows: GridRow[] = [];
  /** What the data layer says of them: their order, the page, the groups, each column's values. Plan 695 P4 */
  #data = new ColumnFacts([]);
  /** The field that identifies a row, or null to select by position. */
  #key: string | null = null;
  /** What each row opens on, where it opens. TODO 570 */
  #detail: GridDetail | null = null;
  /** What its Group offers, as the app's `axes` leave it; none, every list column. TODO 662 */
  #groupOffer: AxisOffer | undefined;
  /** The highlight's test, as last drawn. */
  #highlight: ((row: GridRow) => boolean) | null = null;
  /** Each drawn row's record. */
  #rowOf = new WeakMap<Element, GridRow>();
  /** Watches the scroll box, so a wider card re-shares its slack. Kept across a
   *  move: onRender runs once, and a detached box simply reports nothing. */
  #fillWatch: ResizeObserver | null = null;

  /** Its own helpers, as each module asks them. */
  readonly #host: GridHost = {
    el: this,
    $: (sel) => this.$(sel),
    $$: (sel) => this.$$(sel),
    clone: (from) => this.clone(from),
    word: (key) => this.word(key),
    writeIcon: (el, value) => this.writeIcon(el, value),
    toggleState: (name, on) => this.toggleState(name, on),
    recordFor: (el) => {
      const tr = el.closest('.row');
      return tr ? this.#rowOf.get(tr) : undefined;
    },
  };
  /** Its column filters: each heading's menu, what it holds, what it reports. */
  readonly #filters = new GridFilters({
    ...this.#host,
    root: this.root,
    columns: () => this.#columns,
    facts: () => this.#data,
    drawReadings: (head) => this.#drawReadings(head),
    reported: (detail) => this.emit('column-filter-change', detail),
  });
  /** Its Find, and the needles from outside. */
  readonly #find = new GridFind(this.#host);
  /** Its cells' marks, tags, statuses and the cell chip. */
  readonly #cells = new GridCells({
    ...this.#host,
    root: this.root,
    columns: () => this.#columns,
    filters: this.#filters,
    find: this.#find,
    drawReadings: () => this.#drawReadings(),
  });
  /** Its groups and its visual page. */
  readonly #groups = new GridGroups({
    ...this.#host,
    group: () => this.#groupField,
    facts: () => this.#data,
    ordered: () => this.hasAttribute('data-locked') || !!this.#detail,
    actions: () => this.#actions.list.length,
    redraw: () => {
      this.#renderBody();
      // The body was replaced, so its marks are drawn again from what is held.
      this.#selection.sync();
      this.#selection.syncCurrent();
    },
    paged: (pages, page) => this.emit('grid-pages-change', { pages, page }),
    toggled: (value, collapsed) => this.emit('group-toggle', { value, collapsed }),
  });
  /** Its selection and its current row. */
  readonly #selection = new GridSelection({
    ...this.#host,
    rows: () => this.#rows,
    visible: () => this.#groups.page().all,
    key: () => this.#key,
    paginates: () => this.#groups.paginates,
    pages: () => this.num('data-total-pages', 1),
    redraw: () => this.#renderBody(),
    changed: (selected, records) => this.emit('selection-change', { selected, records }),
    askEvery: (answer) => !this.emit('select-all-request', { answer }, { cancelable: true }),
  });
  /** Its row actions and their one menu. */
  readonly #actions = new GridActions({
    ...this.#host,
    // SLOTTED light-DOM buttons; each icon is DRAWN here, as a field name in the markup reads as an icon name.
    stamp: (actions) => this.renderItems('.actions-menu', 'template.action-item-tpl', actions, {
      after: (item, action) => { if (action.icon) this.writeIcon(item.querySelector('.action-icon')!, action.icon); },
    }),
    chosen: (id, records) => this.emit('row-action', { id, records }),
  });
  /** Its column widths and the resize grip. */
  readonly #widths = new GridWidths({
    ...this.#host,
    fallback: SherpaDataGrid.DEFAULT_COL_WIDTH,
    shown: () => this.#shownColumns(),
    hasRows: () => this.#rows.length > 0,
    hasActions: () => this.#actions.list.length > 0,
    stampCols: (shown, after) => {
      // `own-children`, not `replace`: the fixed `.select-col` must survive.
      this.renderItems('.cols', 'template.col-tpl', shown, {
        clear: 'own-children',
        ownSel: '.cols > .col',
        after: (node, col) => {
          node.dataset['field'] = col.field;
          after(node, col);
        },
      });
      // The static ACTIONS <col> sits BEFORE the stamped ones, so it moves to the
      // end — a <col> list out of step gives every width to the wrong column.
      const actionsCol = this.$('.cols > .actions-col');
      if (actionsCol) this.$('.cols')?.appendChild(actionsCol);
    },
    resized: (field, width) => this.emit('column-resize', { field, width }),
  });
  /** The rows its rows open on. */
  readonly #details = new GridDetails({
    ...this.#host,
    detail: () => this.#detail,
    key: () => this.#key,
    actions: () => this.#actions.list.length,
    filters: () => this.#filters.given,
    groupOffer: () => this.#groupOffer,
    filter: this.#filters.filter,
    highlight: () => this.#highlight,
    redraw: () => this.#renderBody(),
    partsOf: (sub) => ({ head: sub.$<HTMLElement>('.head'), table: sub.$('.grid')?.getBoundingClientRect() }),
  });

  override onRender(): void {
    /* A row's SUB-GRID is this grid's part: it is filled from here, and never
       asks the provider — it would join this grid's scope. Its filter, sort and
       group are this grid's: the same rows, organised. TODOs 570, 571, 574 ·
       TRAP T-an-inner-event-stops-at-its-host */
    for (const type of DETAIL_EVENTS) this.root.addEventListener(type, (event) => {
      if (!(event.target as Element | null)?.closest?.('.detail-row')) return;
      event.stopPropagation();
      if (asks(type)) this.emit(type, (event as CustomEvent).detail);
    });
    const head = this.$('.head-row');
    const body = this.$('.body');
    // TRAP T-grid-header-needs-capture — the chip's stopPropagation() hides the
    // click that IS the sort from a bubbling listener.
    head?.addEventListener('click', this.#onHeaderClick, true);
    body?.addEventListener('click', this.#onRowClick);
    this.$('.select-all')?.addEventListener('change', this.#selection.all);
    this.$('.select-all')?.addEventListener('selection-scenario', this.#selection.scenario);
    body?.addEventListener('change', this.#selection.row);
    head?.addEventListener('pointerdown', this.#widths.grip);
    // A re-stamp's observer replaces the last; the select cell too, for a density change.
    this.#fillWatch?.disconnect();
    this.#fillWatch = new ResizeObserver(() => this.#widths.measure(true));
    // …and the header, whose foot the rows' shadow hangs from. TODO 481
    for (const box of [this.$('.scroller'), this.$('.head-row > .select-cell'), this.$('.head')]) if (box) this.#fillWatch.observe(box);
    // Both footer buttons commit. Delegated — a heading cell can be made again.
    head?.addEventListener('menu-apply', this.#filters.commit);
    head?.addEventListener('menu-clear', this.#filters.commit);
    // TRAP T-grid-chip-vocabulary-stops-here — a bound DataSource would read
    // the chip's quick-filter-change as the WHOLE filter.
    for (const type of ['quick-filter-change', 'quick-filter-click']) head?.addEventListener(type, this.#filters.stop);
    // A heading's Sort and Group are its parts: their own press stops here. TRAP T-an-inner-event-stops-at-its-host
    head?.addEventListener('button-click', (event) => {
      if ((event.target as Element).closest('.head-sort, .head-group')) event.stopPropagation();
    });
    head?.addEventListener('menu-select', this.#filters.remove);
    // Delegated: the body is replaced per render. The menu sits outside it.
    body?.addEventListener('click', this.#actions.click);
    this.$('.actions-menu')?.addEventListener('menu-select', this.#actions.select);
    this.$('.actions-menu')?.addEventListener('menu-close', this.#actions.shut);
    body?.addEventListener('pointerover', this.#cells.over);
    body?.addEventListener('pointerleave', this.#cells.leave);
    const scroller = this.$('.scroller');
    if (scroller) this.onFrame(scroller, 'scroll', this.#details.stick);
    this.#cells.take(this.$<SherpaQuickFilter>('.cell-filter'));
    if (this.#columns.length) this.#render();
  }

  /** Each attribute redraws only what it draws. TODO 355 C3 · TRAP T-a-grid-draws-once-per-moment */
  override onChange(name: string): void {
    switch (name) {
      case 'data-filter-fields':
        this.#filters.syncStatus();
        this.#syncEmpty();
        return;
      case 'data-pending': case 'data-failed':
        this.#filters.syncStatus();
        return;
      case 'data-primary-field':
        this.#render();
        return;
      // Read when asked, or drawn by CSS.
      case 'data-locked': case 'data-column-filters':
        return;
      case 'data-needles':
        this.#find.read(this.dataset['needles']);
        this.#syncEmpty();
        this.#invalidate('body');
        return;
      case 'data-page': case 'data-page-size':
        this.#invalidate('body');
        return;
      case 'data-sort-field': case 'data-sort-direction':
        this.#invalidate('head');
        this.#invalidate('body');
        return;
      case 'data-limit-options': case 'data-hide-unmatched':
        this.#filters.filter.limitAll();
        return;
      default:
        this.#find.read(this.dataset['needles']);
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

  /** The owed render, at the end of this moment — once the rows on their way are here. */
  #schedule = coalesce((): void => {
    if (!this.#awaitingData && !this.#loading) this.#flush();
  });

  /** Its source is reading its rows again. */
  #loading = false;

  /** drawLoading(loading) — its source is reading its rows again: what a reading
   *  owes the body is drawn once, with them; done, whatever is still owed. Plan 695 P4
   *  · TRAP T-a-grid-draws-once-per-moment */
  drawLoading(loading: boolean): void {
    this.#loading = loading;
    if (!loading && this.#dirty.size) this.#schedule();
  }

  /** What its headings hold moved: they draw now — `head`, the whole row — and the body
   *  once, at the end of this moment, or with the rows a bound grid is about to be given. */
  #drawReadings(head = true): void {
    if (head) this.#renderHead();
    this.#filters.syncStatus();
    this.#invalidate('body');
  }

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
      this.#selection.sync();
      this.#selection.syncCurrent();
    }
    this.#pinSelects();
    this.#widths.measure();
  }

  /** populate({ columns, rows }) — the rows, over the configuration the page set. */
  protected override renderData(data: unknown): void {
    this.#awaitingData = false;
    // Rows alone — a bind with no adapter — are rows, under the columns the page set. TODO 518
    const given = this.#withConfig(data);
    /* A PIVOT draws its own rows and columns while its slot names a Secondary,
       and never keeps them: its own come back after. Will, TODO 548 */
    const cfg = given.pivot ? { ...given.pivot, actions: [] } : given;
    this.#columns = Array.isArray(cfg.columns) ? cfg.columns : [];
    this.#rows = Array.isArray(cfg.rows) ? cfg.rows : [];
    this.#data = new ColumnFacts(this.#rows, Array.isArray(cfg.groups) ? cfg.groups : null);
    this.#key = typeof cfg.key === 'string' ? cfg.key : null;
    this.#filters.take(cfg.filters, cfg.headings);
    this.#groupOffer = cfg.groupOffer;
    this.#find.read(this.dataset['needles']);
    this.#actions.take(cfg.actions);
    this.#detail = cfg.detail ?? null;
    this.toggleState('detail', !!this.#detail);
    this.toggleState('actions', this.#actions.list.length > 0);
    // TRAP T-grid-populate-keeps-column-filters — column filters drop only where
    // the COLUMN went, selection re-resolves by KEY.
    // …or the sub-grid's, which shows them too. TODO 571
    const fields = new Set([...this.#columns, ...this.#detail?.columns ?? []].map((c) => c.field));
    this.#filters.filter.forget(undefined, fields);
    this.#selection.resolve();
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
    this.toggleState('no-matches', none && filtered);
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
    this.#selection.sync();
    this.#selection.syncCurrent();
    this.#pinSelects();
    this.#widths.measure();
  }

  /** Flag one cell as frozen. `data-pin-last` draws the scroll shadow. */
  #markPinned(cell: HTMLElement, last: boolean): void {
    cell.toggleAttribute('data-pinned', true);
    cell.toggleAttribute('data-pin-last', last);
  }

  /** Freeze the selection cells while they show — writes only; the widths read the
   *  offset. TRAP T-grid-pin-offset-is-measured — only a revealed selection cell
   *  may claim the offset. */
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

  /** Draw the heading row: sort, filter and resize for each column. Each cell is
   *  KEPT, by field, and drawn in place; one is made again only when its column's
   *  type or its filter's shape changed. TODO 355 C5 · TRAP T-a-heading-cell-is-kept */
  #renderHead(): void {
    this.#widths.stamp();
    const headRow = this.$('.head-row');
    const tpl = this.$<HTMLTemplateElement>('template.head-cell-tpl');
    if (!headRow || !tpl) return;
    const filters = this.#filters;
    const kept = new Map(this.$$<HTMLElement>('.head-row > .head-cell').map((th) => [th.dataset['field'] ?? '', th]));
    // The fixed leading select <th> leads; each cell follows the one before it.
    let before: Element | null = headRow.querySelector(':scope > .select-head');
    filters.begin();
    this.#shownColumns().forEach((col, i) => {
      // A multi-field column's menu JOINS its fields' lists. Will, TODO 490
      const join = filters.join(col);
      const held = join ? join.held : filters.shown(col.field);
      /* A tiered field's CHILD has no filter of its own: its picks are its parent's
         (TODO 369). While a higher scope holds that parent it shows, greyed. Will, TODO 577 */
      const parent = filters.parentOf(col.field);
      const def = join?.def ?? (filterable(col) && (!parent || filters.filter.holds(parent)) ? filters.def(col, held) : null);
      const key = filters.cellKey(col, def);
      let th = kept.get(col.field);
      kept.delete(col.field);
      if (!th || this.#cellKeys.get(th) !== key) {
        // Imported, so its menu takes its items at once. TRAP T-custom-element-upgrade
        const made = this.clone(tpl);
        if (!made) return;
        made.dataset['field'] = col.field;
        if (def) filters.build(made, def);
        // The chip's own flag, so CSS hides it without reaching into its shadow.
        else made.querySelector('.head-filter')?.setAttribute('data-unsupported', '');
        this.#cellKeys.set(made, key);
        filters.made(col.field);
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
  }

  /** Each heading cell's key, as it was made. */
  #cellKeys = new WeakMap<HTMLElement, string>();

  // TRAP T-grid-thead-sticks-as-one-block — no sticky-offset measurement here.

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
    if (def) this.#filters.draw(th, col, def, held);
    this.#filters.light(th, col.field);
    const sortable = col.sortable !== false;
    th.dataset['sortable'] = String(sortable);
    // Its column's word, else its source's: a field's label is said once. Plan 960 U2
    const name = this.#filters.fieldLabel(col.field);
    const label = th.querySelector('.head-label');
    if (label && label.textContent !== name) label.textContent = name;
    // SORTED means APPLIED, not remembered — a suspended column keeps its
    // field and an empty direction. TRAP T-a-suspended-sort-is-one-owners-job.
    const sorted = sortable && col.field === sortField && sortDir !== '';
    if (sorted) th.dataset['sort'] = sortDir ?? 'asc';
    else delete th.dataset['sort'];
    this.#filters.lightHeading(th, col.field);

    /* GROUP by a list field only: the source's rule, read from the filter it gave;
       alone, not a number or a date. Pressed while it groups. Will, TODOs 500, 523 */
    const group = th.querySelector<HTMLElement>('.head-group');
    if (group) {
      group.dataset['iconStart'] = SherpaDataGrid.icons.group;
      const given = this.#filters.given[col.field];
      const list = col.type !== 'number' && col.type !== 'date' && (!given || advancedOf(given) !== 'only')
        // …and one the app's Group offers. Will, TODO 662
        && offerAxis([col], this.#groupOffer).length > 0;
      group.toggleAttribute('data-unsupported', !list);
      this.#press(group, this.dataset['groupField'] === col.field);
      group.setAttribute('aria-label', `${this.word('group-by')} ${name}`);
    }

    // Pressed while it sorts. TRAP T-grid-sort-glyph-needs-a-third-state.
    const sort = th.querySelector<HTMLElement>('.head-sort');
    if (sort) {
      const { sortNone, sortAsc, sortDesc } = SherpaDataGrid.icons;
      sort.dataset['iconStart'] = !sorted
        ? sortNone
        : (sortDir === 'desc' ? sortDesc : sortAsc);
      this.#press(sort, sorted);
      sort.toggleAttribute('data-unsupported', !sortable);
      sort.setAttribute('aria-label', sorted
        ? `${this.word('sorted-by')} ${name}, ${this.word(sortDir === 'desc' ? 'desc' : 'asc')}`
        : `${this.word('sort-by')} ${name}`);
    }
  }

  /** A heading's toggle, pressed or not: pressed, the default look's active face — a
   *  chip's on face; at rest, no chrome. Plan 695 P4 */
  #press(button: HTMLElement, pressed: boolean): void {
    button.setAttribute('aria-pressed', String(pressed));
    if (pressed) button.removeAttribute('data-look');
    else button.setAttribute('data-look', 'transparent');
  }

  /**
   * The columns the table draws. The grouped one is dropped — its value IS the
   * group heading — but `#columns` stays intact, so un-grouping needs no populate.
   */
  #shownColumns(): GridColumn[] {
    const group = this.#groupField;
    // Its PRIMARY leads, where the first column is pinned. Will, TODO 548
    const lead = this.dataset['primaryField'];
    const ordered = lead ? [...this.#columns].sort((a, b) => Number(b.field === lead) - Number(a.field === lead)) : this.#columns;
    return group ? ordered.filter((c) => c.field !== group) : ordered;
  }

  /** What this grid groups by: nothing where its rows open — its Group groups each
   *  row's sub-grid. Primary, Secondary, Group are a chain. Will, TODO 574 */
  get #groupField(): string | undefined {
    return this.#detail ? undefined : this.dataset['groupField'];
  }

  /** Draw the rows — with a group heading at each change, when grouped. */
  #renderBody(): void {
    const body = this.$('.body');
    const rowTpl = this.$<HTMLTemplateElement>('template.row-tpl');
    const cellTpl = this.$<HTMLTemplateElement>('template.cell-tpl');
    if (!body || !rowTpl || !cellTpl) return;

    const group = this.#groupField;
    const columns = this.#shownColumns();
    const filters = this.#filters;
    const cells = this.#cells;
    const selection = this.#selection;
    // A column draws tags: every row is two lines, so the values align. Will, TODO 509
    this.toggleState('multi-field', columns.some((c) => filters.tagsOf(c).length > 0));
    // The cell chip goes home first: it would leave with its row. TRAP T-a-cell-chip-is-one-and-moves
    cells.park();
    body.replaceChildren();
    const tagTip = this.$('.tag-tip');
    if (tagTip) tagTip.textContent = filters.filter.heldFields.length ? movedTo(filters.filter.heldAt) : '';

    // Each <tr>'s index is its place in the list as ordered, so row-click and
    // selection-change name the row the user sees; grouped, one page of it.
    const { rows, offset, pages } = this.#groups.page();
    let lastGroup: string | null = null;
    // Each tag field's value names, each status field's looks, and each field's words, read once a draw.
    const looks = new Map<string, Map<string, string>>();
    const marks = new Map<string, Map<string, { status: string; label: string }>>();
    const known = new Map<string, ValueFacts>();
    const groupCol = group ? this.#columns.find((c) => c.field === group) ?? { field: group } : null;
    // Each row's selection cell is drawn frozen: no caller has to pin it after.
    const selectable = this.hasAttribute('data-selectable');

    rows.forEach((record, i) => {
      if (group && groupCol) {
        // Keyed as the data layer keys a group, so a told count is found. TODO 523
        const value = readField(record, group);
        const key = valueKey(value);
        if (key !== lastGroup) {
          lastGroup = key;
          // The COUNT spans every page, so a group split by a boundary still
          // says how many rows it holds.
          body.appendChild(this.#groups.heading(key, this.#data.count(group, key), columns.length, cells.words(groupCol, value, known)));
        }
      }

      // Its icons upgraded too. TRAP T-a-cloned-prototype-needs-its-icons-upgraded
      const tr = this.clone(rowTpl)!;
      this.#rowOf.set(tr, record);
      tr.dataset['index'] = String(offset + i);
      /* Only the box this mode shows stays: a hidden one still upgrades and stamps,
         and a mode change draws the rows again. TRAP T-a-row-holds-two-selection-boxes
         · TRAP T-compose-never-reimplement */
      const unused = selection.single ? '.row-multi' : '.row-one';
      for (const box of tr.querySelectorAll('.row-select')) if (!selectable || box.matches(unused)) box.remove();
      // One NAME per grid: the radio's group. TRAP T-radios-in-shadow-roots-are-not-one-group
      tr.querySelector<SelectBox>('.row-one')?.setAttribute('name', selection.name);
      const ticked = selection.has(record);
      for (const box of tr.querySelectorAll<SelectBox>('.row-select')) box.checked = ticked;
      tr.toggleAttribute('data-selected', ticked);
      tr.toggleAttribute('data-highlight', !!this.#highlight?.(record));
      const select = tr.querySelector<HTMLElement>('.select-cell');
      if (selectable && select) this.#markPinned(select, false);
      // Its group, so CSS hides it when that group is shut — no `display` write.
      if (group && lastGroup !== null) tr.dataset['groupKey'] = lastGroup;
      columns.forEach((col, c) => {
        const td = this.clone(cellTpl);
        if (!td) return;
        if (col.type) td.dataset['type'] = col.type;
        td.dataset['field'] = col.field;
        if (c === 0) this.#markPinned(td, true);
        const value = readField(record, col.field);
        // A STATUS field's value draws its icon and label. Will, plan 683 · TRAP T-a-status-is-worked-out-by-the-data
        const status = value == null ? undefined : cells.status(col.field, valueKey(value), marks);
        if (status) cells.drawStatus(td, status);
        // …any other, its words; its sort and filter read the raw value. TRAP T-a-cell-draws-words-not-its-value
        else cells.fill(td, cells.words(col, value, known), col);
        // No tag of the field it groups by: its heading says it. Will, TODO 579
        const tags = filters.tagsOf(col).filter((f) => f !== group);
        if (tags.length) cells.tags(td, record, tags, looks);
        tr.appendChild(td);
      });
      /* The actions cell is in the template already, so it is MOVED, not
         created — appendChild on an existing child re-parents it to the end. */
      const actionsCell = tr.querySelector('.actions-cell');
      if (actionsCell) tr.appendChild(actionsCell);
      body.appendChild(tr);
      if (this.#detail) this.#details.draw(tr, record, body, columns.length);
    });

    if (group) this.#groups.syncShut();
    // Folding changes how many pages there ARE. After the draw, so a host that
    // re-renders finds the DOM settled.
    this.#groups.report(pages);
    // A Find that stepped off the last page lands on this one's first match.
    this.#find.land();
    // The pointer has not moved, but the cell under it is new.
    cells.placeAgain();
  }

  /* ── Interaction ────────────────────────────────────────────────── */

  /** A heading's SORT button was clicked: cycle its sort — unless a resize just
   *  ended. The rest of the heading sorts nothing. Will, TODO 502 · TRAP T-grid-sort-is-tri-state */
  #onHeaderClick = (event: Event): void => {
    // A RESIZE just ended and the browser is synthesising its click.
    if (this.#widths.swallowed(event)) return;
    // GROUP by this column; pressed, it stops. Will, TODO 500
    const group = (event.target as HTMLElement).closest<HTMLElement>('.head-group');
    if (group) {
      const field = group.closest<HTMLElement>('.head-cell')?.dataset['field'];
      if (field) this.#askGroup(group.getAttribute('aria-pressed') === 'true' ? null : field);
      return;
    }
    // Only the SORT button cycles; it carries no menu, so its click falls through to here.
    if (!(event.target as HTMLElement).closest('.head-sort')) return;
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

    // The INTENT, always, in the Sort chip's shape: `field: null` on a suspend is
    // what the query hears; the source remembers the column. TODO 523 S10
    this.emit('sort-change', {
      field: next.direction === null ? null : next.field,
      direction: next.direction ?? 'asc',
    });
  };

  /** A row was clicked: report it — unless it was the select box or the actions. */
  #onRowClick = (event: Event): void => {
    const target = event.target as HTMLElement;
    // A click on a selection checkbox is selection, not row activation.
    if (target.closest('.select-cell')) return;
    // A row's toggle opens it on its rows; its sub-grid is its own. TODO 570
    const open = target.closest<HTMLElement>('.row-open');
    if (open) return this.#details.toggle(open.closest<HTMLElement>('.row'));
    if (target.closest('.detail-row')) return;
    /* …and a click in the ACTIONS cell is the menu. Guarded HERE, not by
       stopPropagation there: both listeners sit on `.body` and fire in
       REGISTRATION order, so stopping it later is too late. */
    if (target.closest('.actions-cell')) return;
    // …and the cell's filter chip is a filter, not the row.
    if (target.closest('.cell-filter')) return;
    // …and a TAG filters by its value. Will, TODO 490
    const tag = target.closest<HTMLElement>('.cell-tag');
    if (tag) return this.#cells.tag(tag);

    // A group row is a heading, not a record: clicking it anywhere folds it.
    const groupRow = target.closest<HTMLElement>('.group-row');
    if (groupRow) {
      if (target.closest('.group-select')) return;
      // …but Ungroup stops the grouping. Will, TODO 500
      if (target.closest('.group-ungroup')) return this.#askGroup(null);
      this.#groups.fold(groupRow);
      return;
    }

    const tr = target.closest<HTMLElement>('.row');
    const raw = tr?.dataset['index'];
    if (!tr || raw == null) return;
    const record = this.#rowOf.get(tr);
    this.#selection.clicked(record);
    this.emit('row-select', { index: Number(raw), row: record });
  };

  /** Group by a field, or stop: written here only while nothing owns it, and
   *  always asked. TRAP T-bind-locks-what-it-owns */
  #askGroup(field: string | null): void {
    if (!this.hasAttribute('data-locked')) this.set('data-group-field', field);
    this.emit('group-change', { field });
  }

  /* ── The JS API — what a person can do by clicking, a caller can do by calling ── */

  /**
   * drawPresent(present, scope) — a bound source says what the filters before
   * each field leave; a heading's menu greys the rest. A field not named is not
   * limited. TRAP T-a-ruled-out-value-is-greyed
   */
  drawPresent(present: Readonly<Record<string, readonly string[]>>): void {
    this.#filters.filter.drawPresent(present);
    this.#details.tellAll();
  }

  /** drawHighlight(test) — a bound source says which rows the highlight's
   *  driver matches; `null`, none. Each row CSS tints. Will, TODO 441 */
  drawHighlight(matches: ((row: GridRow) => boolean) | null): void {
    this.#highlight = matches;
    for (const tr of this.$$<HTMLElement>('.row')) tr.toggleAttribute('data-highlight', !!matches?.(this.#rowOf.get(tr) ?? {}));
    for (const sub of this.$$<SherpaDataGrid>('.detail-grid')) sub.drawHighlight(matches);
  }

  /** drawOffered(offered) — what each serial-set field OFFERS: a heading's menu
   *  removes the rest, but keeps a pick. TRAP T-a-filter-set-groups-or-chains */
  drawOffered(offered: Readonly<Record<string, readonly string[]>>): void {
    this.#filters.filter.drawOffered(offered);
    this.#details.tellAll();
  }

  /**
   * Set one column's filter from OUTSIDE. TRAP
   * T-grid-read-without-write-is-half-an-api — SILENT unbound, and takes the
   * clause `column-filter-change` reports; BOUND, it asks as a reader would.
   */
  setColumnFilter(field: string, clause: unknown[] | null): void {
    this.#filters.set(field, clause);
  }

  /**
   * supersede(readings, appliedAt) — the fields a HIGHER scope holds,
   * each with the answer it holds there. A named heading SHOWS that answer,
   * read-only, with the superseded look and tip, so no contradicting pick can
   * be made in it; a heading not named is released. Will, 2026-09-26.
   * TRAP T-a-view-held-heading-shows-and-refuses
   */
  supersede(readings: Readonly<Record<string, FieldReading>>, appliedAt?: string): void {
    // The MARKS follow the answer that filters.
    if (this.#filters.filter.supersede(readings, appliedAt)) this.#drawReadings();
  }

  /**
   * One column's filter as a ready FilterClause, or null. TRAP
   * T-grid-suspend-is-not-clear — a SUSPENDED clause is returned too.
   */
  columnClause(field: string): unknown[] | null {
    return this.#filters.clauseOf(field);
  }

  /** One column's filter as a READING, or null — what a saved view set on it. */
  columnReading(field: string): FieldReading | null {
    return this.#filters.readingOf(field);
  }

  /**
   * drawReading(field, reading) — a bound source tells this grid one column's
   * answer, whoever set it: a chip, the panel, a restored Query. SILENT.
   * TRAP T-one-query-one-owner
   */
  drawReading(field: string, reading: FieldReading): void {
    /* HELD AS IT IS — both answers and the mode, kept even before the columns
       arrive: a restore draws first. TRAP T-both-answers-are-kept */
    this.#filters.filter.drawReading(field, reading);
  }

  /**
   * One column filter AS A READER SEES IT — "Contains: ana", "Is not: churned".
   * `column-filter-change` carries this same string, so an interaction and a
   * restore describe a filter identically.
   * TRAP T-grid-read-without-write-is-half-an-api
   * TRAP T-a-restored-filter-still-needs-its-chip
   */
  columnLabel(field: string): string | null {
    return this.#filters.labelOf(field);
  }

  /** Suspend or resume, never lose; bound, it asks. TRAP T-grid-suspend-is-not-clear. */
  suspendColumnFilter(field: string, suspended = true): void {
    this.#filters.suspend(field, suspended);
  }

  /**
   * Open one column's filter menu, anchored where the caller says. TRAP
   * T-grid-toolbar-chip-borrows-the-menu — one menu serves both.
   */
  openColumnFilter(field: string, anchor?: HTMLElement): void {
    this.#flush();
    /* Ask the CHIP, not its menu: the chip owns the light-dismiss-safe open, and
       reaching past it to `menu.toggle()` brought the stuck-open bug back
       through this door. The anchor still travels — a toolbar chip borrows this
       menu and must see it over ITSELF.
       TRAP T-a-trigger-click-follows-light-dismiss · T-grid-toolbar-chip-borrows-the-menu */
    this.$<SherpaQuickFilter>(`.head-cell[data-field="${CSS.escape(field)}"] .head-filter`)?.toggleMenu?.(anchor);
  }

  /**
   * Drop one column's heading filter from OUTSIDE; nothing drops them all.
   * Unbound it is silent; bound, it asks for each it holds.
   * TRAP T-grid-clear-from-outside-is-silent.
   */
  clearColumnFilter(field?: string): void {
    this.#filters.clear(field);
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
    const { page, ...at } = this.#find.step(direction, Math.max(1, this.num('data-total-pages', 1)), Math.max(1, this.num('data-page', 1)));
    if (page) this.emit('page-change', { page });
    return at;
  }

  /** Every group in force, as the data layer counted them. */
  get groups(): GroupSummary[] {
    return this.#data.told?.map((g) => ({ ...g })) ?? [];
  }

  /**
   * The actions for the CURRENT selection — one row: all; two or more: only
   * `multi`. TRAP T-grid-actions-are-declared-once-used-twice.
   */
  actionsFor(count: number): GridAction[] {
    return this.#actions.for(count);
  }

  /** The current row's key, or null. Setting it is silent, as `select()` is. */
  get currentKey(): string | null {
    return this.#selection.current;
  }
  set currentKey(key: string | null) {
    this.#selection.setCurrent(key);
  }

  /** The current RECORD among the rows held now — null when it is not one of them. */
  get current(): GridRow | null {
    return this.#selection.currentRecord();
  }

  /** The row `by` rows from the current one, in the order drawn — or null. */
  neighbour(by: number): GridRow | null {
    return this.#selection.neighbour(by);
  }

  /** Move the current row `by` rows. Silent; returns the new one, or null at an end. */
  stepCurrent(by: number): GridRow | null {
    const next = this.neighbour(by);
    if (next) this.currentKey = this.#selection.keyOf(next) ?? null;
    return next;
  }

  /** The selected RECORDS, filter-hidden ones included, in original row order. */
  get selectedRecords(): GridRow[] {
    return this.#selection.records();
  }

  /**
   * The selected rows as KEYS — savable, unlike indices. TRAP
   * T-grid-key-or-position-lies — EMPTY without a `key` in `populate()`.
   */
  get selectedKeys(): string[] {
    return this.#selection.keys();
  }

  /**
   * Select exactly these rows, by key. TRAP T-grid-select-remembers-wanted-keys
   * — REPLACES, ignores unmatched keys, and is SILENT. `select([])` clears.
   */
  select(keys: readonly string[]): void {
    this.#selection.select(keys);
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
}

define('sherpa-data-grid', SherpaDataGrid);
