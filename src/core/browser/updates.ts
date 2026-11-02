/**
 * updates.ts — hear what is new: the app's own files, a new Service Worker having
 * taken over the page, a store's rows waiting, or a write made offline lost, as
 * the worker says. The page registers to hear it; nothing tells it to show
 * anything. Plan 652 S6
 * TRAP T-a-notice-is-heard-never-ordered
 *
 * Map:
 * - onUpdate — Hear each notice; the function it returns stops hearing.
 * - noticeSeen — The reader has seen a kept notice: the worker forgets it.
 */
import { NOTICE_CHANNEL, type NoticeAsk, type UpdateNotice } from '../data/notices.js';

/** Ask the page's worker — waking it, as a channel cannot. */
function ask(message: NoticeAsk): void {
  navigator.serviceWorker?.controller?.postMessage(message);
}

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
      ask({ sherpa: 'notices' });
    }, { signal: stop.signal });
  }
  /* What the worker kept unseen — a write lost with every tab shut — said again, to
     every tab: a listener keys each by its id. S7b · TRAP T-a-newer-write-wins */
  ask({ sherpa: 'notices' });
  return () => {
    stop.abort();
    channel.close();
  };
}

/** The reader has seen a kept notice: the worker forgets it, and no page that
 *  opens is told it again. */
export function noticeSeen(id: string): void {
  ask({ sherpa: 'seen', id });
}
