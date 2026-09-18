/**
 * view-sync.ts — a view's state kept LOCALLY for speed, and pushed onward.
 *
 *   const sync = syncViews('records', { remote, signal });
 *
 * THE THREE TIERS, and why there are three rather than one:
 *
 * | tier | holds | why it cannot be the one below |
 * |---|---|---|
 * | Web Storage | the CURRENT view, per tab | it is the only SYNCHRONOUS one |
 * | IndexedDB | every saved view, durably | it is the only one without a ~5MB cap |
 * | a server | views that follow the user | it is the only one another device sees |
 *
 * TRAP T-restore-before-first-load says the current view must be readable
 * BEFORE the first load, or the page queries twice and blinks. IndexedDB is
 * async and can never satisfy that, so `persistView` keeps its synchronous
 * Web-Storage restore untouched and this sits BEHIND it.
 *
 * TRAP T-local-first-then-onward — the ordering rule, and why a failed push is
 * not a failed save.
 * TRAP T-sync-pushes-a-snapshot-not-a-diff — what is on the wire, and why.
 */
import { IdbStore } from './idb-store.js';
import {
  loadSavedViews,
  type PersistOptions,
  type SavedView,
  type SavedViewStore,
} from './persist-view.js';

/* ── The remote half ───────────────────────────────────────────────────── */

/**
 * Where saved views go when they must outlive this browser.
 *
 * An INTERFACE, not a `RestStore` — a host's view endpoint is its own, and the
 * two calls it needs are far narrower than a Store's five.
 */
export interface ViewRemote {
  /** Every view this user has for one page. */
  pull(page: string): Promise<SavedViewStore>;
  /** Write the whole set back. See T-sync-pushes-a-snapshot-not-a-diff. */
  push(page: string, views: SavedViewStore): Promise<void>;
}

export interface SyncOptions extends PersistOptions {
  /** Where views go beyond this browser. Omit for local-only. */
  remote?: ViewRemote;
  /**
   * Push at most this often, in ms. Default 30_000.
   *
   * TRAP T-sync-pushes-a-snapshot-not-a-diff — a DEBOUNCE, so a burst of edits
   * is one request, and the last one wins.
   */
  interval?: number;
  /** The IndexedDB database name. Defaults to `sherpa`. */
  database?: string;
  /** Stop syncing when this aborts — the same token `bind()` and `persistView` take. */
  signal?: AbortSignal;
  /**
   * Called when a push or pull fails.
   *
   * TRAP T-local-first-then-onward — a failed push is REPORTED, never thrown:
   * the view is already saved locally and the user is not waiting on the wire.
   */
  onError?: (error: unknown, stage: 'pull' | 'push') => void;
}

/* ── The sync ──────────────────────────────────────────────────────────── */

/**
 * What `syncViews` hands back. Every method is safe to call when there is no
 * remote and no IndexedDB — the local tier still works, which is the point.
 */
export interface ViewSync {
  /**
   * Pull the remote's views, merge them under the local ones, and write the
   * merged set to BOTH local tiers.
   *
   * LOCAL WINS on a clash — see T-local-first-then-onward.
   */
  restore(): Promise<SavedViewStore>;
  /** Every view this page knows, local first, IndexedDB behind it. */
  all(): Promise<SavedViewStore>;
  /** Note that the views changed. Schedules a push; does not wait for one. */
  touch(): void;
  /** Push NOW rather than on the next tick of the interval. */
  flush(): Promise<void>;
  /** Stop. Pending work is pushed first unless the signal already aborted. */
  stop(): Promise<void>;
}

/**
 * Keep one page's saved views in three tiers.
 *
 * TRAP T-local-first-then-onward.
 */
