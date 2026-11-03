/**
 * ask-worker.ts — a page's word to its app's Service Worker, by `postMessage`: a
 * message starts a stopped worker, as a channel cannot. Headless-safe: with no
 * worker, nothing is asked.
 *
 * Map:
 * - askWorker — Ask the app's worker; with `answered`, settle once it says it is done.
 */
import type { WorkerAsk } from '../data/notices.js';

/** Ask the app's worker — the page's, else the active one, as a page it does not
 *  control yet still shares its data. With `answered`, settle once it says it is
 *  done, or after 3 s: a worker from before an ask never answers it. */
export async function askWorker(ask: WorkerAsk, options: { answered?: boolean } = {}): Promise<void> {
  const workers = (globalThis as { navigator?: { serviceWorker?: ServiceWorkerContainer } }).navigator?.serviceWorker;
  const worker = workers?.controller ?? (await workers?.getRegistration().catch(() => undefined))?.active;
  if (!worker) return;
  if (!options.answered) return worker.postMessage(ask);
  const { port1, port2 } = new MessageChannel();
  await new Promise<void>((done) => {
    const late = setTimeout(done, 3000);
    port1.onmessage = (): void => {
      clearTimeout(late);
      done();
    };
    worker.postMessage(ask, [port2]);
  });
  port1.close();
}
