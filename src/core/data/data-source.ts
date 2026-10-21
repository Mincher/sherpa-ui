/**
 * data-source.ts — one place that owns how records are being VIEWED.
 *
 * Its parts: data-source-types, query-edits, field-catalogue, source-binding,
 * source-counts. TRAP T-one-comparator-one-source
 * TRAP T-view-state-lives-in-one-object
 *
 * Map:
 * - DataSource — ONE owner of how records are viewed: the query, scopes, groups, and binds
 * - .store — the records it reads; a write goes here, a view never does
 * - .timeField — The field holding each record's TIME, or undefined when the store has none.
 * - .state — The current view state.
 * - .query — The Query the rows are under. A copy.
 * - .export — This source's whole question as JSON, to send out.
 * - .import — Take a question back in, exactly: its saved filters, then its Query.
 * - .atDefault — Would a Reset to default change nothing? Applies nothing.
 * - .answered — Is there anything a Reset would clear, in one scope or any?
 * - .setQuery — Restore a whole Query — a reload, a trip away and back.
 * - .loaded — Has any load completed?
 * - .result — The whole of the last load's answer.
 * - .rows — The last load's rows, LIVE — state, query and result are copies
 * - .total — Matching rows before paging.
 * - .totalPages — Pages at the current size, at least 1.
 * - .setSort — Order by one field, or stop.
 * - .resumeSort — Resume the suspended sort.
 * - .clearSort — Forget the sort entirely — the gesture that is NOT a suspend.
 * - .setGroup — group by a field, or stop; a grid draws it, the source owns it
 * - .answer — ONE SCOPE'S WHOLE ANSWER — a bar's report.
 * - .describe — One scope, whole: its filters and answers, what it may add, how it is arranged.
 * - .answerScopes — The panel's answer: each field it changed.
 * - .declareValues — every value a field can take, so each control offers the same list
 * - .declareField — Declare a field's KIND and its reader-facing name.
 * - .declareFromRows — Each field here that its schema says nothing of takes it from the ROWS: a set, its unique values in order; a…
 * - .declareChildren — A tiered field's child values, from the rows the source holds: one pass.
 * - .fieldFacts — What `declareField` was told.
 * - .whereOf — Readings in the plain form a definition or a View writes, by this source's field types.
 * - .readingsOf — The plain form as readings, by this source's field types.
 * - .filterDef — A field's filter, as every bar, panel and heading draws it.
 * - .addable — What a scope may still add, each noting where it lives now.
 * - .valuesFor — What `declareValues` was told, as the data holds it.
 * - .groups — THE GROUPS IN FORCE — each value, and how many rows carry it.
 * - .selection — one field's whole state, ready for any control to draw
 * - .selectedFields — Every field currently selected.
 * - .debugState — EVERYTHING THIS SOURCE THINKS IS TRUE, in one object.
 * - .remote — Do this source's loads reach outside the data layer?
 * - .applyOn — Once per act, or LIVE while a value moves — never live when remote. Fixed by the options.
 * - .setSearch — the search text, across searchFields
 * - .setPage — which page to show
 * - .setPageSize — rows per page, or null for all
 * - .load — Re-read and push to every bound component.
 * - .reach — Can its store be reached?
 * - .failure — Why the store could not be reached, while it cannot — its kind and message — else null.
 * - .recheck — Try the store again: `down`, a fresh read; `unreached`, a read behind the rows shown, with no loading; `ok`,…
 * - .close — Let the store go: a change no longer reloads it, and its held set is dropped.
 * - .results — Each answered chip's results: the rows that reach it and match its answer.
 * - .valueResults — Each picked value's own results: the rows that reach its field and match that one value.
 * - .limitOptions — Does each list field offer only the values the filters before it leave? Settable, unlike applyOn.
 * - .present — Each list field's values its ruler leaves in a scope: the filters before it, or the View's subset.
 * - .offered — What each field below the top of a SERIAL set offers: the values the rows hold at its place.
 * - .attach — Take a component its binder has wired, and send it what is already loaded.
 * - .allRows — Every row a bound component is under, UNPAGED — what "Select all rows" ticks on a grid that holds one page.
 * - .unbind — Stop steering and stop populating this component.
 * - .boundElements — Every component currently bound.
 * - .answerScope — A scoped bar's whole answer: what it holds, each reading, its saved filters on or off. It is its Apply.
 * - .answerColumn — A heading's answer, in its grid's scope; a field no scope holds gets its chip.
 * - .reportPages — The grid's own page count, when every row is in hand: publish, load nothing.
 */
import {
  DEFAULT_OP, filterFields, filterNeedles, filterRows, groupSummaries, readField, valueKey,
} from './store.js';
import { readingClause } from './filter-state.js';
import { FieldCatalogue } from './field-catalogue.js';
import { SourceBinding } from './source-binding.js';
import { answerOrder, planWalk, walkStepwise } from './source-counts.js';
import { emptyWalk, walkInOrder, walkReads, type Walk, type WalkPlan } from './walk.js';
import {
  answerOf, arrangementOf, compile, eachScope, emptyScope, filterKey, freezeReading,
  VIEW, withoutArrangement, type Arrangement, type CompileFacts, type Query, type QueryDefaults, type ScopeQuery,
} from './query.js';
import {
  cameFrom, definitionOf, homeOf, keepOff, readingOf, rehome, scopeEntry, viewHeldReadings,
} from './query-edits.js';
import { coalesce, Latest } from './timing.js';
import { QueryContext, type QueryChange, type QueryHandle } from './query-context.js';
import { readingsOf, whereOf, type Condition, type Where } from './where.js';
import { report } from './report.js';
import { cacheOf, type CacheChangeDetail, type StoreCache } from './store-cache.js';
import { planRead, type Plan } from './read-plan.js';
import { failureOf, unreached, type Failure } from './failure.js';
import type { FieldReading, FilterState } from './filter-state.js';
import type {
  Filter, GroupSummary, LoadOptions, LoadResult, Row, SortDirection, SortSpec, Store,
} from './store.js';
import type {
  AttachFacts, BindSink, BoundControl, BoundView, DataChangeDetail, DataSourceOptions, FieldDeclaration, FieldFilter,
  FilterSet, HeldFilter, ScopeDescription, SourceState, ViewState,
} from './data-source-types.js';
export type {
  AttachFacts, BindSink, BoundControl, BoundView, DataChangeDetail, DataSourceOptions, FieldDeclaration, FieldFilter,
  FilterSet, HeldFilter, OrganiseColumn, ScopeDescription, ScopeShows, SourceState, ViewState,
} from './data-source-types.js';

/** A change to the arrangement: what it names, and nothing else. */
type ArrangeEdit = { sort?: SortSpec[]; group?: string | null; sortSuspended?: SortSpec | undefined; search?: string };

