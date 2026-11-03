/**
 * store-cache.ts — ONE held set per remote store, shared by every page over it:
 * one whole read, each store change taken once, and the set kept when a page
 * closes, so a page opened again asks nothing. DOM-free.
 * TRAP T-a-store-has-one-cache · TRAP T-a-remote-source-holds-its-whole-set
 *
 * Map:
 * - CacheChangeDetail — A store change, as the cache passes it on: did the set take it in place?
 * - KeptSet — A set as it is kept beyond the session: its rows, and what the schema refused.
 * - CacheKeep — Where a store's set is kept beyond the session — IndexedDB, in a browser.
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
 * - .tracks — A page that opens again, or a tab shown, asks the store what moved, not for the whole set.
 * - .recheck — Read the set again BEHIND the one held, which stays meanwhile.
 * - .keep — Keep the set beyond the session, and start from the copy kept last time.
 * - .drop — Hold nothing; `forget`, and the kept copy goes too — a sign-out.
 * - .hold — Hold the whole set, up to a cap: one shared read, waited for.
 * - .retry — A new page tries a failed whole read once more.
 * - .letGo — A Refresh: the set is due, and read again before it is used.
 * - cacheOf — The one cache for a store.
 */
import { HeldSet } from './held-set.js';
import { report } from './report.js';
import { failureOf, unreached, type Failure } from './failure.js';
import { readField, type LoadResult, type Row, type Store, type StoreChangeDetail } from './store.js';
import { keyRow } from './row-key.js';
import type { TraceContext } from './trace.js';

/** A store change, as the cache passes it on: did the set take it in place? */
export interface CacheChangeDetail {
  taken: boolean;
  /** The store's own change, as it announced it. */
  change?: StoreChangeDetail;
}

/** A set as it is kept beyond the session: its rows, and what the schema refused. */
export interface KeptSet {
  rows: readonly Row[];
  /** The fields its rows were read with; none — every field. */
  fields?: readonly string[];
  dropped?: LoadResult['dropped'];
  issues?: LoadResult['issues'];
}

/** Where a store's set is kept beyond the session (`keepCache`, IndexedDB in a
 *  browser). The cache reads it once, and asks it to write after a read or a
 *  save; when, and whether, is the port's. TRAP T-a-kept-set-is-checked-each-session */
export interface CacheKeep {
  /** The copy kept last time, or null. */
  read(): Promise<KeptSet | null>;
  /** Write soon: `take` gives the set as it is then, or null — nothing confirmed to write, so the copy stays. */
  write(take: () => KeptSet | null): void;
  /** No copy any more. */
  forget(): Promise<void>;
}

