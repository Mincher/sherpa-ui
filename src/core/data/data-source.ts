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
 * - .setState — Restore a whole view state — a saved view, a deep link, a reload.
 * - .loaded — Has any load completed?
 * - .result — The whole of the last load's answer.
 * - .rows — The last load's rows, LIVE — state, query and result are copies
 * - .total — Matching rows before paging.
 * - .totalPages — Pages at the current size, at least 1.
 * - .setSort — Order by one field, or stop.
 * - .resumeSort — Resume the suspended sort.
 * - .clearSort — Forget the sort entirely — the gesture that is NOT a suspend.
 * - .setGroup — group by a field, or stop; a grid draws it, the source owns it
 * - .setFilter — Replace the WHOLE filter, clearing every contribution.
 * - .contribute — Own ONE NAMED PART — the COMPONENT scope.
 * - .write — Write ONE scope's reading of ONE field — a component's own answer.
 * - .declarePart — Declare a PART: one field that narrows one component — a chart's legend field.
 * - .partFacts — What `declarePart` was told for this scope, or undefined.
 * - .declareDefault — A component's OWN default filter — readings that narrow `only` it — as its scope in the Query.
 * - .defaultFor — A component's own default, as `declareDefault` left it — not its answer now. A copy.
 * - .reading — One scope's reading of one field, or undefined.
 * - .contributions — Every named part currently applied — the component-scope filters.
 * - .contribution — One named part's filter, as `contribute` left it, or undefined.
 * - .apply — Apply a whole control's READING of several fields, at one scope.
 * - .answer — ONE SCOPE'S WHOLE ANSWER — a bar's report.
 * - .declarePreset — A saved filter's readings, by id — the library a preset that is ON compiles from.
 * - .preset — What `declarePreset` was told for this id — its label and readings — or undefined.
 * - .describe — One scope, whole: its filters and answers, what it may add, how it is arranged.
 * - .say — say(readings) — a saved filter in WORDS, field by field: the source knows each field's name, type and values.
 * - .answerScopes — The panel's answer: each field it changed, and each scope's presets.
 * - .release — A scope lets ONE go — a field or a preset.
 * - .declareValues — every value a field can take, so each control offers the same list
 * - .declareField — Declare a field's KIND and its reader-facing name.
 * - .declareFromRows — Each field here that its schema says nothing of takes it from the ROWS: a set, its unique values in order; a…
 * - .fieldFacts — What `declareField` was told.
 * - .whereOf — Readings in the plain form a definition or a View writes, by this source's field types.
 * - .readingsOf — The plain form as readings, by this source's field types.
 * - .filterDef — A field's filter, as every bar, panel and heading draws it.
 * - .declareScope — Name a scope as a reader sees it — a panel's section, an Add list's note — and say if it arranges.
 * - .scopeFacts — What `declareScope` was told — not the fallbacks `scopeLabel()` and `arranges()` answer with.
 * - .arranges — Does Group and Sort arrange this scope's rows?
 * - .declareSets — A scope's filter sets, in order.
 * - .sets — A scope's filter sets, as declared.
 * - .scopeLabel — A scope's name as a reader sees it, or its id.
 * - .addable — What a scope may still add, each noting where it lives now.
 * - .valuesFor — What `declareValues` was told, as the data holds it.
 * - .select — Select values for a FIELD — the VIEW scope.
 * - .groups — THE GROUPS IN FORCE — each value, and how many rows carry it.
 * - .suspendScope — A bar's filter Switch: OFF stops every filter in force in a scope, keeping each; ON brings them back.
 * - .suspendSelection — Stop applying a field without forgetting it.
 * - .selection — one field's whole state, ready for any control to draw
 * - .selectedFields — Every field currently selected.
 * - .scope — The fields a scope holds, in order — hold()'s read-back.
 * - .scopes — Every scope that holds a field, by id.
 * - .hold — Say what a scope holds now.
 * - .holds — Is this field held HERE?
 * - .scopeOf — Which scope holds this field, or null.
 * - .offer — Say which fields a component scope HAS.
 * - .fields — The fields a scope may hold.
 * - .canHold — May this scope hold this field?
 * - .move — Move a filter between scopes — ONE call, because the removal is not optional.
 * - .debugState — EVERYTHING THIS SOURCE THINKS IS TRUE, in one object.
 * - .remote — Do this source's loads reach outside the data layer?
 * - .applyOn — Once per act, or LIVE while a value moves — never live when remote. Fixed by the options.
 * - .commit — SEND the draft — Apply, on a remote source.
 * - .discard — Put the applied answers back over the draft — Discard, on a remote source.
 * - .pending — Has this field been changed and not yet applied?
 * - .dirty — Has anything in this scope — or any scope — been changed and not applied?
 * - .setSearch — the search text, across searchFields
 * - .setPage — which page to show
 * - .setPageSize — rows per page, or null for all
 * - .load — Re-read and push to every bound component.
 * - .reach — Can its store be reached?
 * - .failure — Why the store could not be reached, while it cannot — its kind and message — else null.
 * - .recheck — Try the store again: `down`, a fresh read; `unreached`, a read behind the rows shown, with no loading; `ok`,…
 * - .close — Let the store go: a change no longer reloads it, and its held set is dropped.
 * - .results — Each answered chip's results in a scope: the rows its own answer matches.
 * - .valueResults — Each PICKED value's own results in a scope: the rows that ONE value matches, within what the scope can see —…
 * - .limitOptions — Does each list field offer only the values the other answers leave? Settable, unlike applyOn.
 * - .present — Each list field's values the rows still HOLD under the OTHER answers in its scope — a component scope's withi…
 * - .offered — What each field below the top of a SERIAL set OFFERS: the values the rows hold under the answers above it, as…
 * - .attach — Take a component its binder has wired, and send it what is already loaded.
 * - .allRows — Every row a bound component is under, UNPAGED — what "Select all rows" ticks on a grid that holds one page.
 * - .unbind — Stop steering and stop populating this component.
 * - .boundElements — Every component currently bound.
 * - .answerScope — A scoped bar's whole answer: what it holds, each reading, its saved filters on or off. It is its Apply.
 * - .answerColumn — A heading's answer, in its grid's scope; a field no scope holds gets its chip.
 * - .answerUnscoped — An unscoped bar's whole answer: dropped fields cleared, each saved filter on as its own part.
 * - .request — Move fields into a scope: down from the View, or up from a chart with its answer.
 * - .reportPages — The grid's own page count, when every row is in hand: publish, load nothing.
 */
