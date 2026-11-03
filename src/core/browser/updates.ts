/**
 * updates.ts — hear what is new: the app's own files, a new Service Worker having
 * taken over the page, a store's rows waiting, or a write made offline lost, as
 * the worker says. The page registers to hear it; nothing tells it to show
 * anything. Plan 652 S6
 * TRAP T-a-notice-is-heard-never-ordered
 *
 * Map:
 * - onUpdate — Hear each notice; the function it returns stops hearing.
 * - watchForUpdates — Ask the browser now and then for the app's new worker; the function it returns stops asking.
 * - noticeSeen — The reader has seen a kept notice: the worker forgets it.
 * - hearUpdates — Feed a page's `Updates` with each notice, and tell the worker of a lost save seen.
 */
import { NOTICE_CHANNEL, type UpdateNotice } from '../data/notices.js';
import type { Updates, UpdatesDetail } from '../data/updates.js';
import { askWorker } from './ask-worker.js';

/** Hear each notice; the function it returns stops hearing. */
export function onUpdate(listener: (notice: UpdateNotice) => void): () => void {
  const stop = new AbortController();
  const channel = new BroadcastChannel(NOTICE_CHANNEL);
  channel.addEventListener('message', (event) => {
    const notice = (event as MessageEvent<UpdateNotice | undefined>).data;
    if (notice?.kind === 'app' || notice?.kind === 'data' || notice?.kind === 'lost') listener(notice);
  }, { signal: stop.signal });
  const workers = navigator.serviceWorker;
  if (workers) {
    // The first worker to take a page over is no news: the page runs what it loaded.
    let had = !!workers.controller;
    workers.addEventListener('controllerchange', () => {
      if (had) listener({ kind: 'app' });
      had = true;
      void askWorker({ sherpa: 'notices' });
    }, { signal: stop.signal });
  }
  /* What the worker kept unseen — a write lost with every tab shut — said again, to
     every tab: a listener keys each by its id. S7b · TRAP T-a-newer-write-wins */
  void askWorker({ sherpa: 'notices' });
  return () => {
    stop.abort();
    channel.close();
  };
}

/** Ask the browser now and then for the app's new worker — every few minutes, and
 *  when the tab is shown again or back online — or it looks only when a page loads,
 *  or once a day. A new one takes the page over, and `onUpdate` hears that. The app's
 *  server must change its worker script with each build. Will, plan 652
 *  TRAP T-a-new-build-is-a-new-worker */
export function watchForUpdates(options: { every?: number } = {}): () => void {
  const workers = navigator.serviceWorker;
  if (!workers) return () => undefined;
  const check = (): void => {
    void workers.getRegistration().then((registration) => registration?.update()).catch(() => undefined);
  };
  const stop = new AbortController();
  const timer = setInterval(check, options.every ?? 300_000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check();
  }, { signal: stop.signal });
  window.addEventListener('online', check, { signal: stop.signal });
  return () => {
    clearInterval(timer);
    stop.abort();
  };
}

/** The reader has seen a kept notice: the worker forgets it, and no page that
 *  opens is told it again. */
export function noticeSeen(id: string): void {
  void askWorker({ sherpa: 'seen', id });
}

/** Feed a page's `Updates` with each notice, and tell the worker of a lost save the
 *  reader took in; the function it returns stops. Plan 687 U1 */
export function hearUpdates(updates: Updates): () => void {
  const stop = onUpdate((notice) => updates.hear(notice));
  const seen = (event: Event): void => {
    const taken = (event as CustomEvent<UpdatesDetail>).detail.taken;
    if (taken?.kind === 'lost' && taken.key !== undefined) noticeSeen(taken.key);
  };
  updates.addEventListener('change', seen);
  return () => {
    stop();
    updates.removeEventListener('change', seen);
  };
}
