/**
 * spoof-remote.ts — make any store ACT remote: slow, and sometimes failing.
 *
 * A stand-in, for a test or a demo: a wrapped store says `remote: true`, so a
 * source over it keeps a DRAFT and waits for Apply. DOM-free.
 * TRAP T-apply-and-discard-wait-for-a-change
 *
 * Map:
 * - SpoofOptions — How slow each load is, and how often one fails.
 * - spoofRemote — Wrap a store so its loads act as if they left the data layer.
 */
import type { LoadOptions, LoadResult, Row, Store } from './store.js';

/** How slow each load is, and how often one fails — a number, or a function read
 *  at each load, so ONE wrapper serves a whole app while a setting changes. */
export interface SpoofOptions {
  /** Milliseconds each load and count waits. Default 800. */
  delay?: number | (() => number);
  /** The share of loads that fail, 0 to 1, as a network failure (a `TypeError`). Default 0. */
  fail?: number | (() => number);
}

/** Wrap a store so its loads act as if they left the data layer. Writes pass straight through. */
export function spoofRemote(store: Store, options: SpoofOptions = {}): Store {
  const read = (v: number | (() => number) | undefined, or: number): number => (typeof v === 'function' ? v() : v ?? or);
  const wait = (): Promise<void> => new Promise((r) => setTimeout(r, read(options.delay, 800)));
  // As fetch fails when the network does, so failureOf() reads it as offline. TRAP T-a-failure-has-a-kind
  const failed = (): void => {
    if (Math.random() < read(options.fail, 0)) throw new TypeError('spoofRemote: the fetch failed.');
  };
  const out = new EventTarget() as Store;
  /* Its rows changed: say so, as the store itself did. Held WEAKLY, so a wrapper
     dropped is freed, and its relay goes at the next change. TRAP T-a-closed-source-hears-nothing */
  const to = new WeakRef(out);
  const relay = (e: Event): void => {
    const wrapper = to.deref();
    if (!wrapper) store.removeEventListener('change', relay);
    else wrapper.dispatchEvent(new CustomEvent('change', { detail: (e as CustomEvent).detail }));
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
    byKey: (key: unknown) => store.byKey(key),
    insert: (values: Row) => store.insert(values),
    update: (key: unknown, values: Row) => store.update(key, values),
    remove: (key: unknown) => store.remove(key),
  });
}
