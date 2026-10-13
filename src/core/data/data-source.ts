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
 * - SourceState — A source's whole question as JSON: its applied Query, arrangement and saved filters.
 * - HeldFilter — One filter a scope holds, as a control draws it.
 * - ScopeShows — What a scope's filters narrow: the View, or the content one component shows.
 * - FilterSet — Fields a scope draws as ONE group.
 * - ScopeDescription — One scope as a control draws it whole, as JSON.
 * - ViewState — The view state a source owns.
 * - DataSourceOptions — the store, and the view it opens on: sort, group, page size, search fields
 * - AttachFacts — What the binder tells the source about one component.
 * - BoundView — What a bound component is told of the view; `undefined` is none.
 * - BindSink — Where the source sends one bound component's view, rows and pending fields.
 * - DataChangeDetail — What `change` carries, for a listener that wants the result without asking.
 * - VIEW_SCOPE — The scope ABOVE every component — the same word as `reach: 'view'`.
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
 * - .declarePart — Declare a PART: one field that narrows one component — a chart's legend field.
 * - .declareDefault — A component's OWN default filter — readings that narrow `only` it — as its scope in the Query.
 * - .reading — One scope's reading of one field, or undefined.
 * - .contributions — Every named part currently applied — the component-scope filters.
 * - .apply — Apply a whole control's READING of several fields, at one scope.
 * - .answer — ONE SCOPE'S WHOLE ANSWER — a bar's report.
 * - .declarePreset — A saved filter's readings, by id — the library a preset that is ON compiles from.
 * - .editPreset — EDIT a saved filter: what it applies now, while the library keeps what was saved.
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
 * - .declareScope — Name a scope as a reader sees it — a panel's section, an Add list's note.
 * - .declareSets — A scope's filter sets, in order.
 * - .sets — A scope's filter sets, as declared.
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
 * - .remote — Do this source's loads reach outside the data layer?
 * - .commit — SEND the draft — Apply, on a remote source.
 * - .discard — Put the applied answers back over the draft — Discard, on a remote source.
 * - .pending — Has this field been changed and not yet applied?
 * - .dirty — Has anything in this scope — or any scope — been changed and not applied?
 * - .setSearch — the search text, across searchFields
 * - .setPage — which page to show
 * - .setPageSize — rows per page, or null for all
 * - .load — Re-read and push to every bound component.
 * - .results — Each answered chip's results in a scope: the rows its own answer matches.
 * - .valueResults — Each PICKED value's own results in a scope: the rows that ONE value matches, within what the scope can see —…
 * - .limitOptions — Does each list field offer only the values the other answers leave?
 * - .present — Each list field's values the rows still HOLD under the OTHER answers in its scope — a component scope's withi…
 * - .offered — What each field below the top of a SERIAL set OFFERS: the values the rows hold under the answers above it, as…
 * - .attach — Take a component its binder has wired, and send it what is already loaded.
 * - .allRows — Every row a bound component is under, UNPAGED — what "Select all rows" ticks on a grid that holds one page.
 * - .unbind — Stop steering and stop populating this component.
 * - .boundElements — Every component currently bound.
 * - .answerScope — A scoped bar's whole answer: what it holds, each reading, its saved filters on or off. It is its Apply.
 * - .answerColumn — A heading's answer, in its grid's scope; a field no scope holds gets its chip.
 * - .request — Move fields into a scope: down from the View, or up from a chart with its answer.
 * - .reportPages — The grid's own page count, when every row is in hand: publish, load nothing.
 */
import {
  DEFAULT_OP, andFilter, compareValues, filterFields, filterNeedles, filterRows, groupSummaries, readField, valueKey,
} from './store.js';
import { fieldState, readingClause, stateClause } from './filter-state.js';
import { sayReadings, type SaidField } from './filter-face.js';
import {
  compile, VIEW, withoutDropped, type CompileFacts, type Query, type QueryDefaults, type ScopeQuery, type ViewScope,
} from './query.js';
import { readingsOf, whereOf, type Condition, type Where } from './where.js';
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
  /** Advanced conditions beside its values (`true`), or instead of them (`'only'`). */
  advanced?: boolean | 'only';
  /** @deprecated The name before 2026-09-29 (TODO 75), still read. */
  custom?: boolean | 'only';
  /** The condition its filter opens on. */
  op?: FilterOp;
  /** A DATE that holds a time of day: its Advanced rows offer a time too. TODO 21d */
  time?: boolean;
  /** A number filter's ends, and its step. */
  min?: number;
  max?: number;
  step?: number;
  /** Its chip's glyph. TRAP T-only-five-filter-chips-carry-an-icon */
  icon?: string;
  /** A value's name as a reader sees it, where it is not the value. */
  labels?: Record<string, string>;
  /** Its answer SURVIVES a View change that does not answer it; else a View
   *  resets it. TRAP T-a-field-can-carry-over-views */
  carryOver?: boolean;
}

/** A field's filter as any bar or panel draws it — its declaration and values. */
export interface FieldFilter extends Omit<FieldDeclaration, 'type'> {
  id: string;
  label: string;
  /** A number or a date draws a control of its own; any other field, its values. */
  kind?: 'number' | 'date';
  /** `swatch`: the data-viz series a chart draws this value in, from 1. */
  options?: { value: string; label: string; swatch?: number }[];
  /** A date's days that have records — every other day draws inactive. */
  availableDates?: string[];
  /** Its picks are ENDS from the start — the View's date. TRAP T-a-range-is-bounded-by-the-data */
  range?: boolean;
  /** Where it lives now, when an Add list offers it from another scope. */
  note?: string;
  /** A PRESET — a saved filter: its answer, field by field, and whether the reader may edit it. */
  readings?: Readonly<Record<string, FieldReading>>;
  editable?: boolean;
  /** …and that answer in WORDS, field by field, as its chip's menu lists it.
   *  TRAP T-a-saved-chip-lists-its-conditions */
  says?: SaidField[];
}

/** A source's whole question, as JSON — to send out and take back in: the
 *  Query as applied, its arrangement in the View scope, and every saved filter
 *  it names, so another service needs no library. TRAP T-a-page-goes-out-as-json */
export interface SourceState {
  v: 1;
  query: Query;
  presets: Record<string, { label?: string; editable?: boolean; readings: Record<string, FieldReading> }>;
}

/** One filter a scope holds, as a control draws it. */
export interface HeldFilter extends FieldFilter {
  /** Its answer in the Query, where it has one. */
  state?: FieldReading;
  /** A preset's on or off. */
  active?: boolean;
  removable?: boolean;
  /** A scope ABOVE holds it now — that scope's name. It keeps its place here,
   *  and its `state` is this scope's own answer: kept, not in force.
   *  TRAP T-a-superseded-chip-suspends-it-is-never-removed */
  appliedAt?: string;
  /** A saved filter's EDIT, not saved: what it applies now. TRAP T-a-saved-filter-keeps-its-edit */
  edited?: Record<string, FieldReading>;
  /** Where a View field may be SENT DOWN: each scope that has it, the one it
   *  came up from first. TRAP T-send-to-view-filters */
  /** Where a View field may go down to — `origin` is the scope it came UP from. */
  sendTo?: { scope: string; label: string; origin?: boolean }[];
}

/** What a scope's filters narrow: the View, or the content one component shows. */
export type ScopeShows = 'view' | 'grid' | 'chart' | 'form' | 'list';

/** Fields a scope draws as ONE group. `serial` chains them: each offers only
 *  what the answers of the fields above it leave. TODO 99 · TRAP T-a-filter-set-groups-or-chains */
export interface FilterSet {
  id: string;
  label?: string;
  /** `parallel`, the default, only groups them. */
  mode?: 'serial' | 'parallel';
  /** In order: in a serial set, the order IS the chain. */
  fields: readonly string[];
}

/** One scope as a control draws it WHOLE — what it holds and answers, what it
 *  may add, and how its rows are arranged. JSON. TRAP T-a-panel-asks-for-its-scopes */
export interface ScopeDescription {
  scope: string;
  label: string;
  /** What it narrows, as its bound component says. TRAP T-a-scope-says-what-it-shows */
  shows?: ScopeShows;
  /** A PART: one component's own answer to ONE field — a chart's legend field.
   *  Nothing is added to it or saved from it. TRAP T-a-chart-scope-is-its-legend-field */
  part?: boolean;
  filters: HeldFilter[];
  available: FieldFilter[];
  /** Its filter sets, each drawn as one group. TRAP T-a-filter-set-groups-or-chains */
  sets?: FilterSet[];
  group?: { field: string; label: string }[];
  sort?: { field: string; label: string }[];
  groupField?: string;
  sortField?: string;
  sortDirection?: SortDirection;
}

