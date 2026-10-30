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
 * - BandFacts — A field's bands, as a summary reads them: its thresholds, and the bottom of its scale.
 * - Zoned — A summary with its value field's bands beside it: a gauge's zones.
 * - summariseBanded — Rows into the declared shape, with the fields' bands: a segments cut, and zones.
 * - summariseMarked — The same, and each segment's part the highlight's driver matches.
 */
import { compareValues, readField, groupRows, valueKey, type Row, type SortDirection } from './store.js';
import type { ChartDatum } from './chart-datum.js';
import { bandEdges, type Threshold } from './threshold.js';

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
  /** Each point's part the highlight's driver matches. TODO 441 */
  matched?: number[];
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
  /** Each band's name, where its field's thresholds give one. TODO 150 */
  bandLabels?: string[];
  /** A series runs over this field's values. */
  over?: string;
  bucket?: Bucket;
  /** Keep every declared category, at zero — a legend.
   *  TRAP T-a-legend-row-goes-inactive-it-never-vanishes */
  keepEmpty?: boolean;
  /** Hand its value field's thresholds beside it as zones: a gauge. */
  zones?: boolean;
  /** Each segment's rows again, by this field: its `stack` — a bar chart's
   *  Secondary, its colours and legend. Not for bands. Will, TODO 548 */
  stack?: string;
  /** Each segment's rows again — each stack piece's, where it stacks — by this
   *  field: its `parts`. Not for bands. TODO 548 */
  group?: string;
  /** The segments by value; none keeps their declared order. TODO 548 */
  sort?: SortDirection;
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

/**
 * The points a series runs over: the field's declared values, or else every
 * bucket from the first to the last — a quiet month is zero, never missing.
 * TRAP T-a-series-has-a-value-at-every-point
 */
function pointsOf(rows: readonly Row[], over: string, bucket: Bucket | undefined, declared: readonly unknown[]): unknown[] {
  const keyOf = (v: unknown): unknown => (bucket ? cut(v, bucket) : v);
  // In the library's one order. TRAP T-one-collator-for-the-library
  if (declared.length) return bucket ? [...new Set(declared.map(keyOf))].sort(compareValues) : [...declared];
  const seen = [...new Set(rows.map((r) => readField(r, over)).filter((v) => v != null && v !== '').map(keyOf))]
    .sort(compareValues);
  if (!bucket || seen.length < 2) return seen;
  const out: string[] = [];
  const last = seen[seen.length - 1] as string;
  // Capped: a key the step cannot parse would otherwise never reach `last`.
  for (let k = seen[0] as string; k <= last && out.length < 10_000; k = step(k, bucket)) out.push(k);
  return out;
}

/** Each segment's rows again, by the group field: its parts, in the group's ONE
 *  order — declared, else first seen — so a value is one colour in every segment. TODO 548 */
function withParts(rows: readonly Row[], segments: ChartDatum[], spec: SummarySpec & { segment: string; group: string },
  domain: (field: string) => readonly unknown[]): ChartDatum[] {
  const bySegment = new Map(groupRows(rows, spec.segment).map((g) => [g.key, g.rows]));
  const declared = domain(spec.group).map(valueKey);
  const order = declared.length ? declared : groupRows(rows, spec.group).map((g) => g.key);
  const kind = spec.aggregate ?? 'count';
  return segments.map((s) => {
    const own = bySegment.get(s.label) ?? [];
    return { ...s, parts: kind === 'distinct' && spec.field ? distinctParts(own, spec.group, spec.field, order) : aggregateBy(own, spec.group, kind, spec.field, { order }) };
  });
}

/** A distinct count's parts, which ADD UP to their segment: each value counted
 *  once, in the group most of its rows are in — a tie, the first in order. A
 *  customer in two plans is one customer. Will, TODO 548 */
function distinctParts(rows: readonly Row[], group: string, field: string, order: readonly string[]): ChartDatum[] {
  const tally = new Map<string, Map<string, number>>();
  for (const { key, rows: inGroup } of groupRows(rows, group)) {
    for (const row of inGroup) {
      const v = readField(row, field);
      if (v == null || v === '') continue;
      const by = tally.get(valueKey(v)) ?? new Map<string, number>();
      by.set(key, (by.get(key) ?? 0) + 1);
      tally.set(valueKey(v), by);
    }
  }
  const rank = (g: string): number => (order.includes(g) ? order.indexOf(g) : order.length);
  const homes = new Map<string, number>();
  for (const by of tally.values()) {
    const [home] = [...by].sort(([a, n], [b, m]) => m - n || rank(a) - rank(b))[0] ?? [];
    if (home !== undefined) homes.set(home, (homes.get(home) ?? 0) + 1);
  }
  const labels = [...order.filter((g) => homes.has(g)), ...[...homes.keys()].filter((g) => !order.includes(g))];
  return labels.map((label) => ({ label, value: homes.get(label) ?? 0, colorIndex: rank(label) + 1 }));
}

