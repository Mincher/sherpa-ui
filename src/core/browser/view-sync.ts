/**
 * view-sync.ts — a page's saved views in three tiers.
 *
 *   const sync = syncViews('records', { remote, signal });
 *
 * Web Storage is the only SYNCHRONOUS tier, IndexedDB the only uncapped one, a
 * server the only one another device sees. This sits BEHIND `persistView`'s
 * synchronous restore, which async IndexedDB could never replace.
 *
 * TRAP T-restore-before-first-load
 * TRAP T-local-first-then-onward
 * TRAP T-sync-pushes-a-snapshot-not-a-diff
 *
 * Map:
 * - ViewRemote — Where saved views go when they must outlive this browser.
 * - SyncOptions — the page, the remote, and how often to push
 * - ViewSync — What `syncViews` hands back.
 * - syncViews — Keep one page's saved views in three tiers.
 * - RestViewRemoteOptions — the URL and headers a REST remote talks to
 * - restViewRemote — A `ViewRemote` over HTTP — GET to pull, PUT to push.
 */
import { IdbStore } from './idb-store.js';
import {
  loadSavedViews,
  type PersistOptions,
  type SavedView,
  type SavedViewStore,
} from './persist-view.js';

/* ── The remote half ───────────────────────────────────────────────────── */

/** Where saved views go when they must outlive this browser. */
export interface ViewRemote {
  /** Every view this user has for one page. */
  pull(page: string): Promise<SavedViewStore>;
  /** Write the whole set back — a snapshot, not a diff. */
  push(page: string, views: SavedViewStore): Promise<void>;
}

export interface SyncOptions extends PersistOptions {
  /** Where views go beyond this browser. Omit for local-only. */
  remote?: ViewRemote;
  /** Debounce the push, in ms. Default 30_000. TRAP T-sync-pushes-a-snapshot-not-a-diff */
  interval?: number;
  /** The IndexedDB database name. Defaults to `sherpa`. */
  database?: string;
  /** Stop syncing when this aborts — the same token `bind()` and `persistView` take. */
  signal?: AbortSignal;
  /** A failed push is REPORTED, never thrown. TRAP T-local-first-then-onward */
  onError?: (error: unknown, stage: 'pull' | 'push') => void;
}

/* ── The sync ──────────────────────────────────────────────────────────── */

/** What `syncViews` hands back. Every method works with no remote and no IndexedDB. */
export interface ViewSync {
  /** Merge the remote under the local set into both local tiers. LOCAL WINS. */
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

/** Keep one page's saved views in three tiers. TRAP T-local-first-then-onward */
export function syncViews(page: string, options: SyncOptions = {}): ViewSync {
  const interval = options.interval ?? 30_000;
  const report = options.onError ?? ((): void => { /* reported nowhere by default */ });

  // The durable tier. One ROW per view, so a page reads only the view it needs.
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
      // The `page` index only narrows the read — T-idb-index-narrows-it-never-answers-it.
      const result = await idb.load({ filter: ['page', 'eq', page] });
      const views: SavedViewStore = {};
      for (const row of result.rows) {
        const id = String(row['id'] ?? '').replace(`${page}:`, '');
        const view = row['view'] as SavedView | undefined;
        if (id && view) views[id] = view;
      }
      return views;
    } catch (error) {
      // Storage blocked, or a version clash with another tab. Web Storage still answers.
      report(error, 'pull');
      return {};
    }
  };

  /** Write a whole set into IndexedDB, replacing this page's rows. */
  const toIdb = async (views: SavedViewStore): Promise<void> => {
    if (!idb) return;
    try {
      // Keyed `<page>:<id>`, so two pages cannot collide on an id like `default`.
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
    // The LOCAL set is what gets published.
    const views = { ...(await fromIdb()), ...loadSavedViews(page, options) };
    try {
      await options.remote.push(page, views);
    } catch (error) {
      // No retry timer: the next `touch` carries the same snapshot anyway.
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
      // Remote FIRST so local overwrites it — an unpushed local edit must win.
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
      // Only the WIRE is debounced; the durable copy is written NOW.
      void toIdb(loadSavedViews(page, options));
      schedule();
    },

    async flush(): Promise<void> {
      if (timer) { clearTimeout(timer); timer = null; }
      await push();
    },

    async stop(): Promise<void> {
      if (timer) { clearTimeout(timer); timer = null; }
      // Skipped on abort: the page is going, so the request dies mid-flight anyway.
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

/** A `ViewRemote` over HTTP — GET to pull, PUT to push. */
export function restViewRemote(options: RestViewRemoteOptions): ViewRemote {
  const at = (page: string): string => `${options.url.replace(/\/$/, '')}/${encodeURIComponent(page)}`;
  const headers = { 'content-type': 'application/json', ...options.headers };

  return {
    async pull(page: string): Promise<SavedViewStore> {
      const response = await fetch(at(page), {
        headers,
        ...(options.credentials ? { credentials: options.credentials } : {}),
      });
      // A 404 means nothing saved yet — the common first run, not an error.
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
