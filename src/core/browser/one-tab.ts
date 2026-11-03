/**
 * one-tab.ts — ONE tab of an app leads: the tab that holds a Web Lock runs the
 * work, and every tab talks on a channel of the same name; when that tab shuts,
 * the browser lets go of its lock and the next tab takes it. Headless-safe: with
 * no Web Locks or no channel, this tab leads, alone. TRAP T-one-feed-for-every-tab
 *
 * Map:
 * - OneTab — What a tab can do while it takes part: say a message to the others, and stop.
 * - oneTab — Lead in one tab of the app, under the lock `name`; hear the others on its channel.
 */

/** What a tab can do while it takes part: say a message to the others, and stop. */
export interface OneTab<T> {
  /** Say a message to every other tab. */
  say(message: T): void;
  /** Stop: this tab's lead ends, and the next tab takes it. */
  stop(): void;
}

/** Lead in one tab of the app, under the lock `name`; hear the others on the
 *  channel of that name. `lead` runs while this tab holds the lock, and what it
 *  returns ends its lead. Each name is ONE election: two uses never share one. */
export function oneTab<T>(name: string, options: { lead(): () => void; hear?(message: T): void }): OneTab<T> {
  const locks = (globalThis as { navigator?: { locks?: LockManager } }).navigator?.locks;
  if (!locks || typeof BroadcastChannel === 'undefined') {
    const end = options.lead();
    return { say: () => undefined, stop: end };
  }
  const stop = new AbortController();
  const channel = new BroadcastChannel(name);
  channel.addEventListener('message', (event) => options.hear?.((event as MessageEvent<T>).data), { signal: stop.signal });
  let release: (() => void) | null = null;
  // Held until this tab stops, or shuts: the browser lets go of a shut tab's lock.
  locks.request(name, { signal: stop.signal }, () => new Promise<void>((done) => {
    const end = options.lead();
    release = () => {
      end();
      done();
    };
  })).catch(() => undefined);
  return {
    say: (message) => channel.postMessage(message),
    stop: () => {
      stop.abort();
      release?.();
      release = null;
      channel.close();
    },
  };
}
