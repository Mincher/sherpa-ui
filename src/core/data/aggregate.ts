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
 * - chartAxes — A chart's two axes as a summary reads them: one shown as counts splits nothing.
 * - summarise — Rows into the shape a component declared — one door for every chart and tile.
 * - ZoneFacts — A field's zones, as a summary reads them: a status field's ranges of it.
 * - Zoned — A summary with its value field's zones beside it: a gauge.
 * - summariseZoned — Rows into the declared shape, with its value field's zones beside it: a gauge.
 * - summariseMarked — The same, and each segment's part the highlight's driver matches.
 * - TableColumn — A grid's column, as a cross table names it and hands it on to a row's sub-grid.
 * - CrossTable — A cross table, as a grid draws it: its columns, rows and filters, and each row's own rows.
 * - TableFacts — What a cross table reads beside its rows: each field's declared values and name, its filters, its Total.
 * - crossSpec — A summary as a cross table reads it: a series is segments by what it runs over, split by its lines.
 * - crossTable — A cross table from the very answer a chart draws: a grid's pivot, and a grid made from a chart.
 */
import { compareValues, readField, groupRows, groupSummaries, valueKey, type GroupSummary, type Row, type SortDirection } from './store.js';
import type { ChartDatum } from './chart-datum.js';
import type { Threshold } from './threshold.js';
import { segmentLabel, segmentStarts, spanLabel, type SegmentUnit } from './segments.js';

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
export type Bucket = SegmentUnit;

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
  bucket?: Bucket | 'auto';
  /** The days a series covers, ISO, ends inclusive: a quiet segment at either end is zero, not missing. TODO 540 */
  range?: readonly [from: string, to: string];
  /** Keep every declared category, at zero — a legend.
   *  TRAP T-a-legend-row-goes-inactive-it-never-vanishes */
  keepEmpty?: boolean;
  /** Hand its value field's zones beside it: a gauge. */
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
  | { value: number; values: number[]; labels?: string[]; deltaPercent?: number }
  | { labels: string[]; series: Series[] };

/** A chart's two axes as a summary reads them. The axis shown as COUNTS splits
 *  nothing: each value of the other is the number of its distinct values there. With
 *  no other axis, or a chart that sums or averages, both show as names. Will, TODO 653 */
export function chartAxes(
  primary: string | undefined,
  secondary: string | undefined,
  counts?: string | null,
  aggregate?: string | null,
): Pick<SummarySpec, 'segment' | 'stack' | 'aggregate' | 'field'> {
  const counted = counts === 'primary' ? primary : counts === 'secondary' ? secondary : undefined;
  const other = counts === 'primary' ? secondary : primary;
  if (counted && other && (!aggregate || aggregate === 'count')) return { segment: other, aggregate: 'distinct', field: counted };
  return { ...(primary ? { segment: primary } : {}), ...(secondary ? { stack: secondary } : {}) };
}

/** The ISO day before `day`. */
const dayBefore = (day: string): string => new Date(Date.parse(`${day}T00:00:00Z`) - DAY).toISOString().slice(0, 10);

const CUT: Record<Bucket, number> = { year: 4, quarter: 7, month: 7, week: 10, day: 10, hour2: 13 };
const HOUR = 3_600_000;
const DAY = 86_400_000;

/** A date cut to its bucket's key: the ISO prefix; a week by its Monday, a quarter as `2026-Q1`, two hours by the even hour. */
function cut(value: unknown, bucket: Bucket): string {
  const text = value instanceof Date ? value.toISOString() : String(value ?? '');
  if (bucket === 'week') {
    const at = Date.parse(`${text.slice(0, 10)}T00:00:00Z`);
    return Number.isNaN(at) ? text.slice(0, 10) : new Date(at - ((new Date(at).getUTCDay() + 6) % 7) * DAY).toISOString().slice(0, 10);
  }
  if (bucket === 'quarter') return `${text.slice(0, 4)}-Q${Math.floor((Number(text.slice(5, 7)) - 1) / 3) + 1}`;
  // A date with no time is at its midnight.
  if (bucket === 'hour2') return `${text.slice(0, 10)}T${String(Math.floor((Number(text.slice(11, 13)) || 0) / 2) * 2).padStart(2, '0')}`;
  return text.slice(0, CUT[bucket]);
}

