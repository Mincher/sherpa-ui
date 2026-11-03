/**
 * fake-remote.ts — make any store ACT remote: slow, and sometimes failing.
 *
 * A stand-in, for a test or a demo: a wrapped store says `remote`, so a source
 * over it keeps a DRAFT and waits for Apply, and reads it through a `HeldStore`.
 * DOM-free. TRAP T-apply-and-discard-wait-for-a-change
 *
 * Map:
 * - FakeRemoteOptions — How slow each load is, and how often one fails.
 * - fakeRemote — Wrap a store so its loads act as if they left the data layer.
 */
import { readField, type LoadOptions, type LoadResult, type Row, type Store, type StoreChangeDetail, type StoreChanges, type WriteOptions } from './store.js';
import { wrapStore } from './wrap-store.js';

/** How slow each load is, and how often one fails — a number, or a function read
 *  at each load, so ONE wrapper serves a whole app while a setting changes. */
export interface FakeRemoteOptions {
  /** Milliseconds each load and count waits. Default 800. */
  delay?: number | (() => number);
  /** The share of loads — and writes, which then never reach the store — that
   *  fail, 0 to 1, as a network failure (a `TypeError`). Default 0. */
  fail?: number | (() => number);
  /** Does it act as a store whose every change is announced? Default: the store's own say. */
  announcesAll?: boolean;
  /** True while a change is MISSED — not passed on, as a page misses another
   *  client's write; its History still says it moved. Default: none is. */
  missed?: () => boolean;
}

/** Wrap a store so its loads act as if they left the data layer. Writes pass straight through. */
export function fakeRemote(store: Store, options: FakeRemoteOptions = {}): Store {
  const read = (v: number | (() => number) | undefined, or: number): number => (typeof v === 'function' ? v() : v ?? or);
  // A read's wait stops when its read is superseded, as a fetch would. TRAP T-a-superseded-read-stops
  const wait = (signal?: AbortSignal): Promise<void> => new Promise((done, stop) => {
    if (signal?.aborted) return stop(signal.reason);
    const timer = setTimeout(done, read(options.delay, 800));
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      stop(signal.reason);
    }, { once: true });
  });
  // As fetch fails when the network does, so failureOf() reads it as offline. TRAP T-a-failure-has-a-kind
  const failed = (): void => {
    if (Math.random() < read(options.fail, 0)) throw new TypeError('fakeRemote: the fetch failed.');
  };
  /* When each row last changed — by any writer, heard or missed — so a write sent
     with its own time is refused where the row changed after (D3). Plan 652 S7b
     TRAP T-a-newer-write-wins */
  const changedAt = new Map<string, number>();
  const stamp = (detail: StoreChangeDetail | undefined): void => {
    const { key, row } = detail ?? {};
    if (key != null) changedAt.set(String(key), Date.now());
    if (row && store.key) changedAt.set(String(readField(row, store.key)), Date.now());
  };
  const newer = (key: unknown, write?: WriteOptions): void => {
    const at = write?.unmodifiedSince;
    if (at === undefined || (changedAt.get(String(key)) ?? 0) <= at) return;
    throw Object.assign(new Error(`fakeRemote: ${String(key)} changed after this write was made.`), { name: 'HttpError', status: 412 });
  };
  const distinct = store.distinct?.bind(store);
  // The store's own record of what changed, handed on. TRAP T-a-store-keeps-its-history
  const history = store.history;
  return wrapStore(store, {
    capabilities: { ...store.capabilities, remote: true, ...(options.announcesAll !== undefined ? { announcesAll: options.announcesAll } : {}) },
    // Its rows changed: said as the store said it — unless missed.
    change: (detail) => {
      stamp(detail);
      return options.missed?.() ? null : detail;
    },
    // A remote store's rows are never read in place.
    scan: undefined,
    async load(o?: LoadOptions): Promise<LoadResult> {
      await wait(o?.signal);
      failed();
      return store.load(o);
    },
    async totalCount(o?: LoadOptions): Promise<number> {
      await wait(o?.signal);
      failed();
      return store.totalCount(o);
    },
    distinct: distinct ? async (fields: readonly string[], o?: LoadOptions): Promise<Record<string, unknown[]>> => {
      await wait(o?.signal);
      failed();
      return distinct(fields, o);
    } : undefined,
    // What moved since a mark, from the store's own History. TRAP T-a-remote-store-says-what-changed
    changes: history ? async (since?: unknown): Promise<StoreChanges> => {
      await wait();
      failed();
      return { at: history.seq, ...(since == null ? { rows: false, fields: [] } : history.since(Number(since))) };
    } : undefined,
    // Offline, a write never leaves, as a fetch's would not. Plan 652 S7a
    insert: async (values: Row) => (failed(), store.insert(values)),
    update: async (key: unknown, values: Row, write?: WriteOptions) => (failed(), newer(key, write), store.update(key, values)),
    remove: async (key: unknown, write?: WriteOptions) => (failed(), newer(key, write), store.remove(key)),
  });
}
