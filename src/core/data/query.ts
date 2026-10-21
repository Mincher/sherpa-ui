/**
 * query.ts — the ONE state a page's data is under, in the reader's own terms.
 *
 * Scopes that hold fields, each field's reading, the saved filters that are
 * on, and a scope's sort, group, search and page. It is DATA: saved, restored
 * and shared as it is, and compiled into a filter only on demand — a clause is
 * output, never state. See docs/QUERY-DESIGN.md.
 *
 * DOM-free, like everything in this folder. TRAP T-one-query-one-owner
 *
 * Map:
 * - Query — Every scope's setup, as plain data — what a page's data is under.
 * - ScopeQuery — One scope: the fields it holds, each one's reading, and how it arranges rows.
 * - QueryDefaults — A Query as a DEFINITION states it — a saved View, in JSON.
 * - QueryRequest — One reader act, as a control asks it of the Query; a list is one change.
 * - SavedFilter — A saved filter: a name, and each scope's filters as a View writes them.
 * - isSavedFilter — Is this a saved filter — a name, and a query definition?
 * - ViewScope — One scope as a View writes it: each field's condition in the plain form.
 * - Arrangement — How a Query arranges its rows: the ONE scope that sorts, groups, keeps a suspended sort or searches.
 * - arranging — Does a scope arrange — a sort, a group, a suspended sort or a search?
 * - arrangementOf — How a Query arranges its rows; none, an empty arrangement.
 * - withoutArrangement — The Query with no arrangement: what filters, and nothing of the order.
 * - CompileFacts — What compiling needs to know that the Query does not say.
 * - withoutDropped — A reading without the picks set aside.
 * - Compiled — A Query as the source runs it: one shared filter, and each one-component filter.
 * - VIEW — The id of the page's own scope, which every component scope sits under.
 * - emptyScope — A scope that holds and answers nothing yet, for a caller to fill.
 * - narrowsOne — Does this scope narrow only the components it names?
 * - eachScope — Each scope that answers for the page, by id, as a copy.
 * - heldInView — The fields the View holds, which are answered there alone.
 * - answerOf — The ANSWER keys of a reading only, not its label or the values it offers.
 * - copyQuery — A Query's own copy, all the way down — no clone a load pays for.
 * - copyReading — A reading's own copy, all the way down — what a caller hands in.
 * - freezeReading — Freeze a reading all the way down — what the Query keeps and hands out.
 * - readingAnswered — Does a reading answer anything? An empty condition row does not.
 * - sameReading — Do two readings give the same answer? Only the answer keys count.
 * - filterKey — A filter as one string, its AND and OR children in one order.
 * - appliesIn — Does a scope's reading of a field apply?
 * - scopeClauses — One scope's clauses: each reading that applies, each saved filter on.
 * - compile — Turn a Query into what the source runs — the ONE place a Query becomes a filter.
 */
import { andFilter, valueKey, type Filter, type SortSpec } from './store.js';
import { readingClause, type FieldFacts, type FieldReading } from './filter-state.js';
import { report } from './report.js';
import type { Where } from './where.js';

/** Every scope's setup, as plain data — what a page's data is under. */
export interface Query {
  /** The version of the SHAPE, not of the data. */
  v: 1;
  /** One entry per scope, by id. `VIEW` is the page's own. */
  scopes: Record<string, ScopeQuery>;
}

/** One scope: the fields it holds, each one's reading, and how it arranges rows. */
export interface ScopeQuery {
  /** The fields this scope holds, in order — the chips on its bar. */
  holds: string[];
  /** Each field's answer — the shape every filter control reports. The View's
   *  may answer a field no bar holds: a legend, or a column heading. */
  readings: Record<string, FieldReading>;
  /** The ONLY bound components this scope narrows — a legend's own chart.
   *  Absent, it narrows every one. TRAP T-a-component-part-narrows-one-component */
  narrows?: string[];
  /** The View's only: the scope each field it holds came UP from, so "Return to"
   *  outlives a reload. TODO 235 · TRAP T-send-to-view-filters */
  from?: Record<string, string>;
  /** Its bar's filter Switch is OFF: the fields it switched off, so ON brings
   *  back exactly those. TRAP T-the-filter-switch-keeps-what-it-turned-off */
  suspended?: { fields: string[] };
  /** How this scope arranges its rows. ONE scope arranges at a time.
   *  TRAP T-group-and-sort-are-component-scope */
  sort?: SortSpec[];
  group?: string | null;
  /** A sort switched off, kept so one press brings it back. TRAP T-a-suspended-sort-is-one-owners-job */
  sortSuspended?: SortSpec;
  /** The rows' free-text search, with the arrangement. */
  search?: string;
}

