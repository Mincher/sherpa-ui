/**
 * data-source.ts — one place that owns how records are being VIEWED.
 *
 * TRAP T-one-comparator-one-source
 * TRAP T-view-state-lives-in-one-object
 */
import { andFilter, filterFields, filterNeedles, groupSummaries, valueKey } from './store.js';
import { fieldState, stateClause } from './filter-state.js';
import { report } from './report.js';
import type { Populatable } from '../ui/apply-state.js';
import type { FieldReading, FieldType, FilterState } from './filter-state.js';

/** HOW FAR a control's reading reaches. TRAP T-a-filter-applies-down-its-scope
 *  `reach`, not `scope`: SCOPE is which surface holds a filter, and the two
 *  were one word doing two jobs. TRAP T-three-things-called-scope */
export interface ApplyAt {
  /** `view` writes each field's own slot; `component` owns one named part. */
  reach?: 'view' | 'component';
  /** Required for `component` — the part's name. */
  key?: string;
}
import type {
  Filter, GroupSummary, LoadOptions, LoadResult, Row, SortDirection, SortSpec, Store,
} from './store.js';

/** The view state a source owns. */
export interface ViewState {
  filter?: Filter;
  sort: SortSpec[];
  group: string | null;
  search: string;
  page: number;
  pageSize: number | null;
  /**
   * A sort turned OFF, not thrown away. `sort` is the QUERY, empty while
   * suspended; this is the column a control still shows.
   * TRAP T-a-suspended-sort-is-one-owners-job
   */
  sortSuspended?: SortSpec;
}

export interface DataSourceOptions {
  store: Store;
  /** Rows per page. Omit for no paging. */
  pageSize?: number;
  /** Starting sort. */
  sort?: SortSpec[];
  /** Starting filter. */
  filter?: Filter;
  /** Starting group field. */
  group?: string | null;
  /** Fields a free-text search looks at. Omit to search every field. */
  searchFields?: string[];
  /** Load as soon as the first component binds. Default true. */
  autoLoad?: boolean;
}

/** What a component may do with the source it is bound to. */
export interface BindOptions {
  /** One NAMED PART of the payload, not all of it. TRAP T-into-merges-on-the-element */
  into?: string;
  /** Unbind when this signal aborts. TRAP T-signal-not-a-teardown-list */
  signal?: AbortSignal;
  /** Read the data, never steer it. A chart re-draws; clicking a bar re-sorts nothing. */
  readonly?: boolean;
  /** STEER ONLY — events reach the source, no rows come back. TRAP T-steer-only-populate-means-chips */
  steerOnly?: boolean;
  /** Events the source must NOT act on. TRAP T-ignore-is-the-scalpel */
  ignore?: readonly string[];
  /** Reshape the rows before they reach this component. TRAP T-adapter-lives-at-the-binding */
  as?: (rows: Row[], source: DataSource) => unknown;
  /**
   * Which rows this component is given. `'page'` (the default) is the window a
   * grid draws; `'all'` is every row matching the filter, unpaged — what a
   * SUMMARY needs, because a chart counting 25 of 100 is quietly wrong.
   * TRAP T-a-summary-binds-to-all-the-rows
   */
  rows?: 'page' | 'all';
}

/** What `change` carries, for a listener that wants the result without asking. */
export interface DataChangeDetail extends LoadResult {
  state: ViewState;
}

/** The events a bound component may send UP. TRAP T-steering-events-are-a-closed-list */
const STEERING_EVENTS = [
  'sort-change',
  'group-change',
  'quick-filter-change',
  'filter-change',
  'page-change',
  'page-size-change',
  'search-change',
  // A REPORT, not a request: changes what the pager draws, never the query.
  // TRAP T-grouped-paging-belongs-to-the-view
  'grid-pages-change',
] as const;

