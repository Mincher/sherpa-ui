/**
 * saved-filters.ts — the saved custom filters over one set of data, kept across reloads.
 *
 * The saved-view door, keyed by the DATA a filter names instead of the page:
 * its readings name fields, and other records may not have them.
 * TRAP T-a-saved-filter-lives-with-its-data
 *
 * Map:
 * - SavedFilter — one saved custom filter: its name, and the readings it applies
 * - SavedFilterSet — the saved filters over one set of data, keyed by id
 * - SavedFilterOptions — local (shared across tabs, the default) or session
 * - loadSavedFilters — read the saved filters over one set of data
 * - saveFilterAs — save readings as a named filter, and hand back the whole set
 * - deleteSavedFilter — forget one saved filter, and hand back what is left
 */
import type { FieldReading } from '../data/filter-state.js';
import {
  isPlainObject, labelId, readJson, writeJson, type StorageKind,
} from './web-storage.js';

/** One saved custom filter: its name, and the readings it applies. TRAP T-a-saved-filter-is-its-readings */
export interface SavedFilter {
  label: string;
  readings: Record<string, FieldReading>;
}

/** The saved filters over one set of data, keyed by id. */
export type SavedFilterSet = Record<string, SavedFilter>;

/** Where a set is kept. */
export interface SavedFilterOptions {
  /** Share across TABS via localStorage — on by default, as for a saved view. */
  shared?: boolean;
}

/** Key prefix, so a host's own storage keys cannot collide with these. */
const PREFIX = 'sherpa:filters:';

const kindOf = (shared: boolean): StorageKind => (shared ? 'local' : 'session');

/** One stored entry, as far as it can be trusted: a name and a readings object. */
const isSaved = (v: unknown): v is SavedFilter =>
  isPlainObject(v) && typeof v['label'] === 'string' && isPlainObject(v['readings']);

/**
 * Read the saved filters over `data` — the name of the records they filter.
 * A broken entry is dropped, never handed on. TRAP T-storage-access-throws
 */
export function loadSavedFilters(data: string, options: SavedFilterOptions = {}): SavedFilterSet {
  const stored = readJson<Record<string, unknown>>(
    kindOf(options.shared ?? true), PREFIX + data, {}, isPlainObject,
  );
  return Object.fromEntries(
    Object.entries(stored).filter((entry): entry is [string, SavedFilter] => isSaved(entry[1])),
  );
}

/**
 * Save `readings` as a named filter over `data`, and hand back the whole set.
 * The same name saves over the old one. TRAP T-derived-id-makes-resave-an-update
 */
export function saveFilterAs(
  data: string,
  label: string,
  readings: Record<string, FieldReading>,
  options: SavedFilterOptions = {},
): SavedFilterSet {
  const trimmed = label.trim();
  if (!trimmed) return loadSavedFilters(data, options);
  const set = { ...loadSavedFilters(data, options), [labelId(trimmed)]: { label: trimmed, readings } };
  writeJson(kindOf(options.shared ?? true), PREFIX + data, set);
  return set;
}

/** Forget one saved filter, and hand back what is left. */
export function deleteSavedFilter(
  data: string,
  id: string,
  options: SavedFilterOptions = {},
): SavedFilterSet {
  const kept = Object.fromEntries(
    Object.entries(loadSavedFilters(data, options)).filter(([key]) => key !== id),
  );
  writeJson(kindOf(options.shared ?? true), PREFIX + data, kept);
  return kept;
}