/** How a Query arranges its rows: the ONE scope that sorts, groups, keeps a suspended sort or searches. */
export interface Arrangement {
  sort: SortSpec[];
  group: string | null;
  sortSuspended?: SortSpec;
  search: string;
  scope?: string;
}

/** Does a scope arrange — a sort, a group, a suspended sort or a search? */
export const arranging = (s: ScopeQuery): boolean =>
  !!s.sort?.length || s.group != null || !!s.sortSuspended || !!s.search;

/** How a Query arranges its rows; none, an empty arrangement. 366 step 8 */
export function arrangementOf(query: Query): Arrangement {
  for (const [scope, s] of Object.entries(query.scopes)) {
    if (!arranging(s)) continue;
    return {
      sort: s.sort ?? [], group: s.group ?? null, ...(s.sortSuspended ? { sortSuspended: s.sortSuspended } : {}),
      search: s.search ?? '', scope,
    };
  }
  return { sort: [], group: null, search: '' };
}

/** The Query with no arrangement: what filters, and nothing of the order. A
 *  scope that only arranged is left out. */
export function withoutArrangement(query: Query): Query {
  const scopes: Record<string, ScopeQuery> = {};
  for (const [id, s] of Object.entries(query.scopes)) {
    const { sort: _s, group: _g, sortSuspended: _o, search: _f, ...rest } = s;
    const bare = Object.keys(rest).length === 2 && !rest.holds.length && !Object.keys(rest.readings).length;
    if (!(bare && arranging(s))) scopes[id] = rest;
  }
  return { v: 1, scopes };
}

/**
 * A Query as a DEFINITION states it — a saved View, in JSON. Each scope names
 * only what it sets: a scope with no `holds` keeps what it holds now, and a
 * field it answers is held there. Its `sort`, `group` and `search` arrange the
 * rows. TRAP T-a-view-is-json
 */
export interface QueryDefaults {
  v: 1;
  scopes: Record<string, ViewScope>;
}

/** One reader act, as a control asks it of the Query: one field's answer, one
 *  field or a whole scope switched off or on, a reset — or a list of them,
 *  which is one change. `scope` is the bind's when left out; `commit` is a
 *  bar's or a heading's Apply. 366 step 18 · TRAP T-one-query-one-owner */
export type QueryRequest =
  | { scope?: string; field: string; reading: FieldReading | null; commit?: true }
  | { scope?: string; field: string; suspended: boolean; commit?: true }
  | { scope?: string; suspended: boolean; commit?: true }
  | { scope?: string; reset: { carry?: boolean; organise?: boolean }; commit?: true }
  | readonly QueryRequest[];

/** A saved filter: a name, and each scope's filters as a View writes them —
 *  a query definition, a page's own or a reader's. Will, 366. TRAP T-saved-filters-are-every-scope */
export interface SavedFilter {
  label: string;
  query: QueryDefaults;
}

/** Is this a saved filter — a name, and a query definition? */
export function isSavedFilter(v: unknown): v is SavedFilter {
  const plain = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
  return plain(v) && typeof v['label'] === 'string' && plain(v['query'])
    && v['query']['v'] === 1 && plain(v['query']['scopes']);
}

/** One scope as a View writes it: each field's condition in the plain form.
 *  TRAP T-one-way-to-write-a-condition */
export interface ViewScope extends Partial<Omit<ScopeQuery, 'readings'>> {
  /** `{ openTickets: { gt: 0 } }` — numbers as numbers. */
  where?: Where;
}

/** What compiling needs to know that the Query does not say. */
export interface CompileFacts {
  /** A field's facts — its type, label and values — as `fieldState` takes them. */
  field?: (field: string) => Omit<FieldFacts, 'field'>;
  /** The scopes a COMPONENT answers. One no component answers is the page's,
   *  and trickles down with the View. Absent: every scope but the View is a
   *  component's. TRAP T-only-the-view-trickles-down */
  components?: ReadonlySet<string>;
  /** A component's OWN scopes — its `data-where` — which are what it IS, not a
   *  chip: a field the View holds never sets them aside. TRAP T-a-component-default-outlives-a-view */
  fixed?: ReadonlySet<string>;
  /** The picked values the filters BEFORE them rule out, as value keys: they stay
   *  in the reading and leave the filter. TRAP T-a-ruled-out-value-is-greyed */
  drop?: (scope: string, field: string) => readonly string[] | undefined;
}