export class DataSource extends EventTarget {
  readonly store: Store;
  #state: ViewState;
  #searchFields: string[] | undefined;
  #bound = new Map<
    Populatable,
    {
      readonly: boolean;
      steerOnly: boolean;
      off: () => void;
      as?: BindOptions['as'];
      /** The named part of the payload this bind owns — see BindOptions.into. */
      into?: string;
      /** See BindOptions.rows. */
      rows: 'page' | 'all';
      /** The rows array last handed to this component — see `#push`. */
      lastRows?: readonly Row[];
      /** The fields this component answered LAST time it reported.
       *  TRAP T-a-filter-report-is-the-whole-answer */
      answered?: Set<string>;
    }
  >();
  #result: LoadResult = { rows: [], total: 0 };
  /**
   * Every row matching the filter, unpaged — for a `rows: 'all'` bind. Loaded
   * only when one exists, so a view with no summary asks the store once as
   * before. TRAP T-a-summary-binds-to-all-the-rows
   */
  #allRows: readonly Row[] = [];
  /**
   * The page count a GROUPED view reported; `null` until the first draw.
   * TRAP T-grouped-paging-belongs-to-the-view
   */
  #viewPages: number | null = null;
  #autoLoad: boolean;
  // TRAP T-in-flight-ticket-discards-stale — three keys, and why not one.
  /** The load in flight, as a ticket the response is checked against. */
  #inFlight: symbol | null = null;
  /** The ViewState the last COMPLETED load asked for, serialised. */
  #lastLoadKey: string | null = null;
  /** Has any load completed? Until one has, nothing may be skipped. */
  #loaded = false;
  /** The key of the load currently in flight. */
  #inFlightKey: string | null = null;
  /** A coalesced load is queued for the end of this tick — see `#schedule`. */
  #scheduled = false;
  /** The filter's named parts, in contribution order. TRAP T-parts-order-must-be-stable */
  #parts = new Map<string, Filter>();
  /**
   * WHAT IS SELECTED, BY FIELD — not by which control did the selecting, so a
   * chip, a column heading and a legend cannot show two answers.
   * TRAP T-one-field-one-filter-menu
   */
  #readings = new Map<string, FieldReading>();
  /** Every value a field can take, for the controls that draw its rows. */
  #domains = new Map<string, unknown[]>();
  /** A field's declared KIND and label. TRAP T-the-field-type-decides-the-clause */
  #fields = new Map<string, { type?: FieldType; label?: string }>();

