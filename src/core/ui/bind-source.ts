/**
 * bind-source.ts — what a bound component's events ASK of its source: the
 * closed list of steering events, and the one function that turns each into a
 * call on the source. The data layer names no component event. TODO 196
 * TRAP T-steering-events-are-a-closed-list
 *
 * Map:
 * - STEERING_EVENTS — The events a bound component may send UP.
 * - SteeringEvent — One of them.
 * - SteerBind — What steering needs of one binding: its scope, and what its bar answered last.
 * - steer — Turn one component's event into its source's call.
 */
import type { DataSource } from '../data/data-source.js';
import type { FieldReading } from '../data/filter-state.js';
import type { Populatable } from './apply-state.js';

/** The events a bound component may send UP. TRAP T-steering-events-are-a-closed-list */
export const STEERING_EVENTS = [
  'sort-change',
  'group-change',
  'quick-filter-change',
  // A scoped bar added or took off a chip: what its scope HOLDS changed.
  'filter-add',
  'filter-remove',
  // A heading's answer is its field's, in the grid's scope.
  'column-filter-change',
  // The panel's requests: add to a scope, and one field's own Apply or Discard.
  'filter-add-request',
  'filter-apply',
  'filter-discard',
  'filter-change',
  // A saved filter's rows changed, or its change was put back. TRAP T-a-saved-filter-keeps-its-edit
  'preset-edit',
  'page-change',
  'page-size-change',
  'search-change',
  // A REPORT, not a request: changes what the pager draws, never the query.
  // TRAP T-grouped-paging-belongs-to-the-view
  'grid-pages-change',
] as const;

/** One of them. */
export type SteeringEvent = (typeof STEERING_EVENTS)[number];

/** What steering needs of one binding: its scope, and what its bar answered last. */
export interface SteerBind {
  scope?: string | readonly string[];
  /** The fields an unscoped bar answered last, so a field it drops is cleared. */
  answered?: Set<string>;
  /** Its saved filters' part keys, so one switched off takes its part with it. */
  saved?: Set<string>;
}

