/**
 * held-store.ts — a store that holds its remote source's whole set itself and
 * answers every reader from it: ONE copy for every tab, in a Service Worker. A
 * reader over it holds none, and stays remote (D8). Newer rows its source gives
 * wait until taken (S6c). DOM-free. Plan 652 S5b
 * TRAP T-a-worker-holds-the-set · TRAP T-a-server-change-waits
 *
 * Map:
 * - HeldStoreOptions — The most rows it holds, and whether its source's changes wait.
 * - HeldStore — A store that holds its source's whole set and answers every reader from it.
 */
import { unreached, type Failure } from './failure.js';
import { HeldReads } from './held-reads.js';
import { HeldSet } from './held-set.js';
import { keyRow } from './row-key.js';
import { readField, type LoadOptions, type LoadResult, type Row, type Store, type StoreChangeDetail, type StoreChanges } from './store.js';

/** The most rows it holds, and whether its source's changes wait. */
export interface HeldStoreOptions {
  /** Default 100,000, a source's own. */
  cap?: number;
  /** Newer rows its source gives behind WAIT until taken, so no page moves under its
   *  reader — `false` takes them at once: a live board. Default true. S6c */
  waits?: boolean;
}

/** A store that holds its source's whole set and answers every reader from it. */
export class HeldStore extends EventTarget implements Store {
  /** Its readers hold none: it does. */
  readonly holds = true;
  /** What moved since a mark: its source's, where it says. */
  readonly changes?: (since?: unknown) => Promise<StoreChanges>;
  /** Its remote source. */
  readonly #source: Store;
  /** Where each read goes: the one held set, or the source. */
  readonly #reads: HeldReads;
  /** The fields its readers last asked for, or null — every field: the set holds
   *  those, as a page's own did, so a copy kept with them serves. */
  #need: readonly string[] | null = null;
  /** Its source's newer rows wait to be taken. */
  readonly #waits: boolean;
  /** The rows its readers see — its OWN copy, as a set read behind may be joined in
   *  place. Kept only where its source's changes wait. */
  #shown: HeldSet | null = null;
  /** Newer rows wait behind the ones shown. */
  #waiting = false;
  /** A write its set could not place: the next set shows at once, as the write did. */
  #owed = false;

  constructor(source: Store, options: HeldStoreOptions = {}) {
    super();
    this.#source = source;
    this.#reads = new HeldReads(source, { cap: options.cap ?? 100_000, need: () => this.#need });
    this.#waits = options.waits ?? true;
    if (source.changes) this.changes = (since) => source.changes!(since);
    // A change its set takes — or its source says — is its readers' to hear.
    const pass = (event: Event): void => {
      // The set says its change inside its own word for it.
      const said = (event as CustomEvent<{ change?: StoreChangeDetail } | undefined>).detail;
      const change = said && 'change' in said ? said.change : (said as StoreChangeDetail | undefined);
      // A write it heard shows at once, in what its readers see too.
      if (change && this.#shown && !this.#shown.patch(change, source)) this.#owed = true;
      if (said && 'taken' in said && !said.taken) this.#owed = true;
      this.dispatchEvent(new CustomEvent('change', { detail: change }));
    };
    (this.#reads.cache ?? source).addEventListener('change', pass);
    this.#reads.cache?.addEventListener('set', () => this.#landed());
  }

  /** A set landed — or was joined in place: the first is shown; newer rows that
   *  differ from those shown wait, and each check that finds them says so — a tab
   *  opened since hears it too. */
  #landed(): void {
    const next = this.#reads.cache?.set ?? null;
    if (!next || !this.#waits) return;
    if (!this.#shown || this.#owed) {
      this.#shown = copyOf(next, this.key);
      this.#owed = this.#waiting = false;
      return;
    }
    this.#waiting = !sameRows(this.#shown, next);
    if (this.#waiting) this.dispatchEvent(new CustomEvent('waiting', { detail: { rows: next.size } }));
  }

  /** Take in the newer rows that wait: true if any did. */
  async take(): Promise<boolean> {
    const next = this.#reads.cache?.set;
    if (!this.#waiting || !next) return false;
    this.#shown = copyOf(next, this.key);
    this.#waiting = false;
    this.dispatchEvent(new CustomEvent('change', { detail: { type: 'update' } }));
    return true;
  }

  get key(): string {
    return this.#source.key;
  }
  get time(): string | undefined {
    return this.#source.time;
  }
  get remote(): boolean {
    return !!this.#source.remote;
  }
  /** A load from its set counts every match. */
  get reportsTotal(): boolean {
    return true;
  }
  get projects(): boolean {
    return !!this.#source.projects;
  }
  get announcesAll(): boolean {
    return !!this.#source.announcesAll;
  }
  get domains(): NonNullable<Store['domains']> {
    return this.#source.domains ?? {};
  }

  /** Why its rows are unconfirmed — its source could not be reached, and the last
   *  set answers — else null. */
  get stale(): Failure | null {
    const failure = this.#reads.cache?.failure;
    return failure && unreached(failure) && this.#reads.plan === 'held-stale' ? failure : null;
  }

  async load(options?: LoadOptions): Promise<LoadResult> {
    if (options?.fields) this.#need = options.fields;
    await this.#reads.hold();
    return this.#answers.load(options);
  }

  async totalCount(options?: LoadOptions): Promise<number> {
    await this.#reads.hold();
    return this.#answers.totalCount(options);
  }

  /** What answers its readers: its copy of the rows they see, while the plan reads
   *  the set; else as planned. */
  get #answers(): Pick<Store, 'load' | 'totalCount'> {
    const reads = this.#reads.reads;
    return reads !== this.#source && this.#shown ? this.#shown : reads;
  }

  byKey(key: unknown): Promise<Row | undefined> {
    return this.#source.byKey(key);
  }
  /* A write goes to the source; the set takes it as it hears it. */
  insert(values: Row): Promise<Row> {
    return this.#source.insert(values);
  }
  update(key: unknown, values: Row): Promise<Row> {
    return this.#source.update(key, values);
  }
  remove(key: unknown): Promise<void> {
    return this.#source.remove(key);
  }

  /** Read its source again behind the set it answers; settles when that read lands
   *  or fails — either way the set says so. */
  async recheck(): Promise<void> {
    const cache = this.#reads.cache;
    if (!cache) return;
    const landed = new Promise<void>((done) => cache.addEventListener('set', () => done(), { once: true }));
    this.#reads.recheck();
    await landed;
  }
}

/** Do two sets hold the same rows? Read only when a set lands behind another. */
function sameRows(a: HeldSet, b: HeldSet): boolean {
  return a.size === b.size && JSON.stringify(a.rows) === JSON.stringify(b.rows);
}

/** A set's rows, copied, each keyed: a set joined in place behind it moves nothing. */
function copyOf(set: HeldSet, key: string): HeldSet {
  const rows = set.rows.map((row) => {
    const copy = { ...row };
    keyRow(copy, readField(copy, key));
    return copy;
  });
  return new HeldSet(rows, set.refused, set.fields ? [...set.fields] : null);
}
