/**
 * bind-source.ts — the join between a component and its source: the events it
 * sends UP, and the rows and `data-*` that come DOWN. The data layer names no
 * component event and writes no attribute. TODO 196
 * TRAP T-steering-events-are-a-closed-list
 *
 * Map:
 * - BindOptions — What a component may do with the source it is bound to.
 * - bindSource — Point a component at a source: rows and `data-*` down, steering events back.
 * - SteeringEvent — One of them.
 * - SteerBind — What steering needs of one binding: its scope.
 * - steer — Turn one component's event into its source's call.
 */
import { report } from '../data/report.js';
import type { AttachFacts, BoundView, DataSource } from '../data/data-source.js';
import type { FieldReading } from '../data/filter-state.js';
import type { Row } from '../data/store.js';
import type { Populatable } from './apply-state.js';

/** What a component may do with the source it is bound to. */
export interface BindOptions extends AttachFacts {
  /** One NAMED PART of the payload, not all of it. TRAP T-into-merges-on-the-element */
  into?: string;
  /** Unbind when this signal aborts. TRAP T-signal-not-a-teardown-list */
  signal?: AbortSignal;
  /** Events the source must NOT act on. TRAP T-ignore-is-the-scalpel */
  ignore?: readonly string[];
  /** Reshape the rows before they reach this component. TRAP T-adapter-lives-at-the-binding */
  as?: (rows: Row[], source: DataSource) => unknown;
  /** Where its data GOES, instead of `populate()` — a provider answering a
   *  component's request through the callback it asked with.
   *  TRAP T-a-component-asks-its-provider */
  deliver?: (payload: unknown) => void;
}

/**
 * Point a component at a source. Two-way by default: rows and `data-*` down,
 * steering events back. Returns an unbind function.
 */
export function bindSource(source: DataSource, el: Populatable, options: BindOptions = {}): () => void {
  if (source.boundElements.includes(el)) return () => source.unbind(el);
  // TRAP T-signal-not-a-teardown-list — an aborted signal binds nothing.
  if (options.signal?.aborted) return () => {};
  /* `scope` names a FILTER scope: "all" type-checks, binds to a scope of that
     name, and counts one page. The whole set is `rows: 'all'`.
     TRAP T-a-summary-binds-to-all-the-rows */
  if (options.scope === 'all' || (Array.isArray(options.scope) && options.scope.includes('all'))) {
    report({ code: 'scope-all', message: "bind: `scope: 'all'` names a filter scope; for every row, say `rows: 'all'`." });
  }

  const { as: adapt, deliver, into } = options;
  const readonly = options.readonly ?? false;
  const steering: SteerBind = options.scope ? { scope: options.scope } : {};
  const listeners: Array<[string, EventListener]> = [];
  const ignored = new Set(options.ignore ?? []);
  if (!readonly) {
    for (const type of STEERING_EVENTS) {
      // TRAP T-ignore-is-the-scalpel — no listener at all, not an early return.
      if (ignored.has(type)) continue;
      const handler = ((event: Event) => steer(source, el, steering, type, event as CustomEvent)) as EventListener;
      el.addEventListener(type, handler);
      listeners.push([type, handler]);
    }
  }

  /* LOCKED: the source now owns this element's view state, so it reports its
     interactions and stops writing them. Not for a readonly bind, which
     steers nothing. A component with no source stays UNLOCKED and writes its
     own state — that is what makes a standalone grid work.
     TRAP T-bind-locks-what-it-owns */
  if (!readonly) el.setAttribute('data-locked', '');
  /* A control over a scope of a REMOTE source is told so: its menus wait for
     Apply. TRAP T-apply-and-discard-wait-for-a-change */
  if (options.scope && source.remote) el.setAttribute('data-remote', '');
  // …and over a LIVE one, its values report while they move. Will, TODO 107.
  if (options.scope && source.applyOn === 'input') el.setAttribute('data-apply-on', 'input');
  // TRAP T-signal-not-a-teardown-list — drops the BINDING; `once` leaves nothing.
  options.signal?.addEventListener('abort', () => source.unbind(el), { once: true });

  source.attach(el, options, {
    view: (view) => writeView(el, view),
    rows: (rows) => {
      // populate() waits for the first render itself, so a component bound
      // before it upgraded still gets its rows.
      const payload = adapt ? adapt(rows as Row[], source) : rows;
      // Through the callback it ASKED with, when a provider bound it.
      const give = deliver ?? ((p: unknown): void => { void el.populate?.(p); });
      give(into ? mergeInto(el, into, payload) : payload);
    },
    pending: (fields, dirty) => {
      setAttr(el, 'data-pending', fields.length ? fields.join(' ') : undefined);
      setAttr(el, 'data-dirty', dirty ? '' : undefined);
    },
    off: () => {
      for (const [type, handler] of listeners) el.removeEventListener(type, handler);
      // UNLOCKED on the way out, or a component that outlives its source is mute.
      el.removeAttribute('data-locked');
      el.removeAttribute('data-remote');
      el.removeAttribute('data-apply-on');
    },
  });
  return () => source.unbind(el);
}

