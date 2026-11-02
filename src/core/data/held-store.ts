/**
 * held-store.ts — a store that holds its remote source's whole set itself and
 * answers every reader from it: ONE copy for every tab, in a Service Worker. A
 * reader over it holds none, and stays remote (D8). Newer rows its source gives
 * wait until taken (S6c); a write it cannot send, offline, waits in its outbox
 * (S7a). DOM-free. Plan 652 S5b
 * TRAP T-a-worker-holds-the-set · TRAP T-a-server-change-waits · TRAP T-a-write-made-offline-waits
 *
 * Map:
 * - LostWrite — A write made offline that did not land: a newer write won, or its source refused it.
 * - HeldStoreOptions — The most rows it holds, whether its source's changes wait, and where its writes wait offline.
 * - HeldStore — A store that holds its source's whole set and answers every reader from it.
 */
import { failureOf, unreached, type Failure, type FailureKind } from './failure.js';
import { HeldReads } from './held-reads.js';
import { HeldSet } from './held-set.js';
import { outboxEntry, type OutboxEntry, type OutboxPort } from './outbox.js';
import { report } from './report.js';
import { carryKey, keyRow } from './row-key.js';
import { projectRow, readField, sameKey, type LoadOptions, type LoadResult, type Row, type Store, type StoreChangeDetail, type StoreChanges } from './store.js';

/** A write made offline that did not land: a newer write won (`conflict`, D3), or
 *  its source refused it. Said as `lost`. Plan 652 S7b */
export interface LostWrite {
  /** Its outbox entry's id. */
  id: string;
  type: OutboxEntry['type'];
  key: unknown;
  /** When it was made, in ms. */
  at: number;
  why: FailureKind;
}

/** The most rows it holds, whether its source's changes wait, and where its writes wait offline. */
export interface HeldStoreOptions {
  /** Default 100,000, a source's own. */
  cap?: number;
  /** Newer rows its source gives behind WAIT until taken, so no page moves under its
   *  reader — `false` takes them at once: a live board. Default true. S6c */
  waits?: boolean;
  /** Where a write it cannot send, as its source is offline, waits — shown at once,
   *  and sent in order, once, when it is reached. None: the write fails, as before. S7a */
  outbox?: OutboxPort;
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
  /** Where its writes wait offline, or null. */
  readonly #outbox: OutboxPort | null;
  /** The writes that wait, in order: laid over every set until sent. */
  #pending: OutboxEntry[] = [];
  /** Settles once the writes kept last time are read. */
  readonly #read: Promise<void>;

