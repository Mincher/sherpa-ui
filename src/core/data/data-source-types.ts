/**
 * data-source-types.ts — the shapes a DataSource takes and hands out: plain
 * JSON and callbacks, no code.
 *
 * Map:
 * - FieldDeclaration — What a field IS, said once — its kind, its name, and how a control answers it.
 * - FieldFilter — A field's filter as any bar or panel draws it — its declaration and values.
 * - QueryState — A Query's whole question as JSON: the Query as applied, with its arrangement.
 * - HeldFilter — One filter a scope holds, as a control draws it.
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
import type { Condition, Filter, FilterOp, LoadResult, Row, SortDirection, SortSpec, Store } from './store.js';
import type { FieldReading, FieldType } from './filter-state.js';
import type { Presentation, Query } from './query.js';
import type { QueryContext } from './query-context.js';

/** What a field IS, said once — its kind, its name, and how a control answers
 *  it. JSON. TRAP T-a-field-is-declared-once */
export interface FieldDeclaration {
  type?: FieldType;
  label?: string;
  select?: 'single' | 'multiple';
  /** Advanced conditions beside its values (`true`), or instead of them (`'only'`). */
  advanced?: boolean | 'only';
  /** Each value's look, a Style mode — a status field's, as its store says. Plan 683 */
  statuses?: Record<string, string>;
  /** Each value's condition tree, as its store says — a status field's. Plan 683 */
  when?: Record<string, Condition>;
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
  /** Its chip's glyph. TRAP T-only-five-filter-chips-carry-an-icon */
  icon?: string;
  /** What it is, in a few words: its chip's tip says it, in lines. Will, TODO 691 */
  description?: string;
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
  /** A number's own values, which only its Equals rows list: never rows to tick. Will, TODO 668 */
  listed?: { value: string; label: string }[];
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
  /** Its page fixes it here: a reader cannot remove it. Will, TODO 703 */
  fixed?: boolean;
  /** …or switch it off. */
  alwaysOn?: boolean;
  /** The page's own: its definition holds it here. TODO 452 */
  own?: boolean;
  /** An app's PRESET: a boolean chip with its own conditions. Will, TODO 493 */
  preset?: boolean;
  /** A preset's on. */
  active?: boolean;
  /** The App Context holds it; this page has no such field. TODO 453 */
  unused?: boolean;
  /** The scope its answer is in, where not its bar's: a chart's legend, drawn in its
   *  card's toolbar. Will, TODO 670 */
  answeredIn?: string;
  /** A scope ABOVE holds it now — that scope's name. It keeps its place here,
   *  and its `state` is this scope's own answer: kept, not in force.
   *  TRAP T-a-superseded-chip-suspends-it-is-never-removed */
  appliedAt?: string;
  /** The ONE scope a View field is SENT DOWN to: the one it came up from
   *  (`origin`), else the first that has it. TRAP T-send-to-view-filters */
  sendTo?: { scope: string; label: string; origin?: boolean };
}

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
  /** The component it narrows, by its tag: a panel says it under the scope's name.
   *  TODO 457 · TRAP T-a-scope-says-what-it-shows */
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
  /** The field soloed in it, in this tab. TRAP T-a-solo-is-a-draft-of-one-tab */
  soloed?: string;
  /** A SLOT: a chart draws here, and its Group and Sort are its presentation's, not the
   *  rows'. `chartFields` its Primary and Secondary may pick — none while the app turns them off (TODO 583);
   *  `primaryField` and `secondaryField` are in force;
   *  `stacks`, its chart takes a Secondary — a bar chart. TODO 548
   *  `whole`, its chart draws one number, so it offers no Primary, Group or Sort. TODO 696 */
  presents?: boolean;
  whole?: boolean;
  chartFields?: OrganiseColumn[];
  /** What its Secondary may pick; `chartFields` are its Primary's. Each as the app offers it. Will, TODO 660 */
  secondaryFields?: OrganiseColumn[];
  primaryField?: string;
  /** The Primary its definition names: what Default picks. Will, TODO 572 */
  primaryDefault?: string;
  secondaryField?: string;
  /** Its Secondary, switched off: the field its chip keeps. Off is not gone. Will, TODO 666 */
  secondaryOff?: string;
  stacks?: boolean;
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
  /** The clock its relative dates read. Left out, the machine's. TRAP T-a-rule-names-its-clock-and-its-language */
  now?: () => Date;
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
  /** A REMOTE store's whole set is held, up to this many rows, by the HeldStore
   *  the source reads it through, and every question is answered from it on the
   *  client. Default 100 000; 0 holds none, and asks the store. Will, TODO 340.
   *  TRAP T-a-remote-source-holds-its-whole-set */
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
  /** Fields that never NARROW it, with `rows: 'all'`: its rows are the View's
   *  less any clause on them, its own part's too — a gauge over its own zones,
   *  which they only light. Will, TODO 479. TRAP T-a-chart-is-free-of-its-own-field */
  free?: readonly string[];
  /** A chart's own presentation, by its attributes: what its slot shows until
   *  the reader changes it. Will, TODO 548 */
  shows?: Presentation;
  /** It stacks each segment by a Secondary — a bar chart. Will, TODO 548 */
  stacks?: boolean;
  /** It draws ONE number, which no axis, Group or Sort changes — a gauge. Will, TODO 696 */
  whole?: boolean;
  /** Its scope's rows are ARRANGED here, though it reads every row: a grid's
   *  pivot, whose rows' sub-grids its Group and Sort arrange. Will, TODO 574 */
  arranges?: boolean;
}

