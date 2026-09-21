/**
 * aggregate.ts — turn ROWS into the shape a chart draws.
 *
 *   countBy(rows, 'category')                  → one bar per category
 *   aggregateBy(rows, 'region', 'sum', 'spend') → spend per region
 *   bandBy(rows, 'storage', [0, 20, 40, 60, 80, 100])  → a histogram
 *   seriesBy(rows, 'day', DAYS, 'Sessions')    → one named line series
 *   reduceRows(rows, 'mean', 'health')         → the ONE number a gauge reads
 *
 * WHY THIS IS IN THE DATA LAYER. Every chart's aggregation was hand-written in
 * the example, so the SHAPE was shared (`ChartDatum`) and the arithmetic was
 * not. That cost four things:
 *
 *   1. every new view re-implemented the same four functions;
 *   2. a SERVER could not pre-aggregate, though the DOM-free half exists
 *      precisely so it can;
 *   3. the MCP `run_query` tool could filter and sort but never answer
 *      "count by category";
 *   4. presentation decisions leaked into the arithmetic — `meanOf` rounded,
 *      which is why a gauge's tooltip lost its decimals.
 *
 * NOT A NEW PIPELINE. These run on rows a store has already filtered, sorted
 * and searched. Aggregation is what happens to the answer, not another way of
 * asking the question — `applyOptions` still owns the query.
 *
 * NUMBERS ARE RETURNED WHOLE. Nothing here rounds or formats; that is a
 * presentation decision and belongs to whatever draws the label.
 * TRAP T-an-aggregate-returns-the-number.
 * TRAP T-aggregation-is-data — why this is here and not in a view.
 */
import { readField, groupRows, type Row } from './store.js';
import type { ChartDatum } from './chart-datum.js';

/* ── Reducers ──────────────────────────────────────────────────────────── */

/** How a set of rows becomes one number. */
export type Aggregate = 'count' | 'sum' | 'mean' | 'min' | 'max';

/**
 * Every finite number in `field`, across `rows`.
 *
 * Rows whose value is absent or unparseable are SKIPPED rather than counted as
 * zero: a missing health score is not a health score of nought, and averaging
 * it in drags the mean toward zero in proportion to how much data is missing.
 */
function numbers(rows: readonly Row[], field: string): number[] {
  const out: number[] = [];
  for (const row of rows) {
    const raw = readField(row, field);
    /* `null` and `''` COERCE TO ZERO, and a zero is finite — so
       `Number.isFinite(Number(raw))` alone quietly counts every missing value
       as a real nought. It passes the sum (nought adds nothing) and fails the
       MEAN, by dividing by a bigger set than it measured.
       TRAP T-number-of-null-is-zero. */
    if (raw == null || raw === '') continue;
    const n = Number(raw);
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

/**
 * Reduce rows to ONE number — what a gauge or a metric tile reads.
 *
 * `count` needs no field and ignores one. Every other kind needs a numeric
 * field, and returns 0 for an empty set — a chart with no data draws nothing,
 * which is what 0 means here, and is why this does not return null.
 *
 * NOT ROUNDED. TRAP T-an-aggregate-returns-the-number.
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
   * The categories, in the order they must appear.
   *
   * A FIXED ORDER IS NOT COSMETIC. Without one, categories fall out in
   * count order — so a category changes colour and position when only its rank
   * moved, and a filter that drops two rows appears to recolour the chart. Two
   * charts of the same field also disagree about which colour a category is.
   *
   * Given, a category keeps its slot and its `colorIndex` whatever the data
   * does. Omitted, the order is first-seen in the rows, which is stable for a
   * sorted query and is the right answer when the order on screen IS the order
   * in the data.
   *
   * TRAP T-a-category-keeps-its-colour.
   */
  order?: readonly string[];
  /**
   * Keep categories the rows never mention, at zero.
   *
   * Off by default: an empty bar for a category nothing matched is noise. On
   * when the categories are a fixed scale — severity levels, storage bands —
   * where a missing one is itself the finding. Needs `order`.
   */
  includeEmpty?: boolean;
}

/**
 * Group rows by a field and reduce each group to a number.
 *
 * ```ts
 * aggregateBy(rows, 'category')                       // how many per category
 * aggregateBy(rows, 'region', 'sum', 'spend')         // spend per region
 * aggregateBy(rows, 'os', 'count', undefined, { order: OS_ORDER })
 * ```
 *
 * Returns `ChartDatum[]` — the one shape a bar, a slice and a legend row all
 * take. `colorIndex` is 1-based and follows `order` when one is given, so the
 * same category is the same colour in every chart that shares that order.
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
    // 1-BASED, and from the declared order when there is one — so a category
    // keeps its colour even when a filter removes the category above it.
    colorIndex: (order ? order.indexOf(label) : i) + 1,
  }));
}

/**
 * Count rows per category — `aggregateBy`'s commonest call, said plainly.
 */
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
 * `edges` are the boundaries, ascending: `[0, 20, 40, 60, 80, 100]` gives five
 * bands. Each band holds values from its lower edge up to but NOT including the
 * upper one, except the last, which includes its top — so 100 lands in `81-100`
 * rather than falling off the end. That is the rule every histogram needs and
 * the one an off-by-one gets wrong.
 *
 * Values below the first edge or above the last are dropped: they are outside
 * the scale the caller declared, and silently folding them into the end bands
 * would misreport both.
 *
 * TRAP T-the-last-band-includes-its-top.
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
    // "0-20", "21-40" — the printed label starts one above the previous edge,
    // because the bands are half-open and "20-40" would read as overlapping.
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
 * One series: a value per point, in the caller's own point order.
 *
 * `points` is the x-axis — the days, the buckets, the steps. Every point gets
 * a number even where no row matched, because a line with a hole in it is a
 * line that lies about the shape: a quiet Tuesday is zero, not absent.
 *
 * TRAP T-a-series-has-a-value-at-every-point.
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
