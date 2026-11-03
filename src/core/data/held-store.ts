/**
 * held-store.ts — a store that holds its remote source's whole set itself and
 * answers every reader from it. A remote store is ALWAYS read through one: ONE for
 * every tab in a Service Worker, or one a page's source makes for itself (`heldOf`,
 * the one rule). A reader over it holds none (D8). Newer rows its source gives wait
 * until taken (S6c); a write it cannot send, offline, waits in its outbox (S7a).
 * DOM-free. Plan 652 S5b · TRAP T-a-remote-store-is-read-through-a-held-store
 * TRAP T-a-worker-holds-the-set · TRAP T-a-server-change-waits · TRAP T-a-write-made-offline-waits
 *
 * Map:
 * - LostWrite — A write made offline that did not land: a newer write won, or its source refused it.
 * - HeldStoreOptions — Its cap, its readers' fields, whether newer rows wait, and where writes wait offline.
 * - heldOf — A remote store's HeldStore, made for one reader: the one rule. None where none is needed.
 * - HeldStore — A store that holds its source's whole set and answers every reader from it.
 */
import { failureOf, unreached, type Failure, type FailureKind } from './failure.js';
import { HeldReads } from './held-reads.js';
import { HeldSet } from './held-set.js';
import { outboxEntry, type OutboxEntry, type OutboxPort } from './outbox.js';
import type { Plan } from './read-plan.js';
import { report } from './report.js';
import { carryKey, keyRow } from './row-key.js';
import type { CacheChangeDetail } from './store-cache.js';
import type { StoreHistory } from './store-history.js';
import {
  distinctOf, matchesOnly, projectRow, readField, sameKey,
  type LoadOptions, type LoadResult, type Row, type Store, type StoreCapabilities, type StoreChangeDetail, type StoreChanges, type WriteOptions,
} from './store.js';
import { startSpan, within, type TraceContext } from './trace.js';

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

/** Its cap, its readers' fields, whether newer rows wait, and where writes wait offline. */
export interface HeldStoreOptions {
  /** Default 100,000, a source's own; 0 holds none. */
  cap?: number;
  /** The fields its readers read from a row, or null — every field. Default: the
   *  fields its readers last asked for. TRAP T-a-held-set-reads-the-pages-fields */
  need?: () => readonly string[] | null;
  /** Newer rows its source gives behind WAIT until taken, so no page moves under its
   *  reader — `false` takes them at once, and says so: a live board, or a page's
   *  own. Default true. S6c */
  waits?: boolean;
  /** Where a write it cannot send, as its source is offline, waits — shown at once,
   *  and sent in order, once, when it is reached. None: the write fails, as before. S7a */
  outbox?: OutboxPort;
}

/** A remote store's HeldStore, made for one reader: the ONE rule that a remote store
 *  is read through a held set. None for a local store, one that holds its own — a
 *  worker's, over requests — or a reader that holds no rows. TRAP T-a-remote-store-is-read-through-a-held-store */
export function heldOf(store: Store, options: HeldStoreOptions = {}): HeldStore | null {
  const { remote, holds } = store.capabilities;
  return remote && !holds && (options.cap ?? 100_000) > 0 ? new HeldStore(store, options) : null;
}