export function syncViews(page: string, options: SyncOptions = {}): ViewSync {
  const interval = options.interval ?? 30_000;
  const report = options.onError ?? ((): void => { /* reported nowhere by default */ });

  // The durable local tier. Views are RECORDS here — one row per view, keyed by
  // its id — so a page with two hundred saved views reads the one it needs.
  const idb = IdbStore.available
    ? new IdbStore({
      name: 'sherpa-views',
      key: 'id',
      indexes: ['page'],
      ...(options.database ? { database: options.database } : {}),
    })
    : null;

  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending = false;
  let stopped = false;

  /** IndexedDB's rows for this page, as a SavedViewStore. */
  const fromIdb = async (): Promise<SavedViewStore> => {
    if (!idb) return {};
    try {
      // The `page` index narrows this to one page's rows —
      // T-idb-index-narrows-it-never-answers-it.
      const result = await idb.load({ filter: ['page', 'eq', page] });
      const views: SavedViewStore = {};
      for (const row of result.rows) {
        const id = String(row['id'] ?? '').replace(`${page}:`, '');
        const view = row['view'] as SavedView | undefined;
        if (id && view) views[id] = view;
      }
      return views;
    } catch (error) {
      // Storage blocked, or a version clash with another tab. The Web-Storage
      // tier still answers — T-local-first-then-onward.
      report(error, 'pull');
      return {};
    }
  };

  /** Write a whole set into IndexedDB, replacing this page's rows. */
  const toIdb = async (views: SavedViewStore): Promise<void> => {
    if (!idb) return;
    try {
      // KEYED `<page>:<id>`, so one object store holds every page's views and
      // two pages cannot collide on an id like `default`.
      await idb.putAll(
        Object.entries(views).map(([id, view]) => ({ id: `${page}:${id}`, page, view })),
      );
    } catch (error) {
      report(error, 'push');
    }
  };

  const push = async (): Promise<void> => {
    pending = false;
    if (!options.remote) return;
    // The LOCAL set is the truth being published — see
    // T-sync-pushes-a-snapshot-not-a-diff.
    const views = { ...(await fromIdb()), ...loadSavedViews(page, options) };
    try {
      await options.remote.push(page, views);
    } catch (error) {
      // NOT rethrown, and NOT retried on a timer: a retry loop against a
      // rejecting server is a request storm nobody asked for. The next `touch`
      // carries the same snapshot anyway.
      report(error, 'push');
    }
  };

  const schedule = (): void => {
    if (stopped || timer) return;
    timer = setTimeout(() => {
      timer = null;
      void push();
    }, interval);
  };

  const sync: ViewSync = {
    async restore(): Promise<SavedViewStore> {
      // ORDER MATTERS, and it is the reverse of what looks natural: remote
      // FIRST so local can overwrite it. A view the user edited on this device
      // and has not pushed yet must not be replaced by the server's older copy.
      // T-local-first-then-onward.
      let remote: SavedViewStore = {};
      if (options.remote) {
        try {
          remote = await options.remote.pull(page);
        } catch (error) {
          report(error, 'pull');
        }
      }
      const merged = { ...remote, ...(await fromIdb()), ...loadSavedViews(page, options) };
      await toIdb(merged);
      return merged;
    },

    async all(): Promise<SavedViewStore> {
      return { ...(await fromIdb()), ...loadSavedViews(page, options) };
    },

    touch(): void {
      if (stopped) return;
      pending = true;
      // The durable copy is written NOW; only the WIRE is debounced. A tab
      // closed before the interval elapses has still kept the view.
      void toIdb(loadSavedViews(page, options));
      schedule();
    },

    async flush(): Promise<void> {
      if (timer) { clearTimeout(timer); timer = null; }
      await push();
    },

    async stop(): Promise<void> {
      if (timer) { clearTimeout(timer); timer = null; }
      // A pending change is pushed on the way out — unless the caller ABORTED,
      // which means the page is going away and a request would be cancelled
      // mid-flight anyway.
      if (pending && !options.signal?.aborted) await push();
      stopped = true;
      idb?.close();
    },
  };

  options.signal?.addEventListener('abort', () => { void sync.stop(); }, { once: true });
  return sync;
}

/* ── A ready-made remote ───────────────────────────────────────────────── */

export interface RestViewRemoteOptions {
  /** The endpoint. `<url>/<page>` is read and written. */
  url: string;
  /** Extra headers — an auth token, most often. */
  headers?: Record<string, string>;
  /** Passed to `fetch`, for cookies on a cross-origin endpoint. */
  credentials?: RequestCredentials;
}

/**
 * A `ViewRemote` over HTTP — GET to pull, PUT to push.
 *
 * Provided because every host writes the same twenty lines otherwise. A host
 * whose endpoint differs implements `ViewRemote` itself; it is two methods.
 */
export function restViewRemote(options: RestViewRemoteOptions): ViewRemote {
  const at = (page: string): string => `${options.url.replace(/\/$/, '')}/${encodeURIComponent(page)}`;
  const headers = { 'content-type': 'application/json', ...options.headers };

  return {
    async pull(page: string): Promise<SavedViewStore> {
      const response = await fetch(at(page), {
        headers,
        ...(options.credentials ? { credentials: options.credentials } : {}),
      });
      // A 404 is NOT an error: it means this user has saved nothing yet, which
      // is the common first run.
      if (response.status === 404) return {};
      if (!response.ok) throw new Error(`view pull failed: ${response.status}`);
      const body: unknown = await response.json();
      return body && typeof body === 'object' ? (body as SavedViewStore) : {};
    },

    async push(page: string, views: SavedViewStore): Promise<void> {
      const response = await fetch(at(page), {
        method: 'PUT',
        headers,
        body: JSON.stringify(views),
        ...(options.credentials ? { credentials: options.credentials } : {}),
      });
      if (!response.ok) throw new Error(`view push failed: ${response.status}`);
    },
  };
}
