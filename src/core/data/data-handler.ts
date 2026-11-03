/**
 * data-handler.ts — the data layer over HTTP: one `handle()` that answers a store's
 * reads and writes, for any host — the page itself, a Service Worker, a server.
 * DOM-free. Plan 652 · TRAP T-a-data-request-is-the-store-interface
 *
 * Map:
 * - DATA_BASE — The path every store sits under, for every host and every asker.
 * - DATA_QUERY_TYPE — The media type of a Sherpa data query, sent with `QUERY`.
 * - DATA_VERSION — The protocol's version, in the `Sherpa-Data` header.
 * - STALE — The header that says an answer's rows are unconfirmed, and why.
 * - DATA_CHANNEL — The channel a host that notifies says each store's change on, to every tab.
 * - DataQuery — A store read as JSON: what `load` or `totalCount` is asked.
 * - StoreFacts — What a store says of itself, as JSON.
 * - DataHandlerOptions — The stores it answers for, and the path they sit under.
 * - DataHandler — Answer one request, or null where it is not the data layer's.
 * - encodeQuery — A store read as the body a `QUERY` sends.
 * - decodeQuery — A `QUERY` body as a store read, or why it is not one.
 * - keySegment — A row's key as the last part of its URL: JSON, so `5` and `"5"` stay apart.
 * - writeHeaders — A write's time as the `If-Unmodified-Since` it is sent with.
 * - createDataHandler — The handler for a set of stores.
 */
import type { DefinedStore, StoreSet } from './define-stores.js';
import { failureOf } from './failure.js';
import { sayNotice } from './notices.js';
import { OP_LABELS, distinctOf, matchesOnly, type Filter, type LoadOptions, type Row, type SortSpec, type Store, type WriteOptions } from './store.js';
import { readTraceparent, startSpan, within, type TraceContext, type TraceHost } from './trace.js';

/** The path every store sits under, for every host and every asker. */
export const DATA_BASE = '/sherpa/data/';

/** The media type of a Sherpa data query, sent with `QUERY`. */
export const DATA_QUERY_TYPE = 'application/vnd.sherpa.query+json';

/** The protocol's version, in the `Sherpa-Data` header. */
export const DATA_VERSION = 1;

/** The header that says an answer's rows are unconfirmed, and why: a `Failure`, as
 *  JSON, URI-encoded. */
export const STALE = 'Sherpa-Stale';

/** The `BroadcastChannel` a host that `notifies` says each store's change on, to
 *  every tab: `{ store, as, change }`. S6 */
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
  /** Asks each of these fields' values among the matches, not the rows. */
  distinct?: string[];
}

/** What a store says of itself, as JSON: its capabilities whole, and the reads it answers. */
export type StoreFacts = Pick<Store, 'key' | 'time' | 'domains' | 'capabilities'> & {
  changes: boolean;
  /** It answers a field's values among the matches (`distinct`). */
  distinct?: boolean;
  /** It keeps a History, by field. TRAP T-a-store-keeps-its-history */
  history?: boolean;
  /** The app's word for the store the request picked, where its name has several. */
  as?: string;
  /** Its host says every change on `DATA_CHANNEL`, so a reader hears another tab's. */
  notifies?: boolean;
};

/** The stores it answers for, and the path they sit under. */
export interface DataHandlerOptions {
  /** The app's stores: each request is answered by the one its pick names. TRAP T-a-request-picks-its-stores */
  stores: StoreSet;
  /** Default `DATA_BASE`. */
  base?: string;
  /** Its host says each store's change on `DATA_CHANNEL`: a Service Worker. S6 */
  notifies?: boolean;
  /** Who answers, as its spans say. Default `page`. TRAP T-one-trace-stream */
  host?: TraceHost;
}

/** Answer one request, or null where it is not the data layer's: its host passes it on. */
export type DataHandler = (request: Request) => Promise<Response | null>;

/** A store read as the body a `QUERY` sends. */
export function encodeQuery(options: LoadOptions = {}, total = false): DataQuery {
  // A signal stops the request; it is never part of the question.
  const { now, fields, signal: _signal, ...rest } = options;
  return {
    v: DATA_VERSION,
    ...rest,
    ...(now ? { now: now.toISOString() } : {}),
    ...(fields ? { fields: [...fields] } : {}),
    ...(total ? { total: true } : {}),
  };
}

