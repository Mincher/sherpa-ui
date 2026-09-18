/**
 * idb-store.ts — records in IndexedDB.
 *
 *   const store = new IdbStore({ name: 'customers', indexes: ['tier'] });
 *   const source = new DataSource({ store, pageSize: 25 });
 *
 * WHY A FOURTH LOCAL STORE. `ArrayStore` holds records for one page load;
 * `LocalStore` holds a few kilobytes of preferences
 * (`T-local-store-is-not-for-bulk-data`); `SessionStore` holds app state. None
 * of them holds a working set of records that survives a reload, and a grouped
 * grid now needs every matching row in hand at once
 * (`T-grouped-paging-belongs-to-the-view`). That is what this is for.
 *
 * TRAP T-idb-is-the-only-real-local-store — the size, the async-ness and the
 * three ways it is not Web Storage.
 * TRAP T-idb-open-is-a-handshake-not-a-call — why every method awaits `#db()`.
 * TRAP T-idb-index-narrows-it-never-answers-it — the index is a PRE-FILTER;
 * `applyOptions` still decides.
 *
 * SEPARATE FROM stores.ts on purpose: this is the one store with a schema
 * migration, a connection to hold and a version to bump, and putting that
 * beside four stores that have none buried it.
 */
import {
  applyOptions,
  readField,
  type Filter,
  type FilterClause,
  type LoadOptions,
  type LoadResult,
  type Row,
  type Store,
  type StoreChangeDetail,
} from './store.js';
import { validate, type Issue, type StandardSchema } from './validate.js';

/* ── Options ───────────────────────────────────────────────────────────── */

export interface IdbStoreOptions {
  /** The object store's name, and the database's unless `database` says otherwise. */
  name: string;
  /** The database name. Defaults to `sherpa`, so several stores share one. */
  database?: string;
  /** The field holding each row's identity. Default `'id'`. */
  key?: string;
  /**
   * Fields to build an INDEX on.
   *
   * TRAP T-idb-index-narrows-it-never-answers-it — an index makes a filter on
   * that field read a slice rather than the whole table. It never changes the
   * ANSWER, only how much is read to reach it.
   */
  indexes?: readonly string[];
  /**
   * Bump when `indexes` changes. IndexedDB only builds indexes inside an
   * upgrade, so a new index on an old version is silently absent.
   *
   * TRAP T-idb-open-is-a-handshake-not-a-call.
   */
  version?: number;
  /** Check every row the store WRITES, and refuse the ones that fail. */
  schema?: StandardSchema;
  /** On a READ, check only the first N rows. 0 or absent = all of them. */
  sample?: number;
  /**
   * Keep at most this many rows, dropping the OLDEST first — by INSERTION, the
   * same rule `ArrayStore` follows (`T-max-rows-is-oldest-out-by-insertion`).
   */
  maxRows?: number;
}

/* ── The store ─────────────────────────────────────────────────────────── */

/**
 * Records in IndexedDB — the real local store.
 *
 * Extends EventTarget so `change` is a real DOM event, exactly as the other
 * stores do: a `DataSource` subscribes with its usual `addEventListener`.
 */
export class IdbStore extends EventTarget implements Store {
  readonly key: string;
  readonly #options: IdbStoreOptions;
  readonly #schema: StandardSchema | undefined;
  readonly #sampleSize: number;
  readonly #maxRows: number;
  readonly #indexes: readonly string[];

  /**
   * The open connection, as a PROMISE.
   *
   * A promise and not a database, so twenty concurrent loads on first paint
   * share ONE `open()` rather than racing twenty upgrade transactions.
   * TRAP T-idb-open-is-a-handshake-not-a-call.
   */
  #opening: Promise<IDBDatabase> | null = null;

  constructor(options: IdbStoreOptions) {
    super();
    this.#options = options;
    this.key = options.key ?? 'id';
    this.#schema = options.schema;
    this.#sampleSize = options.sample ?? 0;
    this.#maxRows = options.maxRows && options.maxRows > 0 ? options.maxRows : 0;
    this.#indexes = options.indexes ?? [];
  }

  /** Whether this browser has IndexedDB at all — see `#db`. */
  static get available(): boolean {
    try {
      return typeof indexedDB !== 'undefined' && indexedDB !== null;
    } catch {
      // TRAP T-storage-access-throws — reading the global itself can throw.
      return false;
    }
  }

  /* ── Connection ──────────────────────────────────────────────────── */