/** Turn one component's event into its source's call. TRAP T-steering-events-are-a-closed-list */
export function steer(source: DataSource, el: Populatable, bind: SteerBind | undefined, type: SteeringEvent, event: CustomEvent): void {
  const detail = (event.detail ?? {}) as Record<string, unknown>;

  switch (type) {
    case 'sort-change': {
      const field = detail['field'];
      const direction = detail['direction'] === 'desc' ? 'desc' : 'asc';
      source.setSort(typeof field === 'string' ? field : null, direction);
      return;
    }
    case 'group-change': {
      const field = detail['field'];
      source.setGroup(typeof field === 'string' && field ? field : null);
      return;
    }
    case 'quick-filter-change': {
      /* ASK THE BAR. `readings` is the control's own answer — which field,
         which values, which condition — and `apply()` is the ONE place a
         reading becomes a query. Building a clause from the detail here was
         a second builder that knew no field type, no range and no condition.
         TRAP T-one-query-builder-in-the-data-layer */
      const bar = el as EventTarget & {
        readings?: Record<string, FieldReading>;
        savedReadings?: Record<string, Record<string, FieldReading>>;
        presets?: Record<string, { on: boolean; readings: Record<string, FieldReading> }>;
      } | null;
      /* A control over SEVERAL scopes — the panel — reports the ONE field it
         changed, in its scope, and its presets. TRAP T-the-panel-reports-its-own-reading */
      if (Array.isArray(bind?.scope)) {
        source.answerScopes(detail['readings'] as Record<string, Record<string, FieldReading>> | undefined);
        return;
      }
      const readings = bar?.readings ?? pickedReadings(detail['values']);
      /* A REPORT IS THE WHOLE ANSWER. A field this control answered before
         and does not name now is a field it has stopped filtering by, so it
         is cleared — its OWN fields only, never another control's.
         TRAP T-a-filter-report-is-the-whole-answer */
      /* A SCOPED bar answers in the Query: its saved filters are presets, on
         or off, and their readings go to the library. TRAP T-one-query-one-owner */
      if (typeof bind?.scope === 'string') {
        source.answerScope(bind.scope, { ...(el.heldFields ? { holds: el.heldFields } : {}), readings, presets: bar?.presets ?? {} });
        return;
      }
      for (const field of bind?.answered ?? []) {
        if (!(field in readings)) source.select(field, []);
      }
      if (bind) bind.answered = new Set(Object.keys(readings));
      source.apply(readings);
      /* SAVED FILTERS: one named part each, over any fields — and one switched
         off or taken away takes its part with it.
         TRAP T-a-saved-filter-is-its-readings */
      const saved = bar?.savedReadings ?? {};
      const parts = new Set(Object.keys(saved).map((id) => `saved:${id}`));
      for (const key of bind?.saved ?? []) if (!parts.has(key)) source.contribute(key, undefined);
      for (const [id, given] of Object.entries(saved)) {
        source.apply(given, { reach: 'component', key: `saved:${id}` });
      }
      if (bind) bind.saved = parts;
      return;
    }
    case 'filter-add':
    case 'filter-remove': {
      const scope = bind?.scope;
      // A scoped bar's chips ARE its scope's holds. TRAP T-a-bar-reports-its-holds
      if (typeof scope === 'string' && el.heldFields) source.hold(scope, el.heldFields);
      // The panel ASKS a scope to let one go. TRAP T-a-panel-asks-for-its-scopes
      else if (Array.isArray(scope) && typeof detail['scope'] === 'string' && typeof detail['id'] === 'string') {
        source.release(detail['scope'], detail['id']);
      }
      return;
    }
    case 'column-filter-change': {
      /* A HEADING's answer is its field's, in its grid's scope — and a field
         no scope holds yet gets its normal chip on that scope's bar.
         TRAP T-one-query-one-owner · TRAP T-a-heading-asks-through-the-source */
      const scope = bind?.scope;
      const field = detail['field'];
      if (typeof scope !== 'string' || typeof field !== 'string') return;
      source.answerColumn(scope, field, (detail['reading'] ?? null) as FieldReading | null);
      return;
    }
    case 'filter-add-request': {
      const scope = detail['scope'];
      const ids = detail['ids'];
      if (typeof scope !== 'string' || !Array.isArray(ids)) return;
      const from = detail['from'];
      source.request(scope, ids.map(String), typeof from === 'string' ? from : undefined);
      return;
    }
    case 'preset-edit': {
      // A bar edits in its own scope; the panel names one. TRAP T-a-saved-filter-keeps-its-edit
      const own = bind?.scope;
      const scope = typeof own === 'string' ? own : detail['scope'];
      const id = detail['id'];
      const readings = detail['readings'];
      if (typeof scope !== 'string' || typeof id !== 'string') return;
      source.editPreset(scope, id, readings && typeof readings === 'object'
        ? readings as Record<string, FieldReading> : undefined);
      return;
    }
    case 'filter-apply':
    case 'filter-discard': {
      // One field's own Apply or Discard, on a remote source. TRAP T-apply-and-discard-wait-for-a-change
      const field = detail['field'];
      if (typeof field !== 'string') return;
      if (type === 'filter-apply') source.commit({ field });
      else source.discard({ field });
      return;
    }
    case 'filter-change': {
      // The grid's per-column filter box. One field at a time, substring.
      const field = detail['field'];
      const value = detail['value'];
      if (typeof field !== 'string') return;
      /* PARAMETERS, not a clause, and the FIELD's own slot — `setFilter`
         replaced the whole query, so typing in one column heading wiped
         every chip and every component part.
         TRAP T-one-query-builder-in-the-data-layer */
      const text = value == null ? '' : String(value);
      source.select(field, [], { op: 'contains', text });
      return;
    }
    case 'page-change': {
      const page = detail['page'];
      if (typeof page === 'number') source.setPage(page);
      return;
    }
    case 'grid-pages-change': {
      // The rows in hand are already every matching row, so re-publish the
      // pager's numbers and load nothing.
      const pages = detail['pages'];
      if (typeof pages === 'number' && Number.isFinite(pages)) source.reportPages(pages);
      return;
    }
    case 'page-size-change': {
      const size = detail['pageSize'];
      if (typeof size === 'number') source.setPageSize(size);
      return;
    }
    case 'search-change': {
      const term = detail['value'] ?? detail['search'];
      source.setSearch(typeof term === 'string' ? term : '');
      return;
    }
  }
}

/**
 * A bare `{ field: [values] }` detail as READINGS, for a control with no
 * `readings` getter of its own. Parameters — `apply()` still builds the query.
 * TRAP T-one-query-builder-in-the-data-layer
 */
function pickedReadings(values: unknown): Record<string, FieldReading> {
  const out: Record<string, FieldReading> = {};
  if (!values || typeof values !== 'object') return out;
  for (const [field, picked] of Object.entries(values as Record<string, unknown>)) {
    // TRAP T-toggle-chips-have-no-field — `active` names no field, so it is not here.
    if (Array.isArray(picked)) out[field] = { picked };
  }
  return out;
}
