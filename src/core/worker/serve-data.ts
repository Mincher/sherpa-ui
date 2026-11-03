/**
 * serve-data.ts — the data layer's own requests, answered in the Service Worker:
 * one copy of each store for every tab, and offline; the writes made offline sent
 * when it starts, and on Background Sync; one that was lost kept as a notice until
 * a page has seen it (S7b). Plan 652 S4
 * TRAP T-the-worker-answers-the-data
 *
 * Map:
 * - OUTBOX_SYNC — The Background Sync tag the worker sends its stores' waiting writes on.
 * - PushSaid — What a push says, as Sherpa reads it: a store that changed on the server, and a notification.
 * - ServeDataOptions — The stores the worker answers for, and what each request waits for.
 * - serveData — Answer the data layer's requests in the worker, from the stores the app hands it.
 */
import { DATA_BASE, createDataHandler, type DataHandler, type DataHandlerOptions } from '../data/data-handler.js';
import { forgetKept } from '../browser/cache-keep.js';
import { keepNotices } from '../browser/notice-keep.js';
import { keepOutbox } from '../browser/outbox-keep.js';
import { heldOf, type LostWrite } from '../data/held-store.js';
import { sayNotice, type UpdateNotice, type WorkerAsk } from '../data/notices.js';
import type { WorkerFetchEvent, WorkerScope } from './app-files.js';

/** The Background Sync tag the worker sends its stores' waiting writes on. */
export const OUTBOX_SYNC = 'sherpa-outbox';

/** What a push says, as Sherpa reads it: a store that changed on the server, and a
 *  notification. The app's server sends it, with its own keys. Plan 652 S8 */
export interface PushSaid {
  /** A store that changed on the server: a held one is read again behind, and its
   *  newer rows wait (S6c); any other says newer data waits. */
  store?: string;
  /** Shown where the reader allowed notifications; a press opens `url`. */
  notification?: { title: string; body?: string; url?: string };
}

/** A push, or a press on a notification. */
interface WorkerPushEvent extends Event {
  readonly data?: { json(): unknown } | null;
  readonly notification?: { close(): void; readonly data?: { url?: string } };
  waitUntil(promise: Promise<unknown>): void;
}

/** A page's message to the worker: it starts the worker, as a channel cannot. */
interface WorkerMessageEvent extends Event {
  readonly data: unknown;
  /** Where an ask that is answered says it is done. */
  readonly ports?: ReadonlyArray<{ postMessage(message: unknown): void }>;
  waitUntil(promise: Promise<unknown>): void;
}

/** A Background Sync: Chromium's, with every tab perhaps shut. */
interface SyncEvent extends Event {
  readonly tag: string;
  waitUntil(promise: Promise<unknown>): void;
}

/** The stores the worker answers for, and what each request waits for. */
export interface ServeDataOptions extends DataHandlerOptions {
  /** Settles once the stores are ready — a first seed written. Each request waits
   *  for it; a store that could not be opened answers for itself. */
  ready?: Promise<unknown>;
}

/** Answer the data layer's requests in the worker, from the stores the app's worker
 *  script imports and hands it (D7: a worker cannot `import()` at runtime). Each
 *  remote store is read through the worker's own `HeldStore`, its writes made
 *  offline waiting on the device; one the app holds itself is served as it is.
 *  The handler it answers with is handed back: the app may ask it too.
 *  TRAP T-a-remote-store-is-read-through-a-held-store */
