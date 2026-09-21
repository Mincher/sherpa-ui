/**
 * aggregate.ts — turn ROWS into the shape a chart draws.
 *
 * Runs on rows a store has already filtered and sorted; `applyOptions` still
 * owns the query. DOM-free, so a server or the MCP can aggregate too.
 *
 * Nothing here rounds or formats.
 *
 * TRAP T-an-aggregate-returns-the-number
 * TRAP T-aggregation-is-data
 */
import { readField, groupRows, type Row } from './store.js';
import type { ChartDatum } from './chart-datum.js';

/* ── Reducers ──────────────────────────────────────────────────────────── */

/** How a set of rows becomes one number. */
export type Aggregate = 'count' | 'sum' | 'mean' | 'min' | 'max';

/** Every finite number in `field`. Missing values are SKIPPED, never zero. */
function numbers(rows: readonly Row[], field: string): number[] {
  const out: number[] = [];
  for (const row of rows) {
    const raw = readField(row, field);
    /* `null` and `''` coerce to a finite 0, so the isFinite test alone counts
       every missing value as a real nought and skews the mean.
       TRAP T-number-of-null-is-zero */
    if (raw == null || raw === '') continue;
    const n = Number(raw);
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

/**
 * Reduce rows to ONE number — what a gauge or a metric tile reads.
 * `count` ignores `field`. An empty set is 0, never null.
 * TRAP T-an-aggregate-returns-the-number
 */
export function reduceRows(
  rows: readonly Row[],
  kind: Aggregate = 'count',
  field?: string,
): number {
  if (kind === 'count') return rows.length;
  if (!field) return 0;
  const nums = numbers(rows, field);
  if (!nums.length) return 0;
  switch (kind) {
    case 'sum': return nums.reduce((a, b) => a + b, 0);
    case 'mean': return nums.reduce((a, b) => a + b, 0) / nums.length;
    case 'min': return Math.min(...nums);
    case 'max': return Math.max(...nums);
  }
}

/* ── Grouped aggregation ───────────────────────────────────────────────── */

export interface AggregateOptions {
  /**
   * The categories, in order. Given, a category keeps its slot and its
   * `colorIndex` whatever the data does; omitted, the order is first-seen.
   * TRAP T-a-category-keeps-its-colour
   */
  order?: readonly string[];
  /** Keep unmentioned categories at zero. Needs `order`. For a fixed scale,
   *  where a missing category is itself the finding. */
  includeEmpty?: boolean;
}

/**
 * Group rows by a field and reduce each group to a number.
 *
 * `aggregateBy(rows, 'region', 'sum', 'spend')` — spend per region.
 *
 * `colorIndex` is 1-based and follows `order`, so the same category is the same
 * colour in every chart sharing that order.
 */
export function aggregateBy(
  rows: readonly Row[],
  field: string,
  kind: Aggregate = 'count',
  valueField?: string,
  options: AggregateOptions = {},
): ChartDatum[] {
  const groups = new Map(groupRows(rows, field).map((g) => [g.key, g.rows]));
  const { order, includeEmpty = false } = options;

  const labels = order
    ? order.filter((label) => includeEmpty || groups.has(label))
    : [...groups.keys()];

  return labels.map((label, i) => ({
    label,
    value: reduceRows(groups.get(label) ?? [], kind, valueField),
    // 1-based, from the declared order when there is one.
    colorIndex: (order ? order.indexOf(label) : i) + 1,
  }));
}

/** Count rows per category — `aggregateBy`'s commonest call, said plainly. */
export function countBy(
  rows: readonly Row[],
  field: string,
  options: AggregateOptions = {},
): ChartDatum[] {
  return aggregateBy(rows, field, 'count', undefined, options);
}

/* ── Bands ─────────────────────────────────────────────────────────────── */

/**
 * Cut a CONTINUOUS field into bands — a histogram, not a pie.
 *
 * `edges` are ascending boundaries: `[0, 20, 40, 60, 80, 100]` gives five
 * bands. Bands are half-open except the last, which includes its top. Values
 * outside the first and last edge are dropped, not folded into the end bands.
 *
 * TRAP T-the-last-band-includes-its-top
 */
export function bandBy(
  rows: readonly Row[],
  field: string,
  edges: readonly number[],
  options: { labels?: readonly string[] } = {},
): ChartDatum[] {
  if (edges.length < 2) return [];
  const count = edges.length - 1;
  const counts = new Array<number>(count).fill(0);

  for (const n of numbers(rows, field)) {
    if (n < edges[0]! || n > edges[count]!) continue;
    // The LAST band owns its top edge; every other is half-open.
    let i = count - 1;
    while (i > 0 && n < edges[i]!) i--;
    counts[i]! += 1;
  }

  return counts.map((value, i) => ({
    // "0-20", "21-40" — one above the previous edge, since "20-40" would read
    // as overlapping.
    label: options.labels?.[i] ?? `${i === 0 ? edges[0] : edges[i]! + 1}-${edges[i + 1]}`,
    value,
    colorIndex: i + 1,
  }));
}

/* ── Series ────────────────────────────────────────────────────────────── */

/** One named line, as `sherpa-line-chart` takes it. */
export interface Series {
  name: string;
  values: number[];
  colorIndex?: number;
}

/**
 * One series: a value per point, in the caller's own point order. Every point
 * gets a number even where no row matched — a quiet Tuesday is zero, not absent.
 * TRAP T-a-series-has-a-value-at-every-point
 */
export function seriesBy(
  rows: readonly Row[],
  field: string,
  points: readonly (string | number)[],
  name: string,
  options: { colorIndex?: number; kind?: Aggregate; valueField?: string } = {},
): Series {
  const { colorIndex, kind = 'count', valueField } = options;
  const groups = new Map(groupRows(rows, field).map((g) => [g.key, g.rows]));
  const series: Series = {
    name,
    values: points.map((p) => reduceRows(groups.get(String(p)) ?? [], kind, valueField)),
  };
  if (colorIndex != null) series.colorIndex = colorIndex;
  return series;
}
