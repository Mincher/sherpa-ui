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
 * - ask — A control's request, to its context's doors; a list is one change.
 * - steer — Turn one component's event into its source's call.
 */
import { report } from '../data/report.js';
import type { AttachFacts, BoundView, DataSource } from '../data/data-source.js';
import type { FieldReading } from '../data/filter-state.js';
import { VIEW, type Presentation, type QueryRequest } from '../data/query.js';
import type { QueryContext } from '../data/query-context.js';
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
  /** The events a READONLY bind still steers: a pivot's filters. TODO 571 */
  steers?: readonly SteeringEvent[];
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
  // A provider binds with `deliver`. Will, TODO 388. TRAP T-a-grid-is-never-wired-by-hand
  if (!options.deliver && (el as { localName?: string }).localName === 'sherpa-data-grid') {
    report({
      code: 'grid-without-provider',
      message: 'bind: a data grid is wired by hand. Put it in a <sherpa-provider> and give the provider its source: provider.provide({ sources: { name: source } }).',
      at: { tag: 'sherpa-data-grid', id: (el as { id?: string }).id || undefined },
    });
  }

  const { as: adapt, deliver, into } = options;
  const readonly = options.readonly ?? false;
  const steers = readonly ? options.steers ?? [] : STEERING_EVENTS;
  if (steers.length) steered.add(el as unknown as object);
  const steering: SteerBind = options.scope ? { scope: options.scope } : {};
  const listeners: Array<[string, EventListener]> = [];
  const ignored = new Set(options.ignore ?? []);
  for (const type of steers) {
    // TRAP T-ignore-is-the-scalpel — no listener at all, not an early return.
    if (ignored.has(type)) continue;
    const handler = ((event: Event) => {
      /* A control bound INSIDE this one — a panel's section bar — steers through
         its own binding: heard here too, it was asked twice. TODO 512
         TRAP T-a-nested-control-steers-through-its-own-binding */
      const origin = event.composedPath()[0];
      if (origin !== el && steered.has(origin as object)) return;
      steer(source, el, steering, type, event as CustomEvent);
    }) as EventListener;
    el.addEventListener(type, handler);
    listeners.push([type, handler]);
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
    view: (view) => writeView(el, view, options.scope, slotOf(source, options.scope)),
    rows: (rows) => {
      // populate() waits for the first render itself, so a component bound
      // before it upgraded still gets its rows.
      const payload = adapt ? adapt(rows as Row[], source) : rows;
      // Through the callback it ASKED with, when a provider bound it.
      const give = deliver ?? ((p: unknown): void => { void el.populate?.(p); });
      give(into ? mergeInto(el, into, payload) : payload);
      el.drawHighlight?.(source.highlightFor(options.scope, el));
    },
    pending: (fields, dirty, waits, failed, applied) => {
      // What is applied first, so the flags that follow are read against it. TODO 424
      el.drawApplied?.(applied);
      setAttr(el, 'data-pending', fields.length ? fields.join(' ') : undefined);
      setAttr(el, 'data-dirty', dirty ? '' : undefined);
      // Its scope waits for ONE Apply, local too. TODO 406
      setAttr(el, 'data-waits', waits ? '' : undefined);
      // The fields whose own read failed: a system error, not 0 matches. TODO 411
      setAttr(el, 'data-failed', failed.length ? failed.join(' ') : undefined);
    },
    off: () => {
      for (const [type, handler] of listeners) el.removeEventListener(type, handler);
      steered.delete(el as unknown as object);
      // UNLOCKED on the way out, or a component that outlives its source is mute.
      el.removeAttribute('data-locked');
      el.removeAttribute('data-remote');
      el.removeAttribute('data-apply-on');
      el.removeAttribute('data-waits');
      el.removeAttribute('data-failed');
    },
  });
  return () => source.unbind(el);
}

