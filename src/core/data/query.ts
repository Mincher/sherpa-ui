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
 * - PRESENTATION_KINDS — Each way a slot can show its data.
 * - Presentation — A slot's presentation: a chart or a grid; a chart's two fields, its parts and its order.
 * - PresentationDefinition — What a page DEFINES a slot shows: a presentation, and a default per view — its grid's, its charts' — over it.
 * - AxisOffer — The fields one axis's chip offers: only those `available`, less those `unavailable`.
 * - AxisOffers — The fields each axis — Primary, Secondary, Group — offers.
 * - AxesDefinition — What each axis offers, and per view — a grid's, a chart's — over it, an axis whole.
 * - offerAxis — An axis's fields, as its offer narrows them.
 * - Arrangement — How a Query arranges its rows: the ONE scope that sorts, groups, keeps a suspended sort or searches.
 * - ARRANGE_KEYS — The keys that arrange a scope's rows, written once.
 * - stripArrangement — A scope without its arrangement, in place.
 * - arranging — Does a scope arrange — a sort, a group, a suspended sort or a search?
 * - arrangementOf — How a Query arranges its rows; none, an empty arrangement.
 * - withoutArrangement — The Query with no arrangement: what filters, and nothing of the order.
 * - QueryDefaults — A Query as a DEFINITION states it — a saved View, in JSON.
 * - QueryRequest — One edit to the Query, as anyone asks it through `QueryContext.ask()`; a list is one change.
 * - SavedFilter — A saved filter: a name, and each scope's filters as a View writes them.
 * - isSavedFilter — Is this a saved filter — a name, and a query definition?
 * - ViewScope — One scope as a View writes it: each field's condition in the plain form.
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
 * - sameAnswer — Do two readings put the same answer IN FORCE?
 * - filterKey — A filter as one string, its AND and OR children in one order.
 * - sameFilter — Two filters, or two filters by id, the same in any clause order.
 * - appliesIn — Does a scope's reading of a field apply?
 * - scopeClauses — One scope's clauses: each reading that applies, each saved filter on.
 * - presetClause — A preset's own conditions as one clause — its chip's count.
 * - compile — Turn a Query into what the source runs — the ONE place a Query becomes a filter.
 * - highlightOf — What a hover lights: one field of a scope, as that scope reads it.
 */
import {
  DEFAULT_OP, andFilter, conditionLeaves, groupOf, valueKey,
  type Condition, type ConditionLeaf, type Filter, type SortDirection, type SortSpec,
} from './store.js';
import { answerTree, answeredCondition, readingClause, type FieldFacts, type FieldReading } from './filter-state.js';
import type { Where } from './where.js';
import type { BoundControl } from './data-source-types.js';

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
  /** A component scope's OWN answer to each field the View holds over it:
   *  kept, not in force, and given back when the View lets go — `{}` for none.
   *  Will, D2 A. TRAP T-a-superseded-chip-suspends-it-is-never-removed */
  superseded?: Record<string, FieldReading>;
  /** How its SLOT shows the rows — not the row arrangement above: each slot keeps
   *  its own. Only what differs from its definition. Will, TODO 548 */
  presentation?: Presentation;
}

/** Each way a slot can show its data. TODO 548 */
export const PRESENTATION_KINDS = ['bar', 'donut', 'pie', 'grid'] as const;

/** A slot's presentation: a chart or a grid; a chart's two fields, its parts and its order. TODO 548 */
export interface Presentation {
  kind?: (typeof PRESENTATION_KINDS)[number];
  /** A chart's X axis: one bar or slice per value, named by it. Will, TODO 548 */
  primary?: string;
  /** A chart's Y axis: its distinct values, counted in each segment. */
  secondary?: string;
  /** Each segment's parts, by this field. */
  group?: string;
  /** The segments by value; none keeps their order. */
  sort?: SortDirection;
  /** Its Secondary is switched OFF: kept, and not shown — the definition's neither.
   *  Off is not gone. Will, TODO 666 */
  off?: 'secondary';
}

/** What a page DEFINES a slot shows: a presentation, and a default per view —
 *  its grid's, its charts' — over it. Will, TODO 548 */
export interface PresentationDefinition extends Presentation {
  grid?: Presentation;
  chart?: Presentation;
}

/** The fields one axis's chip offers: only those `available`, less those
 *  `unavailable`. It narrows, never adds: never a number or a date. Will, TODO 660 */
export interface AxisOffer {
  available?: readonly string[];
  unavailable?: readonly string[];
}

/** The fields each axis — Primary, Secondary, Group — offers. */
export type AxisOffers = Partial<Record<'primary' | 'secondary' | 'group', AxisOffer>>;

