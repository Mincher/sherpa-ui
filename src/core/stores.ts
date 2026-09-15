/**
 * stores.ts — the concrete stores.
 *
 * Each one answers the same interface (see store.ts), so a view moves from an
 * in-memory array to an HTTP endpoint without a component knowing.
 *
 *   ArrayStore  a JS array          the common case
 *   JsonStore   a JSON URL          fetch once, then behave as an ArrayStore
 *   RestStore   an HTTP endpoint    load → GET, insert → POST, update → PATCH…
 *   LocalStore  localStorage        saved views and column state, not bulk data
 *
 * Built on the platform: fetch, AbortSignal, URLSearchParams, structuredClone.
 * Zero dependencies.
 */
import {
  applyOptions,
  readField,
  type LoadOptions,
  type LoadResult,
  type Row,
  type Store,
  type StoreChangeDetail,
} from './store.js';

/** Options every store shares. */
export interface StoreOptions {
  /** The field holding each row's identity. Default `'id'`. */
  key?: string;
}

/**
 * Shared plumbing: the key field, and announcing a change.
 *
 * Extends EventTarget so `change` is a real DOM event — no emitter to write, and
 * a DataSource subscribes with the same addEventListener it uses for everything.
 */
abstract class BaseStore extends EventTarget implements Store {
  readonly key: string;

  constructor(options: StoreOptions = {}) {
    super();
    this.key = options.key ?? 'id';
  }

  abstract load(options?: LoadOptions): Promise<LoadResult>;
  abstract byKey(key: unknown): Promise<Row | undefined>;
  abstract insert(values: Row): Promise<Row>;
  abstract update(key: unknown, values: Row): Promise<Row>;
  abstract remove(key: unknown): Promise<void>;

  /** Matching rows before paging — what a pager counts pages from. */
  async totalCount(options?: LoadOptions): Promise<number> {
    // skip/take are dropped: a COUNT is of the matches, not of one page.
    const { skip: _skip, take: _take, ...rest } = options ?? {};
    const result = await this.load(rest);
    return result.total;
  }

  /** Tell every listener the records changed. */
  protected announce(detail: StoreChangeDetail): void {
    this.dispatchEvent(new CustomEvent('change', { detail }));
  }
}

/* ── ArrayStore ────────────────────────────────────────────────────────── */

/**
 * Records held in memory.
 *
 * The array is COPIED in, and every row handed out is a copy too. A consumer
 * mutating a row it was given must not silently rewrite the store's own record —
 * that is the bug where a grid's edit appears to work and then vanishes on the
 * next reload, because the "change" was never actually recorded.
 */
export class ArrayStore extends BaseStore {
  #rows: Row[];

  constructor(rows: readonly Row[] = [], options: StoreOptions = {}) {
    super(options);
    this.#rows = rows.map((r) => ({ ...r }));
  }

  /** Replace every record. Used by JsonStore once its fetch lands. */
  setRows(rows: readonly Row[]): void {
    this.#rows = rows.map((r) => ({ ...r }));
    this.announce({ type: 'update' });
  }

