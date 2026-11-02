/**
 * held-store.ts — a store that holds its remote source's whole set itself and
 * answers every reader from it: ONE copy for every tab, in a Service Worker. A
 * reader over it holds none, and stays remote (D8). DOM-free. Plan 652 S5b
 * TRAP T-a-worker-holds-the-set
 *
 * Map:
 * - HeldStoreOptions — The most rows it holds.
 * - HeldStore — A store that holds its source's whole set and answers every reader from it.
 */
import { unreached, type Failure } from './failure.js';
import { HeldReads } from './held-reads.js';
import type { LoadOptions, LoadResult, Row, Store, StoreChanges } from './store.js';

/** The most rows it holds. */
export interface HeldStoreOptions {
  /** Default 100,000, a source's own. */
  cap?: number;
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

  constructor(source: Store, options: HeldStoreOptions = {}) {
    super();
    this.#source = source;
    this.#reads = new HeldReads(source, { cap: options.cap ?? 100_000, need: () => this.#need });
    if (source.changes) this.changes = (since) => source.changes!(since);
    // A change its set takes — or its source says — is its readers' to hear.
    const pass = (event: Event): void => {
      // The set says its change inside its own word for it.
      const said = (event as CustomEvent<{ change?: unknown } | undefined>).detail;
      this.dispatchEvent(new CustomEvent('change', { detail: said && 'change' in said ? said.change : said }));
    };
    (this.#reads.cache ?? source).addEventListener('change', pass);
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
    return this.#reads.reads.load(options);
  }

  async totalCount(options?: LoadOptions): Promise<number> {
    await this.#reads.hold();
    return this.#reads.reads.totalCount(options);
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
