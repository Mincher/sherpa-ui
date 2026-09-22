/**
 * stores.ts — the concrete stores: ArrayStore, JsonStore, RestStore, LocalStore.
 *
 * All answer the one interface in store.ts, so a view moves from an in-memory
 * array to an HTTP endpoint without a component knowing.
 */
import {
  applyOptions,
  readField,
  type LoadOptions,
  type LoadResult,
  type Row,
  type StoreChangeDetail,
} from './store.js';
// Its own module so IdbStore reaches it too.
import { BaseStore, type StoreOptions } from './base-store.js';
export { BaseStore, type StoreOptions };

/**
 * A write the schema refused — one class, so one `instanceof` catches every
 * store's. TRAP T-one-class-to-catch, TRAP T-schema-guard-belongs-at-the-store
 */
export { ValidationError } from './validate.js';

/* ── ArrayStore ────────────────────────────────────────────────────────── */

/** Records held in memory. TRAP T-array-store-copies-both-ways */
export class ArrayStore extends BaseStore {
  #rows: Row[];
  /** 0 or absent means no cap. */
  readonly #maxRows: number;

  constructor(rows: readonly Row[] = [], options: StoreOptions = {}) {
    super(options);
    this.#maxRows = options.maxRows && options.maxRows > 0 ? options.maxRows : 0;
    this.#rows = this.#trim(rows.map((r) => ({ ...r })));
  }

  /** Drop the oldest rows past the cap. TRAP T-max-rows-is-oldest-out-by-insertion */
  #trim(rows: Row[]): Row[] {
    if (!this.#maxRows || rows.length <= this.#maxRows) return rows;
    return rows.slice(rows.length - this.#maxRows);
  }

  /** Replace every record. Used by JsonStore once its fetch lands. */
  setRows(rows: readonly Row[]): void {
    this.#rows = this.#trim(rows.map((r) => ({ ...r })));
    this.announce({ type: 'update' });
  }

  load(options: LoadOptions = {}): Promise<LoadResult> {
    const result = applyOptions(this.#rows, options);
    // TRAP T-array-store-copies-both-ways — copies out.
    return this.checkRows({ ...result, rows: result.rows.map((r) => ({ ...r })) });
  }

  byKey(key: unknown): Promise<Row | undefined> {
    const row = this.#rows.find((r) => sameKey(readField(r, this.key), key));
    return Promise.resolve(row ? { ...row } : undefined);
  }

  async insert(values: Row): Promise<Row> {
    // Checked FIRST, so a refused row is never pushed and never announced.
    const row = { ...(await this.check(values)) };
    this.#rows.push(row);
    // Cap held BEFORE the announce — TRAP T-max-rows-is-oldest-out-by-insertion.
    this.#rows = this.#trim(this.#rows);
    this.announce({ type: 'insert', key: readField(row, this.key), row: { ...row } });
    return { ...row };
  }

  async update(key: unknown, values: Row): Promise<Row> {
    const i = this.#rows.findIndex((r) => sameKey(readField(r, this.key), key));
    if (i < 0) throw new Error(`ArrayStore: no row with ${this.key} ${String(key)}`);
    // Merge, and the MERGED row is checked — TRAP T-array-store-copies-both-ways.
    const row = await this.check({ ...this.#rows[i]!, ...values });
    this.#rows[i] = row;
    this.announce({ type: 'update', key, row: { ...row } });
    return { ...row };
  }

  remove(key: unknown): Promise<void> {
    const i = this.#rows.findIndex((r) => sameKey(readField(r, this.key), key));
    if (i < 0) return Promise.reject(new Error(`ArrayStore: no row with ${this.key} ${String(key)}`));
    this.#rows.splice(i, 1);
    this.announce({ type: 'remove', key });
    return Promise.resolve();
  }
}

/** Key comparison. TRAP T-numeric-keys-compare-as-strings */
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
  /** Passed through to fetch. */
  init?: RequestInit;
  /** Abort after this many ms. Default 30000. */
  timeout?: number;
}

/**
 * A JSON document fetched once, then queried in memory. The first load's fetch
 * is shared by callers arriving mid-flight — three components, one request.
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
    // Forward the inner store's changes as our own.
    this.#inner.addEventListener('change', (e) => {
      this.announce((e as CustomEvent<StoreChangeDetail>).detail);
    });
  }

  /** Fetch once; callers arriving mid-flight share the one promise. */
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
    // TRAP T-fetch-does-not-reject-on-404
    if (!response.ok) {
      throw new Error(`JsonStore: ${url} responded ${response.status} ${response.statusText}`);
    }
    const body: unknown = await response.json();
    this.#inner.setRows(rowsAt(body, rowsPath));
    this.#loaded = true;
  }

  async load(options: LoadOptions = {}): Promise<LoadResult> {
    await this.#ensure();
    // The inner ArrayStore holds no schema, so the check happens once, here —
    // TRAP T-schema-guard-belongs-at-the-store
    return this.checkRows(await this.#inner.load(options));
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
  /** Load options → query parameters. Override to match your server's names. */
  buildQuery?: (options: LoadOptions) => URLSearchParams;
}

/**
 * Records behind an HTTP endpoint — the SERVER filters, sorts and pages.
 * TRAP T-rest-update-is-patch-not-put
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
    // A reported total is believed; otherwise the page length —
    // TRAP T-rest-update-is-patch-not-put
    const reported = this.#options.totalPath ? readPath(body, this.#options.totalPath) : undefined;
    const total = typeof reported === 'number' ? reported : rows.length;
    // A bad read DROPS the row; a bad write throws —
    // TRAP T-read-check-drops-where-a-write-throws
    return this.checkRows({ rows, total });
  }

  async byKey(key: unknown): Promise<Row | undefined> {
    const url = `${this.#options.url}/${encodeURIComponent(String(key))}`;
    try {
      return await this.#request<Row>(url, { method: 'GET' });
    } catch (error) {
      // A 404 is an ANSWER — TRAP T-fetch-does-not-reject-on-404
      if (error instanceof HttpError && error.status === 404) return undefined;
      throw error;
    }
  }

  async insert(values: Row): Promise<Row> {
    // Checked before sending, and again on the way back —
    // TRAP T-schema-guard-belongs-at-the-store
    const checked = await this.check(values);
    const row = await this.#request<Row>(this.#options.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(checked),
    });
    // The server's row wins when it sends one — it may have filled in an id.
    const saved = row ? await this.check(row) : checked;
    this.announce({ type: 'insert', key: readField(saved, this.key), row: saved });
    return saved;
  }

  async update(key: unknown, values: Row): Promise<Row> {
    const url = `${this.#options.url}/${encodeURIComponent(String(key))}`;
    const row = await this.#request<Row>(url, {
      // TRAP T-rest-update-is-patch-not-put — PUT blanks what it is not sent.
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(values),
    });
    // The RESPONSE is checked, the patch is not —
    // TRAP T-rest-update-is-patch-not-put
    const saved = row ? await this.check(row) : values;
    this.announce({ type: 'update', key, row: saved });
    return saved;
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
    // 204 and content-length 0 have no body to parse —
    // TRAP T-fetch-does-not-reject-on-404
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

/** The default query shape: `skip`, `take`, and `sort`/`filter` as JSON. */
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
 * Records in Web Storage — saved views, column state, preferences.
 * TRAP T-local-store-is-not-for-bulk-data
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
      // Unreadable or corrupt storage reads as empty —
      // TRAP T-local-store-is-not-for-bulk-data
      return [];
    }
  }