/** The bucket after `key`. UTC, so no clock change moves a day. */
function step(key: string, bucket: Bucket): string {
  if (bucket === 'year') return String(Number(key) + 1);
  if (bucket === 'quarter') {
    const [y = NaN, q = NaN] = key.split('-Q').map(Number);
    return q === 4 ? `${y + 1}-Q1` : `${y}-Q${q + 1}`;
  }
  if (bucket === 'month') {
    const [y = NaN, m = NaN] = key.split('-').map(Number);
    const next = y * 12 + m;
    return `${Math.floor(next / 12)}-${String((next % 12) + 1).padStart(2, '0')}`;
  }
  if (bucket === 'hour2') return new Date(Date.parse(`${key}:00:00Z`) + 2 * HOUR).toISOString().slice(0, 13);
  return new Date(Date.parse(`${key}T00:00:00Z`) + (bucket === 'week' ? 7 : 1) * DAY).toISOString().slice(0, 10);
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
  const [first, last] = [seen[0], seen[seen.length - 1]] as (string | undefined)[];
  if (!bucket || first === undefined || last === undefined || seen.length < 2) return seen;
  const out: string[] = [];
  // Capped: a key the step cannot parse would otherwise never reach `last`.
  for (let k = first; k <= last && out.length < 10_000; k = step(k, bucket)) out.push(k);
  return out;
}