/** The view as attributes, so CSS can select on it. TRAP T-push-writes-state-as-attributes */
function writeView(el: Element, view: BoundView, scope?: string | readonly string[], slot?: Presentation): void {
  // A control over another scope is not told its arrangement. TODO 523 S6 · TRAP T-group-and-sort-are-component-scope
  const mine = typeof scope !== 'string' || !view.arrangedIn || scope === view.arrangedIn;
  // A SLOT's are its chart's: a sort by each segment's value. Will, TODO 548
  const sort = slot ? (slot.sort ? SLOT_SORT : undefined) : mine ? view.sortField : undefined;
  setAttr(el, 'data-sort-field', sort);
  setAttr(el, 'data-sort-direction', slot ? slot.sort : mine ? view.sortDirection : undefined);
  setAttr(el, 'data-group-field', slot ? slot.group : mine ? view.groupField : undefined);
  setAttr(el, 'data-filter-fields', view.filterFields.length ? view.filterFields.join(' ') : undefined);
  setAttr(el, 'data-needles', view.needles || undefined);
  setAttr(el, 'data-page', view.paging ? String(view.paging.page) : undefined);
  setAttr(el, 'data-total-pages', view.paging ? String(view.paging.totalPages) : undefined);
  setAttr(el, 'data-page-size', view.paging ? String(view.paging.pageSize) : undefined);
}

/** What a slot's chart sorts by: each segment's value. TODO 548 */
const SLOT_SORT = 'value';

