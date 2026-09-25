/**
 * idb-store.ts — records in IndexedDB, the one local store that survives a reload.
 *
 * Apart from stores.ts: it alone has a migration, a connection and a version.
 *
 * TRAP T-idb-is-the-only-real-local-store
 * TRAP T-idb-open-is-a-handshake-not-a-call
 * TRAP T-idb-index-narrows-it-never-answers-it
 *
 * Map:
 * - IdbStoreOptions — which database and store, its indexes, and the version that builds them
 * - IdbStore — Records in IndexedDB — the real local store.
 */
import {
  applyOptions,
  readField,
  sameKey,
  type Filter,
  type FilterClause,
  type LoadOptions,
  type LoadResult,
  type Row,
} from '../data/store.js';
import { ValidationError } from '../data/validate.js';
// Key, schema guard, totalCount, announce. TRAP T-one-class-to-catch
import { BaseStore, type StoreOptions } from '../data/base-store.js';

/* ── Options ───────────────────────────────────────────────────────────── */

export interface IdbStoreOptions extends StoreOptions {
  /** The object store's name, and the database's unless `database` says otherwise. */
  name: string;
  /** Defaults to `sherpa`, so several stores share one database. */
  database?: string;
  /** Fields to INDEX — a pre-filter, never the answer. */
  indexes?: readonly string[];
  /** Bump when `indexes` changes: indexes are built only in an upgrade. */
  version?: number;
}

/* ── The store ─────────────────────────────────────────────────────────── */

/** Records in IndexedDB — the real local store. */
export class IdbStore extends BaseStore {
  /** Which database and store, and its version. */
  readonly #options: IdbStoreOptions;
  /** The row cap, oldest out first; 0 for none. */
  readonly #maxRows: number;
  /** The fields IndexedDB indexes. */
  readonly #indexes: readonly string[];

  /** A PROMISE, so concurrent loads share ONE `open()` and never race upgrades. */
  #opening: Promise<IDBDatabase> | null = null;

  constructor(options: IdbStoreOptions) {
    super(options);
    this.#options = options;
    this.#maxRows = options.maxRows && options.maxRows > 0 ? options.maxRows : 0;
    this.#indexes = options.indexes ?? [];
  }

  /** Whether this browser has IndexedDB at all. */
  static get available(): boolean {
    try {
      return typeof indexedDB !== 'undefined' && indexedDB !== null;
    } catch {
      // TRAP T-storage-access-throws — reading the global itself can throw.
      return false;
    }
  }

  /* ── Connection ──────────────────────────────────────────────────── */

  /** The open database. REJECTS rather than reading as empty — empty means saved-into-nothing. */
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

        // ONLY here — a new index needs `version` bumped.
        for (const field of this.#indexes) {
          if (!store.indexNames.contains(field)) store.createIndex(field, field);
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        // Another tab is blocked on a higher version; closing is the only answer.
        db.onversionchange = () => {
          db.close();
          this.#opening = null;
        };
        resolve(db);
      };