/** A reading without the picks set aside. */
export function withoutDropped(reading: FieldReading, dropped: readonly string[] | undefined): FieldReading {
  if (!dropped?.length || !reading.picked) return reading;
  const out = new Set(dropped);
  return { ...reading, picked: reading.picked.filter((v) => !out.has(valueKey(v))) };
}

/** A Query as the source runs it: one shared filter, and each one-component filter. */
export interface Compiled {
  /** What a PAGE of rows is under: the View, and every component scope. */
  filter?: Filter;
  /** The View's answer alone — what every OTHER component is under. Only the
   *  View trickles down. TRAP T-only-the-view-trickles-down */
  view?: Filter;
  /** Each component scope's own answer, by scope id. */
  scoped: Record<string, Filter>;
  /** Per bound component id, what narrows it alone. */
  only: Record<string, Filter>;
  sort: SortSpec[];
  group: string | null;
  search: string;
}

/** The id of the page's own scope, which every component scope sits under. */
export const VIEW = 'view';

/** A scope that holds and answers nothing yet, for a caller to fill. */
export function emptyScope(holds: readonly string[] = []): ScopeQuery {
  return { holds: [...holds], readings: {} };
}

/** Does this scope narrow only the components it names? TRAP T-a-component-part-narrows-one-component */
export function narrowsOne(scope: ScopeQuery): boolean {
  return !!scope.narrows?.length;
}

/** Each scope that answers for the page, by id. A copy, so a caller may edit the Query as it goes. */
export function eachScope(query: Query): Array<[string, ScopeQuery]> {
  return Object.entries(query.scopes).filter(([, s]) => !narrowsOne(s));
}

/** The fields the View holds, which are answered there alone. TRAP T-a-view-held-heading-shows-and-refuses */
export function heldInView(query: Query): ReadonlySet<string> {
  return new Set(query.scopes[VIEW]?.holds ?? []);
}

// Every key of FieldReading, once: one added there and not here is a type error. TRAP T-both-answers-are-kept
const READING_KEYS = Object.keys({
  picked: 0, present: 0, op: 0, text: 0, conditions: 0, mode: 0, mirror: 0, range: 0, suspended: 0,
} satisfies Record<keyof FieldReading, 0>) as (keyof FieldReading)[];

/** The ANSWER keys of a reading only — a bar's reading also carries its label
 *  and every value it offers, which are facts, not what the reader chose. */
export function answerOf(reading: FieldReading): FieldReading {
  const out: Record<string, unknown> = {};
  for (const key of READING_KEYS) if (reading[key] !== undefined) out[key] = reading[key];
  return out as FieldReading;
}

/** A value's own copy, all the way down: arrays and plain objects; the rest as it is. */
function copyDeep<T>(v: T): T {
  if (Array.isArray(v)) return v.map(copyDeep) as T;
  if (v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype) {
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, copyDeep(x)])) as T;
  }
  return v;
}

/** A Query's own copy, all the way down — no clone a load pays for. */
export function copyQuery(query: Query): Query {
  return copyDeep(query);
}

/** A reading's own copy, all the way down — what a caller hands in, so a
 *  change it makes after is not the Query's. TRAP T-a-reading-is-frozen-in-the-query */
export function copyReading(reading: FieldReading): FieldReading {
  return copyDeep(reading);
}

/** Freeze a reading all the way down — what the Query keeps and hands out, so
 *  no caller can change it by editing what it was given. TRAP T-a-reading-is-frozen-in-the-query */
export function freezeReading(reading: FieldReading): FieldReading {
  const deep = (v: unknown): void => {
    if (!v || typeof v !== 'object' || Object.isFrozen(v)) return;
    Object.freeze(v);
    for (const x of Object.values(v)) deep(x);
  };
  deep(reading);
  return reading;
}

/** Does a reading answer anything? CONDITIONS count — a field answered only by
 *  rows has no picks and no text — but an EMPTY row does not: a cleared menu
 *  keeps one. TRAP T-many-conditions-are-one-reading */
