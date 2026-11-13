/**
 * idb-store.ts — records in IndexedDB, the one local store that survives a reload.
 * Every IdbStore keeps its rows in the one Sherpa database, under its name.
 *
 * TRAP T-idb-is-the-only-real-local-store
 * TRAP T-one-browser-database
 * TRAP T-idb-index-narrows-it-never-answers-it
 *
 * Map:
 * - IdbStoreOptions — the store's name in the one database, and the fields it indexes
 * - LocalRecordsOptions — an IdbStore's options, and the rows a first run starts with
 * - localRecords — Records kept in this browser: IndexedDB where it has it, memory where not, seeded once per seed version.
 * - typeStore — A type's store: local records made from it, seeded with its rows, the version a hash of them.
 * - IdbStore — Records in IndexedDB — the real local store.
 */
import {
  readField,
  sameKey,
  type Filter,
  type FilterClause,
  type LoadOptions,
  type LoadResult,
  type Row,
  type Store,
} from '../data/store.js';
// Key, schema guard, totalCount, announce. TRAP T-one-class-to-catch
import { BaseStore, type StoreOptions } from '../data/base-store.js';
import { ArrayStore } from '../data/stores.js';
import { report } from '../data/report.js';
import { changedFields } from '../data/store-history.js';
import { seedVersionOf } from '../data/seed-version.js';
import { statusFields } from '../data/status-field.js';
import { typeStatusFields, typeStoreOptions, type TypeDefinition } from '../data/type-definition.js';
import { hasDatabase, openDatabase, readOne, transact, within, type RowRecord, type SeedRecord } from './database.js';

/** The door `localRecords` seeds through; no other module holds it. */
const SEED = Symbol('seed');

/* ── Options ───────────────────────────────────────────────────────────── */

export interface IdbStoreOptions extends StoreOptions {
  /** The store's name: its rows' place in the one database. */
  name: string;
  /** Fields to INDEX — a pre-filter, never the answer. */
  indexes?: readonly string[];
}

/** An IdbStore's options, and the rows a first run starts with. */
export interface LocalRecordsOptions extends IdbStoreOptions {
  /** The rows a first run starts with. */
  seed?: readonly Row[];
  /** Bump it when `seed` changes: a browser holding the old rows is given the
   *  new ones, and a row a person added stays. */
  seedVersion?: number;
}

/**
 * Records kept in this browser: IndexedDB where it has it, memory where not —
 * a private window, blocked site data — and seeded on a first run and again
 * when `seedVersion` moves. `ready` settles once the seed is in; await it
 * before a component draws. TRAP T-local-records-seed-themselves
 */
export function localRecords(options: LocalRecordsOptions): { store: IdbStore | ArrayStore; ready: Promise<void> } {
  const { seed = [], seedVersion = 1, name, indexes: _indexes, ...kept } = options;
  if (!IdbStore.available) return { store: new ArrayStore([...seed], kept), ready: Promise.resolve() };
  const store = new IdbStore(options);
  const ready = (async () => {
    if (!seed.length) return;
    try {
      await store[SEED](seed, seedVersion);
    } catch (error) {
      report({
        code: 'seed-failed',
        message: 'localRecords: the seed rows could not be written, so the store starts as it is.',
        at: { store: name, error: error instanceof Error ? error.message : String(error) },
      });
    }
  })();
  return { store, ready };
}

/** A type's store: local records made from it (its key, time and rules), seeded with its rows — the seed's version a
 *  hash of them, so changed rows are a new seed and no one bumps a number — its status fields worked out. `ready`
 *  settles once the seed is in. Its name, the type's id unless given. Plan 960 U3 · TRAP T-local-records-seed-themselves */
export function typeStore(type: TypeDefinition, { rows = [], name = type.id }: { rows?: readonly Row[]; name?: string } = {}): { store: Store; ready: Promise<void> } {
  const { store, ready } = localRecords({ name, ...typeStoreOptions(type), seed: rows, seedVersion: seedVersionOf(rows) });
  const status = typeStatusFields(type);
  return { store: Object.keys(status).length ? statusFields(store, status) : store, ready };
}

/* ── The store ─────────────────────────────────────────────────────────── */

/** Records in IndexedDB — the real local store. */
export class IdbStore extends BaseStore {
  /** Its rows' place in the one database. */
  readonly #name: string;
  /** The row cap, oldest out first; 0 for none. */
  readonly #maxRows: number;
  /** The fields its rows are sought by. */
  readonly #indexes: readonly string[];

