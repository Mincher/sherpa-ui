/**
 * database.ts — the ONE Sherpa database in a browser: one name, one version, every
 * object store made in one upgrade, a typed record in each. A page and its worker
 * open the same one. TRAP T-one-browser-database · TRAP T-idb-open-is-a-handshake-not-a-call
 *
 * Map:
 * - DATABASE — The database's name, in a page and a worker alike.
 * - RowRecord — One row of an IdbStore, under its store's name and its key.
 * - SeedRecord — The seed version a store's rows were last seeded at.
 * - SetRecord — A remote store's held set, kept between sessions.
 * - OutboxRecord — A write that waits, in the outbox it waits in.
 * - NoticeRecord — A notice the worker keeps until a page has seen it.
 * - ViewRecord — One saved View of one page.
 * - EntityRecord — One entity of the reader's, of any type, app-wide.
 * - Records — Each object store, and the record it holds.
 * - hasDatabase — Whether this context has IndexedDB at all.
 * - openDatabase — The open database, shared by every part; REJECTS where there is none.
 * - keepData — Ask the device to keep Sherpa's data; the app calls it, Sherpa never asks on its own.
 * - transact — One transaction over the named object stores; settles once it commits.
 * - readAll — Every record of an object store, or those a key range holds.
 * - readOne — One record, by its key.
 * - write — Put records, in one transaction.
 * - erase — Delete one key, or every key in a range.
 * - clearStores — Empty object stores, in one transaction.
 * - within — Every compound key that starts with these parts.
 */
import type { OutboxEntry } from '../data/outbox.js';
import type { UpdateNotice } from '../data/notices.js';
import type { Row } from '../data/store.js';
import { nodeEntityOf, type Entity } from '../data/entity.js';
import type { NodeDefinition } from '../data/node-library.js';
import type { SavedView } from './persist-view.js';

/** The database's name, in a page and a worker alike. */
export const DATABASE = 'sherpa-ui';
/** Bump it with `SCHEMA`: a store is made only in an upgrade. */
const VERSION = 3;

/** One row of an IdbStore, under its store's name and its key. `seek` holds
 *  `[store, field, value]` for each indexed field. */
export interface RowRecord {
  store: string;
  key: IDBValidKey;
  row: Row;
  seek?: [string, string, IDBValidKey][];
}

/** The seed version a store's rows were last seeded at: here, where a worker reads it too. */
export interface SeedRecord {
  store: string;
  version: number;
}

/** A remote store's held set, kept between sessions. */
export interface SetRecord {
  name: string;
  /** The app's version of the rows' shape. */
  version: number;
  /** The store's key field: a copy kept under another is dropped. */
  key: string;
  savedAt: number;
  rows: Row[];
  dropped?: number;
}

/** A write that waits, in the outbox it waits in. */
export interface OutboxRecord extends OutboxEntry {
  outbox: string;
}

/** A notice the worker keeps until a page has seen it. */
export interface NoticeRecord extends UpdateNotice {
  id: string;
}

/** One saved View of one page. */
export interface ViewRecord {
  page: string;
  id: string;
  view: SavedView;
}

/** One entity of the reader's, of any type, app-wide (D13). */
export interface EntityRecord {
  id: string;
  entity: Entity;
}

/** Each object store, and the record it holds. */
export interface Records {
  rows: RowRecord;
  seeds: SeedRecord;
  sets: SetRecord;
  outbox: OutboxRecord;
  notices: NoticeRecord;
  views: ViewRecord;
  entities: EntityRecord;
}

type StoreName = keyof Records;

/** The fixed schema: each object store's key, and the one index. */
const SCHEMA: { readonly [S in StoreName]: { keyPath: string | string[]; seek?: true } } = {
  rows: { keyPath: ['store', 'key'], seek: true },
  seeds: { keyPath: 'store' },
  sets: { keyPath: 'name' },
  outbox: { keyPath: ['outbox', 'id'] },
  notices: { keyPath: 'id' },
  views: { keyPath: ['page', 'id'] },
  entities: { keyPath: 'id' },
};

/** Whether this context has IndexedDB at all. */
export function hasDatabase(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    // TRAP T-storage-access-throws — reading the global itself can throw.
    return false;
  }
}

/** A PROMISE, so concurrent opens share one and never race the upgrade. */
let opening: Promise<IDBDatabase> | null = null;

/** The open database, shared by every part. REJECTS where there is none: empty
 *  would mean saved-into-nothing. TRAP T-idb-is-the-only-real-local-store */
