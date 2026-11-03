/**
 * notices.ts — what is new, said once to every tab: a fact, never a request to
 * show it. The worker says that newer data waits; a component that listens shows
 * it. What WAITS for a reader — not the feed's `FeedNotice`, what CHANGED, which
 * one tab acts on and nobody shows. DOM-free. Plan 652 S6
 * TRAP T-a-notice-is-heard-never-ordered
 *
 * Map:
 * - NOTICE_CHANNEL — The BroadcastChannel a notice is said on.
 * - UpdateNotice — What is new: the app's own files, a store's rows waiting, or a write made offline lost.
 * - WorkerAsk — What a page asks of its worker: its kept notices, one seen, or a sign-out.
 * - sayNotice — Say a notice to every tab.
 */
import type { FailureKind } from './failure.js';

/** The BroadcastChannel a notice is said on. */
export const NOTICE_CHANNEL = 'sherpa-notices';

/** What is new: the app's own files (`app`), a store's rows waiting (`data`), or a
 *  write made offline that did not land (`lost`). */
export interface UpdateNotice {
  kind: 'app' | 'data' | 'lost';
  /** The store whose rows wait, or whose write was lost. */
  store?: string;
  /** How many rows the newer set holds, where it is known. */
  rows?: number;
  /** A KEPT notice's id: it is said again to each page that opens, until one says
   *  it was seen (D9). S7b · TRAP T-a-newer-write-wins */
  id?: string;
  /** The row a lost write was for. */
  key?: unknown;
  /** Why it was lost: `conflict` — a newer write won (D3). */
  why?: FailureKind;
}

/** What a page asks of its worker: say its kept notices again, forget one the
 *  reader has seen, or forget all it holds — a sign-out, answered on the port sent
 *  with it. Posted to the worker, which it wakes. */
export type WorkerAsk = { sherpa: 'notices' } | { sherpa: 'seen'; id: string } | { sherpa: 'sign-out' };

/** Say a notice to every tab — the worker's, or a page's. */
export function sayNotice(notice: UpdateNotice): void {
  const channel = new BroadcastChannel(NOTICE_CHANNEL);
  channel.postMessage(notice);
  channel.close();
}
