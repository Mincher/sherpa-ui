/**
 * store-cache.ts — ONE held set per remote store, shared by every page over it:
 * one whole read, each store change taken once, and the set kept when a page
 * closes, so a page opened again asks nothing. DOM-free.
 * TRAP T-a-store-has-one-cache · TRAP T-a-remote-source-holds-its-whole-set
 *
 * Map:
 * - CacheChangeDetail — A store change, as the cache passes it on: did the set take it in place?
 * - StoreCache — A remote store's whole set, held once for every source over it.
 * - .store — The store it holds.
 * - .set — The held set, or null.
 * - .gen — How many whole reads have landed.
 * - .due — The set is out of date: a change it could not take, or a Refresh.
 * - .failed — The last whole read failed: questions ask the store until a change, a Refresh or a new page.
 * - .failedAt — The cap the last whole read failed at, or 0.
 * - .failure — Why the last whole read failed, while it stands — its kind and message.
 * - .never — The store's own facts forbid holding it.
 * - .over — The largest cap a set was refused at, for its size.
 * - .recheck — Read the set again BEHIND the one held, which stays meanwhile.
 * - .hold — Hold the whole set, up to a cap: one shared read, waited for.
 * - .retry — A new page tries a failed whole read once more.
 * - .letGo — A Refresh: the set is due, and read again before it is used.
 * - cacheOf — The one cache for a store.
 */
import { HeldSet } from './held-set.js';
import { report } from './report.js';
import { failureOf, unreached, type Failure } from './failure.js';
import type { Store, StoreChangeDetail } from './store.js';

/** A store change, as the cache passes it on: did the set take it in place? */
export interface CacheChangeDetail {
  taken: boolean;
}

/** A remote store's whole set, held once for every source over it. Fires
 *  `change` (CacheChangeDetail) on each store change, and `set` when a set lands. */
export class StoreCache extends EventTarget {
  /** The store it holds. */
  readonly store: Store;
  /** The whole set, while held. */
  #set: HeldSet | null = null;
  /** Whole reads landed. */
  #gen = 0;
  /** Out of date: read again before it is used. */
  #due = false;
  /** The cap the last whole read FAILED at, or 0: a smaller cap may still try. */
  #failedAt = 0;
  /** Why it failed, while it stands. */
  #failure: Failure | null = null;
  /** The largest cap any page has asked for: the shared read is sent at it. */
  #widest = 0;
  /** Why it can never be held — the store's own facts — or ''. */
  #never = '';
  /** The largest cap a set was refused at, for its size. */
  #over = 0;
  /** The whole read in flight, shared. */
  #reading: Promise<void> | null = null;
  /** Moves with each change, so a read begun before it lands on nothing. */
  #age = 0;
  /** Why it is not held has been said: once per store. */
  #said = false;

