/**
 * store.ts — where records come from: the row shape, the filter grammar, and
 * the in-memory pipeline every store shares.
 *
 * TRAP T-store-is-stateless
 */

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
 * `eq`/`ne` over a field with known values is a list — the reader picks Gold,
 * not types it, and a typo cannot match nothing silently. `contains` and its
 * relatives are a typed fragment: no list can hold every substring.
 *
 * This is the rule both filter menus follow, so the condition dropdown swaps
 * the body beneath it rather than each menu deciding for itself.
 * TRAP T-an-operator-decides-pick-or-type
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
  return collator.compare(String(a), String(b));
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
 * The data layer has always compared loosely, so `['plan','in',['free']]`
 * matches a row holding `'Free'`. Three components compared EXACTLY, so a
 * value round-tripping back from the query never ticked its own menu row: the
 * filter worked and the control that set it looked untouched.
 * Exported alongside `valueSet`, which is what a control usually wants: this
 * is the single-value form of the same rule.
 * TRAP T-one-comparison-rule-for-query-and-ui
 */
export function looseEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a === 'number' && typeof b === 'number') return a === b;
  return text(a) === text(b);
}

/** A value as lower-case text, for the substring and equality operators. */
function text(v: unknown): string {
  return v == null ? '' : String(v).toLowerCase();
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

/** Group by a field, keeping arrival order. Grouped AFTER sorting. */
export function groupRows(rows: readonly Row[], field: string): RowGroup[] {
  const grouped = Map.groupBy(rows, (row) => {
    const v = readField(row, field);
    return v == null ? '' : String(v);
  });
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