/** The start of each segment of a range: from its first day, or a day's every two hours. TODOs 540, 705 */
function startsOf([from, to]: readonly [string, string], bucket: Bucket): string[] {
  if (bucket !== 'hour2') return segmentStarts(from, to, bucket);
  return segmentStarts(from, to, 'day').flatMap((day) => Array.from({ length: 12 }, (_, i) => `${day}T${String(i * 2).padStart(2, '0')}`));
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
    if (spec.bands?.length) return sortSegments(bandBy(rows, spec.segment, spec.bands), spec.sort);
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
  // `auto` reaches here only unresolved — no range to fit — and cuts by the day.
  const bucket = spec.bucket === 'auto' ? 'day' : spec.bucket;
  /* A range is counted from ITS start: 6 months is 6 segments, 14 days 14, and a day 12 of two hours.
     TRAP T-a-range-is-counted-from-its-own-start
     A row is in the last segment that starts on or before it. TODOs 540, 705 */
  const starts = bucket && spec.range ? startsOf(spec.range, bucket) : undefined;
  const own = bucket === 'day' || bucket === 'hour2';
  const startOf = (value: unknown): string => {
    const key = cut(value, bucket === 'hour2' ? 'hour2' : 'day');
    return starts!.findLast((s) => s <= key) ?? starts![0]!;
  };
  const keyed = starts ? rows.map((r) => ({ ...r, [at]: startOf(readField(r, spec.over!)) }))
    : bucket ? rows.map((r) => ({ ...r, [at]: cut(readField(r, spec.over!), bucket) })) : rows;
  const points = (starts ?? pointsOf(rows, spec.over, bucket, domain(spec.over))) as (string | number)[];
  if (spec.shape === 'aggregate') {
    const values = seriesBy(keyed, at, points, '', opts).values;
    const delta = deltaPercent(values);
    // Each point's time span, for its tooltip: a day, or two hours, its own. TODO 540
    const spans = starts
      ? { labels: starts.map((from, i) => own ? segmentLabel(from, bucket)
        : spanLabel(from, i + 1 < starts.length ? dayBefore(starts[i + 1]!) : spec.range![1])) }
      : bucket ? { labels: points.map((p) => segmentLabel(String(p), bucket)) } : {};
    return delta == null ? { value, values, ...spans } : { value, values, ...spans, deltaPercent: delta };
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

/** A field's zones, as a summary reads them: a status field's ranges of it (`zonesOf`). */
export type ZoneFacts = (field: string) => readonly Threshold[] | undefined;

/** A summary with its value field's zones beside it: a gauge. */
export type Zoned = Record<string, unknown> & { zones: readonly Threshold[] };

/** Rows into the declared shape, with its value field's ZONES beside it: a gauge.
 *  Plan 683 · TRAP T-a-status-is-worked-out-by-the-data */
export function summariseZoned(
  rows: readonly Row[],
  spec: SummarySpec,
  domain: (field: string) => readonly unknown[] = () => [],
  zonesOf: ZoneFacts = () => undefined,
): Summary | Zoned {
  const value = summarise(rows, spec, domain);
  const zones = spec.zones && spec.field ? zonesOf(spec.field) : undefined;
  if (!zones?.length) return value;
  return { ...(typeof value === 'number' ? { value } : value), zones };
}

/** Each datum, and what is inside it, with its share of the driver's matches: a
 *  piece or a section draws its own. Will, TODO 638 */
function markedAll(all: readonly ChartDatum[], part: readonly ChartDatum[] = []): ChartDatum[] {
  const by = new Map(part.map((d) => [d.label, d]));
  return all.map((d) => {
    const own = by.get(d.label);
    return {
      ...d,
      matched: own?.value ?? 0,
      ...(d.stack ? { stack: markedAll(d.stack, own?.stack) } : {}),
      ...(d.parts ? { parts: markedAll(d.parts, own?.parts) } : {}),
    };
  });
}

/** The same, and what the highlight's driver matches, as `matched`: each
 *  segment's part, each series point's, or a value's own. The rows summed
 *  twice. Will, TODO 441 */
export function summariseMarked(
  rows: readonly Row[],
  spec: SummarySpec,
  domain: (field: string) => readonly unknown[] = () => [],
  zonesOf: ZoneFacts = () => undefined,
  matches: ((row: Row) => boolean) | null = null,
): Summary | Zoned {
  const all = summariseZoned(rows, spec, domain, zonesOf);
  if (!matches || typeof all === 'number') return all;
  const part = summariseZoned(rows.filter(matches), spec, domain, zonesOf);
  if (Array.isArray(all)) return markedAll(all, part as ChartDatum[]);
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


/* ── Cross tables ─────────────────────────────────────────────────────── */

/** A grid's column, as a cross table names it and hands it on to a row's sub-grid. */
export interface TableColumn {
  field: string;
  header?: string;
  type?: string;
  tags?: string[];
  sortable?: boolean;
  filterable?: boolean;
}

/** A cross table, as a grid draws it: its columns, rows and filters, and each row's own rows. */
export interface CrossTable {
  key: string;
  columns: TableColumn[];
  filters: Record<string, unknown>;
  rows: Row[];
  detail: { columns: TableColumn[]; key?: string; rows: Record<string, Row[]>; groups?: Record<string, GroupSummary[]> };
}

/** What a cross table reads beside its rows: each field's declared values and
 *  name, each filter as the grid's headings draw it, and the word for its Total. */
export interface TableFacts {
  domain: (field: string) => readonly unknown[];
  label: (field: string) => string;
  filters: Record<string, unknown>;
  total: string;
}

/** A row's own rows, by its first column's value, a group's together where it
 *  groups, and their groups: what each row's sub-grid draws. TODOs 574, 661 */
function opened(rows: readonly Row[], lead: string, group: string | null | undefined): Pick<CrossTable['detail'], 'rows' | 'groups'> {
  const opens = groupRows(rows, lead).map((g) => ({
    key: g.key, rows: group ? groupRows(g.rows, group).flatMap((part) => part.rows) : g.rows,
  }));
  return {
    rows: Object.fromEntries(opens.map((o) => [o.key, o.rows])),
    ...(group ? { groups: Object.fromEntries(opens.map((o) => [o.key, groupSummaries(o.rows, group)])) } : {}),
  };
}

/** The Secondary's values a table shows: the declared ones its rows hold, in order; none declared, those seen. */
function crossValues(segments: readonly ChartDatum[], declared: readonly string[]): string[] {
  const seen = segments.flatMap((s) => (s.stack ?? []).map((p) => p.label));
  return declared.length ? declared.filter((v) => seen.includes(v)) : [...new Set(seen)];
}

/** A column per value, and the Total; a count sorts and filters nothing. */
function crossColumns(values: readonly string[], prefix: string, total: string): TableColumn[] {
  const count = (field: string, header: string): TableColumn => ({ field, header, type: 'number', sortable: false, filterable: false });
  return [...values.map((v) => count(`${prefix}${v}`, v)), count(`${prefix}total`, total)];
}

/** One segment's cells: its count of each value, and its Total. */
function crossCells(datum: ChartDatum, values: readonly string[], prefix: string): Row {
  return {
    ...Object.fromEntries(values.map((v) => [`${prefix}${v}`, datum.stack?.find((p) => p.label === v)?.value ?? 0])),
    [`${prefix}total`]: datum.value,
  };
}

/** A summary as a cross table reads it: a series is segments by what it runs over,
 *  split by its lines; a split chart's is its own. Its parts are not a column. TODOs 622, 653 */
export function crossSpec(spec: SummarySpec): SummarySpec & { shape: 'segments' } {
  const { group: _parts, ...split } = spec;
  if (spec.shape !== 'series') return { ...split, shape: 'segments' };
  const { over, segment, bucket: _bucket, ...rest } = split;
  return { ...rest, shape: 'segments', ...(over ? { segment: over } : {}), ...(segment ? { stack: segment } : {}) };
}

/**
 * A CROSS TABLE, as a grid draws it, from the very answer a chart draws: a row a
 * value of its first axis, a column each value of its second it holds, and a
 * Total. Each row OPENS on its own rows, under the grid's other columns, `group`
 * grouping them: a grid's pivot — Primary, Secondary, Group a chain — and a grid
 * made from a chart alike. Will, TODOs 548, 570, 574, 622, 625, 661
 */
export function crossTable(
  rows: readonly Row[],
  spec: SummarySpec,
  grid: { columns: readonly TableColumn[]; key?: string | null | undefined; group?: string | null | undefined },
  facts: TableFacts,
): CrossTable {
  const split = crossSpec(spec);
  const lead = split.segment ?? '';
  const segments = summarise(rows, { ...split, segment: lead }, facts.domain) as ChartDatum[];
  const values = crossValues(segments, split.stack ? facts.domain(split.stack).map(valueKey) : []);
  // Its Primary filters as the grid's own column does; a count filters nothing. TODO 571
  const { tags: moved, ...primary } = grid.columns.find((c) => c.field === lead) ?? { field: lead };
  /* Its rows' TAGS go where their columns are: down to the sub-grid, the
     Primary's on its first column — and never the Primary's own, which every
     row there holds. Will, TODO 580 */
  const details = grid.columns.filter((c) => c.field !== lead).map((c, i) => {
    const tags = [...new Set([...c.tags ?? [], ...(i === 0 ? moved ?? [] : [])])].filter((f) => f !== lead);
    const { tags: _tags, ...rest } = c;
    return tags.length ? { ...rest, tags } : rest;
  });
  return {
    key: lead,
    columns: [
      { ...primary, field: lead, header: primary.header ?? facts.label(lead), sortable: false },
      ...crossColumns(values, 'pivot:', facts.total),
    ],
    filters: facts.filters,
    rows: segments.map((s) => ({ [lead]: s.label, ...crossCells(s, values, 'pivot:') })),
    detail: {
      // Not its Primary: every row under a row holds that row's. Will, TODO 578
      columns: details,
      ...(grid.key ? { key: grid.key } : {}),
      ...opened(rows, lead, grid.group),
    },
  };
}