  /**
   * The open database.
   *
   * REJECTS rather than returning null, because unlike `LocalStore` there is no
   * honest empty answer: a store that silently reads as empty would let an app
   * write records into nothing and call it saved.
   * TRAP T-idb-is-the-only-real-local-store.
   */
  #db(): Promise<IDBDatabase> {
    if (this.#opening) return this.#opening;

    this.#opening = new Promise<IDBDatabase>((resolve, reject) => {
      if (!IdbStore.available) {
        reject(new Error('IdbStore: IndexedDB is unavailable'));
        return;
      }

      const dbName = this.#options.database ?? 'sherpa';
      const version = this.#options.version ?? 1;
      let request: IDBOpenDBRequest;
      try {
        request = indexedDB.open(dbName, version);
      } catch (error) {
        // A private window, or site data blocked — TRAP T-storage-access-throws.
        reject(error instanceof Error ? error : new Error(String(error)));
        return;
      }

      request.onupgradeneeded = () => {
        const db = request.result;
        const store = db.objectStoreNames.contains(this.#options.name)
          ? request.transaction!.objectStore(this.#options.name)
          : db.createObjectStore(this.#options.name, { keyPath: this.key });

        // Indexes are built ONLY here. An index named in options but absent
        // from an existing version needs `version` bumped — the constructor
        // cannot detect that, so the doc says so instead.
        for (const field of this.#indexes) {
          if (!store.indexNames.contains(field)) store.createIndex(field, field);
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        // ANOTHER TAB asked for a higher version and is blocked until this one
        // lets go. Closing is the only cooperative answer; the next call
        // re-opens at the new version.
        db.onversionchange = () => {
          db.close();
          this.#opening = null;
        };
        resolve(db);
      };

      request.onerror = () => reject(request.error ?? new Error('IdbStore: open failed'));
      request.onblocked = () => reject(new Error('IdbStore: open blocked by another tab'));
    });

    // A FAILED open must not be cached, or one private-window rejection
    // poisons every later call in a session that may since have been granted
    // storage.
    this.#opening.catch(() => { this.#opening = null; });
    return this.#opening;
  }

  /** Close the connection. The next call re-opens. */
  close(): void {
    const opening = this.#opening;
    this.#opening = null;
    void opening?.then((db) => db.close()).catch(() => { /* never opened */ });
  }

  /**
   * Delete every record. The object store and its indexes stay.
   *
   * TRAP T-idb-clear-is-not-a-reset — the SHAPE survives, so a changed `indexes`
   * still needs a `version` bump.
   */
  async clear(): Promise<void> {
    const db = await this.#db();
    await promised(this.#tx(db, 'readwrite').clear());
    this.#announce({ type: 'remove' });
  }

  /* ── Reads ───────────────────────────────────────────────────────── */

  async load(options: LoadOptions = {}): Promise<LoadResult> {
    const rows = await this.#readRows(options.filter);
    // The index only NARROWED the read. applyOptions still filters, sorts,
    // searches and pages — TRAP T-idb-index-narrows-it-never-answers-it.
    return this.#checkRows(applyOptions(rows, options));
  }

  async byKey(key: unknown): Promise<Row | undefined> {
    const db = await this.#db();
    // The keyPath is `this.key`, so IndexedDB answers this itself — no scan.
    // A key of the wrong TYPE throws rather than missing, so a string '7' for a
    // numeric key is caught here and read as absent.
    let row: Row | undefined;
    try {
      row = await promised<Row | undefined>(this.#tx(db, 'readonly').get(key as IDBValidKey));
    } catch {
      return undefined;
    }
    if (row) return { ...row };
    // TRAP T-numeric-keys-compare-as-strings — '7' and 7 are different KEYS to
    // IndexedDB, so a miss falls back to the string comparison the other stores
    // use rather than reporting a row that exists as absent.
    const all = await this.#readRows();
    const found = all.find((r) => sameKey(readField(r, this.key), key));
    return found ? { ...found } : undefined;
  }

  async totalCount(options?: LoadOptions): Promise<number> {
    // skip/take are dropped: a COUNT is of the matches, not of one page.
    const { skip: _skip, take: _take, ...rest } = options ?? {};
    const result = await this.load(rest);
    return result.total;
  }

  /* ── Writes ──────────────────────────────────────────────────────── */

  async insert(values: Row): Promise<Row> {
    // CHECKED FIRST, so a refused row never reaches the database.
    const row = { ...(await this.#check(values)) };
    const db = await this.#db();
    await promised(this.#tx(db, 'readwrite').add(row));
    await this.#trim();
    this.#announce({ type: 'insert', key: readField(row, this.key), row: { ...row } });
    return { ...row };
  }

  async update(key: unknown, values: Row): Promise<Row> {
    const existing = await this.byKey(key);
    if (!existing) throw new Error(`IdbStore: no row with ${this.key} ${String(key)}`);
    // MERGE, not replace, and the MERGED row is what gets checked — the rule
    // every store in this layer follows (T-array-store-copies-both-ways).
    const row = await this.#check({ ...existing, ...values });
    const db = await this.#db();
    await promised(this.#tx(db, 'readwrite').put({ ...row }));
    this.#announce({ type: 'update', key, row: { ...row } });
    return { ...row };
  }

  async remove(key: unknown): Promise<void> {
    const existing = await this.byKey(key);
    if (!existing) throw new Error(`IdbStore: no row with ${this.key} ${String(key)}`);
    const db = await this.#db();
    // The row's OWN key, not the caller's — byKey accepts '7' for 7, and
    // delete would not.
    await promised(this.#tx(db, 'readwrite').delete(readField(existing, this.key) as IDBValidKey));
    this.#announce({ type: 'remove', key });
  }

  /**
   * Write MANY rows in ONE transaction.
   *
   * TRAP T-idb-bulk-is-one-transaction — 10,000 rows through `insert()` is
   * 10,000 transactions and 10,000 `change` events; this is one of each. It is
   * what a sync down from a server uses, and what seeds a store on first run.
   *
   * `replace` clears the store first — for a full refresh, where a row the
   * server deleted must not survive locally.
   */
  async putAll(rows: readonly Row[], options: { replace?: boolean } = {}): Promise<number> {
    const checked: Row[] = [];
    // CHECKED BEFORE THE TRANSACTION OPENS. An IndexedDB transaction
    // auto-commits the moment it stops having work, and an `await` on anything
    // else — a schema's async validate — is exactly that pause. Every await
    // that is not a request of this transaction must happen first.
    for (const row of rows) checked.push({ ...(await this.#check(row)) });

    const db = await this.#db();
    const tx = db.transaction(this.#options.name, 'readwrite');
    const store = tx.objectStore(this.#options.name);
    if (options.replace) store.clear();
    for (const row of checked) store.put(row);

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('IdbStore: bulk write failed'));
      tx.onabort = () => reject(tx.error ?? new Error('IdbStore: bulk write aborted'));
    });

    await this.#trim();
    // ONE event for the batch — see the trap. A DataSource reloads once.
    this.#announce({ type: 'update' });
    return checked.length;
  }

  /* ── Internals ───────────────────────────────────────────────────── */

  /** This store's object store, inside a fresh transaction. */
  #tx(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
    return db.transaction(this.#options.name, mode).objectStore(this.#options.name);
  }

  /**
   * Read the rows a filter could possibly match.
   *
   * TRAP T-idb-index-narrows-it-never-answers-it — a NARROWING, never an
   * answer. Anything this cannot narrow reads the whole store, which is correct
   * and merely slower.
   */
  async #readRows(filter?: Filter): Promise<Row[]> {
    const db = await this.#db();
    const range = this.#rangeFor(filter);
    if (!range) return promised<Row[]>(this.#tx(db, 'readonly').getAll());

    const index = this.#tx(db, 'readonly').index(range.field);
    return promised<Row[]>(index.getAll(range.range));
  }

  /**
   * An IndexedDB key range for a filter, when one exists.
   *
   * ONLY an indexed field, and only the operators a range can express. A
   * clause this cannot narrow returns null and the caller reads everything —
   * a WRONG range would drop matching rows, so this refuses far more than it
   * accepts.
   */
  #rangeFor(filter?: Filter): { field: string; range: IDBKeyRange } | null {
    if (!filter) return null;

    // An AND group narrows by any ONE of its clauses — the others still run in
    // applyOptions. An OR cannot narrow at all: a row matching the second arm
    // may sit outside the first arm's range.
    if (filter[0] === 'and') {
      for (const part of (filter as unknown[]).slice(1) as Filter[]) {
        const range = this.#rangeFor(part);
        if (range) return range;
      }
      return null;
    }
    if (filter[0] === 'or') return null;

    const [field, op, value] = filter as FilterClause;
    if (typeof field !== 'string' || !this.#indexes.includes(field)) return null;
    if (value == null) return null;

    try {
      switch (op) {
        case 'eq': return { field, range: IDBKeyRange.only(value as IDBValidKey) };
        case 'gt': return { field, range: IDBKeyRange.lowerBound(value as IDBValidKey, true) };
        case 'gte': return { field, range: IDBKeyRange.lowerBound(value as IDBValidKey) };
        case 'lt': return { field, range: IDBKeyRange.upperBound(value as IDBValidKey, true) };
        case 'lte': return { field, range: IDBKeyRange.upperBound(value as IDBValidKey) };
        case 'between': {
          const pair = value as unknown[];
          if (!Array.isArray(pair) || pair.length < 2) return null;
          if (pair[0] == null || pair[1] == null) return null;
          return {
            field,
            range: IDBKeyRange.bound(pair[0] as IDBValidKey, pair[1] as IDBValidKey),
          };
        }
        // `contains`, `startswith` and the rest are STRING operators. A
        // startswith range looks expressible and is not: it would need the
        // store's collation to match `applyOptions`'s case-insensitive
        // comparison, and it does not.
        default: return null;
      }
    } catch {
      // A value IndexedDB will not accept as a key — a plain object, NaN, a
      // boolean. Not a narrowing; read everything.
      return null;
    }
  }

  /**
   * Drop the oldest rows past `maxRows`.
   *
   * By INSERTION order, which for IndexedDB means the object store's own key
   * order — the same promise `ArrayStore` makes
   * (`T-max-rows-is-oldest-out-by-insertion`), and an honest one only while
   * keys ascend with time. A random uuid key makes this arbitrary, so the doc
   * says to pair `maxRows` with an ascending key.
   */
  async #trim(): Promise<void> {
    if (!this.#maxRows) return;
    const db = await this.#db();
    const count = await promised<number>(this.#tx(db, 'readonly').count());
    if (count <= this.#maxRows) return;

    const excess = count - this.#maxRows;
    const store = this.#tx(db, 'readwrite');
    await new Promise<void>((resolve, reject) => {
      let dropped = 0;
      const request = store.openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor || dropped >= excess) { resolve(); return; }
        cursor.delete();
        dropped += 1;
        cursor.continue();
      };
      request.onerror = () => reject(request.error ?? new Error('IdbStore: trim failed'));
    });
  }

  /**
   * Check a row against the schema, THROWING if it fails.
   *
   * The same contract as `BaseStore.check` — a throw not a `false`, the PARSED
   * value back, and no schema means no check
   * (`T-schema-guard-belongs-at-the-store`).
   */
  async #check(values: Row): Promise<Row> {
    if (!this.#schema) return values;
    const result = await validate(this.#schema, values);
    if (result.issues) throw new IdbValidationError(result.issues);
    return (result.value ?? values) as Row;
  }

  /**
   * Check rows ARRIVING, dropping the ones the schema refuses.
   *
   * `T-read-check-drops-where-a-write-throws` — one bad row in a thousand must
   * not empty a grid.
   */
  async #checkRows(result: LoadResult): Promise<LoadResult> {
    if (!this.#schema) return result;

    const limit = this.#sampleSize > 0
      ? Math.min(this.#sampleSize, result.rows.length)
      : result.rows.length;

    const rows: Row[] = [];
    const issues: Issue[] = [];
    for (let i = 0; i < limit; i++) {
      const row = result.rows[i]!;
      const checked = await validate(this.#schema, row);
      if (checked.issues) issues.push(...checked.issues);
      else rows.push((checked.value ?? row) as Row);
    }
    // The tail, UNCHECKED and unchanged — T-schema-sample-cost.
    for (let i = limit; i < result.rows.length; i++) rows.push(result.rows[i]!);

    const dropped = result.rows.length - rows.length;
    if (!dropped) return { ...result, rows };
    return {
      ...result,
      rows,
      total: Math.max(0, result.total - dropped),
      dropped,
      issues: issues.slice(0, 5),
    };
  }

  /** Tell every listener the records changed. */
  #announce(detail: StoreChangeDetail): void {
    this.dispatchEvent(new CustomEvent('change', { detail }));
  }
}

/** A write this store's schema refused. Carries the ISSUES, not just a message. */
export class IdbValidationError extends Error {
  readonly issues: ReadonlyArray<Issue>;

  constructor(issues: ReadonlyArray<Issue>) {
    super(issues.map((i) => `${String(i.path?.[0] ?? '')}: ${i.message}`.trim()).join('; '));
    this.name = 'ValidationError';
    this.issues = issues;
  }
}

/* ── Helpers ───────────────────────────────────────────────────────────── */

/** One IDBRequest as a promise. */
function promised<T>(request: IDBRequest): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result as T);
    request.onerror = () => reject(request.error ?? new Error('IdbStore: request failed'));
  });
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