      request.onerror = () => reject(request.error ?? new Error('IdbStore: open failed'));
      request.onblocked = () => reject(new Error('IdbStore: open blocked by another tab'));
    });

    // Never cache a FAILED open: storage may be granted later in the session.
    this.#opening.catch(() => { this.#opening = null; });
    return this.#opening;
  }

  /** Close the connection. The next call re-opens. */
  close(): void {
    const opening = this.#opening;
    this.#opening = null;
    void opening?.then((db) => db.close()).catch(() => { /* never opened */ });
  }

  /** Delete every record; the store and its indexes stay. TRAP T-idb-clear-is-not-a-reset */
  async clear(): Promise<void> {
    const db = await this.#db();
    await promised(this.#tx(db, 'readwrite').clear());
    this.announce({ type: 'remove' });
  }

  /* ── Reads ───────────────────────────────────────────────────────── */

  async load(options: LoadOptions = {}): Promise<LoadResult> {
    const rows = await this.#readRows(options.filter);
    // The index only NARROWED the read; applyOptions still decides.
    return this.checkRows(applyOptions(rows, options));
  }

  async byKey(key: unknown): Promise<Row | undefined> {
    const db = await this.#db();
    // A wrong-TYPE key throws rather than missing.
    let row: Row | undefined;
    try {
      row = await promised<Row | undefined>(this.#tx(db, 'readonly').get(key as IDBValidKey));
    } catch {
      return undefined;
    }
    if (row) return { ...row };
    // TRAP T-numeric-keys-compare-as-strings — fall back to string comparison.
    const all = await this.#readRows();
    const found = all.find((r) => sameKey(readField(r, this.key), key));
    return found ? { ...found } : undefined;
  }

  /* ── Writes ──────────────────────────────────────────────────────── */

  async insert(values: Row): Promise<Row> {
    // CHECKED FIRST, so a refused row never reaches the database.
    const row = { ...(await this.check(values)) };
    const db = await this.#db();
    await promised(this.#tx(db, 'readwrite').add(row));
    await this.#trim();
    this.announce({ type: 'insert', key: readField(row, this.key), row: { ...row } });
    return { ...row };
  }

  async update(key: unknown, values: Row): Promise<Row> {
    const existing = await this.byKey(key);
    if (!existing) throw new Error(`IdbStore: no row with ${this.key} ${String(key)}`);
    // MERGE, not replace, and the MERGED row is what gets checked.
    const row = await this.check({ ...existing, ...values });
    const db = await this.#db();
    await promised(this.#tx(db, 'readwrite').put({ ...row }));
    this.announce({ type: 'update', key, row: { ...row } });
    return { ...row };
  }

  async remove(key: unknown): Promise<void> {
    const existing = await this.byKey(key);
    if (!existing) throw new Error(`IdbStore: no row with ${this.key} ${String(key)}`);
    const db = await this.#db();
    // The row's OWN key, not the caller's — byKey accepts '7' for 7, delete would not.
    await promised(this.#tx(db, 'readwrite').delete(readField(existing, this.key) as IDBValidKey));
    this.announce({ type: 'remove', key });
  }

  /**
   * Write MANY rows in ONE transaction, with ONE `change` event. `replace`
   * clears first, so a row the server deleted cannot survive locally.
   *
   * TRAP T-idb-bulk-is-one-transaction
   */
  async putAll(rows: readonly Row[], options: { replace?: boolean } = {}): Promise<number> {
    const checked: Row[] = [];
    // CHECKED BEFORE THE TRANSACTION OPENS: a transaction auto-commits on any
    // await that is not one of its own requests.
    for (const row of rows) checked.push({ ...(await this.check(row)) });

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
    this.announce({ type: 'update' });
    return checked.length;
  }

  /* ── Internals ───────────────────────────────────────────────────── */

  /** This store's object store, inside a fresh transaction. */
  #tx(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
    return db.transaction(this.#options.name, mode).objectStore(this.#options.name);
  }

  /** Rows a filter could match. What no index narrows reads whole — slower, not wrong. */
  async #readRows(filter?: Filter): Promise<Row[]> {
    const db = await this.#db();
    const range = this.#rangeFor(filter);
    if (!range) return promised<Row[]>(this.#tx(db, 'readonly').getAll());

    const index = this.#tx(db, 'readonly').index(range.field);
    return promised<Row[]>(index.getAll(range.range));
  }

  /**
   * A key range for a filter, when one exists. A WRONG range would drop
   * matching rows, so this refuses far more than it accepts.
   *
   * TRAP T-idb-index-narrows-it-never-answers-it
   */
  #rangeFor(filter?: Filter): { field: string; range: IDBKeyRange } | null {
    if (!filter) return null;

    // AND narrows by any ONE clause. OR cannot narrow: the second arm's rows
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

    /* NO RANGE FOR A STRING. An IndexedDB index is byte-exact; `applyOptions`
       lower-cases both sides. `IDBKeyRange.only('gold')` therefore skipped
       every row holding 'Gold' — the seek ANSWERED the query instead of
       narrowing it, and a chip picking one value returned nothing while two
       values, which build an `in` and take no range, returned 27.
       TRAP T-idb-index-narrows-it-never-answers-it */
    if (typeof value === 'string') return null;
    if (Array.isArray(value) && value.some((v) => typeof v === 'string')) return null;

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
        // `startswith` and `in` take no range: the first needs a prefix scan
        // the collation cannot give, the second needs several.
        default: return null;
      }
    } catch {
      // Not a valid key. Not a narrowing; read everything.
      return null;
    }
  }

  /** Drop rows past `maxRows`, OLDEST first — pair it with an ascending key, not a uuid.
   *  TRAP T-max-rows-is-oldest-out-by-insertion */
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

}

/**
 * An alias now, not a private copy — an `instanceof ValidationError` used to
 * miss every IndexedDB refusal. TRAP T-one-class-to-catch
 *
 * @deprecated Catch `ValidationError`.
 */
export { ValidationError as IdbValidationError };

/* ── Helpers ───────────────────────────────────────────────────────────── */

/** One IDBRequest as a promise. */
function promised<T>(request: IDBRequest): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result as T);
    request.onerror = () => reject(request.error ?? new Error('IdbStore: request failed'));
  });
}
