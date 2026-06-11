/**
 * aggregate.ts — Local aggregation utilities for viz components.
 *
 * Pure functions extracted from DataService for client-side aggregation.
 * Components receive raw filtered records via the `datasetfiltered` event
 * and use these helpers to group, aggregate, sort, and filter locally.
 *
 * Exports:
 *   agg(values, fn)                         — single-measure aggregation
 *   truncateDate(val, grain)                — date truncation for time axes
 *   groupAndAggregate(records, fields, measures, dateGroupMap) — group-by + agg
 *   applyLocalFilters(records, filters)     — AND-chain filter
 *   applySort(rows, orderBy)               — multi-field sort
 *   computeMetricSummary(records, measures, dateField, filters) — sparkline + delta
 *   buildColumns(fieldsMeta, fieldNames)    — column objects with { field, name, type }
 */

import { formatFieldName } from './format-utils.js';
import { autoDetectDateField } from './timeframes.js';

/* ── Types ─────────────────────────────────────────────────────────── */

export type AggFn =
  | 'count'
  | 'count_distinct'
  | 'sum'
  | 'avg'
  | 'mean'
  | 'min'
  | 'max'
  | 'last';

export type DateGrain = 'year' | 'month' | 'day';

export type DataRecord = Record<string, unknown>;

export interface Measure {
  field: string;
  agg: AggFn;
}

export interface OrderBySpec {
  field: string;
  direction?: 'asc' | 'desc' | string;
}

export interface FilterSpec {
  field: string | null;
  operator?: string;
  value?: unknown;
  values?: unknown[];
  range?: { start: string; end: string };
  /** Optional filter classification used by filter-bar (sort/segment/value) */
  type?: string | null;
  /** Mode flag used by some filter producers */
  mode?: string | null;
  /** Cached lowercased values for `in` operator */
  _normalizedIn?: string[];
}

export interface FieldMeta {
  name: string;
  type?: string;
  label?: string;
}

export interface Column {
  field: string;
  name: string;
  type: string;
}

export interface MetricSummary {
  total: number;
  delta: number;
  deltaPercent: number;
  values: number[];
  count: number;
}

// ═══════════════════════════════════════════════════════════
//  Aggregation
// ═══════════════════════════════════════════════════════════

/**
 * Aggregate an array of values using the specified function.
 */
export function agg(values: unknown[], fn: AggFn | string): number {
  if (fn === 'count') return values.length;
  if (fn === 'count_distinct') return new Set(values).size;

  const nums = values
    .filter((v): v is number | string => v !== null && v !== undefined)
    .map(Number);
  if (!nums.length) return 0;
  switch (fn) {
    case 'sum':              return nums.reduce((a, b) => a + b, 0);
    case 'avg': case 'mean': return nums.reduce((a, b) => a + b, 0) / nums.length;
    case 'min':              return Math.min(...nums);
    case 'max':              return Math.max(...nums);
    case 'last':             return nums[nums.length - 1] ?? 0;
    default:                 throw new Error(`Unknown aggregation: ${fn}`);
  }
}

// ═══════════════════════════════════════════════════════════
//  Date Truncation
// ═══════════════════════════════════════════════════════════

const GRAIN_LEN: Record<DateGrain, number> = { year: 4, month: 7, day: 10 };

/**
 * Truncate a date-like string to a given granularity.
 */
export function truncateDate(val: unknown, grain: DateGrain | string): string {
  const s = String(val ?? '');
  const len = (GRAIN_LEN as Record<string, number>)[grain];
  return len ? (s.substring(0, len) || s) : s;
}

// ═══════════════════════════════════════════════════════════
//  Group & Aggregate
// ═══════════════════════════════════════════════════════════

/**
 * Group records by one or more fields and compute aggregate measures.
 */