export function serveData(scope: WorkerScope, options: ServeDataOptions): DataHandler {
  const stores = options.stores.through(({ name, as, store }) => heldOf(store, { outbox: keepOutbox(as === undefined ? name : `${name}:${as}`) }) ?? store);
  const handle = createDataHandler({ ...options, stores, notifies: true, host: 'worker' });
  /* The writes made offline, sent: when the worker starts, and on Chromium's sync.
     A send still offline rejects, so the browser tries the sync again. S7a
     TRAP T-a-write-made-offline-waits */
  const sendAll = async (): Promise<void> => {
    await options.ready?.catch(() => undefined);
    const sent = await Promise.all(stores.all().map(({ store }) => store.send?.() ?? true));
    if (sent.includes(false)) throw new Error('serveData: a write made offline is still waiting.');
  };
  void sendAll().catch(() => undefined);
  scope.addEventListener('sync', (event) => {
    if ((event as SyncEvent).tag === OUTBOX_SYNC) (event as SyncEvent).waitUntil(sendAll());
  });
  /* A write made offline that was lost is KEPT as a notice until a page says it was
     seen: said now, and again to each page that asks as it opens — it may have
     been sent with every tab shut (D9). S7b · TRAP T-a-newer-write-wins */
  const kept = keepNotices();
  scope.addEventListener('message', (event) => {
    const asked = event as WorkerMessageEvent;
    const ask = asked.data as WorkerAsk | undefined;
    if (ask?.sherpa === 'notices') asked.waitUntil(kept.read().then((all) => all.forEach(sayNotice)));
    if (ask?.sherpa === 'seen') asked.waitUntil(kept.remove(ask.id));
    /* A sign-out: every held set, the rows shown, the writes that wait and the kept
       notices are forgotten here, or the held set writes the copy back. Its keeps go
       on — `keepCache` ran once, in its script — so the next reader's set is kept.
       TRAP T-a-kept-set-is-checked-each-session */
    if (ask?.sherpa === 'sign-out') {
      asked.waitUntil(Promise.allSettled([
        ...stores.all().map(({ store }) => (store.capabilities.holds ? store.forget?.() : undefined)),
        forgetKept({ keepOn: true }), kept.clear(),
      ]).then(() => asked.ports?.[0]?.postMessage('signed-out')));
    }
  });
  const base = options.base ?? DATA_BASE;
  /* A PUSH from the app's server: the store it names is checked behind — the feed's
     own ask — so its newer rows wait and the banner shows; a notification shows
     where allowed, and its press opens the app. S8 · TRAP T-a-push-is-a-check-behind */
  scope.addEventListener('push', (event) => {
    let said: PushSaid = {};
    try {
      said = ((event as WorkerPushEvent).data?.json() ?? {}) as PushSaid;
    } catch { /* not JSON: nothing Sherpa reads */ }
    const checked = said.store ? handle(new Request(new URL(`${base}${encodeURIComponent(said.store)}?recheck`, scope.location.origin))) : undefined;
    const { title, body, url } = said.notification ?? {};
    const shown = title ? scope.registration?.showNotification?.(title, { ...(body ? { body } : {}), data: { url: url ?? '/' } }) : undefined;
    (event as WorkerPushEvent).waitUntil(Promise.all([checked, shown?.catch(() => undefined)]));
  });
  /* A press opens its `url`: a tab that shows it is focused, else it opens in a new
     one — an open tab is never moved off its work. TRAP T-a-push-is-a-check-behind */
  scope.addEventListener('notificationclick', (event) => {
    const pressed = event as WorkerPushEvent;
    pressed.notification?.close();
    const url = new URL(pressed.notification?.data?.url ?? '/', scope.location.origin).href;
    pressed.waitUntil((async () => {
      const tabs = (await scope.clients.matchAll?.({ type: 'window' })) ?? [];
      const tab = tabs.find((each) => each.url === url);
      if (tab) await tab.focus();
      else await scope.clients.openWindow?.(url);
    })());
  });
  for (const { name, store } of stores.all()) {
    store.addEventListener('lost', (event) => {
      const lost = (event as CustomEvent<LostWrite>).detail;
      const notice: UpdateNotice & { id: string } = { kind: 'lost', id: `${name}|${lost.id}`, store: name, key: lost.key, why: lost.why };
      void kept.put(notice).catch(() => undefined).then(() => sayNotice(notice));
    });
    // A write waits: the browser sends it once back online, if it can — with no tab open.
    store.addEventListener('queued', () => {
      void scope.registration?.sync?.register(OUTBOX_SYNC).catch(() => undefined);
    });
  }
  scope.addEventListener('fetch', (event) => {
    const { request } = event as WorkerFetchEvent;
    const url = new URL(request.url);
    if (url.origin !== scope.location.origin || !url.pathname.startsWith(base)) return;
    (event as WorkerFetchEvent).respondWith((async () => {
      await options.ready?.catch(() => undefined);
      return (await handle(request)) ?? new Response(null, { status: 404 });
    })());
  });
  return handle;
}