export class DataSource extends EventTarget {
  readonly store: Store;
  /** The view this source owns: sort, group, search, page. The filter is compiled. */
  #state: Pick<ViewState, 'page' | 'pageSize'>;
  /** The fields a search matches, or every field. */
  #searchFields: string[] | undefined;
  /** Every bound component, how it is bound, and what it is pushed and drawn. */
  readonly #binding = new SourceBinding({
    describe: (s) => this.describe(s),
    scopeLabel: (s) => this.#context.scopeLabel(s),
    partScopes: () => this.#narrowing.keys(),
    view: () => this.#boundView(),
    rows: (w) => (w === 'all' ? this.#allRows : this.#result.rows),
    only: (id) => this.#only[id],
    scoped: (s) => this.#scoped[s],
    mintId: () => this.#member.mintId(),
  });
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
  #inFlight = new Latest();
  /** The ViewState the last COMPLETED load asked for, serialised. */
  #lastLoadKey: string | null = null;
  /** Has any load completed? Until one has, nothing may be skipped. */
  #loaded = false;
  /** The key of the load currently in flight. */
  #inFlightKey: string | null = null;
  /** The key the load in flight was ASKED with, before the walk set picks aside. */
  #inFlightAsked: string | null = null;
  /** The Query and the page's declarations are its context's. 366 step 12 */
  readonly #context: QueryContext;
  /** What it holds of the context: the live Query, its ids, its fellow members. */
  readonly #member: QueryHandle;
  /* Read and written through these, so each method reads as it did. QueryLive says what each is.
     The filter is compiled from the Query, never kept beside it. TRAP T-one-query-one-owner */
  get #applied(): Query { return this.#member.live().applied; }
  set #applied(query: Query) { this.#member.live().applied = query; }
  get #draft(): Query { return this.#member.live().draft; }
  set #draft(query: Query) { this.#member.live().draft = query; }
  get #defaults(): Map<string, ScopeQuery> { return this.#member.live().defaults; }
  get #sets(): Map<string, FilterSet[]> { return this.#member.live().sets; }
  get #offers(): Map<string, string[]> { return this.#member.live().offers; }
  get #narrowing(): Map<string, { field: string; only: BoundControl; label?: string }> { return this.#member.live().parts; }
  /** The last compile, so a load does not redo it. Written by `#compileNow`. */
  #filter: Filter | undefined;
  /** What a component OUTSIDE every component scope is under — the View alone.
   *  TRAP T-only-the-view-trickles-down */
  #viewFilter: Filter | undefined;
  /** Each component scope's own answer — for a summary bound INTO that scope. */
  #scoped: Record<string, Filter> = {};
  /** What each field IS: its kind, label and values. TRAP T-the-field-type-decides-the-clause */
  readonly #catalogue = new FieldCatalogue();

  /* ── A remote store's whole set, held. Will, TODO 340 ─────────────────
   * TRAP T-a-remote-source-holds-its-whole-set · TRAP T-a-store-has-one-cache */
  /** The most rows it holds; 0 holds none. */
  readonly #holdRows: number;
  /** Its store's ONE held set, shared with every source over it — remote only. */
  readonly #cache: StoreCache | null;
  /** How many whole reads had landed when it was made: a set from before may miss a writer. */
  readonly #since: number;
  /** Its first hold has tried a failed whole read once more. */
  #checked = false;
  /** How its last question was answered. TRAP T-a-read-is-planned */
  #plan: Plan = 'store';
  /** It has started its ONE check of the set behind it. */
  #tried = false;
  /** Its last ask failed and the store could not be reached: nothing to show. */
  #down: Failure | null = null;

  constructor(options: DataSourceOptions) {
    super();
    this.store = options.store;
    // REMOTE: the reader edits a copy, and Apply sends it — the context splits it.
    this.#context = options.query ?? new QueryContext();
    this.#member = this.#context.join({
      remote: this.#remote, showsRows: (scope) => this.#binding.showsRows(scope), bindOf: (el) => this.#binding.get(el),
      heard: (change) => this.#hear(change),
      has: (field) => this.#catalogue.has(field),
      raws: (field, picked) => {
        const declared = this.#catalogue.byKey(field);
        return picked.map((v) => declared.get(valueKey(v)) ?? v);
      },
    });
    this.#autoLoad = options.autoLoad ?? true;
    this.#limitOptions = options.limitOptions ?? false;
    this.#applyOn = options.applyOn ?? 'change';
    this.#debounce = options.debounce ?? 300;
    this.#holdRows = options.holdRows ?? 50_000;
    this.#searchFields = options.searchFields;
    this.#state = {
      page: 1,
      pageSize: options.pageSize ?? null,
    };
    this.#cache = this.#remote && this.#holdRows > 0 ? cacheOf(this.store) : null;
    this.#since = this.#cache?.gen ?? 0;
    this.#heard = this.store.history?.seq ?? 0;
    // A held source hears its store through the cache, which takes each change once.
    (this.#cache ?? this.store).addEventListener('change', this.#onStoreChange);
    this.#cache?.addEventListener('set', this.#onSet);
    /* A RECORD'S TIME IS A DATE, said once, by whoever knows it — the store.
       Nothing downstream has to know the dataset calls it `created`.
       TRAP T-a-record-has-a-time-of-its-own */
    if (this.store.time) this.declareField(this.store.time, { type: 'date' });
    // What each field MAY hold, as the data's own schema says. TRAP T-the-data-says-what-a-field-may-hold
    for (const [field, { values, ...facts }] of Object.entries(this.store.domains ?? {})) {
      if (values) this.declareValues(field, values);
      if (Object.keys(facts).length) this.declareField(field, facts);
    }
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
    const { sort, group, search, sortSuspended } = this.#arrangement();
    const state: ViewState = { sort, group, search, ...this.#state, ...(sortSuspended ? { sortSuspended } : {}) };
    return structuredClone(this.#filter ? { ...state, filter: this.#filter } : state);
  }

  /** How the rows are arranged: the Query's, in the ONE scope that arranges.
   *  TRAP T-group-and-sort-are-component-scope */
  #arrangement(): Arrangement {
    return arrangementOf(this.#applied);
  }

  /** Its QueryContext: `query.applied` is the Query the rows are under, and
   *  `query.draft` what the reader is editing — a copy each. TRAP T-one-query-one-owner */
  get query(): QueryContext {
    return this.#context;
  }

  /** This source's whole question as JSON — the Query as applied, and how its
   *  rows are arranged. TRAP T-a-page-goes-out-as-json */
  export(): SourceState {
    const query = structuredClone(this.#applied);
    // It names its arrangement, none too: a View saved from it puts back the rows as they were.
    if (!arrangementOf(query).scope) query.scopes[VIEW] = { ...(query.scopes[VIEW] ?? emptyScope()), sort: [] };
    return { v: 1, query };
  }

  /** Take a question back in, exactly. */
  async import(state: SourceState): Promise<void> {
    if (state?.v !== 1) {
      report({ code: 'unknown-state', message: 'import: not a v1 source state, so nothing was taken in.' });
      return;
    }
    await this.setQuery(state.query);
  }

  /**
   * Would a Reset to default change nothing? What filters NOW, which filters
   * each scope holds, and how the rows are arranged, against `base` as defined
   * with a View's own Query over it. Applies nothing. TODO 231
   * TRAP T-reset-to-default-is-the-views-own
   */
  atDefault(base: Query, view?: QueryDefaults): boolean {
    // Read only, so neither is copied.
    const first = this.#definition(base, false, this.#draft, false);
    const second = view ? this.#definition(view, true, first, false) : null;
    const facts = this.#compileFacts();
    const filters = (q: Query): string => {
      const { filter, only } = compile(q, facts);
      return JSON.stringify([filterKey(filter), Object.entries(only).map(([el, f]) => [el, filterKey(f)]).sort()]);
    };
    const at = second ?? first;
    if (filters(at) !== filters(this.#applied)) return false;
    /* WHICH filters each scope holds: one taken off, or moved, is a change too
       (Will, 2026-10-12). A component's own part is its, not the reader's. */
    const holds = (q: Query): string => JSON.stringify(eachScope(q)
      .filter(([, scope]) => scope.holds.length)
      .map(([id, scope]) => [id, [...scope.holds].sort()]).sort());
    if (holds(at) !== holds(this.#applied)) return false;
    // How the rows are arranged, wherever: a sort switched off is no sort.
    const arranged = (q: Query): string => {
      const { sort, group, search } = arrangementOf(q);
      return JSON.stringify([sort, group, search]);
    };
    return arranged(at) === arranged(this.#applied);
  }

  /** Is there anything a Reset would clear — in one scope, or any: a reading
   *  that filters, or the rows arranged? TODO 231 */
  answered(scope?: string): boolean {
    const { sort, group } = this.#arrangement();
    if (sort.length || group) return true;
    const facts = this.#compileFacts();
    return (scope ? [scope] : Object.keys(this.#applied.scopes)).some((id) => {
      const at = this.#applied.scopes[id];
      return !!at && Object.entries(at.readings).some(([field, reading]) => !!readingClause({ field, ...facts.field?.(field) }, reading));
    });
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
    const was = this.#arrangement();
    const before = new Set(this.selectedFields);
    this.#applied = next;
    this.#draft = this.#remote ? structuredClone(next) : this.#applied;
    rehome(this.#draft);
    const now = this.#arrangement();
    if (now.group !== was.group) this.#viewPages = null;
    this.#recompose();
    // Re-arranged, or searched: page one, and a load, whatever the filter did.
    const order = (a: Arrangement): string => JSON.stringify([a.sort, a.group, a.search]);
    if (order(now) !== order(was)) this.#requery();
    this.dispatchEvent(new CustomEvent('scope-change', { detail: { scopes: this.#context.scopes } }));
    for (const field of new Set([...before, ...this.selectedFields])) {
      this.dispatchEvent(new CustomEvent('selection-change', { detail: { field } }));
      this.#draw(field);
    }
    await this.#binding.drawEveryBar();
    // Drawn, never reported: the Query is already the answer.
    this.#syncSuperseded(false);
    this.#binding.drawScopesSoon();
  }

  /** Has any load completed? Before one, there is nothing to count or group. */
  get loaded(): boolean {
    return this.#loaded;
  }

  /** The whole of the last load's answer. A shallow copy: its `rows` is the live array. TRAP T-result-is-the-hosts-half */
  get result(): LoadResult {
    return { ...this.#result };
  }

  /** The last load's rows — one page when paged. LIVE, not a copy: read it, never change it. */
  get rows(): readonly Row[] {
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
    if (this.#arrangement().group && this.#viewPages != null) return Math.max(1, this.#viewPages);
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
  setSort(field: string | null, direction: SortDirection = 'asc', scope?: string): void {
    if (field) this.#arrange({ sort: [{ field, direction }], sortSuspended: undefined }, scope);
    else {
      // A second suspend in a row must not overwrite the memory with nothing.
      const live = this.#arrangement().sort[0];
      this.#arrange({ sort: [], ...(live ? { sortSuspended: live } : {}) }, scope);
    }
    this.#requery();
  }

  /** Resume the suspended sort. No-op when there is none. */
  resumeSort(): void {
    const held = this.#arrangement().sortSuspended;
    if (!held) return;
    this.setSort(held.field, held.direction ?? 'asc');
  }

  /** Forget the sort entirely — the gesture that is NOT a suspend. */
  clearSort(): void {
    this.#arrange({ sort: [], sortSuspended: undefined });
    this.#requery();
  }

  setGroup(field: string | null, scope?: string): void {
    this.#arrange({ group: field }, scope);
    // The old count was measured against the OLD grouping. Drop it and wait for
    // the next draw. TRAP T-grouped-paging-belongs-to-the-view
    this.#viewPages = null;
    this.#requery();
  }







  /** What `compile` narrows each bound component by, alone — by bind id. */
  #only: Record<string, Filter> = {};

  /**
   * ONE SCOPE'S WHOLE ANSWER — a bar's report. Each reading lands at its
   * field's home; a reading that lives in this scope and is not named here is
   * cleared. A field raised to another scope is not this one's to clear.
   * TRAP T-a-filter-report-is-the-whole-answer · TRAP T-one-query-one-owner
   */
  answer(scope: string, readings: Readonly<Record<string, FieldReading>>): void {
    const was = Object.keys(this.#draft.scopes[scope]?.readings ?? {});
    for (const field of was) if (!(field in readings)) this.#context.select(field, []);
    for (const [field, reading] of Object.entries(readings)) this.#context.select(field, reading.picked ?? [], reading);
  }

  /**
   * One scope as a control draws it WHOLE: each field it holds — a field held
   * ABOVE keeps its place and says where it went — what it may add, and, below
   * the View, how its rows are arranged. TRAP T-a-panel-asks-for-its-scopes
   */
  describe(scope: string): ScopeDescription {
    const q = this.#draft.scopes[scope] ?? emptyScope();
    const above = scope === VIEW ? [] : this.#context.scope(VIEW);
    const part = this.#narrowing.get(scope);
    if (part) {
      /* ONE Simple filter: a chip per value, each with the series it is drawn
         in. No Advanced — Will, TODO 52. TRAP T-a-chart-scope-is-its-legend-field */
      const { advanced: _a, kind: _k, options, ...def } = this.filterDef(part.field);
      const reading = q.readings[part.field];
      return {
        scope, label: part.label ?? def.label, shows: 'chart', part: true, available: [],
        filters: options?.length ? [{
          ...def,
          options: options.map((o, i) => ({ ...o, swatch: i + 1 })),
          ...(reading ? { state: structuredClone(reading) } : {}),
          ...(above.includes(part.field) ? { appliedAt: this.#context.scopeLabel(VIEW) } : {}),
        }] : [],
      };
    }
    /* EVERY field it holds, declared or not: one left out still filters. In the
       ONE order — each set together (D2 A). TRAP T-a-broken-assumption-reports
       TRAP T-one-walk-counts-and-limits-in-order */
    const held = answerOrder(this.#draft, this.#sets.get(scope) ?? [], scope).flatMap((e) => (e.held ? [e.id] : []));
    const fields: HeldFilter[] = held.map((f) => {
      const reading = q.readings[f];
      const down = scope === VIEW ? this.#sendTo(f) : undefined;
      const from = cameFrom(this.#draft, f);
      return {
        ...this.filterDef(f), removable: true,
        // The View's date slices the whole view, so it is a RANGE. Will, TODO 20b.
        ...(scope === VIEW && this.#catalogue.get(f)?.type === 'date' ? { range: true } : {}),
        ...(reading ? { state: structuredClone(reading) } : {}),
        ...(above.includes(f) ? { appliedAt: this.#context.scopeLabel(VIEW) } : {}),
        ...(down ? { sendTo: {
          scope: down, label: this.#narrowing.get(down)?.label ?? this.#context.scopeLabel(down), ...(down === from ? { origin: true } : {}),
        } } : {}),
      };
    });
    const shows = scope === VIEW ? 'view'
      : this.#binding.showsOf(scope);
    const sets = this.#context.sets(scope);
    const out: ScopeDescription = {
      scope, label: this.#context.scopeLabel(scope), ...(shows ? { shows } : {}), filters: fields,
      available: this.addable(scope), ...(sets.length ? { sets } : {}),
      ...(q.suspended ? { suspended: true } : {}),
    };
    /* HOW its rows are arranged — only in a scope that arranges, and its own
       arrangement only. TRAP T-group-and-sort-are-component-scope */
    if (this.#context.arranges(scope) && this.#context.fields(scope).length) {
      const cols = this.#context.fields(scope).filter((f) => this.#catalogue.has(f))
        .map((f) => ({ field: f, label: this.#catalogue.get(f)?.label ?? f }));
      out.group = cols;
      out.sort = cols;
      const arranged = this.#arrangement();
      const mine = (this.#arrangedIn() ?? scope) === scope;
      if (mine && arranged.group) out.groupField = arranged.group;
      const [first] = mine ? arranged.sort : [];
      if (first) {
        out.sortField = first.field;
        out.sortDirection = first.direction ?? 'asc';
      }
    }
    return out;
  }

  /** The panel's answer: each field it changed. */
  answerScopes(readings: Record<string, Record<string, FieldReading>> | undefined): void {
    for (const [scope, fields] of Object.entries(readings ?? {})) {
      for (const [id, reading] of Object.entries(fields)) {
        // A chart's own field narrows that chart alone. TRAP T-a-chart-scope-is-its-legend-field
        if (this.#narrowing.has(scope)) {
          this.#context.write(scope, id, reading.picked?.length ? { picked: [...reading.picked] } : undefined);
          continue;
        }
        this.#context.select(id, reading.picked ?? [], reading);
      }
    }
  }



  /** The ONE scope a View field is sent down to: the one it came UP from,
   *  while that still has it, else the first that has it — a component's, in
   *  the page's order, then a chart's own. Will, TODO 346. TRAP T-send-to-view-filters */
  #sendTo(field: string): string | undefined {
    const has = (scope: string): boolean =>
      scope !== VIEW && (this.#narrowing.get(scope)?.field === field || this.#context.canHold(scope, field));
    const from = cameFrom(this.#draft, field);
    if (from && has(from)) return from;
    return [...this.#offers.keys(), ...this.#narrowing.keys()].find(has);
  }



  /* ── Selection, by FIELD ───────────────────────────────────────────── */

  /**
   * Declare every value a field can take, so a control drawing its rows offers
   * the same list wherever it appears — and the same STRINGS, which is what
   * lets two controls share one selection.
   */
  declareValues(field: string, values: readonly unknown[]): void {
    this.#age++;
    this.#catalogue.declareValues(field, values);
    this.#recomposeFor([field]);
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
    this.#age++;
    this.#catalogue.declare(field, facts);
    this.#recomposeFor([field]);
  }

  /** A field's facts moved: an answer the Query holds for it compiles again,
   *  with its type and values as they are now. 366 step 7 */
  #recomposeFor(fields: readonly string[]): void {
    const answered = (f: string): boolean => eachScope(this.#applied).some(([, s]) => f in s.readings);
    if (fields.some(answered)) this.#recompose();
  }

  /**
   * Each field here that its schema says nothing of takes it from the ROWS: a
   * set, its unique values in order; a number, its lowest and highest. One ask
   * — the store's distinct() where it has one, else one load — and only when a
   * field needs it. TRAP T-the-data-says-what-a-field-may-hold
   */
  async declareFromRows(fields: readonly string[]): Promise<void> {
    await this.#catalogue.fromRows(fields, async (open) => {
      await this.#hold();
      const reads = this.#reads;
      if (reads.distinct) return reads.distinct(open, {});
      const age = this.#rowsAge;
      const { rows } = await reads.load({});
      // The walk reads these rows too, until they change. TRAP T-one-walk-counts-and-limits-in-order
      if (reads === this.store && !this.#remote && age === this.#rowsAge && rows.length <= this.#holdRows) {
        this.#rowsCache = { age, rows };
      }
      return Object.fromEntries(open.map((f) => [f, rows.map((r) => readField(r, f))]));
    });
    // Each field's facts moved: what was counted is out of date.
    this.#age++;
    this.#recomposeFor(fields);
  }

  /** A tiered field's child values, from the rows the walk reads — one read for
   *  both. A store it does not hold reads a parent's children later, as it opens. TODO 369 */
  async declareChildren(field: string): Promise<void> {
    const child = this.#catalogue.get(field)?.child;
    if (!child) return;
    const rows = await this.#walkRows();
    if (!rows) return;
    this.#catalogue.declareChildren(field, rows.map((r) => [readField(r, field), readField(r, child)] as const));
    this.#age++;
  }

  /** What `declareField` was told. */
  fieldFacts(field: string): FieldDeclaration {
    return this.#catalogue.copyOf(field);
  }

  /** Readings in the plain form a definition or a View writes, by this source's
   *  field types. TRAP T-one-way-to-write-a-condition */
  whereOf(readings: Readonly<Record<string, FieldReading>>): Where {
    return whereOf(readings, (f) => this.#catalogue.facts(f));
  }

  /** The plain form as readings, by this source's field types. */
  readingsOf(where: Readonly<Record<string, Condition>>): Record<string, FieldReading> {
    return readingsOf(where, (f) => this.#catalogue.facts(f));
  }

  /** A field's filter, as any bar or panel draws it — ONE definition, so two
   *  controls over a field cannot offer it two ways. Its options are the values
   *  the rows HOLD, never a lower-cased copy a heading's menu would not share.
   *  TRAP T-a-field-is-declared-once · TRAP T-one-comparison-rule-for-query-and-ui */
  filterDef(field: string): FieldFilter {
    return this.#catalogue.filterDef(field);
  }




  /** The scope whose Group or Sort set the rows' arrangement — while it still
   *  arranges; else none, and every arranging scope shows it. */
  #arrangedIn(): string | undefined {
    const { scope } = this.#arrangement();
    return scope && this.#context.arranges(scope) ? scope : undefined;
  }

  /** Write the arrangement into the Query, in BOTH copies: the scope given,
   *  else the one that arranges now, else the View; every other scope loses
   *  it. It compiles nothing. 366 step 8 · TRAP T-group-and-sort-are-component-scope */
  #arrange(next: ArrangeEdit, scope?: string): void {
    const now = this.#arrangement();
    const at = scope ?? now.scope ?? VIEW;
    const sort = next.sort ?? now.sort;
    const group = 'group' in next ? next.group ?? null : now.group;
    const sortSuspended = 'sortSuspended' in next ? next.sortSuspended : now.sortSuspended;
    const search = next.search ?? now.search;
    for (const query of new Set([this.#applied, this.#draft])) {
      for (const s of Object.values(query.scopes)) {
        delete s.sort;
        delete s.group;
        delete s.sortSuspended;
        delete s.search;
      }
      if (!sort.length && group == null && !sortSuspended && !search) continue;
      const s = scopeEntry(query, at);
      s.sort = sort.map((by) => ({ ...by }));
      if (group != null) s.group = group;
      if (sortSuspended) s.sortSuspended = { ...sortSuspended };
      if (search) s.search = search;
    }
    this.dispatchEvent(new CustomEvent('scope-change', { detail: { scopes: this.#context.scopes } }));
  }





  /**
   * What a scope may still ADD: the declared fields it has, less those it
   * holds or `taken` names — each saying where it lives now, when that is
   * somewhere else, because adding it here MOVES it. Declared FIELDS only, so
   * Group and Sort — which arrange one component — are never offered.
   * TRAP T-a-bar-offers-only-what-its-scope-holds
   * TRAP T-group-and-sort-are-component-scope
   */
  addable(scope: string, taken: Iterable<string> = this.#context.scope(scope)): FieldFilter[] {
    // UP IS OPEN, DOWN IS CLOSED: below the View, what it holds is not offered.
    // TRAP T-component-extends-view-never-alters-it
    const skip = new Set([...taken, ...(scope === VIEW ? [] : this.#context.scope(VIEW))]);
    return this.#context.fields(scope).filter((f) => !skip.has(f) && this.#catalogue.has(f)).map((f) => {
      const at = this.#context.scopeOf(f);
      return at && at !== scope ? { ...this.filterDef(f), note: this.#context.scopeLabel(at) } : this.filterDef(f);
    });
  }

  /** What `declareValues` was told, as the data holds it. */
  valuesFor(field: string): unknown[] {
    return this.#catalogue.valuesFor(field);
  }


  /**
   * TELL EACH BAR over this field's scope what it now holds — a chip, a heading
   * or the panel changed it, and the bar is a VIEW of the Query, not a copy.
   * Its CONDITIONS go too, or a chip stays blank while its field filters.
   * A SUSPENDED answer is drawn too, and SAYS it is — `suspended: true` — so a
   * bar keeps its chip off and a panel does not show an answer that filters
   * nothing. TRAP T-one-query-one-owner · TRAP T-grid-suspend-is-not-clear
   * TRAP T-a-conditioned-chip-answers-with-its-clause
   * TRAP T-a-suspended-answer-is-drawn-as-off
   */
  #draw(field: string): void {
    const home = homeOf(this.#draft, field);
    // A View answer shows in every grid's heading too.
    if (home === VIEW) this.#syncColumns();
    const state = this.selection(field);
    const off = state.fieldState === 'suspended';
    // Suspended, its values are not "picked" in the state: they are the reading's own.
    const picked = off ? (readingOf(this.#draft, field)?.picked ?? []).map(valueKey)
      : state.values.filter((v) => v.state === 'picked').map((v) => v.value);
    /* The WHOLE answer — its operator and its typed text too: "is not churned"
       drawn as "churned" is the opposite answer, and "contains an" drawn
       without its text is none. */
    // Its rows as the STATE reads them — an empty row is none.
    const { conditions: _raw, ...held } = answerOf(readingOf(this.#draft, field) ?? {});
    const reading = { ...held, picked, ...(state.conditions.length ? { conditions: state.conditions } : {}) };
    this.#binding.drawReading(field, reading, home);
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
  groups(field: string = this.#arrangement().group ?? ''): GroupSummary[] {
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
    /* The rows a component SHOWS: an unwindowed load is those, under every
       scope. `#allRows` is the VIEW's alone, so it stands in only for a page.
       TRAP T-a-group-is-a-data-layer-concept */
    const whole = this.#arrangement().group != null || this.#state.pageSize == null;
    const rows = !whole && this.#allRows.length ? this.#allRows : this.#result.rows;
    return groupSummaries(rows, field);
  }



  /**
   * One field's whole state — picked, unpicked, the condition — ready for a
   * chip, a column menu, a legend row or anything else that draws it.
   */
  selection(field: string, label?: string): FilterState {
    return this.#catalogue.stateFor(field, readingOf(this.#draft, field) ?? {}, label);
  }

  /** Every field currently selected. */
  get selectedFields(): string[] {
    return Object.values(this.#draft.scopes).flatMap((s) => Object.keys(s.readings));
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




  /** Each grid below the View is told the fields the View holds, as APPLIED. */
  #syncColumns(): void {
    this.#binding.supersedeColumns(viewHeldReadings(this.#applied));
  }

  /** Tell each grid and each bar below the View what the View holds now; a bar whose set changed may report again. */
  #syncSuperseded(report: boolean): void {
    this.#syncColumns();
    this.#binding.supersede(this.#context.scope(VIEW), report);
  }



  /* ── What a scope MAY hold ─────────────────────────────────────────────
   * Will, 2026-09-25: "Any component field can be applied to the view scope
   * as a filter. Only component fields can be added to that component's scoped
   * filters." And: "A filter can't exist in both the view and component scope
   * so adding to one removes it from the other. However, the same filter can
   * exist across multiple component scopes."
   * TRAP T-up-is-open-down-is-closed */






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
      sort: this.#arrangement().sort,
      group: this.#arrangement().group,
      search: this.#arrangement().search,
      filter: this.#filter,
      // The readings and holds the filter is compiled from. TRAP T-one-query-one-owner
      query: structuredClone(this.#applied),
      // …and what the reader is editing, where it differs. TRAP T-apply-and-discard-wait-for-a-change
      ...(this.#remote ? { draft: structuredClone(this.#draft), dirty: this.#context.dirty() } : {}),
      selections: Object.fromEntries(this.selectedFields.map((f) => [f, this.selection(f)])),
      // …and what narrows ONE component alone, by bind id.
      only: this.#only,
      scopes: Object.fromEntries(this.#context.scopes.map((id) => [id, this.#context.scope(id)])),
      offers: Object.fromEntries(this.#offers),
      fields: Object.fromEntries(this.#catalogue.declared()),
      // Which field a Date filter narrows — or `null`, which explains one
      // that narrows nothing. TRAP T-a-record-has-a-time-of-its-own
      time: this.store.time ?? null,
      bound: this.#binding.debug(),
      loaded: this.#loaded,
      // How it answers, and whether its store can be reached. TRAP T-a-read-is-planned
      plan: this.#plan,
      reach: this.reach,
      // The picks the filters before them rule out, by scope. TRAP T-one-walk-counts-and-limits-in-order
      aside: Object.fromEntries(this.#setAside),
      ...(this.#cache ? { held: { rows: this.#cache.set?.size ?? null, gen: this.#cache.gen, due: this.#cache.due, failure: this.#cache.failure } } : {}),
    };
  }

  /** Compile the Query under every named part, and load. The ONE place the
   *  filter is made. TRAP T-one-query-one-owner */
  #recompose(): void {
    // An answer that came into force in a scope switched off is switched off too.
    const off = keepOff(this.#draft);
    if (this.#applied !== this.#draft) keepOff(this.#applied);
    this.#freezeReadings();
    if (off.length) this.#binding.drawScopesSoon();
    /* A DRAFT edit on a remote source changes nothing applied: no load, and
       the page stays where it is. It only changes what is pending. */
    const { still, same } = this.#compileNow();
    this.#syncPending();
    if (!same) this.#requery(this.applyOn === 'input');
    /* The rows did not move, so no load will count again — yet an answer that
       is OFF, or one chart's own, changed, and its badge wears a number.
       TRAP T-a-chip-counts-within-the-filters-before-it */
    if (still && this.#loaded) this.#walkSoon();
  }

  /** Every reading the Query keeps, in both copies, frozen: what a control is
   *  handed cannot change it. TRAP T-a-reading-is-frozen-in-the-query */
  #freezeReadings(): void {
    for (const query of new Set([this.#draft, this.#applied])) {
      for (const scope of Object.values(query.scopes)) for (const r of Object.values(scope.readings)) freezeReading(r);
    }
  }

  /** Compile the applied Query. Says whether the SHARED filter
   *  stood still, and — remote — whether nothing a load reads moved. */
  #compileNow(): { still: boolean; same: boolean } {
    const { filter, view, scoped, only } = compile(this.#applied, this.#compileFacts());
    const next = filter;
    const viewed = view;
    // The SHARED filter stood still: no load follows, whatever one component's own did.
    const still = JSON.stringify(next) === JSON.stringify(this.#filter);
    const same = this.#remote && still && JSON.stringify(only) === JSON.stringify(this.#only);
    this.#only = only;
    this.#filter = next;
    this.#viewFilter = viewed;
    this.#scoped = scoped;
    return { still, same };
  }

  /** What compiling needs: each field's facts, the saved filters, the
   *  component scopes, and the picks the filters before them rule out. */
  #compileFacts(): CompileFacts {
    return {
      field: (f) => this.#catalogue.facts(f),
      components: this.#binding.componentScopes(),
      fixed: new Set(this.#defaults.keys()),
      drop: (scope, field) => this.#setAside.get(scope)?.[field],
    };
  }

  /* ── Draft and applied — a REMOTE source only ─────────────────────────
   * TRAP T-apply-and-discard-wait-for-a-change */

  /** Do this source's loads reach outside the data layer? */
  get remote(): boolean {
    return this.#remote;
  }

  /** When a filter applies: once per act, or LIVE while its value moves — never
   *  live for a remote source. Fixed by the options; `bindSource` writes it on
   *  each control once. Will, TODO 107 */
  get applyOn(): 'change' | 'input' {
    return this.#remote ? 'change' : this.#applyOn;
  }
  /** When a filter applies, as the app asked. */
  #applyOn: 'change' | 'input' = 'change';
  /** A live filter's wait after the last move, in ms. */
  #debounce = 300;

  /** The same, for this class's own branches. */
  get #remote(): boolean {
    return !!this.store.remote;
  }

  /** What its context did: today's follow-ups, in today's order. 366 steps 14-15 */
  #hear(change: QueryChange): void {
    switch (change.kind) {
      case 'offer':
        this.dispatchEvent(new CustomEvent('scope-change', { detail: { scope: change.scope } }));
        // What its menus may add moved: the walk tallies it.
        if (this.#loaded) this.#walkSoon();
        return;
      case 'part':
      case 'sets':
        this.#age++;
        // A legend declared after the last load is told what the View leaves it; a
        // set's order is the order every chip counts in.
        if (this.#loaded) this.#walkSoon();
        // Sent up, the View holds its field — and draws only a field it knows.
        if (change.kind === 'part' && change.field && !this.#catalogue.has(change.field)) this.declareField(change.field);
        this.#binding.drawScopesSoon();
        return;
      case 'write':
        this.#recompose();
        // The shared filter did not move, so no load will push it: push it here.
        this.#binding.pushTo(change.narrows);
        this.dispatchEvent(new CustomEvent('selection-change', { detail: { field: change.field, scope: change.scope } }));
        // A panel shows a part too, and is told as a bar is. TRAP T-one-query-one-owner
        if (this.#narrowing.has(change.scope)) {
          const drawn = structuredClone(this.#draft.scopes[change.scope]?.readings[change.field] ?? { picked: [] });
          this.#binding.drawPanelReading(change.field, drawn, change.scope);
        }
        return;
      case 'select':
        this.#recompose();
        // AFTER the requery, so a listener sees the state the rows were fetched for.
        this.dispatchEvent(new CustomEvent('selection-change', { detail: { field: change.field } }));
        this.#draw(change.field);
        return;
      case 'hold':
        if (change.moved.length) this.#recompose();
        this.dispatchEvent(new CustomEvent('scope-change', { detail: { scope: change.scope } }));
        for (const field of change.moved) this.#draw(field);
        if (change.scope === VIEW) this.#syncSuperseded(true);
        this.#binding.drawScopesSoon();
        return;
      case 'move':
        if (change.moved) this.#recompose();
        // ONE event, naming every scope that changed — a listener never sees the
        // field in neither place, or in both.
        this.dispatchEvent(new CustomEvent('scope-change', { detail: { scopes: change.scopes } }));
        return;
      case 'recompose':
        this.#recompose();
        return;
      case 'commit':
        this.#recompose();
        // The headings show what is APPLIED.
        this.#syncColumns();
        return;
      case 'drawn':
        for (const field of change.fields) {
          this.dispatchEvent(new CustomEvent('selection-change', { detail: { field } }));
          this.#draw(field);
        }
        if (change.bars) this.#binding.drawBars(change.bars);
        if (change.pending) this.#syncPending();
        return;
      case 'bars':
        this.#binding.drawBars(change.scope);
        return;
    }
  }

  /** A definition as a whole Query: definitionOf, over this source. */
  #definition(given: Query | QueryDefaults, keep: boolean, base: Query = this.#draft, copy = true): Query {
    return definitionOf(given, keep, base, {
      defaults: this.#defaults,
      readingsOf: (where) => this.readingsOf(where),
      carriesOver: (f) => this.#catalogue.carriesOver(f),
    }, copy);
  }





  /** Tell each bound control over a scope its PENDING fields and whether its scope is DIRTY. */
  #syncPending(): void {
    this.#binding.syncPending((scopes) => (this.#remote
      ? [...new Set(scopes.flatMap((id) => Object.keys({
        ...this.#applied.scopes[id]?.readings, ...this.#draft.scopes[id]?.readings,
      })))].filter((f) => this.#context.pending(f))
      : []), (id) => this.#context.dirty(id));
  }

  setSearch(term: string, scope?: string): void {
    this.#arrange({ search: term }, scope);
    this.#requery();
  }

  /** The SEARCH as needles, so a view marks what it found: a `contains` on each
   *  field it searches, or on every field (`*`). TRAP T-a-find-asks-its-host-to-step */
  #searchNeedles(): string {
    const term = this.#arrangement().search.trim().replace(/\n/g, ' ');
    if (!term) return '';
    return (this.#searchFields?.length ? this.#searchFields : ['*']).map((f) => `${f}:contains:${term}`).join('\n');
  }

  setPage(page: number): void {
    // Clamped against the CURRENT total, so a pager cannot walk past the end.
    this.#state.page = Math.min(Math.max(1, Math.trunc(page) || 1), this.totalPages);
    /* GROUPED: publish, never load. Grouped loads send no skip/take, so every
       page shares one state key and the no-op guard would eat the publish.
       TRAP T-grouped-page-change-publishes-without-loading */
    if (this.#arrangement().group) {
      this.#binding.publish();
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
  #requery(live = false): void {
    this.#state.page = 1;
    if (live) this.#settle();
    else this.#schedule();
  }

  /** LIVE: load once the moves stop — `debounce` ms after the last. The app
   *  chose the wait, per source. Will, TODO 107. TRAP T-coalesce-microtask-not-debounce */
  #settle(): void {
    clearTimeout(this.#liveWait);
    this.#liveWait = setTimeout(() => this.#schedule(), this.#debounce);
  }
  /** The live load waiting for the moves to stop. */
  #liveWait: ReturnType<typeof setTimeout> | undefined;

  /** COALESCE one tick's writes into a single load. TRAP T-coalesce-microtask-not-debounce */
  #schedule = coalesce((): void => void this.load());

  /* ── Loading ───────────────────────────────────────────────────────── */

  /** The ViewState as one comparable string. Key order is stable by construction.
   *  A bind over the unpaged rows reads the View's filter and each scope's own,
   *  so a move between them — the shared filter the same — loads again. 366 step 7 */
  #stateKey(): string {
    const unpaged = this.#binding.wantsAllRows() ? [this.#viewFilter ?? null, this.#scoped] : null;
    return JSON.stringify(unpaged ? [this.#loadOptions(), unpaged] : this.#loadOptions());
  }

  /** Build the load options the store is asked with. */
  #loadOptions(): LoadOptions {
    const { page, pageSize } = this.#state;
    const { sort, group, search } = this.#arrangement();
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
  load(options: { force?: boolean } = {}): Promise<LoadResult> {
    // Skip a load that would ask the same question twice. `force` is how a load
    // that MUST happen says so.
    // TRAP T-no-op-load-guard
    // TRAP T-in-flight-ticket-discards-stale — ANSWERED and ASKED are separate.
    // FORCED: the rows may have changed, so a held set is read again.
    if (options.force) {
      this.#age++;
      this.#rowsAge++;
      this.#letGo();
    }
    const key = this.#stateKey();
    if (!options.force) {
      /* ANSWERED only while nothing else is in flight. A DIFFERENT load in
         flight will land and overwrite the answer, so a request back to the
         last finished one must still run — skipping it lost the reader's
         filter for good. TRAP T-in-flight-ticket-discards-stale */
      if (key === this.#lastLoadKey && this.#loaded && !this.#inFlight.busy) return Promise.resolve(this.#result);
      /* ASKED: the caller waits for THAT answer. Handed the result of the load
         BEFORE it, `await source.load()` came back with no rows while the
         first load was still out. TRAP T-an-asked-load-is-awaited */
      if ((key === this.#inFlightKey || key === this.#inFlightAsked) && this.#asking) return this.#asking;
    }
    return this.#reask(key);
  }

  /** The rows changed under an identical ViewState: asked again. A held set has
   *  taken the change already — or is due, and read once for every page.
   *  TRAP T-a-held-set-takes-a-change-in-place · TRAP T-a-store-has-one-cache */
  #onStoreChange = (event: Event): void => {
    this.#rowsAge++;
    this.#allAge++;
    const history = this.store.history;
    const since = this.#heard;
    this.#heard = history?.seq ?? 0;
    // Not in a History it can trust: any field may have moved.
    if (!history || !this.#trusts(event, since)) {
      this.#age++;
      void (this.#cache ? this.#reask() : this.load({ force: true }));
      return;
    }
    // The walk runs again only when a field it reads, or the rows, moved. TRAP T-a-change-redoes-only-what-reads-it
    const moved = (reads: readonly string[]): boolean => history.changedSince(since, reads);
    const w = this.#walk;
    if ((w && (this.#unwalked.has(w.walk) || moved(w.reads))) || (this.#walking && moved(this.#walking.reads))) this.#walkAge++;
    void this.#reask();
  };

  /** Is this change in the store's History, from a store that hears every writer —
   *  and, held, taken into a set it can vouch for? TRAP T-a-change-redoes-only-what-reads-it */
  #trusts(event: Event, since: number): boolean {
    const history = this.store.history;
    if (!history || history.seq <= since || !this.store.announcesAll) return false;
    if (!this.#cache) return true;
    const said = (event as CustomEvent<CacheChangeDetail | undefined>).detail;
    return !!said?.taken && this.#planNow().plan !== 'held-stale';
  }
  /** The store's History as this source last heard it. */
  #heard = 0;
  /** Moves when a store change moved a field the walk reads, or the rows. */
  #walkAge = 0;
  /** Moves on every store change: the unpaged rows are read again. */
  #allAge = 0;

  /** A whole set landed — another page's read too: what is counted moved, and an
   *  idle page asks again. A page the set is too big for asks the store, which moved nothing. */
  #onSet = (): void => {
    const set = this.#cache?.set;
    // A set too big for this page — or none, where this page never used one — moves nothing here.
    if (set ? set.size > this.#holdRows : this.#plan !== 'held' && this.#plan !== 'held-stale') return;
    this.#age++;
    this.#rowsAge++;
    // An ask in flight may have read the set before it landed: it is overtaken.
    if (this.#loaded || this.#inFlight.busy) void this.#reask();
  };

  /**
   * Can its store be reached? `ok`; `unreached` — the store could not be reached,
   * and the last rows it gave are shown, unconfirmed; `down` — it could not be
   * reached, and there is nothing to show. A refusal (401) is not this: the
   * store was reached. TRAP T-a-failed-read-keeps-the-last-set
   */
  get reach(): 'ok' | 'unreached' | 'down' {
    if (this.#down) return 'down';
    const failure = this.#closed ? null : this.#cache?.failure;
    return failure && unreached(failure) && this.#plan === 'held-stale' ? 'unreached' : 'ok';
  }

  /** Why the store could not be reached, while it cannot — its kind and message — else null. */
  get failure(): Failure | null {
    return this.#down ?? (this.reach === 'unreached' ? this.#cache?.failure ?? null : null);
  }

  /** Try the store again: `down`, a fresh read; `unreached`, a read behind the rows
   *  shown, with no loading; `ok`, nothing. A page's retry, its tab shown, `online`. */
  recheck(): void {
    const reach = this.reach;
    if (reach === 'down') void this.load({ force: true });
    // The rows stay, and say they are unconfirmed, until the read lands.
    else if (reach === 'unreached') this.#cache?.recheck(this.#holdRows);
  }

  /** Closed: it no longer hears its store, and holds nothing. */
  #closed = false;

  /**
   * Let the store go: a change no longer reloads it. It can still be asked —
   * the store itself, never the shared set. The store's held set STAYS, for the
   * next page over it. A page's source is closed when the page goes, or every
   * visit leaves one more listening. TRAP T-a-closed-source-hears-nothing
   */
  close(): void {
    this.#closed = true;
    this.#member.leave();
    (this.#cache ?? this.store).removeEventListener('change', this.#onStoreChange);
    this.#cache?.removeEventListener('set', this.#onSet);
    clearTimeout(this.#liveWait);
  }

  /** Ask the store — or the held set — this question, even one asked before. */
  #reask(key = this.#stateKey()): Promise<LoadResult> {
    const asking = this.#ask(key);
    this.#asking = asking;
    return asking;
  }

  /** What every read asks, as the plan says: the store's held set — current, or
   *  shown while it is checked — else the store. A closed source asks the store. */
  get #reads(): Pick<Store, 'load' | 'totalCount' | 'distinct' | 'scan'> {
    const set = this.#closed ? null : this.#cache?.set;
    return set && (this.#plan === 'held' || this.#plan === 'held-stale') ? set : this.store;
  }

  /** The plan for the next question, as the store's set stands now. */
  #planNow(): { plan: Plan; behind: boolean } {
    const cache = this.#closed ? null : this.#cache;
    if (!cache) return { plan: 'store', behind: false };
    const set = cache.set;
    return planRead({
      need: { cap: this.#holdRows },
      held: { set: set ? { size: set.size, gen: cache.gen, due: cache.due } : null, never: cache.never, over: cache.over, failedAt: cache.failedAt },
      history: { announcesAll: !!this.store.announcesAll, since: this.#since },
      reach: { tried: this.#tried },
    });
  }

  /** Hold the store's whole set, where it can be: one read for every page over
   *  it. TRAP T-a-remote-source-holds-its-whole-set · TRAP T-a-store-has-one-cache */
  async #hold(): Promise<void> {
    const cache = this.#closed ? null : this.#cache;
    if (!cache) {
      this.#plan = 'store';
      return;
    }
    /* A new page tries a failed whole read once more, as each page did before
       the set was the store's — behind the set, where one is held, so the page
       is never held up for it. */
    if (!this.#checked) {
      this.#checked = true;
      if (cache.failed && !cache.set) cache.retry();
    }
    for (;;) {
      const { plan, behind } = this.#planNow();
      this.#plan = plan;
      /* A set it cannot vouch for answers at once, and is read again BEHIND it —
         once a page, at open or a first load: never on a toggle (340). */
      if (behind) {
        this.#tried = true;
        cache.recheck(this.#holdRows);
      }
      if (plan !== 'fetch') return;
      const before = `${cache.gen}:${cache.over}:${cache.failedAt}:${cache.never}:${cache.due}`;
      const held = cache.set;
      await cache.hold(this.#holdRows);
      // A read that just failed WAS this page's check: no second one at once.
      if (cache.failed) this.#tried = true;
      // Nothing moved — no read could be sent, and no kept copy landed: the store answers.
      if (`${cache.gen}:${cache.over}:${cache.failedAt}:${cache.never}:${cache.due}` === before && cache.set === held) {
        this.#plan = 'store';
        return;
      }
    }
  }

  /** A Refresh: the store's set is read again before it is used — never by a closed source. */
  #letGo(): void {
    if (!this.#closed) this.#cache?.letGo();
  }

  /** The load in flight, for a caller that asks the same question again. */
  #asking: Promise<LoadResult> | null = null;

  /** Ask the store, and publish the answer if it is still the latest asked. */
  async #ask(asked: string): Promise<LoadResult> {
    let key = asked;
    const ticket = this.#inFlight.next();
    this.#inFlightKey = key;
    this.#inFlightAsked = key;
    this.dispatchEvent(new CustomEvent('loading', { detail: { loading: true } }));

    try {
      await this.#hold();
      // Overtaken while it waited: the newer ask answers, and this one asks no one.
      if (!this.#inFlight.is(ticket)) return await (this.#asking ?? Promise.resolve(this.#result));
      /* What the filters before each pick rule out is set aside BEFORE the load,
         where the walk asks no store: ONE load, right first time.
         TRAP T-one-walk-counts-and-limits-in-order */
      if (this.#walkIsCheap()) {
        const walked = this.#walkKey();
        const walk = await this.#walked();
        if (!this.#inFlight.is(ticket)) return await (this.#asking ?? Promise.resolve(this.#result));
        // A walk something else moved past sets nothing aside: the walk after the load decides.
        if (this.#walkKey() === walked && this.#takeAside(walk)) this.#compileNow();
        // Whoever set them aside — this ask, or a walk beside it — the load asks what stands now.
        key = this.#stateKey();
        this.#inFlightKey = key;
      }
      const result = await this.#reads.load(this.#loadOptions());
      // Not the latest → DISCARDED, and the key recorded only by the winner.
      if (!this.#inFlight.is(ticket)) return this.#result;
      this.#result = result;
      this.#lastLoadKey = key;
      this.#loaded = true;

      /* A SUMMARY sees every matching row. When nothing was windowed the page
         IS everything, so the second ask is skipped.
         TRAP T-a-summary-binds-to-all-the-rows */
      /* …under the VIEW alone: a component scope narrows its own components,
         never a summary beside them. TRAP T-only-the-view-trickles-down */
      const windowed = this.#state.pageSize != null && !this.#arrangement().group;
      const viewed = this.#viewFilter;
      const split = JSON.stringify(viewed) !== JSON.stringify(this.#filter);
      if (!this.#binding.wantsAllRows() || (!windowed && !split)) {
        this.#allRows = this.#binding.wantsAllRows() ? result.rows : [];
        this.#allFor = '';
      } else {
        const { skip: _skip, take: _take, filter: _filter, ...rest } = this.#loadOptions();
        const asked = viewed ? { ...rest, filter: viewed } : rest;
        // The same question over the same rows — a page turned — is not asked again.
        const allKey = JSON.stringify([this.#age, this.#allAge, asked]);
        if (allKey !== this.#allFor) {
          const all = await this.#reads.load(asked);
          if (!this.#inFlight.is(ticket)) return this.#result;
          this.#allRows = all.rows;
          this.#allFor = allKey;
        }
      }

      // Re-clamp and reload ONCE, FORCED. Never while GROUPED: the page count
      // there is the GRID's to report, and the re-load would ask the same thing.
      // TRAP T-error-is-a-state-not-a-throw
      // TRAP T-grouped-paging-belongs-to-the-view
      const pages = this.totalPages;
      if (!this.#arrangement().group && this.#state.pageSize && this.#state.page > pages) {
        this.#state.page = pages;
        return this.#reask();
      }

      this.#binding.publish();
      // Empty, or no matches: the data layer says which. TRAP T-a-container-shows-its-datas-state
      const emptiness = result.total > 0 ? undefined : this.#filter || this.#arrangement().search ? 'no-matches' : 'empty';
      // Unconfirmed, as the set stands NOW: a check that landed meanwhile confirmed it.
      const stale = this.#plan === 'held-stale' && this.#planNow().plan === 'held-stale';
      this.#down = null;
      this.dispatchEvent(
        new CustomEvent<DataChangeDetail>('change', {
          detail: { ...result, state: this.state, ...(emptiness ? { emptiness } : {}), ...(stale ? { stale: true as const } : {}) },
        }),
      );
      void this.#rewalk();
      return result;
    } catch (error) {
      // TRAP T-error-is-a-state-not-a-throw — a stale failure raises nothing.
      if (!this.#inFlight.is(ticket)) return this.#result;
      // …and says what KIND it was. TRAP T-a-failure-has-a-kind
      const failure = failureOf(error);
      this.#down = unreached(failure) ? failure : null;
      this.dispatchEvent(new CustomEvent('error', { detail: { error, failure } }));
      return this.#result;
    } finally {
      if (this.#inFlight.end(ticket)) {
        this.#inFlightKey = null;
        this.#inFlightAsked = null;
        this.#asking = null;
        this.dispatchEvent(new CustomEvent('loading', { detail: { loading: false } }));
      }
    }
  }

  /**
   * Each answered chip's RESULTS in a scope: the rows that reach it — its
   * scopes, and the filters BEFORE it in the one order — and match its answer.
   * By field, or saved-filter id; from the APPLIED Query, so a draft has none.
   * OFF, it still says what it would match (123); a SAVED filter only while ON
   * (166). Will, TODOs 60 and 348.
   * TRAP T-a-chip-counts-within-the-filters-before-it
   */
  async results(scope: string): Promise<Record<string, number>> {
    return { ...(await this.#walked()).results[scope] };
  }

  /**
   * Each PICKED value's own results in a scope: the rows that reach its field
   * and match that ONE value — by field, then by value. Only a plain pick in
   * force has values to count: rows, a range, a field that is off or held above
   * have none. Will, TODO 172.
   * TRAP T-a-chip-counts-within-the-filters-before-it
   */
  async valueResults(scope: string): Promise<Record<string, Record<string, number>>> {
    return Object.fromEntries(Object.entries((await this.#walked()).values[scope] ?? {}).map(([f, byValue]) => [f, { ...byValue }]));
  }

  /* ── The WALK: one ordered pass per scope gives every count. TODOs 347–349 ──
   * TRAP T-one-walk-counts-and-limits-in-order */

  /** What a walk reads besides the rows: the Query, the setting, the parts, the
   *  bound scopes, what each scope offers, and the picks set aside. */
  #walkKey(): string {
    const components = [...this.#binding.componentScopes()].sort();
    const parts = [...this.#narrowing].map(([s, p]) => [s, p.field, this.#hostOf(p.only)]);
    return JSON.stringify([this.#age, this.#walkAge, this.#limitOptions, withoutArrangement(this.#applied),
      components, [...this.#defaults.keys()].sort(), parts,
      [...this.#offers]]);
  }

  /** The component scope a chart part's element is bound into, if any. */
  #hostOf(el: BoundControl): string | undefined {
    const scope = this.#member.bindOf(el)?.scope;
    return typeof scope === 'string' && scope !== VIEW ? scope : undefined;
  }

  /** The walk's plan, from the applied Query. */
  #planWalk(): WalkPlan {
    const narrowing = new Map([...this.#narrowing].map(([s, p]) => {
      const host = this.#hostOf(p.only);
      return [s, { field: p.field, ...(host ? { host } : {}) }] as const;
    }));
    return planWalk(this.#applied, {
      field: (f) => this.#catalogue.facts(f),
      isList: (f) => this.#catalogue.isList(f),
      plainPicks: (f, reading) => {
        const state = this.#catalogue.stateFor(f, reading);
        return state.mode === 'simple' && !state.range && state.op === DEFAULT_OP;
      },
      sets: (scope) => this.#sets.get(scope) ?? [],
      fields: (scope) => this.#context.fields(scope),
      components: this.#binding.componentScopes(),
      fixed: new Set(this.#defaults.keys()),
      narrowing,
      limit: this.#limitOptions,
      now: new Date(),
    });
  }

  /** The rows a walk reads, as the plan says: the held set, in place; a local
   *  store's scan, or one load per change; null — ask the store step by step. */
  async #walkRows(): Promise<readonly Row[] | null> {
    await this.#hold();
    const reads = this.#reads;
    // A remote store not held is asked; a held set is walked in place.
    if (this.#remote && reads === this.store) return null;
    if (reads.scan) return reads.scan();
    if (this.#rowsCache?.age === this.#rowsAge) return this.#rowsCache.rows;
    const age = this.#rowsAge;
    const { rows } = await reads.load({});
    // Kept until the rows change — not a set too big to keep.
    if (age === this.#rowsAge && rows.length <= this.#holdRows) this.#rowsCache = { age, rows };
    return rows;
  }

  /** The walk for the Query as it stands: one per key, shared by every reader of
   *  it. A walk that fails keeps the last one — it never stops a load. */
  async #walked(): Promise<Walk> {
    // A closed source walks nothing: the page is gone.
    if (this.#closed) return this.#walk?.walk ?? emptyWalk();
    const key = this.#walkKey();
    if (this.#walk?.key === key) return this.#walk.walk;
    if (this.#walking?.key === key) return this.#walking.walk;
    const plan = this.#planWalk();
    // Nothing to count or tally: no row is read.
    if (!plan.scopes.some((sc) => sc.taps.length || sc.steps.some((st) => st.counts || st.each?.length || st.ruler || st.offers))) {
      this.#walk = { key, walk: emptyWalk(), reads: [] };
      return this.#walk.walk;
    }
    const reads = [...new Set(Object.values(walkReads(plan)).flatMap((r) => [...r.tested, ...r.tallied]))];
    const entry: { key: string; walk: Promise<Walk>; reads: string[] } = { key, walk: Promise.resolve(emptyWalk()), reads };
    entry.walk = (async (): Promise<Walk> => {
      try {
        const rows = await this.#walkRows();
        const out = rows ? walkInOrder(rows, plan) : await walkStepwise(this.#reads, plan);
        if (this.#walkKey() === key) this.#walk = { key, walk: out, reads };
        return out;
      } catch {
        /* The last walk stays drawn, and nothing is set aside from it; kept for
           this key, so a draw does not ask again until something moves. It never stops a load. */
        const kept = { ...(this.#walk?.walk ?? emptyWalk()) };
        this.#unwalked.add(kept);
        if (this.#walkKey() === key) this.#walk = { key, walk: kept, reads };
        return kept;
      } finally {
        if (this.#walking === entry) this.#walking = null;
      }
    })();
    this.#walking = entry;
    return entry.walk;
  }
  /** The last walk, what it was for, and the fields it read. */
  #walk: { key: string; walk: Walk; reads: readonly string[] } | null = null;
  /** A walk that failed, standing in for the last one. */
  #unwalked = new WeakSet<Walk>();
  /** The walk in flight, what it is for, and the fields it reads. */
  #walking: { key: string; walk: Promise<Walk>; reads: readonly string[] } | null = null;
  /** Moves each time the rows may have changed. */
  #rowsAge = 0;
  /** A store with no scan, loaded once per change. */
  #rowsCache: { age: number; rows: readonly Row[] } | null = null;

  /** Can the walk run without asking the store — a held set, a store that
   *  scans, or rows kept since the last change? Then it runs before the load. */
  #walkIsCheap(): boolean {
    const reads = this.#reads;
    if (this.#remote && reads === this.store) return false;
    return !!reads.scan || this.#rowsCache?.age === this.#rowsAge;
  }

  /** Take the walk's set-aside picks. Says whether they moved. */
  #takeAside(walk: Walk): boolean {
    // A walk that failed sets nothing aside: what an older Query set aside goes too.
    const next = this.#unwalked.has(walk) ? new Map<string, Record<string, string[]>>()
      : new Map(Object.entries(walk.aside).filter(([, fields]) => Object.keys(fields).length));
    const key = (m: Map<string, Record<string, string[]>>): string => JSON.stringify([...m].sort());
    if (key(next) === key(this.#setAside)) return false;
    this.#setAside = next;
    return true;
  }

  /** Walk, and set aside what it rules out — compiling again, and asking again
   *  only when that moved what a load reads — then draw what it gives. */
  async #rewalk(): Promise<void> {
    const key = this.#walkKey();
    const walk = await this.#walked();
    // The Query moved while it walked: the walk for what stands now decides.
    if (this.#walkKey() !== key) {
      this.#walkSoon();
      return;
    }
    if (this.#takeAside(walk)) {
      const { still, same } = this.#compileNow();
      this.#syncPending();
      if (!same && !(still && !this.#remote)) {
        this.#requery(this.applyOn === 'input');
        return;
      }
    }
    void this.#drawWalk();
  }

  /** One walk this tick, however many asked. */
  #walkSoon = coalesce((): void => {
    void this.#rewalk();
  });

  /** The picks set aside, by scope then field, as value keys. */
  #setAside = new Map<string, Record<string, string[]>>();

  /** Each bound control is drawn what the walk gives its scopes — each chip's
   *  results, each value's, what each list field's ruler leaves, what each
   *  serial field offers — once per walk and set of controls; a later walk
   *  wins. A chart part's goes out as `present`, for its legend (179).
   *  TRAP T-one-walk-counts-and-limits-in-order */
  async #drawWalk(): Promise<void> {
    // A control over several scopes — the panel — draws each chart's own too.
    const drawn = [...this.#binding.entries()].flatMap(([el, b]) => (
      (el.drawResults || el.drawValueResults || el.drawPresent || el.drawOffered) && b.scope
        ? [{ el, scopes: typeof b.scope === 'string' ? [b.scope] : [...b.scope, ...this.#narrowing.keys()] }] : []));
    const parts = [...this.#narrowing.keys()];
    if (!drawn.length && !parts.length) return;
    // Drawn already, for this walk and these controls: a sort, a page or a search moves nothing.
    const key = JSON.stringify([this.#walkKey(), drawn.map(({ el, scopes }) => [this.#binding.get(el)?.id, scopes]), parts]);
    if (key === this.#drawnFor) return;
    this.#drawnFor = key;
    const ticket = this.#drawing.next();
    const walk = await this.#walked();
    if (!this.#drawing.is(ticket)) return;
    // Drawn from a walk that failed: the next draw draws again.
    if (this.#unwalked.has(walk)) this.#drawnFor = '';
    const lists = (of: Record<string, string[]> | undefined): Record<string, string[]> =>
      Object.fromEntries(Object.entries(of ?? {}).map(([f, keys]) => [f, [...keys]]));
    for (const { el, scopes } of drawn) {
      for (const scope of scopes) {
        el.drawResults?.({ ...walk.results[scope] }, scope);
        // A control that draws a chip per VALUE is told each picked value's own too.
        el.drawValueResults?.(Object.fromEntries(Object.entries(walk.values[scope] ?? {}).map(([f, v]) => [f, { ...v }])), scope);
        el.drawPresent?.(lists(walk.present[scope]), scope);
        el.drawOffered?.(lists(walk.offered[scope]), scope);
      }
    }
    const byScope = Object.fromEntries([...new Set([...drawn.flatMap((d) => d.scopes), ...parts])]
      .map((scope) => [scope, lists(walk.present[scope])]));
    this.dispatchEvent(new CustomEvent('present', { detail: { byScope } }));
  }
  /** The latest draw; an older one lands on nothing. */
  #drawing = new Latest();
  /** What the controls were last drawn for: the walk and the controls. */
  #drawnFor = '';

  /* ── What the filters BEFORE a field leave — Will, TODOs 174 and 349 ────
   * TRAP T-a-ruled-out-value-is-greyed */

  /** Does each list field offer only the values the filters before it leave? Settable at any time, unlike `applyOn`. */
  get limitOptions(): boolean {
    return this.#limitOptions;
  }
  set limitOptions(on: boolean) {
    if (on === this.#limitOptions) return;
    this.#limitOptions = on;
    this.#walkSoon();
  }
  /** The setting: does each list field offer only what the others leave? */
  #limitOptions = false;

  /**
   * Each list field's values its RULER leaves in a scope, as value keys: with
   * Limit, the rows at its place — its scopes and the filters BEFORE it; without,
   * a component scope's the View's subset (347), and the View's nothing. A field
   * no chip holds is tallied where it would stand (349).
   * TRAP T-a-ruled-out-value-is-greyed
   */
  async present(scope: string): Promise<Record<string, string[]>> {
    return Object.fromEntries(Object.entries((await this.#walked()).present[scope] ?? {}).map(([f, keys]) => [f, [...keys]]));
  }

  /**
   * What each field below the top of a SERIAL set OFFERS: the values the rows
   * hold at its place, once anything before it narrows, as value keys. A control
   * REMOVES the rest — but a pick it holds stays, set aside. Whatever
   * `limitOptions` says. TRAP T-a-filter-set-groups-or-chains
   */
  async offered(scope: string): Promise<Record<string, string[]>> {
    return Object.fromEntries(Object.entries((await this.#walked()).offered[scope] ?? {}).map(([f, keys]) => [f, [...keys]]));
  }

  /** Moves each time what a count reads may have changed beside the Query: the
   *  rows, a field's facts or values, a saved filter, a part, a set. */
  #age = 0;
  /** What the unpaged rows were last read for. */
  #allFor = '';

  /* ── Binding ───────────────────────────────────────────────────────── */

  /** Take a component its binder has wired, and send it what is already
   *  loaded. `bindSource()` is the way in. TODO 196 */
  attach(el: BoundControl, facts: AttachFacts, sink: BindSink): void {
    const had = this.#binding.componentScopes();
    const scope = typeof facts.scope === 'string' ? facts.scope : undefined;
    const arranged = scope ? this.#context.arranges(scope) : false;
    this.#binding.add(el, facts, sink);
    this.#rescope(had);
    // A grid joined, so its scope arranges now: its bars and panel draw Group and Sort. TODO 99
    if (scope && !arranged && this.#context.arranges(scope)) {
      this.#binding.drawBars(scope);
      this.#binding.drawScopesSoon();
    }

    // Whatever is already loaded, so a component bound late is not blank.
    this.#binding.push(el);
    if (Array.isArray(facts.scope) && el.drawScopes) this.#binding.drawScopesSoon();
    if (typeof facts.scope === 'string' && el.supersedeColumns) this.#syncColumns();
    // …and what the filters before each field leave. TRAP T-a-ruled-out-value-is-greyed
    // …and its chips' counts. TRAP T-a-chip-counts-within-the-filters-before-it
    if (facts.scope && (el.drawResults || el.drawValueResults || el.drawPresent || el.drawOffered) && this.#loaded) this.#walkSoon();
    /* A summary bound AFTER the first load would otherwise draw blank: the
       unpaged set is fetched by `load`, and nothing would ask for it again.
       TRAP T-a-summary-binds-to-all-the-rows */
    const needsAll = facts.rows === 'all' && !this.#allRows.length;
    // Asked again, not fetched again: the rows did not change, so a held set stays.
    if (this.#autoLoad && needsAll) void this.#reask();
    else if (this.#autoLoad && !this.#result.rows.length) void this.load();
  }

  /** Every row a bound component is under, UNPAGED — what "Select all rows"
   *  ticks on a grid that holds one page. TODO 238 · TRAP T-select-all-is-the-visible-rows */
  async allRows(el?: BoundControl): Promise<readonly Row[]> {
    const { skip: _skip, take: _take, ...options } = this.#loadOptions();
    await this.#hold();
    const { rows } = await this.#reads.load(options);
    const entry = el ? this.#binding.get(el) : undefined;
    const own = entry ? this.#only[entry.id] : undefined;
    return own ? filterRows(rows, own) : rows;
  }

  /** Stop steering and stop populating this component. */
  unbind(el: BoundControl): void {
    const had = this.#binding.componentScopes();
    this.#binding.remove(el);
    this.#rescope(had);
  }

  /** A scope that gained or lost its last component changes who it reaches —
   *  recompiled only when it answers something. TRAP T-only-the-view-trickles-down */
  #rescope(had: ReadonlySet<string>): void {
    const now = this.#binding.componentScopes();
    const moved = [...new Set([...had, ...now])].filter((s) => had.has(s) !== now.has(s));
    if (moved.some((s) => s in this.#applied.scopes)) this.#recompose();
  }

  /** Every component currently bound. */
  get boundElements(): BoundControl[] {
    return this.#binding.elements;
  }

  /* ── What a control asks, by name — what the steering calls ─────────── */

  /** A scoped bar's whole answer: what it holds, and each field's reading. It
   *  is its Apply. TRAP T-a-bar-reports-its-holds · TRAP T-one-query-one-owner */
  answerScope(scope: string, answer: {
    holds?: readonly string[];
    readings: Record<string, FieldReading>;
    /** Its filter Switch is off — only from a bar that shows one. */
    suspended?: boolean;
    /** A Reset: what the Switch turned off is forgotten, not brought back. */
    reset?: boolean;
  }): void {
    const off = this.#draft.scopes[scope]?.suspended;
    if (answer.reset && off) this.#draft.scopes[scope]!.suspended = { fields: [] };
    if (answer.holds) this.#context.hold(scope, [...answer.holds]);
    this.answer(scope, answer.readings);
    // The answer first, then the Switch: OFF lists what that answer has in force.
    if (answer.suspended !== undefined) this.#context.suspendScope(scope, answer.suspended);
    // A bar's report IS its Apply: its menus waited for it, remote.
    this.#context.commit();
  }

  /** A HEADING's answer is its field's, in its grid's scope — and a field no
   *  scope holds yet gets its normal chip on that scope's bar.
   *  TRAP T-a-heading-asks-through-the-source */
  answerColumn(scope: string, field: string, reading: FieldReading | null): void {
    const fresh = !!reading && !this.#context.scopeOf(field) && this.#context.canHold(scope, field);
    if (fresh) this.#context.hold(scope, [...this.#context.scope(scope), field]);
    this.#context.select(field, reading?.picked ?? [], reading ?? {});
    // A heading's Apply is an Apply. TRAP T-apply-and-discard-wait-for-a-change
    this.#context.commit();
    if (fresh) this.#binding.drawBars(scope);
  }


  /** The grid's own page count, when every matching row is already in hand:
   *  the pager's numbers publish again, and nothing loads. */
  reportPages(pages: number): void {
    const next = Math.max(1, Math.trunc(pages));
    const clamped = Math.min(this.#state.page, next);
    if (next === this.#viewPages && clamped === this.#state.page) return;
    this.#viewPages = next;
    this.#state.page = clamped;
    this.#binding.publish();
  }

  /* ── Publishing ────────────────────────────────────────────────────── */

  /** The view state every bound component is pushed. */
  #boundView(): BoundView {
    const { page, pageSize } = this.#state;
    const { sort, group, sortSuspended } = this.#arrangement();
    const filter = this.#filter;
    const first = sort[0];

    /* The FIELD survives a suspend; the DIRECTION says whether it is applied.
       TRAP T-a-suspended-sort-is-one-owners-job */
    const shown = first ?? sortSuspended;
    return {
      sortField: shown?.field,
      sortDirection: first ? (first.direction ?? 'asc') : (sortSuspended ? '' : undefined),
      groupField: group ?? undefined,
      filterFields: filterFields(filter),
      /* …and WHAT it matched on, so a component can point at the hit, whichever
         control set the filter. TRAP T-a-needle-comes-from-either-direction */
      needles: [filterNeedles(filter), this.#searchNeedles()].filter(Boolean).join('\n'),
      paging: pageSize ? { page, totalPages: this.totalPages, pageSize } : undefined,
    };
  }
}
