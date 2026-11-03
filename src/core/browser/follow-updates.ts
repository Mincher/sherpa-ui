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
import { oneTab } from './one-tab.js';
import { watchForUpdates } from './updates.js';

/** Where the feed is, and where the worker serves the data. */
export interface FollowOptions {
  /** The feed: `/sherpa/updates`. */
  url?: string;
  /** The worker's data path: `/sherpa/data/`. */
  base?: string;
}

/** Follow the feed in one tab of the app — the one that leads `sherpa-news`, its
 *  own name, never a shared feed's; when that tab shuts, the next takes it. Where
 *  no feed answers, every tab asks the browser now and then instead
 *  (`watchForUpdates`). The function it returns stops this tab's part. */
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
  /* The leader says whether the feed answers, to every tab; a tab that opens later
     asks. A feed that refuses — no such path — stays shut, and every tab polls. */
  let live: boolean | null = null;
  const say = (now: boolean): void => {
    live = now;
    poll(!now);
    tab.say(now ? 'live' : 'down');
  };
  const tab = oneTab<string>('sherpa-news', {
    lead: () => {
      const source = new EventSource(url);
      source.addEventListener('message', act);
      source.addEventListener('open', () => say(true));
      source.addEventListener('error', () => {
        if (source.readyState === EventSource.CLOSED) say(false);
      });
      return () => source.close();
    },
    hear: (said) => {
      if (said === 'ask') {
        if (live !== null) tab.say(live ? 'live' : 'down');
      } else if (live === null) {
        poll(said !== 'live');
      }
    },
  });
  tab.say('ask');
  return () => {
    tab.stop();
    poll(false);
  };
}
