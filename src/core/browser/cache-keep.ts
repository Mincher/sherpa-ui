/**
 * cache-keep.ts — keep a remote store's held set beyond the session, in
 * IndexedDB (Will, D2 B): a reload shows the last rows at once — offline too —
 * and the first page that uses the store reads them again behind (W2 A).
 * Headless-safe: in Node, or with no IndexedDB, it keeps nothing and says so.
 * TRAP T-a-kept-set-is-checked-each-session
 *
 * Map:
 * - KeepOptions — Where and for how long a store's set is kept.
 * - keepCache — Keep a remote store's held set on the device, and start from it next time.
 * - clearKept — Forget every kept set, on the device and in memory — a sign-out.
 */
import { IdbStore } from './idb-store.js';
import { cacheOf, type CacheKeep, type KeptSet } from '../data/store-cache.js';
import { report } from '../data/report.js';
import type { Row, Store } from '../data/store.js';

/** Where and for how long a store's set is kept. */
export interface KeepOptions {
  /** Its record's name. Carry the user or tenant in it: the rows outlive the session. */
  name: string;
  /** Bump it when the rows' shape changes: a copy of another version is dropped. */
  version?: number;
  /** The oldest copy shown, in ms. Default 7 days. */
  maxAge?: number;
  /** The most rows written. Default 50,000. */
  maxRows?: number;
}

/** One record per kept store. */
interface Record extends Row {
  name: string;
  v: 1;
  version: number;
  key: string;
  savedAt: number;
  rows: Row[];
}

const DAY = 24 * 60 * 60 * 1000;
/** Saves are written once quiet this long. */
const QUIET = 2000;

let sets: IdbStore | null = null;
const kept = new Set<Store>();
const said = new Set<string>();

/** Say a thing once a session. */
function once(code: string, message: string): void {
  if (said.has(code)) return;
  said.add(code);
  report({ code, message, at: {} });
}

/** The shared object store, its own database, so an app's version never moves it. */
function setsStore(): IdbStore {
  return (sets ??= new IdbStore({ name: 'sets', database: 'sherpa-cache', key: 'name' }));
}

/** Keep a remote store's held set on the device, and start from it next time.
 *  `ready` settles once the kept copy has been read; `forget()` removes it. */
export function keepCache(store: Store, options: KeepOptions): { ready: Promise<void>; forget(): Promise<void> } {
  const none = { ready: Promise.resolve(), forget: () => Promise.resolve() };
  if (!store.remote) {
    once('cache-keep-never-held', 'keepCache: only a REMOTE store\'s set is held, so this one is kept nowhere.');
    return none;
  }
  if (!IdbStore.available) {
    once('cache-keep-unavailable', 'keepCache: this browser has no IndexedDB, so the set is held in memory only.');
    return none;
  }
  const { name } = options;
  const version = options.version ?? 1;
  const maxAge = options.maxAge ?? 7 * DAY;
  const maxRows = options.maxRows ?? 50_000;
  let full = false;
  let quiet: ReturnType<typeof setTimeout> | undefined;
  const forget = async (): Promise<void> => {
    try {
      await setsStore().remove(name);
    } catch { /* not there */ }
  };
  /** The copy kept last time — dropped if it is another version, another key, or too old. */
  const readKept = async (): Promise<KeptSet | null> => {
    try {
      const record = (await setsStore().byKey(name)) as Record | undefined;
      if (!record) return null;
      if (record.v !== 1 || record.version !== version || record.key !== store.key || Date.now() - record.savedAt > maxAge) {
        await forget();
        return null;
      }
      return { rows: record.rows, ...(record['dropped'] ? { dropped: record['dropped'] as number } : {}) };
    } catch {
      // A failed open is a miss, never the only copy: memory only, this time.
      once('cache-keep-unavailable', 'keepCache: IndexedDB could not be opened, so the set is held in memory only.');
      return null;
    }
  };
  let readOnce: Promise<KeptSet | null> | null = null;
  const port: CacheKeep = {
    read(): Promise<KeptSet | null> {
      return (readOnce ??= readKept());
    },
    write(take): void {
      if (full) return;
      clearTimeout(quiet);
      quiet = setTimeout(() => {
        const idle = (globalThis as { requestIdleCallback?: (fn: () => void) => void }).requestIdleCallback;
        const run = async (): Promise<void> => {
          const set = take();
          if (!set || set.rows.length > maxRows) return forget();
          const record: Record = { name, v: 1, version, key: store.key, savedAt: Date.now(), rows: [...set.rows],
            ...(set.dropped ? { dropped: set.dropped } : {}) };
          try {
            await setsStore().putAll([record]);
          } catch (error) {
            if ((error as { name?: string })?.name !== 'QuotaExceededError') return;
            full = true;
            await forget();
            once('cache-keep-full', 'keepCache: the device is out of room, so the set is no longer kept this session.');
          }
        };
        if (idle) idle(() => void run());
        else void run();
      }, QUIET);
    },
    forget,
  };
  kept.add(store);
  const cache = cacheOf(store);
  cache.keep(port);
  return { ready: port.read().then(() => undefined), forget };
}

/** Forget every kept set — on the device, and each one held in memory: a sign-out. */
export async function clearKept(): Promise<void> {
  for (const store of kept) cacheOf(store).drop({ forget: true });
  if (!IdbStore.available) return;
  try {
    await setsStore().clear();
  } catch { /* nothing kept */ }
}
