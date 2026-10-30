/**
 * saved-filters.ts — a reader's SAVED FILTERS: every scope's filters under one
 * name, kept per PAGE beside its Views. Will, TODO 105. TRAP T-saved-filters-are-every-scope
 *
 * Map:
 * - SavedFilterSet — A page's saved sets, by id.
 * - SavedFilterOptions — local (shared across tabs, the default) or session.
 * - loadSavedFilters — Read a page's saved sets. A broken entry is dropped.
 * - saveFilterAs — Keep filters under a name — over a set of that name — and hand back the whole store.
 * - deleteSavedFilter — Forget one set, and hand back what is left.
 * - renameSavedFilter — Rename one set in its place — its id follows its name — and hand back the whole store.
 * - filtersOf — The filter half of a View's JSON: each scope's filters, and no arrangement.
 * - conditionsOf — A saved set as one preset's conditions: what each scope it names asks for.
 * - loadAdded — The sets added to a bar in this tab, each with the scope its chip is on.
 * - keepAdded — Remember the sets added in this tab.
 */
import { isSavedFilter, stripArrangement, type QueryDefaults, type SavedFilter, type ViewScope } from '../data/query.js';
import type { Where } from '../data/where.js';
import {
  isPlainObject, labelId, readJson, removeKey, storageKind, writeJson,
} from './web-storage.js';

/** A page's saved sets, by id. */
export type SavedFilterSet = Record<string, SavedFilter>;

/** Where the sets are kept. */
export interface SavedFilterOptions {
  /** Share across TABS via localStorage — on by default, as for a saved view. */
  shared?: boolean;
}

/** Key prefixes, so a host's own storage keys cannot collide with these. */
const PREFIX = 'sherpa:filter-sets:';
/** The sets added to a bar, per tab: a reload keeps their chips. */
const ON_PREFIX = 'sherpa:filter-set-on:';

/** Read a page's saved sets. A broken entry is dropped, never handed on. TRAP T-storage-access-throws */
export function loadSavedFilters(page: string, options: SavedFilterOptions = {}): SavedFilterSet {
  const stored = readJson<Record<string, unknown>>(storageKind(options.shared ?? true), PREFIX + page, {}, isPlainObject);
  return Object.fromEntries(Object.entries(stored).filter((entry): entry is [string, SavedFilter] => isSavedFilter(entry[1])));
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

/** Rename one set in its place — its id follows its name — and hand back the
 *  whole store. TRAP T-derived-id-makes-resave-an-update */
export function renameSavedFilter(
  page: string, id: string, label: string, options: SavedFilterOptions = {},
): SavedFilterSet {
  const trimmed = label.trim();
  const sets = loadSavedFilters(page, options);
  if (!trimmed || !sets[id]) return sets;
  const renamed = Object.fromEntries(Object.entries(sets)
    .map(([key, set]) => (key === id ? [labelId(trimmed), { ...set, label: trimmed }] : [key, set])));
  writeJson(storageKind(options.shared ?? true), PREFIX + page, renamed);
  return renamed;
}

/** The filter half of a View's JSON: each scope's filters, and no arrangement. */
export function filtersOf(view: QueryDefaults): QueryDefaults {
  const scopes: Record<string, Partial<ViewScope>> = {};
  for (const [id, scope] of Object.entries(view.scopes)) {
    const { superseded: _kept, ...filters } = scope as ViewScope;
    stripArrangement(filters);
    scopes[id] = filters;
  }
  return { v: 1, scopes: scopes as QueryDefaults['scopes'] };
}

/** A saved set as ONE preset's conditions: what each scope it names asks for. A
 *  filter the reader had off asks nothing. Will, TODO 605 · TRAP T-saved-filters-are-every-scope */
export function conditionsOf(set: SavedFilter): Where {
  const scopes = Object.values(set.query.scopes) as ViewScope[];
  return Object.fromEntries(scopes.flatMap((scope) => Object.entries(scope.where ?? {}))
    .filter(([, condition]) => !(condition as { off?: boolean }).off));
}

/** The sets added to a bar in this tab, each with the scope its chip is on. */
export function loadAdded(page: string): Record<string, string> {
  return readJson<Record<string, string>>('session', ON_PREFIX + page, {},
    (v): v is Record<string, string> => isPlainObject(v) && Object.values(v).every((scope) => typeof scope === 'string'));
}

/** Remember the sets added in this tab. */
export function keepAdded(page: string, added: Readonly<Record<string, string>>): void {
  if (Object.keys(added).length) writeJson('session', ON_PREFIX + page, added);
  else removeKey('session', ON_PREFIX + page);
}
