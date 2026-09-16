/**
 * store.ts — where records come from.
 *
 * A Store is STATELESS: it reads and writes records and remembers nothing about
 * how they are being viewed. Sorting, filtering, grouping and paging are the
 * DataSource's job (see data-source.ts), so one store can back several views of
 * the same records without them fighting over a shared cursor.
 *
 * That split is DevExtreme's, which Apex already uses — so the mental model
 * transfers. What is NOT borrowed is the size: no OData, no remote grouping, no
 * query-builder language. A store answers `load(options)` and four CRUD calls.
 *
 * Every store extends EventTarget, so "tell everyone the records changed" is the
 * platform's own dispatchEvent rather than a subscriber list written by hand.
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
 * `[field, op, value]` rather than a function, because a filter has to survive
 * being sent to a server: a RestStore turns it into a query string, an ArrayStore
 * runs it in memory, and both read the SAME declaration. A predicate function
 * could only ever run on the client.
 *
 * Groups nest: `['and', [...], [...]]`. `or` is the same shape.
 */
export type FilterOp =
  | 'eq' | 'ne' | 'lt' | 'lte' | 'gt' | 'gte'
  | 'contains' | 'notcontains' | 'startswith' | 'endswith'
  | 'in' | 'notin'
  | 'between';

/**
 * How each operator READS to a person.
 *
 * Beside `FilterOp` on purpose: the keys ARE the operators, so a control can
 * build its picker from this map and whatever it reports back is already a
 * clause the store understands. No translation table exists to drift.
 *
 * Every query-building surface shares it — the data grid's column menu today,
 * a Filter Panel later. A second copy anywhere is a second vocabulary.
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
 * DevExtreme's binary operations, split by what the question means. Offering
 * "greater than" on a name column invites a comparison the reader cannot
 * reason about; offering "starts with" on a spend column is not a question at
 * all.
 *
 * `between` is absent from both: it is the RANGE mode, because a span needs two
 * inputs and a single condition list cannot grow one.
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
}

/**
 * The store interface. Identical whatever backs it, so a view can be moved from
 * an in-memory array to an HTTP endpoint without touching the components.
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
 * `detail` names what happened so a listener can be cheap about it, but a
 * DataSource simply reloads: deciding whether a changed row still matches the
 * current filter, and where it now sorts, is exactly the work the source already
 * does, and re-deriving is cheaper than getting that wrong.
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
 * `'customer.name'` reaches into a nested record, which an agent or API payload
 * routinely has. A field with no dot is a plain lookup, so the common case costs
 * one property read.
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
 * The reason this exists is recorded in the data-layer plan: the grid, the
 * quick-filter toolbar and the example app each had their own compare, and they
 * DISAGREED — one passed `{ numeric: true }` and one did not, so "item 2" and
 * "item 10" ordered differently depending on which control you used.
 *
 * A single Intl.Collator instance is reused for the whole sort. `localeCompare`
 * re-derives the locale rules on every call, which is markedly slower across a
 * few hundred rows.
 */
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

/**
 * Compare two field values. Nulls sort LAST in either direction — "no value" is
 * not a small value, and flipping the sort should not march the blanks to the top.
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
 * `toSorted` rather than `sort`: the caller's array must not be reordered under
 * it, because a store's records are shared by every source reading them.
 * Null direction is treated as ascending, matching `data-sort-direction`.
 */
export function sortRows(rows: readonly Row[], specs: readonly SortSpec[]): Row[] {
  if (!specs.length) return [...rows];
  return rows.toSorted((a, b) => {
    for (const spec of specs) {
      const dir = spec.direction === 'desc' ? -1 : 1;
      // Nulls are pinned last by compareValues, so the direction must NOT flip
      // them — a blank belongs at the bottom whichever way the column runs.
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
 * A filter is a tree, so a bound component cannot just read `filter[0]` to find
 * out which of its columns are being narrowed. This flattens it. Used to tell
 * the grid which headers to mark active — the column doing something to the
 * view has to say so, and only the source knows what the filter is.
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
    // A field can appear in more than one clause (a range is two), and the
    // header only needs to know THAT it is filtered, not how many times.
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
      // Inclusive, and order-insensitive — a date range picked backwards is a
      // range, not an empty result.
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
 * A filter value arrives as a STRING far more often than not — from an attribute,
 * a query string, a chip's `value`. `'pro' === 'Pro'` is false and would quietly
 * filter everything away, so string comparison here is case-insensitive. A
 * strictly-typed comparison stays available through `lt`/`gt`.
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
 * Order matters: rows are grouped AFTER sorting, so the groups come out in sort
 * order and the rows within each group keep theirs. `Map.groupBy` keeps insertion
 * order, which is exactly that.
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
 * The order is not arbitrary. Narrowing comes first so the sort runs over fewer
 * rows; paging comes LAST because the page is a window onto the final order, and
 * `total` has to count the matches, not the page.
 *
 * Grouping is deliberately NOT applied here. A grouped view still needs the flat
 * rows — sherpa-data-grid sorts by the group field and stamps a heading row when
 * the value changes — so the group field is applied as a leading SORT and the
 * consumer decides what to draw.
 */
export function applyOptions(rows: readonly Row[], options: LoadOptions = {}): LoadResult {
  let out: Row[] = [...rows];

  if (options.search) out = searchRows(out, options.search, options.searchFields);
  if (options.filter) out = filterRows(out, options.filter);

  // The GROUP field sorts first, so rows sharing a group value are adjacent and a
  // consumer can find each group in one pass. The sort specs then order rows
  // WITHIN their group.
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