/** A store that holds its source's whole set and answers every reader from it. */
export class HeldStore extends EventTarget implements Store {
  /** What its source can do — and it holds. TRAP T-a-store-says-what-it-can-do-once */
  readonly capabilities: StoreCapabilities;
  /** What moved since a mark: its source's, where it says. */
  readonly changes?: (since?: unknown) => Promise<StoreChanges>;
  /** Its remote source. */
  readonly #source: Store;
  /** Where each read goes: the one held set, or the source. */
  readonly #reads: HeldReads;
  /** Where it hears its rows change: its set, or — holding none — its source. */
  readonly #hears: EventTarget;
  /** The fields its readers last asked for, or null — every field: the set holds
   *  those, as a page's own did, so a copy kept with them serves. */
  #asked: readonly string[] | null = null;
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
    this.capabilities = { ...source.capabilities, holds: true };
    this.#reads = new HeldReads(source, { cap: options.cap ?? 100_000, need: options.need ?? ((): readonly string[] | null => this.#asked) });
    this.#waits = options.waits ?? true;
    this.#outbox = options.outbox ?? null;
    this.#read = this.#outbox
      ? this.#outbox.read().then((entries) => { this.#pending = entries; this.#relay(); }, () => undefined)
      : Promise.resolve();
    if (source.changes) this.changes = (since) => source.changes!(since);
    this.#hears = this.#reads.cache ?? source;
    this.#hears.addEventListener('change', this.#pass);
    this.#reads.cache?.addEventListener('set', this.#onSet);
  }

  /** A change its set takes — or its source says — is its readers' to hear: as said
   *  where its set took it and it can vouch for the set; else as if every row moved. */
  #pass = (event: Event): void => {
    const said = (event as CustomEvent<CacheChangeDetail | StoreChangeDetail | undefined>).detail ?? undefined;
    const held = !!this.#reads.cache;
    const change = held ? (said as CacheChangeDetail | undefined)?.change : (said as StoreChangeDetail | undefined);
    const taken = !held || !!(said as CacheChangeDetail | undefined)?.taken;
    // A write it heard shows at once, in what its readers see too.
    if (change && this.#shown && !this.#shown.patch(change, this.#source)) this.#owed = true;
    if (!taken) this.#owed = true;
    const sure = taken && this.#reads.planNow().plan !== 'held-stale';
    this.dispatchEvent(new CustomEvent('change', { detail: sure ? change : undefined }));
  };

  /** A set landed — or was joined in place. Where none waits, its readers hear it,
   *  if it answers them: a set too big for its cap, or none they used, moves nothing. */
  #onSet = (): void => {
    this.#relay();
    this.#landed();
    if (this.#waits) return;
    const set = this.#reads.cache?.set;
    const plan = this.#reads.plan;
    if (set ? set.size > this.#reads.cap : plan !== 'held' && plan !== 'held-stale') return;
    this.dispatchEvent(new CustomEvent('change', { detail: undefined }));
  };

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
  get domains(): NonNullable<Store['domains']> {
    return this.#source.domains ?? {};
  }
  /** Its source's History: what changed, by field. */
  get history(): StoreHistory | undefined {
    return this.#source.history;
  }

  /** Why its rows are unconfirmed — its source could not be reached, and the last
   *  set answers — else null. */
  get stale(): Failure | null {
    const failure = this.#reads.cache?.failure;
    return failure && unreached(failure) && this.#reads.plan === 'held-stale' ? failure : null;
  }

  /** Its last answer came from a set it cannot vouch for — kept from before, or its
   *  source unreached — and nothing has confirmed it since. TRAP T-a-read-is-planned */
  get unconfirmed(): boolean {
    return this.#reads.plan === 'held-stale' && this.#reads.planNow().plan === 'held-stale';
  }

  /** How its last question was answered. */
  get plan(): Plan {
    return this.#reads.plan;
  }

  /** Does the set it holds lack any of these fields (null — every field)? TRAP T-a-held-set-reads-the-pages-fields */
  lacks(fields: readonly string[] | null): boolean {
    const set = this.#reads.closed ? null : this.#reads.cache?.set;
    return !!set && !set.covers(fields);
  }

  /** How it answers, and its set, for a bug report: none where it holds no rows. */
  debugState(): { plan: Plan; held?: { rows: number | null; gen: number; due: boolean; failure: Failure | null } } {
    const cache = this.#reads.cache;
    return { plan: this.#reads.plan, ...(cache ? { held: { rows: cache.set?.size ?? null, gen: cache.gen, due: cache.due, failure: cache.failure } } : {}) };
  }

  /** Hold its source's whole set, where it can be — after the writes kept last time are read. */
  async hold(trace?: TraceContext): Promise<void> {
    const span = startSpan('hold', trace ? { parent: trace } : {});
    await this.#read;
    await this.#reads.hold(span ?? trace);
    span?.end({ plan: this.#reads.plan, rows: this.#reads.cache?.set?.size ?? 0 });
  }

  async load(options?: LoadOptions): Promise<LoadResult> {
    if (options?.fields) this.#asked = options.fields;
    await this.hold(options?.trace);
    const answers = this.#answers;
    const result = await answers.load(options);
    /* Its set holds whole rows: a read that names its fields gets those, and the key —
       a tally of one field at 100k rows moved 9.5 MB to the page. Plan 652 S9 */
    const fields = options?.fields;
    return fields && answers !== this.#source ? { ...result, rows: result.rows.map((row) => carryKey(row, projectRow(row, this.key, fields))) } : result;
  }

  async totalCount(options?: LoadOptions): Promise<number> {
    await this.hold();
    return this.#answers.totalCount(options);
  }

  /** Its rows in place, while its set answers: never its source's, which is remote. */
  get scan(): (() => Promise<readonly Row[]>) | undefined {
    const answers = this.#answers;
    return answers === this.#source ? undefined : answers.scan?.bind(answers);
  }

  /** Each field's values among the matches, its set held first — a host asks with no
   *  load before: its set's, while it answers; else its source's, or read from its rows. */
  async distinct(fields: readonly string[], options?: LoadOptions): Promise<Record<string, unknown[]>> {
    await this.hold();
    const answers = this.#answers;
    return answers.distinct ? answers.distinct(fields, options) : distinctOf((await answers.load(matchesOnly(options))).rows, fields);
  }

  /** What answers its readers: its copy of the rows they see, while the plan reads
   *  the set; else as planned. */
  get #answers(): Pick<Store, 'load' | 'totalCount' | 'distinct' | 'scan'> {
    const reads = this.#reads.reads;
    return reads !== this.#source && this.#shown ? this.#shown : reads;
  }

  /** A Refresh: its set is read again before it is used. */
  letGo(): void {
    this.#reads.cache?.letGo();
  }

  /** Close it: it hears nothing more, and asks its source, never the shared set —
   *  its reader has gone. TRAP T-a-closed-source-hears-nothing */
  close(): void {
    this.#reads.closed = true;
    this.#hears.removeEventListener('change', this.#pass);
    this.#reads.cache?.removeEventListener('set', this.#onSet);
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
  /* A write's time goes on to the source; offline, it waits with it. D3 */
  async update(key: unknown, values: Row, options?: WriteOptions): Promise<Row> {
    try {
      return await this.#source.update(key, values, options);
    } catch (error) {
      await this.#wait(error, { type: 'update', key, values, ...timeOf(options) });
      return { ...this.#held(key), ...values };
    }
  }
  async remove(key: unknown, options?: WriteOptions): Promise<void> {
    try {
      await this.#source.remove(key, options);
    } catch (error) {
      await this.#wait(error, { type: 'remove', key, ...timeOf(options) });
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
    // Traced only where writes wait: every check behind sends first.
    const span = this.#pending.length ? startSpan('send', { detail: { waiting: this.#pending.length } }) : null;
    await this.#read;
    if (!this.#pending.length) {
      span?.end({ left: 0 });
      return true;
    }
    const sent = await outbox.alone(async () => {
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
        void this.#reads.recheck();
      }
      return !this.#pending.length;
    });
    span?.end({ left: this.#pending.length });
    return sent;
  }

  /** Read its source again behind the set it answers — the writes that wait sent
   *  first; settles as that read ends: landed, failed, or overtaken by a change,
   *  which leaves the set due. Holding none, nothing is behind: its next read reads
   *  it. ONE check at a time: an ask before its read is sent joins it; an ask after
   *  waits for one more, which every later ask joins — what it heard may be newer
   *  than the read out. */
  recheck(): Promise<void> {
    if (!this.#rechecking) {
      const check = this.#recheck().finally(() => {
        this.#rechecking = null;
        this.#reading = false;
      });
      return (this.#rechecking = check);
    }
    if (!this.#reading) return this.#rechecking;
    return (this.#again ??= this.#rechecking.then(() => {
      this.#again = null;
      return this.recheck();
    }));
  }

  /** The check in flight. */
  #rechecking: Promise<void> | null = null;
  /** The one check after it, which every ask while its read is out joins. */
  #again: Promise<void> | null = null;
  /** The check in flight has sent its read. */
  #reading = false;

  /** One check behind: the writes that wait, then the set. */
  async #recheck(): Promise<void> {
    const span = startSpan('recheck');
    await within(span, () => this.send()).catch(() => false);
    const cache = this.#reads.closed ? null : this.#reads.cache;
    this.#reading = true;
    // The read's own end, never its `set`: a change during the read lands it on nothing.
    if (cache?.set) await this.#reads.recheck();
    span?.end({ rows: cache?.set?.size ?? 0 });
  }

  /** Forget all it holds — its set, the rows shown, the writes that wait — and
   *  have its readers ask again: a sign-out. Whether its next set is kept is its
   *  keep's. TRAP T-a-kept-set-is-checked-each-session */
  async forget(): Promise<void> {
    await this.#read;
    this.#pending = [];
    this.#shown = null;
    this.#waiting = this.#owed = false;
    this.#reads.cache?.drop({ forget: true });
    const outbox = this.#outbox;
    if (outbox) {
      await outbox.alone(async () => {
        for (const entry of await outbox.read()) await outbox.remove(entry.id);
      });
    }
    this.dispatchEvent(new CustomEvent('change', { detail: { type: 'update' } }));
  }
}

/** A write's own time, kept with it where it waits. */
function timeOf(options?: WriteOptions): { since?: number } {
  return options?.unmodifiedSince !== undefined ? { since: options.unmodifiedSince } : {};
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
