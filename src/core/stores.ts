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
   * A Standard Schema — `rules({...})` from validate.ts, or a Zod / Valibot /
   * ArkType schema. It is duck-typed, so passing one adds no dependency here.
   *
   * The guard belongs at the STORE rather than at the form, because a form is
   * not the only way a record arrives: a REST response, a paste, a script and a
   * second UI all reach the same records, and a rule enforced in one screen is
   * not a rule. The form should still validate — it is where a person can be
   * told what is wrong while they can still fix it — but this is the line
   * nothing crosses.
   */
  schema?: StandardSchema;
  /**
   * Keep at most this many rows, dropping the OLDEST first.
   *
   * A live feed grows without bound: a socket delivering an alert a second
   * fills a tab's memory overnight, and nobody scrolls to hour three anyway.
   * This is the one genuinely new piece a shared feed needs.
   *
   * OLDEST-OUT, by insertion order rather than by any field — a feed's order is
   * the order things happened, and the store does not know which field means
   * "when". A view that wants a different order sorts; the cap is about how much
   * is kept, not about what is shown.
   *
   * Applies on INSERT. Rows handed to the constructor or to `setRows()` are the
   * caller's own statement of what the store holds, and are trimmed to the cap
   * too — a cap that only some writes honour is not a cap.
   */
  maxRows?: number;
  /**
   * On a READ, check only the first N rows rather than every one.
   *
   * A schema costs real time on a bulk load — measured, 10,000 rows take 6ms
   * and 100,000 take 56ms, about 23× an unguarded load. That is a visible stall
   * on a big response, and it scales linearly.
   *
   * WHAT A SAMPLE IS FOR: a backend's rows are wrong in a SHAPE, not one at a
   * time. A field renamed, a date sent as a number, a null where a string was
   * promised — the first fifty rows say so as loudly as ten thousand. The
   * sample answers "is this response the shape I expect", which is the question
   * a read is really asking.
   *
   * WHAT IT IS NOT: a way to let bad rows through quietly. Rows beyond the
   * sample are passed along UNCHECKED, so a schema that RENAMES or COERCES must
   * not be sampled — the unchecked rows would keep the old shape and the two
   * halves of one response would disagree. Sample when the schema only VALIDATES.
   *
   * WRITES ARE ALWAYS CHECKED IN FULL. An insert or an update is one row a
   * person or a script is adding on purpose, and skipping it is how bad data
   * gets in. This is about reads only.
   */
  sample?: number;
}

