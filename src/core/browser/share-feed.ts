/**
 * share-feed.ts — one live feed for every tab of an app: the tab that leads
 * (`oneTab`, under `sherpa-feed:<name>`) opens it, and passes each message to the
 * others; when that tab shuts, another opens it. Not in the Service Worker: a
 * worker is stopped when idle, and the feed with it. Headless-safe: with no Web
 * Locks the feed opens here, as before. Plan 652 S8 · TRAP T-one-feed-for-every-tab
 *
 * Map:
 * - shareFeed — Open a live store's feed once for every tab; the function it returns stops this tab's part.
 */
import type { EventStore, SocketStore } from '../data/live-stores.js';
import { oneTab } from './one-tab.js';

/** Open a live store's feed once for every tab; the function it returns stops
 *  this tab's part. `name` is the feed's: every tab that shares it names it so. */
export function shareFeed(feed: EventStore | SocketStore, name: string): () => void {
  const tab = oneTab<unknown>(`sherpa-feed:${name}`, {
    lead: () => {
      const pass = (event: Event): void => tab.say((event as CustomEvent).detail);
      feed.addEventListener('message', pass);
      feed.connect();
      return () => {
        feed.removeEventListener('message', pass);
        feed.disconnect();
      };
    },
    // Another tab holds the feed: what it hears is applied here too.
    hear: (raw) => feed.hear(raw),
  });
  return () => tab.stop();
}