  #write(rows: readonly Row[]): void {
    try {
      this.#storage?.setItem(this.#options.name, JSON.stringify(rows));
    } catch {
      // Quota exceeded, or storage blocked — TRAP T-storage-access-throws
    }
  }

  load(options: LoadOptions = {}): Promise<LoadResult> {
    return this.checkRows(applyOptions(this.#read(), options));
  }

  byKey(key: unknown): Promise<Row | undefined> {
    return Promise.resolve(this.#read().find((r) => sameKey(readField(r, this.key), key)));
  }

  async insert(values: Row): Promise<Row> {
    // Checked FIRST, so a refused row never reaches storage.
    const checked = await this.check(values);
    const rows = this.#read();
    rows.push({ ...checked });
    this.#write(rows);
    this.announce({ type: 'insert', key: readField(checked, this.key), row: { ...checked } });
    return { ...checked };
  }

  async update(key: unknown, values: Row): Promise<Row> {
    const rows = this.#read();
    const i = rows.findIndex((r) => sameKey(readField(r, this.key), key));
    if (i < 0) throw new Error(`LocalStore: no row with ${this.key} ${String(key)}`);
    // The MERGED row is checked, not the patch —
    // TRAP T-array-store-copies-both-ways
    const row = await this.check({ ...rows[i]!, ...values });
    rows[i] = row;
    this.#write(rows);
    this.announce({ type: 'update', key, row: { ...row } });
    return { ...row };
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
