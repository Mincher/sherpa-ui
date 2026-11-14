/**
 * saved-filters.ts — the filter half of a View's JSON: what Save filters makes a
 * reader's Filters of (`filtersOfSaved`). Will, TODO 105, plan 960 U4.4c.
 * TRAP T-saved-filters-are-every-scope
 *
 * Map:
 * - filtersOf — The filter half of a View's JSON: each scope's filters, and no arrangement.
 */
import { stripArrangement, type QueryDefaults, type ViewScope } from '../data/query.js';

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
