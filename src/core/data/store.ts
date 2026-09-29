/**
 * store.ts — where records come from: the row shape, the filter grammar, and
 * the in-memory pipeline every store shares.
 *
 * TRAP T-store-is-stateless
 *
 * Map:
 * - Row — one record, as plain data
 * - SortDirection — Which way a sort runs.
 * - SortSpec — One sort instruction.
 * - FilterOp — one operator name — eq, contains, between, and the rest
 * - OP_LABELS — How each operator READS to a person.
 * - OPS_FOR_TYPE — The operators each COLUMN TYPE can answer.
 * - OP_TAKES — WHAT a reader gives an operator: a value they PICK, or one they TYPE.
 * - DEFAULT_OP — The condition a filter menu opens on.
 * - FilterClause — [field, op, value] — one condition
 * - FilterGroup — ['and' | 'or', ...filters] — conditions joined
 * - Filter — a clause or a group; the one filter shape the whole layer speaks
 * - LoadOptions — What a caller asks a store for.
 * - LoadResult — What a load returns: the rows, plus the total BEFORE paging.
 * - Store — where records come from; the same interface whatever backs it
 * - StoreChangeDetail — Fired after an insert, update or remove.
 * - readField — Read a field, following dots (`'customer.name'`) into nested objects.
 * - compareValues — Compare two field values.
 * - sortRows — Sort by specs, first wins and later ones break ties.
 * - filterFields — Every FIELD a filter touches, first-appearance order.
 * - filterNeedles — every substring clause in a filter, so a view can mark what matched
 * - matchesFilter — Does one row satisfy one filter?
 * - sameKey — Do two KEYS name the same row?
 * - valueKey — A value as the string a CONTROL can put in an attribute.
 * - valueSet — A set of values to test against, using the query's own comparison.
 * - andFilter — several clauses as ONE filter, or undefined when there are none
 * - picksClause — One field and the values picked for it, as a clause.
 * - filterRows — Rows matching a filter.
 * - searchRows — Rows matching a free-text search — `fields` when given, else every value.
 * - RowGroup — One bunch of rows sharing a value in the grouped field.
 * - GroupSummary — One group as the DATA LAYER sees it: the value, and how many rows carry it.
 * - groupSummaries — Group by a field, keeping arrival order.
 * - groupRows — rows grouped by a field, in the order they arrive
 * - applyOptions — Apply search → filter → sort, then page.
 */
import type { FieldDomain } from './validate.js';

/** One record. Plain object — structuredClone cannot clone a class instance. */
export type Row = Record<string, unknown>;

/** Which way a sort runs. Matches the `data-sort-direction` attribute values. */
export type SortDirection = 'asc' | 'desc';

/** One sort instruction. `field` matches `data-sort-field`. */
export interface SortSpec {
  field: string;
  direction?: SortDirection;
}

/** A filter, in the one shape the whole layer speaks. TRAP T-filter-is-data-not-a-predicate */
export type FilterOp =
  | 'eq' | 'ne' | 'lt' | 'lte' | 'gt' | 'gte'
  | 'contains' | 'notcontains' | 'startswith' | 'endswith'
  | 'in' | 'notin'
  | 'between';

/** How each operator READS to a person. A second copy is a second vocabulary. */
export const OP_LABELS: Record<FilterOp, string> = {
  eq: 'Equals',
  ne: 'Does not equal',
  lt: 'Less than',
  lte: 'At most',
  gt: 'Greater than',
  gte: 'At least',
  contains: 'Contains',
  notcontains: 'Does not contain',
  startswith: 'Starts with',
  endswith: 'Ends with',
  in: 'Is one of',
  notin: 'Is not one of',
  between: 'Between',
};

/**
 * The operators each COLUMN TYPE can answer.
 *
 * `eq` LEADS, because it is the default and a reader picking a value from a
 * list is the common case. TRAP T-ops-follow-the-column-type
 */
export const OPS_FOR_TYPE: Record<string, readonly FilterOp[]> = {
  text: ['eq', 'ne', 'contains', 'notcontains', 'startswith', 'endswith'],
  number: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte'],
  // A date is answered by clicking a calendar — no operator list.
  date: [],
};

/**
 * WHAT a reader gives an operator: a value they PICK, or one they TYPE.
 *
 * Both filter menus follow this, so the condition dropdown swaps the body
 * beneath it. TRAP T-an-operator-decides-pick-or-type
 */
export const OP_TAKES: Record<FilterOp, 'list' | 'text' | 'range'> = {
  eq: 'list',
  ne: 'list',
  in: 'list',
  notin: 'list',
  contains: 'text',
  notcontains: 'text',
  startswith: 'text',
  endswith: 'text',
  lt: 'text',
  lte: 'text',
  gt: 'text',
  gte: 'text',
  between: 'range',
};