/** The view as attributes, so CSS can select on it. TRAP T-push-writes-state-as-attributes */
function writeView(el: Element, view: BoundView): void {
  setAttr(el, 'data-sort-field', view.sortField);
  setAttr(el, 'data-sort-direction', view.sortDirection);
  setAttr(el, 'data-group-field', view.groupField);
  setAttr(el, 'data-filter-fields', view.filterFields.length ? view.filterFields.join(' ') : undefined);
  setAttr(el, 'data-needles', view.needles || undefined);
  setAttr(el, 'data-page', view.paging ? String(view.paging.page) : undefined);
  setAttr(el, 'data-total-pages', view.paging ? String(view.paging.totalPages) : undefined);
  setAttr(el, 'data-page-size', view.paging ? String(view.paging.pageSize) : undefined);
}

/** Write or remove an attribute. `undefined` removes, so CSS stops matching. */
function setAttr(el: Element, name: string, value: string | undefined): void {
  if (value == null) el.removeAttribute(name);
  else el.setAttribute(name, value);
}

/** The shared draft each `into` bind writes its own part of. TRAP T-into-merges-on-the-element */
const DRAFT = Symbol('sherpa:into-draft');

/**
 * Write `value` at `path` in the element's shared draft, and return it.
 * `series.0` → `{ series: [value] }`. MUTATED, not rebuilt.
 * TRAP T-into-merges-on-the-element
 */
function mergeInto(el: Populatable, path: string, value: unknown): unknown {
  const host = el as unknown as Record<symbol, unknown>;
  const segments = path.split('.').filter(Boolean);
  if (!segments.length) return value;

  const first = segments[0]!;
  // The ROOT follows the same rule: a numeric first segment means an array.
  host[DRAFT] ??= /^\d+$/.test(first) ? [] : {};
  let node = host[DRAFT] as Record<string | number, unknown>;

  for (let i = 0; i < segments.length - 1; i++) {
    const key = segments[i]!;
    const nextIsIndex = /^\d+$/.test(segments[i + 1]!);
    node[key] ??= nextIsIndex ? [] : {};
    node = node[key] as Record<string | number, unknown>;
  }
  node[segments[segments.length - 1]!] = value;
  return host[DRAFT];
}

/** The events a bound component may send UP. TRAP T-steering-events-are-a-closed-list */
const STEERING_EVENTS = [
  'sort-change',
  'group-change',
  'quick-filter-change',
  // A scoped bar added or took off a chip: what its scope HOLDS changed.
  'filter-add',
  'filter-remove',
  // A heading's answer is its field's, in the grid's scope.
  'column-filter-change',
  // One field's own Apply or Discard.
  'filter-apply',
  'filter-discard',
  'filter-change',
  'page-change',
  'page-size-change',
  'search-change',
  // A REPORT, not a request: changes what the pager draws, never the query.
  // TRAP T-grouped-paging-belongs-to-the-view
  'grid-pages-change',
  // "Select all rows" on a paged grid: every matching row, answered back. TODO 238
  'select-all-request',
] as const;

/** One of them. */
export type SteeringEvent = (typeof STEERING_EVENTS)[number];

/** What steering needs of one binding: its scope. */
export interface SteerBind {
  scope?: string | readonly string[];
}

