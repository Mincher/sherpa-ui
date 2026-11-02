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
import { DATA_QUERY_TYPE, DATA_VERSION, STALE, encodeQuery, keySegment, type DataQuery, type StoreFacts } from './data-handler.js';
import type { Failure } from './failure.js';
import { HttpError } from './stores.js';
import { readField, type LoadOptions, type LoadResult, type Row, type RowOrder, type StoreChanges } from './store.js';
import { ValidationError, type FieldDomain, type Issue } from './validate.js';

/** Where its requests go, and the store's name there. */
export interface RequestStoreOptions {
  /** Where each request goes: a handler in the page (`createDataHandler`), or
   *  `fetch`, to a Service Worker or a server. */
  send: (request: Request) => Promise<Response | null>;
  /** The store's name under `base`. */
  name: string;
  /** Default `/sherpa/data/`. */
  base?: string;
  /** The origin its URLs are made on: a page's own, for `fetch`. A handler in the
   *  page reads only the path. Default `http://localhost`. */
  origin?: string;
  /** Headers each request carries — a sign-in, an app's own say — read at each request. */
  headers?: () => Record<string, string>;
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
  /** What the store said of itself. */
  readonly #facts: StoreFacts;

  /** What moved since a mark — only where the store says. */
  readonly changes?: (since?: unknown) => Promise<StoreChanges>;
  /** Read its source again, behind the set it holds — only a store that holds one. S5b */
  readonly recheck?: () => Promise<void>;
  /** Why its last answer's rows were unconfirmed, as it said, else null. */
  #stale: Failure | null = null;

  constructor(options: RequestStoreOptions, facts: StoreFacts) {
    super({ key: facts.key, ...(facts.time ? { time: facts.time } : {}) });
    this.#send = options.send;
    this.#headers = options.headers ?? ((): Record<string, string> => ({}));
    this.#url = urlOf(options);
    this.#facts = facts;
    if (facts.changes) this.changes = (since) => this.#ask('GET', `?since=${encodeURIComponent(since === undefined ? '' : JSON.stringify(since))}`);
    if (facts.holds) this.recheck = () => this.#ask('GET', '?recheck');
  }

  /** It holds its own set, so a reader over it holds none. */
  get holds(): boolean {
    return this.#facts.holds ?? false;
  }
  /** Why the rows it last answered are unconfirmed — its source could not be
   *  reached — else null. */
  get stale(): Failure | null {
    return this.#stale;
  }

  get remote(): boolean {
    return this.#facts.remote ?? false;
  }
  override get reportsTotal(): boolean {
    return this.#facts.reportsTotal ?? true;
  }
  override get projects(): boolean {
    return this.#facts.projects ?? true;
  }
  override get sampled(): boolean {
    return this.#facts.sampled ?? false;
  }
  override get domains(): Readonly<Record<string, FieldDomain>> {
    return this.#facts.domains ?? {};
  }
  get totalFirst(): boolean | undefined {
    return this.#facts.totalFirst;
  }
  get rowOrder(): RowOrder | undefined {
    return this.#facts.rowOrder;
  }
  get announcesAll(): boolean | undefined {
    return this.#facts.announcesAll;
  }

  async load(options: LoadOptions = {}): Promise<LoadResult> {
    const result = await this.#query<LoadResult>(encodeQuery(options));
    for (const row of result.rows) this.keyed(row);
    return result;
  }

  override async totalCount(options?: LoadOptions): Promise<number> {
    return (await this.#query<{ total: number }>(encodeQuery(options, true))).total;
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
    this.announce({ type: 'insert', key: readField(row, this.key), row });
    return row;
  }

  async update(key: unknown, values: Row): Promise<Row> {
    const row = this.keyed(await this.#ask<Row>('PATCH', `/${keySegment(key)}`, values));
    this.announce({ type: 'update', key, row });
    return row;
  }

  async remove(key: unknown): Promise<void> {
    await this.#ask('DELETE', `/${keySegment(key)}`);
    this.announce({ type: 'remove', key });
  }

  /** A read, as `QUERY`. */
  #query<T>(query: DataQuery): Promise<T> {
    return this.#ask<T>('QUERY', '', query, DATA_QUERY_TYPE);
  }

  /** One request, its answer as JSON. A refusal throws as the store's own error
   *  would: a write's issues as a `ValidationError`, else an `HttpError`. */
  async #ask<T>(method: string, tail: string, body?: unknown, type = 'application/json'): Promise<T> {
    const url = this.#url + tail;
    const headers: Record<string, string> = {
      ...this.#headers(), 'Sherpa-Data': String(DATA_VERSION), ...(body !== undefined ? { 'Content-Type': type } : {}),
    };
    const response = await this.#send(new Request(url, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }));
    if (!response) throw new HttpError(404, 'no data handler answered', url);
    const stale = response.headers.get(STALE);
    this.#stale = stale ? (JSON.parse(decodeURIComponent(stale)) as Failure) : null;
    if (!response.ok) {
      const said = (await response.json().catch(() => null)) as { error?: { message?: string; issues?: Issue[] } } | null;
      if (said?.error?.issues?.length) throw new ValidationError(said.error.issues);
      throw new HttpError(response.status, said?.error?.message ?? response.statusText, url);
    }
    return (response.status === 204 ? undefined : await response.json()) as T;
  }
}

/** A store's URL, by its name under `base` on `origin`. */
function urlOf(options: RequestStoreOptions): string {
  const base = options.base ?? '/sherpa/data/';
  return new URL(`${base}${encodeURIComponent(options.name)}`, options.origin ?? 'http://localhost').href;
}

/** A request store, with its facts asked first: they are read at once, as a store's are. */
export async function openRequestStore(options: RequestStoreOptions): Promise<RequestStore> {
  const url = urlOf(options);
  const response = await options.send(new Request(url, { method: 'GET', headers: { ...options.headers?.(), 'Sherpa-Data': String(DATA_VERSION) } }));
  if (!response?.ok) throw new HttpError(response?.status ?? 404, response?.statusText || 'no data handler answered', url);
  return new RequestStore(options, (await response.json()) as StoreFacts);
}
