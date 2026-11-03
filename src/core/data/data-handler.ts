/**
 * data-handler.ts — the data layer over HTTP: one `handle()` that answers a store's
 * reads and writes, for any host — the page itself, a Service Worker, a server.
 * DOM-free. Plan 652 · TRAP T-a-data-request-is-the-store-interface
 *
 * Map:
 * - DATA_QUERY_TYPE — The media type of a Sherpa data query, sent with `QUERY`.
 * - DATA_VERSION — The protocol's version, in the `Sherpa-Data` header.
 * - STALE — The header that says an answer's rows are unconfirmed, and why.
 * - DATA_CHANNEL — The channel a host that notifies says each store's change on, to every tab.
 * - DataQuery — A store read as JSON: what `load` or `totalCount` is asked.
 * - StoreFacts — What a store says of itself, as JSON.
 * - DataHandlerOptions — The stores it answers for, by name, and the path they sit under.
 * - DataHandler — Answer one request, or null where it is not the data layer's.
 * - encodeQuery — A store read as the body a `QUERY` sends.
 * - decodeQuery — A `QUERY` body as a store read, or why it is not one.
 * - keySegment — A row's key as the last part of its URL: JSON, so `5` and `"5"` stay apart.
 * - createDataHandler — The handler for a set of stores.
 */
import { failureOf } from './failure.js';
import { OP_LABELS, type Filter, type LoadOptions, type Row, type SortSpec, type Store } from './store.js';

/** The media type of a Sherpa data query, sent with `QUERY`. */
export const DATA_QUERY_TYPE = 'application/vnd.sherpa.query+json';

/** The protocol's version, in the `Sherpa-Data` header. */
export const DATA_VERSION = 1;

/** The header that says an answer's rows are unconfirmed, and why: a `Failure`, as
 *  JSON, URI-encoded. */
export const STALE = 'Sherpa-Stale';

/** The `BroadcastChannel` a host that `notifies` says each store's change on, to
 *  every tab: `{ store, change }`. S6 */
export const DATA_CHANNEL = 'sherpa-data';

/** A store read as JSON: what `load` or `totalCount` is asked. `now` is an ISO
 *  time; `total` asks for the count alone. */
export interface DataQuery {
  v: number;
  filter?: Filter;
  sort?: SortSpec[];
  group?: string;
  search?: string;
  searchFields?: string[];
  now?: string;
  skip?: number;
  take?: number;
  fields?: string[];
  total?: boolean;
}

/** What a store says of itself, as JSON. */
export type StoreFacts = Pick<Store, 'key' | 'time' | 'remote' | 'projects' | 'reportsTotal' | 'totalFirst'
  | 'sampled' | 'rowOrder' | 'announcesAll' | 'domains' | 'holds'> & {
  changes: boolean;
  /** Its host says every change on `DATA_CHANNEL`, so a reader hears another tab's. */
  notifies?: boolean;
};

/** The stores it answers for, by name, and the path they sit under. */
export interface DataHandlerOptions {
  stores: Readonly<Record<string, Store>>;
  /** Default `/sherpa/data/`. */
  base?: string;
  /** Its host says each store's change on `DATA_CHANNEL`: a Service Worker. S6 */
  notifies?: boolean;
}

/** Answer one request, or null where it is not the data layer's: its host passes it on. */
export type DataHandler = (request: Request) => Promise<Response | null>;

/** A store read as the body a `QUERY` sends. */
export function encodeQuery(options: LoadOptions = {}, total = false): DataQuery {
  const { now, fields, ...rest } = options;
  return {
    v: DATA_VERSION,
    ...rest,
    ...(now ? { now: now.toISOString() } : {}),
    ...(fields ? { fields: [...fields] } : {}),
    ...(total ? { total: true } : {}),
  };
}

