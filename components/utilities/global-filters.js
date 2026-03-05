/**
 * global-filters.js — Shared global filter state provider.
 *
 * Host apps register a provider at boot that returns the current global
 * filter state (active filters + timerange). Viz components import
 * `getInitialFilters()` to seed their first data load with any global
 * filters already in effect.
 *
 * Usage (app boot):
 *   import { setGlobalFilterProvider } from 'sherpa-ui/components/utilities/global-filters.js';
 *   setGlobalFilterProvider(() => ({
 *     filters: myFilterService.getFilters(),
 *     timerange: myFilterService.getTimerange(),
 *   }));
 *
 * Usage (component):
 *   import { getInitialFilters } from '../utilities/global-filters.js';
 *   const filters = getInitialFilters();
 */

let provider = null;

/**
 * Register a provider that returns current global filter state.
 * Signature: () => { filters: Array, timerange: Object|null }
 * @param {Function} fn
 */
export function setGlobalFilterProvider(fn) {
  provider = fn;
}

/**
 * Build an array of filter objects from the current global state.
 * Returns [] when no provider is registered or no filters are active.
 * @returns {Array<Object>}
 */
export function getInitialFilters() {
  const state = provider ? provider() : { filters: [], timerange: null };
  const filters = [];

  for (const gf of state.filters || []) {
    if (gf.values?.length) {
      filters.push({ field: gf.field, operator: "in", values: gf.values });
    }
  }

  if (state.timerange) {
    filters.push({ type: "timerange", ...state.timerange });
  }

  return filters;
}