export function openDatabase(): Promise<IDBDatabase> {
  if (opening) return opening;
  opening = new Promise<IDBDatabase>((resolve, reject) => {
    if (!hasDatabase()) {
      reject(new Error('Sherpa: IndexedDB is unavailable'));
      return;
    }
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DATABASE, VERSION);
    } catch (error) {
      // A private window, or site data blocked — TRAP T-storage-access-throws.
      reject(error instanceof Error ? error : new Error(String(error)));
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const [name, { keyPath, seek }] of Object.entries(SCHEMA)) {
        if (db.objectStoreNames.contains(name)) continue;
        const store = db.createObjectStore(name, { keyPath });
        if (seek) store.createIndex('seek', 'seek', { multiEntry: true });
      }
      // v2 kept Custom Nodes in a store of their own: read ONCE as entities of the type `node`, then gone.
      const tx = request.transaction;
      if (tx && db.objectStoreNames.contains('nodes')) {
        const old = tx.objectStore('nodes').getAll() as IDBRequest<{ id: string; node: NodeDefinition }[]>;
        old.onsuccess = () => {
          for (const { id, node } of old.result) tx.objectStore('entities').put({ id, entity: nodeEntityOf(id, node) } satisfies EntityRecord);
          db.deleteObjectStore('nodes');
        };
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      // Another context asks for a newer version: let go, and open again next time.
      db.onversionchange = () => {
        db.close();
        opening = null;
      };
      // The browser closed it (site data cleared): open again next time.
      db.onclose = () => { opening = null; };
      resolve(db);
    };
    request.onerror = () => reject(request.error ?? new Error('Sherpa: the database could not be opened'));
    request.onblocked = () => reject(new Error('Sherpa: the database is blocked by another tab'));
  });
  // Never keep a FAILED open: storage may be granted later in the session.
  opening.catch(() => { opening = null; });
  return opening;
}

/** Ask the device to keep Sherpa's data; the app calls it, Sherpa never asks on its own
 *  (Firefox asks the reader). Only a page can; it covers the worker's data. TRAP T-one-browser-database */
export async function keepData(): Promise<boolean> {
  const storage = (globalThis as { navigator?: { storage?: Partial<StorageManager> } }).navigator?.storage;
  if (typeof storage?.persist !== 'function' || typeof storage.persisted !== 'function') return false;
  try {
    return (await storage.persisted()) || (await storage.persist());
  } catch {
    return false;
  }
}

/** What a transaction's work hands back: a request whose result it settles with,
 *  a function read once it commits, or nothing. */
type Work<T> = (tx: IDBTransaction) => IDBRequest<T> | (() => T) | undefined;

/** One transaction over the named object stores; settles once it COMMITS, with
 *  what `work` handed back. Every request is made inside `work`: a transaction
 *  commits as soon as it has none waiting. TRAP T-idb-bulk-is-one-transaction */
export async function transact<T = void>(names: StoreName | readonly StoreName[], mode: IDBTransactionMode, work: Work<T>): Promise<T> {
  const db = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    let tx: IDBTransaction | undefined;
    let out: ReturnType<Work<T>>;
    try {
      tx = db.transaction(names as string | string[], mode);
      out = work(tx);
    } catch (error) {
      try { tx?.abort(); } catch { /* already done */ }
      reject(error);
      return;
    }
    const done = tx;
    done.oncomplete = () => resolve((typeof out === 'function' ? out() : out?.result) as T);
    // The failed REQUEST's error: the transaction's is not set until it aborts.
    done.onerror = (event) => reject((event.target as IDBRequest | null)?.error ?? done.error ?? new Error('Sherpa: a database request failed'));
    done.onabort = () => reject(done.error ?? new Error('Sherpa: a database transaction was aborted'));
  });
}

/** Every record of an object store, or those a key range holds, in key order. */
export function readAll<S extends StoreName>(name: S, query?: IDBValidKey | IDBKeyRange): Promise<Records[S][]> {
  return transact(name, 'readonly', (tx) => tx.objectStore(name).getAll(query) as IDBRequest<Records[S][]>);
}

/** One record, by its key. */
export function readOne<S extends StoreName>(name: S, key: IDBValidKey): Promise<Records[S] | undefined> {
  return transact(name, 'readonly', (tx) => tx.objectStore(name).get(key) as IDBRequest<Records[S] | undefined>);
}

/** Put records, in one transaction. */
export function write<S extends StoreName>(name: S, records: readonly Records[S][]): Promise<void> {
  return transact(name, 'readwrite', (tx) => {
    const store = tx.objectStore(name);
    for (const record of records) store.put(record);
  });
}

/** Delete one key, or every key in a range. Nothing there is no error. */
export function erase(name: StoreName, query: IDBValidKey | IDBKeyRange): Promise<void> {
  return transact(name, 'readwrite', (tx) => { tx.objectStore(name).delete(query); });
}

/** Empty object stores, in one transaction. */
export function clearStores(names: readonly StoreName[]): Promise<void> {
  return transact(names, 'readwrite', (tx) => {
    for (const name of names) tx.objectStore(name).clear();
  });
}

/** Every compound key that starts with these parts. Only where IndexedDB is:
 *  `IDBKeyRange` is its global. */
export function within(...parts: IDBValidKey[]): IDBKeyRange {
  // An array sorts after every number, date and string, so `[…parts, []]` ends the run.
  return IDBKeyRange.bound(parts, [...parts, []]);
}