import {
  DEFAULT_OP, andFilter, filterFields, filterNeedles, filterRows, groupSummaries, readField, valueKey,
} from './store.js';
import { readingClause, stateClause } from './filter-state.js';
import { FieldCatalogue } from './field-catalogue.js';
import { SourceBinding } from './source-binding.js';
import { answerOrder, planWalk, walkStepwise } from './source-counts.js';
import { emptyWalk, walkInOrder, type Walk, type WalkPlan } from './walk.js';
import { sayReadings, type SaidField } from './filter-face.js';
import {
  answerOf, compile, eachScope, emptyScope, filterKey, readingAnswered, sameReading, VIEW,
  type CompileFacts, type Query, type QueryDefaults, type ScopeQuery,
} from './query.js';
import {
  answerIn, answersOf, cameFrom, clearReadings, copyField, copyScope, definitionOf, holderOf, holdsField, homeOf, homes,
  keepOff, moveHold, prune, readingOf, rehome, scopeEntry, setCameFrom, setReading, viewHeldReadings, type Arrange,
} from './query-edits.js';
import { coalesce, Latest } from './timing.js';
import { readingsOf, whereOf, type Condition, type Where } from './where.js';
import { report } from './report.js';
import { cacheOf, type StoreCache } from './store-cache.js';
import { planRead, type Plan } from './read-plan.js';
import { failureOf, unreached, type Failure } from './failure.js';
import type { FieldReading, FilterState } from './filter-state.js';
import type {
  Filter, GroupSummary, LoadOptions, LoadResult, Row, SortDirection, Store,
} from './store.js';
import type {
  ApplyAt, AttachFacts, BindSink, BoundControl, BoundView, DataChangeDetail, DataSourceOptions, FieldDeclaration, FieldFilter,
  FilterSet, HeldFilter, ScopeDescription, SourceState, ViewState,
} from './data-source-types.js';
export type {
  ApplyAt, AttachFacts, BindSink, BoundControl, BoundView, DataChangeDetail, DataSourceOptions, FieldDeclaration, FieldFilter,
  FilterSet, HeldFilter, OrganiseColumn, ScopeDescription, ScopeShows, SourceState, ViewState,
} from './data-source-types.js';