  constructor(options: IdbStoreOptions) {
    // A whole read returns its rows by key.
    super(options, { rowOrder: 'key' });
    this.#name = options.name;
    this.#maxRows = options.maxRows && options.maxRows > 0 ? options.maxRows : 0;
    this.#indexes = options.indexes ?? [];
  }

  /** Whether this browser has IndexedDB at all. */
  static get available(): boolean {
    return hasDatabase();
  }

  /** Delete every row of this store; the others stay. TRAP T-idb-clear-is-not-a-reset */
  async clear(): Promise<void> {
    await transact('rows', 'readwrite', (tx) => { tx.objectStore('rows').delete(this.#all()); });
    this.announce({ type: 'remove' });
  }

  /* ── Reads ───────────────────────────────────────────────────────── */

  async load(options: LoadOptions = {}): Promise<LoadResult> {
    const rows = await this.#readRows(options.filter);
    // The index only NARROWED the read; `page` still decides — checked, then cut.
    return this.page(rows, options);
  }

  async byKey(key: unknown): Promise<Row | undefined> {
    await openDatabase();
    // A wrong-TYPE key throws rather than missing.
    let record: RowRecord | undefined;
    try {
      record = await readOne('rows', [this.#name, key as IDBValidKey]);
    } catch {
      return undefined;
    }
    if (record) return record.row;
    // TRAP T-numeric-keys-compare-as-strings — fall back to string comparison.
    const all = await this.#readRows();
    return all.find((r) => sameKey(readField(r, this.key), key));
  }

  /* ── Writes ──────────────────────────────────────────────────────── */

  async insert(values: Row): Promise<Row> {
    // CHECKED FIRST, so a refused row never reaches the database.
    const row = { ...(await this.check(values)) };
    await transact('rows', 'readwrite', (tx) => tx.objectStore('rows').add(this.#record(row)));
    const trimmed = await this.#trim();
    this.announce({ type: 'insert', key: readField(row, this.key), row: { ...row }, ...(trimmed.length ? { trimmed } : {}) });
    return { ...row };
  }

  async update(key: unknown, values: Row): Promise<Row> {
    const existing = await this.byKey(key);
    if (!existing) throw new Error(`IdbStore: no row with ${this.key} ${String(key)}`);
    // MERGE, not replace, and the MERGED row is what gets checked.
    const row = await this.check({ ...existing, ...values });
    const was = readField(existing, this.key);
    await transact('rows', 'readwrite', (tx) => {
      const rows = tx.objectStore('rows');
      if (sameKey(readField(row, this.key), was)) return rows.put(this.#record(row));
      /* A changed KEY moves the row, as ArrayStore's does: the old one goes in
         the same transaction, and a key another row holds is refused — the
         delete rolls back with it. TRAP T-a-changed-key-moves-the-row */
      rows.delete([this.#name, was as IDBValidKey]);
      return rows.add(this.#record(row));
    });
    this.journaled(existing, row);
    this.announce({ type: 'update', key, row: { ...row }, fields: changedFields(existing, row, values) });
    return { ...row };
  }

  async remove(key: unknown): Promise<void> {
    const existing = await this.byKey(key);
    if (!existing) throw new Error(`IdbStore: no row with ${this.key} ${String(key)}`);
    // The row's OWN key, not the caller's — byKey accepts '7' for 7, delete would not.
    await transact('rows', 'readwrite', (tx) => { tx.objectStore('rows').delete([this.#name, readField(existing, this.key) as IDBValidKey]); });
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
    await transact('rows', 'readwrite', (tx) => {
      const store = tx.objectStore('rows');
      if (options.replace) store.delete(this.#all());
      for (const row of checked) store.put(this.#record(row));
    });
    await this.#trim();
    this.announce({ type: 'update' });
    return checked.length;
  }

  /** Seed where the mark beside the rows is another version, or the store is
   *  empty: rows and mark in ONE transaction that reads the mark first, so a page
   *  and its worker seed once between them. Checked before it opens: the first to
   *  ask, the page, seeds. TRAP T-local-records-seed-themselves */
  async [SEED](seed: readonly Row[], version: number): Promise<void> {
    const checked: Row[] = [];
    for (const row of seed) checked.push({ ...(await this.check(row)) });
    const wrote = await transact<boolean>(['rows', 'seeds'], 'readwrite', (tx) => {
      const rows = tx.objectStore('rows');
      const marks = tx.objectStore('seeds');
      let put = false;
      const mark = marks.get(this.#name);
      const counted = rows.count(this.#all());
      counted.onsuccess = () => {
        if ((mark.result as SeedRecord | undefined)?.version === version && counted.result > 0) return;
        for (const row of checked) rows.put(this.#record(row));
        marks.put({ store: this.#name, version } satisfies SeedRecord);
        put = true;
      };
      return () => put;
    });
    if (!wrote) return;
    await this.#trim();
    this.announce({ type: 'update' });
  }

  /* ── Internals ───────────────────────────────────────────────────── */

  /** Every key of this store's rows. */
  #all(): IDBKeyRange {
    return within(this.#name);
  }

  /** A row as the database keeps it: under this store, by its key, sought by its indexed fields. */
  #record(row: Row): RowRecord {
    const seek: [string, string, IDBValidKey][] = [];
    for (const field of this.#indexes) {
      const value = readField(row, field);
      // What IndexedDB can key: a number, a string, a real date.
      if ((typeof value === 'number' && !Number.isNaN(value)) || typeof value === 'string'
        || (value instanceof Date && !Number.isNaN(value.getTime()))) seek.push([this.#name, field, value]);
    }
    return { store: this.#name, key: readField(row, this.key) as IDBValidKey, row, ...(seek.length ? { seek } : {}) };
  }

  /** Rows a filter could match. What no index narrows reads whole — slower, not wrong. */
  async #readRows(filter?: Filter): Promise<Row[]> {
    const records = await transact<RowRecord[]>('rows', 'readonly', (tx) => {
      const rows = tx.objectStore('rows');
      const range = this.#rangeFor(filter);
      return range ? rows.index('seek').getAll(range) : rows.getAll(this.#all());
    });
    return records.map((record) => record.row);
  }

  /**
   * A range of the `seek` index for a filter, when one exists. A WRONG range
   * would drop matching rows, so this refuses far more than it accepts.
   *
   * TRAP T-idb-index-narrows-it-never-answers-it
   */
  #rangeFor(filter?: Filter): IDBKeyRange | null {
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
       lower-cases both sides, so a seek for 'gold' would skip every 'Gold'.
       TRAP T-idb-index-narrows-it-never-answers-it */
    if (typeof value === 'string') return null;
    // Only `between` takes a pair; an indexed value is never an array.
    if (Array.isArray(value) && (op !== 'between' || value.some((v) => typeof v === 'string'))) return null;

    // `[store, field]` sorts before each of its values, `[store, field, []]` after.
    const at = (v: unknown): IDBValidKey => [this.#name, field, v as IDBValidKey];
    const first = [this.#name, field];
    const last = [this.#name, field, []];
    try {
      switch (op) {
        case 'eq': return IDBKeyRange.only(at(value));
        case 'gt': return IDBKeyRange.bound(at(value), last, true, true);
        case 'gte': return IDBKeyRange.bound(at(value), last, false, true);
        case 'lt': return IDBKeyRange.bound(first, at(value), true, true);
        case 'lte': return IDBKeyRange.bound(first, at(value), true, false);
        case 'between': {
          const pair = value as unknown[];
          if (!Array.isArray(pair) || pair.length < 2) return null;
          if (pair[0] == null || pair[1] == null) return null;
          return IDBKeyRange.bound(at(pair[0]), at(pair[1]));
        }
        // `startswith` and `in` take no range: the first needs a prefix scan
        // the collation cannot give, the second needs several.
        default: return null;
      }
    } catch {
      // Not a valid key, or a range upside down. Not a narrowing; read everything.
      return null;
    }
  }

  /** Drop rows past `maxRows`, OLDEST first — pair it with an ascending key, not a uuid.
   *  The keys it dropped. TRAP T-max-rows-is-oldest-out-by-insertion */
  async #trim(): Promise<unknown[]> {
    const trimmed: unknown[] = [];
    if (!this.#maxRows) return trimmed;
    await transact('rows', 'readwrite', (tx) => {
      const rows = tx.objectStore('rows');
      const counted = rows.count(this.#all());
      counted.onsuccess = () => {
        let excess = counted.result - this.#maxRows;
        if (excess <= 0) return;
        const cursor = rows.openCursor(this.#all());
        cursor.onsuccess = () => {
          const at = cursor.result;
          if (!at || excess-- <= 0) return;
          trimmed.push((at.primaryKey as IDBValidKey[])[1]);
          at.delete();
          at.continue();
        };
      };
    });
    return trimmed;
  }
}
