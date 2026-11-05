/**
 * format-value.ts — a field's value as a reader reads it: its name where its field
 * names it, a day in words, a list as a list, an object by its parts. Words only: a
 * sort, a filter and a key read the raw value. DOM-free. TRAP T-a-cell-draws-words-not-its-value
 *
 * Map:
 * - ValueFacts — What a value's words need of its field: its type, its values' names, and whether a day has a time.
 * - formatFieldValue — A value as a reader reads it: `On`, `04 Nov 2026`, `VIP, Legacy`, `building: B2, floor: 3`; none, empty.
 */
import { formatDate, formatDateTime } from './format-date.js';
import { valueKey } from './store.js';

/** What a value's words need of its field: its type, its values' names, and whether a day has a time. */
export interface ValueFacts {
  type?: string;
  /** A value's name, by its value key, where it is not the value. */
  labels?: Readonly<Record<string, string>>;
  /** A date that holds a time of day: its time is said too. */
  time?: boolean;
}

/** One list format, made when first asked. */
let list: Intl.ListFormat | undefined;
const listOf = (words: string[]): string => (list ??= new Intl.ListFormat(undefined, { type: 'unit', style: 'short' })).format(words);

/** An ISO day and time, to the minute. */
const DAY_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/** A day, the one way. TRAP T-a-date-reads-one-way */
function dayOf(value: unknown, time: boolean | undefined): string {
  const iso = value instanceof Date ? (Number.isNaN(value.getTime()) ? '' : value.toISOString()) : String(value);
  return time && DAY_TIME.test(iso) ? formatDateTime(iso.slice(0, 16)) : formatDate(iso);
}

/** A value as a reader reads it: `On`, `04 Nov 2026`, `VIP, Legacy`, `building: B2, floor: 3`; none, empty. */
export function formatFieldValue(value: unknown, facts: ValueFacts = {}): string {
  if (value == null || value === '') return '';
  const { labels } = facts;
  const key = valueKey(value);
  // Own keys only: a value named `constructor` is not the prototype's.
  if (labels && Object.hasOwn(labels, key)) return labels[key]!;
  if (Array.isArray(value)) return listOf(value.map((v) => formatFieldValue(v, facts)).filter(Boolean));
  if (facts.type === 'date' || value instanceof Date) return dayOf(value, facts.time);
  if (typeof value !== 'object') return String(value);
  // A part is not its field: it is said by its name, as it is.
  return listOf(Object.entries(value).flatMap(([part, v]) => {
    const said = formatFieldValue(v);
    return said ? [`${part}: ${said}`] : [];
  }));
}