/** A slot's kept presentation, where `scope` is one. TODO 548 */
function slotOf(source: DataSource, scope: string | readonly string[] | undefined): Presentation | undefined {
  return typeof scope === 'string' && source.presents(scope) ? source.query.presented(scope, 'chart') : undefined;
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

/** The controls bound to steer, each heard by its OWN binding only. */
const steered = new WeakSet<object>();

/** Every bar answers a scope: one bound with none has nowhere to put it. */
function reportUnscoped(el: Populatable): void {
  report({
    code: 'bar-without-scope',
    message: 'bindSource: a bar reported its filters, but it was bound with no scope, so they are not applied.',
    at: { tag: (el as { localName?: string }).localName ?? '', id: (el as { id?: string }).id ?? '' },
  });
}

/** Does every part of a request name its own scope? */
function hasScope(request: QueryRequest): boolean {
  return Array.isArray(request) ? request.every(hasScope) : typeof (request as { scope?: unknown }).scope === 'string';
}

/** A control's request, to its context's doors; a list is one change. With
 *  `commit`, its Apply: the one field it named, else its scope. 366 step 18 */
export function ask(query: QueryContext, request: QueryRequest, scope: string): void {
  if (Array.isArray(request)) {
    query.batch(() => { for (const one of request as readonly QueryRequest[]) ask(query, one, scope); });
    return;
  }
  const one = request as Exclude<QueryRequest, readonly QueryRequest[]>;
  const at = one.scope ?? scope;
  if ('reset' in one) query.reset([at], one.reset);
  else if ('preview' in one) query.preview(at, one.field, one.preview, one.value);
  else if ('order' in one) query.order(at, one.order);
  else if ('preset' in one) query.setPreset(at, one.preset, one.on, !!one.commit);
  else if ('reading' in one) query.setReading(at, one.field, one.reading);
  else if ('presentation' in one) query.present(at, one.presentation);
  else query.suspend(at, 'field' in one ? one.field : null, one.suspended);
  if ('commit' in one && one.commit) query.commit('field' in one ? { field: one.field } : { scope: at });
}

/** Turn one component's event into its source's call. TRAP T-steering-events-are-a-closed-list */
export function steer(source: DataSource, el: Populatable, bind: SteerBind | undefined, type: SteeringEvent, event: CustomEvent): void {
  const detail = (event.detail ?? {}) as Record<string, unknown>;

  switch (type) {
    case 'sort-change': {
      const at = arranger(detail, bind);
      /* A SLOT: its sort is its chart's order, kept as its presentation, never the
         rows'; off or forgotten, none. Will, TODO 548 */
      if (at && source.presents(at)) {
        const on = typeof detail['field'] === 'string' && detail['field'] && detail['clear'] !== true;
        source.query.present(at, { sort: on ? (detail['direction'] === 'desc' ? 'desc' : 'asc') : undefined });
        return;
      }
      // None: no sort at all, not one kept to resume. TODO 407
      if (detail['clear'] === true) {
        source.query.clearSort(arranger(detail, bind));
        return;
      }
      const field = detail['field'];
      const direction = detail['direction'] === 'desc' ? 'desc' : 'asc';
      source.query.setSort(typeof field === 'string' ? field : null, direction, arranger(detail, bind));
      return;
    }
    case 'group-change': {
      const field = typeof detail['field'] === 'string' && detail['field'] ? detail['field'] : null;
      const at = arranger(detail, bind);
      // A SLOT's group is its chart's parts. Will, TODO 548
      if (at && source.presents(at)) source.query.present(at, { group: field ?? undefined });
      else source.query.setGroup(field, at);
      return;
    }
    case 'quick-filter-change': {
      /* ONE READER ACT, AS A REQUEST: it goes to the Query's doors, in the
         request's scope or the bind's. An event with none asks nothing.
         TRAP T-a-control-sends-one-request */
      const request = detail['request'] as QueryRequest | undefined;
      if (!request) return;
      const at = typeof bind?.scope === 'string' ? bind.scope : undefined;
      if (at || hasScope(request)) ask(source.query, request, at ?? VIEW);
      else reportUnscoped(el);
      return;
    }
    case 'filter-add':
    case 'filter-remove': {
      const scope = bind?.scope;
      const named = typeof detail['scope'] === 'string' ? detail['scope'] : undefined;
      /* ONE CHANGE, ASKED of the Query, which owns each scope's list: a scope
         TAKES fields — a bar's Add, the panel's Filters menu, or sent up or down —
         or LETS ONE GO. Will, TODO 415 (D2 A).
         TRAP T-send-to-view-filters · TRAP T-a-panel-asks-for-its-scopes */
      if (named && type === 'filter-add' && Array.isArray(detail['ids'])) {
        const from = detail['from'];
        source.query.take(named, (detail['ids'] as unknown[]).map(String), typeof from === 'string' ? from : undefined);
        return;
      }
      if (named && type === 'filter-remove' && typeof detail['id'] === 'string') {
        source.query.release(named, detail['id']);
        return;
      }
      // A control that says its WHOLE list instead — a host's own bar. TRAP T-a-bar-reports-its-holds
      const holds = detail['holds'];
      if (typeof scope === 'string' && Array.isArray(holds)) source.query.hold(scope, holds.map(String));
      return;
    }
    case 'column-filter-change': {
      /* A HEADING's answer is its field's, in its grid's scope — and a field
         no scope holds yet gets its normal chip on that scope's bar.
         TRAP T-one-query-one-owner · TRAP T-a-heading-asks-through-the-source */
      const scope = bind?.scope;
      const field = detail['field'];
      if (typeof field !== 'string') return;
      const reading = (detail['reading'] ?? null) as FieldReading | null;
      // A grid in no scope has no place for it in the Query: it is drawn back as it asked. 366 step 23
      if (typeof scope !== 'string') {
        el.drawReading?.(field, reading ?? {}, '');
        return;
      }
      source.query.setReading(scope, field, reading);
      // A heading's Apply is its field's. TRAP T-apply-and-discard-wait-for-a-change
      source.query.commit({ field });
      return;
    }
    case 'filter-apply':
    case 'filter-discard': {
      // One field's own Apply or Discard, on a remote source — or, naming none, all of them.
      // TRAP T-apply-and-discard-wait-for-a-change
      const field = detail['field'];
      const at = typeof field === 'string' ? { field } : {};
      if (type === 'filter-apply') source.query.commit(at);
      else source.query.discard(at);
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
      source.query.setSearch(typeof term === 'string' ? term : '', arranger(detail, bind));
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
