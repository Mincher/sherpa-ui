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
import { validate, type Issue, type StandardSchema } from './validate.js';

/** Options every store shares. */
export interface StoreOptions {
  /** The field holding each row's identity. Default `'id'`. */
  key?: string;
  /**
   * Check every row the store WRITES, and refuse the ones that fail.
   *
   * TRAP T-schema-guard-belongs-at-the-store — a rule enforced in one screen is
   * not a rule.
   */
  schema?: StandardSchema;
  /**
   * Keep at most this many rows, dropping the OLDEST first.
   *
   * TRAP T-max-rows-is-oldest-out-by-insertion — insertion order, not a field,
   * and every write honours it.
   */
  maxRows?: number;
  /**
   * On a READ, check only the first N rows rather than every one.
   *
   * TRAP T-schema-sample-cost — what a sample is for, and when it must NOT be
   * used. Writes are always checked in full.
   */
  sample?: number;
}

/**
 * Shared plumbing: the key field, and announcing a change.
 *
 * Extends EventTarget so `change` is a real DOM event — no emitter to write, and
 * a DataSource subscribes with its usual addEventListener.
 */
abstract class BaseStore extends EventTarget implements Store {
  readonly key: string;
  /** The write guard, if the caller gave one — see StoreOptions.schema. */
  protected readonly schema: StandardSchema | undefined;
  /** How many rows a READ checks. 0 or absent = all of them — see StoreOptions.sample. */
  protected readonly sampleSize: number;

  constructor(options: StoreOptions = {}) {
    super();
    this.key = options.key ?? 'id';
    this.schema = options.schema;
    this.sampleSize = options.sample ?? 0;
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

  /**
   * Check a row against the schema, THROWING if it fails.
   *
   * TRAP T-schema-guard-belongs-at-the-store — a throw not a `false`, the PARSED
   * value back, and no schema means no check.
   */
  protected async check(values: Row): Promise<Row> {
    if (!this.schema) return values;
    const result = await validate(this.schema, values);
    if (result.issues) throw new ValidationError(result.issues);
    return (result.value ?? values) as Row;
  }

  /**
   * Check ROWS ARRIVING, dropping the ones the schema refuses.
   *
   * TRAP T-read-check-drops-where-a-write-throws — one bad row in a thousand
   * must not empty a grid, so it is dropped and counted. No schema, no check.
   */
  protected async checkRows(result: LoadResult): Promise<LoadResult> {
    if (!this.schema) return result;

    /* THE SAMPLE. `undefined` or 0 means check everything, which stays the
       default: a guard you have to opt out of is a guard people keep. */
    const limit = this.sampleSize && this.sampleSize > 0
      ? Math.min(this.sampleSize, result.rows.length)
      : result.rows.length;

    const rows: Row[] = [];
    // The first few issues only — TRAP T-read-check-drops-where-a-write-throws.
    const issues: Issue[] = [];
    for (let i = 0; i < limit; i++) {
      const row = result.rows[i]!;
      const checked = await validate(this.schema, row);
      if (checked.issues) issues.push(...checked.issues);
      else rows.push((checked.value ?? row) as Row);
    }
    // The tail, UNCHECKED and unchanged — TRAP T-schema-sample-cost.
    for (let i = limit; i < result.rows.length; i++) rows.push(result.rows[i]!);

    const dropped = result.rows.length - rows.length;
    if (!dropped) return { ...result, rows };

    return {
      ...result,
      rows,
      // TRAP T-dropped-rows-must-be-countable — the total drops with the rows,
      // and only the first few issues travel.
      total: Math.max(0, result.total - dropped),
      dropped,
      issues: issues.slice(0, 5),
    };
  }

  /** Tell every listener the records changed. */
  protected announce(detail: StoreChangeDetail): void {
    this.dispatchEvent(new CustomEvent('change', { detail }));
  }
}

/**
 * A write the schema refused.
 *
 * Carries the ISSUES, not just a message —
 * TRAP T-schema-guard-belongs-at-the-store.
 */
export class ValidationError extends Error {
  readonly issues: ReadonlyArray<Issue>;

  constructor(issues: ReadonlyArray<Issue>) {
    // The message is for a log or an unhandled throw; `issues` is what a UI reads.
    super(issues.map((i) => `${String(i.path?.[0] ?? '')}: ${i.message}`.trim()).join('; '));
    this.name = 'ValidationError';
    this.issues = issues;
  }
}

/* ── ArrayStore ────────────────────────────────────────────────────────── */

/**
 * Records held in memory.
 *
 * TRAP T-array-store-copies-both-ways — an edit that appears to work and then
 * vanishes on the next reload is a row handed out by reference.
 */
export class ArrayStore extends BaseStore {
  #rows: Row[];
  /** See StoreOptions.maxRows — 0 or absent means no cap. */
  readonly #maxRows: number;

  constructor(rows: readonly Row[] = [], options: StoreOptions = {}) {
    super(options);
    this.#maxRows = options.maxRows && options.maxRows > 0 ? options.maxRows : 0;
    this.#rows = this.#trim(rows.map((r) => ({ ...r })));
  }

