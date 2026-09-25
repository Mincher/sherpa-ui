/**
 * session.ts — the app-level state store: one value, many readers.
 *
 * Third tier: a Store holds records, a DataSource one query over them, this
 * everything else an app knows about itself. Pointer-addressed, so a
 * subscriber can watch a BRANCH.
 *
 * TRAP T-session-store-is-the-third-tier
 *
 * Map:
 * - PersistOptions — Where a persisted pointer is kept.
 * - SessionStore — What an app knows about itself, addressed by pointer.
 * - .get — the value at a pointer
 * - .set — write a pointer; every overlapping subscriber hears it
 * - .subscribe — watch a pointer, and anything beneath it; returns the undo
 * - .snapshot — the whole store as plain data
 * - .persist — Remember this pointer across reloads.
 * - .list — A LIST at this pointer, with identity and a cap.
 * - .forget — Stop persisting a pointer, and forget what was stored.
 * - ListOptions — How a list decides identity, order and length.
 * - SessionList — A list living at one SessionStore pointer: add, remove, has, toggle.
 * - .all — The entries, newest-first when `front`.
 * - .length — how many entries the list holds
 * - .has — Is an entry with this identity present?
 * - .add — Add it, or MOVE it to the newest end if it is already there.
 * - .remove — drop the entry with this identity
 * - .toggle — Add when absent, remove when present.
 * - .clear — drop every entry
 * - .subscribe — Watch the list.
 */
import { getPointer, setPointer, pointersOverlap } from '../data/pointer.js';
import { readJson, readText, removeKey, writeJson } from './web-storage.js';

const PREFIX = 'sherpa:session:';

/** readJson's fallback. A private sentinel, so a stored `null` is a real value. */
const MISSING = Symbol('missing');

/** Where a persisted pointer is kept. */
export interface PersistOptions<T = unknown> {
  /** Share across TABS. Default TRUE — TRAP T-session-persist-defaults-shared. */
  shared?: boolean;
  /** The storage key. Defaults to `sherpa:session:<pointer>`. */
  key?: string;
  /**
   * The shape check a stored value must pass. Without one ANY parsed value is
   * restored — fine for a scalar, wrong for a list this version has re-shaped.
   * TRAP T-session-persist-defaults-shared
   */
  guard?: (value: unknown) => value is T;
}

/** What an app knows about itself, addressed by pointer.
 *  TRAP T-session-store-is-the-third-tier */
export class SessionStore {
  /** The whole state, as plain data. */
  #data: Record<string, unknown>;
  /** Every subscriber, and the pointer it watches. */
  #subs = new Set<{ pointer: string; run: (value: unknown) => void }>();
  /** Pointers whose value is written to storage on every change. */
  #persisted = new Map<string, { key: string; shared: boolean }>();

  constructor(initial: Record<string, unknown> = {}) {
    this.#data = structuredClone(initial);
  }

