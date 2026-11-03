/**
 * held-reads.ts — where a reader's next read goes: a remote store's one held set,
 * or the store itself — the plan's state over a `StoreCache`. A `HeldStore` reads
 * through it, in the page or a worker. DOM-free. Plan 652 S5a
 * TRAP T-a-remote-source-holds-its-whole-set · TRAP T-a-read-is-planned
 *
 * Map:
 * - HeldReadsOptions — The most rows it holds, and the fields its reader needs.
 * - HeldReads — The next read's plan over a store's held set, and what answers it.
 * - .cache — The store's ONE held set, shared with every reader over it; none at a cap of 0.
 * - .cap — The most rows it holds.
 * - .since — How many whole reads had landed when it was made: a set from before may miss a writer.
 * - .plan — How its last question was answered.
 * - .closed — Closed: it asks the store, never the shared set.
 * - .reads — What a read asks, as the plan says: the held set — current, or shown while it is checked — else the store.
 * - .planNow — The plan for the next question, as the store's set stands now.
 * - .hold — Hold the store's whole set, where it can be: one read for every reader over it.
 * - .recheck — Read the set again behind the one shown.
 */
import { planRead, type Plan } from './read-plan.js';
import { cacheOf, type StoreCache } from './store-cache.js';
import type { Store } from './store.js';

/** The most rows it holds, and the fields its reader needs. */
export interface HeldReadsOptions {
  /** The most rows it holds; 0 holds none. */
  cap: number;
  /** The fields its reader reads from a row, or null — every field. */
  need: () => readonly string[] | null;
}

/** The next read's plan over a store's held set, and what answers it. */
export class HeldReads {
  /** The store's ONE held set, shared with every reader over it; none at a cap of 0. */
  readonly cache: StoreCache | null;
  /** The most rows it holds. */
  readonly cap: number;
  /** How many whole reads had landed when it was made: a set from before may miss a writer. */
  readonly since: number;
  /** How its last question was answered. */
  plan: Plan = 'store';
  /** Closed: it asks the store, never the shared set. */
  closed = false;
  /** The store it reads. */
  readonly #store: Store;
  /** The fields its reader needs. */
  readonly #need: () => readonly string[] | null;
  /** Its first hold has tried a failed whole read once more. */
  #checked = false;
  /** It has started its ONE check of the set behind it. */
  #tried = false;

  constructor(store: Store, options: HeldReadsOptions) {
    this.#store = store;
    this.cap = options.cap;
    this.#need = options.need;
    // Only a HeldStore reads through it: which store is held is `heldOf`'s rule.
    this.cache = options.cap > 0 ? cacheOf(store) : null;
    this.since = this.cache?.gen ?? 0;
  }

  /** The set while it is open, else none. */
  get #live(): StoreCache | null {
    return this.closed ? null : this.cache;
  }

  /** What a read asks, as the plan says: the held set — current, or shown while it
   *  is checked — else the store. */
  get reads(): Pick<Store, 'load' | 'totalCount' | 'distinct' | 'scan'> {
    const set = this.#live?.set;
    return set && (this.plan === 'held' || this.plan === 'held-stale') ? set : this.#store;
  }

  /** The plan for the next question, as the store's set stands now. */
  planNow(): { plan: Plan; behind: boolean } {
    const cache = this.#live;
    if (!cache) return { plan: 'store', behind: false };
    const set = cache.set;
    return planRead({
      need: { cap: this.cap },
      held: {
        set: set ? { size: set.size, gen: cache.gen, due: cache.due, covers: set.covers(this.#need()) } : null,
        never: cache.never, over: cache.over, failedAt: cache.failedAt,
      },
      history: { announcesAll: !!this.#store.capabilities.announcesAll, since: this.since },
      reach: { tried: this.#tried },
    });
  }

  /** Hold the store's whole set, where it can be: one read for every reader over
   *  it. TRAP T-a-store-has-one-cache */
  async hold(): Promise<void> {
    const cache = this.#live;
    if (!cache) {
      this.plan = 'store';
      return;
    }
    /* A new page tries a failed whole read once more, as each page did before
       the set was the store's — behind the set, where one is held, so the page
       is never held up for it. */
    if (!this.#checked) {
      this.#checked = true;
      if (cache.failed && !cache.set) cache.retry();
    }
    for (;;) {
      const { plan, behind } = this.planNow();
      this.plan = plan;
      /* A set it cannot vouch for answers at once, and is read again BEHIND it —
         once a page, at open or a first load: never on a toggle (340). */
      if (behind) {
        this.#tried = true;
        cache.recheck(this.cap, this.#need());
      }
      if (plan !== 'fetch') return;
      const moved = (): string => `${cache.gen}:${cache.over}:${cache.failedAt}:${cache.never}:${cache.due}:${cache.set?.fields}`;
      const before = moved();
      const held = cache.set;
      await cache.hold(this.cap, this.#need());
      // A read that just failed WAS this page's check: no second one at once.
      if (cache.failed) this.#tried = true;
      // Nothing moved — no read could be sent, and no kept copy landed: the store answers.
      if (moved() === before && cache.set === held) {
        this.plan = 'store';
        return;
      }
    }
  }

  /** Read the set again behind the one shown. */
  recheck(): void {
    this.#live?.recheck(this.cap, this.#need());
  }
}
