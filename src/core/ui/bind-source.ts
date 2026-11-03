/**
 * bind-source.ts — the join between a component and its source: the events it
 * sends UP, and the rows and `data-*` that come DOWN. The data layer names no
 * component event and writes no attribute. TODO 196
 * TRAP T-steering-events-are-a-closed-list
 *
 * Map:
 * - BindOptions — What a component may do with the source it is bound to.
 * - bindId — A control's bind id: what a part, a component's own default and a command's `only` name it by.
 * - bindSource — Point a component at a source: rows and `data-*` down, steering events back.
 * - SteeringEvent — One of them.
 * - SteerBind — What steering needs of one binding: its scope, and where a hover goes.
 */
import { report } from '../data/report.js';
import type { AttachFacts, BoundView, DataSource } from '../data/data-source.js';
import type { FieldReading } from '../data/filter-state.js';
import { VIEW, type Presentation, type QueryRequest } from '../data/query.js';
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
  /** Where a bar's rest on a chip, or one value of it, GOES: a hover lights its
   *  matches, and is the page's, never the Query's. Will, TODO 655 */
  hover?: (hovered: { scope: string; field: string; on: boolean; value?: string }) => void;
}

/** Each control's bind id: the data layer names a component by it, never by the element. */
const ids = new WeakMap<object, string>();
/** Bind ids made for controls with no `id` of their own. */
let minted = 0;

/** A control's bind id — what a part, a component's own default and a command's
 *  `only` name it by: the one it was bound with, else its own `id`, else one made
 *  for it. The same while it lives, bound or not. */