/** How long a page waits for a kept copy before it reads the store. */
const KEPT_WAIT = 1000;

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
  /** Every field a page has asked for, or null — every field. TRAP T-a-held-set-reads-the-pages-fields */
  #columns: Set<string> | null = new Set();
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
  /** Where the set is kept beyond the session, if anywhere. */
  #keep: CacheKeep | null = null;
  /** The kept copy being read, which a first hold waits for — not long. */
  #restoring: Promise<void> | null = null;
  /** A change was heard: a copy that lands after it is out of date. */
  #heard = false;
  /** A refusal or a drop: a kept copy that lands after it is never shown. */
  #noRestore = false;
  /** The store's mark when the set was last read or checked, or undefined. TRAP T-a-remote-store-says-what-changed */
  #at: unknown;

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

  /** A page that opens again, or a tab shown, asks the store what moved, not
   *  for the whole set: it says `changes`, and may miss a writer. */
  get tracks(): boolean {
    return !!this.store.changes && !this.store.capabilities.announcesAll;
  }

  /** Read the set again BEHIND the one held: it stays, and answers, until the
   *  read lands — then `set` fires. A read in flight serves. Settles as the read
   *  ends: landed, failed, or overtaken by a change, which fires no `set`.
   *  TRAP T-a-read-is-planned */
  recheck(cap: number, fields: readonly string[] | null = null): Promise<void> {
    this.#widest = Math.max(this.#widest, cap);
    this.#want(fields);
    if (this.#reading) return this.#reading;
    const asks = this.tracks && this.#at !== undefined && !!this.#set && !this.#due && !this.#failedAt;
    const reading = asks ? this.#readChanges(cap) : this.#readWhole(this.#failedAt ? cap : this.#widest);
    this.#reading = reading;
    void reading.finally(() => {
      if (this.#reading === reading) this.#reading = null;
    });
    return reading;
  }

  /** Keep the set beyond the session (D2 B), and start from the copy kept last
   *  time: shown at once — gen 0, so unconfirmed — and read again behind it.
   *  TRAP T-a-kept-set-is-checked-each-session */
  keep(port: CacheKeep): void {
    this.#keep = port;
    this.#noRestore = false;
    this.#restore(port);
    // Written once a set is confirmed this session.
    if (this.#gen > 0) this.#write();
  }

  /** Show the copy kept last time, where one is and nothing better has landed. */
  #restore(port: CacheKeep): void {
    this.#restoring = port.read().then((kept) => {
      // A set landed first, or a refusal or a sign-out came first: the copy is not shown.
      if (!kept || this.#set || this.#noRestore || this.#keep !== port) return;
      // Its keys are rebuilt: a row's key lives beside it, and a copy drops it.
      const rows = kept.rows.map((row) => {
        const copy = { ...row };
        keyRow(copy, readField(copy, this.store.key));
        return copy;
      });
      this.#set = new HeldSet(rows, { ...(kept.dropped ? { dropped: kept.dropped } : {}), ...(kept.issues ? { issues: kept.issues } : {}) }, kept.fields ?? null);
      // A change heard while it was read: the copy is out of date.
      if (this.#heard) this.#due = true;
      this.dispatchEvent(new Event('set'));
    }, () => undefined).finally(() => {
      this.#restoring = null;
    });
  }

  /** Hold nothing; `forget`, and the kept copy goes too — a sign-out. Nothing kept
   *  is shown again; whether the next set is kept is its port's: a page's closes,
   *  a worker's goes on. TRAP T-a-kept-set-is-checked-each-session */
  drop(options: { forget?: boolean } = {}): void {
    this.#set = null;
    this.#due = false;
    this.#age++;
    this.#noRestore = true;
    if (!options.forget) return;
    void this.#keep?.forget();
    this.#restoring = null;
  }

  /** Ask the keep to write the set as it stands — a confirmed one only. */
  #write(): void {
    this.#keep?.write(() => (this.#set && this.#gen > 0 && !this.#due
      ? { rows: this.#set.rows, ...this.#set.refused, ...(this.#set.fields ? { fields: this.#set.fields } : {}) } : null));
  }

  /** Hold the whole set, up to `cap` rows, with `fields` (null — every field):
   *  one read, shared by every source that asks — sent at the largest cap and
   *  every field asked — one more if the rows changed while it was out, and one
   *  of a column it lacks. Never rejects. */
  async hold(cap: number, fields: readonly string[] | null = null, trace?: TraceContext): Promise<void> {
    this.#widest = Math.max(this.#widest, cap);
    this.#want(fields);
    /* None held, and none read this session: a copy kept since it last looked — by
       another tab, or the worker's page — is looked for once more. A worker lives
       on past the page that kept it. Plan 652 S5 */
    if (!this.#set && this.#gen === 0 && this.#keep && !this.#noRestore && !this.#restoring && !this.#reading) this.#restore(this.#keep);
    // A kept copy on its way is worth a moment: not long.
    if (this.#restoring) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      await Promise.race([this.#restoring, new Promise((r) => { timer = setTimeout(r, KEPT_WAIT); })]);
      clearTimeout(timer);
      // Waited for once: a copy that never comes holds up no later hold.
      this.#restoring = null;
    }
    while (this.#wants(cap) || this.#lacks(cap, fields)) {
      if (!this.#reading) {
        /* Cleared by WHO it is, after it is kept: a load that throws at once
           settles before `#reading` is set, and a cleared-first promise would
           be awaited for ever. */
        // After a failure, a smaller cap tries at its own: a server may refuse only the big take.
        const reading = this.#wants(cap) ? this.#readWhole(this.#failedAt ? cap : this.#widest, trace) : this.#readColumns(cap, fields, trace);
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
    const { reportsTotal, sampled } = this.store.capabilities;
    const why = !reportsTotal ? 'its load reports only the rows it sent as the total (a RestStore needs a totalPath)'
      : sampled ? 'its schema checks only a sample of each read' : '';
    if (why) this.#refuse(why, cap);
    return !why;
  }

  /** A page asks for these fields (null — every field): every read from now on carries them. */
  #want(fields: readonly string[] | null): void {
    if (!fields) this.#columns = null;
    else for (const f of fields) this.#columns?.add(f);
  }

  /** The fields a read asks for, where the store can send just them; else every field. */
  #projection(): readonly string[] | undefined {
    return this.#columns && this.store.capabilities.projects && this.store.key ? [...this.#columns] : undefined;
  }

  /** Held and current, but without a column this page needs. */
  #lacks(cap: number, fields: readonly string[] | null): boolean {
    const set = this.#set;
    return !!set && !this.#due && !this.#failedAt && set.size <= cap && !set.covers(fields);
  }

  /** Read the columns the set lacks, and join them by key. Not the same rows —
   *  a change it never heard — and the set is read again, whole. */
  async #readColumns(cap: number, fields: readonly string[] | null, trace?: TraceContext): Promise<void> {
    const set = this.#set!;
    const missing = fields?.filter((f) => !set.covers([f]));
    if (!missing || !this.#projection()) {
      this.#due = true;
      return;
    }
    const age = this.#age;
    try {
      const { rows, total } = await this.store.load({ take: cap + 1, fields: missing, ...(trace ? { trace } : {}) });
      if (age !== this.#age || set !== this.#set) return;
      if (total !== rows.length || !set.join(rows, missing, this.store.key!)) {
        this.#due = true;
        return;
      }
      this.#write();
    } catch (error) {
      if (age !== this.#age) return;
      this.#failed(error, cap);
    }
  }

  /** Ask the store what moved since the mark: nothing — the set is confirmed;
   *  some fields — those columns are read again, joined by key; a row came or
   *  went, or it cannot tell — the whole set. TRAP T-a-remote-store-says-what-changed */
  async #readChanges(cap: number): Promise<void> {
    const age = this.#age;
    const set = this.#set!;
    try {
      const moved = await this.store.changes!(this.#at);
      if (age !== this.#age || set !== this.#set) return;
      if (moved.rows || moved.fields === 'all' || !moved.fields) return await this.#readWhole(this.#widest);
      const held = set.fields;
      const fields = moved.fields.filter((f) => !held || held.some((h) => h.split('.')[0] === f));
      if (fields.length) {
        const { rows, total } = await this.store.load({ take: cap + 1, fields });
        if (age !== this.#age || set !== this.#set) return;
        if (total !== rows.length || !set.join(rows, fields, this.store.key!)) return await this.#readWhole(this.#widest);
      }
      this.#at = moved.at;
      this.#gen++;
      this.#write();
      this.dispatchEvent(new Event('set'));
    } catch (error) {
      if (age !== this.#age) return;
      this.#failed(error, cap);
    }
  }

  /** The whole read: held, refused, or — failed — left to the store until a change or a Refresh. */
  async #readWhole(cap: number, trace?: TraceContext): Promise<void> {
    const age = this.#age;
    try {
      const fields = this.#projection();
      /* A store that says its total is asked that first, once: a set too big is never
         sent whole, only to be thrown away. TRAP T-a-page-turn-is-a-slice */
      if (!this.#set && this.store.capabilities.totalFirst) {
        const { total, totalUnknown } = await this.store.load({ take: 1, ...(trace ? { trace } : {}) });
        if (age !== this.#age) return;
        if (!totalUnknown && total > cap) {
          this.#over = Math.max(this.#over, cap);
          if (cap >= this.#widest) void this.#keep?.forget();
          return this.#unheld(() => this.#say(`it holds ${total} rows, more than ${cap} (holdRows)`, cap, { rows: 1, total }));
        }
      }
      // The mark, asked as the read is sent: a change after it is asked of next time.
      const marking = this.tracks ? this.store.changes!().then((c) => c.at, () => undefined) : undefined;
      const { rows, total, totalUnknown, dropped, issues } = await this.store.load({ take: cap + 1, ...(fields ? { fields } : {}), ...(trace ? { trace } : {}) });
      const at = await marking;
      if (age !== this.#age) return;
      const counted = { rows: rows.length, total };
      if (totalUnknown) return this.#unheld(() => this.#refuse('its totalPath read no number, so its total is only the rows it sent', cap, counted));
      if (total > cap || rows.length > cap) {
        // Too many for THIS cap: a page with a larger one may still hold it.
        this.#over = Math.max(this.#over, cap);
        if (cap >= this.#widest) void this.#keep?.forget();
        return this.#unheld(() => this.#say(`it holds ${total} rows, more than ${cap} (holdRows)`, cap, counted));
      }
      if (total !== rows.length) {
        return this.#unheld(() => this.#refuse(`it sent ${rows.length} of its ${total} rows — does the server cap a response, or ignore take?`, cap, counted));
      }
      this.#set = new HeldSet(rows, { ...(dropped ? { dropped } : {}), ...(issues ? { issues } : {}) }, fields ?? null);
      this.#at = at;
      this.#due = false;
      // Reached again: the failure is over.
      this.#failedAt = 0;
      this.#failure = null;
      this.#gen++;
      this.#write();
      this.dispatchEvent(new Event('set'));
    } catch (error) {
      if (age !== this.#age) return;
      this.#failed(error, cap);
    }
  }

  /** A read that cannot be held: the set it checked no longer answers — the
   *  store does, for every page — and a copy that lands after is not shown. */
  #unheld(say: () => void): void {
    say();
    this.#noRestore = true;
    if (!this.#set) return;
    this.#set = null;
    this.dispatchEvent(new Event('set'));
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
    if (!unreached(failure)) {
      this.#set = null;
      this.#noRestore = true;
      // Refused: the copy on the device goes too.
      if (failure.kind === 'refused') void this.#keep?.forget();
    }
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
    this.#heard = true;
    // Only a confirmed set is written: an unconfirmed one leaves the last copy as it is.
    if (taken && this.#gen > 0) this.#write();
    if (!taken) {
      this.#due = true;
      // A change the store announced: it answers again, so a failed read is tried again.
      this.#failedAt = 0;
      this.#failure = null;
      this.#age++;
    }
    this.dispatchEvent(new CustomEvent<CacheChangeDetail>('change', { detail: { taken, ...(change ? { change } : {}) } }));
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