export class DataSource extends EventTarget {
  readonly store: Store;
  /** The view this source owns: sort, group, search, page. The filter is compiled. */
  #state: Omit<ViewState, 'filter'>;
  /** The fields a search matches, or every field. */
  #searchFields: string[] | undefined;
  /** Every bound component, how it is bound, and what it is pushed and drawn. */
  readonly #binding = new SourceBinding({
    describe: (s) => this.describe(s),
    scopeLabel: (s) => this.scopeLabel(s),
    partScopes: () => this.#narrowing.keys(),
    view: () => this.#boundView(),
    rows: (w) => (w === 'all' ? this.#allRows : this.#result.rows),
    only: (id) => this.#only[id],
    scoped: (s) => this.#scoped[s],
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
  /** What each field IS: its kind, label and values. TRAP T-the-field-type-decides-the-clause */
  readonly #catalogue = new FieldCatalogue();
  /** Each preset's name, and whether the reader may edit it. */
  #presetFacts = new Map<string, { label?: string }>();
  /** Each component's OWN default filter, by its scope — put back under any
   *  Query that does not name that scope. TRAP T-a-component-default-outlives-a-view */
  #defaults = new Map<string, ScopeQuery>();
  /** Each scope's name as a reader sees it. */
  #scopeLabels = new Map<string, string>();
  /** Each PART: the one field it answers, and the one component it narrows.
   *  TRAP T-a-chart-scope-is-its-legend-field */
  #narrowing = new Map<string, { field: string; only: BoundControl; label?: string }>();

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
    // REMOTE: the reader edits a copy, and Apply sends it.
    if (this.#remote) this.#draft = { v: 1, scopes: {} };
    this.#autoLoad = options.autoLoad ?? true;
    this.#limitOptions = options.limitOptions ?? false;
    this.#applyOn = options.applyOn ?? 'change';
    this.#debounce = options.debounce ?? 300;
    this.#holdRows = options.holdRows ?? 50_000;
    this.#searchFields = options.searchFields;
    this.#state = {
      sort: options.sort ?? [],
      group: options.group ?? null,
      search: '',
      page: 1,
      pageSize: options.pageSize ?? null,
    };
    this.#filter = options.filter;
    this.#cache = this.#remote && this.#holdRows > 0 ? cacheOf(this.store) : null;
    this.#since = this.#cache?.gen ?? 0;
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
    return structuredClone(this.#filter ? { ...this.#state, filter: this.#filter } : this.#state);
  }

  /** The Query the rows are under. A copy. On a local source the two are one
   *  object, and so are their copies. TRAP T-one-query-one-owner */
  get query(): { applied: Query; draft: Query } {
    return structuredClone({ applied: this.#applied, draft: this.#draft });
  }

  /** This source's whole question as JSON — the Query as applied, how its rows
   *  are arranged, and the saved filters it names. TRAP T-a-page-goes-out-as-json */
  export(): SourceState {
    const query = structuredClone(this.#applied);
    const { sort, group, search } = this.#state;
    // The arrangement goes in the scope that arranged it. TRAP T-group-and-sort-are-component-scope
    const by = this.#arrangedIn() ?? VIEW;
    query.scopes[VIEW] = { ...(query.scopes[VIEW] ?? emptyScope()), search };
    query.scopes[by] = { ...(query.scopes[by] ?? emptyScope()), sort: structuredClone(sort), group };
    const presets: SourceState['presets'] = {};
    for (const scope of Object.values(query.scopes)) {
      for (const id of Object.keys(scope.presets ?? {})) {
        const preset = this.preset(id);
        if (preset) presets[id] = preset;
      }
    }
    return { v: 1, query, presets };
  }

  /** Take a question back in, exactly: its saved filters, then its Query. */
  async import(state: SourceState): Promise<void> {
    if (state?.v !== 1) {
      report({ code: 'unknown-state', message: 'import: not a v1 source state, so nothing was taken in.' });
      return;
    }
    for (const [id, { readings, ...facts }] of Object.entries(state.presets ?? {})) {
      this.declarePreset(id, readings, facts);
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
    const second = view ? this.#definition(view, true, first.query, false) : null;
    const facts = this.#compileFacts();
    const filters = (q: Query): string => {
      const { filter, only } = compile(q, facts);
      return JSON.stringify([filterKey(filter), Object.entries(only).map(([el, f]) => [el, filterKey(f)]).sort()]);
    };
    const at = second?.query ?? first.query;
    if (filters(at) !== filters(this.#applied)) return false;
    /* WHICH filters each scope holds: one taken off, or moved, is a change too
       (Will, 2026-10-12). A component's own part is its, not the reader's. */
    const holds = (q: Query): string => JSON.stringify(eachScope(q)
      .filter(([, scope]) => scope.holds.length)
      .map(([id, scope]) => [id, [...scope.holds].sort()]).sort());
    if (holds(at) !== holds(this.#applied)) return false;
    const want = { ...first.arrange, ...second?.arrange };
    const { sort, group, search, sortSuspended } = this.#state;
    if (want.sort && JSON.stringify(sortSuspended ? [] : sort) !== JSON.stringify(want.sort)) return false;
    if (want.group !== undefined && (group ?? null) !== want.group) return false;
    return want.search === undefined || (search ?? '') === want.search;
  }

  /** Is there anything a Reset would clear — in one scope, or any: a reading
   *  that filters, a saved filter on, or the rows arranged? TODO 231 */
  answered(scope?: string): boolean {
    const { sort, group, sortSuspended } = this.#state;
    if ((sort.length && !sortSuspended) || group) return true;
    const facts = this.#compileFacts();
    return (scope ? [scope] : Object.keys(this.#applied.scopes)).some((id) => {
      const at = this.#applied.scopes[id];
      return !!at && (Object.values(at.presets ?? {}).some(Boolean)
        || Object.entries(at.readings).some(([field, reading]) => !!readingClause({ field, ...facts.field?.(field) }, reading)));
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
    const { query: next, arrange } = this.#definition(query, options.holds === 'keep');
    if (arrange) this.#arrange(arrange);
    const before = new Set(this.selectedFields);
    this.#applied = next;
    this.#draft = this.#remote ? structuredClone(next) : this.#applied;
    rehome(this.#draft);
    this.#recompose();
    this.dispatchEvent(new CustomEvent('scope-change', { detail: { scopes: this.scopes } }));
    for (const field of new Set([...before, ...this.selectedFields])) {
      this.dispatchEvent(new CustomEvent('selection-change', { detail: { field } }));
      this.#draw(field);
    }
    await this.#binding.drawEveryBar();
    // Drawn, never reported: the Query is already the answer.
    this.#syncSuperseded(false);
    this.#binding.drawScopesSoon();
  }

  /** Restore a whole view state — a saved view, a deep link, a reload.
   *  TRAP T-set-state-merges-page-last */
  setState(next: Partial<ViewState>): void {
    if ('filter' in next) {
      this.#parts.clear();
      // A whole filter REPLACES every field selection too, or a restored view
      // keeps ticks the query no longer carries.
      clearReadings(this.#draft, (f) => this.#catalogue.carriesOver(f));
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
  setSort(field: string | null, direction: SortDirection = 'asc', scope?: string): void {
    if (scope) this.#arrangedBy = scope;
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

  setGroup(field: string | null, scope?: string): void {
    if (scope) this.#arrangedBy = scope;
    this.#state.group = field;
    // The old count was measured against the OLD grouping. Drop it and wait for
    // the next draw. TRAP T-grouped-paging-belongs-to-the-view
    this.#viewPages = null;
    this.#requery();
  }

  /** Replace the WHOLE filter, clearing every contribution. TRAP T-contribute-beats-last-writer */
  setFilter(filter: Filter | undefined): void {
    this.#parts.clear();
    clearReadings(this.#draft, (f) => this.#catalogue.carriesOver(f));
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
  write(scope: string, field: string, reading: FieldReading | undefined, at: { only?: BoundControl } = {}): void {
    // A declared part narrows its own component, whoever writes it — a panel too.
    const only = at.only ?? this.#narrowing.get(scope)?.only;
    const bind = only ? this.#binding.get(only) : undefined;
    if (reading && only && bind?.rows !== 'all') {
      report({
        code: 'component-part-on-a-page',
        message: 'write: a scope that narrows one component needs a bound `rows: "all"` component.',
        at: { scope, field },
      });
      return;
    }
    const entry = scopeEntry(this.#draft, scope);
    if (bind) entry.narrows = [bind.id];
    if (reading && readingAnswered(reading)) {
      entry.readings[field] = answerOf(reading);
      if (!entry.holds.includes(field)) entry.holds = [...entry.holds, field];
    } else {
      Reflect.deleteProperty(entry.readings, field);
      entry.holds = entry.holds.filter((f) => f !== field);
    }
    const narrows = entry.narrows ?? [];
    prune(this.#draft);
    /* A scope that narrows ONE component filters rows already here — no fetch,
       so no Apply, even on a remote source. */
    if (this.#remote && narrows.length) copyScope(this.#draft, this.#applied, scope);
    this.#recompose();
    // The shared filter did not move, so no load will push it: push it here.
    this.#binding.pushTo(narrows);
    this.dispatchEvent(new CustomEvent('selection-change', { detail: { field, scope } }));
    // A panel shows a part too, and is told as a bar is. TRAP T-one-query-one-owner
    if (this.#narrowing.has(scope)) {
      const drawn = structuredClone(this.#draft.scopes[scope]?.readings[field] ?? { picked: [] });
      this.#binding.drawPanelReading(field, drawn, scope);
    }
  }

  /**
   * Declare a PART — the scope of ONE field that narrows ONE component, a
   * chart's legend field — so a panel draws it before it is answered, and a
   * write to it from anywhere narrows that component. `undefined` forgets it.
   * TRAP T-a-chart-scope-is-its-legend-field
   */
  declarePart(scope: string, part: { field: string; only: BoundControl; label?: string } | undefined): void {
    this.#age++;
    if (part) this.#narrowing.set(scope, part);
    else this.#narrowing.delete(scope);
    // Sent up, the View holds its field — and draws only a field it knows.
    if (part && !this.#catalogue.has(part.field)) this.declareField(part.field);
    this.#binding.drawScopesSoon();
  }

  /** What `declarePart` was told for this scope, or undefined. Not a `contribute` part. `only` is the element itself. */
  partFacts(scope: string): { field: string; only: BoundControl; label?: string } | undefined {
    const part = this.#narrowing.get(scope);
    return part ? { ...part } : undefined;
  }

  /**
   * A component's OWN default filter — readings that narrow `only` it — as its
   * scope in the Query. It is put back under any Query that does not name that
   * scope, so a View pick keeps it; `undefined` forgets it and its scope.
   * TRAP T-a-component-default-outlives-a-view
   */
  declareDefault(
    scope: string,
    readings: Readonly<Record<string, FieldReading>> | undefined,
    at: { only?: BoundControl } = {},
  ): void {
    const was = this.#draft.scopes[scope]?.readings ?? {};
    if (!readings) {
      this.#defaults.delete(scope);
      for (const field of Object.keys(was)) this.write(scope, field, undefined);
      return;
    }
    // Its OWN before the first write compiles, so a View-held field cannot set it aside.
    this.#defaults.set(scope, emptyScope());
    for (const field of Object.keys(was)) if (!(field in readings)) this.write(scope, field, undefined);
    for (const [field, reading] of Object.entries(readings)) this.write(scope, field, reading, at);
    const written = this.#draft.scopes[scope];
    if (written) this.#defaults.set(scope, structuredClone(written));
    else this.#defaults.delete(scope);
  }

  /** A component's own default, as `declareDefault` left it, or undefined — not
   *  its answer now, which `reading()` reads. A copy. */
  defaultFor(scope: string): Record<string, FieldReading> | undefined {
    const held = this.#defaults.get(scope);
    return held ? structuredClone(held.readings) : undefined;
  }

  /** One scope's reading of one field, or undefined. A copy. */
  reading(scope: string, field: string): FieldReading | undefined {
    const held = this.#draft.scopes[scope]?.readings[field];
    return held ? structuredClone(held) : undefined;
  }

  /** What `compile` narrows each bound component by, alone — by bind id. */
  #only: Record<string, Filter> = {};

  /** Every named part currently applied — the component-scope filters. */
  get contributions(): string[] {
    return [...this.#parts.keys()];
  }

  /** One named part's filter, as `contribute` left it, or undefined. A copy. */
  contribution(key: string): Filter | undefined {
    const part = this.#parts.get(key);
    return part ? structuredClone(part) : undefined;
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
        .map(([field, reading]) => stateClause(this.#catalogue.stateFor(field, reading)))
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
    if (Object.keys(presets).length) scopeEntry(this.#draft, scope).presets = { ...presets };
    else if (this.#draft.scopes[scope]) delete this.#draft.scopes[scope]!.presets;
    prune(this.#draft);
    this.#recompose();
    if (JSON.stringify(this.#draft.scopes[scope]?.presets ?? {}) !== before) this.#binding.drawScopesSoon();
  }

  /** A saved filter's readings, by id — the library a preset that is ON
   *  compiles from. `undefined` forgets one. TRAP T-a-saved-filter-is-its-readings */
  declarePreset(
    id: string,
    readings: Readonly<Record<string, FieldReading>> | undefined,
    facts: { label?: string } = {},
  ): void {
    this.#age++;
    if (readings) {
      this.#presets.set(id, readings);
      this.#presetFacts.set(id, { ...this.#presetFacts.get(id), ...facts });
    } else {
      this.#presets.delete(id);
      this.#presetFacts.delete(id);
    }
    this.#recompose();
    this.#binding.drawScopesSoon();
  }

  /** What `declarePreset` was told for this id — its label and readings — or
   *  undefined. A copy, in the shape `export()` sends and `import()` takes. */
  preset(id: string): SourceState['presets'][string] | undefined {
    const readings = this.#presets.get(id);
    return readings ? { ...this.#presetFacts.get(id), readings: structuredClone(readings) as Record<string, FieldReading> } : undefined;
  }

  /**
   * One scope as a control draws it WHOLE: each preset and field it holds —
   * a field held ABOVE keeps its place and says where it went — what it may
   * add, and, below the View, how its rows are arranged.
   * TRAP T-a-panel-asks-for-its-scopes
   */
  describe(scope: string): ScopeDescription {
    const q = this.#draft.scopes[scope] ?? emptyScope();
    const above = scope === VIEW ? [] : this.scope(VIEW);
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
          ...(above.includes(part.field) ? { appliedAt: this.scopeLabel(VIEW) } : {}),
        }] : [],
      };
    }
    const presets: HeldFilter[] = Object.entries(q.presets ?? {}).map(([id, on]) => {
      const facts = this.#presetFacts.get(id) ?? {};
      return {
        id, label: facts.label ?? id, readings: this.#presets.get(id) ?? {}, active: on, removable: true,
        says: this.#says(id),
      };
    });
    /* EVERY field it holds, declared or not: one left out still filters. In the
       ONE order — each set together (D2 A). TRAP T-a-broken-assumption-reports
       TRAP T-one-walk-counts-and-limits-in-order */
    const held = answerOrder(this.#draft, this.#sets.get(scope) ?? [], (id) => this.#presets.get(id), scope)
      .flatMap((e) => (e.kind === 'field' && e.held ? [e.id] : []));
    const fields: HeldFilter[] = held.map((f) => {
      const reading = q.readings[f];
      const down = scope === VIEW ? this.#sendTo(f) : undefined;
      const from = cameFrom(this.#draft, f);
      return {
        ...this.filterDef(f), removable: true,
        // The View's date slices the whole view, so it is a RANGE. Will, TODO 20b.
        ...(scope === VIEW && this.#catalogue.get(f)?.type === 'date' ? { range: true } : {}),
        ...(reading ? { state: structuredClone(reading) } : {}),
        ...(above.includes(f) ? { appliedAt: this.scopeLabel(VIEW) } : {}),
        ...(down ? { sendTo: {
          scope: down, label: this.#narrowing.get(down)?.label ?? this.scopeLabel(down), ...(down === from ? { origin: true } : {}),
        } } : {}),
      };
    });
    // Below the View, a saved filter it does not hold is offered too.
    const offered = scope === VIEW ? [] : [...this.#presetFacts.keys()]
      .filter((id) => !(id in (q.presets ?? {})))
      .map((id) => ({ id, label: this.#presetFacts.get(id)?.label ?? id,
        readings: this.#presets.get(id) ?? {}, says: this.#says(id) }));
    const shows = scope === VIEW ? 'view'
      : this.#binding.showsOf(scope);
    const sets = this.sets(scope);
    const out: ScopeDescription = {
      scope, label: this.scopeLabel(scope), ...(shows ? { shows } : {}), filters: [...presets, ...fields],
      available: [...this.addable(scope), ...offered], ...(sets.length ? { sets } : {}),
      ...(q.suspended ? { suspended: true } : {}),
    };
    /* HOW its rows are arranged — only in a scope that arranges, and its own
       arrangement only. TRAP T-group-and-sort-are-component-scope */
    if (this.arranges(scope) && this.fields(scope).length) {
      const cols = this.fields(scope).filter((f) => this.#catalogue.has(f))
        .map((f) => ({ field: f, label: this.#catalogue.get(f)?.label ?? f }));
      out.group = cols;
      out.sort = cols;
      const mine = (this.#arrangedIn() ?? scope) === scope;
      if (mine && this.#state.group) out.groupField = this.#state.group;
      const [first] = mine ? this.#state.sort : [];
      if (first) {
        out.sortField = first.field;
        out.sortDirection = first.direction ?? 'asc';
      }
    }
    return out;
  }

  /** say(readings) — a saved filter in WORDS, field by field: the source knows
   *  each field's name, type and values. TRAP T-a-saved-chip-lists-its-conditions */
  say(readings: Readonly<Record<string, FieldReading>>): SaidField[] {
    return sayReadings(readings, (field) => this.#catalogue.facts(field));
  }

  /** A preset it holds, in words. */
  #says(id: string): SaidField[] {
    return this.say(this.#presets.get(id) ?? {});
  }

  /** Switch a scope's presets: the ids given are ON, the rest it holds OFF. */
  #setPresets(scope: string, on: readonly string[]): void {
    const entry = scopeEntry(this.#draft, scope);
    entry.presets = Object.fromEntries(Object.keys(entry.presets ?? {}).map((id) => [id, on.includes(id)]));
    this.#recompose();
  }

  /** The panel's answer: each field it changed, and each scope's presets. A
   *  preset switch is an Apply, as a bar's report is. */
  answerScopes(readings: Record<string, Record<string, FieldReading>> | undefined): void {
    const switched: string[] = [];
    for (const [scope, fields] of Object.entries(readings ?? {})) {
      for (const [id, reading] of Object.entries(fields)) {
        if (id === 'presets') {
          this.#setPresets(scope, (reading.picked ?? []).map(String));
          switched.push(scope);
          continue;
        }
        // A chart's own field narrows that chart alone. TRAP T-a-chart-scope-is-its-legend-field
        if (this.#narrowing.has(scope)) {
          this.write(scope, id, reading.picked?.length ? { picked: [...reading.picked] } : undefined);
          continue;
        }
        this.select(id, reading.picked ?? [], reading);
      }
    }
    /* THE BARS LAST, once every field is in. A bar draws a COPY of its scope a
       moment later: drawn mid-way through a Reset, it put back the fields the
       rest of that report then cleared. TRAP T-a-bar-is-drawn-the-scope-as-it-ends */
    for (const scope of switched) this.#binding.drawBars(scope);
    if (switched.length) this.commit();
  }

  /** A scope TAKES fields and presets: a field is held, and a saved filter
   *  comes ON — it is answered already. */
  #take(scope: string, ids: readonly string[]): void {
    const presets = ids.filter((id) => this.#presets.has(id));
    const fields = ids.filter((id) => !this.#presets.has(id) && !this.holds(scope, id));
    if (fields.length) this.hold(scope, [...this.scope(scope), ...fields]);
    if (presets.length) {
      const entry = scopeEntry(this.#draft, scope);
      entry.presets = { ...entry.presets, ...Object.fromEntries(presets.map((id) => [id, true])) };
      this.#recompose();
      this.#binding.drawScopesSoon();
    }
    this.#binding.drawBars(scope);
  }

  /** Remember, or forget, where a View field came up from, in both copies. */
  #setCameFrom(field: string, from: string | undefined): void {
    for (const query of new Set([this.#draft, this.#applied])) setCameFrom(query, field, from);
  }

  /** The ONE scope a View field is sent down to: the one it came UP from,
   *  while that still has it, else the first that has it — a component's, in
   *  the page's order, then a chart's own. Will, TODO 346. TRAP T-send-to-view-filters */
  #sendTo(field: string): string | undefined {
    const has = (scope: string): boolean =>
      scope !== VIEW && (this.#narrowing.get(scope)?.field === field || this.canHold(scope, field));
    const from = cameFrom(this.#draft, field);
    if (from && has(from)) return from;
    return [...this.#offers.keys(), ...this.#narrowing.keys()].find(has);
  }

  /** SEND a View field DOWN: the View lets go of it, and its answer goes to
   *  the one scope named. TRAP T-send-to-view-filters */
  #lower(field: string, to: string): void {
    if (!this.holds(VIEW, field)) return;
    const answer = this.reading(VIEW, field);
    const part = this.#narrowing.get(to);
    if (!part && !this.canHold(to, field)) return;
    /* ONE SCOPE AT A TIME. A scope the field came up from still holds its
       place; left so, the field showed there AGAIN as it landed in another —
       and its answer could land in either. Each lets go first, while the View
       still holds the answer. Will, TODO 168. TRAP T-send-to-view-filters */
    for (const [id, scope] of eachScope(this.#draft)) {
      if (id === VIEW || id === to || !scope.holds.includes(field)) continue;
      this.hold(id, scope.holds.filter((f) => f !== field));
      this.#binding.drawBars(id);
    }
    // Held BELOW first, so the answer moves there and is not cleared.
    if (!part && !this.holds(to, field)) this.hold(to, [...this.scope(to), field]);
    this.hold(VIEW, this.scope(VIEW).filter((f) => f !== field));
    // A chart's own scope takes the picks; the View's answer went with its hold.
    if (part) this.write(to, field, answer?.picked?.length ? { picked: [...answer.picked] } : undefined);
    /* THE VIEW'S ANSWER WINS, whole — its mode and its rows. The bar below is
       freed as the View lets go, and reports the answer IT kept from before
       the field went up: an old one. TRAP T-send-to-view-filters */
    else if (answer) this.select(field, answer.picked ?? [], answer);
    this.#setCameFrom(field, undefined);
    this.commit();
    this.#binding.drawBars(VIEW);
    if (!part) this.#binding.drawBars(to);
  }

  /** A scope lets ONE go — a field or a preset. */
  release(scope: string, id: string): void {
    const entry = this.#draft.scopes[scope];
    if (entry?.presets && id in entry.presets) {
      Reflect.deleteProperty(entry.presets, id);
      prune(this.#draft);
      this.#recompose();
      this.#binding.drawScopesSoon();
    } else {
      this.hold(scope, this.scope(scope).filter((f) => f !== id));
    }
    this.#binding.drawBars(scope);
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
  }

  /**
   * Each field here that its schema says nothing of takes it from the ROWS: a
   * set, its unique values in order; a number, its lowest and highest. One ask
   * — the store's distinct() where it has one, else one load — and only when a
   * field needs it. TRAP T-the-data-says-what-a-field-may-hold
   */
  declareFromRows(fields: readonly string[]): Promise<void> {
    return this.#catalogue.fromRows(fields, async (open) => {
      await this.#hold();
      const reads = this.#reads;
      if (reads.distinct) return reads.distinct(open, {});
      const { rows } = await reads.load({});
      return Object.fromEntries(open.map((f) => [f, rows.map((r) => readField(r, f))]));
    });
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

  /** Name a scope as a reader sees it — a panel's section, an Add list's note — and say if it arranges. */
  declareScope(scope: string, facts: { label?: string; arranges?: boolean }): void {
    if (facts.label != null) this.#scopeLabels.set(scope, facts.label);
    if (facts.arranges != null) this.#arranges.set(scope, facts.arranges);
  }

  /** What `declareScope` was told — not the fallbacks `scopeLabel()` and `arranges()` answer with. */
  scopeFacts(scope: string): { label?: string; arranges?: boolean } {
    const label = this.#scopeLabels.get(scope);
    const arranges = this.#arranges.get(scope);
    return { ...(label != null ? { label } : {}), ...(arranges != null ? { arranges } : {}) };
  }

  /** Does Group and Sort arrange this scope's rows? As declared — else a
   *  component scope that shows a grid or a list does, and the View does not.
   *  Will, TODO 99. TRAP T-group-and-sort-are-component-scope */
  arranges(scope: string): boolean {
    return this.#arranges.get(scope)
      ?? (scope !== VIEW && this.#binding.showsRows(scope));
  }
  /** Each scope's own word on whether it arranges. */
  #arranges = new Map<string, boolean>();

  /** The scope whose Group or Sort set the rows' arrangement — while it still
   *  arranges; else none, and every arranging scope shows it. */
  #arrangedIn(): string | undefined {
    return this.#arrangedBy && this.arranges(this.#arrangedBy) ? this.#arrangedBy : undefined;
  }
  /** The scope that last arranged the rows. */
  #arrangedBy: string | undefined;

  /** A scope's filter sets, in order. A field is in one set at most; a second
   *  is left out, and said. TRAP T-a-filter-set-groups-or-chains */
  declareSets(scope: string, sets: readonly FilterSet[]): void {
    this.#age++;
    const taken = new Set<string>();
    this.#sets.set(scope, sets.map((set) => ({
      ...structuredClone(set),
      fields: set.fields.filter((field) => {
        if (!taken.has(field)) {
          taken.add(field);
          return true;
        }
        report({
          code: 'field-in-two-sets',
          message: `declareSets: "${field}" is in two of scope "${scope}"'s sets; it stays in the first.`,
          at: { scope, set: set.id, field },
        });
        return false;
      }),
    })));
  }

  /** A scope's filter sets, as declared. */
  sets(scope: string): FilterSet[] {
    return structuredClone(this.#sets.get(scope) ?? []);
  }

  /** Each scope's filter sets. */
  #sets = new Map<string, FilterSet[]>();

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
    // TRAP T-component-extends-view-never-alters-it
    const skip = new Set([...taken, ...(scope === VIEW ? [] : this.scope(VIEW))]);
    return this.fields(scope).filter((f) => !skip.has(f) && this.#catalogue.has(f)).map((f) => {
      const at = this.scopeOf(f);
      return at && at !== scope ? { ...this.filterDef(f), note: this.scopeLabel(at) } : this.filterDef(f);
    });
  }

  /** What `declareValues` was told, as the data holds it. */
  valuesFor(field: string): unknown[] {
    return this.#catalogue.valuesFor(field);
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
    const declared = this.#catalogue.byKey(field);
    const raws = picked.map((v) => declared.get(valueKey(v)) ?? v);
    const next: FieldReading = { ...answerOf(reading), picked: raws };
    /* CONDITIONS count. A field answered only by rows — "starts with Go", or
       an or-chain over two owners — has no picked values and no typed text, so
       this deleted the reading and the filter never applied.
       TRAP T-many-conditions-are-one-reading */
    setReading(this.#draft, field, readingAnswered(next) ? next : undefined);
    this.#recompose();
    // AFTER the requery, so a listener sees the state the rows were fetched for.
    this.dispatchEvent(new CustomEvent('selection-change', { detail: { field } }));
    this.#draw(field);
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
    /* The rows a component SHOWS: an unwindowed load is those, under every
       scope. `#allRows` is the VIEW's alone, so it stands in only for a page.
       TRAP T-a-group-is-a-data-layer-concept */
    const whole = this.#state.group != null || this.#state.pageSize == null;
    const rows = !whole && this.#allRows.length ? this.#allRows : this.#result.rows;
    return groupSummaries(rows, field);
  }

  /**
   * A bar's filter Switch. OFF stops every answer and saved filter in force in
   * this scope, keeping each; ON brings back exactly those. While it is off,
   * nothing comes into force there. TRAP T-the-filter-switch-keeps-what-it-turned-off
   */
  suspendScope(scope: string, suspended = true): void {
    if (suspended === !!this.#draft.scopes[scope]?.suspended) return;
    const entry = scopeEntry(this.#draft, scope);
    let fields: string[];
    if (suspended) {
      entry.suspended = { fields: [], presets: [] };
      this.#recompose();
      fields = [...entry.suspended.fields];
    } else {
      const off = entry.suspended!;
      delete entry.suspended;
      fields = off.fields.filter((f) => f in entry.readings);
      for (const f of fields) {
        const { suspended: _off, ...on } = entry.readings[f]!;
        entry.readings[f] = on;
      }
      for (const id of off.presets) if (entry.presets && id in entry.presets) entry.presets[id] = true;
      prune(this.#draft);
      this.#recompose();
    }
    // The Switch is its scope's Apply, remote too.
    this.commit({ scope });
    for (const field of fields) {
      this.dispatchEvent(new CustomEvent('selection-change', { detail: { field } }));
      this.#draw(field);
    }
    this.#binding.drawBars(scope);
  }

  /** Stop applying a field without forgetting it. TRAP T-grid-suspend-is-not-clear */
  suspendSelection(field: string, suspended = true): void {
    const held = readingOf(this.#draft, field);
    if (!held) return;
    this.select(field, held.picked ?? [], { ...held, suspended });
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

  /** The fields a scope HOLDS, in order — `hold()`'s read-back. A copy. */
  scope(name: string): string[] {
    return [...(this.#draft.scopes[name]?.holds ?? [])];
  }

  /** Every scope that holds a field, by id — `scope()` reads one of them. */
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
    const elsewhere = (field: string): boolean => eachScope(this.#draft)
      .some(([id, s]) => id !== name && s.holds.includes(field));
    for (const field of before) {
      if (!next.includes(field) && !elsewhere(field) && readingOf(this.#draft, field)) this.select(field, []);
    }
    const was = homes(this.#draft);
    scopeEntry(this.#draft, name).holds = next;
    rehome(this.#draft);
    this.dispatchEvent(new CustomEvent('scope-change', { detail: { scope: name } }));
    /* RAISING CARRIES THE ANSWER, and lowering brings it back: an answer that
       moved scope is drawn where it lives now. TRAP T-up-is-open-down-is-closed */
    const now = homes(this.#draft);
    for (const [field, home] of now) if (was.get(field) !== home) this.#draw(field);
    if (name === VIEW) this.#syncSuperseded(true);
    this.#binding.drawScopesSoon();
  }

  /** Each grid below the View is told the fields the View holds, as APPLIED. */
  #syncColumns(): void {
    this.#binding.supersedeColumns(viewHeldReadings(this.#applied));
  }

  /** Tell each grid and each bar below the View what the View holds now; a bar whose set changed may report again. */
  #syncSuperseded(report: boolean): void {
    this.#syncColumns();
    this.#binding.supersede(this.scope(VIEW), report);
  }

  /** Is this field held HERE? */
  holds(name: string, field: string): boolean {
    return holdsField(this.#draft, name, field);
  }

  /**
   * Which scope holds this field, or null — the View first, when it does.
   *
   * This is what SUPERSEDING is: a field the view scope holds is not the data
   * bar's to narrow, and neither bar has to know the other is there.
   */
  scopeOf(field: string): string | null {
    return holderOf(this.#draft, field);
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
    // What its menus may add moved: the walk tallies it.
    if (this.#loaded) this.#walkSoon();
  }

  /**
   * The fields a scope may hold. A COMPONENT's are its own; the VIEW's are
   * every component's, because any field may be raised to narrow everything.
   */
  fields(name: string): string[] {
    if (name === VIEW) return [...new Set([...this.#offers.values()].flat())];
    return [...(this.#offers.get(name) ?? [])];
  }

  /** May this scope hold this field? Up is open; down is closed. */
  canHold(name: string, field: string): boolean {
    return name === VIEW || (this.#offers.get(name) ?? []).includes(field);
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
    const touched = moveHold(this.#draft, field, from, to);
    rehome(this.#draft);
    // ONE event, naming every scope that changed — a listener never sees the
    // field in neither place, or in both.
    this.dispatchEvent(new CustomEvent('scope-change', { detail: { scopes: touched } }));
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

  /** Compile the applied Query under every part. Says whether the SHARED filter
   *  stood still, and — remote — whether nothing a load reads moved. */
  #compileNow(): { still: boolean; same: boolean } {
    const { filter, view, scoped, only } = compile(this.#applied, this.#compileFacts());
    const parts = [...this.#parts.values()];
    const next = andFilter([...parts, ...(filter ? [filter] : [])]);
    const viewed = andFilter([...parts, ...(view ? [view] : [])]);
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
      preset: (id) => this.#presets.get(id),
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

  /** A definition as a whole Query, and how it arranges the rows: definitionOf, over this source. */
  #definition(
    given: Query | QueryDefaults, keep: boolean, base: Query = this.#draft, copy = true,
  ): { query: Query; arrange: Arrange | null } {
    return definitionOf(given, keep, base, {
      defaults: this.#defaults,
      readingsOf: (where) => this.readingsOf(where),
      carriesOver: (f) => this.#catalogue.carriesOver(f),
    }, copy);
  }

  /** A definition's arrangement onto the source's own. */
  #arrange(by: Arrange): void {
    if (by.scope) this.#arrangedBy = by.scope;
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
    if (at.field) copyField(this.#draft, this.#applied, at.field);
    else if (at.scope) copyScope(this.#draft, this.#applied, at.scope);
    else this.#applied = structuredClone(this.#draft);
    this.#recompose();
    // The headings show what is APPLIED.
    this.#syncColumns();
  }

  /** Put the applied answers back over the draft — Discard, on a remote source.
   *  One field, one scope, or all. Every control over them is drawn the applied answer. */
  discard(at: { scope?: string; field?: string } = {}): void {
    if (!this.#remote) return;
    const before = new Set(this.selectedFields);
    if (at.field) copyField(this.#applied, this.#draft, at.field);
    else if (at.scope) copyScope(this.#applied, this.#draft, at.scope);
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
    return !sameReading(answerIn(this.#applied, field), answerIn(this.#draft, field));
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

  /** Tell each bound control over a scope its PENDING fields and whether its scope is DIRTY. */
  #syncPending(): void {
    this.#binding.syncPending((scopes) => (this.#remote
      ? [...new Set(scopes.flatMap((id) => Object.keys({
        ...this.#applied.scopes[id]?.readings, ...this.#draft.scopes[id]?.readings,
      })))].filter((f) => this.pending(f))
      : []), (id) => this.dirty(id));
  }

  setSearch(term: string): void {
    this.#state.search = term;
    this.#requery();
  }

  /** The SEARCH as needles, so a view marks what it found: a `contains` on each
   *  field it searches, or on every field (`*`). TRAP T-a-find-asks-its-host-to-step */
  #searchNeedles(): string {
    const term = this.#state.search.trim().replace(/\n/g, ' ');
    if (!term) return '';
    return (this.#searchFields?.length ? this.#searchFields : ['*']).map((f) => `${f}:contains:${term}`).join('\n');
  }

  setPage(page: number): void {
    // Clamped against the CURRENT total, so a pager cannot walk past the end.
    this.#state.page = Math.min(Math.max(1, Math.trunc(page) || 1), this.totalPages);
    /* GROUPED: publish, never load. Grouped loads send no skip/take, so every
       page shares one state key and the no-op guard would eat the publish.
       TRAP T-grouped-page-change-publishes-without-loading */
    if (this.#state.group) {
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

  /** The ViewState as one comparable string. Key order is stable by construction. */
  #stateKey(): string {
    return JSON.stringify(this.#loadOptions());
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
  #onStoreChange = (): void => {
    this.#age++;
    this.#rowsAge++;
    void (this.#cache ? this.#reask() : this.load({ force: true }));
  };

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
        const walk = await this.#walked();
        if (!this.#inFlight.is(ticket)) return await (this.#asking ?? Promise.resolve(this.#result));
        if (this.#takeAside(walk)) this.#compileNow();
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
      const windowed = this.#state.pageSize != null && !this.#state.group;
      const viewed = this.#viewFilter === null ? this.#filter : this.#viewFilter;
      const split = JSON.stringify(viewed) !== JSON.stringify(this.#filter);
      if (!this.#binding.wantsAllRows() || (!windowed && !split)) {
        this.#allRows = this.#binding.wantsAllRows() ? result.rows : [];
        this.#allFor = '';
      } else {
        const { skip: _skip, take: _take, filter: _filter, ...rest } = this.#loadOptions();
        const asked = viewed ? { ...rest, filter: viewed } : rest;
        // The same question over the same rows — a page turned — is not asked again.
        const allKey = JSON.stringify([this.#age, asked]);
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
      if (!this.#state.group && this.#state.pageSize && this.#state.page > pages) {
        this.#state.page = pages;
        return this.#reask();
      }

      this.#binding.publish();
      // Empty, or no matches: the data layer says which. TRAP T-a-container-shows-its-datas-state
      const emptiness = result.total > 0 ? undefined : this.#filter || this.#state.search ? 'no-matches' : 'empty';
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
    return JSON.stringify([this.#age, this.#limitOptions, this.#applied, [...this.#parts],
      this.#viewFilter === null ? this.#filter ?? null : null, components, [...this.#defaults.keys()].sort(), parts,
      [...this.#offers]]);
  }

  /** The component scope a chart part's element is bound into, if any. */
  #hostOf(el: BoundControl): string | undefined {
    const scope = this.#binding.get(el)?.scope;
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
      presets: (id) => this.#presets.get(id),
      sets: (scope) => this.#sets.get(scope) ?? [],
      fields: (scope) => this.fields(scope),
      components: this.#binding.componentScopes(),
      fixed: new Set(this.#defaults.keys()),
      parts: [...this.#parts.values()],
      ...(this.#viewFilter === null && this.#filter ? { hand: this.#filter } : {}),
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
    const key = this.#walkKey();
    if (this.#walk?.key === key) return this.#walk.walk;
    if (this.#walking?.key === key) return this.#walking.walk;
    const plan = this.#planWalk();
    // Nothing to count or tally: no row is read.
    if (!plan.scopes.some((sc) => sc.taps.length || sc.steps.some((st) => st.counts || st.each?.length || st.ruler || st.offers))) {
      this.#walk = { key, walk: emptyWalk() };
      return this.#walk.walk;
    }
    const entry: { key: string; walk: Promise<Walk> } = { key, walk: Promise.resolve(emptyWalk()) };
    entry.walk = (async (): Promise<Walk> => {
      try {
        const rows = await this.#walkRows();
        const out = rows ? walkInOrder(rows, plan) : await walkStepwise(this.#reads, plan);
        if (this.#walkKey() === key) this.#walk = { key, walk: out };
        return out;
      } catch {
        // The last walk stays drawn, and nothing is set aside from it. It never stops a load.
        const kept = { ...(this.#walk?.walk ?? emptyWalk()) };
        this.#unwalked.add(kept);
        return kept;
      } finally {
        if (this.#walking === entry) this.#walking = null;
      }
    })();
    this.#walking = entry;
    return entry.walk;
  }
  /** The last walk, and what it was for. */
  #walk: { key: string; walk: Walk } | null = null;
  /** A walk that failed, standing in for the last one. */
  #unwalked = new WeakSet<Walk>();
  /** The walk in flight, and what it is for. */
  #walking: { key: string; walk: Promise<Walk> } | null = null;
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
    if (this.#unwalked.has(walk)) return false;
    const next = new Map(Object.entries(walk.aside).filter(([, fields]) => Object.keys(fields).length));
    const key = (m: Map<string, Record<string, string[]>>): string => JSON.stringify([...m].sort());
    if (key(next) === key(this.#setAside)) return false;
    this.#setAside = next;
    return true;
  }

  /** Walk, and set aside what it rules out — compiling again, and asking again
   *  only when that moved what a load reads — then draw what it gives. */
  async #rewalk(): Promise<void> {
    const walk = await this.#walked();
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

  /* ── What the other answers LEAVE — Will, TODO 174 (110 B) ─────────────
   * TRAP T-a-ruled-out-value-is-greyed */

  /** Does each list field offer only the values the other answers leave? Settable at any time, unlike `applyOn`. */
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
    const arranged = scope ? this.arranges(scope) : false;
    this.#binding.add(el, facts, sink);
    this.#rescope(had);
    // A grid joined, so its scope arranges now: its bars and panel draw Group and Sort. TODO 99
    if (scope && !arranged && this.arranges(scope)) {
      this.#binding.drawBars(scope);
      this.#binding.drawScopesSoon();
    }

    // Whatever is already loaded, so a component bound late is not blank.
    this.#binding.push(el);
    if (Array.isArray(facts.scope) && el.drawScopes) this.#binding.drawScopesSoon();
    if (typeof facts.scope === 'string' && el.supersedeColumns) this.#syncColumns();
    // …and what each field's other answers leave. TRAP T-a-ruled-out-value-is-greyed
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

  /** A scoped bar's whole answer: what it holds, each field's reading, and its
   *  saved filters on or off. It is its Apply. The library is the SOURCE's: a
   *  report only teaches it a saved filter it has never heard of.
   *  TRAP T-a-bar-reports-its-holds · TRAP T-one-query-one-owner */
  answerScope(scope: string, answer: {
    holds?: readonly string[];
    readings: Record<string, FieldReading>;
    presets?: Record<string, { on: boolean; readings: Record<string, FieldReading> }>;
    /** Its filter Switch is off — only from a bar that shows one. */
    suspended?: boolean;
    /** A Reset: what the Switch turned off is forgotten, not brought back. */
    reset?: boolean;
  }): void {
    const off = this.#draft.scopes[scope]?.suspended;
    if (answer.reset && off) this.#draft.scopes[scope]!.suspended = { fields: [], presets: [] };
    if (answer.holds) this.hold(scope, [...answer.holds]);
    const presets = answer.presets ?? {};
    for (const [id, p] of Object.entries(presets)) if (!this.#presets.has(id)) this.declarePreset(id, p.readings);
    this.answer(scope, answer.readings, Object.fromEntries(Object.entries(presets).map(([id, p]) => [id, p.on])));
    // The answer first, then the Switch: OFF lists what that answer has in force.
    if (answer.suspended !== undefined) this.suspendScope(scope, answer.suspended);
    // A bar's report IS its Apply: its menus waited for it, remote.
    this.commit();
    // A saved filter it turned on, into a scope ALREADY off, was turned off: draw
    // that. A Switch turned off just now has drawn its bars.
    const now = this.#draft.scopes[scope];
    if (off && now?.suspended && Object.entries(presets).some(([id, p]) => p.on && !now.presets?.[id])) {
      this.#binding.drawBars(scope);
    }
  }

  /** A HEADING's answer is its field's, in its grid's scope — and a field no
   *  scope holds yet gets its normal chip on that scope's bar.
   *  TRAP T-a-heading-asks-through-the-source */
  answerColumn(scope: string, field: string, reading: FieldReading | null): void {
    const fresh = !!reading && !this.scopeOf(field) && this.canHold(scope, field);
    if (fresh) this.hold(scope, [...this.scope(scope), field]);
    this.select(field, reading?.picked ?? [], reading ?? {});
    // A heading's Apply is an Apply. TRAP T-apply-and-discard-wait-for-a-change
    this.commit();
    if (fresh) this.#binding.drawBars(scope);
  }

  /** An UNSCOPED bar's whole answer: a field it answered before and names no longer
   *  is cleared (its own only), and each saved filter it has on is one part of its own.
   *  TRAP T-a-filter-report-is-the-whole-answer · TRAP T-a-saved-filter-is-its-readings */
  answerUnscoped(
    by: BoundControl,
    readings: Readonly<Record<string, FieldReading>>,
    presets: Readonly<Record<string, { on: boolean; readings: Record<string, FieldReading> }>> = {},
  ): void {
    const bind = this.#binding.get(by);
    for (const field of bind?.answered ?? []) if (!(field in readings)) this.select(field, []);
    if (bind) bind.answered = new Set(Object.keys(readings));
    this.apply(readings);
    const on = Object.entries(presets).filter(([, p]) => p.on);
    const parts = new Set(on.map(([id]) => `saved:${id}`));
    for (const key of bind?.saved ?? []) if (!parts.has(key)) this.contribute(key, undefined);
    for (const [id, p] of on) this.apply(p.readings, { reach: 'component', key: `saved:${id}` });
    if (bind) bind.saved = parts;
  }

  /** Move fields into a scope — sent DOWN from the View to the one scope
   *  named, or UP from a chart with its answer. TRAP T-send-to-view-filters */
  request(scope: string, ids: readonly string[], from?: string): void {
    if (from === VIEW && scope !== VIEW) {
      for (const id of ids) this.#lower(id, scope);
      return;
    }
    if (scope === VIEW && from) for (const id of ids) this.#setCameFrom(id, from);
    const part = from ? this.#narrowing.get(from) : undefined;
    const answer = part && from ? this.reading(from, part.field) : undefined;
    this.#take(scope, [...ids]);
    // The chart lets go of it: the View narrows every component now.
    if (part && answer && from && ids.includes(part.field)) {
      this.write(from, part.field, undefined);
      this.select(part.field, answer.picked ?? [], answer);
      this.commit();
      this.#binding.drawBars(scope);
    }
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
    const { sort, group, page, pageSize, sortSuspended } = this.#state;
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
