/**
 * request-store.ts — a store whose every read and write is one request to a data
 * handler, in the data layer's own protocol: to a handler in the page, or to a
 * Service Worker. DOM-free. Plan 652 S2 · TRAP T-a-data-request-is-the-store-interface
 *
 * Map:
 * - RequestStoreOptions — Where its requests go, and the store's name there.
 * - RequestStore — A store whose every read and write is one request to a data handler.
 * - openRequestStore — A request store, with its facts asked first.
 */
import { BaseStore } from './base-store.js';
import { DATA_BASE, DATA_CHANNEL, DATA_QUERY_TYPE, DATA_VERSION, STALE, encodeQuery, keySegment, writeHeaders, type DataQuery, type Problem, type StoreFacts } from './data-handler.js';
import { failureOf, type Failure } from './failure.js';
import { HttpError } from './stores.js';
import { readField, type LoadOptions, type LoadResult, type Row, type StoreChangeDetail, type StoreChanges, type WriteOptions } from './store.js';
import { startSpan, traceparent, type TraceContext } from './trace.js';
import { ValidationError, type FieldDomain, type Issue } from './validate.js';

/** Where its requests go, and the store's name there. */
export interface RequestStoreOptions {
  /** Where each request goes: a handler in the page (`createDataHandler`), or
   *  `fetch`, to a Service Worker or a server. */
  send: (request: Request) => Promise<Response | null>;
  /** The store's name under `base`. */
  name: string;
  /** Default `DATA_BASE`. */
  base?: string;
  /** The origin its URLs are made on: a page's own, for `fetch`. A handler in the
   *  page reads only the path. Default `http://localhost`. */
  origin?: string;
  /** Headers each request carries — a sign-in, an app's own say — read at each
   *  request. Its host's store pick reads them; Sherpa never does. TRAP T-a-request-picks-its-stores */
  headers?: () => Record<string, string>;
  /** How a read is sent: `QUERY` (the default), falling back to `POST` of the same
   *  body where a server or a proxy refuses it — or `POST` from the start. Plan 652 S10 */
  method?: 'QUERY' | 'POST';
}

/** A store whose every read and write is one request to a data handler. Its rows
 *  come keyed, and it announces its own writes, as every store does. */
export class RequestStore extends BaseStore {
  /** Where a request goes. */
  readonly #send: RequestStoreOptions['send'];
  /** What each request carries besides. */
  readonly #headers: () => Record<string, string>;
  /** The store's own URL. */
  readonly #url: string;
  /** Its name, as its host knows it. */
  readonly #name: string;
  /** Where its host says each change, until closed. */
  #channel: BroadcastChannel | null = null;
  /** What the store said of itself. */
  readonly #facts: StoreFacts;

  /** What moved since a mark — only where the store says. */
  readonly changes?: (since?: unknown) => Promise<StoreChanges>;
  /** Read its source again, behind the set it holds — only a store that holds one.
   *  The asks of one moment are one request: a page's sources, its tab shown. S5b */
  readonly recheck?: () => Promise<void>;
  /** Each field's values among the matches, read by its host: no row crosses. A
   *  remote store's only: a local one's rows are read once, for its values and its
   *  counts alike — asked apart, Records read every row twice more (measured). */
  readonly distinct?: (fields: readonly string[], options?: LoadOptions) => Promise<Record<string, unknown[]>>;
  /** Take in the newer rows that wait behind the set it holds. S6c */
  readonly take?: () => Promise<boolean>;
  /** Why its last answer's rows were unconfirmed, as it said, else null. */
  #stale: Failure | null = null;

