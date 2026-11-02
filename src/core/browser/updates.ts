/**
 * updates.ts — hear what is new: the app's own files, a new Service Worker having
 * taken over the page, or a store's rows waiting, as the worker says. The page
 * registers to hear it; nothing tells it to show anything. Plan 652 S6
 * TRAP T-a-notice-is-heard-never-ordered
 *
 * Map:
 * - onUpdate — Hear each notice; the function it returns stops hearing.
 */
import { NOTICE_CHANNEL, type UpdateNotice } from '../data/notices.js';

/** Hear each notice; the function it returns stops hearing. */
export function onUpdate(listener: (notice: UpdateNotice) => void): () => void {
  const stop = new AbortController();
  const channel = new BroadcastChannel(NOTICE_CHANNEL);
  channel.addEventListener('message', (event) => {
    const notice = (event as MessageEvent<UpdateNotice | undefined>).data;
    if (notice?.kind === 'app' || notice?.kind === 'data') listener(notice);
  }, { signal: stop.signal });
  const workers = navigator.serviceWorker;
  if (workers) {
    // The first worker to take a page over is no news: the page runs what it loaded.
    let had = !!workers.controller;
    workers.addEventListener('controllerchange', () => {
      if (had) listener({ kind: 'app' });
      had = true;
    }, { signal: stop.signal });
  }
  return () => {
    stop.abort();
    channel.close();
  };
}