/** A `QUERY` body as a store read, or why it is not one. */
export function decodeQuery(body: unknown): { options: LoadOptions; total: boolean; distinct?: string[] } | { problem: string } {
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
  const lists: Partial<Record<'searchFields' | 'fields' | 'distinct', string[]>> = {};
  for (const name of ['searchFields', 'fields', 'distinct'] as const) {
    const value = q[name];
    if (value === undefined) continue;
    if (!Array.isArray(value) || !value.every((f) => typeof f === 'string')) return { problem: `${name} is not a list of fields` };
    lists[name] = [...value as string[]];
  }
  const { distinct, ...fieldLists } = lists;
  Object.assign(options, fieldLists);
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
  return { options, total: q['total'] === true, ...(distinct ? { distinct } : {}) };
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

/** A write's time as the `If-Unmodified-Since` it is sent with: a host refuses the
 *  write, 412, where the row changed after. TRAP T-a-newer-write-wins */
export function writeHeaders(options?: WriteOptions): Record<string, string> {
  return options?.unmodifiedSince ? { 'If-Unmodified-Since': new Date(options.unmodifiedSince).toUTCString() } : {};
}

/** A request's `If-Unmodified-Since` as a write's options. An HTTP date has whole
 *  seconds, so a change refuses the write only from the next second, as HTTP says. */
function writeOptionsOf(request: Request): WriteOptions {
  const at = Date.parse(request.headers.get('If-Unmodified-Since') ?? '');
  return Number.isNaN(at) ? {} : { unmodifiedSince: at + 999 };
}

/** The handler for a set of stores. Each answer is a span; one asked for by its
 *  `traceparent` joins the asker's trace, and echoes it. A host that `notifies`
 *  says each store's change, and its newer rows waiting, to every tab.
 *  TRAP T-one-trace-stream · TRAP T-a-request-picks-its-stores */
export function createDataHandler(options: DataHandlerOptions): DataHandler {
  const base = options.base ?? DATA_BASE;
  const host = options.host ?? 'page';
  if (options.notifies) sayChanges(options.stores.all());
  return async (request) => {
    const url = new URL(request.url);
    if (!url.pathname.startsWith(base)) return null;
    const asker = request.headers.get('traceparent');
    const path = url.pathname.slice(base.length).split('/');
    const span = startSpan('answer', { host, ...(path[0] ? { store: decodeURIComponent(path[0]) } : {}), parent: readTraceparent(asker, host), detail: { method: request.method } });
    const response = await answerOf(request, url, path, options, span);
    span?.end({ status: response.status });
    if (asker && span) response.headers.set('traceparent', asker);
    return response;
  };
}

/** Each store's change, to every tab, as its name and the app's word for it; its
 *  newer rows waiting, as a notice. S6 · TRAP T-every-tab-hears-a-change · TRAP T-a-server-change-waits */
function sayChanges(stores: readonly DefinedStore[]): void {
  const channel = new BroadcastChannel(DATA_CHANNEL);
  // Open as long as its host: in Node, it keeps nothing running.
  (channel as { unref?: () => void }).unref?.();
  for (const { name, as, store } of stores) {
    const said = as === undefined ? { store: name } : { store: name, as };
    store.addEventListener('change', (event) => {
      try {
        channel.postMessage({ ...said, change: (event as CustomEvent).detail });
      } catch {
        // A change that cannot be copied is still news: that something moved.
        channel.postMessage(said);
      }
    });
    store.addEventListener('waiting', (event) => {
      const rows = (event as CustomEvent<{ rows?: number } | undefined>).detail?.rows;
      sayNotice({ kind: 'data', store: name, ...(rows !== undefined ? { rows } : {}) });
    });
  }
}

/** Read each store under a name — with none, every store — again behind its held
 *  set: a feed's word, a push or a gap. Each store checks once at a time. One that
 *  holds none says that newer data waits, where its host notifies.
 *  Plan 687 U3 · TRAP T-news-is-pushed-by-the-server · TRAP T-a-push-is-a-check-behind */
async function recheckAll(stores: StoreSet, name: string | undefined, notifies: boolean): Promise<void> {
  const under = stores.all(name);
  const checks = under.filter(({ store }) => store.recheck);
  await Promise.all(checks.map(({ store }) => store.recheck!()));
  if (notifies && name !== undefined && under.length && !checks.length) sayNotice({ kind: 'data', store: name });
}

/** One request's answer, each store call made under its span. */
async function answerOf(request: Request, url: URL, path: string[], options: DataHandlerOptions, span: TraceContext | null): Promise<Response> {
  const [name, key, ...more] = path;
  const notifies = !!options.notifies;
  // Every store read again behind its held set: a feed's gap. Plan 687 U3
  if (!name && !more.length && request.method === 'GET' && url.searchParams.has('recheck')) {
    await within(span, () => recheckAll(options.stores, undefined, notifies));
    return answer(204, null);
  }
  const named = name ? decodeURIComponent(name) : '';
  // A check behind is the name's, every store under it: what a reader holds, and the rest.
  if (named && !key && !more.length && request.method === 'GET' && url.searchParams.has('recheck') && options.stores.all(named).length) {
    await within(span, () => recheckAll(options.stores, named, notifies));
    return answer(204, null);
  }
  // The app picks which store answers, from the request; Sherpa reads none of it.
  const picked = named ? options.stores.pick(named, request) : undefined;
  if (!picked || more.length) return problem(404, 'invalid', `no store at ${url.pathname}`);
  const { store } = picked;
  const asked = request.headers.get('Sherpa-Data');
  if (asked && Number(asked) !== DATA_VERSION) return problem(400, 'invalid', `version ${asked}, not ${DATA_VERSION}`);
  const allow = key === undefined || key === '' ? ON_STORE : ON_ROW;
  if (request.method === 'OPTIONS') return answer(204, null, { Allow: allow, 'Accept-Query': DATA_QUERY_TYPE });
  if (!allow.split(', ').includes(request.method)) return problem(405, 'invalid', `${request.method} is not allowed here`, { Allow: allow });
  try {
    // The body first: a store call made after an await would begin under no span.
    const body = request.method === 'GET' || request.method === 'DELETE' ? { value: undefined } : await read(request);
    if ('problem' in body) return body.problem;
    const response = await within(span, () => (allow === ON_ROW
      ? onRow(store, keyFrom(key!), request, body.value)
      : onStore(picked, url, request, body.value, notifies)));
    // Old rows answer while the source cannot be reached: the reader says so. S5b
    if (store.stale) response.headers.set(STALE, encodeURIComponent(JSON.stringify(store.stale)));
    return response;
  } catch (error) {
    const failure = failureOf(error);
    // A refused write says which fields, as the store's own error does. Plan 652 S2
    const issues = (error as { issues?: unknown }).issues;
    return problem(failure.status ?? (failure.kind === 'invalid' ? 422 : 500), failure.kind, failure.message, {}, Array.isArray(issues) ? { issues } : {});
  }
}

/** A read of the store, its facts, its changes, or a new row. */
async function onStore({ store, as }: DefinedStore, url: URL, request: Request, body: unknown, notifies: boolean): Promise<Response> {
  if (request.method === 'GET') {
    // Take in the newer rows that wait. S6c
    if (url.searchParams.has('take')) return answer(200, { took: (await store.take?.()) ?? false });
    const since = url.searchParams.get('since');
    if (since === null) return answer(200, { ...factsOf(store), ...(as !== undefined ? { as } : {}), ...(notifies ? { notifies: true } : {}) });
    if (!store.changes) return problem(404, 'invalid', 'this store says nothing of its changes');
    return answer(200, await store.changes(since === '' ? undefined : JSON.parse(since)));
  }
  /* A POST of a query IS a query: the fallback where a proxy refuses QUERY, with
     the same body. Any other POST adds a row. Will, 2026-11-02 */
  const isQuery = (request.headers.get('Content-Type') ?? '').startsWith(DATA_QUERY_TYPE);
  if (request.method === 'POST' && !isQuery) return answer(201, await store.insert(body as Row));
  if (!isQuery) {
    return problem(415, 'invalid', `a QUERY is ${DATA_QUERY_TYPE}`, { 'Accept-Query': DATA_QUERY_TYPE });
  }
  const read_ = decodeQuery(body);
  if ('problem' in read_) return problem(422, 'invalid', read_.problem);
  if (read_.total) return answer(200, { total: await store.totalCount(read_.options) });
  // A field's values, read where the rows are: none of the rows crosses. TRAP T-a-data-request-is-the-store-interface
  if (read_.distinct) {
    const values = store.distinct
      ? await store.distinct(read_.distinct, read_.options)
      : distinctOf((await store.load(matchesOnly(read_.options))).rows, read_.distinct);
    return answer(200, { values });
  }
  return answer(200, await store.load(read_.options));
}

/** One row: read, changed, or gone — a write only where it was not changed after
 *  the time it carries. */
async function onRow(store: Store, key: unknown, request: Request, body: unknown): Promise<Response> {
  if (request.method === 'GET') {
    const row = await store.byKey(key);
    return row ? answer(200, row) : problem(404, 'invalid', `no row ${JSON.stringify(key)}`);
  }
  if (request.method === 'DELETE') {
    await store.remove(key, writeOptionsOf(request));
    return answer(204, null);
  }
  return answer(200, await store.update(key, body as Row, writeOptionsOf(request)));
}

/** What a store says of itself: its key and capabilities, and its time and domains where it has them. */
function factsOf(store: Store): StoreFacts {
  return {
    key: store.key, capabilities: { ...store.capabilities }, changes: typeof store.changes === 'function',
    distinct: typeof store.distinct === 'function', history: !!store.history,
    ...(store.time !== undefined ? { time: store.time } : {}), ...(store.domains ? { domains: store.domains } : {}),
  };
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