  constructor(options: DataSourceOptions) {
    super();
    this.store = options.store;
    this.#autoLoad = options.autoLoad ?? true;
    this.#searchFields = options.searchFields;
    this.#state = {
      sort: options.sort ?? [],
      group: options.group ?? null,
      search: '',
      page: 1,
      pageSize: options.pageSize ?? null,
      ...(options.filter ? { filter: options.filter } : {}),
    };
    // FORCED: the rows changed under an identical ViewState.
    this.store.addEventListener('change', () => void this.load({ force: true }));
    /* A RECORD'S TIME IS A DATE, said once, by whoever knows it — the store.
       Nothing downstream has to know the dataset calls it `created`.
       TRAP T-a-record-has-a-time-of-its-own */
    if (this.store.time) this.declareField(this.store.time, { type: 'date' });
  }

  /**
   * The field holding each record's TIME, or undefined when the store has
   * none. A view's Date filter binds to THIS, so it filters any dataset.
   * TRAP T-a-record-has-a-time-of-its-own
   */
  get timeField(): string | undefined {
    return this.store.time;
  }

  /* ── State ─────────────────────────────────────────────────────────── */

  /** The current view state. A copy — mutating it must not steer the source. */
  get state(): ViewState {
    return structuredClone(this.#state);
  }

  /** Restore a whole view state — a saved view, a deep link, a reload.
   *  TRAP T-set-state-merges-page-last */
  setState(next: Partial<ViewState>): void {
    if ('filter' in next) {
      this.#parts.clear();
      // A whole filter REPLACES every field selection too, or a restored view
      // keeps ticks the query no longer carries.
      this.#readings.clear();
      if (next.filter) this.#state.filter = next.filter;
      else delete this.#state.filter;
    }
    if (next.sort) this.#state.sort = next.sort;
    // A view captured mid-suspend restores as it was left.
    if ('sortSuspended' in next) {
      if (next.sortSuspended) this.#state.sortSuspended = next.sortSuspended;
      else delete this.#state.sortSuspended;
    }
    // A new grouping invalidates the view's page count — see setGroup.
    if ('group' in next) {
      this.#state.group = next.group ?? null;
      this.#viewPages = null;
    }
    if (next.search != null) this.#state.search = next.search;
    if ('pageSize' in next) this.#state.pageSize = next.pageSize ?? null;
    // PAGE LAST, and not clamped here: the total belongs to the PREVIOUS filter.
    // The load below re-clamps against the new one.
    if (next.page != null) this.#state.page = Math.max(1, Math.trunc(next.page) || 1);
    this.#schedule();
  }

  /** The whole of the last load's answer. TRAP T-result-is-the-hosts-half */
  get result(): LoadResult {
    return { ...this.#result };
  }

  get rows(): Row[] {
    return this.#result.rows;
  }

  /** Matching rows before paging. */
  get total(): number {
    return this.#result.total;
  }

  /**
   * Pages at the current size, at least 1. GROUPED, it is what the grid
   * reported — a shut group is one screen line.
   * TRAP T-grouped-paging-belongs-to-the-view
   */
  get totalPages(): number {
    const size = this.#state.pageSize;
    if (!size) return 1;
    if (this.#state.group && this.#viewPages != null) return Math.max(1, this.#viewPages);
    return Math.max(1, Math.ceil(this.#result.total / size));
  }

  /* ── Steering ──────────────────────────────────────────────────────── */

  /**
   * Order by one field, or stop. Every re-ordering returns to page 1.
   *
   * `field: null` SUSPENDS — the column moves to `sortSuspended`, so one more
   * click resumes it. `clearSort()` is how a caller forgets.
   * TRAP T-a-suspended-sort-is-one-owners-job
   */
  setSort(field: string | null, direction: SortDirection = 'asc'): void {
    if (field) {
      this.#state.sort = [{ field, direction }];
      delete this.#state.sortSuspended;
    } else {
      // A second suspend in a row must not overwrite the memory with nothing.
      const live = this.#state.sort[0];
      if (live) this.#state.sortSuspended = live;
      this.#state.sort = [];
    }
    this.#requery();
  }

  /** Resume the suspended sort. No-op when there is none. */
  resumeSort(): void {
    const held = this.#state.sortSuspended;
    if (!held) return;
    this.setSort(held.field, held.direction ?? 'asc');
  }

  /** Forget the sort entirely — the gesture that is NOT a suspend. */
  clearSort(): void {
    this.#state.sort = [];
    delete this.#state.sortSuspended;
    this.#requery();
  }

  setGroup(field: string | null): void {
    this.#state.group = field;
    // The old count was measured against the OLD grouping. Drop it and wait for
    // the next draw. TRAP T-grouped-paging-belongs-to-the-view
    this.#viewPages = null;
    this.#requery();
  }

  /** Replace the WHOLE filter, clearing every contribution. TRAP T-contribute-beats-last-writer */
  setFilter(filter: Filter | undefined): void {
    this.#parts.clear();
    this.#readings.clear();
    this.#setFilterValue(filter);
  }

  /**
   * Own ONE NAMED PART — the COMPONENT scope. Parts are ANDed with each other
   * and with every field selection, so a part can only ever narrow further; it
   * can never widen past what the View already allows, and it never touches
   * another component's part or the View's own selection.
   *
   * `undefined` removes one.
   *
   * TRAP T-contribute-beats-last-writer · TRAP T-a-filter-applies-down-its-scope
   */
  contribute(key: string, filter: Filter | undefined): void {
    if (filter) this.#parts.set(key, filter);
    else this.#parts.delete(key);
    this.#setFilterValue(this.#composed());
  }

  /** Every named part currently applied — the component-scope filters. */
  get contributions(): string[] {
    return [...this.#parts.keys()];
  }

  /**
   * Apply a whole control's READING of several fields, at one scope.
   *
   * This is the door a UI uses: it names its fields and what a reader did to
   * each — picked values, a condition, an or-chain — and the data layer turns
   * that into a query. A control that builds a clause is a control that has
   * to know a field's type, and that is how one rule became three.
   *
   * VIEW is one slot per field: every other control over the same field reads
   * the answer back. COMPONENT is one named part, ANDed under the View, so it
   * narrows further and can never widen past it — and naming no fields clears
   * that part. TRAP T-a-filter-applies-down-its-scope
   */
  apply(readings: Readonly<Record<string, FieldReading>>, at: ApplyAt = {}): void {
    if (at.reach === 'component') {
      const key = at.key;
      if (!key) throw new Error('apply: a component reach needs a `key`');
      const clauses = Object.entries(readings)
        .map(([field, reading]) => stateClause(this.#stateFor(field, reading)))
        .filter((c): c is NonNullable<typeof c> => !!c);
      this.contribute(key, andFilter(clauses));
      return;
    }
    for (const [field, reading] of Object.entries(readings)) {
      this.select(field, reading.picked ?? [], reading);
    }
  }

  /** One field's state from a reading this source has NOT stored. */
  #stateFor(field: string, reading: FieldReading): FilterState {
    const facts = this.#fields.get(field) ?? {};
    const values = this.#domains.get(field);
    return fieldState(
      {
        field,
        ...(values ? { values } : {}),
        ...(facts.type ? { type: facts.type } : {}),
        ...(facts.label ? { label: facts.label } : {}),
      },
      reading,
    );
  }

  /* ── Selection, by FIELD ───────────────────────────────────────────── */

  /**
   * Declare every value a field can take, so a control drawing its rows offers
   * the same list wherever it appears — and the same STRINGS, which is what
   * lets two controls share one selection.
   */
  declareValues(field: string, values: readonly unknown[]): void {
    /* Kept AS THE DATA HOLDS THEM, de-duplicated by key.
       TRAP T-a-value-can-be-an-object */
    const seen = new Map<string, unknown>();
    for (const v of values) if (!seen.has(valueKey(v))) seen.set(valueKey(v), v);
    this.#domains.set(field, [...seen.values()]);
  }

  /**
   * Declare a field's KIND and its reader-facing name.
   *
   * The type is what turns two picks on `seats` into a `between` rather than
   * two equalities — the rule then lives here, once, instead of in every app
   * that happens to know `seats` is a number.
   * TRAP T-the-field-type-decides-the-clause
   */
  declareField(field: string, facts: { type?: FieldType; label?: string } = {}): void {
    const held = this.#fields.get(field) ?? {};
    this.#fields.set(field, { ...held, ...facts });
  }

  /** What `declareField` was told. */
  fieldFacts(field: string): { type?: FieldType; label?: string } {
    return { ...(this.#fields.get(field) ?? {}) };
  }

  /** What `declareValues` was told, as the data holds it. */
  valuesFor(field: string): unknown[] {
    return [...(this.#domains.get(field) ?? [])];
  }

  /** That field's declared values, by their string key. */
  #domainByKey(field: string): Map<string, unknown> {
    const out = new Map<string, unknown>();
    for (const v of this.#domains.get(field) ?? []) out.set(valueKey(v), v);
    return out;
  }

  /**
   * Select values for a FIELD — the VIEW scope. Every control over that field
   * reads the same answer back from `selection()`; an empty list clears it.
   * `reading` carries the rest of the question — the condition and its text.
   *
   * ONE SLOT PER FIELD, so this is the View's. A component that narrows only
   * ITSELF must `contribute()` a named part instead: a second writer here does
   * not narrow, it REPLACES — measured, a legend switching one series off
   * overwrote the View chip's own two picks, and the chip then re-drew showing
   * the legend's answer as if the reader had chosen it.
   * TRAP T-a-filter-applies-down-its-scope
   */
  select(field: string, picked: readonly unknown[], reading: FieldReading = {}): void {
    /* A control hands back the KEY it was given, so it maps to the value the
       row holds. A raw value is left alone.
       TRAP T-a-value-can-be-an-object */
    const declared = this.#domainByKey(field);
    const raws = picked.map((v) => declared.get(valueKey(v)) ?? v);
    const next: FieldReading = { ...reading, picked: raws };
    /* CONDITIONS count. A field answered only by rows — "starts with Go", or
       an or-chain over two owners — has no picked values and no typed text, so
       this deleted the reading and the filter never applied.
       TRAP T-many-conditions-are-one-reading */
    const answered = picked.length > 0
      || (next.text ?? '').trim() !== ''
      || (next.conditions ?? []).length > 0;
    if (answered) this.#readings.set(field, next);
    else this.#readings.delete(field);
    this.#setFilterValue(this.#composed());
    // AFTER the requery, so a listener sees the state the rows were fetched for.
    this.dispatchEvent(new CustomEvent('selection-change', { detail: { field } }));
  }

  /**
   * THE GROUPS IN FORCE — each value, and how many rows carry it.
   *
   * A GROUP IS A DATA CONCEPT, the same way a data PAGE is. A grid draws a
   * group as a heading row and collapses it, exactly as it pages screen lines
   * — that is the VIEW's half, and neither makes the grid the owner. Counted
   * over every matching row, so a group split across a page boundary still
   * says how many rows it holds.
   * TRAP T-a-group-is-a-data-layer-concept · TRAP T-grouped-paging-belongs-to-the-view
   */
  groups(field: string = this.#state.group ?? ''): GroupSummary[] {
    if (!field) return [];
    if (!this.#loaded) {
      /* NOT LOADED YET. An empty answer here reads as "no groups", which is
         indistinguishable from a field nothing carries.
         TRAP T-a-broken-assumption-reports */
      report({
        code: 'not-loaded',
        message: 'groups() was asked before the first load, so it has nothing to count.',
        at: { field },
      });
      return [];
    }
    /* EVERY matching row. `#allRows` is filled only for a `rows: 'all'` bind,
       and a GROUPED load is never windowed, so the page IS everything then.
       TRAP T-a-summary-binds-to-all-the-rows */
    const rows = this.#allRows.length ? this.#allRows : this.#result.rows;
    return groupSummaries(rows, field);
  }

  /** Stop applying a field without forgetting it. TRAP T-grid-suspend-is-not-clear */
  suspendSelection(field: string, suspended = true): void {
    const held = this.#readings.get(field);
    if (!held) return;
    this.select(field, held.picked ?? [], { ...held, suspended });
  }

  /**
   * One field's whole state — picked, unpicked, the condition — ready for a
   * chip, a column menu, a legend row or anything else that draws it.
   */
  selection(field: string, label?: string): FilterState {
    const facts = this.#fields.get(field) ?? {};
    /* A RANGE field has no declared list, and passing an empty one would say
       it has no values at all. TRAP T-the-field-type-decides-the-clause */
    const values = this.#domains.get(field);
    return fieldState(
      {
        field,
        ...(values ? { values } : {}),
        ...(facts.type ? { type: facts.type } : {}),
        ...(label ?? facts.label ? { label: label ?? facts.label! } : {}),
      },
      this.#readings.get(field) ?? {},
    );
  }

  /** Every field currently selected. */
  get selectedFields(): string[] {
    return [...this.#readings.keys()];
  }

  /* ── Scopes: WHICH SURFACE holds a filter ──────────────────────────── */

  /**
   * A SCOPE is a named place a filter lives — a header bar, a grid's bar, a
   * panel section. The app names them; this holds only what is true NOW.
   *
   * It is here because two controls must agree on it and NEITHER MAY KNOW THE
   * OTHER EXISTS. A panel that asked a toolbar what it was holding is a panel
   * coupled to a toolbar. TRAP T-a-scope-is-a-place-not-a-reach
   */
  #scopes = new Map<string, string[]>();

  /** The fields a scope is holding, in the order it holds them. */
  scope(name: string): string[] {
    return [...(this.#scopes.get(name) ?? [])];
  }

  /** Every scope that has been named. */
  get scopes(): string[] {
    return [...this.#scopes.keys()];
  }

  /** Say what a scope holds now. An empty list forgets the scope. */
  hold(name: string, fields: readonly string[]): void {
    const next = [...fields];
    const before = this.#scopes.get(name);
    // A no-op must not wake every listener — a bar re-renders on this.
    if (before && before.length === next.length && before.every((f, i) => f === next[i])) return;
    if (next.length) this.#scopes.set(name, next);
    else this.#scopes.delete(name);
    this.dispatchEvent(new CustomEvent('scope-change', { detail: { scope: name } }));
  }

  /** Is this field held HERE? */
  holds(name: string, field: string): boolean {
    return (this.#scopes.get(name) ?? []).includes(field);
  }

  /**
   * Which scope holds this field, or null.
   *
   * This is what SUPERSEDING is: a field the view scope holds is not the data
   * bar's to narrow, and neither bar has to know the other is there.
   */
  scopeOf(field: string): string | null {
    for (const [name, fields] of this.#scopes) if (fields.includes(field)) return name;
    return null;
  }

  /**
   * EVERYTHING THIS SOURCE THINKS IS TRUE, in one object.
   *
   * For a bug report, and for a test to assert against instead of counting
   * rows in the DOM — where a page size of 25 makes a working filter look
   * broken. DOM-free, like the rest of this module.
   * TRAP T-a-bug-report-should-be-a-paste
   */
  debugState(): Record<string, unknown> {
    return {
      rows: this.#result.rows.length,
      total: this.total,
      page: this.#state.page,
      pageSize: this.#state.pageSize,
      totalPages: this.totalPages,
      sort: this.#state.sort,
      group: this.#state.group,
      search: this.#state.search,
      filter: this.#state.filter,
      selections: Object.fromEntries(
        [...this.#readings.keys()].map((f) => [f, this.selection(f)]),
      ),
      parts: Object.fromEntries(this.#parts),
      scopes: Object.fromEntries(this.#scopes),
      fields: Object.fromEntries(this.#fields),
      // Which field a Date filter narrows — or `null`, which explains one
      // that narrows nothing. TRAP T-a-record-has-a-time-of-its-own
      time: this.store.time ?? null,
      bound: [...this.#bound.values()].map((e) => ({
        rows: e.rows, readonly: e.readonly, steerOnly: e.steerOnly,
      })),
      loaded: this.#loaded,
    };
  }

  /** Every named part AND every field's own clause. */
  #composed(): Filter | undefined {
    const fields = [...this.#readings.keys()]
      .map((field) => stateClause(this.selection(field)))
      .filter((c): c is NonNullable<typeof c> => !!c);
    return andFilter([...this.#parts.values(), ...fields]);
  }

  /** The shared tail of `setFilter` and `contribute`. */
  #setFilterValue(filter: Filter | undefined): void {
    if (filter) this.#state.filter = filter;
    else delete this.#state.filter;
    this.#requery();
  }

  setSearch(term: string): void {
    this.#state.search = term;
    this.#requery();
  }

  setPage(page: number): void {
    // Clamped against the CURRENT total, so a pager cannot walk past the end.
    this.#state.page = Math.min(Math.max(1, Math.trunc(page) || 1), this.totalPages);
    /* GROUPED: publish, never load. Grouped loads send no skip/take, so every
       page shares one state key and the no-op guard would eat the publish.
       TRAP T-grouped-page-change-publishes-without-loading */
    if (this.#state.group) {
      this.#publish();
      return;
    }
    this.#schedule();
  }

  setPageSize(size: number): void {
    this.#state.pageSize = Math.max(1, Math.trunc(size) || 1);
    this.#requery();
  }

  /**
   * The query CHANGED, so start over: back to page one, then load.
   *
   * Six setters wrote these two calls in this order, which is six chances for
   * a seventh to write one and forget the other — a filter that narrows while
   * the pager still points at page four.
   */
  #requery(): void {
    this.#state.page = 1;
    this.#schedule();
  }

  /** COALESCE one tick's writes into a single load. TRAP T-coalesce-microtask-not-debounce */
  #schedule(): void {
    if (this.#scheduled) return;
    this.#scheduled = true;
    queueMicrotask(() => {
      this.#scheduled = false;
      void this.load();
    });
  }

  /* ── Loading ───────────────────────────────────────────────────────── */

  /** Is any bind asking for the unpaged set? TRAP T-a-summary-binds-to-all-the-rows */
  #wantsAllRows(): boolean {
    for (const entry of this.#bound.values()) if (entry.rows === 'all') return true;
    return false;
  }

  /** Build the load options the store is asked with. */
  #loadOptions(): LoadOptions {
    const { filter, sort, group, search, page, pageSize } = this.#state;
    const options: LoadOptions = {};
    if (filter) options.filter = filter;
    if (sort.length) options.sort = sort;
    if (group) options.group = group;
    if (search) {
      options.search = search;
      if (this.#searchFields) options.searchFields = this.#searchFields;
    }
    // GROUPED: ask for EVERY matching row and let the grid cut the page — no
    // store window knows which groups the reader has folded.
    // TRAP T-grouped-paging-belongs-to-the-view
    if (pageSize && !group) {
      options.skip = (page - 1) * pageSize;
      options.take = pageSize;
    }
    return options;
  }

  /** Re-read and push to every bound component. TRAP T-error-is-a-state-not-a-throw */
  async load(options: { force?: boolean } = {}): Promise<LoadResult> {
    // Skip a load that would ask the same question twice. `force` is how a load
    // that MUST happen says so.
    // TRAP T-no-op-load-guard
    // TRAP T-in-flight-ticket-discards-stale — ANSWERED and ASKED are separate.
    const key = this.#stateKey();
    if (!options.force) {
      if (key === this.#lastLoadKey && this.#loaded) return this.#result;  // answered
      if (key === this.#inFlightKey) return this.#result;                  // asked
    }

    const ticket = Symbol('load');
    this.#inFlight = ticket;
    this.#inFlightKey = key;
    this.dispatchEvent(new CustomEvent('loading', { detail: { loading: true } }));

    try {
      const result = await this.store.load(this.#loadOptions());
      // Not the latest → DISCARDED, and the key recorded only by the winner.
      if (this.#inFlight !== ticket) return this.#result;
      this.#result = result;
      this.#lastLoadKey = key;
      this.#loaded = true;

      /* A SUMMARY sees every matching row. When nothing was windowed the page
         IS everything, so the second ask is skipped.
         TRAP T-a-summary-binds-to-all-the-rows */
      const windowed = this.#state.pageSize != null && !this.#state.group;
      if (!this.#wantsAllRows()) this.#allRows = [];
      else if (!windowed) this.#allRows = result.rows;
      else {
        const { skip: _skip, take: _take, ...rest } = this.#loadOptions();
        const all = await this.store.load(rest);
        if (this.#inFlight !== ticket) return this.#result;
        this.#allRows = all.rows;
      }

      // Re-clamp and reload ONCE, FORCED. Never while GROUPED: the page count
      // there is the GRID's to report, and the re-load would ask the same thing.
      // TRAP T-error-is-a-state-not-a-throw
      // TRAP T-grouped-paging-belongs-to-the-view
      const pages = this.totalPages;
      if (!this.#state.group && this.#state.pageSize && this.#state.page > pages) {
        this.#state.page = pages;
        return this.load({ force: true });
      }

      this.#publish();
      this.dispatchEvent(
        new CustomEvent<DataChangeDetail>('change', {
          detail: { ...result, state: this.state },
        }),
      );
      return result;
    } catch (error) {
      // TRAP T-error-is-a-state-not-a-throw — a stale failure raises nothing.
      if (this.#inFlight !== ticket) return this.#result;
      this.dispatchEvent(new CustomEvent('error', { detail: { error } }));
      return this.#result;
    } finally {
      if (this.#inFlight === ticket) {
        this.#inFlight = null;
        this.#inFlightKey = null;
        this.dispatchEvent(new CustomEvent('loading', { detail: { loading: false } }));
      }
    }
  }

  /** The ViewState as one comparable string. Key order is stable by construction. */
  #stateKey(): string {
    return JSON.stringify(this.#loadOptions());
  }

  /* ── Binding ───────────────────────────────────────────────────────── */

  /**
   * Point a component at this source. Two-way by default: rows and `data-*`
   * down, steering events back. Returns an unbind function.
   */
  bind(el: Populatable, options: BindOptions = {}): () => void {
    if (this.#bound.has(el)) return () => this.unbind(el);
    // TRAP T-signal-not-a-teardown-list — an aborted signal binds nothing.
    if (options.signal?.aborted) return () => {};

    const readonlyBind = options.readonly ?? false;
    const listeners: Array<[string, EventListener]> = [];

    const ignored = new Set(options.ignore ?? []);
    if (!readonlyBind) {
      for (const type of STEERING_EVENTS) {
        // TRAP T-ignore-is-the-scalpel — no listener at all, not an early return.
        if (ignored.has(type)) continue;
        const handler = ((event: Event) => this.#steer(type, event as CustomEvent)) as EventListener;
        el.addEventListener(type, handler);
        listeners.push([type, handler]);
      }
    }

    /* LOCKED: the source now owns this element's view state, so it reports its
       interactions and stops writing them. Not for a readonly bind, which
       steers nothing. A component with no source stays UNLOCKED and writes its
       own state — that is what makes a standalone grid work.
       TRAP T-bind-locks-what-it-owns */
    if (!readonlyBind) el.setAttribute('data-locked', '');

    const off = (): void => {
      for (const [type, handler] of listeners) el.removeEventListener(type, handler);
      // UNLOCKED on the way out, or a component that outlives its source is mute.
      el.removeAttribute('data-locked');
    };
    this.#bound.set(el, {
      readonly: readonlyBind,
      steerOnly: options.steerOnly ?? false,
      off,
      rows: options.rows ?? 'page',
      ...(options.as ? { as: options.as } : {}),
      ...(options.into ? { into: options.into } : {}),
    });

    // TRAP T-signal-not-a-teardown-list — drops the BINDING; `once` leaves nothing.
    options.signal?.addEventListener('abort', () => this.unbind(el), { once: true });

    // Whatever is already loaded, so a component bound late is not blank.
    this.#push(el);
    /* A summary bound AFTER the first load would otherwise draw blank: the
       unpaged set is fetched by `load`, and nothing would ask for it again.
       TRAP T-a-summary-binds-to-all-the-rows */
    const needsAll = options.rows === 'all' && !this.#allRows.length;
    if (this.#autoLoad && (!this.#result.rows.length || needsAll)) {
      void this.load({ force: needsAll });
    }

    return () => this.unbind(el);
  }

  /** Stop steering and stop populating this component. */
  unbind(el: Populatable): void {
    this.#bound.get(el)?.off();
    this.#bound.delete(el);
  }

  /** Every component currently bound. */
  get boundElements(): Populatable[] {
    return [...this.#bound.keys()];
  }

  /** Turn one component's event into a state change. TRAP T-steering-events-are-a-closed-list */
  #steer(type: (typeof STEERING_EVENTS)[number], event: CustomEvent): void {
    const detail = (event.detail ?? {}) as Record<string, unknown>;

    switch (type) {
      case 'sort-change': {
        const field = detail['field'];
        const direction = detail['direction'] === 'desc' ? 'desc' : 'asc';
        this.setSort(typeof field === 'string' ? field : null, direction);
        return;
      }
      case 'group-change': {
        const field = detail['field'];
        this.setGroup(typeof field === 'string' && field ? field : null);
        return;
      }
      case 'quick-filter-change': {
        /* ASK THE BAR. `readings` is the control's own answer — which field,
           which values, which condition — and `apply()` is the ONE place a
           reading becomes a query. Building a clause from the detail here was
           a second builder that knew no field type, no range and no condition.
           TRAP T-one-query-builder-in-the-data-layer */
        const bar = event.currentTarget as EventTarget & {
          readings?: Record<string, FieldReading>;
        } | null;
        const readings = bar?.readings ?? readingsOf(detail['values']);
        /* A REPORT IS THE WHOLE ANSWER. A field this control answered before
           and does not name now is a field it has stopped filtering by, so it
           is cleared — its OWN fields only, never another control's.
           TRAP T-a-filter-report-is-the-whole-answer */
        const bind = this.#bound.get(event.currentTarget as Populatable);
        for (const field of bind?.answered ?? []) {
          if (!(field in readings)) this.select(field, []);
        }
        if (bind) bind.answered = new Set(Object.keys(readings));
        this.apply(readings);
        return;
      }
      case 'filter-change': {
        // The grid's per-column filter box. One field at a time, substring.
        const field = detail['field'];
        const value = detail['value'];
        if (typeof field !== 'string') return;
        /* PARAMETERS, not a clause, and the FIELD's own slot — `setFilter`
           replaced the whole query, so typing in one column heading wiped
           every chip and every component part.
           TRAP T-one-query-builder-in-the-data-layer */
        const text = value == null ? '' : String(value);
        this.select(field, [], { op: 'contains', text });
        return;
      }
      case 'page-change': {
        const page = detail['page'];
        if (typeof page === 'number') this.setPage(page);
        return;
      }
      case 'grid-pages-change': {
        // The rows in hand are already every matching row, so re-publish the
        // pager's numbers and load nothing.
        const pages = detail['pages'];
        if (typeof pages !== 'number' || !Number.isFinite(pages)) return;
        const next = Math.max(1, Math.trunc(pages));
        const clamped = Math.min(this.#state.page, next);
        if (next === this.#viewPages && clamped === this.#state.page) return;
        this.#viewPages = next;
        this.#state.page = clamped;
        this.#publish();
        return;
      }
      case 'page-size-change': {
        const size = detail['pageSize'];
        if (typeof size === 'number') this.setPageSize(size);
        return;
      }
      case 'search-change': {
        const term = detail['value'] ?? detail['search'];
        this.setSearch(typeof term === 'string' ? term : '');
        return;
      }
    }
  }

  /* ── Publishing ────────────────────────────────────────────────────── */

  /** Push rows and state to every bound component. */
  #publish(): void {
    for (const el of this.#bound.keys()) this.#push(el);
  }

  /** Give one component the rows and the view state. TRAP T-push-writes-state-as-attributes */
  #push(el: Populatable): void {
    const { sort, group, page, pageSize, filter, sortSuspended } = this.#state;
    const first = sort[0];

    /* The FIELD survives a suspend; the DIRECTION says whether it is applied.
       Suspended = the remembered field with an EMPTY direction.
       TRAP T-a-suspended-sort-is-one-owners-job */
    const shown = first ?? sortSuspended;
    setAttr(el, 'data-sort-field', shown?.field);
    setAttr(el, 'data-sort-direction',
      first ? (first.direction ?? 'asc') : (sortSuspended ? '' : undefined));
    setAttr(el, 'data-group-field', group ?? undefined);
    // WHICH fields the filter touches, not the filter itself.
    // TRAP T-push-writes-state-as-attributes
    const fields = filterFields(filter);
    setAttr(el, 'data-filter-fields', fields.length ? fields.join(' ') : undefined);
    /* …and WHAT it matched on, so a component can point at the hit. A view
       highlights what it filtered by, whichever control set the filter.
       TRAP T-a-needle-comes-from-either-direction */
    const needles = filterNeedles(filter);
    setAttr(el, 'data-needles', needles || undefined);
    setAttr(el, 'data-page', pageSize ? String(page) : undefined);
    setAttr(el, 'data-total-pages', pageSize ? String(this.totalPages) : undefined);
    setAttr(el, 'data-page-size', pageSize ? String(pageSize) : undefined);

    // …but the ROWS go only where they mean something — the attributes above
    // still reach a steer-only bind.
    // TRAP T-steer-only-populate-means-chips
    const entry = this.#bound.get(el);
    if (entry?.steerOnly) return;

    // Skip a push that would hand over the same rows again.
    // TRAP T-no-op-load-guard
    // TRAP T-adapter-lives-at-the-binding — guard the ROWS ARRAY, not a payload.
    const pushRows = entry?.rows === 'all' ? this.#allRows : this.#result.rows;
    if (entry && entry.lastRows === pushRows) return;
    if (entry) entry.lastRows = pushRows;

    // populate() waits for the first render itself, so a component bound
    // before it upgraded still gets its rows.
    const adapt = entry?.as;
    const payload = adapt ? adapt(pushRows as Row[], this) : pushRows;

    // ONE NAMED PART, when the bind asked for one — see BindOptions.into.
    if (entry?.into) {
      el.populate?.(mergeInto(el, entry.into, payload));
      return;
    }
    el.populate?.(payload);
  }
}

/** The shared draft each `into` bind writes its own part of. TRAP T-into-merges-on-the-element */
const DRAFT = Symbol('sherpa:into-draft');

/**
 * Write `value` at `path` in the element's shared draft, and return it.
 * `series.0` → `{ series: [value] }`. MUTATED, not rebuilt.
 * TRAP T-into-merges-on-the-element
 */
function mergeInto(el: Populatable, path: string, value: unknown): unknown {
  const host = el as unknown as Record<symbol, unknown>;
  const segments = path.split('.').filter(Boolean);
  if (!segments.length) return value;

  const first = segments[0]!;
  // The ROOT follows the same rule: a numeric first segment means an array.
  host[DRAFT] ??= /^\d+$/.test(first) ? [] : {};
  let node = host[DRAFT] as Record<string | number, unknown>;

  for (let i = 0; i < segments.length - 1; i++) {
    const key = segments[i]!;
    const nextIsIndex = /^\d+$/.test(segments[i + 1]!);
    node[key] ??= nextIsIndex ? [] : {};
    node = node[key] as Record<string | number, unknown>;
  }
  node[segments[segments.length - 1]!] = value;
  return host[DRAFT];
}

/** Write or remove an attribute. `undefined` removes, so CSS stops matching. */
function setAttr(el: HTMLElement, name: string, value: string | undefined): void {
  if (value == null) el.removeAttribute(name);
  else el.setAttribute(name, value);
}

/**
 * A bare `{ field: [values] }` detail as READINGS, for a control with no
 * `readings` getter of its own. Parameters — `apply()` still builds the query.
 * TRAP T-one-query-builder-in-the-data-layer
 */
function readingsOf(values: unknown): Record<string, FieldReading> {
  const out: Record<string, FieldReading> = {};
  if (!values || typeof values !== 'object') return out;
  for (const [field, picked] of Object.entries(values as Record<string, unknown>)) {
    // TRAP T-toggle-chips-have-no-field — `active` names no field, so it is not here.
    if (Array.isArray(picked)) out[field] = { picked };
  }
  return out;
}