/** Which scope a Group or Sort came from: the event's, else its one bound scope. TODO 99 */
function arranger(detail: Record<string, unknown>, bind: SteerBind | undefined): string | undefined {
  if (typeof detail['scope'] === 'string') return detail['scope'];
  return typeof bind?.scope === 'string' ? bind.scope : undefined;
}

/** Turn one component's event into its source's call. TRAP T-steering-events-are-a-closed-list */
export function steer(source: DataSource, el: Populatable, bind: SteerBind | undefined, type: SteeringEvent, event: CustomEvent): void {
  const detail = (event.detail ?? {}) as Record<string, unknown>;

  switch (type) {
    case 'sort-change': {
      const field = detail['field'];
      const direction = detail['direction'] === 'desc' ? 'desc' : 'asc';
      source.setSort(typeof field === 'string' ? field : null, direction, arranger(detail, bind));
      return;
    }
    case 'group-change': {
      const field = detail['field'];
      source.setGroup(typeof field === 'string' && field ? field : null, arranger(detail, bind));
      return;
    }
    case 'quick-filter-change': {
      /* THE EVENT IS THE ANSWER. `readings` is the control's own — which field,
         which values, which condition — and `apply()` is the ONE place a
         reading becomes a query; the control is never read.
         TRAP T-one-query-builder-in-the-data-layer */
      const presets = (detail['presets'] ?? {}) as Record<string, { on: boolean; readings: Record<string, FieldReading> }>;
      const holds = Array.isArray(detail['holds']) ? (detail['holds'] as string[]) : undefined;
      /* A control over SEVERAL scopes — the panel — reports the ONE field it
         changed, in its scope, and its presets. TRAP T-the-panel-reports-its-own-reading */
      if (Array.isArray(bind?.scope)) {
        source.answerScopes(detail['readings'] as Record<string, Record<string, FieldReading>> | undefined);
        return;
      }
      const readings = (detail['readings'] as Record<string, FieldReading> | undefined) ?? pickedReadings(detail['values']);
      /* A SCOPED bar answers in the Query: its saved filters are presets, on
         or off, and their readings go to the library. TRAP T-one-query-one-owner */
      if (typeof bind?.scope === 'string') {
        // Its filter Switch, from a bar that shows one. TRAP T-the-filter-switch-keeps-what-it-turned-off
        const suspended = typeof detail['suspended'] === 'boolean' ? { suspended: detail['suspended'] } : {};
        source.answerScope(bind.scope, { ...(holds ? { holds } : {}), readings, presets, ...suspended });
        return;
      }
      // An unscoped bar's report is its whole answer, saved filters too.
      source.answerUnscoped(el, readings, presets);
      return;
    }
    case 'filter-add':
    case 'filter-remove': {
      const scope = bind?.scope;
      /* The panel ASKS a scope to take fields — from the Filters menu, or sent up
         or down. TRAP T-send-to-view-filters */
      if (type === 'filter-add' && Array.isArray(scope)) {
        const ids = detail['ids'];
        const from = detail['from'];
        if (typeof detail['scope'] === 'string' && Array.isArray(ids)) {
          source.request(detail['scope'], ids.map(String), typeof from === 'string' ? from : undefined);
        }
        return;
      }
      // A scoped bar's chips ARE its scope's holds, said in its event. TRAP T-a-bar-reports-its-holds
      const holds = detail['holds'];
      if (typeof scope === 'string' && Array.isArray(holds)) source.hold(scope, holds.map(String));
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
    case 'filter-apply':
    case 'filter-discard': {
      // One field's own Apply or Discard, on a remote source — or, naming none, all of them.
      // TRAP T-apply-and-discard-wait-for-a-change
      const field = detail['field'];
      const at = typeof field === 'string' ? { field } : {};
      if (type === 'filter-apply') source.commit(at);
      else source.discard(at);
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
      const term = detail['value'];
      source.setSearch(typeof term === 'string' ? term : '');
      return;
    }
    case 'select-all-request': {
      // The grid holds one page; its source holds the rest. TRAP T-select-all-is-the-visible-rows
      const answer = detail['answer'];
      if (typeof answer !== 'function') return;
      event.preventDefault();
      void source.allRows(el).then((rows) => (answer as (rows: readonly Row[]) => void)(rows));
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