/** What each axis offers, and per view — a grid's, a chart's — over it, an axis whole. Will, TODO 660 */
export interface AxesDefinition extends AxisOffers {
  grid?: AxisOffers;
  chart?: AxisOffers;
}

/** An axis's fields, as its offer narrows them. Will, TODO 660 */
export function offerAxis<C extends { field: string }>(cols: readonly C[], offer: AxisOffer | undefined): C[] {
  return cols.filter((c) => (!offer?.available || offer.available.includes(c.field)) && !offer?.unavailable?.includes(c.field));
}

/** How a Query arranges its rows: the ONE scope that sorts, groups, keeps a suspended sort or searches. */
export interface Arrangement {
  sort: SortSpec[];
  group: string | null;
  sortSuspended?: SortSpec;
  search: string;
  scope?: string;
}

/** The keys that arrange a scope's rows, written once. TODO 518 */
export const ARRANGE_KEYS = ['sort', 'group', 'sortSuspended', 'search'] as const;

/** A scope without its arrangement, in place. */
export function stripArrangement(s: object): void {
  for (const key of ARRANGE_KEYS) Reflect.deleteProperty(s, key);
}

/** Does a scope arrange — a sort, a group, a suspended sort or a search? */
export const arranging = (s: ScopeQuery): boolean =>
  !!s.sort?.length || s.group != null || !!s.sortSuspended || !!s.search;

/** How a Query arranges its rows; none, an empty arrangement. `kept`: what a
 *  Switch holds off, for a write that must not lose it. 366 step 8 */