  load(options: LoadOptions = {}): Promise<LoadResult> {
    const result = applyOptions(this.#rows, options);
    // Copies out, for the same reason as copies in.
    return Promise.resolve({ rows: result.rows.map((r) => ({ ...r })), total: result.total });
  }

  byKey(key: unknown): Promise<Row | undefined> {
    const row = this.#rows.find((r) => sameKey(readField(r, this.key), key));
    return Promise.resolve(row ? { ...row } : undefined);
  }

  insert(values: Row): Promise<Row> {
    const row = { ...values };
    this.#rows.push(row);
    this.announce({ type: 'insert', key: readField(row, this.key), row: { ...row } });
    return Promise.resolve({ ...row });
  }

  update(key: unknown, values: Row): Promise<Row> {
    const i = this.#rows.findIndex((r) => sameKey(readField(r, this.key), key));
    if (i < 0) return Promise.reject(new Error(`ArrayStore: no row with ${this.key} ${String(key)}`));
    // MERGE, not replace: an update carries the fields that changed, and a caller
    // sending one field must not blank the rest.
    const row = { ...this.#rows[i]!, ...values };
    this.#rows[i] = row;
    this.announce({ type: 'update', key, row: { ...row } });
    return Promise.resolve({ ...row });
  }

  remove(key: unknown): Promise<void> {
    const i = this.#rows.findIndex((r) => sameKey(readField(r, this.key), key));
    if (i < 0) return Promise.reject(new Error(`ArrayStore: no row with ${this.key} ${String(key)}`));
    this.#rows.splice(i, 1);
    this.announce({ type: 'remove', key });
    return Promise.resolve();
  }
}

/**
 * Key comparison.
 *
 * A key arrives as a string far more often than not — from an attribute, a URL,
 * a `data-id`. `'7' === 7` is false and would report a row as missing, so numbers
 * and numeric strings compare as equal. Everything else is strict.
 */
function sameKey(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  return String(a) === String(b);
}

/* ── JsonStore ─────────────────────────────────────────────────────────── */

export interface JsonStoreOptions extends StoreOptions {
  /** Where the JSON lives. */
  url: string;
  /** Dotted path to the array inside the response, e.g. `'data.items'`. */
  rowsPath?: string;
  /** Passed through to fetch — headers, credentials, mode. */
  init?: RequestInit;
  /** Abort the request after this many ms. Default 30000. */
  timeout?: number;
}

/**
 * A JSON document fetched once, then queried in memory.
 *
 * The fetch happens on the FIRST load and is shared by every caller that arrives
 * while it is in flight — three bound components all loading at once must not
 * make three requests.
 */
export class JsonStore extends BaseStore {
  #inner: ArrayStore;
  #options: JsonStoreOptions;
  #pending: Promise<void> | null = null;
  #loaded = false;

  constructor(options: JsonStoreOptions) {
    super(options);
    this.#options = options;
    this.#inner = new ArrayStore([], options);
    // Forward the inner store's changes as our own, so a consumer subscribes to
    // the store it was handed rather than having to know one wraps another.
    this.#inner.addEventListener('change', (e) => {
      this.announce((e as CustomEvent<StoreChangeDetail>).detail);
    });
  }

  /** Fetch the document if it has not been fetched. Shared across callers. */
  async #ensure(): Promise<void> {
    if (this.#loaded) return;
    this.#pending ??= this.#fetch().finally(() => {
      this.#pending = null;
    });
    await this.#pending;
  }

  async #fetch(): Promise<void> {
    const { url, init, timeout = 30_000, rowsPath } = this.#options;
    const response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(timeout),
    });
    // fetch does NOT reject on 404 or 500 — it resolves with ok === false. A
    // missing endpoint would otherwise read as an empty result set.
    if (!response.ok) {
      throw new Error(`JsonStore: ${url} responded ${response.status} ${response.statusText}`);
    }
    const body: unknown = await response.json();
    this.#inner.setRows(rowsAt(body, rowsPath));
    this.#loaded = true;
  }

  async load(options: LoadOptions = {}): Promise<LoadResult> {
    await this.#ensure();
    return this.#inner.load(options);
  }

  async byKey(key: unknown): Promise<Row | undefined> {
    await this.#ensure();
    return this.#inner.byKey(key);
  }

  async insert(values: Row): Promise<Row> {
    await this.#ensure();
    return this.#inner.insert(values);
  }

  async update(key: unknown, values: Row): Promise<Row> {
    await this.#ensure();
    return this.#inner.update(key, values);
  }

  async remove(key: unknown): Promise<void> {
    await this.#ensure();
    return this.#inner.remove(key);
  }

  /** Drop the cache so the next load re-fetches. */
  invalidate(): void {
    this.#loaded = false;
  }
}

/** Pull the row array out of a response body, following a dotted path. */
function rowsAt(body: unknown, path?: string): Row[] {
  let cur: unknown = body;
  if (path) {
    for (const part of path.split('.')) {
      if (cur == null || typeof cur !== 'object') return [];
      cur = (cur as Row)[part];
    }
  }
  return Array.isArray(cur) ? (cur as Row[]) : [];
}