export function bindId(el: object): string {
  let id = ids.get(el);
  if (id === undefined) {
    const own = (el as { id?: unknown }).id;
    ids.set(el, (id = typeof own === 'string' && own ? own : `bind-${++minted}`));
  }
  return id;
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
  const steering: SteerBind = { ...(options.scope ? { scope: options.scope } : {}), ...(options.hover ? { hover: options.hover } : {}) };
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
  // Its bind id, kept here: the source names it by that alone.
  const id = options.id ?? bindId(el);
  ids.set(el, id);
  options.signal?.addEventListener('abort', () => source.unbind(el), { once: true });

  source.attach(el, { ...options, id }, {
    view: (view) => writeView(el, view, options.scope, slotOf(source, options.scope)),
    rows: (rows) => {
      // populate() waits for the first render itself, so a component bound
      // before it upgraded still gets its rows.
      const payload = adapt ? adapt(rows as Row[], source) : rows;
      // Through the callback it ASKED with, when a provider bound it.
      const give = deliver ?? ((p: unknown): void => { void el.populate?.(p); });
      give(into ? mergeInto(el, into, payload) : payload);
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
  // A SLOT draws every row it counts: a grid made from its chart has no pager to step.
  const paging = slot ? undefined : view.paging;
  setAttr(el, 'data-page', paging ? String(paging.page) : undefined);
  setAttr(el, 'data-total-pages', paging ? String(paging.totalPages) : undefined);
  setAttr(el, 'data-page-size', paging ? String(paging.pageSize) : undefined);
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

/** What a steering event knows of its binding: its scope, its source, its control, the event itself. */
interface Steering {
  detail: Record<string, unknown>;
  /** The scope it names, else the one its binding names. TODO 99 */
  scope: string | undefined;
  bind: SteerBind | undefined;
  source: DataSource;
  el: Populatable;
  event: CustomEvent;
}

/**
 * THE ONE TABLE: each event a bound component may send UP, and the command it
 * asks the Query (`QueryContext.ask`). Two are no edit — a report and a read — and
 * say so. The event names are the components' own, public; only this map moves.
 * TRAP T-steering-events-are-a-closed-list · TRAP T-one-command-one-door
 */
const STEERS = {
  // In a slot, the Query makes it its chart's order. TODO 548. None: no sort at all, not one kept. TODO 407
  'sort-change': ({ detail, scope }) => (detail['clear'] === true
    ? { ...at(scope), sort: null, clear: true }
    : { ...at(scope), sort: text(detail['field']) || null, direction: detail['direction'] === 'desc' ? 'desc' : 'asc' }),
  'group-change': ({ detail, scope }) => ({ ...at(scope), group: text(detail['field']) || null }),
  /* ONE READER ACT, AS A REQUEST, in its own scope or the bind's. An event with none
     asks nothing; a hover goes to the page. TRAP T-a-control-sends-one-request */
  'quick-filter-change': ({ detail, bind, el }) => {
    const request = detail['request'] as QueryRequest | undefined;
    if (!request) return undefined;
    const bound = typeof bind?.scope === 'string' ? bind.scope : undefined;
    // TODO 655 · TRAP T-a-hovered-chip-previews-the-highlight
    if (!Array.isArray(request) && 'preview' in request) {
      const scope = request.scope ?? bound;
      if (scope) bind?.hover?.({ scope, field: request.field, on: request.preview, ...(request.value != null ? { value: request.value } : {}) });
      return undefined;
    }
    if (bound || hasScope(request)) return scoped(request, bound ?? VIEW);
    reportUnscoped(el);
    return undefined;
  },
  /* What a scope HOLDS, ASKED of the Query, which owns each scope's list: it TAKES
     fields — a bar's Add, the panel's Filters menu, sent up or down — or LETS ONE GO;
     a host's own bar says its whole list. Will, TODO 415 (D2 A).
     TRAP T-send-to-view-filters · TRAP T-a-panel-asks-for-its-scopes · TRAP T-a-bar-reports-its-holds */
  'filter-add': ({ detail, bind }) => {
    const named = text(detail['scope']);
    const from = text(detail['from']);
    if (!named || !Array.isArray(detail['ids'])) return holds(detail, bind);
    return { scope: named, take: (detail['ids'] as unknown[]).map(String), ...(from ? { from } : {}) };
  },
  'filter-remove': ({ detail, bind }) => {
    const named = text(detail['scope']);
    return named && typeof detail['id'] === 'string' ? { scope: named, release: detail['id'] } : holds(detail, bind);
  },
  /* A HEADING's answer is its field's, in its grid's scope, and its Apply. A grid in
     no scope has no place in the Query: it is drawn back as it asked. 366 step 23
     TRAP T-one-query-one-owner · TRAP T-a-heading-asks-through-the-source */
  'column-filter-change': ({ detail, bind, el }) => {
    const field = detail['field'];
    if (typeof field !== 'string') return undefined;
    const reading = (detail['reading'] ?? null) as FieldReading | null;
    if (typeof bind?.scope !== 'string') {
      el.drawReading?.(field, reading ?? {}, '');
      return undefined;
    }
    return { scope: bind.scope, field, reading, commit: true };
  },
  // One field's own Apply or Discard — or, naming none, all of them. TRAP T-apply-and-discard-wait-for-a-change
  'filter-apply': ({ detail }) => ({ ...field(detail), commit: true }),
  'filter-discard': ({ detail }) => ({ ...field(detail), discard: true }),
  'page-change': ({ detail, bind }) => (typeof detail['page'] === 'number' ? { ...at(own(bind)), page: detail['page'] } : undefined),
  'page-size-change': ({ detail, bind }) => (typeof detail['pageSize'] === 'number' ? { ...at(own(bind)), pageSize: detail['pageSize'] } : undefined),
  'search-change': ({ detail, scope }) => ({ ...at(scope), search: text(detail['value']) ?? '' }),
  /* A REPORT, not an edit: what the pager draws, never the Query. The rows in hand are
     every matching row already. TRAP T-grouped-paging-belongs-to-the-view */
  'grid-pages-change': ({ detail, source }) => {
    const pages = detail['pages'];
    if (typeof pages === 'number' && Number.isFinite(pages)) source.reportPages(pages);
    return undefined;
  },
  /* A READ, not an edit: "Select all rows" on a paged grid, every matching row answered
     back. TODO 238 · TRAP T-select-all-is-the-visible-rows */
  'select-all-request': ({ detail, source, el, event }) => {
    const answer = detail['answer'];
    if (typeof answer !== 'function') return undefined;
    event.preventDefault();
    void source.allRows(bindId(el)).then((rows) => (answer as (rows: readonly Row[]) => void)(rows));
    return undefined;
  },
} satisfies Record<string, (steering: Steering) => QueryRequest | undefined>;

/** The events a bound component may send UP. TRAP T-steering-events-are-a-closed-list */
const STEERING_EVENTS = Object.keys(STEERS) as SteeringEvent[];

/** One of them. */
export type SteeringEvent = keyof typeof STEERS;

/** What steering needs of one binding: its scope. */
export interface SteerBind {
  scope?: string | readonly string[];
  hover?: BindOptions['hover'];
}

/** A string, or nothing. */
function text(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

/** A scope, where there is one to say. */
function at(scope: string | undefined): { scope?: string } {
  return scope ? { scope } : {};
}

/** The one field an event names, where it names one. */
function field(detail: Record<string, unknown>): { field?: string } {
  const named = text(detail['field']);
  return named ? { field: named } : {};
}

/** The binding's own scope, when it names one. */
function own(bind: SteerBind | undefined): string | undefined {
  return typeof bind?.scope === 'string' ? bind.scope : undefined;
}

/** A control that says its WHOLE list instead — a host's own bar. TRAP T-a-bar-reports-its-holds */
function holds(detail: Record<string, unknown>, bind: SteerBind | undefined): QueryRequest | undefined {
  const scope = own(bind);
  return scope && Array.isArray(detail['holds']) ? { scope, hold: (detail['holds'] as unknown[]).map(String) } : undefined;
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

/** A request whose parts name no scope, in the bind's. */
function scoped(request: QueryRequest, scope: string): QueryRequest {
  if (Array.isArray(request)) return (request as readonly QueryRequest[]).map((one) => scoped(one, scope));
  return (request as { scope?: string }).scope ? request : { ...request, scope } as QueryRequest;
}

/** Turn one component's event into the command it asks. TRAP T-steering-events-are-a-closed-list */
function steer(source: DataSource, el: Populatable, bind: SteerBind | undefined, type: SteeringEvent, event: CustomEvent): void {
  const detail = (event.detail ?? {}) as Record<string, unknown>;
  const scope = text(detail['scope']) ?? own(bind);
  const command = (STEERS[type] as (steering: Steering) => QueryRequest | undefined)({ detail, scope, bind, source, el, event });
  if (command) source.query.ask(command);
}