export function arrangementOf(query: Query, mine?: (scope: string) => boolean, kept = false): Arrangement {
  for (const [scope, s] of Object.entries(query.scopes)) {
    // Another source's own scope arranges that source's rows. 366 step 25
    if (!arranging(s) || (mine && !mine(scope))) continue;
    // Its filter Switch OFF: its sort and group are kept, not in force. Will, TODO 398
    if (s.suspended && !kept) return { sort: [], group: null, search: s.search ?? '', scope };
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
    const rest = { ...s };
    stripArrangement(rest);
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

/** One edit to the Query, as a control, the node editor or an agent asks it:
 *  `QueryContext.ask()` is its one door, and a list is one change. Left out,
 *  `scope` is the View — for a sort, group or search, the scope that arranges
 *  now; for an Apply or a Discard, every scope. `commit` applies what the
 *  edit names at once. TRAP T-one-command-one-door */
export type QueryRequest =
  | { scope?: string; field: string; reading: FieldReading | null; commit?: true; only?: BoundControl }
  | { scope?: string; field: string; suspended: boolean; commit?: true }
  | { scope?: string; suspended: boolean; commit?: true }
  | { scope?: string; reset: { carry?: boolean; organise?: boolean }; commit?: true }
  /** A hover: the page's, never the Query's — `ask()` passes it by. TODO 655 */
  | { scope?: string; field: string; preview: boolean; value?: string }
  | { scope?: string; order: readonly string[] }
  /** A preset on or off. TODO 493 */
  | { scope?: string; preset: string; on: boolean; commit?: true }
  /** A slot's presentation: what its chart counts and splits by. TODO 548 */
  | { scope?: string; presentation: Partial<Record<keyof Presentation, string | undefined>> }
  /** Solo a field, every scope `across`; or end the solo. TODO 690 */
  | { scope?: string; solo: string; across?: boolean }
  | { scope?: string; unsolo: true }
  /** Sort by a field; `null` suspends it, kept to resume; with `clear`, forgets it.
   *  In a slot, its chart's order. TRAP T-a-suspended-sort-is-one-owners-job */
  | { scope?: string; sort: string | null; direction?: SortDirection; clear?: true }
  /** Group by a field, or stop. In a slot, its chart's parts. */
  | { scope?: string; group: string | null }
  | { scope?: string; search: string }
  /** The page, or the rows per page, of the source that draws a page in `scope`. */
  | { scope?: string; page: number }
  | { scope?: string; pageSize: number }
  /** What a scope holds, whole; one it takes, down from the View or up from a chart; one it lets go. */
  | { scope?: string; hold: readonly string[] }
  | { scope?: string; take: readonly string[]; from?: string }
  | { scope?: string; release: string }
  /** A field's hold moved into `scope`, as one change. */
  | { scope?: string; move: string; from: string }
  /** Picks the filters before a field rule out leave its answer, applied and drafted alike. */
  | { scope?: string; field: string; letGo: readonly string[] }
  /** Apply, or Discard: one field, one scope, or every scope. */
  | { scope?: string; field?: string; commit: true }
  | { scope?: string; field?: string; discard: true }
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
export interface ViewScope extends Partial<Omit<ScopeQuery, 'readings' | 'superseded'>> {
  /** `{ openTickets: { gt: 0 } }` — numbers as numbers. */
  where?: Where;
  /** Its kept answers: a View's in the plain form, a whole Query's as readings; `{}` is none. */
  superseded?: Where | Record<string, FieldReading>;
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
  /** The picked values the filters BEFORE them rule out, as value keys: they
   *  leave the filter, and then the reading (`letGo`). TRAP T-a-ruled-out-value-is-greyed */
  drop?: (scope: string, field: string) => readonly string[] | undefined;
  /** Is a scope this source's — no other source shows rows in it? Absent, every
   *  one is. The View's answers reach every source. TRAP T-a-source-compiles-only-what-it-has */
  mine?: (scope: string) => boolean;
  /** Does this source have the field? A reading on one it lacks is skipped. */
  has?: (field: string) => boolean;
  /** A field the STORE answers: its answer as the keys it matched, once fetched. */
  fetched?: (field: string, reading: FieldReading) => Filter | undefined;
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
  /** What this source left out: another source's scope, or `scope.field` for a
   *  field it lacks. Absent when nothing was. */
  skipped?: string[];
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
  picked: 0, present: 0, op: 0, text: 0, tree: 0, mode: 0, mirror: 0, range: 0, suspended: 0, off: 0, all: 0, byPreset: 0,
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

/** Does a reading answer anything? Its TREE counts — a field answered only by
 *  conditions has no picks and no text — but an EMPTY condition does not: a
 *  cleared menu keeps one. TRAP T-many-conditions-are-one-reading */
export function readingAnswered(reading: FieldReading): boolean {
  // Picks kept OFF are an answer too: the Query keeps them (TODO 369); so is all (489).
  return (reading.picked ?? []).length > 0 || (reading.off ?? []).length > 0 || reading.all === true
    || Object.keys(reading.byPreset ?? {}).length > 0
    || (reading.text ?? '').trim() !== ''
    || !!answeredCondition(reading.tree);
}

/** Do two readings give the same answer? Only the answer keys count. */
export function sameReading(a: FieldReading | null | undefined, b: FieldReading | null | undefined): boolean {
  return JSON.stringify(a ? canon(answerOf(a)) : null) === JSON.stringify(b ? canon(answerOf(b)) : null);
}

/** Do two readings put the same answer IN FORCE? A switch of mode that carries its
 *  rows over is no change, and neither is the answer the other mode keeps: so it
 *  asks no Apply. Will, TODO 593 · TRAP T-both-answers-are-kept */
export function sameAnswer(a: FieldReading | null | undefined, b: FieldReading | null | undefined): boolean {
  const said = (r: FieldReading | null | undefined): string => {
    if (!r) return JSON.stringify([[], false, [], false, null]);
    // A tree that still mirrors the picks says what the picks say; two ends are a range.
    const tree = answerTree({ ...r, suspended: false, ...(r.mirror ? { mode: 'simple' as const } : {}) }, r.range ? { type: 'date' } : {});
    // A list ORed is a set: its picks in any order are one answer.
    const parts = tree && groupOf(tree);
    const leaves = !parts ? conditionLeaves(tree) : parts[0] === 'or' && parts[1].every((p) => !groupOf(p)) ? conditionLeaves(tree) : null;
    const set = !!leaves && leaves.every((l) => !l.off && (l.op === DEFAULT_OP || l.op === 'in'));
    const held = set ? leaves!.flatMap((l) => (Array.isArray(l.value) ? l.value : [l.value])).map(valueKey).sort() : canonTree(tree);
    return JSON.stringify([held, !!r.suspended, canon({ off: r.off ?? [] }).off, !!r.all, r.byPreset ?? null]);
  };
  return said(a) === said(b);
}

/** The same picks in any order, or written as a key, are the same answer: a bar's
 *  tree and a panel list one field's picks in their own order. TODO 414 */
function canon(reading: FieldReading): FieldReading {
  const keys = (picks: readonly unknown[] | undefined): string[] | undefined => picks && [...new Set(picks.map(valueKey))].sort();
  return {
    ...reading,
    ...(reading.picked ? { picked: keys(reading.picked)! } : {}),
    ...(reading.off ? { off: keys(reading.off)! } : {}),
    ...(reading.tree ? { tree: canonTree(reading.tree)! } : {}),
  };
}

/** A tree whose lists are sets: `in` and `notin` keep their values as sorted keys. */
function canonTree(tree: Condition | undefined): Condition | undefined {
  if (!tree) return undefined;
  const parts = groupOf(tree);
  if (parts) return { ...tree, [parts[0]]: parts[1].map(canonTree) } as Condition;
  const leaf = tree as ConditionLeaf;
  return (leaf.op === 'in' || leaf.op === 'notin') && Array.isArray(leaf.value)
    ? { ...leaf, value: [...new Set(leaf.value.map(valueKey))].sort() } : leaf;
}

/** A filter as one string, its AND and OR children in one order: the same filter
 *  always reads the same. */
export function filterKey(filter: Filter | undefined): string {
  const walk = (f: Filter): unknown => (Array.isArray(f) && (f[0] === 'and' || f[0] === 'or')
    ? [f[0], ...(f.slice(1) as Filter[]).map((c) => JSON.stringify(walk(c))).sort()]
    : f);
  return filter ? JSON.stringify(walk(filter)) : '';
}

/** Two filters, or two filters by id, the same in any clause order. TODO 288 */
export function sameFilter(a: Filter | Record<string, Filter> | undefined, b: Filter | Record<string, Filter> | undefined): boolean {
  if (Array.isArray(a) || Array.isArray(b) || !a || !b) return filterKey(a as Filter | undefined) === filterKey(b as Filter | undefined);
  const ids = Object.keys(a);
  return ids.length === Object.keys(b).length && ids.every((id) => filterKey(a[id]) === filterKey(b[id]));
}

/** Does a scope's reading of a field apply? One field, one scope: in a component
 *  scope the View's answer wins, unless the scope is a component's own (`fixed`).
 *  TRAP T-a-view-held-heading-shows-and-refuses */
export function appliesIn(viewHolds: ReadonlySet<string>, scope: string, field: string, fixed?: ReadonlySet<string>): boolean {
  return scope === VIEW || !viewHolds.has(field) || !!fixed?.has(scope);
}

/** One scope's clauses: each reading that applies and is not suspended, while
 *  its Switch is on. */
export function scopeClauses(id: string, scope: ScopeQuery, viewHolds: ReadonlySet<string>, facts: CompileFacts = {}): Filter[] {
  const clauses: Filter[] = [];
  for (const [field, reading] of Object.entries(scope.readings)) {
    if (!appliesIn(viewHolds, id, field, facts.fixed) || reading.suspended || (facts.has && !facts.has(field))) continue;
    const clause = facts.fetched?.(field, reading)
      ?? readingClause({ field, ...facts.field?.(field) }, withoutDropped(reading, facts.drop?.(id, field)));
    if (clause) clauses.push(clause);
  }
  return clauses;
}

/** A preset's own conditions as ONE clause — its chip's count. Its rows are in
 *  its fields' answers, so nothing compiles it twice. TODO 510 · TRAP T-a-preset-is-its-own-part */
export function presetClause(readings: Readonly<Record<string, FieldReading>>, facts: CompileFacts = {}): Filter | undefined {
  const clauses: Filter[] = [];
  for (const [field, reading] of Object.entries(readings)) {
    if (facts.has && !facts.has(field)) continue;
    const clause = readingClause({ field, ...facts.field?.(field) }, reading);
    if (clause) clauses.push(clause);
  }
  return andFilter(clauses);
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
  const skipped: string[] = [];

  for (const [id, scope] of Object.entries(query.scopes)) {
    const mine = !facts.mine || facts.mine(id);
    if (!mine && id !== VIEW) {
      skipped.push(id);
      continue;
    }
    if (facts.has) for (const field of Object.keys(scope.readings)) if (!facts.has(field)) skipped.push(`${id}.${field}`);
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
  }

  const out: Compiled = {
    scoped,
    only: Object.fromEntries(Object.entries(only)
      .map(([el, clauses]) => [el, andFilter(clauses)] as const)
      .filter((e): e is readonly [string, Filter] => !!e[1])),
    // How the rows are arranged: the one rule the source reads. TODO 518
    ...(({ sort, group, search }) => ({ sort, group, search }))(arrangementOf(query, facts.mine)),
  };
  const filter = andFilter(shared);
  if (filter) out.filter = filter;
  const viewed = andFilter(view);
  if (viewed) out.view = viewed;
  if (skipped.length) out.skipped = skipped;
  return out;
}

/** What a hover lights: one field of a scope, as that scope reads it — one value of
 *  it, or the whole reading it holds, off or on. From an empty scope where the Query
 *  has not made it yet (TODO 513); nothing where this source lacks the field (TODO
 *  458). The page asks each source for it, once per hover. Will, TODOs 449, 459, 655
 *  TRAP T-a-hovered-chip-previews-the-highlight */
export function highlightOf(query: Query, hovered: { scope: string; field: string; value?: string }, facts: CompileFacts = {}): Filter | undefined {
  const { scope: id, field, value } = hovered;
  if (facts.has && !facts.has(field)) return undefined;
  const scope = query.scopes[id] ?? emptyScope();
  const held = scope.readings[field];
  const reading = value !== undefined ? { picked: [value] } : held ? { ...held, suspended: false } : undefined;
  if (!reading) return undefined;
  return andFilter(scopeClauses(id, { ...scope, readings: { [field]: reading } }, heldInView(query), facts));
}
