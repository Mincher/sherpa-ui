/**
 * format-date.ts — how a DAY or a range of days reads, the one way every label
 * writes it. DOM-free. TRAP T-a-date-reads-one-way
 *
 * Map:
 * - formatDate — One day, or a range: "03 Sep 2026", "03 to 15 Sep 2026".
 */

interface DayParts {
  day: string;
  month: string;
  year: string;
}

/** An ISO day's parts, read in UTC: parsed UTC, so formatted UTC, or a browser
 *  west of Greenwich shows the day before. Day first, whatever the locale. */
function partsOf(iso: string): DayParts | null {
  const at = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(at.getTime())) return null;
  const parts = new Intl.DateTimeFormat(undefined, {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
  }).formatToParts(at);
  const part = (type: string): string => parts.find((p) => p.type === type)?.value ?? '';
  return { day: part('day'), month: part('month'), year: part('year') };
}

/**
 * One day, or a range, as a label: `03 Sep 2026`; `03 to 15 Sep 2026` within
 * a month; `03 Sep to 15 Oct 2026` within a year; `18 Dec 2026 to 03 Jan 2027`.
 * Will, TODO 45. A value that is not a day is shown as it was given.
 */
export function formatDate(start: string, end?: string): string {
  const a = partsOf(start);
  if (!a) return start;
  const b = end ? partsOf(end) : null;
  const one = `${a.day} ${a.month} ${a.year}`;
  if (!b || (b.day === a.day && b.month === a.month && b.year === a.year)) return one;
  if (b.year !== a.year) return `${one} to ${b.day} ${b.month} ${b.year}`;
  if (b.month !== a.month) return `${a.day} ${a.month} to ${b.day} ${b.month} ${b.year}`;
  return `${a.day} to ${b.day} ${b.month} ${b.year}`;
}
