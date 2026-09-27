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
 *
 * Map:
 * - Aggregate — How a set of rows becomes one number.
 * - reduceRows — Reduce rows to ONE number — what a gauge or a metric tile reads.
 * - AggregateOptions — category order, and whether an empty category keeps its slot
 * - aggregateBy — Group rows by a field and reduce each group to a number.
 * - countBy — Count rows per category — `aggregateBy`'s commonest call, said plainly.
 * - bandBy — Cut a CONTINUOUS field into bands — a histogram, not a pie.
 * - deltaPercent — The change from the first point to the last, as a percentage.
 * - Series — One named line, as `sherpa-line-chart` takes it.
 * - seriesBy — One series: a value per point, in the caller's own point order.
 * - Bucket — A date cut to one step — its ISO prefix, so the keys sort as they read.
 * - SummarySpec — What a component asks to see of its rows: its attributes, as JSON.
 * - Summary — What `summarise` hands a component, by the shape it asked for.
 * - summarise — Rows into the shape a component declared — one door for every chart and tile.
 */
import { readField, groupRows, valueKey, type Row } from './store.js';
import type { ChartDatum } from './chart-datum.js';

/* ── Reducers ──────────────────────────────────────────────────────────── */

/** How a set of rows becomes one number. */
export type Aggregate = 'count' | 'sum' | 'mean' | 'min' | 'max' | 'distinct';

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
  if (kind === 'distinct') {
    const keys = rows.map((r) => readField(r, field)).filter((v) => v != null && v !== '');
    return new Set(keys.map(valueKey)).size;
  }
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
   * The categories, in order — the GROUP KEYS, so an object field wants
   * `[DANA, RAVI].map(valueKey)`. Given, a category keeps its slot and its
   * `colorIndex`; omitted, the order is first-seen.
   * TRAP T-a-category-keeps-its-colour
   * TRAP T-a-value-can-be-an-object
   */
  order?: readonly string[];
  /** Keep unmentioned categories at zero. Needs `order`. For a fixed scale,
   *  and for a LEGEND, which lists what EXISTS and is the way back to a
   *  category a filter emptied.
   *  TRAP T-a-legend-row-goes-inactive-it-never-vanishes */
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
    /* THE LABEL NAMES WHAT IT COUNTS, so every band but the last stops one
       below its top edge — bands are half-open.
       TRAP T-a-band-label-names-what-it-counts */
    label: options.labels?.[i]
      ?? `${edges[i]}-${i === count - 1 ? edges[i + 1] : edges[i + 1]! - 1}`,
    value,
    colorIndex: i + 1,
  }));
}

/**
 * The change from the first point to the last, as a percentage. A metric tile
 * derives its trend from this, and its status from the trend, so a tile handed
 * no series is grey.
 *
 * `null` when there is nothing to compare: fewer than two points, or a first
 * point of zero, where the change is undefined rather than infinite.
 * TRAP T-a-delta-is-derived-not-declared
 */
export function deltaPercent(values: readonly number[]): number | null {
  if (values.length < 2) return null;
  const first = values[0]!;
  const last = values[values.length - 1]!;
  if (!Number.isFinite(first) || !Number.isFinite(last) || first === 0) return null;
  return ((last - first) / Math.abs(first)) * 100;
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
    // `valueKey`, the same rule `groupRows` keyed by.
    // TRAP T-a-value-can-be-an-object
    values: points.map((p) => reduceRows(groups.get(valueKey(p)) ?? [], kind, valueField)),
  };
  if (colorIndex != null) series.colorIndex = colorIndex;
  return series;
}

/* ── Summaries ─────────────────────────────────────────────────────────── */

/** A date cut to one step — its ISO prefix, so the keys sort as they read. */
export type Bucket = 'day' | 'month' | 'year';

/** What a component asks to see of its rows: its attributes, as JSON. */
export interface SummarySpec {
  /** `aggregate` — one number, or `{ value, values, deltaPercent }` over a
   *  field; `segments` — one datum per value; `series` — lines over a field. */
  shape: 'aggregate' | 'segments' | 'series';
  aggregate?: Aggregate;
  /** The number a sum, mean, min, max or distinct reads. */
  field?: string;
  /** One datum, or one line, per value of this field. */
  segment?: string;
  /** A NUMBER segment field cut at these ascending edges — a histogram.
   *  TRAP T-the-last-band-includes-its-top */
  bands?: number[];
  /** A series runs over this field's values. */
  over?: string;
  bucket?: Bucket;
  /** Keep every declared category, at zero — a legend.
   *  TRAP T-a-legend-row-goes-inactive-it-never-vanishes */
  keepEmpty?: boolean;
}

