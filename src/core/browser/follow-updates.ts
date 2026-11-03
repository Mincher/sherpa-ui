/**
 * follow-updates.ts — follow the app server's "what is new" feed in ONE tab of the
 * app: a new build makes it ask the browser for the new worker; a store that changed
 * makes the worker check that store behind; a gap, both, for every store. What any
 * finds reaches every tab as a notice, so the feed passes nothing on. Where no feed
 * answers, every tab polls instead. Plan 687 U2–U4
 * TRAP T-news-is-pushed-by-the-server
 *
 * Map:
 * - FollowOptions — Where the feed is, and where the worker serves the data.
 * - followUpdates — Follow the feed in one tab of the app; the function it returns stops this tab's part.
 */
import type { FeedNotice } from '../data/updates-feed.js';
import { watchForUpdates } from './updates.js';

/** Where the feed is, and where the worker serves the data. */
export interface FollowOptions {
  /** The feed: `/sherpa/updates`. */
  url?: string;
  /** The worker's data path: `/sherpa/data/`. */
  base?: string;
}

/** Follow the feed in one tab of the app — the one that holds its Web Lock; when
 *  that tab shuts, the next takes it. Where no feed answers, every tab asks the
 *  browser now and then instead (`watchForUpdates`). The function it returns stops
 *  this tab's part. */
export function followUpdates(options: FollowOptions = {}): () => void {
  const url = options.url ?? '/sherpa/updates';
  const base = options.base ?? '/sherpa/data/';
  // Each tab asks the browser until the feed is heard to answer. U4
  let polling: (() => void) | null = null;
  const poll = (on: boolean): void => {
    if (on && !polling) polling = watchForUpdates();
    if (!on && polling) {
      polling();
      polling = null;
    }
  };
  poll(true);
  if (typeof EventSource === 'undefined') return () => poll(false);
  const act = (event: MessageEvent<string>): void => {
    let notice: FeedNotice | undefined;
    try {
      notice = JSON.parse(event.data) as FeedNotice;
    } catch {
      return;
    }
    if (notice.kind === 'app' || notice.kind === 'gap') {
      void navigator.serviceWorker?.getRegistration().then((registration) => registration?.update()).catch(() => undefined);
    }
    // The worker reads it again behind its held set; newer rows wait, and it says so.
    if (notice.kind === 'data' && notice.store) void fetch(`${base}${encodeURIComponent(notice.store)}?recheck`).catch(() => undefined);
    // It missed more than the feed could say again: every store, once.
    if (notice.kind === 'gap') void fetch(`${base}?recheck`).catch(() => undefined);
  };
  /* The holder says whether the feed answers, to every tab; a tab that opens later
     asks. A feed that refuses — no such path — stays shut, and every tab polls. */
  const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('sherpa-feed:updates');
  let live: boolean | null = null;
  const say = (now: boolean): void => {
    live = now;
    poll(!now);
    channel?.postMessage(now ? 'live' : 'down');
  };
  channel?.addEventListener('message', (event: MessageEvent<string>) => {
    if (event.data === 'ask') {
      if (live !== null) channel.postMessage(live ? 'live' : 'down');
    } else if (live === null) {
      poll(event.data !== 'live');
    }
  });
  channel?.postMessage('ask');
  const open = (): EventSource => {
    const source = new EventSource(url);
    source.addEventListener('message', act);
    source.addEventListener('open', () => say(true));
    source.addEventListener('error', () => {
      if (source.readyState === EventSource.CLOSED) say(false);
    });
    return source;
  };
  const locks = navigator.locks as LockManager | undefined;
  if (!locks) {
    const source = open();
    return () => {
      source.close();
      channel?.close();
      poll(false);
    };
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
    channel?.close();
    poll(false);
  };
}
