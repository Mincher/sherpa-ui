/**
 * read-plan.ts — the ONE decision a source makes before it reads: answer from
 * the held set, from it while it is checked behind, fetch it first, or ask the
 * store. Will's series (TODO 345): can held data answer? is it current? can the
 * store be reached? Pure and DOM-free. TRAP T-a-read-is-planned
 *
 * Map:
 * - Plan — How a question is answered.
 * - PlanInputs — What the decision reads: the page's cap, the store's held set, its history, and its reach.
 * - planRead — The plan for the next question, and whether to check the set behind it.
 */

/** How a question is answered: `held` — the set, current; `held-stale` — the
 *  set, unconfirmed; `fetch` — read the set first; `store` — ask the store. */
export type Plan = 'held' | 'held-stale' | 'fetch' | 'store';

/** What the decision reads. Later phases widen each part. */
export interface PlanInputs {
  /** The page's cap: the most rows it holds. */
  need: { cap: number };
  /** The store's held set, if any, and what refuses one. */
  held: {
    set: { size: number; gen: number; due: boolean } | null;
    /** The store's facts forbid holding it. */
    never: boolean;
    /** The largest cap a set was refused at, for its size. */
    over: number;
    /** The cap a whole read last failed at, or 0. */
    failedAt: number;
  };
  /** Does every change come through the store, and how many whole reads had landed when the page was made? */
  history: { announcesAll: boolean; since: number };
  /** Has this page started its one check behind? */
  reach: { tried: boolean };
}

/** The plan for the next question, and whether to check the set behind it
 *  (once a page — never on a toggle). The first row that matches wins. */
export function planRead({ need, held, history, reach }: PlanInputs): { plan: Plan; behind: boolean } {
  const { set } = held;
  const failed = held.failedAt > 0 && need.cap >= held.failedAt;
  if (!set) {
    if (held.never || need.cap <= held.over || failed) return { plan: 'store', behind: false };
    return { plan: 'fetch', behind: false };
  }
  if (set.size > need.cap) return { plan: 'store', behind: false };
  // Due, but no read may be sent at this cap: the store answers.
  if (set.due && (held.never || need.cap <= held.over)) return { plan: 'store', behind: false };
  // Known out of date, and the store answered last: read it first, as before.
  if (set.due && !failed) return { plan: 'fetch', behind: false };
  // The store could not give it again: the last set, unconfirmed.
  if (failed) return { plan: 'held-stale', behind: !reach.tried };
  // Held before this page, over a store that may miss a writer: shown at once, checked behind.
  if (!history.announcesAll && set.gen <= history.since) return { plan: 'held-stale', behind: !reach.tried };
  return { plan: 'held', behind: false };
}
