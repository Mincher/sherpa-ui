/**
 * data-source.ts — one place that owns how records are being VIEWED.
 *
 * TRAP T-one-comparator-one-source
 * TRAP T-view-state-lives-in-one-object
 *
 * Map:
 * - ApplyAt — HOW FAR a control's reading reaches.
 * - FieldDeclaration — What a field IS, said once — its kind, its name, and how a control answers it.
 * - FieldFilter — A field's filter as any bar or panel draws it — its declaration and values.
 * - HeldFilter — One filter a scope holds, as a control draws it.
 * - ScopeDescription — One scope as a control draws it whole, as JSON.
 * - ViewState — The view state a source owns.
 * - DataSourceOptions — the store, and the view it opens on: sort, group, page size, search fields
 * - BindOptions — What a component may do with the source it is bound to.
 * - DataChangeDetail — What `change` carries, for a listener that wants the result without asking.
 * - VIEW_SCOPE — The scope ABOVE every component — the same word as `reach: 'view'`.
 * - DataSource — ONE owner of how records are viewed: the query, scopes, groups, and binds
 * - .store — the records it reads; a write goes here, a view never does
 * - .timeField — The field holding each record's TIME, or undefined when the store has none.
 * - .state — The current view state.
 * - .query — The Query the rows are under. A copy.
 * - .setQuery — Restore a whole Query — a reload, a trip away and back.
 * - .setState — Restore a whole view state — a saved view, a deep link, a reload.
 * - .loaded — Has any load completed?
 * - .result — The whole of the last load's answer.
 * - .rows — the rows of the last load — one page when paged
 * - .total — Matching rows before paging.
 * - .totalPages — Pages at the current size, at least 1.
 * - .setSort — Order by one field, or stop.
 * - .resumeSort — Resume the suspended sort.
 * - .clearSort — Forget the sort entirely — the gesture that is NOT a suspend.
 * - .setGroup — group by a field, or stop; a grid draws it, the source owns it
 * - .setFilter — Replace the WHOLE filter, clearing every contribution.
 * - .contribute — Own ONE NAMED PART — the COMPONENT scope.
 * - .write — Write ONE scope's reading of ONE field — a component's own answer.
 * - .reading — One scope's reading of one field, or undefined.
 * - .contributions — Every named part currently applied — the component-scope filters.
 * - .apply — Apply a whole control's READING of several fields, at one scope.
 * - .answer — ONE SCOPE'S WHOLE ANSWER — a bar's report.
 * - .declarePreset — A saved filter's readings, by id — the library a preset that is ON compiles from.
 * - .describe — One scope, whole: its filters and answers, what it may add, how it is arranged.
 * - .declareValues — every value a field can take, so each control offers the same list
 * - .declareField — Declare a field's KIND and its reader-facing name.
 * - .fieldFacts — What `declareField` was told.
 * - .filterDef — A field's filter, as every bar, panel and heading draws it.
 * - .declareScope — Name a scope as a reader sees it — a panel's section, an Add list's note.
 * - .scopeLabel — A scope's name as a reader sees it, or its id.
 * - .addable — What a scope may still add, each noting where it lives now.
 * - .valuesFor — What `declareValues` was told, as the data holds it.
 * - .select — Select values for a FIELD — the VIEW scope.
 * - .groups — THE GROUPS IN FORCE — each value, and how many rows carry it.
 * - .suspendSelection — Stop applying a field without forgetting it.
 * - .selection — one field's whole state, ready for any control to draw
 * - .selectedFields — Every field currently selected.
 * - .scope — The fields a scope is holding, in the order it holds them.
 * - .scopes — Every scope that has been named.
 * - .hold — Say what a scope holds now.
 * - .holds — Is this field held HERE?
 * - .scopeOf — Which scope holds this field, or null.
 * - .offer — Say which fields a component scope HAS.
 * - .fields — The fields a scope may hold.
 * - .canHold — May this scope hold this field?
 * - .move — Move a filter between scopes — ONE call, because the removal is not optional.
 * - .debugState — EVERYTHING THIS SOURCE THINKS IS TRUE, in one object.
 * - .commit — SEND the draft — Apply, on a remote source.
 * - .discard — Put the applied answers back over the draft — Discard, on a remote source.
 * - .pending — Has this field been changed and not yet applied?
 * - .dirty — Has anything in this scope — or any scope — been changed and not applied?
 * - .setSearch — the search text, across searchFields
 * - .setPage — which page to show
 * - .setPageSize — rows per page, or null for all
 * - .load — Re-read and push to every bound component.
 * - .bind — Point a component at this source.
 * - .unbind — Stop steering and stop populating this component.
 * - .boundElements — Every component currently bound.
 */
import { andFilter, filterFields, filterNeedles, filterRows, groupSummaries, valueKey } from './store.js';
import { fieldState, stateClause } from './filter-state.js';
import { compile, VIEW, type Query, type QueryDefaults, type ScopeQuery } from './query.js';
import { report } from './report.js';
import type { Populatable } from '../ui/apply-state.js';
import type { FieldFacts, FieldReading, FieldType, FilterState } from './filter-state.js';

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
  Filter, FilterOp, GroupSummary, LoadOptions, LoadResult, Row, SortDirection, SortSpec, Store,
} from './store.js';

/** What a field IS, said once — its kind, its name, and how a control answers
 *  it. JSON. TRAP T-a-field-is-declared-once */
export interface FieldDeclaration {
  type?: FieldType;
  label?: string;
  select?: 'single' | 'multiple';
  /** Conditions beside its values (`true`), or instead of them (`'only'`). */
  custom?: boolean | 'only';
  /** The condition its filter opens on. */
  op?: FilterOp;
  /** A number filter's ends, and its step. */
  min?: number;
  max?: number;
  step?: number;
}

/** A field's filter as any bar or panel draws it — its declaration and values. */
export interface FieldFilter extends Omit<FieldDeclaration, 'type'> {
  id: string;
  label: string;
  /** A number or a date draws a control of its own; any other field, its values. */
  kind?: 'number' | 'date';
  options?: { value: string; label: string }[];
  /** A date's days that have records — every other day draws inactive. */
  availableDates?: string[];
  /** Where it lives now, when an Add list offers it from another scope. */
  note?: string;
  /** A PRESET — a saved filter: its answer, field by field, and whether the reader may edit it. */
  readings?: Readonly<Record<string, FieldReading>>;
  editable?: boolean;
}

/** One filter a scope holds, as a control draws it. */
export interface HeldFilter extends FieldFilter {
  /** Its answer in the Query, where it has one. */
  state?: FieldReading;
  /** A preset's on or off. */
  active?: boolean;
  removable?: boolean;
  /** A scope ABOVE holds it now — that scope's name. It keeps its place here. */
  appliedAt?: string;
}

/** One scope as a control draws it WHOLE — what it holds and answers, what it
 *  may add, and how its rows are arranged. JSON. TRAP T-a-panel-asks-for-its-scopes */