/* ── RestStore ─────────────────────────────────────────────────────────── */

export interface RestStoreOptions extends StoreOptions {
  /** The collection endpoint, e.g. `/api/customers`. */
  url: string;
  /** Dotted path to the array inside a list response. */
  rowsPath?: string;
  /** Dotted path to the total count, when the server sends one. */
  totalPath?: string;
  init?: RequestInit;
  timeout?: number;
  /**
   * Turn load options into query parameters. The default sends `skip`, `take`,
   * `sort` and `filter` as JSON — override it to match a server that names them
   * differently, which most do.
   */
  buildQuery?: (options: LoadOptions) => URLSearchParams;
}

/**
 * Records behind an HTTP endpoint.
 *
 * The SERVER does the filtering, sorting and paging — that is the point of a
 * remote store, and re-doing it on the client would page through data the client
 * does not have. So `load` passes the options through as query parameters and
 * trusts what comes back.
 */
export class RestStore extends BaseStore {
  #options: RestStoreOptions;

  constructor(options: RestStoreOptions) {
    super(options);
    this.#options = options;
  }

  async load(options: LoadOptions = {}): Promise<LoadResult> {
    const query = (this.#options.buildQuery ?? defaultQuery)(options);
    const suffix = query.size ? `?${query}` : '';
    const body = await this.#request<unknown>(`${this.#options.url}${suffix}`, { method: 'GET' });
    const rows = rowsAt(body, this.#options.rowsPath);
    // A server that reports its own total is believed; one that does not leaves
    // only the page length, which is the honest answer for an unknown corpus.
    const reported = this.#options.totalPath ? readPath(body, this.#options.totalPath) : undefined;
    const total = typeof reported === 'number' ? reported : rows.length;
    return { rows, total };
  }

  async byKey(key: unknown): Promise<Row | undefined> {
    const url = `${this.#options.url}/${encodeURIComponent(String(key))}`;
    try {
      return await this.#request<Row>(url, { method: 'GET' });
    } catch (error) {
      // A 404 means "no such row", which is an ANSWER, not a failure.
      if (error instanceof HttpError && error.status === 404) return undefined;
      throw error;
    }
  }

  async insert(values: Row): Promise<Row> {
    const row = await this.#request<Row>(this.#options.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(values),
    });
    this.announce({ type: 'insert', key: readField(row ?? values, this.key), row: row ?? values });
    return row ?? values;
  }

  async update(key: unknown, values: Row): Promise<Row> {
    const url = `${this.#options.url}/${encodeURIComponent(String(key))}`;
    const row = await this.#request<Row>(url, {
      // PATCH, not PUT: an update carries the fields that CHANGED, and PUT means
      // "replace the whole record", which would blank everything not sent.
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(values),
    });
    this.announce({ type: 'update', key, row: row ?? values });
    return row ?? values;
  }

  async remove(key: unknown): Promise<void> {
    const url = `${this.#options.url}/${encodeURIComponent(String(key))}`;
    await this.#request<unknown>(url, { method: 'DELETE' });
    this.announce({ type: 'remove', key });
  }

  async #request<T>(url: string, init: RequestInit): Promise<T> {
    const response = await fetch(url, {
      ...this.#options.init,
      ...init,
      headers: { ...this.#options.init?.headers, ...init.headers },
      signal: AbortSignal.timeout(this.#options.timeout ?? 30_000),
    });
    if (!response.ok) throw new HttpError(response.status, response.statusText, url);
    // 204 No Content is the usual answer to a DELETE, and has no body to parse.
    if (response.status === 204 || response.headers.get('content-length') === '0') {
      return undefined as T;
    }
    return (await response.json()) as T;
  }
}

/** An HTTP response that was not ok. Carries the status so a caller can branch. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly url: string,
  ) {
    super(`HTTP ${status} ${statusText} for ${url}`);
    this.name = 'HttpError';
  }
}

/** Read a dotted path out of a response body. */
function readPath(body: unknown, path: string): unknown {
  let cur: unknown = body;
  for (const part of path.split('.')) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Row)[part];
  }
  return cur;
}

