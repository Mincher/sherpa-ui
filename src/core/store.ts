/**
 * store.ts — where records come from.
 *
 * TRAP T-store-is-stateless — the Store/DataSource split, and why `change`
 * means "reload".
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

/**
 * A filter, in the one shape the whole layer speaks.
 *
 * TRAP T-filter-is-data-not-a-predicate — and why `OP_LABELS` sits beside it.
 */
export type FilterOp =
  | 'eq' | 'ne' | 'lt' | 'lte' | 'gt' | 'gte'
  | 'contains' | 'notcontains' | 'startswith' | 'endswith'
  | 'in' | 'notin'
  | 'between';

/**
 * How each operator READS to a person.
 *
 * TRAP T-filter-is-data-not-a-predicate — a second copy is a second vocabulary.
 */
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
 * The operators each COLUMN TYPE can sensibly answer.
 *
 * TRAP T-ops-follow-the-column-type — and why `between` is in neither list.
 */
export const OPS_FOR_TYPE: Record<string, readonly FilterOp[]> = {
  text: ['contains', 'notcontains', 'startswith', 'endswith', 'eq', 'ne'],
  number: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte'],
  // A date is answered by clicking a calendar, so it offers no operator list.
  date: [],
};

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
  /**
   * Rows the store's schema REFUSED, and so did not hand over.
   *
   * TRAP T-dropped-rows-must-be-countable — a silent drop is worse.
   */
  dropped?: number;
  /** Why the dropped rows were refused — the FIRST FEW only. */
  issues?: ReadonlyArray<{ readonly message: string; readonly path?: ReadonlyArray<PropertyKey> }>;
}

/**
 * The store interface. Identical whatever backs it, so a view can be moved from
 * an in-memory array to an HTTP endpoint without touching the components.
 * TRAP T-store-is-stateless
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

/**
 * Fired when a store's records change — after an insert, update or remove.
 *
 * TRAP T-store-is-stateless — `detail` names what happened, but a DataSource
 * simply RELOADS.
 */
export interface StoreChangeDetail {
  type: 'insert' | 'update' | 'remove';
  key?: unknown;
  row?: Row;
}

/* ── Value access ──────────────────────────────────────────────────────── */

/**
 * Read a field from a row, following dots into nested objects.
 *
 * `'customer.name'` reaches into a nested record, as an agent or API payload
 * routinely has. No dot is a plain lookup, so the common case costs one read.
 */
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

/**
 * ONE comparator for the whole library.
 *
 * TRAP T-one-collator-for-the-library — three compares disagreed; nulls last.
 */
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

/**
 * Compare two field values. Nulls sort LAST in either direction — "no value" is
 * not a small value, and flipping the sort should not march the blanks to the top.
 *
 * TRAP T-one-collator-for-the-library — one shared collator, nulls last.
 */
export function compareValues(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  return collator.compare(String(a), String(b));
}

/**
 * Sort rows by a list of specs, first spec wins and later ones break ties.
 *
 * TRAP T-one-collator-for-the-library — `toSorted`, never `sort`.
 */
export function sortRows(rows: readonly Row[], specs: readonly SortSpec[]): Row[] {
  if (!specs.length) return [...rows];
  return rows.toSorted((a, b) => {
    for (const spec of specs) {
      const dir = spec.direction === 'desc' ? -1 : 1;
      // TRAP T-one-collator-for-the-library — the direction must NOT flip nulls.
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

/**
 * Every FIELD one filter touches, in the order it first appears.
 *
 * TRAP T-filter-fields-flattens-the-tree — a grid needs a flat column list.
 */
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
    // TRAP T-filter-fields-flattens-the-tree — a range is two clauses.
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
      // TRAP T-loose-equal-is-case-insensitive — backwards is still a range.
      if (!Array.isArray(value) || value.length !== 2 || actual == null) return false;
      const [lo, hi] = compareValues(value[0], value[1]) <= 0
        ? [value[0], value[1]]
        : [value[1], value[0]];
      return compareValues(actual, lo) >= 0 && compareValues(actual, hi) <= 0;
    }
  }
}

/**
 * Compare for filtering, not for sorting.
 *
 * TRAP T-loose-equal-is-case-insensitive — `'pro' === 'Pro'` is false.
 */
function looseEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a === 'number' && typeof b === 'number') return a === b;
  return text(a) === text(b);
}

/** A value as lower-case text, for the substring and equality operators. */
function text(v: unknown): string {
  return v == null ? '' : String(v).toLowerCase();
}

/** Rows matching a filter. */
export function filterRows(rows: readonly Row[], filter?: Filter): Row[] {
  return filter ? rows.filter((r) => matchesFilter(r, filter)) : [...rows];
}

/**
 * Rows matching a free-text search.
 *
 * Searches `fields` when given, else every value that stringifies — an agent or
 * API payload rarely announces which of its fields a human would search.
 */
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
 * Group rows by a field, preserving the order they arrive in.
 *
 * TRAP T-pipeline-order-and-no-grouping — grouped AFTER sorting.
 */
export function groupRows(rows: readonly Row[], field: string): RowGroup[] {
  const grouped = Map.groupBy(rows, (row) => {
    const v = readField(row, field);
    return v == null ? '' : String(v);
  });
  return [...grouped].map(([key, groupRowsIn]) => ({ key, rows: groupRowsIn }));
}

/* ── The pipeline ──────────────────────────────────────────────────────── */

/**
 * Apply search → filter → sort, then page.
 *
 * TRAP T-pipeline-order-and-no-grouping — paging last; grouping is a SORT.
 */
export function applyOptions(rows: readonly Row[], options: LoadOptions = {}): LoadResult {
  let out: Row[] = [...rows];

  if (options.search) out = searchRows(out, options.search, options.searchFields);
  if (options.filter) out = filterRows(out, options.filter);

  // The GROUP field sorts FIRST — see TRAP T-pipeline-order-and-no-grouping.
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