  constructor(options: RequestStoreOptions, facts: StoreFacts) {
    /* What its host's store can do, and nothing it did not say: a History only where
       its host's store keeps one, or a change it hears would claim to name its fields.
       TRAP T-a-store-says-what-it-can-do-once · TRAP T-a-store-keeps-its-history */
    super({ key: facts.key, ...(facts.time ? { time: facts.time } : {}) }, { reportsTotal: false, projects: false, sampled: false, ...facts.capabilities }, !!facts.history);
    this.#send = options.send;
    this.#post = options.method === 'POST';
    this.#headers = options.headers ?? ((): Record<string, string> => ({}));
    this.#url = urlOf(options);
    this.#name = options.name;
    this.#facts = facts;
    if (facts.changes) this.changes = (since) => this.#ask('GET', `?since=${encodeURIComponent(since === undefined ? '' : JSON.stringify(since))}`);
    if (this.capabilities.holds) {
      this.recheck = () => (this.#rechecking ??= Promise.resolve().then(() => {
        this.#rechecking = null;
        return this.#ask<undefined>('POST', '?recheck').then(() => undefined);
      }));
      // An act that changes state is a POST. TRAP T-an-act-is-a-post
      this.take = () => this.#ask<{ took: boolean }>('POST', '?take').then((said) => !!said?.took);
    }
    if (facts.distinct && this.capabilities.remote) {
      this.distinct = async (fields, options) => (await this.#query<{ values: Record<string, unknown[]> }>({ ...encodeQuery(options), distinct: [...fields] }, options?.signal)).values;
    }
    /* Its host says every change, to every tab — its own writes too, so it says
       none of them itself. S6 · TRAP T-every-tab-hears-a-change */
    if (facts.notifies && typeof BroadcastChannel === 'function') {
      this.#heard = true;
      const channel = new BroadcastChannel(DATA_CHANNEL);
      // Its own store's, of those under its name: the one its host picked for it.
      channel.addEventListener('message', (event) => {
        const said = (event as MessageEvent<{ store?: string; as?: string; change?: StoreChangeDetail }>).data;
        if (said?.store === options.name && said.as === facts.as) this.announce(said.change ?? { type: 'update' });
      });
      // Open until closed — a page's store, as long as the page: in Node, it keeps nothing running.
      (channel as { unref?: () => void }).unref?.();
      this.#channel = channel;
    }
  }

  /** Stop hearing its host's changes: its channel closes, and it says its own
   *  writes again. Its owner closes it as it ends; a page's store lives as the page. */
  close(): void {
    this.#channel?.close();
    this.#channel = null;
    this.#heard = false;
  }

  /** Its host says its changes, its own writes among them. */
  #heard = false;
  /** The check behind asked this moment, which every ask of it joins. */
  #rechecking: Promise<void> | null = null;

  /** A write of its own, said unless its host says it to every tab. */
  #wrote(change: StoreChangeDetail): void {
    if (!this.#heard) this.announce(change);
  }

  /** Why the rows it last answered are unconfirmed — its source could not be
   *  reached — else null. */
  get stale(): Failure | null {
    return this.#stale;
  }

  override get domains(): Readonly<Record<string, FieldDomain>> {
    return this.#facts.domains ?? {};
  }

  /* A read sends its signal with its request: superseded, it stops. TRAP T-a-superseded-read-stops */
  async load(options: LoadOptions = {}): Promise<LoadResult> {
    const result = await this.#query<LoadResult>(encodeQuery(options), options.signal, options.trace);
    for (const row of result.rows) this.keyed(row);
    return result;
  }

  override async totalCount(options?: LoadOptions): Promise<number> {
    return (await this.#query<{ total: number }>(encodeQuery(options, true), options?.signal, options?.trace)).total;
  }

  async byKey(key: unknown): Promise<Row | undefined> {
    try {
      return this.keyed(await this.#ask<Row>('GET', `/${keySegment(key)}`));
    } catch (error) {
      if (error instanceof HttpError && error.status === 404) return undefined;
      throw error;
    }
  }

  async insert(values: Row): Promise<Row> {
    const row = this.keyed(await this.#ask<Row>('POST', '', values));
    this.#wrote({ type: 'insert', key: readField(row, this.key), row });
    return row;
  }

  /* A write's time goes with it, so its host refuses it where the row changed
     after (412, `conflict`). TRAP T-a-newer-write-wins */
  async update(key: unknown, values: Row, options?: WriteOptions): Promise<Row> {
    const row = this.keyed(await this.#ask<Row>('PATCH', `/${keySegment(key)}`, values, 'application/json', writeHeaders(options)));
    this.#wrote({ type: 'update', key, row });
    return row;
  }

  async remove(key: unknown, options?: WriteOptions): Promise<void> {
    await this.#ask('DELETE', `/${keySegment(key)}`, undefined, 'application/json', writeHeaders(options));
    this.#wrote({ type: 'remove', key });
  }

  /** A read sends its query as `POST`: asked so, or `QUERY` was refused. */
  #post = false;

  /** A read, as `QUERY` — or, where a server or a proxy refuses it, a `POST` of the
   *  same body, from then on. One that fails at the network tries `POST` once, and
   *  keeps it only if it answers: a CORS preflight refused looks like offline.
   *  TRAP T-a-query-falls-back-to-post */
  async #query<T>(query: DataQuery, signal?: AbortSignal, trace?: TraceContext): Promise<T> {
    if (this.#post) return this.#ask<T>('POST', '', query, DATA_QUERY_TYPE, {}, signal, trace);
    try {
      return await this.#ask<T>('QUERY', '', query, DATA_QUERY_TYPE, {}, signal, trace, false);
    } catch (error) {
      const refused = error instanceof HttpError && (error.status === 405 || error.status === 501);
      if (!refused && failureOf(error).kind !== 'offline') throw error;
      let answer: T;
      try {
        answer = await this.#ask<T>('POST', '', query, DATA_QUERY_TYPE, {}, signal, trace, false);
      } catch {
        throw await refusalOf(error, this.#url, this.#send);
      }
      this.#post = true;
      return answer;
    }
  }

  /** One request, its answer as JSON. A refusal throws as the store's own error
   *  would, its kind kept (TRAP T-a-refusal-keeps-its-kind). Traced, it carries its
   *  span as `traceparent`, and its host's spans join it. TRAP T-one-trace-stream */
  async #ask<T>(
    method: string, tail: string, body?: unknown, type = 'application/json', more: Record<string, string> = {}, signal?: AbortSignal, trace?: TraceContext, probe = true,
  ): Promise<T> {
    const url = this.#url + tail;
    // Under the read that asked it, passed: a span cannot cross an `await`.
    const span = startSpan('request', { store: this.#name, detail: { method }, ...(trace ? { parent: trace } : {}) });
    const headers: Record<string, string> = {
      ...(span ? { traceparent: traceparent(span) } : {}), ...this.#headers(), ...more,
      'Sherpa-Data': String(DATA_VERSION), ...(body !== undefined ? { 'Content-Type': type } : {}),
    };
    let response: Response | null;
    try {
      response = await this.#send(new Request(url, {
        method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}), ...(signal ? { signal } : {}),
      }));
    } catch (error) {
      span?.end({ failed: failureOf(error).kind });
      throw probe ? await refusalOf(error, this.#url, this.#send) : error;
    }
    span?.end({ status: response?.status ?? 404 });
    if (!response) throw new HttpError(404, 'no data handler answered', url);
    const stale = response.headers.get(STALE);
    this.#stale = stale ? (JSON.parse(decodeURIComponent(stale)) as Failure) : null;
    if (!response.ok) throw await problemOf(response, url);
    return (response.status === 204 ? undefined : await response.json()) as T;
  }
}

/** A refusal as the store's own error: a write's issues as a `ValidationError`, else
 *  an `HttpError` that keeps the kind its host said, so an offline host reads as
 *  offline, not as a failing one. TRAP T-a-refusal-keeps-its-kind */
async function problemOf(response: Response, url: string): Promise<Error> {
  const said = (await response.json().catch(() => null)) as Partial<Problem> | null;
  if (said?.issues?.length) return new ValidationError(said.issues);
  const error = new HttpError(response.status, said?.detail ?? response.statusText, url);
  return typeof said?.kind === 'string' ? Object.assign(error, { kind: said.kind }) : error;
}

/** A request that failed at the network to another origin, whose host still answers
 *  a plain `GET` (no preflight, an opaque answer): its policy refused this origin, so
 *  it is `refused`, never offline. TRAP T-a-preflight-is-the-apps-to-answer */
async function refusalOf(error: unknown, url: string, send: RequestStoreOptions['send']): Promise<unknown> {
  const here = (globalThis as { location?: { origin?: string } }).location?.origin;
  if (failureOf(error).kind !== 'offline' || !here || new URL(url).origin === here) return error;
  const reached = await send(new Request(url, { mode: 'no-cors' })).then(() => true, () => false);
  return reached ? Object.assign(new Error(`${url} refused a request from ${here}: its CORS policy`), { name: 'RefusedError', kind: 'refused' }) : error;
}

/** A store's URL, by its name under `base` on `origin`. */
function urlOf(options: RequestStoreOptions): string {
  const base = options.base ?? DATA_BASE;
  return new URL(`${base}${encodeURIComponent(options.name)}`, options.origin ?? 'http://localhost').href;
}

/** A request store, with its facts asked first: they are read at once, as a store's are. */
export async function openRequestStore(options: RequestStoreOptions): Promise<RequestStore> {
  const url = urlOf(options);
  let response: Response | null;
  try {
    response = await options.send(new Request(url, { method: 'GET', headers: { ...options.headers?.(), 'Sherpa-Data': String(DATA_VERSION) } }));
  } catch (error) {
    throw await refusalOf(error, url, options.send);
  }
  if (!response) throw new HttpError(404, 'no data handler answered', url);
  if (!response.ok) throw await problemOf(response, url);
  return new RequestStore(options, (await response.json()) as StoreFacts);
}
