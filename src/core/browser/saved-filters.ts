/**
 * saved-filters.ts — a reader's SAVED FILTERS: every scope's filters under one
 * name, kept per PAGE beside its Views. Will, TODO 105. TRAP T-saved-filters-are-every-scope
 *
 * Map:
 * - SavedFilter — One saved set: its name, and each scope's filters as a View writes them.
 * - SavedFilterSet — A page's saved sets, by id.
 * - SavedFilterOptions — local (shared across tabs, the default) or session.
 * - loadSavedFilters — Read a page's saved sets. A broken entry is dropped.
 * - saveFilterAs — Keep filters under a name — over a set of that name — and hand back the whole store.
 * - deleteSavedFilter — Forget one set, and hand back what is left.
 * - filtersOf — The filter half of a View's JSON: each scope's filters, and no arrangement.
 * - loadApplied — The set last taken in this tab: what "Save <name>" saves over.
 * - keepApplied — Remember the set last taken in this tab, or that none is.
 */
import type { QueryDefaults, ViewScope } from '../data/query.js';
import {
  isPlainObject, labelId, readJson, removeKey, storageKind, writeJson,
} from './web-storage.js';

/** One saved set: its name, and each scope's filters as a View writes them. */
export interface SavedFilter {
  label: string;
  query: QueryDefaults;
}

/** A page's saved sets, by id. */
export type SavedFilterSet = Record<string, SavedFilter>;

/** Where the sets are kept. */
export interface SavedFilterOptions {
  /** Share across TABS via localStorage — on by default, as for a saved view. */
  shared?: boolean;
}

/** Key prefixes, so a host's own storage keys cannot collide with these. */
const PREFIX = 'sherpa:filter-sets:';
/** The set last taken, per tab: a reload keeps "Save <name>". */
const ON_PREFIX = 'sherpa:filter-set-on:';

const isSaved = (v: unknown): v is SavedFilter =>
  isPlainObject(v) && typeof v['label'] === 'string' && isPlainObject(v['query'])
  && (v['query'] as { v?: unknown }).v === 1 && isPlainObject((v['query'] as { scopes?: unknown }).scopes);

/** Read a page's saved sets. A broken entry is dropped, never handed on. TRAP T-storage-access-throws */
export function loadSavedFilters(page: string, options: SavedFilterOptions = {}): SavedFilterSet {
  const stored = readJson<Record<string, unknown>>(storageKind(options.shared ?? true), PREFIX + page, {}, isPlainObject);
  return Object.fromEntries(Object.entries(stored).filter((entry): entry is [string, SavedFilter] => isSaved(entry[1])));
}

/** Keep filters under a name — over a set of that name — and hand back the
 *  whole store. TRAP T-derived-id-makes-resave-an-update */
export function saveFilterAs(
  page: string, label: string, query: QueryDefaults, options: SavedFilterOptions = {},
): SavedFilterSet {
  const trimmed = label.trim();
  if (!trimmed) return loadSavedFilters(page, options);
  const sets = { ...loadSavedFilters(page, options), [labelId(trimmed)]: { label: trimmed, query } };
  writeJson(storageKind(options.shared ?? true), PREFIX + page, sets);
  return sets;
}

/** Forget one set, and hand back what is left. */
export function deleteSavedFilter(page: string, id: string, options: SavedFilterOptions = {}): SavedFilterSet {
  const kept = Object.fromEntries(Object.entries(loadSavedFilters(page, options)).filter(([key]) => key !== id));
  writeJson(storageKind(options.shared ?? true), PREFIX + page, kept);
  return kept;
}

/** The filter half of a View's JSON: each scope's filters, and no arrangement. */
export function filtersOf(view: QueryDefaults): QueryDefaults {
  const scopes: Record<string, Partial<ViewScope>> = {};
  for (const [id, scope] of Object.entries(view.scopes)) {
    const { sort: _sort, group: _group, search: _search, ...filters } = scope as ViewScope;
    scopes[id] = filters;
  }
  return { v: 1, scopes: scopes as QueryDefaults['scopes'] };
}

/** The set last taken in this tab, by id: what "Save <name>" saves over, after
 *  the chips change too. Will, 366. TRAP T-saved-filters-are-every-scope */
export function loadApplied(page: string): string | null {
  const held = readJson<{ id: string } | null>('session', ON_PREFIX + page, null,
    (v): v is { id: string } => isPlainObject(v) && typeof v['id'] === 'string');
  return held?.id ?? null;
}

/** Remember the set last taken in this tab, or that none is. */
export function keepApplied(page: string, id: string | null): void {
  if (id) writeJson('session', ON_PREFIX + page, { id });
  else removeKey('session', ON_PREFIX + page);
}