/** The condition a filter menu opens on. A reader picks a value far more often than typing one. */
export const DEFAULT_OP: FilterOp = 'eq';

export type FilterClause = [field: string, op: FilterOp, value: unknown];
export type FilterGroup = ['and' | 'or', ...Filter[]];
export type Filter = FilterClause | FilterGroup;

/** What a caller asks a store for. Every field is optional. */
export interface LoadOptions {
  filter?: Filter;
  sort?: SortSpec[];
  /** Field to group by — matches `data-group-field`. */
  group?: string;
  /** Free-text search across `searchFields`, or every string field. */
  search?: string;
  searchFields?: string[];
  /** Paging. `skip` rows in, `take` rows out. */
  skip?: number;
  take?: number;
}

/** What a load returns: the rows, plus the total BEFORE paging. */
export interface LoadResult {
  rows: Row[];
  /** Matching rows before skip/take — what a pager needs to count pages. */
  total: number;
  /** Rows the schema REFUSED. TRAP T-dropped-rows-must-be-countable */
  dropped?: number;
  /** Why the dropped rows were refused — the FIRST FEW only. */
  issues?: ReadonlyArray<{ readonly message: string; readonly path?: ReadonlyArray<PropertyKey> }>;
}

/**
 * The store interface — identical whatever backs it, so a view moves from an
 * array to an HTTP endpoint untouched. TRAP T-store-is-stateless
 */
export interface Store extends EventTarget {
  load(options?: LoadOptions): Promise<LoadResult>;
  byKey(key: unknown): Promise<Row | undefined>;
  insert(values: Row): Promise<Row>;
  update(key: unknown, values: Row): Promise<Row>;
  remove(key: unknown): Promise<void>;
  totalCount(options?: LoadOptions): Promise<number>;
  /** The field holding each row's identity. */
  readonly key: string;
  /**
   * The field holding each row's TIME — when the record is from. A view's
   * Date filter asks about this, never about a column some dataset happens to
   * call `created`. No default: a store with no time has none.
   * TRAP T-a-record-has-a-time-of-its-own
   */
  readonly time?: string | undefined;
  /** Its loads reach OUTSIDE the data layer, so a filter change waits for Apply.
   *  TRAP T-apply-and-discard-wait-for-a-change */
  readonly remote?: boolean;
  /** What each field MAY hold — a set in order, a number's ends — as the data's
   *  own contract says it. TRAP T-the-data-says-what-a-field-may-hold */
  readonly domains?: Readonly<Record<string, FieldDomain>>;
}

/** Fired after an insert, update or remove. A DataSource just RELOADS. */
export interface StoreChangeDetail {
  type: 'insert' | 'update' | 'remove';
  key?: unknown;
  row?: Row;
}

/* ── Value access ──────────────────────────────────────────────────────── */

/** Read a field, following dots (`'customer.name'`) into nested objects. */
export function readField(row: Row, field: string): unknown {
  if (!field.includes('.')) return row[field];
  let cur: unknown = row;
  for (const part of field.split('.')) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Row)[part];
  }
  return cur;
}

/* ── Comparison ────────────────────────────────────────────────────────── */

/** ONE comparator for the whole library. TRAP T-one-collator-for-the-library */
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

/** Compare two field values. Nulls sort LAST in EITHER direction. */
export function compareValues(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  // An object sorts by its own fields — a dotted path picks the one that reads.
  // TRAP T-a-value-can-be-an-object
  return collator.compare(valueKey(a), valueKey(b));
}

/** Sort by specs, first wins and later ones break ties. `toSorted`, never `sort`. */
export function sortRows(rows: readonly Row[], specs: readonly SortSpec[]): Row[] {
  if (!specs.length) return [...rows];
  return rows.toSorted((a, b) => {
    for (const spec of specs) {
      const dir = spec.direction === 'desc' ? -1 : 1;
      // The direction must NOT flip nulls — so they are compared before `dir`.
      const av = readField(a, spec.field);
      const bv = readField(b, spec.field);
      if (av == null || bv == null) {
        const nulls = compareValues(av, bv);
        if (nulls !== 0) return nulls;
        continue;
      }
      const cmp = compareValues(av, bv) * dir;
      if (cmp !== 0) return cmp;
    }
    return 0;
  });
}

/* ── Filtering ─────────────────────────────────────────────────────────── */

/** Every FIELD a filter touches, first-appearance order. TRAP T-filter-fields-flattens-the-tree */
export function filterFields(filter: Filter | undefined): string[] {
  const out: string[] = [];
  const walk = (f: Filter | undefined): void => {
    if (!f) return;
    const [head, ...rest] = f;
    if (head === 'and' || head === 'or') {
      (rest as Filter[]).forEach(walk);
      return;
    }
    const [field] = f as FilterClause;
    // A range is two clauses on one field — list it once.
    if (typeof field === 'string' && !out.includes(field)) out.push(field);
  };
  walk(filter);
  return out;
}