/** What a bound component is told of the view; `undefined` is none. The binder
 *  writes it as `data-*`. TRAP T-push-writes-state-as-attributes */
export interface BoundView {
  /** The sort's field, kept while the sort is suspended. TRAP T-a-suspended-sort-is-one-owners-job */
  sortField: string | undefined;
  /** `''` while the sort is suspended. */
  sortDirection: SortDirection | '' | undefined;
  groupField: string | undefined;
  /** The scope whose Group and Sort arrange the rows: only its controls are told them. None, every one is. */
  arrangedIn: string | undefined;
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
  /** Its scopes' pending fields, whether one is dirty or waits, the fields that failed to
   *  fetch, and each pending field's APPLIED answer. TRAP T-apply-and-discard-wait-for-a-change */
  pending(fields: readonly string[], dirty: boolean, waits: boolean, failed: readonly string[],
    applied: Readonly<Record<string, FieldReading>>): void;
  /** The source let it go. */
  off(): void;
  /** What the component is, as a panel names it under its scope — its tag and
   *  `data-type`, `sherpa-radial-chart:pie` — read live: Show as may swap it.
   *  The source names no tag itself. TRAP T-a-scope-says-what-it-shows */
  name?(): string | undefined;
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
  /** Each answered chip's results — the rows its own answer matches; `end`, the rows the
   *  scope's filters leave, only while one there is in force. */
  drawResults?: (results: Readonly<Record<string, number>>, scope?: string, end?: number) => void;
  /** What each field that waits for Apply holds APPLIED — every one named, an empty answer where
   *  nothing is — so a control that draws a chip per value marks only those its draft changed.
   *  TODO 424 · TRAP T-a-pending-chip-reads-as-a-warning */
  drawApplied?: (applied: Readonly<Record<string, FieldReading>>) => void;
  /** Mark each row the highlight's driver matches; `null`, none. TODO 441 */
  drawHighlight?: (matches: ((row: Row) => boolean) | null) => void;
  /** Its rows are being read again; false, the read is done. Plan 695 P4 */
  drawLoading?: (loading: boolean) => void;
  /** Each PICKED value's own results, by field then value — for a control that draws a chip per value. */
  drawValueResults?: (results: Readonly<Record<string, Readonly<Record<string, number>>>>, scope: string) => void;
  /** Each field's values the filters before it leave, as value keys; a field not named is not limited. */
  drawPresent?: (present: Readonly<Record<string, readonly string[]>>, scope: string) => void;
  /** Each serial-set field's values to OFFER, as value keys; the rest are removed. A field not named offers all. */
  drawOffered?: (offered: Readonly<Record<string, readonly string[]>>, scope: string) => void;
  /** A control over SEVERAL scopes — the panel — drawn each one whole. */
  drawScopes?: (scopes: ScopeDescription[]) => void | Promise<void>;
  /** Told the fields a scope ABOVE it holds now, each with its answer there, and that
   *  scope's name. A field not named is free. TRAP T-one-field-one-status */
  supersede?: (readings: Readonly<Record<string, FieldReading>>, appliedAt?: string) => void;
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
