/**
 * data-source.ts — one place that owns how records are being VIEWED.
 *
 * It composes its parts: source-reads (the rows, the page, each ask), source-walk
 * (the counts), source-view (what each control is drawn), source-binding,
 * field-catalogue and its QueryContext. TRAP T-one-comparator-one-source
 * TRAP T-view-state-lives-in-one-object
 *
 * Map:
 * - DataSource — ONE owner of how records are viewed: the query, scopes, groups, and binds
 * - .store — the records it reads; a write goes here, a view never does
 * - .timeField — The field holding each record's TIME, or undefined when the store has none.
 * - .state — The current view state.
 * - .has — Does this source have the field: declared, in its store's domains or time, or seen in its rows?
 * - .query — The Query the rows are under. A copy.
 * - .atDefault — Would a Reset to default change nothing? Applies nothing.
 * - .answered — Is there anything a Reset would clear, in one scope or any?
 * - .appliedCount — How many fields filter, by their applied readings, in these scopes or all.
 * - .loaded — Has any load completed?
 * - .result — The whole of the last load's answer.
 * - .rows — The last load's rows, LIVE — state, query and result are copies
 * - .total — Matching rows before paging.
 * - .totalPages — Pages at the current size, at least 1.
 * - .highlightTest — What a hover lights, as a row test: asked by the page, kept nowhere.
 * - .pickedFor — A field's picks in force on one component: its own part's, else the View's.
 * - .presents — Is this scope a SLOT — does a chart draw a summary in it?
 * - .describe — One scope, whole: its filters and answers, what it may add, how it is arranged.
 * - .declareValues — every value a field can take, so each control offers the same list
 * - .declareOwn — A scope's own fields, as its page definition holds them: never dragged.
 * - .declarePresets — A scope's presets: the app's own named conditions, each a boolean chip.
 * - .declareUnused — declareUnused(scope, filters) — what a scope's bar draws after its own, that this page has no field for: the…
 * - .declareField — Declare a field's KIND and its reader-facing name.
 * - .declareFromRows — Each field here that its schema says nothing of takes it from the ROWS: a set, its unique values in order; a…
 * - .openOnFirst — Each FETCHING list opens on its first value, never on every row.
 * - .declareChildren — A tiered field's child values, from the rows the source holds: one pass.
 * - .readValues — Read these fields' values now, where they wait; the controls over them are drawn again.
 * - .fieldFacts — What `declareField` was told.
 * - .zonesOf — A number's zones, from the status field whose values are ranges of it, and that field.
 * - .whereOf — Readings in the plain form a definition or a View writes, by this source's field types.
 * - .readingsOf — The plain form as readings, by this source's field types.
 * - .filterDef — A field's filter, as every bar, panel and heading draws it.
 * - .addable — What a scope may still add, each noting where it lives now.
 * - .valuesFor — What `declareValues` was told, as the data holds it.
 * - .groups — THE GROUPS IN FORCE — each value, and how many rows carry it.
 * - .selection — one field's whole state, ready for any control to draw
 * - .fieldStatus — What a field is now, seen from a scope: the one answer for every control.
 * - .selectedFields — Every field currently selected.
 * - .debugState — EVERYTHING THIS SOURCE THINKS IS TRUE, in one object.
 * - .remote — Do this source's loads reach outside the data layer?
 * - .applyOn — Once per act, or LIVE while a value moves — never live when remote. Fixed by the options.
 * - .load — Re-read and push to every bound component.
 * - .reach — Can its store be reached?
 * - .failure — Why the store could not be reached, while it cannot — its kind and message — else null.
 * - .recheck — Try the store again: `down`, a fresh read; `unreached`, a read behind the rows shown, with no loading; `ok`,…
 * - .close — Let the store go: a change no longer reloads it, and its held set is dropped.
 * - .results — Each answered chip's results: the rows that reach it and match its answer.
 * - .valueResults — Each picked value's own results: the rows that reach its field and match that one value.
 * - .limitOptions — Does each list field offer only the values the filters before it leave? Settable, unlike applyOn.
 * - .countEveryValue — Every value of a list field is counted, picked or not, on or off — where the rows are held: a store is never…
 * - .showAs — A reader's Show as pick is shown — off, kept and not shown.
 * - .axisChips — The Primary and Secondary chips are offered, and a reader's picks in them shown — off, kept and not shown.
 * - .present — Each list field's values its ruler leaves in a scope: the filters before it, or the View's subset.
 * - .offered — What each field below the top of a SERIAL set offers: the values the rows hold at its place.
 * - .attach — Take a component its binder has wired, and send it what is already loaded.
 * - .allRows — Every row a bound component is under, UNPAGED — what "Select all rows" ticks on a grid that holds one page.
 * - .unbind — Stop steering and stop populating this component.
 * - .boundElements — Every component currently bound.
 * - .reportPages — The grid's own page count, when every row is in hand: publish, load nothing.
 */
import { andFilter, DEFAULT_OP, filterRows, filterTest, readField, valueKey } from './store.js';
import { readingClause, ruleOut } from './filter-state.js';
import { FieldCatalogue } from './field-catalogue.js';
import { SourceBinding } from './source-binding.js';
import { presentUnder, type WalkFacts } from './source-counts.js';
import { SourceReads } from './source-reads.js';
import { SourceWalk } from './source-walk.js';
import { SourceView } from './source-view.js';
import {
  answerOf, arrangementOf, compile, eachScope, filterKey, freezeReading, highlightOf, readingAnswered, sameFilter,
  VIEW, withoutArrangement, type Arrangement, type CompileFacts, type Query, type QueryDefaults, type ScopeQuery,
} from './query.js';
import { definitionOf, keepOff } from './query-edits.js';
import type { FieldStatus } from './field-status.js';
import { QueryContext, type QueryChange, type QueryHandle, type QueryPart } from './query-context.js';
import { readingsOf, whereOf, type Where } from './where.js';
import { report } from './report.js';
import type { Failure } from './failure.js';
import type { FieldReading, FilterState } from './filter-state.js';
import type { Filter, GroupSummary, LoadResult, Row, Store } from './store.js';
import type {
  AttachFacts, BindSink, BoundControl, DataSourceOptions, FieldDeclaration, FieldFilter,
  FilterSet, ScopeDescription, ViewState,
} from './data-source-types.js';
export type {
  AttachFacts, BindSink, BoundControl, BoundView, DataChangeDetail, DataSourceOptions, FieldDeclaration, FieldFilter,
  FilterSet, HeldFilter, OrganiseColumn, ScopeDescription, QueryState, ViewState,
} from './data-source-types.js';