/**
 * Every SUBSTRING clause in a filter, as `field:op:value`, NEWLINE separated —
 * a typed value may hold a comma or a space.
 *
 * Only the markable ops: `eq` matched the whole value and `ne` matched by
 * absence, so neither leaves a span to point at.
 * TRAP T-a-needle-comes-from-either-direction
 */
export function filterNeedles(filter: Filter | undefined): string {
  const MARKABLE = new Set(['contains', 'startswith', 'endswith']);
  const out: string[] = [];
  const seen = new Set<string>();
  const walk = (f: Filter | undefined): void => {
    if (!f) return;
    const [head, ...rest] = f;
    if (head === 'and' || head === 'or') {
      (rest as Filter[]).forEach(walk);
      return;
    }
    const [field, op, value] = f as FilterClause;
    if (typeof field !== 'string' || seen.has(field)) return;
    if (!MARKABLE.has(op) || value == null) return;
    const text = String(value);
    if (!text) return;
    seen.add(field);
    // A newline in the value itself would split one entry into two.
    out.push(`${field}:${op}:${text.replace(/\n/g, ' ')}`);
  };
  walk(filter);
  return out.join('\n');
}

/** Does one row satisfy one filter? Groups recurse. */
export function matchesFilter(row: Row, filter: Filter | undefined): boolean {
  if (!filter) return true;
  const [head, ...rest] = filter;
  if (head === 'and') return (rest as Filter[]).every((f) => matchesFilter(row, f));
  if (head === 'or') return (rest as Filter[]).some((f) => matchesFilter(row, f));

  const [field, op, value] = filter as FilterClause;
  const actual = readField(row, field);

  switch (op) {
    case 'eq':
      return looseEqual(actual, value);
    case 'ne':
      return !looseEqual(actual, value);
    case 'lt':
      return actual != null && compareValues(actual, value) < 0;
    case 'lte':
      return actual != null && compareValues(actual, value) <= 0;
    case 'gt':
      return actual != null && compareValues(actual, value) > 0;
    case 'gte':
      return actual != null && compareValues(actual, value) >= 0;
    case 'contains':
      return text(actual).includes(text(value));
    case 'notcontains':
      return !text(actual).includes(text(value));
    case 'startswith':
      return text(actual).startsWith(text(value));
    case 'endswith':
      return text(actual).endsWith(text(value));
    case 'in':
      return Array.isArray(value) && value.some((v) => looseEqual(actual, v));
    case 'notin':
      return !Array.isArray(value) || !value.some((v) => looseEqual(actual, v));
    case 'between': {
      // A backwards pair is still a range — order the bounds, do not reject.
      if (!Array.isArray(value) || value.length !== 2 || actual == null) return false;
      const [lo, hi] = compareValues(value[0], value[1]) <= 0
        ? [value[0], value[1]]
        : [value[1], value[0]];
      return compareValues(actual, lo) >= 0 && compareValues(actual, hi) <= 0;
    }
  }
}

/** Compare for filtering, not sorting. TRAP T-loose-equal-is-case-insensitive */
/**
 * ONE comparison rule for the whole system — the query and the UI must agree.
 *
 * LOOSE: `['plan','in',['free']]` matches a row holding `'Free'`. `valueSet`
 * is the set form, and is what a control usually wants.
 * TRAP T-one-comparison-rule-for-query-and-ui
 */
function looseEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a === 'number' && typeof b === 'number') return a === b;
  return text(a) === text(b);
}

/**
 * Do two KEYS name the same row?
 *
 * A key arrives as a string far more often than not, and `'7' === 7` is false,
 * so both are stringified. NOT `looseEqual`: a key is case-SENSITIVE, because
 * rows keyed `Ada` and `ada` are two rows.
 * TRAP T-numeric-keys-compare-as-strings
 */
export function sameKey(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  // A COMPOUND key is an object — TRAP T-a-value-can-be-an-object.
  return valueKey(a) === valueKey(b);
}

/** A value as lower-case text, for the substring and equality operators. */
function text(v: unknown): string {
  return valueKey(v).toLowerCase();
}

/**
 * A value as the string a CONTROL can put in an attribute.
 *
 * An object is its own fields and values, keys sorted so two equal ones agree,
 * recursing because a value inside an object is a value too. An array is its
 * items in order; a Date is its timestamp, being a value and not a bag of
 * fields. TRAP T-a-value-can-be-an-object
 */
