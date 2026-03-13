/**
 * Timeframe Definitions
 *
 * Shared time-unit constants and helpers used throughout the UI for
 * time-range filtering, metric titles, and date formatting.
 *
 * Every query result carries a `timeRange` in its metadata so that
 * components can display the period the data represents and later
 * support interactive time-range filtering.
 */

// ═══════════════════════════════════════════════════════════
//  Time-unit enum
// ═══════════════════════════════════════════════════════════

/** Canonical time-unit identifiers (lowercase). */
export const TimeUnit = Object.freeze({
  HOUR:    'hour',
  DAY:     'day',
  WEEK:    'week',
  MONTH:   'month',
  QUARTER: 'quarter',
  YEAR:    'year',
});

/** Human-readable labels (singular / plural). */
export const TIME_UNIT_LABELS = Object.freeze({
  [TimeUnit.HOUR]:    { singular: 'Hour',    plural: 'Hours' },
  [TimeUnit.DAY]:     { singular: 'Day',     plural: 'Days' },
  [TimeUnit.WEEK]:    { singular: 'Week',    plural: 'Weeks' },
  [TimeUnit.MONTH]:   { singular: 'Month',   plural: 'Months' },
  [TimeUnit.QUARTER]: { singular: 'Quarter', plural: 'Quarters' },
  [TimeUnit.YEAR]:    { singular: 'Year',    plural: 'Years' },
});

/** Ordered list for iteration (finest → coarsest). */
export const TIME_UNITS_ORDERED = Object.freeze([
  TimeUnit.HOUR,
  TimeUnit.DAY,
  TimeUnit.WEEK,
  TimeUnit.MONTH,
  TimeUnit.QUARTER,
  TimeUnit.YEAR,
]);

// ═══════════════════════════════════════════════════════════
//  Preset time-range definitions
// ═══════════════════════════════════════════════════════════

/**
 * Predefined time ranges for use in filter UIs.
 * Each entry describes how many units to subtract from a reference date.
 *
 * Components can iterate over these to build a picker. The `key` is a
 * stable identifier suitable for URL params / saved configs.
 */
export const TIME_RANGE_PRESETS = Object.freeze([
  { key: 'last-24h',     label: 'Last 24 Hours',  unit: TimeUnit.HOUR,    count: 24  },
  { key: 'last-7d',      label: 'Last 7 Days',    unit: TimeUnit.DAY,     count: 7   },
  { key: 'last-30d',     label: 'Last 30 Days',   unit: TimeUnit.DAY,     count: 30  },
  { key: 'last-90d',     label: 'Last 90 Days',   unit: TimeUnit.DAY,     count: 90  },
  { key: 'last-6m',      label: 'Last 6 Months',  unit: TimeUnit.MONTH,   count: 6   },
  { key: 'last-12m',     label: 'Last 12 Months', unit: TimeUnit.MONTH,   count: 12  },
  { key: 'last-1q',      label: 'Last Quarter',   unit: TimeUnit.QUARTER, count: 1   },
  { key: 'last-4q',      label: 'Last 4 Quarters',unit: TimeUnit.QUARTER, count: 4   },
  { key: 'last-1y',      label: 'Last Year',      unit: TimeUnit.YEAR,    count: 1   },
  { key: 'last-3y',      label: 'Last 3 Years',   unit: TimeUnit.YEAR,    count: 3   },
  { key: 'ytd',          label: 'Year to Date',   unit: TimeUnit.YEAR,    count: 0   },
  { key: 'all',          label: 'All Time',        unit: null,            count: null },
]);

// ═══════════════════════════════════════════════════════════
//  Date helpers  (ISO YYYY-MM-DD strings)
// ═══════════════════════════════════════════════════════════

const MONTH_ABBR = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/**
 * Parse an ISO date string (YYYY-MM-DD) into { year, month (1-12), day }.
 * Also accepts YYYYMMDD integers for backward compatibility.
 * @param {string|number} dateStr
 * @returns {{ year: number, month: number, day: number }}
 */
export function parseDateId(dateStr) {
  const s = String(dateStr);
  if (s.includes('-')) {
    const [y, m, d] = s.split('-').map(Number);
    return { year: y, month: m, day: d };
  }
  // Legacy YYYYMMDD integer
  const n = Number(dateStr);
  const year  = Math.floor(n / 10000);
  const month = Math.floor((n % 10000) / 100);
  const day   = n % 100;
  return { year, month, day };
}

/**
 * Build an ISO YYYY-MM-DD date string from components.
 * @param {number} year
 * @param {number} month  1-12
 * @param {number} day    1-31
 * @returns {string}
 */
export function buildDateId(year, month, day) {
  return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}

/**
 * Convert a date string or YYYYMMDD integer into a JS Date.
 * @param {string|number} dateStr
 * @returns {Date}
 */
export function dateIdToDate(dateStr) {
  const { year, month, day } = parseDateId(dateStr);
  return new Date(year, month - 1, day);
}

