/**
 * stores.ts — the concrete stores: ArrayStore, JsonStore, RestStore, LocalStore.
 *
 * All answer the one interface in store.ts, so a view moves from an in-memory
 * array to an HTTP endpoint without a component knowing.
 *
 * Map:
 * - ArrayStore — Records held in memory.
 * - JsonStoreOptions — where the JSON lives, and how to read the rows out of it
 * - JsonStore — A JSON document fetched once, then queried in memory.
 * - RestStoreOptions — the endpoint, and how its query parameters are spelled
 * - RestStore — Records behind an HTTP endpoint — the SERVER filters, sorts and pages.
 * - HttpError — An HTTP response that was not ok.
 * - LocalStoreOptions — the storage key, and local vs session
 * - LocalStore — Records in Web Storage — saved views, column state, preferences.
 */
import {
  absoluteDates,
  distinctOf,
  matchesOnly,
  readField,
  sameKey,
  valueKey,
  type LoadOptions,
  type LoadResult,
  type Row,
  type RowOrder,
  type StoreChangeDetail,
  type StoreChanges,
  type WriteOptions,
} from './store.js';
// Its own module so IdbStore reaches it too.
import { BaseStore, type StoreOptions } from './base-store.js';
import { rowKey } from './row-key.js';
import { changedFields } from './store-history.js';
import { DATA_QUERY_TYPE, encodeQuery, writeHeaders } from './data-handler.js';
import { failureOf } from './failure.js';
export { BaseStore, type StoreOptions };

/**
 * A write the schema refused — one class, so one `instanceof` catches every
 * store's. TRAP T-one-class-to-catch, TRAP T-schema-guard-belongs-at-the-store
 */
export { ValidationError } from './validate.js';

/* ── ArrayStore ────────────────────────────────────────────────────────── */

/** Records held in memory. TRAP T-array-store-copies-both-ways */
export class ArrayStore extends BaseStore {
  /** A whole read returns its rows as inserted. */
  readonly rowOrder = 'insertion' as const;
  /** Its rows change only through it, and each change is announced. */
  readonly announcesAll = true;
  /** The records, in insertion order. */
  #rows: Row[];
  /** 0 or absent means no cap. */
  readonly #maxRows: number;

  constructor(rows: readonly Row[] = [], options: StoreOptions = {}) {
    super(options);
    this.#maxRows = options.maxRows && options.maxRows > 0 ? options.maxRows : 0;
    this.#rows = this.#trim(rows.map((r) => this.keyed({ ...r })));
  }

