/**
 * spoof-remote.ts — make any store ACT remote: slow, and sometimes failing.
 *
 * There is no remote source yet, so the example and the tests borrow one. A
 * wrapped store says `remote: true`, so a source over it keeps a DRAFT and
 * waits for Apply. DOM-free. TRAP T-apply-and-discard-wait-for-a-change
 *
 * Map:
 * - SpoofOptions — How slow each load is, and how often one fails.
 * - spoofRemote — Wrap a store so its loads act as if they left the data layer.
 */
import type { LoadOptions, LoadResult, Row, Store } from './store.js';

/** How slow each load is, and how often one fails. */
export interface SpoofOptions {
  /** Milliseconds each load and count waits. Default 800. */
  delay?: number;
  /** The share of loads that fail, 0 to 1. Default 0. */
  fail?: number;
}

/** Wrap a store so its loads act as if they left the data layer. Writes pass straight through. */
export function spoofRemote(store: Store, options: SpoofOptions = {}): Store {
  const delay = options.delay ?? 800;
  const fail = options.fail ?? 0;
  const wait = (): Promise<void> => new Promise((r) => setTimeout(r, delay));
  const out = new EventTarget() as Store;
  // Its rows changed: say so, as the store itself did.
  store.addEventListener('change', (e) => {
    out.dispatchEvent(new CustomEvent('change', { detail: (e as CustomEvent).detail }));
  });
  return Object.assign(out, {
    remote: true,
    key: store.key,
    time: store.time,
    domains: store.domains,
    async load(o?: LoadOptions): Promise<LoadResult> {
      await wait();
      if (Math.random() < fail) throw new Error('spoofRemote: the fetch failed.');
      return store.load(o);
    },
    async totalCount(o?: LoadOptions): Promise<number> {
      await wait();
      return store.totalCount(o);
    },
    byKey: (key: unknown) => store.byKey(key),
    insert: (values: Row) => store.insert(values),
    update: (key: unknown, values: Row) => store.update(key, values),
    remove: (key: unknown) => store.remove(key),
  });
}
