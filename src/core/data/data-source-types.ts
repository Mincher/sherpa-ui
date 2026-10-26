/**
 * data-source-types.ts — the shapes a DataSource takes and hands out: plain
 * JSON and callbacks, no code.
 *
 * Map:
 * - FieldDeclaration — What a field IS, said once — its kind, its name, and how a control answers it.
 * - FieldFilter — A field's filter as any bar or panel draws it — its declaration and values.
 * - QueryState — A Query's whole question as JSON: the Query as applied, with its arrangement.
 * - HeldFilter — One filter a scope holds, as a control draws it.
 * - ScopeShows — What a scope's filters narrow: the View, or the content one component shows.
 * - FilterSet — Fields a scope draws as ONE group.
 * - OrganiseColumn — One column a Group or Sort chip offers: the field it reports, and its name.
 * - ScopeDescription — One scope as a control draws it whole, as JSON.
 * - ViewState — The view state a source owns.
 * - DataSourceOptions — the store, and the view it opens on: page size, search fields
 * - AttachFacts — What the binder tells the source about one component.
 * - BoundView — What a bound component is told of the view; `undefined` is none.
 * - BindSink — Where the source sends one bound component's view, rows and pending fields.
 * - BoundControl — What a bound control may be drawn: each member optional, read when the source draws.
 * - DataChangeDetail — What `change` carries, for a listener that wants the result without asking.
 */
import type { Filter, FilterOp, LoadResult, Row, SortDirection, SortSpec, Store } from './store.js';
import type { FieldReading, FieldType } from './filter-state.js';
import type { Query } from './query.js';
import type { QueryContext } from './query-context.js';
import type { Threshold } from './threshold.js';

/** What a field IS, said once — its kind, its name, and how a control answers
 *  it. JSON. TRAP T-a-field-is-declared-once */
export interface FieldDeclaration {
  type?: FieldType;
  label?: string;
  select?: 'single' | 'multiple';
  /** Advanced conditions beside its values (`true`), or instead of them (`'only'`). */
  advanced?: boolean | 'only';
  /** The condition its filter opens on. */
  op?: FilterOp;
  /** A DATE that holds a time of day: its Advanced rows offer a time too. TODO 21d */
  time?: boolean;
  /** A DATE whose menus pick two ENDS, from and to. Left out, they pick days.
   *  TRAP T-a-date-picks-days-unless-it-says-range */
  range?: boolean;
  /** A number filter's ends, and its step. */
  min?: number;
  max?: number;
  step?: number;
  /** A number's BANDS, low to high — declared once, read by a gauge's zones, a
   *  bar chart's bands and a saved filter's `band`. TRAP T-a-threshold-is-a-fact-of-the-field */
  thresholds?: readonly Threshold[];
  /** Its chip's glyph. TRAP T-only-five-filter-chips-carry-an-icon */
  icon?: string;
  /** The named SECTION its chip sits in, where a bar heads its sections; none,
   *  a section of its own, named for it. Will, TODO 438 */
  section?: string;
  /** A value's name as a reader sees it, where it is not the value. */
  labels?: Record<string, string>;
  /** Its answer SURVIVES a View change that does not answer it; else a View
   *  resets it. TRAP T-a-field-can-carry-over-views */
  carryOver?: boolean;
  /** The field holding this one's CHILD values — a Customer's Site. A child has
   *  no filter of its own: its picks are in this field's reading. TODO 369 */
  child?: string;
  /** `server`: its filter is ASKED of the store, never worked out from rows held —
   *  once per answer, for the keys it matches. TRAP T-a-server-field-is-asked-once-per-answer */
  fetch?: 'server';
  /** What a FETCHING list opens on: `first`, its first value (the default), or
   *  `all`, no filter. Will, TODO 403 · TRAP T-a-fetching-list-opens-on-its-first-value */
  start?: 'first' | 'all';
}

