/**
 * format-date.ts — how a DAY or a range of days reads, the one way every label
 * writes it, and a day and time a reader types read back. DOM-free. TRAP T-a-date-reads-one-way
 *
 * Map:
 * - formatDate — One day, or a range: "03 Sep 2026", "03 to 15 Sep 2026".
 * - isDateTime — Whether text is an ISO day, with or without its time: a real day, a real time.
 * - formatDateTime — A day and its time, as a reader reads them: "03 Sep 2026, 09:30".
 * - readDateTime — What a reader typed as an ISO day and time: ISO, or the words `formatDateTime` writes.
 */

interface DayParts {
  day: string;
  month: string;
  year: string;
}

/** One formatter for every day drawn. */
const DAY = new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** An ISO day's parts, read in UTC: parsed UTC, so formatted UTC, or a browser
 *  west of Greenwich shows the day before. Day first, whatever the locale. */
function partsOf(iso: string): DayParts | null {
  const at = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(at.getTime())) return null;
  const parts = DAY.formatToParts(at);
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

const ISO = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/;

/** Whether text is an ISO day, `YYYY-MM-DD`, or a day and time, `YYYY-MM-DDThh:mm`: a day the calendar has, a time the clock has. */
export function isDateTime(text: string): boolean {
  const found = ISO.exec(text);
  if (!found) return false;
  const [year, month, day, hour = 0, minute = 0] = found.slice(1).map((n) => (n === undefined ? undefined : Number(n))) as number[];
  const at = new Date(Date.UTC(year!, month! - 1, day!));
  return at.getUTCFullYear() === year && at.getUTCMonth() === month! - 1 && at.getUTCDate() === day && hour! < 24 && minute! < 60;
}

/** A day and its time, as a reader reads them: the day as `formatDate` writes it, then the time: `03 Sep 2026, 09:30`. Not a day, as given. */
export function formatDateTime(iso: string): string {
  if (!isDateTime(iso)) return iso;
  const time = iso.slice(11);
  return time ? `${formatDate(iso)}, ${time}` : formatDate(iso);
}

/** Each month's number by its name, long and short, in the reader's words and in English, lower case. */
let months: Map<string, number> | undefined;
const monthOf = (name: string): number | undefined => {
  months ??= new Map([undefined, 'en'].flatMap((locale) => ['long', 'short'].flatMap((width) => Array.from({ length: 12 }, (_, i) => {
    const said = new Intl.DateTimeFormat(locale, { month: width as 'long' | 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2000, i, 1)));
    return [said.toLowerCase().replace(/\.$/, ''), i + 1] as [string, number];
  }))));
  return months.get(name.toLowerCase().replace(/\.$/, ''));
};

const WORDS = /^(\d{1,2})\s+(\p{L}+\.?)\s+(\d{4})(?:,?\s+(\d{1,2}):(\d{2}))?$/u;

/** What a reader typed, as an ISO day and time: ISO itself (a space for the `T` too), or the words
 *  `formatDateTime` writes, `3 Sep 2026, 09:30`; none, it names no day. */
export function readDateTime(text: string): string | undefined {
  const typed = text.trim().replace(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})$/, '$1T$2');
  if (isDateTime(typed)) return typed;
  const found = WORDS.exec(typed);
  const month = found && monthOf(found[2]!);
  if (!found || !month) return undefined;
  const pad = (n: string | number): string => String(n).padStart(2, '0');
  const iso = `${found[3]}-${pad(month)}-${pad(found[1]!)}${found[4] ? `T${pad(found[4])}:${found[5]}` : ''}`;
  return isDateTime(iso) ? iso : undefined;
}
