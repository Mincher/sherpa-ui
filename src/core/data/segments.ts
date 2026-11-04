/**
 * segments.ts — cut a date range into the segments a sparkline draws.
 *
 * DOM-free. A range is drawn once per unit in it, until that passes one of the
 * next unit up (12 months is 12 segments, 13 is 5 quarters). A day alone is
 * cut in two-hour steps.
 * Will, TODO 540. TRAP T-a-range-is-counted-from-its-own-start
 *
 * Map:
 * - SegmentUnit — The step a range is cut into.
 * - segmentUnit — The unit for a range of ISO days, both ends inclusive.
 * - segmentLabel — A segment's time span in words, for its tooltip.
 * - rangeOf — The days a date condition spans, as ISO days, or none.
 * - segmentStarts — The first day of each segment of a range, counted from ITS start.
 * - spanLabel — A run of days in words: `Mar 2 – 8`.
 */

import { durationSpan } from './store.js';
import type { WhereCondition } from './where.js';

export type SegmentUnit = 'hour2' | 'day' | 'week' | 'month' | 'quarter' | 'year';

const DAY = 86_400_000;
/** Most segments a unit draws before the next unit up takes over. Will, TODO 540. */
const MOST = { day: 14, month: 12 } as const;
/** Months from which quarters give way to years: 24 months is 2 years. */
const YEARS_FROM = 24;

/** `start` plus whole calendar months, in ms; a 31st is clamped by its month, never carried into the next. */
function plusMonths(start: number, months: number): number {
  const at = new Date(start);
  const month = at.getUTCMonth() + months;
  const last = new Date(Date.UTC(at.getUTCFullYear(), month + 1, 0)).getUTCDate();
  return Date.UTC(at.getUTCFullYear(), month, Math.min(at.getUTCDate(), last));
}

/** Months in a range (end exclusive, ms), rounded UP once a week or more is left over: 12 months and 1 day is 12, and 13 months is 13. */
function monthsIn(start: number, end: number): number {
  const a = new Date(start);
  const b = new Date(end);
  const whole = Math.max((b.getUTCFullYear() - a.getUTCFullYear()) * 12 + b.getUTCMonth() - a.getUTCMonth()
    - (b.getUTCDate() < a.getUTCDate() ? 1 : 0), 0);
  return whole + ((end - plusMonths(start, whole)) / DAY >= 7 ? 1 : 0);
}

/**
 * The unit for a range of ISO days, both ends inclusive. A unit is drawn once per
 * unit in the range, until that passes one of the next unit up: 12 months is 12
 * segments, 13 is 5 quarters, 20 is 7 quarters, and 24 is 2 years.
 */
export function segmentUnit(from: string, to: string): SegmentUnit {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`) + DAY;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 'day';
  const days = Math.round((end - start) / DAY);
  if (days === 1) return 'hour2';
  if (days <= MOST.day) return 'day';
  const months = monthsIn(start, end);
  if (months < 3) return 'week';
  if (months <= MOST.month) return 'month';
  return months < YEARS_FROM ? 'quarter' : 'year';
}

const utc = (options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat => new Intl.DateTimeFormat(undefined, { timeZone: 'UTC', ...options });
const DAY_FORMAT = utc({ weekday: 'short', day: 'numeric', month: 'short' });
const SPAN_FORMAT = utc({ day: 'numeric', month: 'short' });
const YEAR_SPAN_FORMAT = utc({ day: 'numeric', month: 'short', year: 'numeric' });
const MONTH_FORMAT = utc({ month: 'long', year: 'numeric' });
const HOUR_FORMAT = utc({ day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
const CLOCK_FORMAT = utc({ hour: '2-digit', minute: '2-digit', hour12: false });

/** A segment's time span in words, for its tooltip. `key` is the segment's start: its ISO prefix, a quarter as `2026-Q1`. */
export function segmentLabel(key: string, unit: SegmentUnit): string {
  if (unit === 'year') return key;
  if (unit === 'quarter') return `${key.slice(5)} ${key.slice(0, 4)}`;
  const from = new Date(unit === 'month' ? `${key}-01T00:00:00Z` : unit === 'hour2' ? `${key}:00:00Z` : `${key}T00:00:00Z`);
  if (Number.isNaN(from.getTime())) return key;
  if (unit === 'month') return MONTH_FORMAT.format(from);
  if (unit === 'day') return DAY_FORMAT.format(from);
  if (unit === 'week') return SPAN_FORMAT.formatRange(from, new Date(from.getTime() + 6 * DAY));
  return `${HOUR_FORMAT.format(from)}–${CLOCK_FORMAT.format(new Date(from.getTime() + 2 * 3_600_000))}`;
}

/** The days a date condition spans, as ISO days: `between`, `last`, `next` or a single day (`eq`). Anything else spans none. */
export function rangeOf(condition: WhereCondition | undefined, today = new Date()): [string, string] | undefined {
  if (!condition || condition.off) return undefined;
  const day = (v: unknown): string => String(v).slice(0, 10);
  const { between, last, next, eq, unit = 'day' } = condition;
  if (Array.isArray(between) && between.length === 2) return [day(between[0]), day(between[1])];
  for (const [op, n] of [['last', last], ['next', next]] as const) {
    if (n == null) continue;
    // `last 7 days` is 7 days with today in them, not 8: the far end is not counted.
    const [a, b] = durationSpan(op, { n: Number(n), unit }, today);
    const edge = (d: string, by: number): string => new Date(Date.parse(`${d}T00:00:00Z`) + by * DAY).toISOString().slice(0, 10);
    return op === 'last' ? [a < b ? edge(a, 1) : a, b] : [a, a < b ? edge(b, -1) : b];
  }
  return eq != null ? [day(eq), day(eq)] : undefined;
}

const MONTHS: Partial<Record<SegmentUnit, number>> = { month: 1, quarter: 3, year: 12 };

/** The first day of each segment of a range, counted from ITS start — a range of 6 months is 6 segments, whatever the calendar says. The last may be partial. */
export function segmentStarts(from: string, to: string, unit: SegmentUnit): string[] {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`) + DAY;
  const months = MONTHS[unit];
  const count = months ? Math.ceil(monthsIn(start, end) / months) : Math.ceil((end - start) / DAY / (unit === 'week' ? 7 : 1));
  return Array.from({ length: Math.max(count, 1) }, (_, i) =>
    new Date(months ? plusMonths(start, i * months) : start + i * (unit === 'week' ? 7 : 1) * DAY).toISOString().slice(0, 10));
}

/** A run of days in words — `Mar 2 – 8`, or across a year's end with its years — for a tooltip. */
export function spanLabel(from: string, to: string): string {
  const a = new Date(`${from}T00:00:00Z`);
  const b = new Date(`${to}T00:00:00Z`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return from;
  return (a.getUTCFullYear() === b.getUTCFullYear() ? SPAN_FORMAT : YEAR_SPAN_FORMAT).formatRange(a, b);
}