  constructor(source: Store, options: HeldStoreOptions = {}) {
    super();
    this.#source = source;
    this.#reads = new HeldReads(source, { cap: options.cap ?? 100_000, need: () => this.#need });
    this.#waits = options.waits ?? true;
    this.#outbox = options.outbox ?? null;
    this.#read = this.#outbox
      ? this.#outbox.read().then((entries) => { this.#pending = entries; this.#relay(); }, () => undefined)
      : Promise.resolve();
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
    this.#reads.cache?.addEventListener('set', () => {
      this.#relay();
      this.#landed();
    });
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
    await this.#read;
    await this.#reads.hold();
    const result = await this.#answers.load(options);
    /* Its set holds whole rows: a read that names its fields gets those, and the key —
       a tally of one field at 100k rows moved 9.5 MB to the page. Plan 652 S9 */
    const fields = options?.fields;
    return fields ? { ...result, rows: result.rows.map((row) => carryKey(row, projectRow(row, this.key, fields))) } : result;
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
  /* A write goes to the source; the set takes it as it hears it. Offline, it waits. */
  async insert(values: Row): Promise<Row> {
    try {
      return await this.#source.insert(values);
    } catch (error) {
      await this.#wait(error, { type: 'insert', key: readField(values, this.key), values });
      return values;
    }
  }
  async update(key: unknown, values: Row): Promise<Row> {
    try {
      return await this.#source.update(key, values);
    } catch (error) {
      await this.#wait(error, { type: 'update', key, values });
      return { ...this.#held(key), ...values };
    }
  }
  async remove(key: unknown): Promise<void> {
    try {
      await this.#source.remove(key);
    } catch (error) {
      await this.#wait(error, { type: 'remove', key });
    }
  }

  /** How many writes wait to be sent. */
  get pending(): number {
    return this.#pending.length;
  }

  /** A write that never left — its source offline — waits in the outbox, and shows
   *  at once; any other failure is the writer's, as before. A timeout may have
   *  landed, so it is never sent twice. */
  async #wait(error: unknown, write: Omit<OutboxEntry, 'id' | 'at'>): Promise<void> {
    if (!this.#outbox || failureOf(error).kind !== 'offline' || write.key == null) throw error;
    await this.#read;
    const entry = outboxEntry(write);
    await this.#outbox.add(entry);
    this.#pending.push(entry);
    const change = this.#lay(entry);
    if (change) this.dispatchEvent(new CustomEvent('change', { detail: change }));
    this.dispatchEvent(new CustomEvent('queued', { detail: { pending: this.#pending.length } }));
  }

  /** The row its set holds for a key, or none. */
  #held(key: unknown): Row | undefined {
    return this.#reads.cache?.set?.rows.find((row) => sameKey(readField(row, this.key), key));
  }

  /** Lay a waiting write over the set and the rows shown: the change it makes, or null. */
  #lay(entry: OutboxEntry): StoreChangeDetail | null {
    const { type, key, values } = entry;
    const row = type === 'remove' ? undefined : { ...(type === 'update' ? this.#held(key) : undefined), ...values };
    if (type === 'update' && !this.#held(key)) return null;
    const change: StoreChangeDetail = { type, key, ...(row ? { row } : {}), ...(type === 'update' && values ? { fields: Object.keys(values) } : {}) };
    this.#reads.cache?.set?.patch(change, this.#source);
    this.#shown?.patch(change, this.#source);
    return change;
  }

  /** Every write that waits, laid again over a set that landed. */
  #relay(): void {
    for (const entry of this.#pending) this.#lay(entry);
  }

  /** Send the writes that wait, in order, once, with no other sender at once: true
   *  when none waits now. One its source refuses is dropped, and said (`lost`). */
  async send(): Promise<boolean> {
    const outbox = this.#outbox;
    if (!outbox) return true;
    await this.#read;
    if (!this.#pending.length) return true;
    return outbox.alone(async () => {
      // Read again: another sender may have sent some.
      let lost = false;
      const waiting = await outbox.read();
      for (const [i, entry] of waiting.entries()) {
        try {
          // Sent with its own time: a row changed after it keeps the newer write. D3
          const since = { unmodifiedSince: entry.since ?? entry.at };
          if (entry.type === 'insert') await this.#source.insert(entry.values ?? {});
          else if (entry.type === 'update') await this.#source.update(entry.key, entry.values ?? {}, since);
          else await this.#source.remove(entry.key, since);
          // Ours now: a later write to this row is measured from here — kept, as a send may stop.
          const landed = Date.now();
          for (const next of waiting.slice(i + 1)) {
            if (!sameKey(next.key, entry.key)) continue;
            next.since = landed;
            await outbox.add(next);
          }
        } catch (error) {
          const failure = failureOf(error);
          if (unreached(failure)) {
            this.#pending = await outbox.read();
            return false;
          }
          lost = true;
          report({
            code: failure.kind === 'conflict' ? 'outbox-write-lost-to-a-newer' : 'outbox-write-lost',
            message: `A write made offline (${entry.type} ${String(entry.key)}) was refused when sent (${failure.kind}: ${failure.message}), so it was dropped.`,
            at: { type: entry.type, key: String(entry.key), kind: failure.kind },
          });
          this.dispatchEvent(new CustomEvent<LostWrite>('lost', { detail: { id: entry.id, type: entry.type, key: entry.key, at: entry.at, why: failure.kind } }));
        }
        await outbox.remove(entry.id);
      }
      // A write made meanwhile waits for the next send.
      this.#pending = await outbox.read();
      /* A dropped write was laid over the set: it is read again, and shown at once,
         so no row shows a write that never landed. */
      if (lost) {
        this.#owed = true;
        this.#reads.cache?.addEventListener('set', () => this.dispatchEvent(new CustomEvent('change', { detail: { type: 'update' } })), { once: true });
        this.#reads.recheck();
      }
      return !this.#pending.length;
    });
  }

  /** Read its source again behind the set it answers — the writes that wait sent
   *  first; settles when that read lands or fails — either way the set says so. */
  async recheck(): Promise<void> {
    await this.send().catch(() => false);
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
