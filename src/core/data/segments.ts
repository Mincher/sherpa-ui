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
 */

export type SegmentUnit = 'hour2' | 'day' | 'week' | 'month' | 'quarter' | 'year';

/** Fewest whole units that make a unit worth drawing. */
const FEWEST = 3;
const DAY = 86_400_000;

/** The unit for a range of ISO days, both ends inclusive: `['2026-01-01', '2026-02-12']` is 6 weeks, so weeks. */
export function segmentUnit(from: string, to: string): SegmentUnit {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`) + DAY;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 'day';
  const days = Math.round((end - start) / DAY);
  if (days === 1) return 'hour2';
  const a = new Date(start);
  const b = new Date(end);
  // Whole calendar months: one fewer when the end falls before the start's day of the month.
  const months = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + b.getUTCMonth() - a.getUTCMonth()
    - (b.getUTCDate() < a.getUTCDate() ? 1 : 0);
  if (months >= 12 * FEWEST) return 'year';
  if (months >= 3 * FEWEST) return 'quarter';
  if (months >= FEWEST) return 'month';
  return days >= 7 * FEWEST ? 'week' : 'day';
}

const utc = (options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat => new Intl.DateTimeFormat(undefined, { timeZone: 'UTC', ...options });
const DAY_FORMAT = utc({ weekday: 'short', day: 'numeric', month: 'short' });
const SPAN_FORMAT = utc({ day: 'numeric', month: 'short' });
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
