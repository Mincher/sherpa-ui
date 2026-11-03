/**
 * worker-store.ts — a page's store for one the app's Service Worker answers: by
 * `fetch`, through the worker, where it controls the page; else by the handler in
 * the page — a first visit, a private window, a worker that is older than the page.
 * Plan 652 S4 · TRAP T-the-worker-answers-the-data
 *
 * Map:
 * - WorkerStoreOptions — The store's name, and the handler in the page that answers when no worker does.
 * - openWorkerStore — The store, through the worker where it can answer, else through the page's own handler.
 */
import type { DataHandler } from '../data/data-handler.js';
import { report } from '../data/report.js';
import { openRequestStore, type RequestStore } from '../data/request-store.js';

/** The store's name, and the handler in the page that answers when no worker does. */
export interface WorkerStoreOptions {
  name: string;
  /** The page's own handler, over the same stores: Host A of plan 652. */
  fallback: DataHandler;
  /** Default `DATA_BASE`. */
  base?: string;
  /** Headers each request carries, read at each request. */
  headers?: () => Record<string, string>;
}

/** The store, through the worker where it can answer, else through the page's own handler. */
export async function openWorkerStore(options: WorkerStoreOptions): Promise<RequestStore> {
  const { name, fallback, base, headers } = options;
  const shared = { name, ...(base ? { base } : {}), ...(headers ? { headers } : {}) };
  if (navigator.serviceWorker?.controller) {
    try {
      return await openRequestStore({ ...shared, origin: location.origin, send: (request) => fetch(request) });
    } catch (error) {
      // A worker that does not answer the data yet, as one installed before it could.
      report({
        code: 'worker-store-fallback',
        message: `openWorkerStore: the Service Worker did not answer "${name}", so the page answers it.`,
        at: { store: name, error: error instanceof Error ? error.message : String(error) },
      });
    }
  }
  return openRequestStore({ ...shared, send: fallback });
}