export function valueKey(v: unknown): string {
  if (v == null) return '';
  if (typeof v !== 'object') return String(v);
  if (v instanceof Date) return String(v.getTime());
  if (Array.isArray(v)) return `[${v.map(valueKey).join(',')}]`;
  const entries = Object.entries(v as Record<string, unknown>)
    .filter(([, val]) => val !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, val]) => `${k}:${valueKey(val)}`).join(',')}}`;
}

/**
 * A set of values to test against, using the query's own comparison.
 *
 * `valueSet(['Free']).has('free')` is true, which a plain `Set` would refuse.
 * For a control asking "is my row one of these?" — the question the query
 * answers the same way. TRAP T-one-comparison-rule-for-query-and-ui
 */
export function valueSet(values: Iterable<unknown>): { has: (v: unknown) => boolean } {
  const keys = new Set<string>();
  for (const v of values) keys.add(text(v));
  return { has: (v: unknown) => keys.has(text(v)) };
}

/**
 * Several clauses as ONE filter: bare when there is one, ANDed when there are
 * more, `undefined` when there are none.
 *
 * Five places wrote this by hand, which is four chances for one of them to
 * decide an empty list means something other than "no filter".
 */
export function andFilter(clauses: readonly Filter[]): Filter | undefined {
  const kept = clauses.filter(Boolean);
  if (!kept.length) return undefined;
  return kept.length === 1 ? kept[0]! : (['and', ...kept] as Filter);
}

/**
 * One field and the values picked for it, as a clause.
 *
 * ONE pick is `eq`; SEVERAL become `in`, because `eq` against a list can never
 * match. `ne` inverts to `notin` the same way. Nothing picked is no clause.
 */
export function picksClause(
  field: string,
  picked: readonly unknown[],
  op: FilterOp = 'eq',
): FilterClause | undefined {
  if (!picked.length) return undefined;
  if (picked.length === 1) return [field, op, picked[0]];
  return [field, op === 'ne' ? 'notin' : 'in', [...picked]];
}

/** Rows matching a filter. */
export function filterRows(rows: readonly Row[], filter?: Filter): Row[] {
  return filter ? rows.filter((r) => matchesFilter(r, filter)) : [...rows];
}

/** Rows matching a free-text search — `fields` when given, else every value. */
export function searchRows(rows: readonly Row[], term: string, fields?: readonly string[]): Row[] {
  const needle = term.trim().toLowerCase();
  if (!needle) return [...rows];
  return rows.filter((row) => {
    const values = fields?.length ? fields.map((f) => readField(row, f)) : Object.values(row);
    return values.some((v) => text(v).includes(needle));
  });
}

/* ── Grouping ──────────────────────────────────────────────────────────── */

/** One bunch of rows sharing a value in the grouped field. */
export interface RowGroup {
  key: string;
  rows: Row[];
}

/**
 * One group as the DATA LAYER sees it: the value, and how many rows carry it.
 *
 * A grid may DRAW a group as a heading row, but it does not create one — it
 * sees a page, so a count it works out itself is a page count.
 * TRAP T-a-group-is-a-data-layer-concept
 */
export interface GroupSummary {
  /** The comparison key, as every other part of the layer spells a value. */
  key: string;
  /** The raw value the key stands for. TRAP T-a-value-can-be-an-object */
  value: unknown;
  count: number;
}

/** Group by a field, keeping arrival order. Grouped AFTER sorting. */
export function groupSummaries(rows: readonly Row[], field: string): GroupSummary[] {
  return groupRows(rows, field).map((g) => ({
    key: g.key,
    value: g.rows[0] ? readField(g.rows[0], field) : undefined,
    count: g.rows.length,
  }));
}

export function groupRows(rows: readonly Row[], field: string): RowGroup[] {
  /* `String(v)` is "[object Object]" for EVERY object, so grouping by an
     object field put every row in ONE group and a chart drew one meaningless
     bar. `valueKey` is the same key the rest of the layer uses.
     TRAP T-a-value-can-be-an-object */
  const grouped = Map.groupBy(rows, (row) => valueKey(readField(row, field)));
  return [...grouped].map(([key, groupRowsIn]) => ({ key, rows: groupRowsIn }));
}

/* ── The pipeline ──────────────────────────────────────────────────────── */

/** Apply search → filter → sort, then page. TRAP T-pipeline-order-and-no-grouping */
export function applyOptions(rows: readonly Row[], options: LoadOptions = {}): LoadResult {
  let out: Row[] = [...rows];

  if (options.search) out = searchRows(out, options.search, options.searchFields);
  if (options.filter) out = filterRows(out, options.filter);

  // Grouping is a SORT: the group field sorts FIRST.
  const specs: SortSpec[] = options.group
    ? [{ field: options.group, direction: 'asc' }, ...(options.sort ?? [])]
    : (options.sort ?? []);
  if (specs.length) out = sortRows(out, specs);

  const total = out.length;

  const skip = options.skip ?? 0;
  const take = options.take;
  if (skip > 0 || take != null) {
    out = out.slice(skip, take == null ? undefined : skip + take);
  }

  return { rows: out, total };
}