export interface ScopeDescription {
  scope: string;
  label: string;
  filters: HeldFilter[];
  available: FieldFilter[];
  group?: { field: string; label: string }[];
  sort?: { field: string; label: string }[];
  groupField?: string;
  sortField?: string;
  sortDirection?: SortDirection;
}

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
  /** The id a scope's `narrows` names this component by. Default: its own id. */
  id?: string;
  /** Where its data GOES, instead of `populate()` — a provider answering a
   *  component's request through the callback it asked with.
   *  TRAP T-a-component-asks-its-provider */
  deliver?: (payload: unknown) => void;
  /** The SCOPE this control is a view of: it is DRAWN each answer in it. A bar's
   *  report is its scope's whole answer, so a field raised out is not its to
   *  clear. A LIST is for a control that draws several — the filter panel. */
  scope?: string | readonly string[];
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

/**
 * The scope ABOVE every component — the same word as `reach: 'view'`. Named
 * once, so no caller spells it twice. TRAP T-up-is-open-down-is-closed
 */
export const VIEW_SCOPE = VIEW;

/** The events a bound component may send UP. TRAP T-steering-events-are-a-closed-list */
const STEERING_EVENTS = [
  'sort-change',
  'group-change',
  'quick-filter-change',
  // A scoped bar added or took off a chip: what its scope HOLDS changed.
  'filter-add',
  'filter-remove',
  // The panel's requests: add to a scope, and one field's own Apply or Discard.
  'filter-add-request',
  'filter-apply',
  'filter-discard',
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
  /** The view this source owns: sort, group, search, page. The filter is compiled. */
  #state: Omit<ViewState, 'filter'>;
  /** The fields a search matches, or every field. */
  #searchFields: string[] | undefined;
  /** Every bound component, and how it is bound. */
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
      /** See BindOptions.id. */
      id: string;
      /** See BindOptions.deliver. */
      deliver?: (payload: unknown) => void;
      /** The filter narrowing ONLY this component it was last pushed with — see `#push`. */
      lastOwn?: string;
      /** See BindOptions.scope. */
      scope?: string | readonly string[];
      /** The fields this component answered LAST time it reported.
       *  TRAP T-a-filter-report-is-the-whole-answer */
      answered?: Set<string>;
      /** The saved-filter parts it applied last time. TRAP T-a-saved-filter-is-its-readings */
      saved?: Set<string>;
    }
  >();
  /** The last load's answer: the rows, and the total before paging. */
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
  /** Load on the first bind, rather than waiting to be asked. */
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
   * THE QUERY — which scope holds each field, and each field's reading, in the
   * reader's terms. The filter is compiled from it, never kept beside it.
   * One reading per field, in the scope that holds it — so a chip, a column
   * heading and a legend cannot show two answers.
   * TRAP T-one-query-one-owner · TRAP T-one-field-one-filter-menu
   */
  #applied: Query = { v: 1, scopes: {} };
  /**
   * What the reader is EDITING. Every write lands here. On a local store it IS
   * `#applied` — one object, so a change applies at once. On a REMOTE store it
   * is a copy, and `commit()` sends it. TRAP T-apply-and-discard-wait-for-a-change
   */
  #draft: Query = this.#applied;
  /** Each saved filter's readings, by id. A scope says only whether one is ON.
   *  TRAP T-a-saved-filter-is-its-readings */
  #presets = new Map<string, Readonly<Record<string, FieldReading>>>();
  /** The last compile, so a load does not redo it. Written by `#recompose` — and
   *  by `setFilter`/`setState`, whose whole filter has no readings until step 7. */
  #filter: Filter | undefined;
  /** What a component OUTSIDE every component scope is under — the View alone.
   *  Unsplit (`null`), a whole filter set by hand: it is the View's.
   *  TRAP T-only-the-view-trickles-down */
  #viewFilter: Filter | undefined | null = null;
  /** Each component scope's own answer — for a summary bound INTO that scope. */
  #scoped: Record<string, Filter> = {};
  /** Every value a field can take, for the controls that draw its rows. */
  #domains = new Map<string, unknown[]>();
  /** A field's declared KIND and label. TRAP T-the-field-type-decides-the-clause */
  #fields = new Map<string, FieldDeclaration>();
  /** Each preset's name, and whether the reader may edit it. */
  #presetFacts = new Map<string, { label?: string; editable?: boolean }>();
  /** Each scope's name as a reader sees it. */
  #scopeLabels = new Map<string, string>();

  constructor(options: DataSourceOptions) {
    super();
    this.store = options.store;
    // REMOTE: the reader edits a copy, and Apply sends it.
    if (this.#remote) this.#draft = { v: 1, scopes: {} };
    this.#autoLoad = options.autoLoad ?? true;
    this.#searchFields = options.searchFields;
    this.#state = {
      sort: options.sort ?? [],
      group: options.group ?? null,
      search: '',
      page: 1,
      pageSize: options.pageSize ?? null,
    };
    this.#filter = options.filter;
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
    return structuredClone(this.#filter ? { ...this.#state, filter: this.#filter } : this.#state);
  }

  /** The Query the rows are under. A copy. TRAP T-one-query-one-owner */
  get query(): { applied: Query; draft: Query } {
    return { applied: structuredClone(this.#applied), draft: structuredClone(this.#draft) };
  }

  /**
   * Restore a whole Query — a reload, a trip away and back, a View's own
   * defaults. Each bound control over a scope is DRAWN its slice; nothing
   * replays a control. The named parts are left alone. Resolves once every
   * control has drawn.
   *
   * `holds: 'keep'` — a View: a scope the definition gives no `holds` keeps
   * the chips it has, and every answer is a clean slate.
   * TRAP T-one-query-one-owner · TRAP T-a-reload-replays-the-readers-answers · TRAP T-a-view-is-json
   */
  async setQuery(query: Query | QueryDefaults, options: { holds?: 'keep' } = {}): Promise<void> {
    if (query?.v !== 1 || typeof query.scopes !== 'object') {
      report({ code: 'unknown-query', message: 'setQuery: not a v1 Query, so nothing was restored.' });
      return;
    }
    const next = this.#definition(query, options.holds === 'keep');
    const before = new Set(this.selectedFields);
    this.#applied = next;
    this.#draft = this.#remote ? structuredClone(next) : this.#applied;
    this.#rehome();
    this.#recompose();
    this.dispatchEvent(new CustomEvent('scope-change', { detail: { scopes: this.scopes } }));
    for (const field of new Set([...before, ...this.selectedFields])) {
      this.dispatchEvent(new CustomEvent('selection-change', { detail: { field } }));
      this.#draw(field);
    }
    const drawn: Array<void | Promise<void>> = [];
    for (const [el, { scope }] of this.#bound) {
      if (typeof scope !== 'string' || !el.drawScope) continue;
      drawn.push(el.drawScope(structuredClone(this.#draft.scopes[scope] ?? { holds: [], readings: {} }), scope));
    }
    await Promise.all(drawn);
    // Drawn, never reported: the Query is already the answer.
    this.#syncSuperseded(false);
    this.#drawScopesSoon();
  }

  /** Restore a whole view state — a saved view, a deep link, a reload.
   *  TRAP T-set-state-merges-page-last */
  setState(next: Partial<ViewState>): void {
    if ('filter' in next) {
      this.#parts.clear();
      // A whole filter REPLACES every field selection too, or a restored view
      // keeps ticks the query no longer carries.
      this.#clearReadings();
      // A whole view is a clean slate, applied — not a draft. TRAP T-apply-and-discard-wait-for-a-change
      if (this.#remote) this.#applied = structuredClone(this.#draft);
      this.#filter = next.filter;
      this.#viewFilter = null;
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

  /** Has any load completed? Before one, there is nothing to count or group. */
  get loaded(): boolean {
    return this.#loaded;
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
    this.#clearReadings();
    if (this.#remote) this.#applied = structuredClone(this.#draft);
    this.#filter = filter;
    this.#viewFilter = null;
    this.#requery();
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
    this.#recompose();
  }

  /**
   * Write ONE scope's reading of ONE field — a component's own answer, which no
   * other control shares. `only` makes the scope NARROW that one bound
   * component: a legend's switched-off series filter ITS chart, and nothing
   * else. Its rows must be EVERY matching row — one page would lie about the
   * total. `undefined` removes the reading.
   * TRAP T-a-component-part-narrows-one-component · TRAP T-one-query-one-owner
   */
  write(scope: string, field: string, reading: FieldReading | undefined, at: { only?: Populatable } = {}): void {
    const bind = at.only ? this.#bound.get(at.only) : undefined;
    if (reading && at.only && bind?.rows !== 'all') {
      report({
        code: 'component-part-on-a-page',
        message: 'write: a scope that narrows one component needs a bound `rows: "all"` component.',
        at: { scope, field },
      });
      return;
    }
    const entry = this.#scope(scope);
    if (bind) entry.narrows = [bind.id];
    if (reading && answers(reading)) {
      entry.readings[field] = answerOf(reading);
      if (!entry.holds.includes(field)) entry.holds = [...entry.holds, field];
    } else {
      Reflect.deleteProperty(entry.readings, field);
      entry.holds = entry.holds.filter((f) => f !== field);
    }
    const narrows = entry.narrows ?? [];
    this.#prune();
    /* A scope that narrows ONE component filters rows already here — no fetch,
       so no Apply, even on a remote source. */
    if (this.#remote && narrows.length) this.#copyScope(this.#draft, this.#applied, scope);
    this.#recompose();
    // The shared filter did not move, so no load will push it: push it here.
    for (const [el, b] of this.#bound) if (narrows.includes(b.id)) this.#push(el);
    this.dispatchEvent(new CustomEvent('selection-change', { detail: { field, scope } }));
  }

  /** One scope's reading of one field, or undefined. A copy. */
  reading(scope: string, field: string): FieldReading | undefined {
    const held = this.#draft.scopes[scope]?.readings[field];
    return held ? structuredClone(held) : undefined;
  }

  /** What `compile` narrows each bound component by, alone — by bind id. */
  #only: Record<string, Filter> = {};
  /** Binds made, for an id when the element has none. */
  #binds = 0;

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

  /**
   * ONE SCOPE'S WHOLE ANSWER — a bar's report. Each reading lands at its
   * field's home; a reading that lives in this scope and is not named here is
   * cleared. A field raised to another scope is not this one's to clear.
   * TRAP T-a-filter-report-is-the-whole-answer · TRAP T-one-query-one-owner
   */
  answer(
    scope: string,
    readings: Readonly<Record<string, FieldReading>>,
    presets?: Readonly<Record<string, boolean>>,
  ): void {
    const was = Object.keys(this.#draft.scopes[scope]?.readings ?? {});
    for (const field of was) if (!(field in readings)) this.select(field, []);
    this.apply(readings);
    if (!presets) return;
    const before = JSON.stringify(this.#draft.scopes[scope]?.presets ?? {});
    // The saved filters it holds, on or off — the whole set. TRAP T-a-saved-filter-is-its-readings
    if (Object.keys(presets).length) this.#scope(scope).presets = { ...presets };
    else if (this.#draft.scopes[scope]) delete this.#draft.scopes[scope]!.presets;
    this.#prune();
    this.#recompose();
    if (JSON.stringify(this.#draft.scopes[scope]?.presets ?? {}) !== before) this.#drawScopesSoon();
  }

  /** A saved filter's readings, by id — the library a preset that is ON
   *  compiles from. `undefined` forgets one. TRAP T-a-saved-filter-is-its-readings */
  declarePreset(
    id: string,
    readings: Readonly<Record<string, FieldReading>> | undefined,
    facts: { label?: string; editable?: boolean } = {},
  ): void {
    if (readings) {
      this.#presets.set(id, readings);
      this.#presetFacts.set(id, { ...this.#presetFacts.get(id), ...facts });
    } else {
      this.#presets.delete(id);
      this.#presetFacts.delete(id);
    }
    this.#recompose();
    this.#drawScopesSoon();
  }

  /**
   * One scope as a control draws it WHOLE: each preset and field it holds —
   * a field held ABOVE keeps its place and says where it went — what it may
   * add, and, below the View, how its rows are arranged.
   * TRAP T-a-panel-asks-for-its-scopes
   */
  describe(scope: string): ScopeDescription {
    const q = this.#draft.scopes[scope] ?? { holds: [], readings: {} };
    const above = scope === VIEW ? [] : this.scope(VIEW);
    const presets: HeldFilter[] = Object.entries(q.presets ?? {}).map(([id, on]) => {
      const facts = this.#presetFacts.get(id) ?? {};
      return {
        id, label: facts.label ?? id, readings: this.#presets.get(id) ?? {}, active: on, removable: true,
        ...(facts.editable ? { editable: true } : {}),
      };
    });
    const fields: HeldFilter[] = q.holds.filter((f) => this.#fields.has(f)).map((f) => {
      const reading = this.#home(f) === scope ? this.#reading(f) : undefined;
      return {
        ...this.filterDef(f), removable: true,
        ...(reading ? { state: structuredClone(reading) } : {}),
        ...(above.includes(f) ? { appliedAt: this.scopeLabel(VIEW) } : {}),
      };
    });
    // Below the View, a saved filter it does not hold is offered too.
    const offered = scope === VIEW ? [] : [...this.#presetFacts.keys()]
      .filter((id) => !(id in (q.presets ?? {})))
      .map((id) => ({ id, label: this.#presetFacts.get(id)?.label ?? id,
        readings: this.#presets.get(id) ?? {}, ...(this.#presetFacts.get(id)?.editable ? { editable: true } : {}) }));
    const out: ScopeDescription = {
      scope, label: this.scopeLabel(scope), filters: [...presets, ...fields],
      available: [...this.addable(scope), ...offered],
    };
    /* HOW its rows are arranged — a component's, never the View's.
       TRAP T-group-and-sort-are-component-scope */
    if (scope !== VIEW && this.fields(scope).length) {
      const cols = this.fields(scope).filter((f) => this.#fields.has(f))
        .map((f) => ({ field: f, label: this.#fields.get(f)?.label ?? f }));
      out.group = cols;
      out.sort = cols;
      if (this.#state.group) out.groupField = this.#state.group;
      const [first] = this.#state.sort;
      if (first) {
        out.sortField = first.field;
        out.sortDirection = first.direction ?? 'asc';
      }
    }
    return out;
  }

  /** A control over several scopes — the panel — is drawn each WHOLE, once
   *  per moment, when what a scope holds changes. TRAP T-an-open-panel-follows-the-data-layer */
  #drawScopesSoon(): void {
    if (this.#drawingScopes) return;
    this.#drawingScopes = true;
    queueMicrotask(() => {
      this.#drawingScopes = false;
      for (const [el, { scope }] of this.#bound) {
        if (Array.isArray(scope) && el.drawScopes) void el.drawScopes(scope.map((s) => this.describe(s)));
      }
    });
  }

  /** A redraw of every scope control is queued. */
  #drawingScopes = false;

  /** Draw every bar over one scope from the Query — after a request that came
   *  from somewhere else (the panel) changed what it holds. */
  #drawBars(scope: string): void {
    for (const [el, { scope: s }] of this.#bound) {
      if (s === scope && el.drawScope) {
        void el.drawScope(structuredClone(this.#draft.scopes[scope] ?? { holds: [], readings: {} }), scope);
      }
    }
  }

  /** Switch a scope's presets: the ids given are ON, the rest it holds OFF. */
  #setPresets(scope: string, on: readonly string[]): void {
    const entry = this.#scope(scope);
    entry.presets = Object.fromEntries(Object.keys(entry.presets ?? {}).map((id) => [id, on.includes(id)]));
    this.#recompose();
  }

  /** The panel's answer: each field it changed, and each scope's presets. A
   *  preset switch is an Apply, as a bar's report is. */
  #answerScopes(readings: Record<string, Record<string, FieldReading>> | undefined): void {
    for (const [scope, fields] of Object.entries(readings ?? {})) {
      for (const [id, reading] of Object.entries(fields)) {
        if (id === 'presets') {
          this.#setPresets(scope, (reading.picked ?? []).map(String));
          this.#drawBars(scope);
          this.commit();
          continue;
        }
        this.select(id, reading.picked ?? [], reading);
      }
    }
  }

  /** A scope TAKES fields and presets: a field is held, and a saved filter
   *  comes ON — it is answered already. */
  #take(scope: string, ids: readonly string[]): void {
    const presets = ids.filter((id) => this.#presets.has(id));
    const fields = ids.filter((id) => !this.#presets.has(id) && !this.holds(scope, id));
    if (fields.length) this.hold(scope, [...this.scope(scope), ...fields]);
    if (presets.length) {
      const entry = this.#scope(scope);
      entry.presets = { ...entry.presets, ...Object.fromEntries(presets.map((id) => [id, true])) };
      this.#recompose();
      this.#drawScopesSoon();
    }
    this.#drawBars(scope);
  }

  /** A scope lets ONE go — a field or a preset. */
  #release(scope: string, id: string): void {
    const entry = this.#draft.scopes[scope];
    if (entry?.presets && id in entry.presets) {
      Reflect.deleteProperty(entry.presets, id);
      this.#prune();
      this.#recompose();
      this.#drawScopesSoon();
    } else {
      this.hold(scope, this.scope(scope).filter((f) => f !== id));
    }
    this.#drawBars(scope);
  }

  /** One field's state from a reading this source has NOT stored. */
  #stateFor(field: string, reading: FieldReading): FilterState {
    return fieldState({ field, ...this.#facts(field) }, reading);
  }

  /** What a field's clause needs to know: its values, kind and label.
   *  A RANGE field has no declared list, and passing an empty one would say
   *  it has no values at all. TRAP T-the-field-type-decides-the-clause */
  #facts(field: string, label?: string): Omit<FieldFacts, 'field'> {
    const facts = this.#fields.get(field) ?? {};
    const values = this.#domains.get(field);
    const named = label ?? facts.label;
    return {
      ...(values ? { values } : {}),
      ...(facts.type ? { type: facts.type } : {}),
      ...(named ? { label: named } : {}),
    };
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
  declareField(field: string, facts: FieldDeclaration = {}): void {
    const held = this.#fields.get(field) ?? {};
    this.#fields.set(field, { ...held, ...facts });
  }

  /** What `declareField` was told. */
  fieldFacts(field: string): FieldDeclaration {
    return { ...(this.#fields.get(field) ?? {}) };
  }

  /** A field's filter, as any bar or panel draws it — ONE definition, so two
   *  controls over a field cannot offer it two ways. Its options are the values
   *  the rows HOLD, never a lower-cased copy a heading's menu would not share.
   *  TRAP T-a-field-is-declared-once · TRAP T-one-comparison-rule-for-query-and-ui */
  filterDef(field: string): FieldFilter {
    const { type, label, ...rest } = this.#fields.get(field) ?? {};
    const body = type === 'number' || type === 'date' ? type : undefined;
    const values = body || rest.custom === 'only' ? [] : this.valuesFor(field).map(valueKey);
    // A date's declared values are the days a calendar may pick.
    const days = type === 'date' ? this.valuesFor(field).map(String) : [];
    return {
      id: field, label: label ?? field, ...rest,
      ...(body ? { kind: body } : {}),
      ...(values.length ? { options: values.map((v) => ({ value: v, label: v })) } : {}),
      ...(days.length ? { availableDates: days } : {}),
    };
  }

  /** Name a scope as a reader sees it — a panel's section, an Add list's note. */
  declareScope(scope: string, facts: { label: string }): void {
    this.#scopeLabels.set(scope, facts.label);
  }

  /** A scope's name as a reader sees it, or its id. */
  scopeLabel(scope: string): string {
    return this.#scopeLabels.get(scope) ?? scope;
  }

  /**
   * What a scope may still ADD: the declared fields it has, less those it
   * holds or `taken` names — each saying where it lives now, when that is
   * somewhere else, because adding it here MOVES it. Declared FIELDS only, so
   * Group and Sort — which arrange one component — are never offered.
   * TRAP T-a-bar-offers-only-what-its-scope-holds
   * TRAP T-group-and-sort-are-component-scope
   */
  addable(scope: string, taken: Iterable<string> = this.scope(scope)): FieldFilter[] {
    // UP IS OPEN, DOWN IS CLOSED: below the View, what it holds is not offered.
    const skip = new Set([...taken, ...(scope === VIEW ? [] : this.scope(VIEW))]);
    return this.fields(scope).filter((f) => !skip.has(f) && this.#fields.has(f)).map((f) => {
      const at = this.scopeOf(f);
      return at && at !== scope ? { ...this.filterDef(f), note: `in ${this.scopeLabel(at)}` } : this.filterDef(f);
    });
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
    const next: FieldReading = { ...answerOf(reading), picked: raws };
    /* CONDITIONS count. A field answered only by rows — "starts with Go", or
       an or-chain over two owners — has no picked values and no typed text, so
       this deleted the reading and the filter never applied.
       TRAP T-many-conditions-are-one-reading */
    this.#setReading(field, answers(next) ? next : undefined);
    this.#recompose();
    // AFTER the requery, so a listener sees the state the rows were fetched for.
    this.dispatchEvent(new CustomEvent('selection-change', { detail: { field } }));
    this.#draw(field);
  }

  /**
   * TELL EACH BAR over this field's scope what it now holds — a chip, a heading
   * or the panel changed it, and the bar is a VIEW of the Query, not a copy.
   * Its CONDITIONS go too, or a chip stays blank while its field filters.
   * A SUSPENDED field is skipped: the chip already shows it, and drawing it
   * would switch it back on. TRAP T-one-query-one-owner · TRAP T-grid-suspend-is-not-clear
   * TRAP T-a-conditioned-chip-answers-with-its-clause
   */
  #draw(field: string): void {
    const home = this.#home(field);
    const state = this.selection(field);
    if (state.fieldState === 'suspended') return;
    const picked = state.values.filter((v) => v.state === 'picked').map((v) => v.value);
    /* The WHOLE answer — its operator and its typed text too: "is not churned"
       drawn as "churned" is the opposite answer, and "contains an" drawn
       without its text is none. */
    // Its rows as the STATE reads them — an empty row is none.
    const { conditions: _raw, ...held } = answerOf(this.#reading(field) ?? {});
    const reading = { ...held, picked, ...(state.conditions.length ? { conditions: state.conditions } : {}) };
    for (const [el, { scope }] of this.#bound) {
      if (scope === home || (Array.isArray(scope) && scope.includes(home))) {
        el.drawReading?.(field, reading, home);
      }
    }
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
    const held = this.#reading(field);
    if (!held) return;
    this.select(field, held.picked ?? [], { ...held, suspended });
  }

  /**
   * One field's whole state — picked, unpicked, the condition — ready for a
   * chip, a column menu, a legend row or anything else that draws it.
   */
  selection(field: string, label?: string): FilterState {
    return fieldState({ field, ...this.#facts(field, label) }, this.#reading(field) ?? {});
  }

  /** Every field currently selected. */
  get selectedFields(): string[] {
    return Object.values(this.#draft.scopes).flatMap((s) => Object.keys(s.readings));
  }

  /* ── The Query: one reading per field, in the scope that holds it ─── */

  /** Where a field's reading lives: the View when it holds the field, else the
   *  one component scope that does, else the View — which narrows everyone. */
  #home(field: string): string {
    return this.scopeOf(field) ?? VIEW;
  }

  /** One field's reading, or undefined. */
  #reading(field: string): FieldReading | undefined {
    return this.#draft.scopes[this.#home(field)]?.readings[field];
  }

  /** One scope's entry, made when first written. */
  #scope(id: string): ScopeQuery {
    return (this.#draft.scopes[id] ??= { holds: [], readings: {} });
  }

  /** Write one field's reading at its home, or remove it. */
  #setReading(field: string, reading: FieldReading | undefined): void {
    for (const scope of Object.values(this.#draft.scopes)) if (!scope.narrows) Reflect.deleteProperty(scope.readings, field);
    if (reading) this.#scope(this.#home(field)).readings[field] = reading;
    this.#prune();
  }

  /** Forget every reading; the holds stay. */
  #clearReadings(): void {
    for (const scope of Object.values(this.#draft.scopes)) if (!scope.narrows) scope.readings = {};
    this.#prune();
  }

  /** A hold MOVED fields, so move each reading to its new home. Every reading
   *  still applies once, so the filter does not change. */
  #rehome(): void {
    for (const [id, scope] of Object.entries(this.#draft.scopes)) {
      if (scope.narrows) continue;
      for (const [field, reading] of Object.entries(scope.readings)) {
        const home = this.#home(field);
        if (home === id) continue;
        Reflect.deleteProperty(scope.readings, field);
        this.#scope(home).readings[field] = reading;
      }
    }
    this.#prune();
  }

  /** Which scope each answered field's reading sits in. */
  #homes(): Map<string, string> {
    const out = new Map<string, string>();
    for (const [id, scope] of Object.entries(this.#draft.scopes)) {
      if (!scope.narrows) for (const field of Object.keys(scope.readings)) out.set(field, id);
    }
    return out;
  }

  /** Forget a scope that holds nothing and answers nothing. */
  #prune(): void {
    for (const [id, scope] of Object.entries(this.#draft.scopes)) {
      if (!scope.holds.length && !Object.keys(scope.readings).length && !Object.keys(scope.presets ?? {}).length) {
        Reflect.deleteProperty(this.#draft.scopes, id);
      }
    }
  }

  /* ── Scopes: WHICH SURFACE holds a filter ──────────────────────────── */

  /**
   * A SCOPE is a named place a filter lives — a header bar, a grid's bar, a
   * panel section. The app names them; this holds only what is true NOW.
   *
   * It is here because two controls must agree on it and NEITHER MAY KNOW THE
   * OTHER EXISTS. A panel that asked a toolbar what it was holding is a panel
   * coupled to a toolbar. Held in the Query. TRAP T-a-scope-is-a-place-not-a-reach
   */

  /** The fields a scope is holding, in the order it holds them. */
  scope(name: string): string[] {
    return [...(this.#draft.scopes[name]?.holds ?? [])];
  }

  /** Every scope that holds a field. */
  get scopes(): string[] {
    return Object.keys(this.#draft.scopes).filter((id) => this.#draft.scopes[id]!.holds.length);
  }

  /** Say what a scope holds now. An empty list forgets the scope. */
  hold(name: string, fields: readonly string[]): void {
    const next = [...fields];
    const before = this.#draft.scopes[name]?.holds ?? [];
    // A no-op must not wake every listener — a bar re-renders on this.
    if (before.length === next.length && before.every((f, i) => f === next[i])) return;
    /* LET GO, and held nowhere else: its answer goes with it. Removing a chip
       is a clear — without this the filter moved to the View, and kept
       filtering with no chip on screen. Cleared FIRST, while this scope still
       holds it, so the controls over this scope are drawn the clear.
       TRAP T-one-query-one-owner */
    const elsewhere = (field: string): boolean => Object.entries(this.#draft.scopes)
      .some(([id, s]) => id !== name && !s.narrows && s.holds.includes(field));
    for (const field of before) {
      if (!next.includes(field) && !elsewhere(field) && this.#reading(field)) this.select(field, []);
    }
    const was = this.#homes();
    this.#scope(name).holds = next;
    this.#rehome();
    this.dispatchEvent(new CustomEvent('scope-change', { detail: { scope: name } }));
    /* RAISING CARRIES THE ANSWER, and lowering brings it back: an answer that
       moved scope is drawn where it lives now. TRAP T-up-is-open-down-is-closed */
    const now = this.#homes();
    for (const [field, home] of now) if (was.get(field) !== home) this.#draw(field);
    if (name === VIEW) this.#syncSuperseded(true);
    this.#drawScopesSoon();
  }

  /**
   * Tell each bar below the View which of its fields the View holds now — it
   * keeps the chip, suspended, and says where it went. One whose set changed
   * reports again: without the field raised, or with its own kept answer back.
   * TRAP T-a-superseded-chip-suspends-it-is-never-removed
   * TRAP T-an-inactive-chip-says-where-its-filter-went
   */
  #syncSuperseded(report: boolean): void {
    const above = this.scope(VIEW);
    for (const [el, { scope }] of this.#bound) {
      if (typeof scope !== 'string' || scope === VIEW || !el.supersede) continue;
      const was = (el.superseded ?? []).join();
      el.supersede(above, this.scopeLabel(VIEW));
      if (report && (el.superseded ?? []).join() !== was) el.report?.();
    }
  }

  /** Is this field held HERE? */
  holds(name: string, field: string): boolean {
    return (this.#draft.scopes[name]?.holds ?? []).includes(field);
  }

  /**
   * Which scope holds this field, or null — the View first, when it does.
   *
   * This is what SUPERSEDING is: a field the view scope holds is not the data
   * bar's to narrow, and neither bar has to know the other is there.
   */
  scopeOf(field: string): string | null {
    if (this.holds(VIEW, field)) return VIEW;
    // A scope that narrows ONE component is that component's alone.
    for (const [name, scope] of Object.entries(this.#draft.scopes)) {
      if (!scope.narrows && scope.holds.includes(field)) return name;
    }
    return null;
  }

  /* ── What a scope MAY hold ─────────────────────────────────────────────
   * Will, 2026-09-25: "Any component field can be applied to the view scope
   * as a filter. Only component fields can be added to that component's scoped
   * filters." And: "A filter can't exist in both the view and component scope
   * so adding to one removes it from the other. However, the same filter can
   * exist across multiple component scopes."
   * TRAP T-up-is-open-down-is-closed */

  /** What each COMPONENT scope has — its own fields, not what it holds now. */
  #offers = new Map<string, string[]>();

  /** Say which fields a component scope HAS. The view needs none: up is open. */
  offer(name: string, fields: readonly string[]): void {
    const next = [...new Set(fields)];
    const before = this.#offers.get(name);
    if (before && before.length === next.length && before.every((f, i) => f === next[i])) return;
    if (next.length) this.#offers.set(name, next);
    else this.#offers.delete(name);
    this.dispatchEvent(new CustomEvent('scope-change', { detail: { scope: name } }));
  }

  /**
   * The fields a scope may hold. A COMPONENT's are its own; the VIEW's are
   * every component's, because any field may be raised to narrow everything.
   */
  fields(name: string): string[] {
    if (name === VIEW_SCOPE) return [...new Set([...this.#offers.values()].flat())];
    return [...(this.#offers.get(name) ?? [])];
  }

  /** May this scope hold this field? Up is open; down is closed. */
  canHold(name: string, field: string): boolean {
    return name === VIEW_SCOPE || (this.#offers.get(name) ?? []).includes(field);
  }

  /**
   * Move a filter between scopes — ONE call, because the removal is not
   * optional. Two `hold()`s could be interrupted between them, and a field
   * filtered in both the view and a component has nobody owning it.
   *
   * RAISED to the view, it leaves EVERY component: the view narrows them all.
   * LOWERED, it leaves the view and lands in one component. Returns whether
   * it moved; a component that does not have the field refuses, and says so.
   */
  move(field: string, from: string, to: string): boolean {
    if (!this.canHold(to, field)) {
      report({
        code: 'scope-refused',
        message: 'move: a component scope may hold only its own fields.',
        at: { field, from, to, offers: (this.#offers.get(to) ?? []).join(',') },
      });
      return false;
    }
    const touched = new Set<string>([to]);
    const drop = (name: string): void => {
      const scope = this.#draft.scopes[name];
      if (!scope?.holds.includes(field)) return;
      scope.holds = scope.holds.filter((f) => f !== field);
      touched.add(name);
    };
    if (to === VIEW_SCOPE) {
      for (const name of Object.keys(this.#draft.scopes)) if (name !== VIEW_SCOPE) drop(name);
    } else {
      drop(VIEW_SCOPE);
      if (from !== VIEW_SCOPE && from !== to) drop(from);
    }
    const into = this.#scope(to);
    if (!into.holds.includes(field)) into.holds = [...into.holds, field];
    this.#rehome();
    // ONE event, naming every scope that changed — a listener never sees the
    // field in neither place, or in both.
    this.dispatchEvent(new CustomEvent('scope-change', { detail: { scopes: [...touched] } }));
    return true;
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
      filter: this.#filter,
      // The readings and holds the filter is compiled from. TRAP T-one-query-one-owner
      query: structuredClone(this.#applied),
      // …and what the reader is editing, where it differs. TRAP T-apply-and-discard-wait-for-a-change
      ...(this.#remote ? { draft: structuredClone(this.#draft), dirty: this.dirty() } : {}),
      presets: [...this.#presets.keys()],
      selections: Object.fromEntries(this.selectedFields.map((f) => [f, this.selection(f)])),
      parts: Object.fromEntries(this.#parts),
      // …and what narrows ONE component alone, by bind id.
      only: this.#only,
      scopes: Object.fromEntries(this.scopes.map((id) => [id, this.scope(id)])),
      offers: Object.fromEntries(this.#offers),
      fields: Object.fromEntries(this.#fields),
      // Which field a Date filter narrows — or `null`, which explains one
      // that narrows nothing. TRAP T-a-record-has-a-time-of-its-own
      time: this.store.time ?? null,
      bound: [...this.#bound.values()].map((e) => ({
        id: e.id, rows: e.rows, readonly: e.readonly, steerOnly: e.steerOnly,
      })),
      loaded: this.#loaded,
    };
  }

  /** Compile the Query under every named part, and load. The ONE place the
   *  filter is made. TRAP T-one-query-one-owner */
  #recompose(): void {
    const { filter, view, scoped, only } = compile(this.#applied, {
      field: (f) => this.#facts(f),
      preset: (id) => this.#presets.get(id),
    });
    const parts = [...this.#parts.values()];
    const next = andFilter([...parts, ...(filter ? [filter] : [])]);
    const viewed = andFilter([...parts, ...(view ? [view] : [])]);
    /* A DRAFT edit on a remote source changes nothing applied: no load, and
       the page stays where it is. It only changes what is pending. */
    const same = this.#remote && JSON.stringify(next) === JSON.stringify(this.#filter)
      && JSON.stringify(only) === JSON.stringify(this.#only);
    this.#only = only;
    this.#filter = next;
    this.#viewFilter = viewed;
    this.#scoped = scoped;
    this.#syncPending();
    if (!same) this.#requery();
  }

  /* ── Draft and applied — a REMOTE source only ─────────────────────────
   * TRAP T-apply-and-discard-wait-for-a-change */

  /** Do this source's loads reach outside the data layer? */
  get #remote(): boolean {
    return !!this.store.remote;
  }

  /**
   * A definition as a whole Query. Its sort, group and search set the source's
   * own — and leave the Query, which holds WHICH rows, not their order. A VIEW
   * (`keep`) keeps the chips a scope it does not name holds, and a field it
   * answers is held, so its chip shows it.
   */
  #definition(given: Query | QueryDefaults, keep: boolean): Query {
    const next: Query = { v: 1, scopes: {} };
    for (const [id, scope] of Object.entries(structuredClone(given.scopes))) {
      const { sort, group, search, ...rest } = scope;
      next.scopes[id] = { ...rest, holds: rest.holds ?? [], readings: rest.readings ?? {} };
      if (sort || group !== undefined || search !== undefined) this.#arrange({ sort, group, search });
    }
    // A RESTORE is exact; only a View keeps chips and shows its answers on them.
    if (!keep) return next;
    for (const [id, scope] of Object.entries(this.#draft.scopes)) {
      if (scope.narrows || given.scopes[id]?.holds) continue;
      (next.scopes[id] ??= { holds: [], readings: {} }).holds = [...scope.holds];
    }
    for (const scope of Object.values(next.scopes)) {
      if (scope.narrows) continue;
      for (const field of Object.keys(scope.readings)) {
        if (!scope.holds.includes(field)) scope.holds = [...scope.holds, field];
      }
    }
    return next;
  }

  /** A definition's arrangement onto the source's own. */
  #arrange(by: { sort?: SortSpec[] | undefined; group?: string | null | undefined; search?: string | undefined }): void {
    if (by.sort) {
      this.#state.sort = [...by.sort];
      delete this.#state.sortSuspended;
    }
    if (by.group !== undefined) {
      this.#state.group = by.group;
      this.#viewPages = null;
    }
    if (by.search !== undefined) this.#state.search = by.search;
    this.#state.page = 1;
  }

  /** SEND the draft — Apply, on a remote source. One field, one scope, or all. It loads. */
  commit(at: { scope?: string; field?: string } = {}): void {
    if (!this.#remote) return;
    if (at.field) this.#copyField(this.#draft, this.#applied, at.field);
    else if (at.scope) this.#copyScope(this.#draft, this.#applied, at.scope);
    else this.#applied = structuredClone(this.#draft);
    this.#recompose();
  }

  /** Put the applied answers back over the draft — Discard, on a remote source.
   *  One field, one scope, or all. Every control over them is drawn the applied answer. */
  discard(at: { scope?: string; field?: string } = {}): void {
    if (!this.#remote) return;
    const before = new Set(this.selectedFields);
    if (at.field) this.#copyField(this.#applied, this.#draft, at.field);
    else if (at.scope) this.#copyScope(this.#applied, this.#draft, at.scope);
    else this.#draft = structuredClone(this.#applied);
    for (const field of new Set([...before, ...this.selectedFields])) {
      this.dispatchEvent(new CustomEvent('selection-change', { detail: { field } }));
      this.#draw(field);
    }
    this.#syncPending();
  }

  /** Has this field been changed and not yet applied? Never, on a local source. */
  pending(field: string): boolean {
    if (!this.#remote) return false;
    const was = answerIn(this.#applied, field);
    const now = answerIn(this.#draft, field);
    return JSON.stringify(was) !== JSON.stringify(now);
  }

  /** Has anything in this scope — or in any scope — been changed and not applied?
   *  Its answers AND its saved filters on or off. */
  dirty(scope?: string): boolean {
    if (!this.#remote) return false;
    const ids = scope ? [scope]
      : [...new Set([...Object.keys(this.#applied.scopes), ...Object.keys(this.#draft.scopes)])];
    return ids.some((id) => JSON.stringify(answersOf(this.#applied.scopes[id]))
      !== JSON.stringify(answersOf(this.#draft.scopes[id])));
  }

  /** One field's answer, from one copy onto the other, in the scope that holds it. */
  #copyField(from: Query, to: Query, field: string): void {
    for (const scope of Object.values(to.scopes)) if (!scope.narrows) Reflect.deleteProperty(scope.readings, field);
    for (const [id, scope] of Object.entries(from.scopes)) {
      const held = scope.readings[field];
      if (!held || scope.narrows) continue;
      (to.scopes[id] ??= { holds: [...scope.holds], readings: {} }).readings[field] = structuredClone(held);
    }
  }

  /** One scope's slice, from one copy onto the other. */
  #copyScope(from: Query, to: Query, scope: string): void {
    const slice = from.scopes[scope];
    if (slice) to.scopes[scope] = structuredClone(slice);
    else Reflect.deleteProperty(to.scopes, scope);
  }

  /**
   * Tell each bound control over a scope which of its fields are PENDING
   * (`data-pending`, a field list) and whether its scope is DIRTY
   * (`data-dirty`). Attributes, as the rest of its state arrives.
   * TRAP T-push-writes-state-as-attributes
   */
  #syncPending(): void {
    for (const [el, { scope }] of this.#bound) {
      if (!scope) continue;
      const scopes = typeof scope === 'string' ? [scope] : [...scope];
      const fields = this.#remote
        ? [...new Set(scopes.flatMap((id) => Object.keys({
          ...this.#applied.scopes[id]?.readings, ...this.#draft.scopes[id]?.readings,
        })))].filter((f) => this.pending(f))
        : [];
      setAttr(el, 'data-pending', fields.length ? fields.join(' ') : undefined);
      setAttr(el, 'data-dirty', scopes.some((id) => this.dirty(id)) ? '' : undefined);
    }
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
    const { sort, group, search, page, pageSize } = this.#state;
    const filter = this.#filter;
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
      /* ANSWERED only while nothing else is in flight. A DIFFERENT load in
         flight will land and overwrite the answer, so a request back to the
         last finished one must still run — skipping it lost the reader's
         filter for good. TRAP T-in-flight-ticket-discards-stale */
      if (key === this.#lastLoadKey && this.#loaded && !this.#inFlight) return this.#result;
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
      /* …under the VIEW alone: a component scope narrows its own components,
         never a summary beside them. TRAP T-only-the-view-trickles-down */
      const windowed = this.#state.pageSize != null && !this.#state.group;
      const viewed = this.#viewFilter === null ? this.#filter : this.#viewFilter;
      const split = JSON.stringify(viewed) !== JSON.stringify(this.#filter);
      if (!this.#wantsAllRows()) this.#allRows = [];
      else if (!windowed && !split) this.#allRows = result.rows;
      else {
        const { skip: _skip, take: _take, filter: _filter, ...rest } = this.#loadOptions();
        const all = await this.store.load(viewed ? { ...rest, filter: viewed } : rest);
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
    /* A control over a scope of a REMOTE source is told so: its menus wait for
       Apply. TRAP T-apply-and-discard-wait-for-a-change */
    if (options.scope && this.#remote) el.setAttribute('data-remote', '');

    const off = (): void => {
      for (const [type, handler] of listeners) el.removeEventListener(type, handler);
      // UNLOCKED on the way out, or a component that outlives its source is mute.
      el.removeAttribute('data-locked');
      el.removeAttribute('data-remote');
    };
    this.#bound.set(el, {
      id: options.id ?? (el.id || `bind-${++this.#binds}`),
      readonly: readonlyBind,
      steerOnly: options.steerOnly ?? false,
      off,
      rows: options.rows ?? 'page',
      ...(options.as ? { as: options.as } : {}),
      ...(options.into ? { into: options.into } : {}),
      ...(options.scope ? { scope: options.scope } : {}),
      ...(options.deliver ? { deliver: options.deliver } : {}),
    });

    // TRAP T-signal-not-a-teardown-list — drops the BINDING; `once` leaves nothing.
    options.signal?.addEventListener('abort', () => this.unbind(el), { once: true });

    // Whatever is already loaded, so a component bound late is not blank.
    this.#push(el);
    if (Array.isArray(options.scope) && el.drawScopes) this.#drawScopesSoon();
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
          savedReadings?: Record<string, Record<string, FieldReading>>;
          presets?: Record<string, { on: boolean; readings: Record<string, FieldReading> }>;
        } | null;
        const bind = this.#bound.get(event.currentTarget as Populatable);
        /* A control over SEVERAL scopes — the panel — reports the ONE field it
           changed, in its scope, and its presets. TRAP T-the-panel-reports-its-own-reading */
        if (Array.isArray(bind?.scope)) {
          this.#answerScopes(detail['readings'] as Record<string, Record<string, FieldReading>> | undefined);
          return;
        }
        const readings = bar?.readings ?? readingsOf(detail['values']);
        /* A REPORT IS THE WHOLE ANSWER. A field this control answered before
           and does not name now is a field it has stopped filtering by, so it
           is cleared — its OWN fields only, never another control's.
           TRAP T-a-filter-report-is-the-whole-answer */
        /* A SCOPED bar answers in the Query: its saved filters are presets, on
           or off, and their readings go to the library. TRAP T-one-query-one-owner */
        if (typeof bind?.scope === 'string') {
          // What it holds, then what it answers. TRAP T-a-bar-reports-its-holds
          const el = event.currentTarget as Populatable;
          if (el.heldFields) this.hold(bind.scope, el.heldFields);
          const presets = bar?.presets ?? {};
          for (const [id, p] of Object.entries(presets)) this.#presets.set(id, p.readings);
          this.answer(bind.scope, readings,
            Object.fromEntries(Object.entries(presets).map(([id, p]) => [id, p.on])));
          /* A bar's report IS its Apply: its menus waited for it, remote. */
          this.commit();
          return;
        }
        for (const field of bind?.answered ?? []) {
          if (!(field in readings)) this.select(field, []);
        }
        if (bind) bind.answered = new Set(Object.keys(readings));
        this.apply(readings);
        /* SAVED FILTERS: one named part each, over any fields — and one switched
           off or taken away takes its part with it.
           TRAP T-a-saved-filter-is-its-readings */
        const saved = bar?.savedReadings ?? {};
        const parts = new Set(Object.keys(saved).map((id) => `saved:${id}`));
        for (const key of bind?.saved ?? []) if (!parts.has(key)) this.contribute(key, undefined);
        for (const [id, given] of Object.entries(saved)) {
          this.apply(given, { reach: 'component', key: `saved:${id}` });
        }
        if (bind) bind.saved = parts;
        return;
      }
      case 'filter-add':
      case 'filter-remove': {
        const el = event.currentTarget as Populatable;
        const scope = this.#bound.get(el)?.scope;
        // A scoped bar's chips ARE its scope's holds. TRAP T-a-bar-reports-its-holds
        if (typeof scope === 'string' && el.heldFields) this.hold(scope, el.heldFields);
        // The panel ASKS a scope to let one go. TRAP T-a-panel-asks-for-its-scopes
        else if (Array.isArray(scope) && typeof detail['scope'] === 'string' && typeof detail['id'] === 'string') {
          this.#release(detail['scope'], detail['id']);
        }
        return;
      }
      case 'filter-add-request': {
        const scope = detail['scope'];
        const ids = detail['ids'];
        if (typeof scope === 'string' && Array.isArray(ids)) this.#take(scope, ids.map(String));
        return;
      }
      case 'filter-apply':
      case 'filter-discard': {
        // One field's own Apply or Discard, on a remote source. TRAP T-apply-and-discard-wait-for-a-change
        const field = detail['field'];
        if (typeof field !== 'string') return;
        if (type === 'filter-apply') this.commit({ field });
        else this.discard({ field });
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
    const { sort, group, page, pageSize, sortSuspended } = this.#state;
    const filter = this.#filter;
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
    const base = entry?.rows === 'all' ? this.#allRows : this.#result.rows;
    /* What narrows THIS component alone, on top of the shared query — and, for
       a summary bound INTO a component scope, that scope's answer.
       TRAP T-a-component-part-narrows-one-component */
    const into = entry?.rows === 'all' && typeof entry.scope === 'string' ? this.#scoped[entry.scope] : undefined;
    const own = andFilter([entry ? this.#only[entry.id] : undefined, into].filter((f): f is Filter => !!f));
    const ownKey = JSON.stringify(own ?? null);
    if (entry && entry.lastRows === base && entry.lastOwn === ownKey) return;
    if (entry) {
      entry.lastRows = base;
      entry.lastOwn = ownKey;
    }
    const pushRows = own ? filterRows(base, own) : base;

    // populate() waits for the first render itself, so a component bound
    // before it upgraded still gets its rows.
    const adapt = entry?.as;
    const payload = adapt ? adapt(pushRows as Row[], this) : pushRows;

    // Through the callback it ASKED with, when a provider bound it.
    const give = entry?.deliver ?? ((p: unknown): void => { void el.populate?.(p); });
    // ONE NAMED PART, when the bind asked for one — see BindOptions.into.
    give(entry?.into ? mergeInto(el, entry.into, payload) : payload);
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

/** One field's answer in one copy of the Query, wherever it lives, or null. */
function answerIn(query: Query, field: string): FieldReading | null {
  for (const scope of Object.values(query.scopes)) {
    const held = scope.readings[field];
    if (held && !scope.narrows) return answerOf(held);
  }
  return null;
}

/** A scope's answers and its saved filters, as one comparable value. */
function answersOf(scope: ScopeQuery | undefined): unknown {
  if (!scope) return null;
  const readings = Object.fromEntries(Object.entries(scope.readings).map(([f, r]) => [f, answerOf(r)]));
  return { readings, presets: scope.presets ?? {} };
}

/** Does a reading answer anything? CONDITIONS count — a field answered only by
 *  rows has no picks and no text — but an EMPTY row does not: a cleared menu
 *  keeps one. TRAP T-many-conditions-are-one-reading */
function answers(reading: FieldReading): boolean {
  return (reading.picked ?? []).length > 0
    || (reading.text ?? '').trim() !== ''
    || (reading.conditions ?? []).some((r) => (r.text ?? '').trim() !== '' || (r.picked ?? []).length > 0);
}

/** The ANSWER keys of a reading only — a bar's reading also carries its label
 *  and every value it offers, which are facts, not what the reader chose. */
function answerOf(reading: FieldReading): FieldReading {
  const out: Record<string, unknown> = {};
  for (const key of READING_KEYS) if (reading[key] !== undefined) out[key] = reading[key];
  return out as FieldReading;
}
const READING_KEYS = ['picked', 'present', 'op', 'text', 'conditions', 'range', 'suspended'] as const;

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