export function readingAnswered(reading: FieldReading): boolean {
  return (reading.picked ?? []).length > 0
    || (reading.text ?? '').trim() !== ''
    || (reading.conditions ?? []).some((r) => (r.text ?? '').trim() !== '' || (r.picked ?? []).length > 0);
}

/** Do two readings give the same answer? Only the answer keys count. */
export function sameReading(a: FieldReading | null | undefined, b: FieldReading | null | undefined): boolean {
  return JSON.stringify(a ? answerOf(a) : null) === JSON.stringify(b ? answerOf(b) : null);
}

/** A filter as one string, its AND and OR children in one order: the same filter
 *  always reads the same. */
export function filterKey(filter: Filter | undefined): string {
  const walk = (f: Filter): unknown => (Array.isArray(f) && (f[0] === 'and' || f[0] === 'or')
    ? [f[0], ...(f.slice(1) as Filter[]).map((c) => JSON.stringify(walk(c))).sort()]
    : f);
  return filter ? JSON.stringify(walk(filter)) : '';
}

/** Does a scope's reading of a field apply? One field, one scope: in a component
 *  scope the View's answer wins, unless the scope is a component's own (`fixed`).
 *  TRAP T-a-view-held-heading-shows-and-refuses */
export function appliesIn(viewHolds: ReadonlySet<string>, scope: string, field: string, fixed?: ReadonlySet<string>): boolean {
  return scope === VIEW || !viewHolds.has(field) || !!fixed?.has(scope);
}

/** One scope's clauses: each reading that applies and is not suspended. */
export function scopeClauses(id: string, scope: ScopeQuery, viewHolds: ReadonlySet<string>, facts: CompileFacts = {}): Filter[] {
  const clauses: Filter[] = [];
  for (const [field, reading] of Object.entries(scope.readings)) {
    if (!appliesIn(viewHolds, id, field, facts.fixed) || reading.suspended) continue;
    const clause = readingClause({ field, ...facts.field?.(field) }, withoutDropped(reading, facts.drop?.(id, field)));
    if (clause) clauses.push(clause);
  }
  return clauses;
}

/**
 * Turn a Query into what the source runs — the ONE place a Query becomes a
 * filter. Pure: the same Query and facts always compile to the same thing.
 *
 * - Every reading applies, held or not — except that a field the VIEW holds
 *   is answered there alone: a component scope's reading of it applies nothing,
 *   unless the scope is a component's own (`fixed`).
 * - A SUSPENDED reading keeps its answer and applies none of it.
 * - A scope with `narrows` reaches only those components.
 *
 * TRAP T-one-query-one-owner
 */
export function compile(query: Query, facts: CompileFacts = {}): Compiled {
  const shared: Filter[] = [];
  const view: Filter[] = [];
  const scoped: Record<string, Filter> = {};
  const only: Record<string, Filter[]> = {};
  const viewHolds = heldInView(query);
  let arranged: ScopeQuery | undefined;

  for (const [id, scope] of Object.entries(query.scopes)) {
    const clauses = scopeClauses(id, scope, viewHolds, facts);

    if (scope.narrows?.length) {
      for (const el of scope.narrows) (only[el] ??= []).push(...clauses);
    } else {
      shared.push(...clauses);
      if (id === VIEW || (facts.components && !facts.components.has(id))) view.push(...clauses);
      else {
        const own = andFilter(clauses);
        if (own) scoped[id] = own;
      }
    }

    if (arranging(scope)) {
      if (arranged) {
        report({
          code: 'two-arranging-scopes',
          message: 'compile: two scopes on one source arrange its rows; the first is used.',
          at: { scope: id },
        });
      } else {
        arranged = scope;
      }
    }
  }

  const out: Compiled = {
    scoped,
    only: Object.fromEntries(Object.entries(only)
      .map(([el, clauses]) => [el, andFilter(clauses)] as const)
      .filter((e): e is readonly [string, Filter] => !!e[1])),
    sort: arranged?.sort ?? [],
    group: arranged?.group ?? null,
    search: arranged?.search ?? '',
  };
  const filter = andFilter(shared);
  if (filter) out.filter = filter;
  const viewed = andFilter(view);
  if (viewed) out.view = viewed;
  return out;
}