/**
 * Format a date value as a short, human-readable string.
 *   "2023-02-06" → "Feb 2023"
 * @param {string|number} dateStr
 * @returns {string}
 */
export function formatDateId(dateStr) {
  const { year, month } = parseDateId(dateStr);
  return `${MONTH_ABBR[month - 1]} ${year}`;
}

// ═══════════════════════════════════════════════════════════
//  Time-range computation
// ═══════════════════════════════════════════════════════════

/**
 * Derive a TimeRange from an array of records using the dataset's declared
 * date field.
 *
 * Returns `{ min, max, minDate, maxDate, span, granularity, label }` where
 * min/max are ISO date strings, minDate/maxDate are JS Date objects,
 * span is the total milliseconds, granularity is an inferred TimeUnit,
 * and label is a concise human-readable description of the period.
 *
 * @param {Array<Object>} records
 * @param {string} [dateField] — field name to read dates from (defaults to auto-detect)
 * @returns {Object|null}  null when no valid date values exist
 */
export function computeTimeRange(records, dateField) {
  if (!records?.length) return null;

  // Auto-detect date field if not provided
  const field = dateField || autoDetectDateField(records[0]);
  if (!field) return null;

  let min = null;
  let max = null;
  for (const r of records) {
    const v = r[field];
    if (v == null) continue;
    const s = String(v);
    if (!min || s < min) min = s;
    if (!max || s > max) max = s;
  }
  if (!min) return null;

  const minDate = dateIdToDate(min);
  const maxDate = dateIdToDate(max);
  const span = maxDate - minDate;
  const granularity = inferGranularity(minDate, maxDate);
  const label = formatTimeRangeLabel(min, max, granularity);

  return { min, max, minDate, maxDate, span, granularity, label };
}

/**
 * Auto-detect the date field from a record's keys.
 * Looks for common date field names.
 * @param {Object} record
 * @returns {string|null}
 */
function autoDetectDateField(record) {
  if (!record) return null;
  // 'created' is the canonical record timestamp for all time-based viz;
  // other datetime fields are secondary (available for user filtering).
  if ('created' in record) return 'created';
  const DATE_FIELD_NAMES = ['created_date', 'order_date', 'ticket_date', 'task_date', 'first_detected', 'last_updated', 'date_published', 'date'];
  for (const name of DATE_FIELD_NAMES) {
    if (name in record) return name;
  }
  // Fallback: find any key ending in _date or _at
  for (const key of Object.keys(record)) {
    if (key.endsWith('_date') || key.endsWith('_at')) return key;
  }
  return null;
}

/**
 * Infer the most appropriate display granularity from the range span.
 * @param {Date} minDate
 * @param {Date} maxDate
 * @returns {string} A TimeUnit value
 */
function inferGranularity(minDate, maxDate) {
  const diffMs = maxDate - minDate;
  const days = diffMs / (1000 * 60 * 60 * 24);

  if (days <= 1)   return TimeUnit.HOUR;
  if (days <= 14)  return TimeUnit.DAY;
  if (days <= 90)  return TimeUnit.WEEK;
  if (days <= 730) return TimeUnit.MONTH;
  if (days <= 1460) return TimeUnit.QUARTER;
  return TimeUnit.YEAR;
}

/**
 * Produce a concise human label for a date range.
 *
 * Examples:
 *   Same month  → "Feb 2026"
 *   Same year   → "Feb – May 2023"
 *   Multi-year  → "Feb 2023 – Feb 2026"
 *
 * @param {number} minId  YYYYMMDD
 * @param {number} maxId  YYYYMMDD
 * @param {string} [_granularity]  unused currently; reserved for future granularity-aware formatting
 * @returns {string}
 */
export function formatTimeRangeLabel(minVal, maxVal, _granularity) {
  const a = parseDateId(minVal);
  const b = parseDateId(maxVal);

  const aMonth = MONTH_ABBR[a.month - 1];
  const bMonth = MONTH_ABBR[b.month - 1];

  if (a.year === b.year && a.month === b.month) {
    return `${aMonth} ${a.year}`;
  }
  if (a.year === b.year) {
    return `${aMonth} – ${bMonth} ${a.year}`;
  }
  return `${aMonth} ${a.year} – ${bMonth} ${b.year}`;
}

/**
 * Return a label suitable for a time-unit count.
 *   formatTimeUnitLabel('month', 1)  → "Month"
 *   formatTimeUnitLabel('month', 6)  → "Months"
 *   formatTimeUnitLabel('quarter', 4) → "Quarters"
 *
 * @param {string} unit   A TimeUnit value
 * @param {number} count
 * @returns {string}
 */
export function formatTimeUnitLabel(unit, count = 1) {
  const entry = TIME_UNIT_LABELS[unit];
  if (!entry) return unit;
  return count === 1 ? entry.singular : entry.plural;
}