/** The view state a source owns. */
/** How a definition arranges the rows — only what it names. */
type Arrange = { sort?: SortSpec[]; group?: string | null; search?: string };

/** A filter as one string, its AND and OR children in one order: the same filter
 *  always reads the same. */
function canonical(filter: Filter | undefined): string {
  const walk = (f: Filter): unknown => (Array.isArray(f) && (f[0] === 'and' || f[0] === 'or')
    ? [f[0], ...(f.slice(1) as Filter[]).map((c) => JSON.stringify(walk(c))).sort()]
    : f);
  return filter ? JSON.stringify(walk(filter)) : '';
}

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
  /** Each list field offers only the values the other answers leave; the rest
   *  are drawn greyed. Default false. TRAP T-a-ruled-out-value-is-greyed */
  limitOptions?: boolean;
}

/** What the binder tells the source about one component. `bindSource()` says it. */
export interface AttachFacts {
  /** Read the data, never steer it. A chart re-draws; clicking a bar re-sorts nothing. */
  readonly?: boolean;
  /** STEER ONLY — events reach the source, no rows come back. TRAP T-steer-only-populate-means-chips */
  steerOnly?: boolean;
  /** The id a scope's `narrows` names this component by. Default: its own id. */
  id?: string;
  /** The SCOPE this control is a view of: it is DRAWN each answer in it. A bar's
   *  report is its scope's whole answer, so a field raised out is not its to
   *  clear. A LIST is for a control that draws several — the filter panel. */
  scope?: string | readonly string[];
  /** What this component SHOWS, so a panel can name its scope. TRAP T-a-scope-says-what-it-shows */
  shows?: Exclude<ScopeShows, 'view'>;
  /**
   * Which rows this component is given. `'page'` (the default) is the window a
   * grid draws; `'all'` is every row matching the filter, unpaged — what a
   * SUMMARY needs, because a chart counting 25 of 100 is quietly wrong.
   * TRAP T-a-summary-binds-to-all-the-rows
   */
  rows?: 'page' | 'all';
}

/** What a bound component is told of the view; `undefined` is none. The binder
 *  writes it as `data-*`. TRAP T-push-writes-state-as-attributes */
export interface BoundView {
  /** The sort's field, kept while the sort is suspended. TRAP T-a-suspended-sort-is-one-owners-job */
  sortField: string | undefined;
  /** `''` while the sort is suspended. */
  sortDirection: SortDirection | '' | undefined;
  groupField: string | undefined;
  /** WHICH fields the filter touches, not the filter. */
  filterFields: readonly string[];
  /** What it matched on, one a line. TRAP T-a-needle-comes-from-either-direction */
  needles: string;
  paging: { page: number; totalPages: number; pageSize: number } | undefined;
}

/** Where the source sends one bound component's view, rows and pending fields. */
export interface BindSink {
  view(view: BoundView): void;
  /** A page, or every row — never to a steer-only bind. */
  rows(rows: readonly Row[]): void;
  /** Its scopes' pending fields, and whether one is dirty. TRAP T-apply-and-discard-wait-for-a-change */
  pending(fields: readonly string[], dirty: boolean): void;
  /** The source let it go. */
  off(): void;
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


/** Steps a number slider may take. */
const NICE_STEPS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];

