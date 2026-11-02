/**
 * serve-data.ts — the data layer's own requests, answered in the Service Worker:
 * one copy of each store for every tab, and offline. Plan 652 S4
 * TRAP T-the-worker-answers-the-data
 *
 * Map:
 * - ServeDataOptions — The stores the worker answers for, and what each request waits for.
 * - serveData — Answer the data layer's requests in the worker, from the stores the app hands it.
 */
import { DATA_CHANNEL, createDataHandler, type DataHandlerOptions } from '../data/data-handler.js';
import { sayNotice } from '../data/notices.js';
import type { WorkerFetchEvent, WorkerScope } from './app-files.js';

/** The stores the worker answers for, and what each request waits for. */
export interface ServeDataOptions extends DataHandlerOptions {
  /** Settles once the stores are ready — a first seed written. Each request waits
   *  for it; a store that could not be opened answers for itself. */
  ready?: Promise<unknown>;
}

/** Answer the data layer's requests in the worker, from the stores the app's worker
 *  script imports and hands it (D7: a worker cannot `import()` at runtime). */
export function serveData(scope: WorkerScope, options: ServeDataOptions): void {
  const handle = createDataHandler({ ...options, notifies: true });
  /* Every store's change, to every tab — one tab's write is another's news. S6
     TRAP T-every-tab-hears-a-change */
  const channel = new BroadcastChannel(DATA_CHANNEL);
  // Open as long as the worker: in Node, it keeps nothing running.
  (channel as { unref?: () => void }).unref?.();
  for (const [name, store] of Object.entries(options.stores)) {
    /* Newer rows wait behind the ones shown: said as a fact, to every tab; whatever
       listens shows it. S6c · TRAP T-a-server-change-waits */
    store.addEventListener('waiting', (event) => {
      const rows = (event as CustomEvent<{ rows?: number } | undefined>).detail?.rows;
      sayNotice({ kind: 'data', store: name, ...(rows !== undefined ? { rows } : {}) });
    });
    store.addEventListener('change', (event) => {
      const change = (event as CustomEvent).detail;
      try {
        channel.postMessage({ store: name, change });
      } catch {
        // A change that cannot be copied is still news: that something moved.
        channel.postMessage({ store: name });
      }
    });
  }
  const base = options.base ?? '/sherpa/data/';
  scope.addEventListener('fetch', (event) => {
    const { request } = event as WorkerFetchEvent;
    const url = new URL(request.url);
    if (url.origin !== scope.location.origin || !url.pathname.startsWith(base)) return;
    (event as WorkerFetchEvent).respondWith((async () => {
      await options.ready?.catch(() => undefined);
      return (await handle(request)) ?? new Response(null, { status: 404 });
    })());
  });
}
