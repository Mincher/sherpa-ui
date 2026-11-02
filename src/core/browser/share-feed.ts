/**
 * share-feed.ts — one live feed for every tab of an app: the tab that holds a Web
 * Lock opens it, and passes each message to the others on a channel; when that tab
 * shuts, another takes the lock and opens it. Not in the Service Worker: a worker
 * is stopped when idle, and the feed with it. Headless-safe: with no Web Locks the
 * feed opens here, as before. Plan 652 S8 · TRAP T-one-feed-for-every-tab
 *
 * Map:
 * - shareFeed — Open a live store's feed once for every tab; the function it returns stops this tab's part.
 */
import type { EventStore, SocketStore } from '../data/live-stores.js';

/** Open a live store's feed once for every tab; the function it returns stops
 *  this tab's part. `name` is the feed's: every tab that shares it names it so. */
export function shareFeed(feed: EventStore | SocketStore, name: string): () => void {
  const locks = (globalThis as { navigator?: { locks?: LockManager } }).navigator?.locks;
  if (!locks || typeof BroadcastChannel === 'undefined') {
    feed.connect();
    return () => feed.disconnect();
  }
  const stop = new AbortController();
  const channel = new BroadcastChannel(`sherpa-feed:${name}`);
  // Another tab holds the feed: what it hears is applied here too.
  channel.addEventListener('message', (event) => feed.hear((event as MessageEvent).data), { signal: stop.signal });
  const pass = (event: Event): void => channel.postMessage((event as CustomEvent).detail);
  let release: (() => void) | null = null;
  // Held until this tab stops, or shuts: the browser lets go of a shut tab's lock.
  locks.request(`sherpa-feed:${name}`, { signal: stop.signal }, () => new Promise<void>((done) => {
    release = done;
    feed.addEventListener('message', pass);
    feed.connect();
  })).catch(() => undefined);
  return () => {
    stop.abort();
    feed.removeEventListener('message', pass);
    feed.disconnect();
    release?.();
    channel.close();
  };
}