  /** Drop the oldest rows past the cap. TRAP T-max-rows-is-oldest-out-by-insertion */
  #trim(rows: Row[]): Row[] {
    if (!this.#maxRows || rows.length <= this.#maxRows) return rows;
    return rows.slice(rows.length - this.#maxRows);
  }

  /** Replace every record. Used by JsonStore once its fetch lands. */
  setRows(rows: readonly Row[]): void {
    this.#rows = this.#trim(rows.map((r) => this.keyed({ ...r })));
    this.#places = null;
    this.announce({ type: 'update' });
  }

  async load(options: LoadOptions = {}): Promise<LoadResult> {
    const result = await this.page(this.#rows, options);
    // TRAP T-array-store-copies-both-ways — copies out, each by its original's key.
    return { ...result, rows: result.rows.map((r) => this.keyed({ ...r }, r)) };
  }

  /** A count hands out no rows, so it copies none. TRAP T-array-store-copies-both-ways */
  override async totalCount(options: LoadOptions = {}): Promise<number> {
    return (await this.page(this.#rows, matchesOnly(options))).total;
  }

  /** Each field's values among the matching rows, read in place: no row is copied out. TRAP T-a-ruled-out-value-is-greyed */
  async distinct(fields: readonly string[], options: LoadOptions = {}): Promise<Record<string, unknown[]>> {
    return distinctOf((await this.page(this.#rows, matchesOnly(options))).rows, fields);
  }

  /** Every row the schema accepts, in place: no row is copied, for a reader that
   *  only reads — the walk. TRAP T-array-store-copies-both-ways */
  async scan(): Promise<readonly Row[]> {
    return (await this.checkRows({ rows: this.#rows, total: this.#rows.length })).rows;
  }

  /** Where a row is, by its key field — or by the key made up for it. */
  #at(key: unknown): number {
    // TRAP T-numeric-keys-compare-as-strings — `'7' === 7` is false.
    return key == null ? -1 : this.#byKey().get(valueKey(key)) ?? -1;
  }

  /** Each row's place, by its key and any key made up for it: found once, for a burst of writes. */
  #byKey(): Map<string, number> {
    if (this.#places) return this.#places;
    const places = new Map<string, number>();
    const add = (key: string | undefined, i: number): void => {
      if (key != null && !places.has(key)) places.set(key, i);
    };
    this.#rows.forEach((r, i) => {
      const own = readField(r, this.key);
      add(own == null ? undefined : valueKey(own), i);
      add(rowKey(r), i);
    });
    this.#places = places;
    return places;
  }
  /** Each row's place, until a row comes, goes or changes its key. */
  #places: Map<string, number> | null = null;

  byKey(key: unknown): Promise<Row | undefined> {
    const row = this.#rows[this.#at(key)];
    return Promise.resolve(row ? this.keyed({ ...row }, row) : undefined);
  }

  async insert(values: Row): Promise<Row> {
    // Checked FIRST, so a refused row is never pushed and never announced.
    const row = this.keyed({ ...(await this.check(values)) });
    this.#rows.push(row);
    // Cap held BEFORE the announce — TRAP T-max-rows-is-oldest-out-by-insertion.
    const kept = this.#trim(this.#rows);
    const trimmed = this.#rows.slice(0, this.#rows.length - kept.length).map((r) => readField(r, this.key) ?? rowKey(r));
    this.#rows = kept;
    this.#places = null;
    this.announce({ type: 'insert', key: readField(row, this.key) ?? rowKey(row), row: this.keyed({ ...row }, row), ...(trimmed.length ? { trimmed } : {}) });
    return this.keyed({ ...row }, row);
  }

  async update(key: unknown, values: Row): Promise<Row> {
    const i = this.#at(key);
    if (i < 0) throw new Error(`ArrayStore: no row with ${this.key} ${String(key)}`);
    // Merge, and the MERGED row is checked — TRAP T-array-store-copies-both-ways.
    const old = this.#rows[i]!;
    const row = this.keyed(await this.check({ ...old, ...values }), old);
    // A changed key moves the row; one another row holds is refused. TRAP T-a-changed-key-moves-the-row
    const now = readField(row, this.key);
    if (!sameKey(now, readField(old, this.key)) && this.#at(now) >= 0) {
      throw new Error(`ArrayStore: another row already has ${this.key} ${String(now)}`);
    }
    this.#rows[i] = row;
    if (!sameKey(now, readField(old, this.key))) this.#places = null;
    this.announce({ type: 'update', key, row: this.keyed({ ...row }, row), fields: changedFields(old, row, values) });
    return this.keyed({ ...row }, row);
  }

  remove(key: unknown): Promise<void> {
    const i = this.#at(key);
    if (i < 0) return Promise.reject(new Error(`ArrayStore: no row with ${this.key} ${String(key)}`));
    this.#rows.splice(i, 1);
    this.#places = null;
    this.announce({ type: 'remove', key });
    return Promise.resolve();
  }
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
  /** Its rows are an ArrayStore's: as inserted. */
  readonly rowOrder = 'insertion' as const;
  /** Holds the rows once fetched; every query runs over it. */
  #inner: ArrayStore;
  /** Where the JSON lives, and how to read it. */
  #options: JsonStoreOptions;
  /** The fetch in flight, shared by every load that waits on it. */
  #pending: Promise<void> | null = null;
  /** Has the JSON been fetched. */
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

  /** Fetch the JSON once, with a timeout, into the inner store. */
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
    // The inner ArrayStore has the same schema: it checks every row once, and says what it refused.
    // TRAP T-schema-guard-belongs-at-the-store
    return this.#inner.load(options);
  }

  /** Every row the schema accepts, read in place from the rows it fetched. */
  async scan(): Promise<readonly Row[]> {
    await this.#ensure();
    return this.#inner.scan();
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
  /** The order the server lists rows in, asked no sort, when it is one of these. TRAP T-a-held-set-takes-a-change-in-place */
  rowOrder?: RowOrder;
  /** What moved since a mark: `GET <changesUrl>?since=<at>` answers `{ at, rows, fields }`.
   *  Without it, a page opened again reads the whole set. TRAP T-a-remote-store-says-what-changed */
  changesUrl?: string;
  /** How a read is sent: `GET` with query parameters — the default, as most servers
   *  take nothing else — or the Sherpa query as a BODY, so a long filter never breaks
   *  a URL: `QUERY`, falling back to `POST` where a server or proxy refuses it, or
   *  `POST` from the start. Plan 652 S10 · TRAP T-a-query-falls-back-to-post */
  method?: 'GET' | 'QUERY' | 'POST';
}

/**
 * Records behind an HTTP endpoint — the SERVER filters, sorts and pages.
 * TRAP T-rest-update-is-patch-not-put
 */
export class RestStore extends BaseStore {
  /** Its loads leave the data layer: its source keeps a draft. TRAP T-apply-and-discard-wait-for-a-change */
  readonly remote = true;
  /** The endpoint, and how its query parameters are spelled. */
  #options: RestStoreOptions;

  /** What moved since a mark — only with a `changesUrl`. TRAP T-a-remote-store-says-what-changed */
  readonly changes?: (since?: unknown) => Promise<StoreChanges>;

  constructor(options: RestStoreOptions) {
    super(options);
    this.#options = options;
    const url = options.changesUrl;
    if (url) this.changes = (since) => this.#changes(url, since);
  }

  /** Ask what moved; a reply that does not say which fields moved every field. */
  async #changes(url: string, since: unknown): Promise<StoreChanges> {
    const query = since == null ? '' : `?since=${encodeURIComponent(String(since))}`;
    const body = await this.#request<Partial<StoreChanges> | null>(`${url}${query}`, { method: 'GET' });
    const fields = body?.fields;
    return { at: body?.at, rows: !!body?.rows, fields: Array.isArray(fields) ? fields : 'all' };
  }

  /** Only a `totalPath` says how many rows match: without one, the total is the rows sent. */
  override get reportsTotal(): boolean {
    return !!this.#options.totalPath;
  }

  /** One row says how many there are. */
  get totalFirst(): boolean {
    return this.reportsTotal;
  }

  /** It says its total, so a count asks one row, never the matches. TRAP T-a-page-turn-is-a-slice */
  override async totalCount(options?: LoadOptions): Promise<number> {
    if (!this.reportsTotal) return super.totalCount(options);
    const { total, totalUnknown } = await this.load({ ...matchesOnly(options), take: 1 });
    return totalUnknown ? super.totalCount(options) : total;
  }

  /** The server's order, when the app says it. */
  get rowOrder(): RowOrder | undefined {
    return this.#options.rowOrder;
  }

  /** A read sends its query as `POST`: asked so, or `QUERY` was refused. */
  #post = false;

  /** A read as a body: `QUERY`, else — refused, or blocked on the way — the same body as
   *  `POST`, from then on. One that fails at the network keeps `POST` only if it answers. */
  async #read(options: LoadOptions): Promise<unknown> {
    const init = (method: string): RequestInit => ({
      method, headers: { 'content-type': DATA_QUERY_TYPE }, body: JSON.stringify(encodeQuery(options)),
    });
    if (this.#post || this.#options.method === 'POST') return this.#request<unknown>(this.#options.url, init('POST'));
    try {
      return await this.#request<unknown>(this.#options.url, init('QUERY'));
    } catch (error) {
      const refused = error instanceof HttpError && (error.status === 405 || error.status === 501);
      if (!refused && failureOf(error).kind !== 'offline') throw error;
      let body: unknown;
      try {
        body = await this.#request<unknown>(this.#options.url, init('POST'));
      } catch {
        throw error;
      }
      this.#post = true;
      return body;
    }
  }

  async load(options: LoadOptions = {}): Promise<LoadResult> {
    // A relative date reaches the server as the days it means today. TRAP T-a-relative-date-stays-relative
    const sent = options.filter ? { ...options, filter: absoluteDates(options.filter, options.now) } : options;
    let body: unknown;
    if ((this.#options.method ?? 'GET') === 'GET') {
      const query = (this.#options.buildQuery ?? defaultQuery)(sent);
      const suffix = query.size ? `?${query}` : '';
      body = await this.#request<unknown>(`${this.#options.url}${suffix}`, { method: 'GET' });
    } else body = await this.#read(sent);
    const rows = rowsAt(body, this.#options.rowsPath);
    // A reported total is believed; otherwise the page length —
    // TRAP T-rest-update-is-patch-not-put
    const reported = this.#options.totalPath ? readPath(body, this.#options.totalPath) : undefined;
    const counted = typeof reported === 'string' && reported.trim() !== '' ? Number(reported) : reported;
    const known = typeof counted === 'number' && Number.isFinite(counted);
    const total = known ? counted : rows.length;
    // A bad read DROPS the row; a bad write throws — a projected one, on what it was sent.
    // TRAP T-read-check-drops-where-a-write-throws
    const checked = await this.checkRows({ rows, total }, options.fields);
    // A totalPath that read no number: say so, so the whole set is never held from it.
    return this.#options.totalPath && !known ? { ...checked, totalUnknown: true } : checked;
  }

  /** One record's URL. Three methods built this, which is three chances to
   *  forget the encoding on a key holding a slash. */
  #keyUrl(key: unknown): string {
    return `${this.#options.url}/${encodeURIComponent(String(key))}`;
  }

  async byKey(key: unknown): Promise<Row | undefined> {
    const url = this.#keyUrl(key);
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
    // With no reply the saved row is not known, so none is announced.
    this.announce({ type: 'insert', key: readField(saved, this.key), ...(row ? { row: saved } : {}) });
    return saved;
  }

  async update(key: unknown, values: Row, options?: WriteOptions): Promise<Row> {
    const url = this.#keyUrl(key);
    const row = await this.#request<Row>(url, {
      // TRAP T-rest-update-is-patch-not-put — PUT blanks what it is not sent.
      method: 'PATCH',
      headers: { 'content-type': 'application/json', ...writeHeaders(options) },
      body: JSON.stringify(values),
    });
    // The RESPONSE is checked, the patch is not —
    // TRAP T-rest-update-is-patch-not-put
    const saved = row ? await this.check(row) : values;
    this.announce({ type: 'update', key, ...(row ? { row: saved } : {}) });
    return saved;
  }

  async remove(key: unknown, options?: WriteOptions): Promise<void> {
    const url = this.#keyUrl(key);
    await this.#request<unknown>(url, { method: 'DELETE', headers: writeHeaders(options) });
    this.announce({ type: 'remove', key });
  }

  /** One HTTP request, with the store headers, parsed as JSON. */
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
  // A projection: the server may send these fields alone.
  if (options.fields?.length) q.append('fields', options.fields.join(','));
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
  /** A whole read returns its rows as inserted. */
  readonly rowOrder = 'insertion' as const;
  /** The storage key, and local vs session. */
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

  /** The stored rows, or none when storage is blocked or unreadable. */
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

  /** Store the rows; a full or blocked storage is not an error. */
  #write(rows: readonly Row[]): void {
    try {
      this.#storage?.setItem(this.#options.name, JSON.stringify(rows));
    } catch {
      // Quota exceeded, or storage blocked — TRAP T-storage-access-throws
    }
  }

  load(options: LoadOptions = {}): Promise<LoadResult> {
    return this.page(this.#read(), options);
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
    // A changed key moves the row; one another row holds is refused. TRAP T-a-changed-key-moves-the-row
    const now = readField(row, this.key);
    if (!sameKey(now, readField(rows[i]!, this.key)) && rows.some((r) => sameKey(readField(r, this.key), now))) {
      throw new Error(`LocalStore: another row already has ${this.key} ${String(now)}`);
    }
    const fields = changedFields(rows[i]!, row, values);
    rows[i] = row;
    this.#write(rows);
    this.announce({ type: 'update', key, row: { ...row }, fields });
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
