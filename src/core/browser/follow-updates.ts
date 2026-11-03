/**
 * follow-updates.ts — follow the app server's "what is new" feed in ONE tab of the
 * app: a new build makes it ask the browser for the new worker; a store that changed
 * makes the worker check that store behind. What either finds reaches every tab as a
 * notice, so the feed passes nothing on. Plan 687 U2
 * TRAP T-news-is-pushed-by-the-server
 *
 * Map:
 * - FollowOptions — Where the feed is, and where the worker serves the data.
 * - followUpdates — Follow the feed in one tab of the app; the function it returns stops this tab's part.
 */
import type { FeedNotice } from '../data/updates-feed.js';

/** Where the feed is, and where the worker serves the data. */
export interface FollowOptions {
  /** The feed: `/sherpa/updates`. */
  url?: string;
  /** The worker's data path: `/sherpa/data/`. */
  base?: string;
}

/** Follow the feed in one tab of the app — the one that holds its Web Lock; when
 *  that tab shuts, the next takes it. The function it returns stops this tab's part. */
export function followUpdates(options: FollowOptions = {}): () => void {
  const url = options.url ?? '/sherpa/updates';
  const base = options.base ?? '/sherpa/data/';
  if (typeof EventSource === 'undefined') return () => undefined;
  const act = (event: MessageEvent<string>): void => {
    let notice: FeedNotice | undefined;
    try {
      notice = JSON.parse(event.data) as FeedNotice;
    } catch {
      return;
    }
    if (notice.kind === 'app') {
      void navigator.serviceWorker?.getRegistration().then((registration) => registration?.update()).catch(() => undefined);
    } else if (notice.kind === 'data' && notice.store) {
      // The worker reads it again behind its held set; newer rows wait, and it says so.
      void fetch(`${base}${encodeURIComponent(notice.store)}?recheck`).catch(() => undefined);
    }
  };
  const open = (): EventSource => {
    const source = new EventSource(url);
    source.addEventListener('message', act);
    return source;
  };
  const locks = navigator.locks as LockManager | undefined;
  if (!locks) {
    const source = open();
    return () => source.close();
  }
  const stop = new AbortController();
  let source: EventSource | null = null;
  let release: (() => void) | null = null;
  locks.request('sherpa-feed:updates', { signal: stop.signal }, () => new Promise<void>((done) => {
    release = done;
    source = open();
  })).catch(() => undefined);
  return () => {
    stop.abort();
    source?.close();
    release?.();
  };
}
