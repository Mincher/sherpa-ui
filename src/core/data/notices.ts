/**
 * notices.ts — what is new, said once to every tab: a fact, never a request to
 * show it. The worker says that newer data waits; a component that listens shows
 * it. DOM-free. Plan 652 S6 · TRAP T-a-notice-is-heard-never-ordered
 *
 * Map:
 * - NOTICE_CHANNEL — The BroadcastChannel a notice is said on.
 * - UpdateNotice — What is new: the app's own files, or a store's rows, waiting.
 * - sayNotice — Say a notice to every tab.
 */

/** The BroadcastChannel a notice is said on. */
export const NOTICE_CHANNEL = 'sherpa-notices';

/** What is new: the app's own files (`app`), or a store's rows (`data`), waiting. */
export interface UpdateNotice {
  kind: 'app' | 'data';
  /** The store whose rows wait. */
  store?: string;
  /** How many rows moved, where it is known. */
  rows?: number;
}

/** Say a notice to every tab — the worker's, or a page's. */
export function sayNotice(notice: UpdateNotice): void {
  const channel = new BroadcastChannel(NOTICE_CHANNEL);
  channel.postMessage(notice);
  channel.close();
}
