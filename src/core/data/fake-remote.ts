/**
 * fake-remote.ts — make any store ACT remote: slow, and sometimes failing.
 *
 * A stand-in, for a test or a demo: a wrapped store says `remote: true`, so a
 * source over it keeps a DRAFT and waits for Apply. DOM-free.
 * TRAP T-apply-and-discard-wait-for-a-change
 *
 * Map:
 * - FakeRemoteOptions — How slow each load is, and how often one fails.
 * - fakeRemote — Wrap a store so its loads act as if they left the data layer.
 */
import { readField, type LoadOptions, type LoadResult, type Row, type Store, type StoreChangeDetail, type StoreChanges, type WriteOptions } from './store.js';

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
  const wait = (): Promise<void> => new Promise((r) => setTimeout(r, read(options.delay, 800)));
  // As fetch fails when the network does, so failureOf() reads it as offline. TRAP T-a-failure-has-a-kind
  const failed = (): void => {
    if (Math.random() < read(options.fail, 0)) throw new TypeError('fakeRemote: the fetch failed.');
  };
  /* When each row last changed — by any writer, heard or missed — so a write sent
     with its own time is refused where the row changed after (D3). Plan 652 S7b
     TRAP T-a-newer-write-wins */
  const changedAt = new Map<string, number>();
  const stamp = (e: Event): void => {
    const { key, row } = ((e as CustomEvent).detail ?? {}) as StoreChangeDetail;
    if (key != null) changedAt.set(String(key), Date.now());
    if (row && store.key) changedAt.set(String(readField(row, store.key)), Date.now());
  };
  const newer = (key: unknown, write?: WriteOptions): void => {
    const at = write?.unmodifiedSince;
    if (at === undefined || (changedAt.get(String(key)) ?? 0) <= at) return;
    throw Object.assign(new Error(`fakeRemote: ${String(key)} changed after this write was made.`), { name: 'HttpError', status: 412 });
  };
  const out = new EventTarget() as Store;
  /* Its rows changed: say so, as the store itself did. Held WEAKLY, so a wrapper
     dropped is freed, and its relay goes at the next change. TRAP T-a-closed-source-hears-nothing */
  const to = new WeakRef(out);
  const relay = (e: Event): void => {
    const wrapper = to.deref();
    if (!wrapper) store.removeEventListener('change', relay);
    else {
      stamp(e);
      if (!options.missed?.()) wrapper.dispatchEvent(new CustomEvent('change', { detail: (e as CustomEvent).detail }));
    }
  };
  store.addEventListener('change', relay);
  const inner = store.distinct?.bind(store);
  return Object.assign(out, {
    remote: true,
    key: store.key,
    time: store.time,
    domains: store.domains,
    reportsTotal: store.reportsTotal ?? false,
    sampled: store.sampled ?? false,
    rowOrder: store.rowOrder,
    projects: store.projects ?? false,
    announcesAll: options.announcesAll ?? store.announcesAll,
    // The store's own record of what changed. TRAP T-a-store-keeps-its-history
    history: store.history,
    async load(o?: LoadOptions): Promise<LoadResult> {
      await wait();
      failed();
      return store.load(o);
    },
    async totalCount(o?: LoadOptions): Promise<number> {
      await wait();
      failed();
      return store.totalCount(o);
    },
    ...(inner ? {
      async distinct(fields: readonly string[], o?: LoadOptions): Promise<Record<string, unknown[]>> {
        await wait();
        failed();
        return inner(fields, o);
      },
    } : {}),
    // What moved since a mark, from its History. TRAP T-a-remote-store-says-what-changed
    ...(store.history ? {
      async changes(since?: unknown): Promise<StoreChanges> {
        await wait();
        failed();
        const history = store.history!;
        return { at: history.seq, ...(since == null ? { rows: false, fields: [] } : history.since(Number(since))) };
      },
    } : {}),
    byKey: (key: unknown) => store.byKey(key),
    // Offline, a write never leaves, as a fetch's would not. Plan 652 S7a
    insert: async (values: Row) => (failed(), store.insert(values)),
    update: async (key: unknown, values: Row, write?: WriteOptions) => (failed(), newer(key, write), store.update(key, values)),
    remove: async (key: unknown, write?: WriteOptions) => (failed(), newer(key, write), store.remove(key)),
  });
}