  /**
   * Drop the oldest rows past the cap.
   *
   * TRAP T-max-rows-is-oldest-out-by-insertion. The caller always owns a fresh
   * copy by the time this runs.
   */
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
    // Copies out — TRAP T-array-store-copies-both-ways.
    return this.checkRows({ ...result, rows: result.rows.map((r) => ({ ...r })) });
  }

  byKey(key: unknown): Promise<Row | undefined> {
    const row = this.#rows.find((r) => sameKey(readField(r, this.key), key));
    return Promise.resolve(row ? { ...row } : undefined);
  }

  async insert(values: Row): Promise<Row> {
    // CHECKED FIRST, so a refused row is never pushed and never announced.
    const row = { ...(await this.check(values)) };
    this.#rows.push(row);
    // …then hold the cap, BEFORE the announce —
    // TRAP T-max-rows-is-oldest-out-by-insertion.
    this.#rows = this.#trim(this.#rows);
    this.announce({ type: 'insert', key: readField(row, this.key), row: { ...row } });
    return { ...row };
  }

  async update(key: unknown, values: Row): Promise<Row> {
    const i = this.#rows.findIndex((r) => sameKey(readField(r, this.key), key));
    if (i < 0) throw new Error(`ArrayStore: no row with ${this.key} ${String(key)}`);
    // MERGE, not replace, and the MERGED row is what gets checked —
    // TRAP T-array-store-copies-both-ways.
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

/**
 * Key comparison.
 *
 * TRAP T-numeric-keys-compare-as-strings — `'7' === 7` is false and would report
 * a row as missing.
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
 * while it is in flight — three bound components must not make three requests.
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
    // Forward the inner store's changes as our own, so a consumer never has to
    // know one store wraps another.
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
    // TRAP T-fetch-does-not-reject-on-404 — a missing endpoint would otherwise
    // read as an empty result set.
    if (!response.ok) {
      throw new Error(`JsonStore: ${url} responded ${response.status} ${response.statusText}`);
    }
    const body: unknown = await response.json();
    this.#inner.setRows(rowsAt(body, rowsPath));
    this.#loaded = true;
  }

  async load(options: LoadOptions = {}): Promise<LoadResult> {
    await this.#ensure();
    // The inner ArrayStore holds no schema of its own, so the check happens once,
    // here — TRAP T-schema-guard-belongs-at-the-store.
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
 * TRAP T-rest-update-is-patch-not-put — the SERVER filters, sorts and pages, and
 * `load` passes the options through as query parameters.
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
    // TRAP T-rest-update-is-patch-not-put.
    const reported = this.#options.totalPath ? readPath(body, this.#options.totalPath) : undefined;
    const total = typeof reported === 'number' ? reported : rows.length;
    // THE LEAST TRUSTWORTHY PATH IN THE SYSTEM —
    // TRAP T-read-check-drops-where-a-write-throws.
    return this.checkRows({ rows, total });
  }

  async byKey(key: unknown): Promise<Row | undefined> {
    const url = `${this.#options.url}/${encodeURIComponent(String(key))}`;
    try {
      return await this.#request<Row>(url, { method: 'GET' });
    } catch (error) {
      // A 404 is an ANSWER — TRAP T-fetch-does-not-reject-on-404.
      if (error instanceof HttpError && error.status === 404) return undefined;
      throw error;
    }
  }

  async insert(values: Row): Promise<Row> {
    // CHECKED BEFORE SENDING, and again on the way back —
    // TRAP T-schema-guard-belongs-at-the-store.
    const checked = await this.check(values);
    const row = await this.#request<Row>(this.#options.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(checked),
    });
    // The server's own row wins when it sends one — it may have filled in an id.
    const saved = row ? await this.check(row) : checked;
    this.announce({ type: 'insert', key: readField(saved, this.key), row: saved });
    return saved;
  }

  async update(key: unknown, values: Row): Promise<Row> {
    const url = `${this.#options.url}/${encodeURIComponent(String(key))}`;
    const row = await this.#request<Row>(url, {
      // TRAP T-rest-update-is-patch-not-put — PUT would blank everything not sent.
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(values),
    });
    // The RESPONSE is checked, the patch is not —
    // TRAP T-rest-update-is-patch-not-put.
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
    // TRAP T-fetch-does-not-reject-on-404.
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
 * Deliberately plain: ONE obvious default and an easy override, because every
 * API names these differently.
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
 * TRAP T-local-store-is-not-for-bulk-data — synchronous, strings only, ~5MB, and
 * every access can throw.
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
      // TRAP T-local-store-is-not-for-bulk-data.
      return [];
    }
  }

  #write(rows: readonly Row[]): void {
    try {
      this.#storage?.setItem(this.#options.name, JSON.stringify(rows));
    } catch {
      // Quota exceeded, or storage blocked —
      // TRAP T-storage-access-throws.
    }
  }

  load(options: LoadOptions = {}): Promise<LoadResult> {
    return this.checkRows(applyOptions(this.#read(), options));
  }

  byKey(key: unknown): Promise<Row | undefined> {
    return Promise.resolve(this.#read().find((r) => sameKey(readField(r, this.key), key)));
  }

  async insert(values: Row): Promise<Row> {
    // CHECKED FIRST, so a refused row never reaches storage.
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
    // TRAP T-array-store-copies-both-ways.
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
