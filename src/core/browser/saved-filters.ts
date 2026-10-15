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
 * - sameFilters — Do the filters on screen still say what a set says, over the scopes it names?
 * - AppliedFilters — The set on screen: which, and the filters it was applied over.
 * - loadApplied — The set on screen in this tab, if one is.
 * - keepApplied — Remember the set on screen in this tab, or that none is.
 */
import type { Query, QueryDefaults, ViewScope } from '../data/query.js';
import {
  isPlainObject, labelId, readJson, removeKey, writeJson, type StorageKind,
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
/** The set on screen, per tab, so a reload keeps its chip. */
const ON_PREFIX = 'sherpa:filter-set-on:';

const kindOf = (shared: boolean): StorageKind => (shared ? 'local' : 'session');

const isSaved = (v: unknown): v is SavedFilter =>
  isPlainObject(v) && typeof v['label'] === 'string' && isPlainObject(v['query'])
  && (v['query'] as { v?: unknown }).v === 1 && isPlainObject((v['query'] as { scopes?: unknown }).scopes);

/** Read a page's saved sets. A broken entry is dropped, never handed on. TRAP T-storage-access-throws */
export function loadSavedFilters(page: string, options: SavedFilterOptions = {}): SavedFilterSet {
  const stored = readJson<Record<string, unknown>>(kindOf(options.shared ?? true), PREFIX + page, {}, isPlainObject);
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
  writeJson(kindOf(options.shared ?? true), PREFIX + page, sets);
  return sets;
}

/** Forget one set, and hand back what is left. */
export function deleteSavedFilter(page: string, id: string, options: SavedFilterOptions = {}): SavedFilterSet {
  const kept = Object.fromEntries(Object.entries(loadSavedFilters(page, options)).filter(([key]) => key !== id));
  writeJson(kindOf(options.shared ?? true), PREFIX + page, kept);
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

/** Do the filters on screen still say what a set says, over the scopes it
 *  names? Only what FILTERS counts: each field's condition and the saved
 *  filters on — not a chip held empty. */
export function sameFilters(saved: QueryDefaults, now: QueryDefaults): boolean {
  const meaning = (scope: Partial<ViewScope> | undefined): string => sortedJson({
    where: scope?.where ?? {},
    on: Object.entries(scope?.presets ?? {}).filter(([, on]) => on).map(([id]) => id).sort(),
  });
  return Object.keys(saved.scopes).every((id) => meaning(saved.scopes[id]) === meaning(now.scopes[id]));
}

/** JSON with every object's keys in order, so two equal answers read the same. */
function sortedJson(value: unknown): string {
  const walk = (v: unknown): unknown => (Array.isArray(v) ? v.map(walk)
    : isPlainObject(v) ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, walk(v[k])])) : v);
  return JSON.stringify(walk(value));
}

/** The set on screen: which, and the filters it was applied over — what
 *  Dismiss puts back. `null`: it was saved, not applied — the View's own. */
export interface AppliedFilters {
  id: string;
  before: Query | null;
}

/** The set on screen in this tab, if one is. */
export function loadApplied(page: string): AppliedFilters | null {
  return readJson<AppliedFilters | null>('session', ON_PREFIX + page, null,
    (v): v is AppliedFilters => isPlainObject(v) && typeof v['id'] === 'string'
      && (v['before'] === null || isPlainObject(v['before'])));
}

/** Remember the set on screen in this tab, or that none is. */
export function keepApplied(page: string, applied: AppliedFilters | null): void {
  if (applied) writeJson('session', ON_PREFIX + page, applied);
  else removeKey('session', ON_PREFIX + page);
}