/** Each segment stacked by the stack field — its pieces, in that field's order
 *  and colours — and each piece's parts by the group. Will, TODO 548 */
function withStack(rows: readonly Row[], segments: ChartDatum[], spec: SummarySpec & { segment: string; stack: string },
  domain: (field: string) => readonly unknown[]): ChartDatum[] {
  const bySegment = new Map(groupRows(rows, spec.segment).map((g) => [g.key, g.rows]));
  const declared = domain(spec.stack).map(valueKey);
  const order = declared.length ? declared : groupRows(rows, spec.stack).map((g) => g.key);
  const kind = spec.aggregate ?? 'count';
  return segments.map((s) => {
    const own = bySegment.get(s.label) ?? [];
    const pieces = aggregateBy(own, spec.stack, kind, spec.field, { order });
    // Each piece's rows are its segment's of that stack value: its parts are theirs.
    return { ...s, stack: spec.group ? withParts(own, pieces, { ...spec, segment: spec.stack, group: spec.group }, domain) : pieces };
  });
}

/** The segments by value; none keeps their order. Each keeps its colour. TODO 548 */
function sortSegments(segments: ChartDatum[], sort?: SortDirection): ChartDatum[] {
  if (!sort) return segments;
  const way = sort === 'desc' ? -1 : 1;
  const inner = (s: ChartDatum): ChartDatum => ({
    ...s,
    ...(s.stack ? { stack: sortSegments(s.stack, sort) } : {}),
    ...(s.parts ? { parts: sortSegments(s.parts, sort) } : {}),
  });
  return segments.map(inner).sort((a, b) => way * (a.value - b.value));
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
    if (spec.bands?.length) return sortSegments(bandBy(rows, spec.segment, spec.bands, spec.bandLabels ? { labels: spec.bandLabels } : {}), spec.sort);
    const order = domain(spec.segment).map(valueKey);
    const segments = aggregateBy(rows, spec.segment, kind, spec.field,
      order.length ? { order, includeEmpty: spec.keepEmpty ?? false } : {});
    const split = spec.stack ? withStack(rows, segments, { ...spec, segment: spec.segment, stack: spec.stack }, domain)
      : spec.group ? withParts(rows, segments, { ...spec, segment: spec.segment, group: spec.group }, domain) : segments;
    return sortSegments(split, spec.sort);
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

/** A field's bands, as a summary reads them: its thresholds, and the bottom of its scale. */
export type BandFacts = (field: string) => { thresholds?: readonly Threshold[]; min?: number };

/** A summary with its value field's bands beside it: a gauge's zones. */
export type Zoned = Record<string, unknown> & { zones: readonly Threshold[] };

/** Rows into the declared shape, with the fields' BANDS: a segments summary cut
 *  at its field's thresholds, and zones beside a value. TRAP T-a-threshold-is-a-fact-of-the-field */
export function summariseBanded(
  rows: readonly Row[],
  spec: SummarySpec,
  domain: (field: string) => readonly unknown[] = () => [],
  bands: BandFacts = () => ({}),
): Summary | Zoned {
  const segment = spec.segment ? bands(spec.segment) : {};
  const cut = spec.shape === 'segments' && !spec.bands && segment.thresholds?.length && segment.min != null
    ? { ...spec, bands: bandEdges(segment.thresholds, segment.min), bandLabels: segment.thresholds.map((t) => t.label) }
    : spec;
  const value = summarise(rows, cut, domain);
  const zones = spec.zones && spec.field ? bands(spec.field).thresholds : undefined;
  if (!zones?.length) return value;
  return { ...(typeof value === 'number' ? { value } : value), zones };
}

/** The same, and what the highlight's driver matches, as `matched`: each
 *  segment's part, each series point's, or a value's own. The rows summed
 *  twice. Will, TODO 441 */
export function summariseMarked(
  rows: readonly Row[],
  spec: SummarySpec,
  domain: (field: string) => readonly unknown[] = () => [],
  bands: BandFacts = () => ({}),
  matches: ((row: Row) => boolean) | null = null,
): Summary | Zoned {
  const all = summariseBanded(rows, spec, domain, bands);
  if (!matches || typeof all === 'number') return all;
  const part = summariseBanded(rows.filter(matches), spec, domain, bands);
  if (Array.isArray(all)) {
    const by = new Map((part as ChartDatum[]).map((d) => [d.label, d.value]));
    return all.map((d) => ({ ...d, matched: by.get(d.label) ?? 0 }));
  }
  if ('series' in all && Array.isArray(all.series)) {
    const { labels, series } = part as { labels: string[]; series: Series[] };
    return {
      ...all,
      series: (all.series as Series[]).map((s) => {
        const own = series.find((p) => p.name === s.name);
        const at = new Map(labels.map((label, i) => [label, own?.values[i] ?? 0]));
        return { ...s, matched: (all.labels as string[]).map((label) => at.get(label) ?? 0) };
      }),
    };
  }
  const value = typeof part === 'number' ? part : (part as { value?: unknown }).value;
  return typeof value === 'number' ? { ...all, matched: value } : all;
}

