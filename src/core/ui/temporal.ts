/**
 * temporal.ts — Sherpa's date model is `Temporal`. Where an engine has none —
 * every iOS browser today — a small stand-in gives the same few calls over
 * `Date` and `Intl`, never a third-party polyfill. Will, TODO 255.
 * TRAP T-temporal-is-the-date-model
 *
 * Map:
 * - PlainDateLike — The part of `Temporal.PlainDate` Sherpa uses.
 * - PlainYearMonthLike — The part of `Temporal.PlainYearMonth` Sherpa uses.
 * - hasTemporal — Does this engine have `Temporal`? Asked at each call, so a test can take it away.
 * - plainDate — A day from ISO text or its fields; bad text throws and fields clamp, as `Temporal` does.
 * - plainYearMonth — A month from its fields: `Temporal.PlainYearMonth`, or the stand-in.
 * - today — Today, in this device's time zone.
 */

/** The part of `Temporal.PlainDate` Sherpa uses. */
export interface PlainDateLike {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  /** ISO: Monday 1 to Sunday 7. */
  readonly dayOfWeek: number;
  toPlainYearMonth(): PlainYearMonthLike;
  toLocaleString(locales?: string | string[], options?: Intl.DateTimeFormatOptions): string;
  toString(): string;
}

/** The part of `Temporal.PlainYearMonth` Sherpa uses. */
export interface PlainYearMonthLike {
  readonly year: number;
  readonly month: number;
  readonly daysInMonth: number;
  add(by: { years?: number; months?: number }): PlainYearMonthLike;
  with(fields: { year?: number; month?: number }): PlainYearMonthLike;
  toPlainDate(fields: { day: number }): PlainDateLike;
}

/** Does this engine have `Temporal`? Asked at each call, so a test can take it away. */
export const hasTemporal = (): boolean => typeof Temporal !== 'undefined';

const pad = (n: number, width = 2): string => String(n).padStart(width, '0');
const utc = (year: number, month: number, day: number): Date => new Date(Date.UTC(year, month - 1, day));
const daysIn = (year: number, month: number): number => utc(year, month + 1, 0).getUTCDate();

/** A day, as `Temporal.PlainDate` has it, over `Date` in UTC so no time zone moves it. */
class StandInDate implements PlainDateLike {
  constructor(public readonly year: number, public readonly month: number, public readonly day: number) {}
  get dayOfWeek(): number {
    return utc(this.year, this.month, this.day).getUTCDay() || 7;
  }
  toPlainYearMonth(): PlainYearMonthLike {
    return new StandInMonth(this.year, this.month);
  }
  toLocaleString(locales?: string | string[], options: Intl.DateTimeFormatOptions = {}): string {
    return utc(this.year, this.month, this.day).toLocaleDateString(locales, { ...options, timeZone: 'UTC' });
  }
  toString(): string {
    return `${pad(this.year, 4)}-${pad(this.month)}-${pad(this.day)}`;
  }
}

/** A month, as `Temporal.PlainYearMonth` has it. */
class StandInMonth implements PlainYearMonthLike {
  constructor(public readonly year: number, public readonly month: number) {}
  get daysInMonth(): number {
    return daysIn(this.year, this.month);
  }
  add({ years = 0, months = 0 }: { years?: number; months?: number }): PlainYearMonthLike {
    const at = this.year * 12 + this.month - 1 + years * 12 + months;
    return new StandInMonth(Math.floor(at / 12), (((at % 12) + 12) % 12) + 1);
  }
  with({ year = this.year, month = this.month }: { year?: number; month?: number }): PlainYearMonthLike {
    return new StandInMonth(year, month);
  }
  toPlainDate({ day }: { day: number }): PlainDateLike {
    return new StandInDate(this.year, this.month, day);
  }
}

/** A day from ISO text or its fields: `Temporal.PlainDate`, or the stand-in.
 *  As `Temporal` does, text that is not a real day throws, and fields clamp
 *  the day to the month. */
export function plainDate(from: string | { year: number; month: number; day: number }): PlainDateLike {
  if (hasTemporal()) return Temporal.PlainDate.from(from);
  if (typeof from !== 'string') {
    const month = Math.min(Math.max(from.month, 1), 12);
    return new StandInDate(from.year, month, Math.min(Math.max(from.day, 1), daysIn(from.year, month)));
  }
  const [year = 0, month = 0, day = 0] = /^(\d{4})-(\d{2})-(\d{2})$/.exec(from)?.slice(1).map(Number) ?? [];
  if (!month || month > 12 || !day || day > daysIn(year, month)) throw new RangeError(`not a day: ${from}`);
  return new StandInDate(year, month, day);
}

/** A month from its fields: `Temporal.PlainYearMonth`, or the stand-in. */
export function plainYearMonth(from: { year: number; month: number }): PlainYearMonthLike {
  return hasTemporal() ? Temporal.PlainYearMonth.from(from) : new StandInMonth(from.year, from.month);
}

/** Today, in this device's time zone. */
export function today(): PlainDateLike {
  if (hasTemporal()) return Temporal.Now.plainDateISO();
  const now = new Date();
  return new StandInDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}