export function groupAndAggregate(
  records: DataRecord[],
  groupByFields: string[],
  measures: Measure[],
  dateGroupMap?: Record<string, DateGrain | string>
): DataRecord[] {
  const groups = new Map<string, DataRecord[]>();
  for (const rec of records) {
    const key = groupByFields.map((f) => {
      const v = rec[f] ?? '';
      const grain = dateGroupMap?.[f];
      return grain ? truncateDate(v, grain) : v;
    }).join('\x00');
    if (!groups.has(key)) groups.set(key, []);
    const bucket = groups.get(key);
    if (bucket) bucket.push(rec);
  }

  const rows: DataRecord[] = [];
  for (const [, groupRecs] of groups) {
    const row: DataRecord = {};
    for (const f of groupByFields) {
      const firstRec = groupRecs[0];
      const raw = firstRec ? firstRec[f] : undefined;
      const grain = dateGroupMap?.[f];
      row[f] = grain ? truncateDate(raw, grain) : raw;
    }
    for (const m of measures) {
      row[m.field] = agg(groupRecs.map((r) => r[m.field]), m.agg);
    }
    rows.push(row);
  }
  return rows;
}

// ═══════════════════════════════════════════════════════════
//  Filtering
// ═══════════════════════════════════════════════════════════

/**
 * Apply an AND-chain of filters to records.
 */
export function applyLocalFilters(
  records: DataRecord[],
  filters: FilterSpec[]
): DataRecord[] {
  if (!Array.isArray(filters) || !filters.length) return records;
  return records.filter((rec) =>
    filters.every((f) => {
      if (f.field == null) return true;
      // Resolve _timerange sentinel against the record's date field.
      if (f.field === '_timerange') {
        if (!f.range) return true;
        const df = autoDetectDateField(rec);
        if (!df) return true;
        const d = String(rec[df] as string | number).substring(0, 10);
        return d >= f.range.start && d <= f.range.end;
      }
      const val = rec[f.field];
      const op = f.operator || '=';
      switch (op) {
        case '=': case 'eq': case 'equals':
          return String(val).toLowerCase() === String(f.value).toLowerCase();
        case '!=': case 'ne':
          return String(val).toLowerCase() !== String(f.value).toLowerCase();
        case '>': case 'gt':   return String(val) > String(f.value);
        case '<': case 'lt':   return String(val) < String(f.value);
        case '>=': case 'gte': return String(val) >= String(f.value);
        case '<=': case 'lte': return String(val) <= String(f.value);
        case 'in': {
          const list = f._normalizedIn || (f.values || String(f.value).split(','))
            .map((v) => String(v).toLowerCase());
          f._normalizedIn = list;
          return list.includes(String(val).toLowerCase());
        }
        case 'between': {
          if (f.range?.start && f.range?.end) {
            const d = String(val as string | number).substring(0, 10);
            return d >= f.range.start && d <= f.range.end;
          }
          return true;
        }
        default: return true;
      }
    })
  );
}

// ═══════════════════════════════════════════════════════════
//  Sorting
// ═══════════════════════════════════════════════════════════

/**
 * Sort rows by one or more order-by specs.
 */
export function applySort(rows: DataRecord[], orderBy: OrderBySpec[]): DataRecord[] {
  if (!Array.isArray(orderBy) || !orderBy.length) return rows;
  return [...rows].sort((a, b) => {
    for (const o of orderBy) {
      const field = o.field;
      const dir = (o.direction || 'asc').toLowerCase() === 'desc' ? -1 : 1;
      const av = a[field], bv = b[field];
      if (av === bv) continue;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    }
    return 0;
  });
}

// ═══════════════════════════════════════════════════════════
//  Metric Summary (sparkline, delta, total)
// ═══════════════════════════════════════════════════════════

/**
 * Compute metric summary: total, sparkline values, and delta.
 *
 * When `measures` contains a value-field entry (e.g. `{ field: 'amount', agg: 'sum' }`),
 * the total and sparkline values are computed by aggregating that field per time bucket.
 * When no value-field measure is provided, records are counted (legacy behaviour).
 */