  constructor(store: Store) {
    super();
    this.store = store;
    // For good: a change made while no page is open is taken too.
    store.addEventListener('change', this.#onChange);
  }

  /** The held set, or null. */
  get set(): HeldSet | null {
    return this.#set;
  }

  /** How many whole reads have landed. */
  get gen(): number {
    return this.#gen;
  }

  /** The set is out of date: a change it could not take, or a Refresh. */
  get due(): boolean {
    return this.#due;
  }

  /** The last whole read failed: questions ask the store until a change, a Refresh or a new page. */
  get failed(): boolean {
    return this.#failedAt > 0;
  }

  /** The cap the last whole read failed at, or 0. */
  get failedAt(): number {
    return this.#failedAt;
  }

  /** Why the last whole read failed, while it stands — its kind and message. TRAP T-a-failed-read-keeps-the-last-set */
  get failure(): Failure | null {
    return this.#failedAt ? this.#failure : null;
  }

  /** The store's own facts forbid holding it. */
  get never(): boolean {
    return !!this.#never;
  }

  /** The largest cap a set was refused at, for its size. */
  get over(): number {
    return this.#over;
  }

  /** Read the set again BEHIND the one held: it stays, and answers, until the
   *  read lands — then `set` fires. A read in flight serves. TRAP T-a-read-is-planned */
  recheck(cap: number): void {
    this.#widest = Math.max(this.#widest, cap);
    if (this.#reading) return;
    const reading = this.#readWhole(this.#failedAt ? cap : this.#widest);
    this.#reading = reading;
    void reading.finally(() => {
      if (this.#reading === reading) this.#reading = null;
    });
  }

  /** Hold the whole set, up to `cap` rows: one read, shared by every source that
   *  asks — sent at the largest cap asked — and one more if the rows changed
   *  while it was out. Never rejects. */
  async hold(cap: number): Promise<void> {
    this.#widest = Math.max(this.#widest, cap);
    while (this.#wants(cap)) {
      if (!this.#reading) {
        /* Cleared by WHO it is, after it is kept: a load that throws at once
           settles before `#reading` is set, and a cleared-first promise would
           be awaited for ever. */
        // After a failure, a smaller cap tries at its own: a server may refuse only the big take.
        const reading = this.#readWhole(this.#failedAt ? cap : this.#widest);
        this.#reading = reading;
        void reading.finally(() => {
          if (this.#reading === reading) this.#reading = null;
        });
      }
      await this.#reading;
    }
  }

  /** A new page tries a failed whole read once more, as each page did before
   *  the set was the store's. No read is in flight while it has failed. */
  retry(): void {
    this.#failedAt = 0;
    this.#failure = null;
  }

  /** A Refresh: the set is due, read again before it is used — and a refusal
   *  for its size or its reply is tried again. A read in flight lands on
   *  nothing, and `hold` reads once more. */
  letGo(): void {
    this.#due = true;
    this.#failedAt = 0;
    this.#failure = null;
    this.#over = 0;
    this.#never = '';
    this.#age++;
  }

  /** Is a whole read wanted, at this cap? The store's own facts first, so one
   *  that never can be held is never sent it. */
  #wants(cap: number): boolean {
    if (cap <= 0 || this.#never || cap <= this.#over || (this.#failedAt && cap >= this.#failedAt)) return false;
    // Held, or held but too many for this cap: that page asks the store.
    if (this.#set && (!this.#due || this.#set.size > cap)) return false;
    const why = !this.store.reportsTotal ? 'its load reports only the rows it sent as the total (a RestStore needs a totalPath)'
      : this.store.sampled ? 'its schema checks only a sample of each read' : '';
    if (why) this.#refuse(why, cap);
    return !why;
  }

  /** The whole read: held, refused, or — failed — left to the store until a change or a Refresh. */
  async #readWhole(cap: number): Promise<void> {
    const age = this.#age;
    try {
      const { rows, total, totalUnknown, dropped, issues } = await this.store.load({ take: cap + 1 });
      if (age !== this.#age) return;
      const counted = { rows: rows.length, total };
      if (totalUnknown) return this.#refuse('its totalPath read no number, so its total is only the rows it sent', cap, counted);
      if (total > cap || rows.length > cap) {
        // Too many for THIS cap: a page with a larger one may still hold it.
        this.#over = Math.max(this.#over, cap);
        return this.#say(`it holds ${total} rows, more than ${cap} (holdRows)`, cap, counted);
      }
      if (total !== rows.length) {
        return this.#refuse(`it sent ${rows.length} of its ${total} rows — does the server cap a response, or ignore take?`, cap, counted);
      }
      this.#set = new HeldSet(rows, { ...(dropped ? { dropped } : {}), ...(issues ? { issues } : {}) });
      this.#due = false;
      // Reached again: the failure is over.
      this.#failedAt = 0;
      this.#failure = null;
      this.#gen++;
      this.dispatchEvent(new Event('set'));
    } catch (error) {
      if (age !== this.#age) return;
      this.#failed(error, cap);
    }
  }

  /** A whole read failed. Not REACHED, the last set stands — shown, unconfirmed.
   *  REFUSED, it goes: nothing held is shown to someone no longer allowed to see
   *  it. A reply it could not read drops it too. Each question then asks the
   *  store, as before. TRAP T-a-failed-read-keeps-the-last-set */
  #failed(error: unknown, cap: number): void {
    const failure = failureOf(error);
    const was = this.#failure;
    this.#failedAt = cap;
    this.#failure = failure;
    if (!unreached(failure)) this.#set = null;
    else if (this.#set && (!was || !unreached(was))) {
      // Said once per flip, with the store's own words.
      report({
        code: 'store-unreached',
        message: `The store could not be reached (${failure.kind}: ${failure.message}), so the last rows it gave are shown, unconfirmed.`,
        at: { kind: failure.kind, ...(failure.status ? { status: failure.status } : {}) },
      });
    }
    if (!this.#set) this.#say(`the whole read failed (${failure.message})`, cap);
    // The set stands, or went: a page asks again, and says which.
    this.dispatchEvent(new Event('set'));
  }

  /** A store change: a keyed one is taken into the set, ONCE for every page;
   *  anything else makes the set due — and a failed read is tried again.
   *  TRAP T-a-held-set-takes-a-change-in-place */
  #onChange = (event: Event): void => {
    const change = (event as CustomEvent<StoreChangeDetail | undefined>).detail;
    // While the store cannot be reached, the last set still takes a change it can place.
    const taken = !!this.#set && (!this.#due || this.#failedAt > 0) && !!change && this.#set.patch(change, this.store);
    if (!taken) {
      this.#due = true;
      // A change the store announced: it answers again, so a failed read is tried again.
      this.#failedAt = 0;
      this.#failure = null;
      this.#age++;
    }
    this.dispatchEvent(new CustomEvent<CacheChangeDetail>('change', { detail: { taken } }));
  };

  /** It can never be held: say why, once. */
  #refuse(why: string, cap: number, at: Record<string, number> = {}): void {
    this.#never = why;
    this.#say(why, cap, at);
  }

  /** Why the whole set is not held — once per store. */
  #say(why: string, cap: number, at: Record<string, number> = {}): void {
    if (this.#said) return;
    this.#said = true;
    report({
      code: 'held-set-refused',
      message: `This remote store's whole set is not held, so every question asks the store: ${why}.`,
      at: { ...at, holdRows: cap },
    });
  }
}

const caches = new WeakMap<Store, StoreCache>();

/** The one cache for a store: every source over the same store object shares it. */
export function cacheOf(store: Store): StoreCache {
  let cache = caches.get(store);
  if (!cache) caches.set(store, (cache = new StoreCache(store)));
  return cache;
}
