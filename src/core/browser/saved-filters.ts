/**
 * saved-filters.ts — a reader's SAVED FILTER: every scope's filters under one
 * name, read as one preset. Where it is kept is the page keeper's (page-state.ts).
 * Will, TODO 105. TRAP T-saved-filters-are-every-scope
 *
 * Map:
 * - filtersOf — The filter half of a View's JSON: each scope's filters, and no arrangement.
 * - conditionsOf — A saved set as one preset's conditions: what each scope it names asks for.
 */
import { stripArrangement, type QueryDefaults, type SavedFilter, type ViewScope } from '../data/query.js';
import type { Where } from '../data/where.js';

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