/** What `summarise` hands a component, by the shape it asked for. */
export type Summary =
  | number
  | ChartDatum[]
  | { value: number; values: number[]; deltaPercent?: number }
  | { labels: string[]; series: Series[] };

const CUT: Record<Bucket, number> = { year: 4, month: 7, day: 10 };

function cut(value: unknown, bucket: Bucket): string {
  return (value instanceof Date ? value.toISOString() : String(value ?? '')).slice(0, CUT[bucket]);
}

/** The bucket after `key`. UTC, so no clock change moves a day. */
function step(key: string, bucket: Bucket): string {
  if (bucket === 'year') return String(Number(key) + 1);
  if (bucket === 'month') {
    const [y = NaN, m = NaN] = key.split('-').map(Number);
    const next = y * 12 + m;
    return `${Math.floor(next / 12)}-${String((next % 12) + 1).padStart(2, '0')}`;
  }
  return new Date(Date.parse(`${key}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
}

const ascending = (a: unknown, b: unknown): number =>
  (a as string) < (b as string) ? -1 : (a as string) > (b as string) ? 1 : 0;

/**
 * The points a series runs over: the field's declared values, or else every
 * bucket from the first to the last — a quiet month is zero, never missing.
 * TRAP T-a-series-has-a-value-at-every-point
 */
function pointsOf(rows: readonly Row[], over: string, bucket: Bucket | undefined, declared: readonly unknown[]): unknown[] {
  const keyOf = (v: unknown): unknown => (bucket ? cut(v, bucket) : v);
  if (declared.length) return bucket ? [...new Set(declared.map(keyOf))].sort(ascending) : [...declared];
  const seen = [...new Set(rows.map((r) => readField(r, over)).filter((v) => v != null && v !== '').map(keyOf))]
    .sort(ascending);
  if (!bucket || seen.length < 2) return seen;
  const out: string[] = [];
  const last = seen[seen.length - 1] as string;
  // Capped: a key the step cannot parse would otherwise never reach `last`.
  for (let k = seen[0] as string; k <= last && out.length < 10_000; k = step(k, bucket)) out.push(k);
  return out;
}

/**
 * Rows into the shape a component declared — one door for every chart and
 * tile, so a page writes attributes instead of an `as` adapter. `domain` is a
 * field's declared values: a category keeps its slot and colour, and a series
 * its points. TRAP T-aggregation-is-data
 */
export function summarise(
  rows: readonly Row[],
  spec: SummarySpec,
  domain: (field: string) => readonly unknown[] = () => [],
): Summary {
  const kind = spec.aggregate ?? 'count';
  const opts = spec.field ? { kind, valueField: spec.field } : { kind };
  if (spec.shape === 'segments') {
    if (!spec.segment) return [];
    if (spec.bands?.length) return bandBy(rows, spec.segment, spec.bands);
    const order = domain(spec.segment).map(valueKey);
    return aggregateBy(rows, spec.segment, kind, spec.field,
      order.length ? { order, includeEmpty: spec.keepEmpty ?? false } : {});
  }
  const value = reduceRows(rows, kind, spec.field);
  if (!spec.over) return spec.shape === 'aggregate' ? value : { labels: [], series: [] };
  // A bucketed field is grouped by its cut key, under a name no row carries.
  const at = spec.bucket ? '\u0000bucket' : spec.over;
  const bucket = spec.bucket;
  const keyed = bucket ? rows.map((r) => ({ ...r, [at]: cut(readField(r, spec.over!), bucket) })) : rows;
  const points = pointsOf(rows, spec.over, bucket, domain(spec.over)) as (string | number)[];
  if (spec.shape === 'aggregate') {
    const values = seriesBy(keyed, at, points, '', opts).values;
    const delta = deltaPercent(values);
    return delta == null ? { value, values } : { value, values, deltaPercent: delta };
  }
  const labels = points.map(String);
  if (!spec.segment) return { labels, series: [seriesBy(keyed, at, points, spec.field ?? kind, opts)] };
  const groups = new Map(groupRows(keyed, spec.segment).map((g) => [g.key, g.rows]));
  const declared = domain(spec.segment).map(valueKey);
  const order = declared.length ? declared : [...groups.keys()];
  // A line with no rows is gone, not flat — a legend's pick removes it. Its colour stays.
  return {
    labels,
    series: order.filter((name) => spec.keepEmpty || groups.has(name)).map((name) =>
      seriesBy(groups.get(name) ?? [], at, points, name, { ...opts, colorIndex: order.indexOf(name) + 1 })),
  };
}