/** A `QUERY` body as a store read, or why it is not one. */
export function decodeQuery(body: unknown): { options: LoadOptions; total: boolean } | { problem: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { problem: 'the body is not an object' };
  const q = body as Record<string, unknown>;
  if (q['v'] !== DATA_VERSION) return { problem: `version ${String(q['v'])}, not ${DATA_VERSION}` };
  const options: LoadOptions = {};
  if (q['filter'] !== undefined) {
    if (!isFilter(q['filter'])) return { problem: 'the filter is not a filter' };
    options.filter = q['filter'];
  }
  if (q['sort'] !== undefined) {
    const sort = q['sort'];
    if (!Array.isArray(sort) || !sort.every((s) => typeof s?.field === 'string' && (s.direction === undefined || s.direction === 'asc' || s.direction === 'desc'))) {
      return { problem: 'the sort is not a list of { field, direction }' };
    }
    options.sort = sort as SortSpec[];
  }
  for (const name of ['group', 'search'] as const) {
    const value = q[name];
    if (value === undefined) continue;
    if (typeof value !== 'string') return { problem: `${name} is not text` };
    options[name] = value;
  }
  for (const name of ['searchFields', 'fields'] as const) {
    const value = q[name];
    if (value === undefined) continue;
    if (!Array.isArray(value) || !value.every((f) => typeof f === 'string')) return { problem: `${name} is not a list of fields` };
    options[name] = [...value as string[]];
  }
  for (const name of ['skip', 'take'] as const) {
    const value = q[name];
    if (value === undefined) continue;
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) return { problem: `${name} is not a whole number` };
    options[name] = value;
  }
  if (q['now'] !== undefined) {
    const now = typeof q['now'] === 'string' ? new Date(q['now']) : null;
    if (!now || Number.isNaN(now.getTime())) return { problem: 'now is not a time' };
    options.now = now;
  }
  return { options, total: q['total'] === true };
}

/** Is this a filter: a clause `[field, op, value]`, or `['and' | 'or', ...filters]`? */
function isFilter(value: unknown): value is Filter {
  if (!Array.isArray(value) || typeof value[0] !== 'string') return false;
  if (value[0] === 'and' || value[0] === 'or') return value.slice(1).every(isFilter);
  return value.length === 3 && typeof value[1] === 'string' && value[1] in OP_LABELS;
}

/** A row's key as the last part of its URL: JSON, so `5` and `"5"` stay apart. */
export function keySegment(key: unknown): string {
  return encodeURIComponent(JSON.stringify(key));
}