export function computeMetricSummary(
  records: DataRecord[],
  measures: Measure[] | null | undefined,
  dateField: string | null | undefined,
  filters: FilterSpec[] | null | undefined
): MetricSummary {
  if (!records.length) return { total: 0, delta: 0, deltaPercent: 0, values: [], count: 0 };

  // Resolve value-field measure (skip synthetic '_count' entries)
  const measure = Array.isArray(measures)
    ? measures.find((m) => m.field && m.field !== '_count')
    : null;
  const aggFn = measure?.agg || 'count';
  const valField = measure?.field;

  // Preliminary total (used when no date field prevents bucketing)
  let total = valField
    ? agg(records.map((r) => r[valField]), aggFn)
    : records.length;

  const field = dateField;
  if (!field) {
    return { total, delta: 0, deltaPercent: 0, values: [total], count: 1 };
  }

  // Determine time range from filters (preferred) or data
  let rangeStart: string | number | null = null;
  let rangeEnd: string | number | null = null;
  if (Array.isArray(filters)) {
    for (const f of filters) {
      if (f.field === field && (f.operator === '>=' || f.operator === 'gte')) rangeStart = f.value as string | number;
      if (f.field === field && (f.operator === '<=' || f.operator === 'lte')) rangeEnd = f.value as string | number;
    }
  }
  if (!rangeStart || !rangeEnd) {
    let dMin: string | null = null;
    let dMax: string | null = null;
    for (const r of records) {
      const v = r[field];
      if (v == null) continue;
      const s = String(v);
      if (!dMin || s < dMin) dMin = s;
      if (!dMax || s > dMax) dMax = s;
    }
    if (!rangeStart) rangeStart = dMin;
    if (!rangeEnd) rangeEnd = dMax;
  }
  if (!rangeStart || !rangeEnd) {
    return { total, delta: 0, deltaPercent: 0, values: [total], count: 1 };
  }

  // Choose segment count based on time range
  const startDate = Temporal.PlainDate.from(String(rangeStart).substring(0, 10));
  const endDate   = Temporal.PlainDate.from(String(rangeEnd).substring(0, 10));
  const diffDays  = startDate.until(endDate).total('days');

  let segmentCount: number;
  if (diffDays <= 1)        segmentCount = 12;
  else if (diffDays <= 7)   segmentCount = 7;
  else if (diffDays <= 30)  segmentCount = 4;
  else if (diffDays <= 90)  segmentCount = 3;
  else                      segmentCount = 12;

  if (diffDays <= 0) {
    return { total, delta: 0, deltaPercent: 0, values: [total], count: 1 };
  }

  const bucketDays = diffDays / segmentCount;

  const bucketIndex = (v: unknown): number => {
    const dayOffset = startDate.until(
      Temporal.PlainDate.from(String(v as string | number).substring(0, 10)),
    ).total('days');
    const idx = Math.floor(dayOffset / bucketDays);
    return Math.min(Math.max(idx, 0), segmentCount - 1);
  };

  // Collect per-bucket values (array of arrays) when using a value field,
  // otherwise simple counts.
  let bucketValues: number[];
  if (valField) {
    const bucketArrays: unknown[][] = Array.from({ length: segmentCount }, () => []);
    for (const r of records) {
      const v = r[field];
      if (v == null) continue;
      const idx = bucketIndex(v);
      const arr = bucketArrays[idx];
      if (arr) arr.push(r[valField]);
    }
    bucketValues = bucketArrays.map((vals) => agg(vals, aggFn));
  } else {
    bucketValues = new Array<number>(segmentCount).fill(0);
    for (const r of records) {
      const v = r[field];
      if (v == null) continue;
      const idx = bucketIndex(v);
      if (idx < bucketValues.length) bucketValues[idx] = (bucketValues[idx] ?? 0) + 1;
    }
  }

  const oldest = bucketValues[0] || 0;
  const newest = bucketValues[bucketValues.length - 1] || 0;
  const delta = newest - oldest;
  const deltaPercent = oldest !== 0 ? (delta / Math.abs(oldest)) * 100 : 0;

  // Metric value = most recent bucket (matches sparkline's last point)
  total = newest;

  return { total, delta, deltaPercent, values: bucketValues, count: segmentCount };
}

// ═══════════════════════════════════════════════════════════
//  Column Builder
// ═══════════════════════════════════════════════════════════

/**
 * Build column descriptor objects from field metadata.
 */
export function buildColumns(
  fieldsMeta: FieldMeta[] | null | undefined,
  fieldNames: string[]
): Column[] {
  const metaMap = new Map<string, FieldMeta>();
  if (Array.isArray(fieldsMeta)) {
    for (const f of fieldsMeta) metaMap.set(f.name, f);
  }
  return fieldNames.map((name) => {
    const fm = metaMap.get(name) || { name, type: 'string' };
    return {
      field: name,
      name: fm.label || formatFieldName(name),
      type: fm.type || 'string',
    };
  });
}
