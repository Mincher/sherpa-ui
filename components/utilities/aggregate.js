/**
 * aggregate.js — Local aggregation utilities for viz components.
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

// ═══════════════════════════════════════════════════════════
//  Aggregation
// ═══════════════════════════════════════════════════════════

/**
 * Aggregate an array of values using the specified function.
 * @param {Array} values
 * @param {'count'|'count_distinct'|'sum'|'avg'|'mean'|'min'|'max'} fn
 * @returns {number}
 */
export function agg(values, fn) {
  if (fn === 'count') return values.length;
  if (fn === 'count_distinct') return new Set(values).size;

  const nums = values.filter((v) => v !== null && v !== undefined).map(Number);
  if (!nums.length) return 0;
  switch (fn) {
    case 'sum':              return nums.reduce((a, b) => a + b, 0);
    case 'avg': case 'mean': return nums.reduce((a, b) => a + b, 0) / nums.length;
    case 'min':              return Math.min(...nums);
    case 'max':              return Math.max(...nums);
    default:                 throw new Error(`Unknown aggregation: ${fn}`);
  }
}

// ═══════════════════════════════════════════════════════════
//  Date Truncation
// ═══════════════════════════════════════════════════════════

/**
 * Truncate a date-like string to a given granularity.
 * @param {string} val
 * @param {'month'|'year'|'day'} grain
 * @returns {string}
 */
const GRAIN_LEN = { year: 4, month: 7, day: 10 };

export function truncateDate(val, grain) {
  const s = String(val ?? '');
  const len = GRAIN_LEN[grain];
  return len ? (s.substring(0, len) || s) : s;
}

// ═══════════════════════════════════════════════════════════
//  Group & Aggregate
// ═══════════════════════════════════════════════════════════

/**
 * Group records by one or more fields and compute aggregate measures.
 * @param {Array<Object>} records     — flat records
 * @param {string[]}      groupByFields — fields to group by
 * @param {Array<{field:string, agg:string}>} measures — measures to compute
 * @param {Object}        [dateGroupMap] — field → grain for date truncation
 * @returns {Array<Object>} aggregated rows
 */
export function groupAndAggregate(records, groupByFields, measures, dateGroupMap) {
  const groups = new Map();
  for (const rec of records) {
    const key = groupByFields.map((f) => {
      const v = rec[f] ?? '';
      return dateGroupMap?.[f] ? truncateDate(v, dateGroupMap[f]) : v;
    }).join('\x00');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(rec);
  }

  const rows = [];
  for (const [, groupRecs] of groups) {
    const row = {};
    for (const f of groupByFields) {
      const raw = groupRecs[0][f];
      row[f] = dateGroupMap?.[f] ? truncateDate(raw, dateGroupMap[f]) : raw;
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
 * @param {Array<Object>} records
 * @param {Array<{field:string, operator:string, value:*, values?:Array}>} filters
 * @returns {Array<Object>}
 */
export function applyLocalFilters(records, filters) {
  if (!Array.isArray(filters) || !filters.length) return records;
  return records.filter((rec) =>
    filters.every((f) => {
      // Resolve _timerange sentinel against the record's date field.
      if (f.field === '_timerange') {
        if (!f.range) return true;
        const df = autoDetectDateField(rec);
        if (!df) return true;
        const d = new Date(rec[df]);
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
          const list = f._normalizedIn || (f.values || String(f.value).split(',')).map((v) => String(v).toLowerCase());
          f._normalizedIn = list;
          return list.includes(String(val).toLowerCase());
        }
        case 'between': {
          if (f.range?.start && f.range?.end) {
            const d = new Date(val);
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
 * @param {Array<Object>} rows
 * @param {Array<{field:string, direction?:string}>} orderBy
 * @returns {Array<Object>} sorted copy
 */
export function applySort(rows, orderBy) {
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
 *
 * @param {Array<Object>} records
 * @param {Array<{field:string, agg:string}>} measures — value-field + aggregation
 * @param {string}        dateField — date column for time bucketing
 * @param {Array}         filters   — used to derive time range bounds
 * @returns {{ total, delta, deltaPercent, values, count }}
 */
export function computeMetricSummary(records, measures, dateField, filters) {
  if (!records.length) return { total: 0, delta: 0, deltaPercent: 0, values: [], count: 0 };

  // Resolve value-field measure (skip synthetic '_count' entries)
  const measure = Array.isArray(measures)
    ? measures.find(m => m.field && m.field !== '_count')
    : null;
  const aggFn   = measure?.agg || 'count';
  const valField = measure?.field;

  // Preliminary total (used when no date field prevents bucketing)
  let total = valField
    ? agg(records.map(r => r[valField]), aggFn)
    : records.length;

  const field = dateField;
  if (!field) {
    // No date field available — cannot produce time-series bucketing
    return { total, delta: 0, deltaPercent: 0, values: [total], count: 1 };
  }

  // Determine time range from filters (preferred) or data
  let rangeStart = null;
  let rangeEnd = null;
  if (Array.isArray(filters)) {
    for (const f of filters) {
      if (f.field === field && (f.operator === '>=' || f.operator === 'gte')) rangeStart = f.value;
      if (f.field === field && (f.operator === '<=' || f.operator === 'lte')) rangeEnd = f.value;
    }
  }
  if (!rangeStart || !rangeEnd) {
    let dMin = null, dMax = null;
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
  const startMs = new Date(rangeStart).getTime();
  const endMs   = new Date(rangeEnd).getTime();
  const diffDays = (endMs - startMs) / (1000 * 60 * 60 * 24);

  let segmentCount;
  if (diffDays <= 1)        segmentCount = 12;
  else if (diffDays <= 7)   segmentCount = 7;
  else if (diffDays <= 30)  segmentCount = 4;
  else if (diffDays <= 90)  segmentCount = 3;
  else                      segmentCount = 12;

  // Divide range into equal-width buckets
  const rangeMs = endMs - startMs;
  if (rangeMs <= 0) {
    return { total, delta: 0, deltaPercent: 0, values: [total], count: 1 };
  }

  const bucketWidth = rangeMs / segmentCount;

  // Collect per-bucket values (array of arrays) when using a value field,
  // otherwise simple counts.
  let bucketValues;
  if (valField) {
    bucketValues = Array.from({ length: segmentCount }, () => []);
    for (const r of records) {
      const v = r[field];
      if (v == null) continue;
      const t = new Date(v).getTime();
      let idx = Math.floor((t - startMs) / bucketWidth);
      if (idx >= segmentCount) idx = segmentCount - 1;
      if (idx < 0) idx = 0;
      bucketValues[idx].push(r[valField]);
    }
    bucketValues = bucketValues.map(vals => agg(vals, aggFn));
  } else {
    bucketValues = new Array(segmentCount).fill(0);
    for (const r of records) {
      const v = r[field];
      if (v == null) continue;
      const t = new Date(v).getTime();
      let idx = Math.floor((t - startMs) / bucketWidth);
      if (idx >= segmentCount) idx = segmentCount - 1;
      if (idx < 0) idx = 0;
      bucketValues[idx]++;
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
 * @param {Array<{name:string, type?:string, label?:string}>} fieldsMeta — dataset field definitions
 * @param {string[]} fieldNames — which fields to include (in order)
 * @returns {Array<{field:string, name:string, type:string}>}
 */
export function buildColumns(fieldsMeta, fieldNames) {
  const metaMap = new Map();
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