/** A key read back from its URL: JSON, or the text as typed. */
function keyFrom(segment: string): unknown {
  const text = decodeURIComponent(segment);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** What each route of a store allows. */
const ON_STORE = 'QUERY, GET, POST, OPTIONS';
const ON_ROW = 'GET, PATCH, DELETE, OPTIONS';

/** The handler for a set of stores. */
export function createDataHandler(options: DataHandlerOptions): DataHandler {
  const base = options.base ?? '/sherpa/data/';
  return async (request) => {
    const url = new URL(request.url);
    if (!url.pathname.startsWith(base)) return null;
    const [name, key, ...more] = url.pathname.slice(base.length).split('/');
    // Every store read again behind its held set: a feed's gap. Plan 687 U3 · TRAP T-news-is-pushed-by-the-server
    if (!name && !more.length && request.method === 'GET' && url.searchParams.has('recheck')) {
      await Promise.all(Object.values(options.stores).map((each) => each.recheck?.()));
      return answer(204, null);
    }
    const store = name ? options.stores[decodeURIComponent(name)] : undefined;
    if (!store || more.length) return problem(404, 'invalid', `no store at ${url.pathname}`);
    const asked = request.headers.get('Sherpa-Data');
    if (asked && Number(asked) !== DATA_VERSION) return problem(400, 'invalid', `version ${asked}, not ${DATA_VERSION}`);
    const allow = key === undefined || key === '' ? ON_STORE : ON_ROW;
    if (request.method === 'OPTIONS') return answer(204, null, { Allow: allow, 'Accept-Query': DATA_QUERY_TYPE });
    if (!allow.split(', ').includes(request.method)) return problem(405, 'invalid', `${request.method} is not allowed here`, { Allow: allow });
    try {
      const response = allow === ON_ROW ? await onRow(store, keyFrom(key!), request) : await onStore(store, url, request, !!options.notifies);
      // Old rows answer while the source cannot be reached: the reader says so. S5b
      if (store.stale) response.headers.set(STALE, encodeURIComponent(JSON.stringify(store.stale)));
      return response;
    } catch (error) {
      const failure = failureOf(error);
      // A refused write says which fields, as the store's own error does. Plan 652 S2
      const issues = (error as { issues?: unknown }).issues;
      return problem(failure.status ?? (failure.kind === 'invalid' ? 422 : 500), failure.kind, failure.message, {}, Array.isArray(issues) ? { issues } : {});
    }
  };
}

/** A read of the store, its facts, its changes, or a new row. */
async function onStore(store: Store, url: URL, request: Request, notifies: boolean): Promise<Response> {
  if (request.method === 'GET') {
    // Read the source again, behind the set it holds. S5b
    if (url.searchParams.has('recheck')) {
      await store.recheck?.();
      return answer(204, null);
    }
    // Take in the newer rows that wait. S6c
    if (url.searchParams.has('take')) return answer(200, { took: (await store.take?.()) ?? false });
    const since = url.searchParams.get('since');
    if (since === null) return answer(200, { ...factsOf(store), ...(notifies ? { notifies: true } : {}) });
    if (!store.changes) return problem(404, 'invalid', 'this store says nothing of its changes');
    return answer(200, await store.changes(since === '' ? undefined : JSON.parse(since)));
  }
  const body = await read(request);
  if ('problem' in body) return body.problem;
  /* A POST of a query IS a query: the fallback where a proxy refuses QUERY, with
     the same body. Any other POST adds a row. Will, 2026-11-02 */
  const isQuery = (request.headers.get('Content-Type') ?? '').startsWith(DATA_QUERY_TYPE);
  if (request.method === 'POST' && !isQuery) return answer(201, await store.insert(body.value as Row));
  if (!isQuery) {
    return problem(415, 'invalid', `a QUERY is ${DATA_QUERY_TYPE}`, { 'Accept-Query': DATA_QUERY_TYPE });
  }
  const read_ = decodeQuery(body.value);
  if ('problem' in read_) return problem(422, 'invalid', read_.problem);
  if (read_.total) return answer(200, { total: await store.totalCount(read_.options) });
  return answer(200, await store.load(read_.options));
}

/** One row: read, changed, or gone. */
async function onRow(store: Store, key: unknown, request: Request): Promise<Response> {
  if (request.method === 'GET') {
    const row = await store.byKey(key);
    return row ? answer(200, row) : problem(404, 'invalid', `no row ${JSON.stringify(key)}`);
  }
  if (request.method === 'DELETE') {
    await store.remove(key);
    return answer(204, null);
  }
  const body = await read(request);
  if ('problem' in body) return body.problem;
  return answer(200, await store.update(key, body.value as Row));
}

/** The facts a store may say of itself, beside its key. */
const FACTS = ['time', 'remote', 'projects', 'reportsTotal', 'totalFirst', 'sampled', 'rowOrder', 'announcesAll', 'domains', 'holds'] as const;

/** What a store says of itself: what it does not say is left out. */
function factsOf(store: Store): StoreFacts {
  const facts: Record<string, unknown> = { key: store.key, changes: typeof store.changes === 'function' };
  for (const name of FACTS) if (store[name] !== undefined) facts[name] = store[name];
  return facts as StoreFacts;
}

/** A request's JSON body, or the answer that says it is not JSON. */
async function read(request: Request): Promise<{ value: unknown } | { problem: Response }> {
  try {
    return { value: await request.json() };
  } catch {
    return { problem: problem(400, 'invalid', 'the body is not JSON') };
  }
}

/** A JSON answer. A 204 has no body. */
function answer(status: number, value: unknown, headers: Record<string, string> = {}): Response {
  const head = { 'Sherpa-Data': String(DATA_VERSION), ...headers };
  if (status === 204) return new Response(null, { status, headers: head });
  return new Response(JSON.stringify(value), { status, headers: { ...head, 'Content-Type': 'application/json' } });
}

/** An answer that says what went wrong, as a `Failure`'s kind and message — and
 *  a refused write's `issues`, by field. */
function problem(status: number, kind: string, message: string, headers: Record<string, string> = {}, more: Record<string, unknown> = {}): Response {
  return answer(status, { error: { kind, message, ...more } }, headers);
}