/**
 * The default query shape: `skip`, `take`, and `sort`/`filter` as JSON.
 *
 * Deliberately plain. Every API names these differently, so the point is to have
 * ONE obvious default and an easy override, not to guess a convention.
 */
function defaultQuery(options: LoadOptions): URLSearchParams {
  const q = new URLSearchParams();
  // `append`, never string interpolation: `+` in a value decodes as a space.
  if (options.skip) q.append('skip', String(options.skip));
  if (options.take != null) q.append('take', String(options.take));
  if (options.search) q.append('search', options.search);
  if (options.group) q.append('group', options.group);
  if (options.sort?.length) q.append('sort', JSON.stringify(options.sort));
  if (options.filter) q.append('filter', JSON.stringify(options.filter));
  return q;
}

/* ── LocalStore ────────────────────────────────────────────────────────── */

export interface LocalStoreOptions extends StoreOptions {
  /** The localStorage key the array is kept under. */
  name: string;
  /** Use sessionStorage instead. Default false. */
  session?: boolean;
}

/**
 * Records in Web Storage — for saved views, column state and preferences.
 *
 * NOT for bulk data. Web Storage is synchronous and blocks the main thread, holds
 * strings only, and caps around 5MB. It is here because "remember this user's
 * saved views" is a real need that does not deserve a server.
 *
 * Every access is wrapped: storage throws in a private window, with site data
 * blocked, and during preview or thumbnail capture. A store that cannot read
 * behaves as empty rather than taking the page down with it.
 */
export class LocalStore extends BaseStore {
  #options: LocalStoreOptions;

  constructor(options: LocalStoreOptions) {
    super(options);
    this.#options = options;
  }

  get #storage(): Storage | null {
    try {
      return this.#options.session ? sessionStorage : localStorage;
    } catch {
      return null;
    }
  }

  #read(): Row[] {
    try {
      const raw = this.#storage?.getItem(this.#options.name);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? (parsed as Row[]) : [];
    } catch {
      // Unreadable or corrupt storage reads as empty rather than throwing — the
      // page must still work when a user has cleared site data mid-session.
      return [];
    }
  }

  #write(rows: readonly Row[]): void {
    try {
      this.#storage?.setItem(this.#options.name, JSON.stringify(rows));
    } catch {
      // Quota exceeded, or storage blocked. Nothing useful to do here; the
      // in-memory result of the call is still returned to the caller.
    }
  }

  load(options: LoadOptions = {}): Promise<LoadResult> {
    return Promise.resolve(applyOptions(this.#read(), options));
  }

  byKey(key: unknown): Promise<Row | undefined> {
    return Promise.resolve(this.#read().find((r) => sameKey(readField(r, this.key), key)));
  }

  insert(values: Row): Promise<Row> {
    const rows = this.#read();
    rows.push({ ...values });
    this.#write(rows);
    this.announce({ type: 'insert', key: readField(values, this.key), row: { ...values } });
    return Promise.resolve({ ...values });
  }

  update(key: unknown, values: Row): Promise<Row> {
    const rows = this.#read();
    const i = rows.findIndex((r) => sameKey(readField(r, this.key), key));
    if (i < 0) return Promise.reject(new Error(`LocalStore: no row with ${this.key} ${String(key)}`));
    const row = { ...rows[i]!, ...values };
    rows[i] = row;
    this.#write(rows);
    this.announce({ type: 'update', key, row: { ...row } });
    return Promise.resolve({ ...row });
  }

  remove(key: unknown): Promise<void> {
    const rows = this.#read();
    const i = rows.findIndex((r) => sameKey(readField(r, this.key), key));
    if (i < 0) return Promise.reject(new Error(`LocalStore: no row with ${this.key} ${String(key)}`));
    rows.splice(i, 1);
    this.#write(rows);
    this.announce({ type: 'remove', key });
    return Promise.resolve();
  }
}