/** A step that gives a slider over this span about 200 stops. */
function niceStep(span: number): number {
  return span <= 1000 ? 1 : (NICE_STEPS.find((n) => n >= span / 200) ?? 1000);
}

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
      /** See AttachFacts.rows. */
      rows: 'page' | 'all';
      /** The rows array last handed to this component — see `#push`. */
      lastRows?: readonly Row[];
      /** See AttachFacts.id. */
      id: string;
      /** The filter narrowing ONLY this component it was last pushed with — see `#push`. */
      lastOwn?: string;
      scope?: string | readonly string[];
      shows?: AttachFacts['shows'];
      /** Where its view, rows and pending fields go. */
      sink: BindSink;
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
  /** Each component's OWN default filter, by its scope — put back under any
   *  Query that does not name that scope. TRAP T-a-component-default-outlives-a-view */
  #defaults = new Map<string, ScopeQuery>();
  /** Each scope's name as a reader sees it. */
  #scopeLabels = new Map<string, string>();
  /** Each PART: the one field it answers, and the one component it narrows.
   *  TRAP T-a-chart-scope-is-its-legend-field */
  #narrowing = new Map<string, { field: string; only: Populatable; label?: string }>();

  constructor(options: DataSourceOptions) {
    super();
    this.store = options.store;
    // REMOTE: the reader edits a copy, and Apply sends it.
    if (this.#remote) this.#draft = { v: 1, scopes: {} };
    this.#autoLoad = options.autoLoad ?? true;
    this.#limitOptions = options.limitOptions ?? false;
    this.#searchFields = options.searchFields;
    this.#state = {
      sort: options.sort ?? [],
      group: options.group ?? null,
      search: '',
      page: 1,
      pageSize: options.pageSize ?? null,
    };
    this.#filter = options.filter;
    // FORCED: the rows changed under an identical ViewState — and so may the values they hold.
    this.store.addEventListener('change', () => {
      this.#presentFor = '';
      void this.load({ force: true });
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
    return structuredClone(this.#filter ? { ...this.#state, filter: this.#filter } : this.#state);
  }

  /** The Query the rows are under. A copy. TRAP T-one-query-one-owner */
  get query(): { applied: Query; draft: Query } {
    return { applied: structuredClone(this.#applied), draft: structuredClone(this.#draft) };
  }

  /** This source's whole question as JSON — the Query as applied, how its rows
   *  are arranged, and the saved filters it names. TRAP T-a-page-goes-out-as-json */
  export(): SourceState {
    const query = structuredClone(this.#applied);
    const { sort, group, search } = this.#state;
    query.scopes[VIEW] = {
      ...(query.scopes[VIEW] ?? { holds: [], readings: {} }), sort: structuredClone(sort), group, search,
    };
    const presets: SourceState['presets'] = {};
    for (const scope of Object.values(query.scopes)) {
      for (const id of Object.keys(scope.presets ?? {})) {
        const readings = this.#presets.get(id);
        if (readings) presets[id] = { ...this.#presetFacts.get(id), readings: structuredClone(readings) as Record<string, FieldReading> };
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
   * Restore a whole Query — a reload, a trip away and back, a View's own
   * defaults. Each bound control over a scope is DRAWN its slice; nothing
   * replays a control. The named parts are left alone. Resolves once every
   * control has drawn.
   *
   * `holds: 'keep'` — a View: a scope the definition gives no `holds` keeps
   * the chips it has, and every answer is a clean slate.
   * TRAP T-one-query-one-owner · TRAP T-a-reload-replays-the-readers-answers · TRAP T-a-view-is-json
   */
  /**
   * Would a Reset to default change nothing? What filters NOW, which filters
   * each scope holds, and how the rows are arranged, against `base` as defined
   * with a View's own Query over it. Applies nothing. TODO 231
   * TRAP T-reset-to-default-is-the-views-own
   */
  atDefault(base: Query, view?: QueryDefaults): boolean {
    const first = this.#definition(base, false);
    const second = view ? this.#definition(view, true, first.query) : null;
    const facts = this.#compileFacts();
    const filters = (q: Query): string => {
      const { filter, only } = compile(q, facts);
      return JSON.stringify([canonical(filter), Object.entries(only).map(([el, f]) => [el, canonical(f)]).sort()]);
    };
    const at = second?.query ?? first.query;
    if (filters(at) !== filters(this.#applied)) return false;
    /* WHICH filters each scope holds: one taken off, or moved, is a change too
       (Will, 2026-10-12). A component's own part is its, not the reader's. */
    const holds = (q: Query): string => JSON.stringify(Object.entries(q.scopes)
      .filter(([, scope]) => !scope.narrows && scope.holds.length)
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
    this.#rehome();
    this.#recompose();
    this.dispatchEvent(new CustomEvent('scope-change', { detail: { scopes: this.scopes } }));
    for (const field of new Set([...before, ...this.selectedFields])) {
      this.dispatchEvent(new CustomEvent('selection-change', { detail: { field } }));
      this.#draw(field);
    }
    const drawn: Array<void | Promise<void>> = [];
    for (const [el, { scope }] of this.#bound) {
      if (typeof scope === 'string' && el.drawScope) drawn.push(el.drawScope(this.describe(scope)));
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
    // A declared part narrows its own component, whoever writes it — a panel too.
    const only = at.only ?? this.#narrowing.get(scope)?.only;
    const bind = only ? this.#bound.get(only) : undefined;
    if (reading && only && bind?.rows !== 'all') {
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
    // A panel shows a part too, and is told as a bar is. TRAP T-one-query-one-owner
    if (this.#narrowing.has(scope)) {
      const drawn = structuredClone(this.#draft.scopes[scope]?.readings[field] ?? { picked: [] });
      for (const [el, b] of this.#bound) if (Array.isArray(b.scope)) el.drawReading?.(field, drawn, scope);
    }
  }

  /**
   * Declare a PART — the scope of ONE field that narrows ONE component, a
   * chart's legend field — so a panel draws it before it is answered, and a
   * write to it from anywhere narrows that component. `undefined` forgets it.
   * TRAP T-a-chart-scope-is-its-legend-field
   */
  declarePart(scope: string, part: { field: string; only: Populatable; label?: string } | undefined): void {
    if (part) this.#narrowing.set(scope, part);
    else this.#narrowing.delete(scope);
    // Sent up, the View holds its field — and draws only a field it knows.
    if (part && !this.#fields.has(part.field)) this.declareField(part.field);
    this.#drawScopesSoon();
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
    at: { only?: Populatable } = {},
  ): void {
    const was = this.#draft.scopes[scope]?.readings ?? {};
    if (!readings) {
      this.#defaults.delete(scope);
      for (const field of Object.keys(was)) this.write(scope, field, undefined);
      return;
    }
    // Its OWN before the first write compiles, so a View-held field cannot set it aside.
    this.#defaults.set(scope, structuredClone(this.#draft.scopes[scope] ?? { holds: [], readings: {} }));
    for (const field of Object.keys(was)) if (!(field in readings)) this.write(scope, field, undefined);
    for (const [field, reading] of Object.entries(readings)) this.write(scope, field, reading, at);
    const written = this.#draft.scopes[scope];
    if (written) this.#defaults.set(scope, structuredClone(written));
    else this.#defaults.delete(scope);
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
    // A saved filter it no longer holds takes its edit with it.
    for (const id of Object.keys(this.#draft.scopes[scope]?.edits ?? {})) if (!(id in presets)) this.#dropEdit(scope, id);
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
      // SAVED as it was changed: that change is no change now.
      for (const [scope, entry] of Object.entries(this.#draft.scopes)) {
        if (JSON.stringify(entry.edits?.[id]) === JSON.stringify(readings)) this.#dropEdit(scope, id);
      }
    } else {
      this.#presets.delete(id);
      this.#presetFacts.delete(id);
      for (const scope of Object.keys(this.#draft.scopes)) this.#dropEdit(scope, id);
    }
    this.#recompose();
    this.#drawScopesSoon();
  }

  /**
   * EDIT a saved filter: the readings it applies now, while the library keeps
   * what was saved. `undefined` puts the saved one back. Will, TODO 50.
   * TRAP T-a-saved-filter-keeps-its-edit
   */
  editPreset(scope: string, id: string, readings: Readonly<Record<string, FieldReading>> | undefined): void {
    if (!this.#presets.has(id)) {
      // TRAP T-a-broken-assumption-reports
      report({ code: 'unknown-preset', message: 'editPreset: no saved filter has that id.', at: { scope, id } });
      return;
    }
    // An empty edit would compile to no clause: an ON filter matching every row.
    if (readings && Object.keys(readings).length && JSON.stringify(readings) !== JSON.stringify(this.#presets.get(id))) {
      const entry = this.#scope(scope);
      entry.edits = { ...entry.edits, [id]: structuredClone(readings) as Record<string, FieldReading> };
    } else {
      this.#dropEdit(scope, id);
    }
    this.#recompose();
    this.commit();
    this.#drawScopesSoon();
    this.#drawBars(scope);
  }

  /** Forget one scope's edit of a saved filter. */
  #dropEdit(scope: string, id: string): void {
    const entry = this.#draft.scopes[scope];
    if (!entry?.edits || !(id in entry.edits)) return;
    Reflect.deleteProperty(entry.edits, id);
    if (!Object.keys(entry.edits).length) delete entry.edits;
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
    const part = this.#narrowing.get(scope);
    if (part) {
      /* ONE Simple filter: a chip per value, each with the series it is drawn
         in. No Advanced — Will, TODO 52. TRAP T-a-chart-scope-is-its-legend-field */
      const { advanced: _a, custom: _c, kind: _k, options, ...def } = this.filterDef(part.field);
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
      const edit = q.edits?.[id];
      return {
        id, label: facts.label ?? id, readings: this.#presets.get(id) ?? {}, active: on, removable: true,
        ...(facts.editable ? { editable: true } : {}),
        // An EDIT is what its menu says now. TRAP T-a-saved-filter-keeps-its-edit
        ...(edit ? { edited: structuredClone(edit) } : {}),
        says: edit ? this.say(edit) : this.#says(id),
      };
    });
    // EVERY field it holds, declared or not: one left out still filters. TRAP T-a-broken-assumption-reports
    const fields: HeldFilter[] = q.holds.map((f) => {
      const reading = q.readings[f];
      const down = scope === VIEW ? this.#lowerTo(f) : [];
      const from = this.#cameFrom(f);
      return {
        ...this.filterDef(f), removable: true,
        // The View's date slices the whole view, so it is a RANGE. Will, TODO 20b.
        ...(scope === VIEW && this.#fields.get(f)?.type === 'date' ? { range: true } : {}),
        ...(reading ? { state: structuredClone(reading) } : {}),
        ...(above.includes(f) ? { appliedAt: this.scopeLabel(VIEW) } : {}),
        ...(down.length ? { sendTo: down.map((to) => ({
          scope: to, label: this.#narrowing.get(to)?.label ?? this.scopeLabel(to), ...(to === from ? { origin: true } : {}),
        })) } : {}),
      };
    });
    // Below the View, a saved filter it does not hold is offered too.
    const offered = scope === VIEW ? [] : [...this.#presetFacts.keys()]
      .filter((id) => !(id in (q.presets ?? {})))
      .map((id) => ({ id, label: this.#presetFacts.get(id)?.label ?? id,
        readings: this.#presets.get(id) ?? {}, ...(this.#presetFacts.get(id)?.editable ? { editable: true } : {}),
        says: this.#says(id) }));
    const shows = scope === VIEW ? 'view'
      : [...this.#bound.values()].find((b) => b.scope === scope && b.shows)?.shows;
    const sets = this.sets(scope);
    const out: ScopeDescription = {
      scope, label: this.scopeLabel(scope), ...(shows ? { shows } : {}), filters: [...presets, ...fields],
      available: [...this.addable(scope), ...offered], ...(sets.length ? { sets } : {}),
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

  /** say(readings) — a saved filter in WORDS, field by field: the source knows
   *  each field's name, type and values. TRAP T-a-saved-chip-lists-its-conditions */
  say(readings: Readonly<Record<string, FieldReading>>): SaidField[] {
    return sayReadings(readings, (field) => this.#facts(field));
  }

  /** A preset it holds, in words. */
  #says(id: string): SaidField[] {
    return this.say(this.#presets.get(id) ?? {});
  }

  /** A control over several scopes — the panel — is drawn each WHOLE, once
   *  per moment, when what a scope holds changes. TRAP T-an-open-panel-follows-the-data-layer */
  #drawScopesSoon(): void {
    if (this.#drawingScopes) return;
    this.#drawingScopes = true;
    queueMicrotask(() => {
      this.#drawingScopes = false;
      for (const [el, { scope }] of this.#bound) {
        // A scope this page does not have — nothing held, nothing to offer — is not drawn.
        if (Array.isArray(scope) && el.drawScopes) {
          // Each chart's own, between the View and the rest. Will, TODO 52.
          const [first, ...rest] = scope as string[];
          const asked = first === VIEW ? [VIEW, ...this.#narrowing.keys(), ...rest] : [...this.#narrowing.keys(), ...scope];
          void el.drawScopes(asked.map((s) => this.describe(s))
            .filter((d) => d.scope === VIEW || d.filters.length || d.available.length));
        }
      }
    });
  }

  /** A redraw of every scope control is queued. */
  #drawingScopes = false;

  /** Draw every bar over one scope, as the panel draws it — after a request
   *  that came from somewhere else (the panel) changed what it holds. */
  #drawBars(scope: string): void {
    for (const [el, { scope: s }] of this.#bound) if (s === scope && el.drawScope) void el.drawScope(this.describe(scope));
  }

  /** Switch a scope's presets: the ids given are ON, the rest it holds OFF. */
  #setPresets(scope: string, on: readonly string[]): void {
    const entry = this.#scope(scope);
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
    for (const scope of switched) this.#drawBars(scope);
    if (switched.length) this.commit();
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

  /** Where a field the View holds came UP from — kept IN the Query, so a reload
   *  and a View's draft keep it. TODO 235 · TRAP T-send-to-view-filters */
  #cameFrom(field: string): string | undefined {
    return this.#draft.scopes[VIEW]?.from?.[field];
  }

  /** Remember, or forget, where a View field came up from. */
  #setCameFrom(field: string, from: string | undefined): void {
    for (const query of new Set([this.#draft, this.#applied])) {
      const view = query.scopes[VIEW];
      if (!view) continue;
      const next = Object.entries({ ...view.from, ...(from ? { [field]: from } : {}) })
        .filter(([id]) => from || id !== field);
      if (next.length) view.from = Object.fromEntries(next);
      else delete view.from;
    }
  }

  /** Each scope a View field may be sent down to — a component's that has it,
   *  or a chart's own — the one it came UP from first. The reader picks where
   *  there is more than one: the source does not guess, and does not rely on
   *  what it remembers, which a reload forgets. TRAP T-send-to-view-filters */
  #lowerTo(field: string): string[] {
    const has = (scope: string): boolean =>
      this.#narrowing.get(scope)?.field === field || this.canHold(scope, field);
    const all = [...this.#offers.keys(), ...this.#narrowing.keys()].filter((s) => s !== VIEW && has(s));
    const from = this.#cameFrom(field);
    return from && all.includes(from) ? [from, ...all.filter((s) => s !== from)] : all;
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
    for (const [id, scope] of Object.entries(this.#draft.scopes)) {
      if (id === VIEW || id === to || scope.narrows || !scope.holds.includes(field)) continue;
      this.hold(id, scope.holds.filter((f) => f !== field));
      this.#drawBars(id);
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
    this.#drawBars(VIEW);
    if (!part) this.#drawBars(to);
  }

  /** A scope lets ONE go — a field or a preset. */
  release(scope: string, id: string): void {
    const entry = this.#draft.scopes[scope];
    if (entry?.presets && id in entry.presets) {
      Reflect.deleteProperty(entry.presets, id);
      this.#dropEdit(scope, id);
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
      ...(facts.time ? { time: true } : {}),
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

  /**
   * Each field here that its schema says nothing of takes it from the ROWS: a
   * set, its unique values in order; a number, its lowest and highest. One
   * load, and only when a field needs it. TRAP T-the-data-says-what-a-field-may-hold
   */
  async declareFromRows(fields: readonly string[]): Promise<void> {
    const open = fields.filter((f) => {
      const facts = this.#fields.get(f) ?? {};
      if (facts.type === 'number') return facts.min == null || facts.max == null;
      return (facts.advanced ?? facts.custom) !== 'only' && !this.#domains.has(f);
    });
    let rows: Row[] = [];
    try {
      if (open.length) rows = (await this.store.load({})).rows;
    } catch (error) {
      /* A store that cannot answer yet must not stop the page: its fields
         offer no values, and the first load shows the failure on its card.
         TRAP T-a-container-shows-its-datas-state */
      report({
        code: 'values-unread',
        message: 'declareFromRows: the rows could not be read, so these fields offer no values yet.',
        at: { fields: open.join(','), error: error instanceof Error ? error.message : String(error) },
      });
    }
    for (const field of fields) {
      const facts = this.#fields.get(field) ?? {};
      const held = open.includes(field)
        ? rows.map((r) => readField(r, field)).filter((v) => v != null && v !== '') : [];
      if (facts.type !== 'number') {
        const unique = [...new Map(held.map((v) => [valueKey(v), v])).values()];
        if (unique.length) this.declareValues(field, unique.sort((a, b) => compareValues(valueKey(a), valueKey(b))));
        continue;
      }
      const nums = held.map(Number).filter(Number.isFinite);
      const min = facts.min ?? (nums.length ? Math.floor(nums.reduce((a, b) => Math.min(a, b))) : undefined);
      const max = facts.max ?? (nums.length ? Math.ceil(nums.reduce((a, b) => Math.max(a, b))) : undefined);
      if (min == null || max == null) continue;
      this.declareField(field, { min, max, step: facts.step ?? niceStep(max - min) });
    }
  }

  /** What `declareField` was told. */
  fieldFacts(field: string): FieldDeclaration {
    return { ...(this.#fields.get(field) ?? {}) };
  }

  /** Readings in the plain form a definition or a View writes, by this source's
   *  field types. TRAP T-one-way-to-write-a-condition */
  whereOf(readings: Readonly<Record<string, FieldReading>>): Where {
    return whereOf(readings, (f) => this.#facts(f));
  }

  /** The plain form as readings, by this source's field types. */
  readingsOf(where: Readonly<Record<string, Condition | FieldReading>>): Record<string, FieldReading> {
    return readingsOf(where, (f) => this.#facts(f));
  }

  /** A field's filter, as any bar or panel draws it — ONE definition, so two
   *  controls over a field cannot offer it two ways. Its options are the values
   *  the rows HOLD, never a lower-cased copy a heading's menu would not share.
   *  TRAP T-a-field-is-declared-once · TRAP T-one-comparison-rule-for-query-and-ui */
  filterDef(field: string): FieldFilter {
    const { type, label, labels, ...rest } = this.#fields.get(field) ?? {};
    const body = type === 'number' || type === 'date' ? type : undefined;
    const values = body || (rest.advanced ?? rest.custom) === 'only' ? [] : this.valuesFor(field).map(valueKey);
    // A date's declared values are the days a calendar may pick. TRAP T-a-date-chip-names-its-field
    const days = type === 'date' ? this.valuesFor(field).map(String) : [];
    return {
      id: field, label: label ?? field, ...rest,
      ...(body ? { kind: body } : {}),
      ...(values.length ? { options: values.map((v) => ({ value: v, label: labels?.[v] ?? v })) } : {}),
      ...(days.length ? { availableDates: days } : {}),
    };
  }

  /** Name a scope as a reader sees it — a panel's section, an Add list's note. */
  declareScope(scope: string, facts: { label: string }): void {
    this.#scopeLabels.set(scope, facts.label);
  }

  /** A scope's filter sets, in order. A field is in one set at most; a second
   *  is left out, and said. TRAP T-a-filter-set-groups-or-chains */
  declareSets(scope: string, sets: readonly FilterSet[]): void {
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
    return this.fields(scope).filter((f) => !skip.has(f) && this.#fields.has(f)).map((f) => {
      const at = this.scopeOf(f);
      return at && at !== scope ? { ...this.filterDef(f), note: this.scopeLabel(at) } : this.filterDef(f);
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
   * A SUSPENDED answer is drawn too, and SAYS it is — `suspended: true` — so a
   * bar keeps its chip off and a panel does not show an answer that filters
   * nothing. TRAP T-one-query-one-owner · TRAP T-grid-suspend-is-not-clear
   * TRAP T-a-conditioned-chip-answers-with-its-clause
   * TRAP T-a-suspended-answer-is-drawn-as-off
   */
  #draw(field: string): void {
    const home = this.#home(field);
    // A View answer shows in every grid's heading too.
    if (home === VIEW) this.#syncColumns();
    const state = this.selection(field);
    const off = state.fieldState === 'suspended';
    // Suspended, its values are not "picked" in the state: they are the reading's own.
    const picked = off ? (this.#reading(field)?.picked ?? []).map(valueKey)
      : state.values.filter((v) => v.state === 'picked').map((v) => v.value);
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
    /* The rows a component SHOWS: an unwindowed load is those, under every
       scope. `#allRows` is the VIEW's alone, so it stands in only for a page.
       TRAP T-a-group-is-a-data-layer-concept */
    const whole = this.#state.group != null || this.#state.pageSize == null;
    const rows = !whole && this.#allRows.length ? this.#allRows : this.#result.rows;
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
    for (const scope of Object.values(this.#draft.scopes)) {
      if (scope.narrows) continue;
      // A carry-over field keeps its answer. TRAP T-a-field-can-carry-over-views
      scope.readings = Object.fromEntries(Object.entries(scope.readings)
        .filter(([field]) => this.#fields.get(field)?.carryOver));
    }
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

  /**
   * Each grid below the View is told the fields the View holds, each with its
   * answer as APPLIED — shown in its heading, read-only, so a heading cannot
   * contradict it. TRAP T-a-view-held-heading-shows-and-refuses
   */
  #syncColumns(): void {
    const view = this.#applied.scopes[VIEW] ?? { holds: [], readings: {} };
    const held = Object.fromEntries(view.holds.map((f) => {
      const r = view.readings[f];
      return [f, r && !r.suspended ? r : {}];
    }));
    for (const [el, { scope }] of this.#bound) {
      if (typeof scope === 'string' && scope !== VIEW) el.supersedeColumns?.(held, this.scopeLabel(VIEW));
    }
  }

  /** The scopes a bound component answers — every other one is the page's. */
  #componentScopes(): Set<string> {
    const out = new Set<string>();
    for (const { scope } of this.#bound.values()) {
      for (const s of Array.isArray(scope) ? scope : scope ? [scope] : []) if (s !== VIEW) out.add(s);
    }
    return out;
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
    this.#syncColumns();
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
    this.#noteRecency();
    const { filter, view, scoped, only } = compile(this.#applied, this.#compileFacts());
    const parts = [...this.#parts.values()];
    const next = andFilter([...parts, ...(filter ? [filter] : [])]);
    const viewed = andFilter([...parts, ...(view ? [view] : [])]);
    /* A DRAFT edit on a remote source changes nothing applied: no load, and
       the page stays where it is. It only changes what is pending. */
    // The SHARED filter stood still: no load follows, whatever one component's own did.
    const still = JSON.stringify(next) === JSON.stringify(this.#filter);
    const same = this.#remote && still && JSON.stringify(only) === JSON.stringify(this.#only);
    this.#only = only;
    this.#filter = next;
    this.#viewFilter = viewed;
    this.#scoped = scoped;
    this.#syncPending();
    if (!same) this.#requery();
    /* The rows did not move, so no load will count again — yet an answer that
       is OFF, or one chart's own, changed, and its badge wears a number.
       TRAP T-a-chip-counts-its-own-results */
    if (still && this.#loaded && this.#countedFor !== JSON.stringify(this.#applied)) void this.#drawResults();
    if (still && this.#loaded) this.#presentSoon();
  }

  /** What compiling needs: each field's facts, the saved filters, the
   *  component scopes, and the picks a later answer set aside. */
  #compileFacts(): CompileFacts {
    return {
      field: (f) => this.#facts(f),
      preset: (id) => this.#presets.get(id),
      components: this.#componentScopes(),
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

  /** The same, for this class's own branches. */
  get #remote(): boolean {
    return !!this.store.remote;
  }

  /**
   * A definition as a whole Query. Its sort, group and search set the source's
   * own — and leave the Query, which holds WHICH rows, not their order. A VIEW
   * (`keep`) keeps the chips a scope it does not name holds, and a field it
   * answers is held, so its chip shows it.
   */
  #definition(given: Query | QueryDefaults, keep: boolean, base: Query = this.#draft): { query: Query; arrange: Arrange | null } {
    const next: Query = { v: 1, scopes: {} };
    let arrange: Arrange | null = null;
    for (const [id, scope] of Object.entries(structuredClone(given.scopes))) {
      /* A View says `where`; a whole Query, and a View saved before TODO 197,
         `readings`. TRAP T-one-way-to-write-a-condition */
      const { sort, group, search, where, edits, readings, ...rest } = scope as ViewScope & Partial<Pick<ScopeQuery, 'readings'>>;
      next.scopes[id] = {
        ...rest, holds: rest.holds ?? [], readings: { ...readings, ...(where ? this.readingsOf(where) : {}) },
        ...(edits ? { edits: Object.fromEntries(Object.entries(edits).map(([p, e]) => [p, this.readingsOf(e)])) } : {}),
      };
      if (sort) (arrange ??= {}).sort = sort;
      if (group !== undefined) (arrange ??= {}).group = group;
      if (search !== undefined) (arrange ??= {}).search = search;
    }
    /* A component's OWN default filter outlives a View that does not name it,
       and a restore from before it joined. A View may name it to change it.
       TRAP T-a-component-default-outlives-a-view */
    for (const [id, scope] of this.#defaults) next.scopes[id] ??= structuredClone(scope);
    // A RESTORE is exact; only a View keeps chips and shows its answers on them.
    if (!keep) return { query: next, arrange };
    /* A carry-over field keeps its answer where the View gives none.
       TRAP T-a-field-can-carry-over-views */
    for (const [id, scope] of Object.entries(base.scopes)) {
      if (scope.narrows) continue;
      for (const [field, reading] of Object.entries(scope.readings)) {
        if (!this.#fields.get(field)?.carryOver) continue;
        if (Object.values(next.scopes).some((s) => field in s.readings)) continue;
        (next.scopes[id] ??= { holds: [], readings: {} }).readings[field] = structuredClone(reading);
      }
    }
    for (const [id, scope] of Object.entries(base.scopes)) {
      if (scope.narrows || given.scopes[id]?.holds) continue;
      (next.scopes[id] ??= { holds: [], readings: {} }).holds = [...scope.holds];
    }
    /* …and its SAVED filters, as chips: each stays on its bar, OFF unless the
       View turns it on. A View that named none took them all off the bar.
       TRAP T-a-view-keeps-the-saved-filter-chips */
    for (const [id, scope] of Object.entries(base.scopes)) {
      if (scope.narrows || !scope.presets) continue;
      const to = (next.scopes[id] ??= { holds: [], readings: {} });
      to.presets = { ...Object.fromEntries(Object.keys(scope.presets).map((p) => [p, false])), ...to.presets };
    }
    for (const scope of Object.values(next.scopes)) {
      if (scope.narrows) continue;
      for (const field of Object.keys(scope.readings)) {
        if (!scope.holds.includes(field)) scope.holds = [...scope.holds, field];
      }
    }
    return { query: next, arrange };
  }

  /** A definition's arrangement onto the source's own. */
  #arrange(by: Arrange): void {
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
    // The headings show what is APPLIED.
    this.#syncColumns();
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
    for (const { scope, sink } of this.#bound.values()) {
      if (!scope) continue;
      const scopes = typeof scope === 'string' ? [scope] : [...scope];
      const fields = this.#remote
        ? [...new Set(scopes.flatMap((id) => Object.keys({
          ...this.#applied.scopes[id]?.readings, ...this.#draft.scopes[id]?.readings,
        })))].filter((f) => this.pending(f))
        : [];
      sink.pending(fields, scopes.some((id) => this.dirty(id)));
    }
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
  load(options: { force?: boolean } = {}): Promise<LoadResult> {
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
      if (key === this.#lastLoadKey && this.#loaded && !this.#inFlight) return Promise.resolve(this.#result);
      /* ASKED: the caller waits for THAT answer. Handed the result of the load
         BEFORE it, `await source.load()` came back with no rows while the
         first load was still out. TRAP T-an-asked-load-is-awaited */
      if (key === this.#inFlightKey && this.#asking) return this.#asking;
    }
    const asking = this.#ask(key);
    this.#asking = asking;
    return asking;
  }

  /** The load in flight, for a caller that asks the same question again. */
  #asking: Promise<LoadResult> | null = null;

  /** Ask the store, and publish the answer if it is still the latest asked. */
  async #ask(key: string): Promise<LoadResult> {
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
      void this.#drawResults();
      this.#presentSoon();
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
        this.#asking = null;
        this.dispatchEvent(new CustomEvent('loading', { detail: { loading: false } }));
      }
    }
  }

  /**
   * Each answered chip's RESULTS in a scope: the rows its OWN answer matches,
   * within what the scope can see — a component scope's, within the View's. By
   * field, or saved-filter id; from the APPLIED Query, so a draft has none.
   * A FIELD's answer, on or off: switched off, it still says what it would
   * match (123). A SAVED filter only while it is on: its count is not always
   * known before (166). Will, TODO 60.
   * TRAP T-a-chip-counts-its-own-results
   */
  async results(scope: string): Promise<Record<string, number>> {
    const q = this.#applied.scopes[scope];
    if (!q) return {};
    const field = (f: string): Omit<FieldFacts, 'field'> => this.#facts(f);
    const { view } = compile(this.#applied, this.#compileFacts());
    const base = scope === VIEW || !view ? [] : [view];
    // One field, one scope: a field the View holds is the View's.
    const above = new Set(scope === VIEW ? [] : this.#applied.scopes[VIEW]?.holds ?? []);
    const own: Array<[string, Filter | undefined]> = [
      ...Object.entries(q.readings)
        .filter(([f]) => !above.has(f))
        .map(([f, { suspended: _off, ...reading }]): [string, Filter | undefined] =>
          [f, readingClause({ field: f, ...field(f) }, withoutDropped(reading, this.#setAside.get(scope)?.[f]))]),
      ...Object.entries(q.presets ?? {}).filter(([, on]) => on)
        .map(([id]): [string, Filter | undefined] => [id, andFilter(Object.entries(q.edits?.[id] ?? this.#presets.get(id) ?? {})
          .map(([f, reading]) => readingClause({ field: f, ...field(f) }, reading))
          .filter((c): c is NonNullable<typeof c> => !!c))]),
    ];
    const out: Record<string, number> = {};
    await Promise.all(own.map(async ([id, clause]) => {
      const filter = clause && andFilter([...base, clause]);
      if (filter) out[id] = await this.store.totalCount({ filter });
    }));
    return out;
  }

  /**
   * Each PICKED value's own results in a scope: the rows that ONE value
   * matches, within what the scope can see — by field, then by value. Only a
   * list answer in force has values to count: rows, a range, a field that is
   * off or held above have none. Will, TODO 172.
   * TRAP T-a-chip-counts-its-own-results
   */
  async valueResults(scope: string): Promise<Record<string, Record<string, number>>> {
    const q = this.#applied.scopes[scope];
    if (!q) return {};
    const { view } = compile(this.#applied, this.#compileFacts());
    const base = scope === VIEW || !view ? [] : [view];
    const above = new Set(scope === VIEW ? [] : this.#applied.scopes[VIEW]?.holds ?? []);
    const out: Record<string, Record<string, number>> = {};
    await Promise.all(Object.entries(q.readings).flatMap(([f, reading]) => {
      if (above.has(f) || reading.suspended) return [];
      const state = this.#stateFor(f, reading);
      if (state.mode !== 'simple' || state.range || state.op !== DEFAULT_OP) return [];
      const type = this.#fields.get(f)?.type;
      return (reading.picked ?? []).map(async (value) => {
        /* ONE value, with no list beside it: against the field's whole list,
           the one value of a one-value field reads as "everything", no filter.
           TRAP T-everything-on-is-no-filter */
        const clause = readingClause({ field: f, ...(type ? { type } : {}) }, { picked: [value], range: false });
        if (!clause) return;
        (out[f] ??= {})[valueKey(value)] = await this.store.totalCount({ filter: andFilter([...base, clause])! });
      });
    }));
    return out;
  }

  /** Each bound bar — and the panel, scope by scope — is drawn its chips'
   *  results, off the load that just landed; a later load's count wins.
   *  TRAP T-a-chip-counts-its-own-results */
  async #drawResults(): Promise<void> {
    // A control over several scopes — the panel — draws each chart's own too.
    const drawn = [...this.#bound].flatMap(([el, b]) => (el.drawResults && b.scope
      ? [{ el, scopes: typeof b.scope === 'string' ? [b.scope] : [...b.scope, ...this.#narrowing.keys()] }] : []));
    if (!drawn.length) return;
    this.#countedFor = JSON.stringify(this.#applied);
    const ticket = (this.#counting = Symbol('count'));
    const byScope = new Map<string, Record<string, number>>();
    for (const scope of new Set(drawn.flatMap((d) => d.scopes))) {
      byScope.set(scope, await this.results(scope));
      if (this.#counting !== ticket) return;
    }
    for (const { el, scopes } of drawn) {
      for (const scope of scopes) el.drawResults?.(byScope.get(scope) ?? {}, scope);
    }
    // A control that draws a chip per VALUE is told each picked value's own too.
    for (const { el, scopes } of drawn) {
      if (!el.drawValueResults) continue;
      for (const scope of scopes) {
        const byValue = await this.valueResults(scope);
        if (this.#counting !== ticket) return;
        el.drawValueResults(byValue, scope);
      }
    }
  }

  /* ── What the other answers LEAVE — Will, TODO 174 (110 B) ─────────────
   * TRAP T-a-ruled-out-value-is-greyed */

  /** Does each list field offer only the values the other answers leave? */
  get limitOptions(): boolean {
    return this.#limitOptions;
  }
  set limitOptions(on: boolean) {
    if (on === this.#limitOptions) return;
    this.#limitOptions = on;
    this.#presentFor = '';
    this.#presentSoon();
  }
  /** The setting: does each list field offer only what the others leave? */
  #limitOptions = false;

  /**
   * Each list field's values the rows still HOLD under the OTHER answers in its
   * scope — a component scope's within the View's — as value keys. A field's
   * own answer never limits it. Nothing while `limitOptions` is off.
   */
  async present(scope: string): Promise<Record<string, string[]>> {
    if (!this.#limitOptions) return {};
    const q = this.#applied.scopes[scope];
    const above = new Set(scope === VIEW ? [] : this.#applied.scopes[VIEW]?.holds ?? []);
    // A chart's own scope answers its legend's one field.
    const part = this.#narrowing.get(scope)?.field;
    const fields = [...new Set([...(q?.holds ?? []), ...(scope === VIEW ? [] : this.fields(scope)), ...(part ? [part] : [])])]
      .filter((f) => !above.has(f) && this.#isListField(f));
    // Fields limited by the same filter share one pass over the rows.
    const passes = new Map<string, { filter: Filter | undefined; fields: string[] }>();
    for (const f of fields) {
      const filter = this.#limitFor(scope, f);
      const key = JSON.stringify(filter ?? null);
      if (!passes.has(key)) passes.set(key, { filter, fields: [] });
      passes.get(key)!.fields.push(f);
    }
    const out: Record<string, string[]> = {};
    for (const { filter, fields: some } of passes.values()) Object.assign(out, await this.#presentUnder(some, filter));
    return out;
  }

  /** A field whose values are a list a control offers one by one. */
  #isListField(field: string): boolean {
    const facts = this.#fields.get(field) ?? {};
    return this.#domains.has(field) && facts.type !== 'number' && facts.type !== 'date'
      && (facts.advanced ?? facts.custom) !== 'only';
  }

  /** What limits one field: the applied Query compiled WITHOUT that field's own answer in its scope. */
  #limitFor(scope: string, field: string): Filter | undefined {
    const query = structuredClone(this.#applied);
    const own = query.scopes[scope];
    if (own) Reflect.deleteProperty(own.readings, field);
    const { view, scoped } = compile(query, this.#compileFacts());
    return andFilter([view, scope === VIEW ? undefined : scoped[scope]].filter((f): f is Filter => !!f));
  }

  /** Each field's distinct values, as value keys, among the rows a filter matches. */
  async #presentUnder(fields: readonly string[], filter: Filter | undefined): Promise<Record<string, string[]>> {
    const options = filter ? { filter } : {};
    const keys = (values: readonly unknown[]): string[] => [...new Set(values
      .filter((v) => v != null && v !== '').map(valueKey))];
    if (this.store.distinct) {
      const found = await this.store.distinct(fields, options);
      return Object.fromEntries(fields.map((f) => [f, keys(found[f] ?? [])]));
    }
    const { rows } = await this.store.load(options);
    return Object.fromEntries(fields.map((f) => [f, keys(rows.map((r) => readField(r, f)))]));
  }

  /**
   * A LATER answer wins (Will, TODO 180): newest first, each list field keeps
   * the picks the rows still hold under the answers after it, and the rest are
   * SET ASIDE — kept in the reading, left out of the filter, drawn inactive. The
   * View first; a component scope's under the View's. Off, nothing is set aside
   * but what a serial set's chain rules out — and a field is never ruled out by
   * one BELOW it in its chain.
   * TRAP T-a-later-answer-sets-an-earlier-pick-aside · TRAP T-a-filter-set-groups-or-chains
   */
  async #setAsideNow(): Promise<Map<string, Record<string, string[]>>> {
    const out = await this.#chainAside();
    if (!this.#limitOptions) return out;
    const facts = (f: string): Omit<FieldFacts, 'field'> => this.#facts(f);
    const viewHolds = new Set(this.#applied.scopes[VIEW]?.holds ?? []);
    const below = this.#below();
    type Part = { field?: string; clause: Filter };
    const run = async (scope: string, base: readonly Part[]): Promise<Part[]> => {
      const q = this.#applied.scopes[scope];
      const parts = [...base];
      if (!q || q.narrows?.length) return parts;
      for (const [id, on] of Object.entries(q.presets ?? {})) {
        if (!on) continue;
        for (const [f, reading] of Object.entries(q.edits?.[id] ?? this.#presets.get(id) ?? {})) {
          const clause = readingClause({ field: f, ...facts(f) }, reading);
          if (clause) parts.push({ clause });
        }
      }
      const chained = out.get(scope) ?? {};
      const newest = Object.keys(q.readings)
        .sort((a, b) => this.#recency.indexOf(`${scope}:${b}`) - this.#recency.indexOf(`${scope}:${a}`));
      for (const f of newest) {
        const reading = q.readings[f]!;
        if (reading.suspended || (scope !== VIEW && viewHolds.has(f))) continue;
        const state = this.#stateFor(f, reading);
        const picks = reading.picked ?? [];
        if (!this.#isListField(f) || state.mode !== 'simple' || state.range || state.op !== DEFAULT_OP || !picks.length) {
          const clause = readingClause({ field: f, ...facts(f) }, reading);
          if (clause) parts.push({ field: f, clause });
          continue;
        }
        const under = below.get(`${scope}:${f}`);
        const ruling = parts.filter((p) => !p.field || !under?.has(p.field)).map((p) => p.clause);
        const held = new Set((await this.#presentUnder([f], andFilter(ruling)))[f]);
        const aside = [...new Set([...(chained[f] ?? []), ...picks.map(valueKey).filter((k) => !held.has(k))])];
        if (aside.length) {
          if (!out.has(scope)) out.set(scope, {});
          out.get(scope)![f] = aside;
        }
        const clause = readingClause({ field: f, ...facts(f) }, withoutDropped(reading, aside));
        if (clause) parts.push({ field: f, clause });
      }
      return parts;
    };
    const viewed = await run(VIEW, [...this.#parts.values()].map((clause) => ({ clause })));
    for (const scope of Object.keys(this.#applied.scopes)) if (scope !== VIEW) await run(scope, viewed);
    return out;
  }

  /** Each SERIAL set's chain, by scope: the fields it holds, in the set's order.
   *  A field the View holds is answered there, so it is out of a component's chain. */
  #chains(): Array<[scope: string, chain: string[]]> {
    const viewHolds = new Set(this.#applied.scopes[VIEW]?.holds ?? []);
    const out: Array<[string, string[]]> = [];
    for (const [scope, sets] of this.#sets) {
      const holds = new Set(this.#applied.scopes[scope]?.holds ?? []);
      for (const set of sets) {
        if (set.mode !== 'serial') continue;
        const chain = set.fields.filter((f) => holds.has(f) && (scope === VIEW || !viewHolds.has(f)));
        if (chain.length > 1) out.push([scope, chain]);
      }
    }
    return out;
  }

  /** The fields BELOW each chained field, by `scope:field`. */
  #below(): Map<string, Set<string>> {
    const out = new Map<string, Set<string>>();
    for (const [scope, chain] of this.#chains()) {
      chain.forEach((f, i) => out.set(`${scope}:${f}`, new Set(chain.slice(i + 1))));
    }
    return out;
  }

  /** One field's answer as a clause, less the picks set aside. */
  #clauseOf(scope: string, field: string, aside: readonly string[] | undefined): Filter | undefined {
    const reading = this.#applied.scopes[scope]?.readings[field];
    if (!reading || reading.suspended) return undefined;
    return readingClause({ field, ...this.#facts(field) }, withoutDropped(reading, aside));
  }

  /** Down each serial chain: a list field keeps the picks the rows hold under
   *  the answers ABOVE it, and the rest are set aside. TRAP T-a-filter-set-groups-or-chains */
  async #chainAside(): Promise<Map<string, Record<string, string[]>>> {
    const out = new Map<string, Record<string, string[]>>();
    for (const [scope, chain] of this.#chains()) {
      const above: Filter[] = [];
      for (const f of chain) {
        const picks = this.#applied.scopes[scope]?.readings[f]?.picked ?? [];
        let aside: string[] = [];
        if (above.length && picks.length && this.#isListField(f)) {
          const held = new Set((await this.#presentUnder([f], andFilter(above)))[f]);
          aside = picks.map(valueKey).filter((k) => !held.has(k));
          if (aside.length) out.set(scope, { ...out.get(scope), [f]: aside });
        }
        const clause = this.#clauseOf(scope, f, aside);
        if (clause) above.push(clause);
      }
    }
    return out;
  }

  /**
   * What each field below the top of a SERIAL set OFFERS: the values the rows
   * hold under the answers above it, as value keys. A control REMOVES the rest
   * — but a pick it holds stays, set aside. Whatever `limitOptions` says.
   * TRAP T-a-filter-set-groups-or-chains
   */
  async offered(scope: string): Promise<Record<string, string[]>> {
    const out: Record<string, string[]> = {};
    const aside = this.#setAside.get(scope) ?? {};
    for (const [s, chain] of this.#chains()) {
      if (s !== scope) continue;
      const above: Filter[] = [];
      for (const f of chain) {
        if (above.length && this.#isListField(f)) Object.assign(out, await this.#presentUnder([f], andFilter(above)));
        const clause = this.#clauseOf(scope, f, aside[f]);
        if (clause) above.push(clause);
      }
    }
    return out;
  }

  /** Work out what is set aside; if it MOVED, compile again — the load that
   *  follows draws what is left. Says whether it moved. */
  async #settleSetAside(): Promise<boolean> {
    const ticket = (this.#settling = Symbol('aside'));
    const next = await this.#setAsideNow();
    if (this.#settling !== ticket) return true;
    const key = (m: Map<string, Record<string, string[]>>): string => JSON.stringify([...m].sort());
    if (key(next) === key(this.#setAside)) return false;
    this.#setAside = next;
    this.#presentFor = '';
    this.#recompose();
    return true;
  }
  /** The latest set-aside pass; an older one lands on nothing. */
  #settling: symbol | null = null;
  /** The picks set aside, by scope then field, as value keys. */
  #setAside = new Map<string, Record<string, string[]>>();

  /** Each answered field, oldest change first — `scope:field`. */
  #recency: string[] = [];
  /** Each reading as last seen, so a CHANGE moves its field to the end. */
  #lastSeen = new Map<string, string>();

  /** Move each field whose reading changed to the newest place. */
  #noteRecency(): void {
    const seen = new Set<string>();
    for (const [scope, q] of Object.entries(this.#applied.scopes)) {
      for (const [f, reading] of Object.entries(q.readings)) {
        const id = `${scope}:${f}`;
        seen.add(id);
        const now = JSON.stringify(reading.picked ?? []) + JSON.stringify(reading.suspended ?? false);
        if (this.#lastSeen.get(id) === now) continue;
        this.#lastSeen.set(id, now);
        this.#recency = [...this.#recency.filter((x) => x !== id), id];
      }
    }
    for (const id of [...this.#lastSeen.keys()]) {
      if (seen.has(id)) continue;
      this.#lastSeen.delete(id);
      this.#recency = this.#recency.filter((x) => x !== id);
    }
  }

  /** One pass this tick, however many asked. */
  #presentSoon(): void {
    if (this.#presentQueued) return;
    this.#presentQueued = true;
    queueMicrotask(() => {
      this.#presentQueued = false;
      void this.#settleSetAside().then((moved) => { if (!moved) void this.#drawPresent(); });
    });
  }
  /** A pass is queued for the end of this tick. */
  #presentQueued = false;

  /** Each bound control is told what each field's other answers leave — once
   *  per applied Query; a later pass wins. Off, each is told nothing is limited.
   *  A chart's own scope too, announced as `present` for its legend (179). */
  async #drawPresent(): Promise<void> {
    const drawn = [...this.#bound].flatMap(([el, b]) => ((el.drawPresent || el.drawOffered) && b.scope
      ? [{ el, scopes: typeof b.scope === 'string' ? [b.scope] : [...b.scope, ...this.#narrowing.keys()] }] : []));
    const parts = [...this.#narrowing.keys()];
    const key = `${this.#limitOptions}:${drawn.length}:${parts.join()}:${JSON.stringify(this.#applied)}`;
    if ((!drawn.length && !parts.length) || key === this.#presentFor) return;
    this.#presentFor = key;
    const ticket = (this.#presenting = Symbol('present'));
    const byScope = new Map<string, Record<string, string[]>>();
    const offers = new Map<string, Record<string, string[]>>();
    for (const scope of new Set([...drawn.flatMap((d) => d.scopes), ...parts])) {
      byScope.set(scope, await this.present(scope));
      offers.set(scope, await this.offered(scope));
      if (this.#presenting !== ticket) return;
    }
    for (const { el, scopes } of drawn) {
      for (const scope of scopes) {
        el.drawPresent?.(byScope.get(scope) ?? {}, scope);
        el.drawOffered?.(offers.get(scope) ?? {}, scope);
      }
    }
    this.dispatchEvent(new CustomEvent('present', { detail: { byScope: Object.fromEntries(byScope) } }));
  }
  /** The latest pass; an older one lands on nothing. */
  #presenting: symbol | null = null;
  /** What the last pass was for: the setting, the controls and the applied Query. */
  #presentFor = '';

  /** The latest results count; an older one lands on nothing. */
  #counting: symbol | null = null;
  /** The applied Query the chips' results were last counted for, as JSON. */
  #countedFor = '';

  /** The ViewState as one comparable string. Key order is stable by construction. */
  #stateKey(): string {
    return JSON.stringify(this.#loadOptions());
  }

  /* ── Binding ───────────────────────────────────────────────────────── */

  /** Take a component its binder has wired, and send it what is already
   *  loaded. `bindSource()` is the way in. TODO 196 */
  attach(el: Populatable, facts: AttachFacts, sink: BindSink): void {
    const had = this.#componentScopes();
    this.#bound.set(el, {
      id: facts.id ?? (el.id || `bind-${++this.#binds}`),
      readonly: facts.readonly ?? false,
      steerOnly: facts.steerOnly ?? false,
      rows: facts.rows ?? 'page',
      sink,
      ...(facts.scope ? { scope: facts.scope } : {}),
      ...(facts.shows ? { shows: facts.shows } : {}),
    });
    this.#rescope(had);

    // Whatever is already loaded, so a component bound late is not blank.
    this.#push(el);
    if (Array.isArray(facts.scope) && el.drawScopes) this.#drawScopesSoon();
    if (typeof facts.scope === 'string' && el.supersedeColumns) this.#syncColumns();
    // …and what each field's other answers leave. TRAP T-a-ruled-out-value-is-greyed
    if (facts.scope && (el.drawPresent || el.drawOffered) && this.#loaded) this.#presentSoon();
    /* A summary bound AFTER the first load would otherwise draw blank: the
       unpaged set is fetched by `load`, and nothing would ask for it again.
       TRAP T-a-summary-binds-to-all-the-rows */
    const needsAll = facts.rows === 'all' && !this.#allRows.length;
    if (this.#autoLoad && (!this.#result.rows.length || needsAll)) {
      void this.load({ force: needsAll });
    }
  }

  /** Every row a bound component is under, UNPAGED — what "Select all rows"
   *  ticks on a grid that holds one page. TODO 238 · TRAP T-select-all-is-the-visible-rows */
  async allRows(el?: Populatable): Promise<readonly Row[]> {
    const { skip: _skip, take: _take, ...options } = this.#loadOptions();
    const { rows } = await this.store.load(options);
    const entry = el ? this.#bound.get(el) : undefined;
    const own = entry ? this.#only[entry.id] : undefined;
    return own ? filterRows(rows, own) : rows;
  }

  /** Stop steering and stop populating this component. */
  unbind(el: Populatable): void {
    const had = this.#componentScopes();
    this.#bound.get(el)?.sink.off();
    this.#bound.delete(el);
    this.#rescope(had);
  }

  /** A scope that gained or lost its last component changes who it reaches —
   *  recompiled only when it answers something. TRAP T-only-the-view-trickles-down */
  #rescope(had: ReadonlySet<string>): void {
    const now = this.#componentScopes();
    const moved = [...new Set([...had, ...now])].filter((s) => had.has(s) !== now.has(s));
    if (moved.some((s) => s in this.#applied.scopes)) this.#recompose();
  }

  /** Every component currently bound. */
  get boundElements(): Populatable[] {
    return [...this.#bound.keys()];
  }

  /* ── What a control asks, by name — what the steering calls ─────────── */

  /** A scoped bar's whole answer: what it holds, each field's reading, and its
   *  saved filters on or off, whose readings go to the library. It is its Apply.
   *  TRAP T-a-bar-reports-its-holds · TRAP T-one-query-one-owner */
  answerScope(scope: string, answer: {
    holds?: readonly string[];
    readings: Record<string, FieldReading>;
    presets?: Record<string, { on: boolean; readings: Record<string, FieldReading> }>;
  }): void {
    if (answer.holds) this.hold(scope, [...answer.holds]);
    const presets = answer.presets ?? {};
    for (const [id, p] of Object.entries(presets)) this.#presets.set(id, p.readings);
    this.answer(scope, answer.readings, Object.fromEntries(Object.entries(presets).map(([id, p]) => [id, p.on])));
    // A bar's report IS its Apply: its menus waited for it, remote.
    this.commit();
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
    if (fresh) this.#drawBars(scope);
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
      this.#drawBars(scope);
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
    this.#publish();
  }

  /* ── Publishing ────────────────────────────────────────────────────── */

  /** Push rows and state to every bound component. */
  #publish(): void {
    for (const el of this.#bound.keys()) this.#push(el);
  }

  /** Give one component the rows and the view state. TRAP T-push-writes-state-as-attributes */
  #push(el: Populatable): void {
    const entry = this.#bound.get(el);
    if (!entry) return;
    const { sort, group, page, pageSize, sortSuspended } = this.#state;
    const filter = this.#filter;
    const first = sort[0];

    /* The FIELD survives a suspend; the DIRECTION says whether it is applied.
       TRAP T-a-suspended-sort-is-one-owners-job */
    const shown = first ?? sortSuspended;
    entry.sink.view({
      sortField: shown?.field,
      sortDirection: first ? (first.direction ?? 'asc') : (sortSuspended ? '' : undefined),
      groupField: group ?? undefined,
      filterFields: filterFields(filter),
      /* …and WHAT it matched on, so a component can point at the hit, whichever
         control set the filter. TRAP T-a-needle-comes-from-either-direction */
      needles: [filterNeedles(filter), this.#searchNeedles()].filter(Boolean).join('\n'),
      paging: pageSize ? { page, totalPages: this.totalPages, pageSize } : undefined,
    });

    // …but the ROWS go only where they mean something. TRAP T-steer-only-populate-means-chips
    if (entry.steerOnly) return;

    // Skip a push that would hand over the same rows again.
    // TRAP T-no-op-load-guard
    // TRAP T-adapter-lives-at-the-binding — guard the ROWS ARRAY, not a payload.
    const base = entry.rows === 'all' ? this.#allRows : this.#result.rows;
    /* What narrows THIS component alone, on top of the shared query — and, for
       a summary bound INTO a component scope, that scope's answer.
       TRAP T-a-component-part-narrows-one-component */
    const into = entry.rows === 'all' && typeof entry.scope === 'string' ? this.#scoped[entry.scope] : undefined;
    const own = andFilter([this.#only[entry.id], into].filter((f): f is Filter => !!f));
    const ownKey = JSON.stringify(own ?? null);
    if (entry.lastRows === base && entry.lastOwn === ownKey) return;
    entry.lastRows = base;
    entry.lastOwn = ownKey;
    entry.sink.rows(own ? filterRows(base, own) : base);
  }
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
    || (reading.conditions ?? []).some((r) => (r.text ?? '').trim() !== '' || (r.picked ?? []).length > 0)
    // The other shape's answer is worth keeping too. TRAP T-both-shapes-are-kept
    || (!!reading.kept && answers(reading.kept));
}

/** The ANSWER keys of a reading only — a bar's reading also carries its label
 *  and every value it offers, which are facts, not what the reader chose. */
function answerOf(reading: FieldReading): FieldReading {
  const out: Record<string, unknown> = {};
  for (const key of READING_KEYS) if (reading[key] !== undefined) out[key] = reading[key];
  return out as FieldReading;
}
// A key left off this list is DROPPED, silently. TRAP T-both-answers-are-kept
const READING_KEYS = ['picked', 'present', 'op', 'text', 'conditions', 'mode', 'mirror', 'range', 'kept', 'suspended'] as const;