/**
 * Shared plumbing: the key field, and announcing a change.
 *
 * Extends EventTarget so `change` is a real DOM event — no emitter to write, and
 * a DataSource subscribes with the same addEventListener it uses for everything.
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
   * A throw, not a `false`: an invalid write is an error the caller has to
   * handle, and a boolean return is the kind of thing a caller forgets to read —
   * the record would then silently not be saved while the UI said it was.
   *
   * Returns the schema's own PARSED value, because a schema may coerce ("42" →
   * 42) and the store should record what the schema settled on rather than what
   * arrived.
   *
   * No schema means no check: a store without one behaves exactly as it always
   * did, so this cannot break an existing caller.
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
   * The read counterpart of `check()`, and deliberately not the same shape.
   *
   * A WRITE throws: the caller handed over one row, it is wrong, and telling
   * them is the only useful answer. A READ cannot — one bad row in a thousand
   * would empty a grid, and a backend that adds a null next month would take
   * the screen down. So a bad row is DROPPED and COUNTED, and the count
   * travels on the LoadResult where a host can see it.
   *
   * A silent drop would be worse than a bad row: a schema that quietly rejects
   * 40% of a response looks like a backend outage. That is why `dropped` is
   * reported rather than merely handled.
   *
   * The schema's PARSED value is kept, not the input — a schema may rename
   * `customer_name` to `name` and coerce `"900"` to `900`, and that mapping is
   * the point of having one on a read at all.
   *
   * No schema means no check: a store without one behaves exactly as it always
   * did.
   */
  protected async checkRows(result: LoadResult): Promise<LoadResult> {
    if (!this.schema) return result;

    /* THE SAMPLE. `undefined` or 0 means check everything, which stays the
       default: a guard you have to opt out of is a guard people keep. */
    const limit = this.sampleSize && this.sampleSize > 0
      ? Math.min(this.sampleSize, result.rows.length)
      : result.rows.length;

    const rows: Row[] = [];
    const issues: Issue[] = [];
    for (let i = 0; i < limit; i++) {
      const row = result.rows[i]!;
      const checked = await validate(this.schema, row);
      if (checked.issues) issues.push(...checked.issues);
      else rows.push((checked.value ?? row) as Row);
    }
    // The tail, UNCHECKED and unchanged. See StoreOptions.sample for why a
    // renaming or coercing schema must not be sampled.
    for (let i = limit; i < result.rows.length; i++) rows.push(result.rows[i]!);

    const dropped = result.rows.length - rows.length;
    if (!dropped) return { ...result, rows };

    return {
      ...result,
      rows,
      // The TOTAL drops with them. A pager counting rows that were never shown
      // would offer a page that renders empty.
      total: Math.max(0, result.total - dropped),
      dropped,
      // The first few only. A broken backend produces one issue per row, and a
      // host wants to know WHAT is wrong, not to receive ten thousand copies.
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
 * Carries the ISSUES, not just a message, so a form can put each one beside the
 * field it belongs to — a single "invalid" string would force the UI to guess.
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
 * The array is COPIED in, and every row handed out is a copy too. A consumer
 * mutating a row it was given must not silently rewrite the store's own record —
 * that is the bug where a grid's edit appears to work and then vanishes on the
 * next reload, because the "change" was never actually recorded.
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
   * Returns the array it was given, trimmed in place where it can be — the
   * caller always owns a fresh copy by the time this runs.
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
    // Copies out, for the same reason as copies in.
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
    // …then hold the cap. A live feed inserts for ever; this is where it would
    // grow without bound. Trimmed BEFORE the announce, so a listener that reads
    // the store sees the same rows the store will hand out.
    this.#rows = this.#trim(this.#rows);
    this.announce({ type: 'insert', key: readField(row, this.key), row: { ...row } });
    return { ...row };
  }

  async update(key: unknown, values: Row): Promise<Row> {
    const i = this.#rows.findIndex((r) => sameKey(readField(r, this.key), key));
    if (i < 0) throw new Error(`ArrayStore: no row with ${this.key} ${String(key)}`);
    // MERGE, not replace: an update carries the fields that changed, and a caller
    // sending one field must not blank the rest.
    //
    // The MERGED row is what gets checked, not the patch. A schema sees whole
    // records, so checking `{ seats: 4 }` alone would fail every `required` rule
    // for a field the update simply did not mention.
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
    // The inner ArrayStore holds no schema of its own (see #ensure), so the
    // check happens once, here — never twice.
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
    // THE LEAST TRUSTWORTHY PATH IN THE SYSTEM — rows from somewhere else,
    // over a wire, shaped by a backend this code does not own. If a schema is
    // going to be applied anywhere on a read, it is here.
    return this.checkRows({ rows, total });
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
    // CHECKED BEFORE SENDING. A round trip to learn what the client already knew
    // is a wasted request, and a server that accepts a bad row leaves the UI
    // showing something the rules forbid.
    const checked = await this.check(values);
    const row = await this.#request<Row>(this.#options.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(checked),
    });
    // …and CHECKED AGAIN on the way back. A response is data from somewhere
    // else: the server may return a shape this app does not accept, and a bad
    // record reaching the UI is the failure the guard exists to stop. The
    // server's own row wins when it sends one, since it may have filled in an id.
    const saved = row ? await this.check(row) : checked;
    this.announce({ type: 'insert', key: readField(saved, this.key), row: saved });
    return saved;
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
    // The RESPONSE is checked, the patch is not. A PATCH body is a fragment — a
    // schema sees whole records, so checking `{ seats: 4 }` would fail every
    // `required` rule for a field this update simply did not mention. What comes
    // back IS the whole record, and that is what reaches the UI.
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
    // The MERGED row is checked, not the patch — see ArrayStore.update.
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