export class DataSource extends EventTarget {
  readonly store: Store;
  /** The fields a search matches, or every field. */
  readonly #searchFields: string[] | undefined;
  /** It reads only the page's fields. TRAP T-a-held-set-reads-the-pages-fields */
  readonly #pageFields: boolean;
  /** Every bound component, how it is bound, and what it is pushed and drawn. */
  readonly #binding: SourceBinding = new SourceBinding({
    describe: (s) => this.describe(s),
    scopeLabel: (s) => this.#context.scopeLabel(s),
    partScopes: () => this.#narrowing.keys(),
    partsIn: (s) => this.#view.partsIn(s),
    view: () => this.#view.boundView(),
    rows: (w) => (w === 'all' ? this.#reads.unpaged : this.#reads.rows),
    freeRows: (fields) => this.#reads.freeRows(fields),
    pickedFor: (el, field) => this.pickedFor(el, field),
    only: (id) => this.#only[id],
    scoped: (s) => this.#scoped[s],
    now: () => this.#now(),
    mintId: () => this.#member.mintId(),
  });
  /** Its rows: the store or its held set, the page, each ask and its answer. */
  readonly #reads: SourceReads;
  /** Its counts: one walk per Query, and what each control is drawn of it. */
  readonly #walk: SourceWalk;
  /** What each control is drawn: each scope, field and reading. */
  readonly #view: SourceView;
  /** Load on the first bind, rather than waiting to be asked. */
  readonly #autoLoad: boolean;
  /** The Query and the page's declarations are its context's. 366 step 12 */
  readonly #context: QueryContext;
  /** What it holds of the context: the live Query, its ids, its fellow members. */
  readonly #member: QueryHandle;
  /* Read and written through these, so each method reads as it did. QueryLive says what each is.
     The filter is compiled from the Query, never kept beside it. TRAP T-one-query-one-owner */
  get #applied(): Query { return this.#member.live().applied; }
  get #draft(): Query { return this.#member.live().draft; }
  get #defaults(): Map<string, ScopeQuery> { return this.#member.live().defaults; }
  get #sets(): Map<string, FilterSet[]> { return this.#member.live().sets; }
  get #offers(): Map<string, string[]> { return this.#member.live().offers; }
  get #narrowing(): Map<string, QueryPart> { return this.#member.live().parts; }
  /** The last compile, so a load does not redo it. Written by `#compileNow`. */
  #filter: Filter | undefined;
  /** What a component OUTSIDE every component scope is under — the View alone.
   *  TRAP T-only-the-view-trickles-down */
  #viewFilter: Filter | undefined;
  /** Each component scope's own answer — for a summary bound INTO that scope. */
  #scoped: Record<string, Filter> = {};
  /** What `compile` narrows each bound component by, alone — by bind id. */
  #only: Record<string, Filter> = {};
  /** What each field IS: its kind, label and values. TRAP T-the-field-type-decides-the-clause */
  readonly #catalogue = new FieldCatalogue();
  /** The clock its relative dates read. */
  readonly #now: () => Date;
  /** Was a clock named? Then each read says which. */
  readonly #pinned: boolean;
  /** The most rows a remote store's held set holds. */
  readonly #holdRows: number;

  constructor(options: DataSourceOptions) {
    super();
    this.store = options.store;
    // Will's target: 100k rows in the browser. D3
    this.#holdRows = options.holdRows ?? 100_000;
    this.#pageFields = options.pageFields ?? false;
    this.#autoLoad = options.autoLoad ?? true;
    this.#applyOn = options.applyOn ?? 'change';
    this.#now = options.now ?? ((): Date => new Date());
    this.#pinned = !!options.now;
    this.#searchFields = options.searchFields;
    this.#context = options.query ?? new QueryContext();
    this.#reads = new SourceReads({
      store: this.store, holdRows: this.#holdRows, now: this.#now, pinned: this.#pinned,
      pageSize: options.pageSize ?? null, searchFields: this.#searchFields, debounce: options.debounce ?? 300,
    }, {
      filter: () => this.#filter,
      viewFilter: () => this.#viewFilter,
      scoped: () => this.#scoped,
      arrangement: () => this.#arrangement(),
      wantsAllRows: () => this.#binding.wantsAllRows(),
      freeSets: () => this.#binding.freeSets(),
      need: () => this.#need(),
      beforeLoad: async (still) => {
        if (!this.#reads.cheap) return 'none';
        const walked = this.#walk.key();
        const walk = await this.#walk.walked();
        if (!still()) return 'overtaken';
        // A walk something else moved past sets nothing aside: the walk after the load decides.
        if (this.#walk.key() === walked && this.#walk.takeAside(walk)) this.#compileNow();
        return 'walked';
      },
      // Its rows say which fields it has: one it lacks leaves the filter. TRAP T-a-source-compiles-only-what-it-has
      landed: (rows) => {
        if (this.#context.members > 1 && this.#saw(rows) && this.#lacksAny()) queueMicrotask(() => this.#recompose());
      },
      publish: () => this.#binding.publish(),
      published: () => void this.#walk.rewalk(),
      emit: (event) => this.dispatchEvent(event),
      storeMoved: (moved) => this.#walk.storeMoved(moved),
      refreshed: () => {
        // The keys a server field matched are of the set let go: they are asked again. TODO 612
        if (!this.#fetchedKeys.size) return;
        this.#fetchedKeys.clear();
        this.#fetching.clear();
        this.#compileNow();
      },
    });
    this.#walk = new SourceWalk({
      keyOf: () => {
        const parts = [...this.#narrowing].map(([s, p]) => [s, p.field, this.#hostOf(p.only)]);
        return [this.#day(), this.#reads.age, this.#member.walkVersion(), withoutArrangement(this.#applied),
          [...this.#binding.componentScopes()].sort(), [...this.#defaults.keys()].sort(), parts, [...this.#offers]];
      },
      applied: () => this.#applied,
      facts: () => this.#walkFacts(),
      rows: () => this.#reads.walkRows(),
      reader: () => this.#reads.reader,
      closed: () => this.#reads.closed,
      letGo: (scope, field, keys) => this.#context.ask({ scope, field, letGo: keys }),
      asideMoved: () => {
        const { still, same } = this.#compileNow();
        this.#view.syncPending();
        if (same || (still && !this.remote)) return false;
        this.#reads.requery(this.applyOn === 'input');
        return true;
      },
      drawn: () => [...this.#binding.entries()].flatMap(([el, b]) => (
        (el.drawResults || el.drawValueResults || el.drawPresent || el.drawOffered) && b.scope
          ? [{ control: el, id: b.id, bar: typeof b.scope === 'string', scopes: typeof b.scope === 'string' ? [b.scope] : [...b.scope, ...this.#narrowing.keys()] }]
          : [])),
      parts: () => [...this.#narrowing].map(([p, part]) => [p, part.shownIn]),
      partsIn: (scope) => this.#view.partsIn(scope),
      filtering: (scope) => this.#filtering([scope]) > 0,
      emit: (event) => this.dispatchEvent(event),
    }, { limitOptions: options.limitOptions ?? false });
    this.#view = new SourceView({
      context: this.#context,
      catalogue: this.#catalogue,
      binding: this.#binding,
      draft: () => this.#draft,
      applied: () => this.#applied,
      parts: () => this.#narrowing,
      offers: () => this.#offers,
      sets: (scope) => this.#sets.get(scope) ?? [],
      arrangement: () => this.#arrangement(),
      filter: () => this.#filter,
      fetchedField: (clause) => [...this.#fetchedKeys].find(([, got]) => got.clause === clause)?.[0],
      paging: () => ({ ...this.#reads.page, totalPages: this.#reads.totalPages }),
      searchFields: this.#searchFields,
      unread: (field) => this.#unread.has(field),
      failed: () => this.#failed,
    });
    // REMOTE: the reader edits a copy, and Apply sends it — the context splits it.
    this.#member = this.#context.join({
      remote: this.#reads.remote, pagedIn: (scope) => this.#binding.pagedIn(scope), bindOf: (el) => this.#binding.get(el),
      presentsIn: (scope) => this.#binding.presentsIn(scope),
      // A page, or its size, is asked of the Query: it says which source draws it.
      page: (at) => ('page' in at ? this.#reads.setPage(at.page) : this.#reads.setPageSize(at.pageSize)),
      heard: (change) => this.#hear(change),
      has: (field) => this.#catalogue.has(field),
      carriesOver: (field) => this.#catalogue.carriesOver(field),
      readingsOf: (where) => this.readingsOf(where),
      raws: (field, picked) => {
        const declared = this.#catalogue.byKey(field);
        return picked.map((v) => declared.get(valueKey(v)) ?? v);
      },
      ruledOut: (scope, field) => {
        const walk = this.#walk.last;
        return walk ? ruleOut(walk.present[scope]?.[field] ?? null, walk.offered[scope]?.[field] ?? null) : undefined;
      },
    });
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
    return this.#reads.state;
  }

  /** How the rows are arranged: the Query's, in the ONE scope of this source's
   *  that arranges. TRAP T-group-and-sort-are-component-scope */
  #arrangement(): Arrangement {
    return arrangementOf(this.#applied, this.#mine);
  }

  /** Is a scope this source's — no OTHER source draws a page in it? With one
   *  source, every scope is. 366 step 25 · TRAP T-a-source-compiles-only-what-it-has */
  #mine = (scope: string): boolean => !this.#member.pagedIn(scope) || this.#binding.pagedIn(scope);

  /** Does this source have the field — declared, its values declared, in its
   *  store's contract, its time, or in a row it loaded? Alone on its Query, or
   *  before it knows any field, yes: only another source's field is skipped. */
  #has = (field: string): boolean => this.#context.members < 2
    || this.has(field) || (!this.#seen.size && !this.#catalogue.knowsAny());

  /** Does this source have the field: declared, in its store's domains or time,
   *  or seen in its rows? TODO 453 */
  has(field: string): boolean {
    return this.#catalogue.knows(field) || !!this.store.domains?.[field] || this.store.time === field || this.#seen.has(field);
  }

  /** The fields its loaded rows hold, from the first rows of each load. */
  #seen = new Set<string>();

  /** Note the fields these rows hold; did it learn one? */
  #saw(rows: readonly Row[]): boolean {
    const was = this.#seen.size;
    for (const row of rows.slice(0, 20)) for (const field of Object.keys(row)) this.#seen.add(field);
    return this.#seen.size > was;
  }

  /** Does the applied Query answer a field this source lacks? */
  #lacksAny(): boolean {
    return Object.entries(this.#applied.scopes)
      .some(([id, s]) => (id === VIEW || this.#mine(id)) && Object.keys(s.readings).some((f) => !this.#has(f)));
  }

  /** What the last compile left out: another source's scope, or a field this one lacks. */
  #skipped: string[] = [];

  /** Its QueryContext: `query.applied` is the Query the rows are under, and
   *  `query.draft` what the reader is editing — a copy each. TRAP T-one-query-one-owner */
  get query(): QueryContext {
    return this.#context;
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
      const { sort, group, search } = arrangementOf(q, this.#mine);
      return JSON.stringify([sort, group, search]);
    };
    return arranged(at) === arranged(this.#applied);
  }

  /** Is there anything a Reset would clear — in one scope, these, or any: a
   *  reading that filters, or the rows arranged there? TODO 231 */
  answered(scope?: string | readonly string[]): boolean {
    const ids = scope == null ? Object.keys(this.#applied.scopes) : typeof scope === 'string' ? [scope] : scope;
    // An arrangement is its own scope's to reset, never another's. TODO 518
    const { sort, group, scope: arrangedAt } = this.#arrangement();
    if ((sort.length || group) && (scope == null || (arrangedAt != null && ids.includes(arrangedAt)))) return true;
    return this.#filtering(ids) > 0;
  }

  /** How many fields FILTER, by their applied readings, in these scopes — and
   *  every chart's own, with `parts` — or in every scope. Will, TODO 436 */
  appliedCount(scopes?: readonly string[], parts = false): number {
    return this.#filtering(scopes ? [...scopes, ...(parts ? this.#narrowing.keys() : [])] : Object.keys(this.#applied.scopes));
  }

  /** How many applied readings in these scopes filter: the one test both ask. */
  #filtering(ids: Iterable<string>): number {
    const facts = this.#compileFacts();
    let n = 0;
    for (const id of new Set(ids)) {
      const at = this.#applied.scopes[id];
      if (at) n += Object.entries(at.readings).filter(([field, reading]) => !!readingClause({ field, ...facts.field?.(field) }, reading)).length;
    }
    return n;
  }

  /** Has any load completed? Before one, there is nothing to count or group. */
  get loaded(): boolean {
    return this.#reads.loaded;
  }

  /** The whole of the last load's answer. A shallow copy: its `rows` is the live array. TRAP T-result-is-the-hosts-half */
  get result(): LoadResult {
    return this.#reads.result;
  }

  /** The last load's rows — one page when paged. LIVE, not a copy: read it, never change it. */
  get rows(): readonly Row[] {
    return this.#reads.rows;
  }

  /** Matching rows before paging. */
  get total(): number {
    return this.#reads.result.total;
  }

  /** Pages at the current size, at least 1. GROUPED, it is what the grid reported.
   *  TRAP T-grouped-paging-belongs-to-the-view */
  get totalPages(): number {
    return this.#reads.totalPages;
  }

  /* ── Steering ──────────────────────────────────────────────────────── */

  /** What a hover lights, as a row test: one value of a scope's field, or the whole
   *  reading it holds. Asked by the page, once per hover, and kept nowhere: the
   *  highlight is the page's. Null where this source lacks the field. Will, TODO 655 */
  highlightTest(hovered: { scope: string; field: string; value?: string }): ((row: Row) => boolean) | null {
    const filter = highlightOf(this.#applied, hovered, this.#compileFacts());
    return filter ? filterTest(filter, this.#now()) : null;
  }

  /** A field's picks in force on one component, as value keys: its own part's,
   *  else the View's — applied, not drafted. TRAP T-a-chart-is-free-of-its-own-field */
  pickedFor(el: BoundControl, field: string): string[] {
    return this.#view.pickedFor(el, field);
  }

  /** Is this scope a SLOT — does a chart draw a summary in it? Its Group and Sort are
   *  then its presentation's, never the rows'. Will, TODO 548 */
  presents(scope: string): boolean {
    return this.#binding.presentsIn(scope);
  }

  /** One scope as a control draws it WHOLE. TRAP T-a-panel-asks-for-its-scopes */
  describe(scope: string): ScopeDescription {
    return this.#view.describe(scope);
  }

  /* ── Selection, by FIELD ───────────────────────────────────────────── */

  /**
   * Declare every value a field can take, so a control drawing its rows offers
   * the same list wherever it appears — and the same STRINGS, which is what
   * lets two controls share one selection.
   */
  declareValues(field: string, values: readonly unknown[]): void {
    this.#reads.aged();
    this.#catalogue.declareValues(field, values);
    this.#recomposeFor([field]);
  }

  /** A scope's own fields, as its page definition holds them: they keep their
   *  place — a reader drags only what was added. Will, TODO 452 */
  declareOwn(scope: string, fields: readonly string[]): void {
    this.#view.declareOwn(scope, fields);
  }

  /** A scope's PRESETS: the app's own named conditions, each a boolean chip — on,
   *  its rows are written into the fields'. Kept by the Query. Will, TODOs 493, 510
   *  TRAP T-a-preset-is-its-own-part */
  declarePresets(scope: string, presets: readonly { id: string; label: string; readings: Readonly<Record<string, FieldReading>> }[]): void {
    this.#context.declarePresets(scope, presets);
  }

  /** declareUnused(scope, filters) — what a scope's bar draws after its own, that
   *  this page has no field for: the App Context's. Never in the Query. True when
   *  it changed: a provider's bars are drawn by their provider. TODO 453 */
  declareUnused(scope: string, filters: readonly { id: string; label: string; icon?: string }[]): boolean {
    if (!this.#view.declareUnused(scope, filters)) return false;
    this.#binding.drawBars(scope);
    return true;
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
    this.#reads.aged();
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
  async declareFromRows(fields: readonly string[], options: { lazy?: boolean } = {}): Promise<void> {
    // A field whose values cannot be read says so, until they can. TODO 411
    await this.#catalogue.fromRows(fields, async (open) => {
      try {
        const found = await this.#readOpen(open, options);
        this.#setFailed(open, false);
        return found;
      } catch (error) {
        this.#setFailed(open, true);
        throw error;
      }
    });
    // Each field's facts moved: what was counted is out of date.
    this.#reads.aged();
    this.#recomposeFor(fields);
  }

  /** The values of the fields the catalogue has not got, from the store or the held set. */
  async #readOpen(open: readonly string[], options: { lazy?: boolean }): Promise<Record<string, unknown[]>> {
    await this.#reads.hold();
    const reads = this.#reads.reader;
    const distinct = reads.distinct?.bind(reads);
    /* A remote store whose rows are not held here is asked a field's values when
       the field is needed — at open, what the page holds and answers; the rest later.
       345 phase 5 · TRAP T-a-field-reads-its-values-when-needed */
    if (distinct && options.lazy && this.remote && !this.#reads.scans) {
      const asked = open.filter((f) => this.#needs(f));
      for (const f of open) if (!asked.includes(f)) this.#unread.add(f);
      return asked.length ? distinct(asked, {}) : {};
    }
    if (distinct) return distinct(open, {});
    const rows = await this.#reads.loadAll();
    return Object.fromEntries(open.map((f) => [f, rows.map((r) => readField(r, f))]));
  }

  /** Fields whose OWN read failed — their values, or the keys a server field
   *  asks — until one succeeds. Pushed as `data-failed`. TODO 411 */
  #failed = new Set<string>();

  /** Mark fields failed, or read again; the controls are told when it moved. */
  #setFailed(fields: readonly string[], failed: boolean): void {
    const moved = fields.filter((f) => failed !== this.#failed.has(f));
    for (const f of moved) {
      if (failed) this.#failed.add(f);
      else this.#failed.delete(f);
    }
    if (moved.length) this.#view.syncPending();
  }

  /**
   * Each FETCHING list opens on its first value, never on every row: a list the
   * View holds, or any on a remote source, with no answer. The first a row holds
   * under the starts before it, so a chain never opens empty. `start: 'all'`
   * opens on EVERY value ticked: on, and no filter. Will, TODOs 403, 489
   * TRAP T-a-fetching-list-opens-on-its-first-value
   */
  async openOnFirst(): Promise<void> {
    for (const scope of this.query.scopes) {
      if (scope !== VIEW && !this.remote) continue;
      const before: Filter[] = [];
      for (const field of this.query.scope(scope)) {
        const facts = this.#catalogue.get(field);
        if (!facts || facts.type === 'number' || facts.type === 'date' || facts.advanced === 'only' || this.#catalogue.unlisted(field)) continue;
        const known = { field, ...this.#catalogue.facts(field) };
        const had = this.query.applied.scopes[scope]?.readings[field];
        const answer = had && readingAnswered(had) ? had : undefined;
        // ALL: every value it has, ticked, whichever come — no filter, and nothing to read. TRAP T-all-is-an-answer
        if (!answer && facts.select !== 'single' && facts.start === 'all') {
          this.query.startWith(scope, field, { picked: [], all: true });
          continue;
        }
        if (!answer && facts.select !== 'single') {
          // The first field's values are read already; one after a start asks what is left.
          let found: string[] | null = null;
          if (before.length || !known.values?.length) {
            // A store that fails here fails the first load too, which says so: no start.
            try {
              await this.#reads.hold();
              found = (await presentUnder(this.#reads.reader, [field], andFilter(before)))[field] ?? [];
            } catch {
              return;
            }
          }
          const first = found ? (known.values ?? []).find((v) => found.includes(valueKey(v))) ?? found[0] : known.values![0];
          if (first == null) continue;
          const start = { picked: [first] };
          this.query.startWith(scope, field, start);
          const clause = readingClause(known, start);
          if (clause) before.push(clause);
          continue;
        }
        const clause = answer && !answer.suspended ? readingClause(known, answer) : undefined;
        if (clause) before.push(clause);
      }
    }
  }

  /** A tiered field's child values, from the rows the walk reads — one read for
   *  both. A store it does not hold reads a parent's children later, as it opens. TODO 369 */
  async declareChildren(field: string): Promise<void> {
    const child = this.#catalogue.get(field)?.child;
    if (!child) return;
    const rows = await this.#reads.walkRows();
    if (!rows) return;
    this.#catalogue.declareChildren(field, rows.map((r) => [readField(r, field), readField(r, child)] as const));
    this.#reads.aged();
  }

  /**
   * readValues(fields) — read these fields' values now, where they wait: one
   * read for every field asked in a turn. The controls over them are drawn
   * again when they land. A no-op for a field already read.
   * TRAP T-a-field-reads-its-values-when-needed
   */
  readValues(fields: Iterable<string>): void {
    for (const f of fields) if (this.#unread.has(f)) this.#wanted.add(f);
    if (!this.#wanted.size || this.#wantSoon) return;
    this.#wantSoon = true;
    queueMicrotask(() => {
      this.#wantSoon = false;
      void this.#readWanted();
    });
  }

  /** The fields asked for, read; then every control over them drawn again. */
  async #readWanted(): Promise<void> {
    const fields = [...this.#wanted];
    this.#wanted.clear();
    if (!fields.length || this.#reads.closed) return;
    await this.declareFromRows(fields);
    for (const f of fields) this.#unread.delete(f);
    for (const scope of new Set(fields.flatMap((f) => this.#context.scopes.filter((id) => this.#context.scope(id).includes(f))))) {
      this.#binding.drawBars(scope);
    }
    this.#binding.drawScopesSoon();
    // A grid's headings are given their filters with its rows.
    this.#binding.publish();
  }

  /** Does the page need this field's values now: held in a scope, or answered? */
  #needs(field: string): boolean {
    return this.#context.scopeOf(field) != null || Object.values(this.#draft.scopes).some((s) => field in s.readings);
  }

  /** Fields whose values wait to be read: a remote store not held. */
  #unread = new Set<string>();
  /** Fields asked for since the last read began. */
  #wanted = new Set<string>();
  /** A read is due at the end of this turn. */
  #wantSoon = false;

  /** What `declareField` was told. */
  fieldFacts(field: string): FieldDeclaration {
    return this.#catalogue.copyOf(field);
  }

  /** A number's zones, from the status field whose values are ranges of it, and that
   *  field: a gauge draws them, and its legend picks that field. Plan 683 S3 */
  zonesOf(field: string): ReturnType<FieldCatalogue['zonesOf']> {
    return this.#catalogue.zonesOf(field);
  }

  /** Readings in the plain form a definition or a View writes, by this source's
   *  field types. TRAP T-one-way-to-write-a-condition */
  whereOf(readings: Readonly<Record<string, FieldReading>>): Where {
    return whereOf(readings, (f) => this.#catalogue.facts(f));
  }

  /** The plain form as readings, by this source's field types. */
  readingsOf(where: Readonly<Where>): Record<string, FieldReading> {
    return readingsOf(where, (f) => this.#catalogue.facts(f));
  }

  /** A field's filter, as any bar or panel draws it — ONE definition.
   *  TRAP T-a-field-is-declared-once */
  filterDef(field: string): FieldFilter {
    return this.#view.filterDef(field);
  }

  /** What a scope may still ADD, each saying where it lives now.
   *  TRAP T-a-bar-offers-only-what-its-scope-holds */
  addable(scope: string, taken?: Iterable<string>): FieldFilter[] {
    return this.#view.addable(scope, taken);
  }

  /** What `declareValues` was told, as the data holds it. */
  valuesFor(field: string): unknown[] {
    return this.#catalogue.valuesFor(field);
  }

  /** THE GROUPS IN FORCE — each value, and how many rows carry it.
   *  TRAP T-a-group-is-a-data-layer-concept */
  groups(field?: string): GroupSummary[] {
    return this.#reads.groups(field);
  }

  /** One field's whole state — picked, unpicked, the condition — ready for any control to draw. */
  selection(field: string, label?: string): FilterState {
    return this.#view.selection(field, label);
  }

  /** What a field is now, seen from a scope: the one answer for every control. TRAP T-one-field-one-status */
  fieldStatus(field: string, scope: string = VIEW): FieldStatus {
    return this.#view.fieldStatus(field, scope);
  }

  /** Every field currently selected. */
  get selectedFields(): string[] {
    return Object.values(this.#draft.scopes).flatMap((s) => Object.keys(s.readings));
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
    const { plan, held } = this.#reads.debug();
    const { page, pageSize } = this.#reads.page;
    const { sort, group, search } = this.#arrangement();
    return {
      rows: this.#reads.rows.length,
      total: this.total,
      page,
      pageSize,
      totalPages: this.totalPages,
      sort,
      group,
      search,
      filter: this.#filter,
      // The readings and holds the filter is compiled from. TRAP T-one-query-one-owner
      query: structuredClone(this.#applied),
      // …and what the reader is editing, where it differs. TRAP T-apply-and-discard-wait-for-a-change
      ...(this.#context.waiting() ? { draft: structuredClone(this.#draft), dirty: this.#context.dirty() } : {}),
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
      // What it left out: another source's scope, or `scope.field` for a field it lacks.
      skipped: [...this.#skipped],
      loaded: this.loaded,
      // How it answers, and whether its store can be reached. TRAP T-a-read-is-planned
      plan,
      reach: this.reach,
      // The picks the filters before them rule out, by scope. TRAP T-one-walk-counts-and-limits-in-order
      aside: Object.fromEntries(this.#walk.aside),
      ...(held ? { held } : {}),
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
    this.#view.syncPending();
    if (!same) this.#reads.requery(this.applyOn === 'input');
    /* The rows did not move, so no load will count again — yet an answer that
       is OFF, or one chart's own, changed, and its badge wears a number.
       TRAP T-a-chip-counts-within-the-filters-before-it */
    if (still && this.loaded) this.#walk.soon();
  }

  /** Every reading the Query keeps, in both copies, frozen: what a control is
   *  handed cannot change it. TRAP T-a-reading-is-frozen-in-the-query */
  #freezeReadings(): void {
    for (const query of new Set([this.#draft, this.#applied])) {
      for (const scope of Object.values(query.scopes)) for (const r of Object.values(scope.readings)) freezeReading(r);
    }
  }

  /** Compile the applied Query. Says whether the SHARED filter
   *  stood still, and — where a scope waits — whether nothing a load reads moved. */
  #compileNow(): { still: boolean; same: boolean } {
    const { filter, view, scoped, only, skipped } = compile(this.#applied, this.#compileFacts());
    this.#skipped = skipped ?? [];
    // The SHARED filter stood still: no load follows, whatever one component's own did.
    const still = sameFilter(filter, this.#filter);
    // A draft edit loads nothing: remote, or a scope that waits. TODO 406
    const same = this.#context.waiting() && still && sameFilter(only, this.#only);
    this.#only = only;
    this.#filter = filter;
    this.#viewFilter = view;
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
      drop: (scope, field) => this.#walk.aside.get(scope)?.[field],
      mine: this.#mine,
      has: this.#has,
      fetched: this.#fetched,
    };
  }

  /** A field the STORE answers: its answer as the keys it matched — asked once per
   *  answer, so its toggle and a Switch stay client updates. Until they come, its
   *  clause as it reads. 345 phase 6 · TRAP T-a-server-field-is-asked-once-per-answer */
  #fetched = (field: string, reading: FieldReading): Filter | undefined => {
    const key = this.store.key;
    if (this.#catalogue.get(field)?.fetch !== 'server' || !key) return undefined;
    const { suspended: _off, ...on } = answerOf(reading);
    // Every value ticked asks nothing: it is no filter. TODO 489
    if (!readingClause({ field, ...this.#catalogue.facts(field) }, on)) return undefined;
    const answer = JSON.stringify(on);
    const got = this.#fetchedKeys.get(field);
    if (got?.answer === answer) return got.clause;
    if (this.#fetching.get(field) !== answer) void this.#fetchKeys(field, on, answer);
    return undefined;
  };

  /** Ask the store which keys one field's answer matches, then compile again. */
  async #fetchKeys(field: string, reading: FieldReading, answer: string): Promise<void> {
    this.#fetching.set(field, answer);
    const clause = readingClause({ field, ...this.#catalogue.facts(field) }, reading);
    try {
      // The KEYS alone, where the store can send just them. 345 phase 7
      const projected = this.store.capabilities.projects ? { fields: [this.store.key] } : {};
      const { rows } = await this.store.load({ ...(clause ? { filter: clause } : {}), ...projected, ...(this.#pinned ? { now: this.#now() } : {}) });
      if (this.#fetching.get(field) !== answer || this.#reads.closed) return;
      this.#fetchedKeys.set(field, { answer, clause: [this.store.key!, 'in', rows.map((row) => readField(row, this.store.key!))] });
      this.#setFailed([field], false);
    } catch (error) {
      this.#setFailed([field], true);
      report({
        code: 'fetch-field-failed',
        message: 'A field the store answers could not be asked; it filters by the rows held until it can.',
        at: { field, error: error instanceof Error ? error.message : String(error) },
      });
      return;
    } finally {
      if (this.#fetching.get(field) === answer) this.#fetching.delete(field);
    }
    this.#recompose();
  }

  /** Each server field's last answer, and its clause: the keys it matched. */
  #fetchedKeys = new Map<string, { answer: string; clause: Filter }>();
  /** Each server field's answer being asked now. */
  #fetching = new Map<string, string>();

  /* ── Draft and applied — a REMOTE source only ─────────────────────────
   * TRAP T-apply-and-discard-wait-for-a-change */

  /** Do this source's loads reach outside the data layer? */
  get remote(): boolean {
    return this.#reads.remote;
  }

  /** When a filter applies: once per act, or LIVE while its value moves — never
   *  live for a remote source. Fixed by the options; `bindSource` writes it on
   *  each control once. Will, TODO 107 */
  get applyOn(): 'change' | 'input' {
    return this.remote ? 'change' : this.#applyOn;
  }
  /** When a filter applies, as the app asked. */
  readonly #applyOn: 'change' | 'input';

  /** What its context did: today's follow-ups, in today's order. 366 steps 14-15 */
  #hear(change: QueryChange): void | Promise<void> {
    switch (change.kind) {
      case 'offer':
        // What its menus may add moved: the walk tallies it.
        if (this.loaded) this.#walk.soon();
        return;
      case 'part':
      case 'sets':
        this.#reads.aged();
        // A legend declared after the last load is told what the View leaves it; a
        // set's order is the order every chip counts in.
        if (this.loaded) this.#walk.soon();
        // Sent up, the View holds its field — and draws only a field it knows.
        if (change.kind === 'part' && change.field && !this.#catalogue.has(change.field)) this.declareField(change.field);
        this.#binding.drawScopesSoon();
        // …and its own section, which names the chart it narrows: Show as swaps it. TODO 548
        if (change.kind === 'part' && change.field) this.#binding.drawBars(change.scope);
        // …and the bar it left: its chip goes. TODO 670
        if (change.kind === 'part' && change.left) this.#binding.drawBars(change.left);
        return;
      case 'write':
        this.#recompose();
        // The shared filter did not move, so no load will push it: push it here.
        this.#binding.pushTo(change.narrows);
        // A panel shows a part too, and is told as a bar is. TRAP T-one-query-one-owner
        if (this.#narrowing.has(change.scope)) {
          const drawn = structuredClone(this.#draft.scopes[change.scope]?.readings[change.field] ?? { picked: [] });
          this.#binding.drawPanelReading(change.field, drawn, change.scope);
        }
        return;
      case 'select':
        // The requery first, so a listener sees the state the rows were fetched for.
        this.#recompose();
        this.#view.draw(change.field);
        this.readValues([change.field]);
        // A preset reads its on from this field: its chip is drawn again. TODO 510
        for (const scope of this.#context.presetsOver(change.field)) this.#binding.drawBars(scope);
        return;
      case 'hold':
        // A field just held needs its values. 345 phase 5
        this.readValues(this.#context.scope(change.scope));
        if (change.moved.length) this.#recompose();
        for (const field of change.moved) this.#view.draw(field);
        if (change.scope === VIEW) this.#view.syncHeld();
        this.#binding.drawBarsBehind(change.scope);
        this.#binding.drawScopesSoon();
        return;
      case 'move':
        if (change.moved) this.#recompose();
        return;
      case 'recompose':
        this.#recompose();
        return;
      case 'preset':
        this.#recompose();
        this.#binding.drawBars(change.scope);
        this.#binding.drawScopesSoon();
        return;
      case 'order':
        // No row moves, but each count is counted in this order. TODO 452
        if (this.loaded) this.#walk.soon();
        this.#binding.drawBarsBehind(change.scope);
        this.#binding.drawScopesSoon();
        return;
      case 'commit':
        this.#recompose();
        // The headings show what is APPLIED.
        this.#view.syncHeld();
        return;
      case 'drawn':
        for (const field of change.fields) this.#view.draw(field);
        if (change.bars) this.#binding.drawBars(change.bars);
        if (change.pending) this.#view.syncPending();
        return;
      case 'bars':
        this.#binding.drawBars(change.scope);
        return;
      case 'presented':
        // A slot's presentation moved: its bar is told its Group and Sort, and draws its Primary and Secondary. TODO 548
        this.#binding.tellView(change.scope);
        this.#binding.drawBars(change.scope);
        return;
      case 'arranged':
        // The old count was measured against the OLD grouping. Drop it and wait for
        // the next draw. TRAP T-grouped-paging-belongs-to-the-view
        if (change.group) this.#reads.regroup();
        // Every re-ordering returns to page 1.
        this.#reads.requery();
        return;
      case 'query':
        // What the Query holds and answers needs its values. 345 phase 5
        this.readValues(this.#context.scopes.flatMap((id) => this.#context.scope(id)));
        this.readValues(Object.values(this.#draft.scopes).flatMap((s) => Object.keys(s.readings)));
        return this.#heardQuery(change.was, change.before);
    }
  }

  /** A whole Query came in: each bound control over a scope is DRAWN its slice;
   *  nothing replays a control. Settles once every control has drawn.
   *  TRAP T-a-reload-replays-the-readers-answers */
  async #heardQuery(was: Arrangement, before: readonly string[]): Promise<void> {
    const now = this.#arrangement();
    if (now.group !== was.group) this.#reads.regroup();
    this.#recompose();
    // Re-arranged, or searched: page one, and a load, whatever the filter did.
    const order = (a: Arrangement): string => JSON.stringify([a.sort, a.group, a.search]);
    if (order(now) !== order(was)) this.#reads.requery();
    for (const field of new Set([...before, ...this.selectedFields])) this.#view.draw(field);
    await this.#binding.drawEveryBar();
    // Drawn, never reported: the Query is already the answer.
    this.#view.syncHeld();
    this.#binding.drawScopesSoon();
  }

  /** A definition as a whole Query: definitionOf, over this source. */
  #definition(given: Query | QueryDefaults, keep: boolean, base: Query = this.#draft, copy = true): Query {
    return definitionOf(given, keep, base, {
      defaults: this.#defaults,
      starts: this.#member.live().starts,
      readingsOf: (where) => this.readingsOf(where),
      carriesOver: (f) => this.#catalogue.carriesOver(f),
    }, copy);
  }

  /* ── Loading ───────────────────────────────────────────────────────── */

  /** Re-read and push to every bound component. TRAP T-error-is-a-state-not-a-throw */
  load(options: { force?: boolean } = {}): Promise<LoadResult> {
    return this.#reads.load(options);
  }

  /** Can its store be reached? TRAP T-a-failed-read-keeps-the-last-set */
  get reach(): 'ok' | 'unreached' | 'down' {
    return this.#reads.reach;
  }

  /** Why the store could not be reached, while it cannot — its kind and message — else null. */
  get failure(): Failure | null {
    return this.#reads.failure;
  }

  /** Try the store again. TRAP T-a-remote-store-says-what-changed */
  recheck(): void {
    this.#reads.recheck();
  }

  /**
   * Let the store go: a change no longer reloads it. A page's source is closed
   * when the page goes, or every visit leaves one more listening.
   * TRAP T-a-closed-source-hears-nothing
   */
  close(): void {
    this.#reads.close();
    this.#member.leave();
  }

  /** The fields this page reads from a row, or null — every field: what its
   *  components show, every declared field and child, what the Query holds and
   *  answers, the sort, the group, the search and the time. TRAP T-a-held-set-reads-the-pages-fields */
  #need(): readonly string[] | null {
    const need = this.#pageFields ? this.#binding.fieldsRead() : null;
    const { sort, group, search } = this.#arrangement();
    // A search over every field reads every field.
    if (!need || (search && !this.#searchFields?.length)) return null;
    for (const [field, { child }] of this.#catalogue.declared()) {
      need.add(field);
      if (child) need.add(child);
    }
    for (const id of this.#context.scopes) for (const f of this.#context.scope(id)) need.add(f);
    for (const [, s] of eachScope(this.#applied)) for (const f of Object.keys(s.readings)) need.add(f);
    for (const s of Object.values(this.#draft.scopes)) for (const f of Object.keys(s.readings)) need.add(f);
    for (const { field } of sort) need.add(field);
    for (const f of [group, this.store.time, ...this.#searchFields ?? []]) if (f) need.add(f);
    return [...need].sort();
  }

  /** Each answered chip's RESULTS in a scope. TRAP T-a-chip-counts-within-the-filters-before-it */
  results(scope: string): Promise<Record<string, number>> {
    return this.#walk.results(scope);
  }

  /** Each PICKED value's own results in a scope. TRAP T-a-chip-counts-within-the-filters-before-it */
  valueResults(scope: string): Promise<Record<string, Record<string, number>>> {
    return this.#walk.valueResults(scope);
  }

  /* ── The WALK: one ordered pass per scope gives every count. TODOs 347–349 ──
   * TRAP T-one-walk-counts-and-limits-in-order */

  /** Today, as a relative date reads it. */
  #day(): string {
    return this.#now().toISOString().slice(0, 10);
  }

  /** The component scope a chart part's element is bound into, if any. */
  #hostOf(el: BoundControl): string | undefined {
    const scope = this.#member.bindOf(el)?.scope;
    return typeof scope === 'string' && scope !== VIEW ? scope : undefined;
  }

  /** What the walk's plan needs that the Query does not say. */
  #walkFacts(): Omit<WalkFacts, 'limit' | 'countAll'> {
    const narrowing = new Map([...this.#narrowing].map(([s, p]) => {
      const host = this.#hostOf(p.only);
      return [s, { field: p.field, ...(host ? { host } : {}) }] as const;
    }));
    return {
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
      now: this.#now(),
      fetched: this.#fetched,
      mine: this.#mine,
      has: this.#has,
      presets: (scope) => this.#context.presets(scope).filter((p) => this.#context.presetOn(scope, p.id, true)),
    };
  }

  /* ── What the filters BEFORE a field leave — Will, TODOs 174 and 349 ────
   * TRAP T-a-ruled-out-value-is-greyed */

  /** Does each list field offer only the values the filters before it leave? Settable at any time, unlike `applyOn`. */
  get limitOptions(): boolean {
    return this.#walk.limitOptions;
  }
  set limitOptions(on: boolean) {
    this.#walk.limitOptions = on;
  }

  /** Every value of a list field is counted, picked or not, on or off — where
   *  the rows are held: a store is never asked once per value. Will, TODO 466 */
  get countEveryValue(): boolean {
    return this.#walk.countEvery;
  }
  set countEveryValue(on: boolean) {
    this.#walk.countEvery = on;
  }

  /** A reader's Show as pick is shown — off, kept and not shown. The app's
   *  setting. Will, TODO 582 */
  get showAs(): boolean {
    return this.#context.honours('kind');
  }
  set showAs(on: boolean) {
    this.#context.honour('kind', on);
  }

  /** The Primary and Secondary chips are offered, and a reader's picks in them
   *  shown — off, kept and not shown. The app's setting. Will, TODO 583 */
  get axisChips(): boolean {
    return this.#context.honours('axes');
  }
  set axisChips(on: boolean) {
    if (on === this.axisChips) return;
    this.#context.honour('axes', on);
    void this.#binding.drawEveryBar();
  }

  /** Each list field's values its RULER leaves in a scope. TRAP T-a-ruled-out-value-is-greyed */
  present(scope: string): Promise<Record<string, string[]>> {
    return this.#walk.present(scope);
  }

  /** What each field below the top of a SERIAL set OFFERS. TRAP T-a-filter-set-groups-or-chains */
  offered(scope: string): Promise<Record<string, string[]>> {
    return this.#walk.offered(scope);
  }

  /* ── Binding ───────────────────────────────────────────────────────── */

  /** Take a component its binder has wired, and send it what is already
   *  loaded. `bindSource()` is the way in. TODO 196 */
  attach(el: BoundControl, facts: AttachFacts, sink: BindSink): void {
    const had = this.#binding.componentScopes();
    const scope = typeof facts.scope === 'string' ? facts.scope : undefined;
    const arranged = scope ? this.#context.arranges(scope) : false;
    const presents = scope ? this.#binding.presentsIn(scope) : false;
    const stacks = scope ? this.#binding.stacksIn(scope) : false;
    this.#binding.add(el, facts, sink);
    this.#rescope(had);
    /* A grid joined, so its scope arranges now — or a chart, so it is a slot, or
       one that stacks, so it takes a Secondary: its bars and panel draw Group and
       Sort. A legend may join before its chart. TODO 99, 548 */
    const changed = scope && ((!arranged && this.#context.arranges(scope)) || (!presents && this.#binding.presentsIn(scope))
      || (!stacks && this.#binding.stacksIn(scope)));
    if (scope && changed) {
      this.#binding.drawBars(scope);
      this.#binding.drawScopesSoon();
    }

    // Whatever is already loaded, so a component bound late is not blank.
    this.#binding.push(el);
    // …and whether its scope waits, and what in it does. TODO 406
    if (facts.scope && this.#context.waiting()) this.#view.syncPending();
    if (Array.isArray(facts.scope) && el.drawScopes) this.#binding.drawScopesSoon();
    /* …and what the View holds: one bound after the last word — a column's section
       drawn later — never heard it. Will, TODO 479 */
    if (typeof facts.scope === 'string' && facts.scope !== VIEW && el.supersede) this.#view.syncHeld();
    /* …and the answers the Query holds already — a fetching list's start — LAST:
       a bar told its scope waits rebuilds its chips. TODO 403 */
    if (facts.scope && el.drawReading) for (const field of this.selectedFields) this.#view.draw(field);
    // …and what the filters before each field leave. TRAP T-a-ruled-out-value-is-greyed
    // …and its chips' counts. TRAP T-a-chip-counts-within-the-filters-before-it
    if (facts.scope && (el.drawResults || el.drawValueResults || el.drawPresent || el.drawOffered) && this.loaded) this.#walk.soon();
    /* A summary bound AFTER the first load would otherwise draw blank: the
       unpaged set is fetched by `load`, and nothing would ask for it again.
       TRAP T-a-summary-binds-to-all-the-rows */
    const needsAll = facts.rows === 'all' && (!this.#reads.unpaged.length || (!!facts.free?.length && !this.#reads.hasFree(facts.free)));
    // It reads a field the held set lacks: asked again, and the column read. TRAP T-a-held-set-reads-the-pages-fields
    const lacks = !this.#reads.closed && !!this.#reads.rows.length && !!this.#reads.held?.lacks(this.#need());
    // Asked again, not fetched again: the rows did not change, so a held set stays.
    if (this.#autoLoad && (needsAll || lacks)) void this.#reads.reask();
    else if (this.#autoLoad && !this.#reads.rows.length) void this.load();
  }

  /** Every row a bound component is under, UNPAGED — what "Select all rows"
   *  ticks on a grid that holds one page. TODO 238 · TRAP T-select-all-is-the-visible-rows */
  async allRows(el?: BoundControl): Promise<readonly Row[]> {
    const rows = await this.#reads.every();
    const entry = el ? this.#binding.get(el) : undefined;
    const own = entry ? this.#only[entry.id] : undefined;
    return own ? filterRows(rows, own, this.#now()) : rows;
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

  /** The grid's own page count, when every matching row is already in hand:
   *  the pager's numbers publish again, and nothing loads. */
  reportPages(pages: number): void {
    this.#reads.reportPages(pages);
  }
}