  get(pointer: string): unknown {
    return getPointer(this.#data, pointer);
  }

  set(pointer: string, value: unknown): void {
    setPointer(this.#data, pointer, value);
    for (const sub of this.#subs) {
      if (pointersOverlap(sub.pointer, pointer)) sub.run(this.get(sub.pointer));
    }
    // Write through for this pointer or any ANCESTOR: a branch write must not
    // lose what a leaf write keeps. TRAP T-session-store-is-the-third-tier
    for (const [p, where] of this.#persisted) {
      if (pointersOverlap(p, pointer)) this.#write(p, where);
    }
  }

  subscribe(pointer: string, run: (value: unknown) => void): () => void {
    const sub = { pointer, run };
    this.#subs.add(sub);
    return () => this.#subs.delete(sub);
  }

  snapshot(): Record<string, unknown> {
    return structuredClone(this.#data);
  }

  /**
   * Remember this pointer across reloads. RESTORES IMMEDIATELY if a stored
   * value exists, and returns whether it did.
   * TRAP T-session-persist-defaults-shared
   */
  persist<T>(pointer: string, options: PersistOptions<T> = {}): boolean {
    const shared = options.shared ?? true;
    const key = options.key ?? PREFIX + pointer;
    this.#persisted.set(pointer, { key, shared });

    // A stored shape this version cannot read is DROPPED, not half-applied —
    // readJson forgets the key too, so the next write starts clean.
    // TRAP T-session-persist-defaults-shared
    const kind = shared ? 'local' : 'session';
    if (readText(kind, key) == null) return false;
    // MISSING is a private symbol, so a stored `null` is still a real value.
    const guard = options.guard as ((v: unknown) => v is unknown) | undefined;
    const stored = readJson<unknown>(kind, key, MISSING, guard);
    if (stored === MISSING) return false;

    this.set(pointer, stored);
    return true;
  }

  /**
   * A LIST at this pointer, with identity and a cap.
   *
   * Every write goes through `set`, so subscribers and `persist` both fire.
   * TRAP T-session-list-is-a-view-not-a-copy
   */
  list<T>(pointer: string, options: ListOptions<T> = {}): SessionList<T> {
    return new SessionList<T>(this, pointer, options);
  }

  /** Stop persisting a pointer, and forget what was stored. */
  forget(pointer: string): void {
    const where = this.#persisted.get(pointer);
    this.#persisted.delete(pointer);
    if (!where) return;
    removeKey(where.shared ? 'local' : 'session', where.key);
  }

  /** Save one persisted pointer to local or session storage. */
  #write(pointer: string, where: { key: string; shared: boolean }): void {
    const kind = where.shared ? 'local' : 'session';
    const value = this.get(pointer);
    // Neither call can throw — TRAP T-storage-access-throws.
    if (value === undefined) removeKey(kind, where.key);
    else writeJson(kind, where.key, value);
  }
}

/** How a list decides identity, order and length. */
export interface ListOptions<T> {
  /** The field that IDENTIFIES an entry, so a re-add replaces rather than doubles. */
  by?: keyof T & string;
  /** Keep at most this many. The far end is trimmed. */
  max?: number;
  /** Newest FIRST (a Recents rail). Default false — newest last. */
  front?: boolean;
}

/**
 * A list living at one SessionStore pointer: add, remove, has, toggle.
 *
 * Favourites and Recents are the same four operations over a stored array, and
 * hand-written they are the de-dupe, the cap and the write-back an app gets
 * wrong once each. Recents is this with `max` and `front`.
 *
 * TRAP T-session-list-is-a-view-not-a-copy
 */
export class SessionList<T> {
  /** The store the list lives in. */
  readonly #store: SessionStore;
  /** Where in the store the list lives. */
  readonly #pointer: string;
  /** The field that gives an entry its identity, or the entry itself. */
  readonly #by: (keyof T & string) | undefined;
  /** The longest the list may grow, or no cap. */
  readonly #max: number | undefined;
  /** Add at the front — newest first. */
  readonly #front: boolean;

  constructor(store: SessionStore, pointer: string, options: ListOptions<T> = {}) {
    this.#store = store;
    this.#pointer = pointer;
    this.#by = options.by;
    this.#max = options.max;
    this.#front = options.front ?? false;
  }

  /** The entries, newest-first when `front`. A COPY — mutating it changes nothing. */
  get all(): T[] {
    const value = this.#store.get(this.#pointer);
    return Array.isArray(value) ? ([...value] as T[]) : [];
  }

  get length(): number {
    return this.all.length;
  }

  /** Is an entry with this identity present? Without `by`, a deep-equal match. */
  has(entry: T): boolean {
    return this.#indexOf(this.all, entry) !== -1;
  }

  /** Add it, or MOVE it to the newest end if it is already there. */
  add(entry: T): void {
    const next = this.all;
    const at = this.#indexOf(next, entry);
    if (at !== -1) next.splice(at, 1);
    if (this.#front) next.unshift(entry);
    else next.push(entry);
    // Trim from the OLDEST end, whichever end that is.
    if (this.#max !== undefined && next.length > this.#max) {
      if (this.#front) next.length = this.#max;
      else next.splice(0, next.length - this.#max);
    }
    this.#store.set(this.#pointer, next);
  }

  /** Drop it. Silent when absent. */
  remove(entry: T): void {
    const next = this.all;
    const at = this.#indexOf(next, entry);
    if (at === -1) return;
    next.splice(at, 1);
    this.#store.set(this.#pointer, next);
  }

  /** Add when absent, remove when present. Returns whether it is NOW present. */
  toggle(entry: T): boolean {
    if (this.has(entry)) {
      this.remove(entry);
      return false;
    }
    this.add(entry);
    return true;
  }

  /** Empty it. The pointer keeps an array, so a subscriber still gets a list. */
  clear(): void {
    this.#store.set(this.#pointer, []);
  }

  /** Watch the list. Fires on every write, with the entries. */
  subscribe(run: (entries: T[]) => void): () => void {
    return this.#store.subscribe(this.#pointer, () => run(this.all));
  }

  /** By `by` when given, else by deep equality — a stored entry is plain JSON. */
  #indexOf(entries: T[], entry: T): number {
    const by = this.#by;
    if (by !== undefined) {
      const id = (entry as Record<string, unknown>)[by];
      return entries.findIndex((e) => (e as Record<string, unknown>)[by] === id);
    }
    const json = JSON.stringify(entry);
    return entries.findIndex((e) => JSON.stringify(e) === json);
  }
}
