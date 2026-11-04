/**
 * segments.ts — cut a date range into the segments a sparkline draws.
 *
 * DOM-free. The unit is the largest one that fits at least three whole times;
 * where none does, a smaller one. A day alone is cut in two-hour steps.
 * Will, TODO 540.
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

/** Fewest whole units that make a unit worth drawing. */
const FEWEST = 3;
const DAY = 86_400_000;

/** Whole calendar months from `start` to `end` (ms): one fewer when the end falls before the start's day of the month. */
function wholeMonths(start: number, end: number): number {
  const a = new Date(start);
  const b = new Date(end);
  return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + b.getUTCMonth() - a.getUTCMonth() - (b.getUTCDate() < a.getUTCDate() ? 1 : 0);
}

/** The unit for a range of ISO days, both ends inclusive: `['2026-01-01', '2026-02-12']` is 6 weeks, so weeks. */
export function segmentUnit(from: string, to: string): SegmentUnit {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`) + DAY;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 'day';
  const days = Math.round((end - start) / DAY);
  if (days === 1) return 'hour2';
  const months = wholeMonths(start, end);
  if (months >= 12 * FEWEST) return 'year';
  if (months >= 3 * FEWEST) return 'quarter';
  if (months >= FEWEST) return 'month';
  return days >= 7 * FEWEST ? 'week' : 'day';
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
    if (n != null) return durationSpan(op, { n: Number(n), unit }, today);
  }
  return eq != null ? [day(eq), day(eq)] : undefined;
}

const MONTHS: Partial<Record<SegmentUnit, number>> = { month: 1, quarter: 3, year: 12 };

/** The first day of each segment of a range, counted from ITS start — a range of 6 months is 6 segments, whatever the calendar says. The last takes any days left over. */
export function segmentStarts(from: string, to: string, unit: SegmentUnit): string[] {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`) + DAY;
  const months = MONTHS[unit];
  const count = months ? Math.floor(wholeMonths(start, end) / months) : Math.floor((end - start) / DAY / (unit === 'week' ? 7 : 1));
  const at = new Date(start);
  return Array.from({ length: Math.max(count, 1) }, (_, i) => {
    if (!months) return new Date(start + i * (unit === 'week' ? 7 : 1) * DAY).toISOString().slice(0, 10);
    // Counted from the start, so a 31st is clamped by its month and never carried into the next.
    const month = at.getUTCMonth() + i * months;
    const last = new Date(Date.UTC(at.getUTCFullYear(), month + 1, 0)).getUTCDate();
    return new Date(Date.UTC(at.getUTCFullYear(), month, Math.min(at.getUTCDate(), last))).toISOString().slice(0, 10);
  });
}

/** A run of days in words — `Mar 2 – 8`, or across a year's end with its years — for a tooltip. */
export function spanLabel(from: string, to: string): string {
  const a = new Date(`${from}T00:00:00Z`);
  const b = new Date(`${to}T00:00:00Z`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return from;
  return (a.getUTCFullYear() === b.getUTCFullYear() ? SPAN_FORMAT : YEAR_SPAN_FORMAT).formatRange(a, b);
}