/** A field's filter as any bar or panel draws it — its declaration and values. */
export interface FieldFilter extends Omit<FieldDeclaration, 'type'> {
  id: string;
  label: string;
  /** A number or a date draws a control of its own; any other field, its values. */
  kind?: 'number' | 'date';
  /** `swatch`: the data-viz series a chart draws this value in, from 1, or a
   *  band's status. `parent`: a tiered field's child value names its parent's
   *  key (TODO 369). */
  options?: { value: string; label: string; swatch?: number | string; parent?: string }[];
  /** Its values are still being read: a menu shows a loading row. 345 phase 5 */
  loading?: boolean;
  /** A date's days that have records — every other day draws inactive. */
  availableDates?: string[];
  /** Its picks are ENDS from the start — the View's date. TRAP T-a-range-is-bounded-by-the-data */
  range?: boolean;
  /** Where it lives now, when an Add list offers it from another scope. */
  note?: string;
}

/** A Query's whole question, as JSON — to send out and take back in: the
 *  Query as applied, with its arrangement. TRAP T-a-page-goes-out-as-json */
export interface QueryState {
  v: 1;
  query: Query;
}

/** One filter a scope holds, as a control draws it. */
export interface HeldFilter extends FieldFilter {
  /** Its answer in the Query, where it has one. */
  state?: FieldReading;
  removable?: boolean;
  /** The page's own: its definition holds it here. TODO 452 */
  preset?: boolean;
  /** The App Context holds it; this page has no such field. TODO 453 */
  unused?: boolean;
  /** A scope ABOVE holds it now — that scope's name. It keeps its place here,
   *  and its `state` is this scope's own answer: kept, not in force.
   *  TRAP T-a-superseded-chip-suspends-it-is-never-removed */
  appliedAt?: string;
  /** The ONE scope a View field is SENT DOWN to: the one it came up from
   *  (`origin`), else the first that has it. TRAP T-send-to-view-filters */
  sendTo?: { scope: string; label: string; origin?: boolean };
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

/** One column a Group or Sort chip offers: the field it reports, and its name. */
export interface OrganiseColumn {
  field: string;
  label: string;
}

/** One scope as a control draws it WHOLE — what it holds and answers, what it
 *  may add, and how its rows are arranged. JSON. TRAP T-a-panel-asks-for-its-scopes */
export interface ScopeDescription {
  scope: string;
  label: string;
  /** What it narrows, as its bound component says. TRAP T-a-scope-says-what-it-shows */
  shows?: ScopeShows;
  /** …and WHICH component, by its tag: a panel says it under the scope's name. TODO 457 */
  component?: string;
  /** A PART: one component's own answer to ONE field — a chart's legend field.
   *  Nothing is added to it or saved from it. TRAP T-a-chart-scope-is-its-legend-field */
  part?: boolean;
  filters: HeldFilter[];
  available: FieldFilter[];
  /** Its filter sets, each drawn as one group. TRAP T-a-filter-set-groups-or-chains */
  sets?: FilterSet[];
  group?: OrganiseColumn[];
  sort?: OrganiseColumn[];
  groupField?: string;
  sortField?: string;
  sortDirection?: SortDirection;
  /** Its bar's filter Switch is OFF. TRAP T-the-filter-switch-keeps-what-it-turned-off */
  suspended?: boolean;
}

export interface ViewState {
  /** The filter the Query compiles to. Read only. */
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
  /** The QueryContext it joins. Left out, it makes its own. 366 step 12 */
  query?: QueryContext;
  /** Rows per page. Omit for no paging. */
  pageSize?: number;
  /** Fields a free-text search looks at. Omit to search every field. */
  searchFields?: string[];
  /** Load as soon as the first component binds. Default true. */
  autoLoad?: boolean;
  /** Each list field offers only the values the filters before it leave; the rest
   *  are drawn greyed. Default false. TRAP T-a-ruled-out-value-is-greyed */
  limitOptions?: boolean;
  /** `'input'`: a filter applies LIVE, while its value moves, `debounce` ms after
   *  the last move. Default `'change'`, once per act. A remote source always waits
   *  for Apply. Will, TODO 107. TRAP T-coalesce-microtask-not-debounce */
  applyOn?: 'change' | 'input';
  /** How long a live filter waits after the last move, in ms. Default 300. */
  debounce?: number;
  /** A REMOTE store's whole set is held, up to this many rows, and every
   *  question is answered from it on the client. Default 50 000; 0 holds none.
   *  Will, TODO 340. TRAP T-a-remote-source-holds-its-whole-set */
  holdRows?: number;
  /** A held store sends only the PAGE's fields: what it declares, holds and
   *  answers, and what its components name. A source opened from a page
   *  definition does; any other reads every field. TRAP T-a-held-set-reads-the-pages-fields */
  pageFields?: boolean;
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
  /** The fields it reads from a row. A component given rows that names none
   *  reads every field. TRAP T-a-held-set-reads-the-pages-fields */
  fields?: readonly string[];
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
  /** The chip that drives the highlight. TODO 441 */
  highlight: { scope: string; field: string } | undefined;
  paging: { page: number; totalPages: number; pageSize: number } | undefined;
}

/** Where the source sends one bound component's view, rows and pending fields. */
export interface BindSink {
  view(view: BoundView): void;
  /** A page, or every row — never to a steer-only bind. */
  rows(rows: readonly Row[]): void;
  /** Its scopes' pending fields, whether one is dirty or waits, the fields that failed to
   *  fetch, and each pending field's APPLIED answer. TRAP T-apply-and-discard-wait-for-a-change */
  pending(fields: readonly string[], dirty: boolean, waits: boolean, failed: readonly string[],
    applied: Readonly<Record<string, FieldReading>>): void;
  /** The source let it go. */
  off(): void;
}

/** What a bound control may be DRAWN: each member optional, read when the source draws. The source keys its binds by it. */
export interface BoundControl {
  /** The id a scope's narrows names it by, where AttachFacts gives none. */
  readonly id?: string;
  /** One field's answer, drawn SILENTLY — a bound bar told what its scope now holds. */
  drawReading?: (field: string, reading: FieldReading, scope: string) => void;
  /** A whole scope, drawn SILENTLY — its chips, answers and presets — as the panel draws
   *  each; `live` reads it again, for a bar that paints after a wait. */
  drawScope?: (scope: ScopeDescription, live?: () => ScopeDescription) => void | Promise<void>;
  /** The fields a bar holds now, in its order. */
  readonly heldFields?: readonly string[];
  /** Each answered chip's results — the rows its own answer matches. */
  drawResults?: (results: Readonly<Record<string, number>>, scope?: string) => void;
  /** What each field that waits for Apply holds APPLIED — every one named, an empty answer where
   *  nothing is — so a control that draws a chip per value marks only those its draft changed.
   *  TODO 424 · TRAP T-a-pending-chip-reads-as-a-warning */
  drawApplied?: (applied: Readonly<Record<string, FieldReading>>) => void;
  /** Mark each row the highlight's driver matches; `null`, none. TODO 441 */
  drawHighlight?: (matches: ((row: Row) => boolean) | null) => void;
  /** Each PICKED value's own results, by field then value — for a control that draws a chip per value. */
  drawValueResults?: (results: Readonly<Record<string, Readonly<Record<string, number>>>>, scope: string) => void;
  /** Each field's values the filters before it leave, as value keys; a field not named is not limited. */
  drawPresent?: (present: Readonly<Record<string, readonly string[]>>, scope: string) => void;
  /** Each serial-set field's values to OFFER, as value keys; the rest are removed. A field not named offers all. */
  drawOffered?: (offered: Readonly<Record<string, readonly string[]>>, scope: string) => void;
  /** A control over SEVERAL scopes — the panel — drawn each one whole. */
  drawScopes?: (scopes: ScopeDescription[]) => void | Promise<void>;
  /** Told which of its fields a scope ABOVE it holds now, and that scope's name. */
  supersede?: (fields: readonly string[], appliedAt?: string) => void;
  /** A grid: those fields WITH their answers there, shown read-only in its headings. */
  supersedeColumns?: (readings: Readonly<Record<string, FieldReading>>, appliedAt?: string) => void;
  superseded?: string[];
  /** Announce its whole answer again. */
  report?: () => void;
}

/** What `change` carries, for a listener that wants the result without asking. */
export interface DataChangeDetail extends LoadResult {
  state: ViewState;
  /** No row came back, and why: the data holds none, or the question matched none. Absent while rows came. */
  emptiness?: 'empty' | 'no-matches';
  /** Held rows the store has not confirmed: they are being checked behind, or the
   *  store cannot be reached. TRAP T-a-read-is-planned */
  stale?: true;
}
