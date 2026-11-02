/**
 * notices.ts — what is new, said once to every tab: a fact, never a request to
 * show it. The worker says that newer data waits; a component that listens shows
 * it. DOM-free. Plan 652 S6 · TRAP T-a-notice-is-heard-never-ordered
 *
 * Map:
 * - NOTICE_CHANNEL — The BroadcastChannel a notice is said on.
 * - UpdateNotice — What is new: the app's own files, a store's rows waiting, or a write made offline lost.
 * - NoticeAsk — What a page asks of the worker about its kept notices.
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
  /** How many rows moved, where it is known. */
  rows?: number;
  /** A KEPT notice's id: it is said again to each page that opens, until one says
   *  it was seen (D9). S7b · TRAP T-a-newer-write-wins */
  id?: string;
  /** The row a lost write was for. */
  key?: unknown;
  /** Why it was lost: `conflict` — a newer write won (D3). */
  why?: FailureKind;
}

/** What a page asks of the worker about its kept notices: say them all again, or
 *  forget one the reader has seen. Posted to the worker, which it wakes. */
export type NoticeAsk = { sherpa: 'notices' } | { sherpa: 'seen'; id: string };

/** Say a notice to every tab — the worker's, or a page's. */
export function sayNotice(notice: UpdateNotice): void {
  const channel = new BroadcastChannel(NOTICE_CHANNEL);
  channel.postMessage(notice);
  channel.close();
}
