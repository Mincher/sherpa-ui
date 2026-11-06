/**
 * source-cache.ts — the rows a graph's Source was FETCHED with, kept for Simulate: one capped load per Source, at the
 * reader's press, held in this tab and, for a remote store, kept in the `sets` of the one Sherpa database, where a View's
 * kept set lives. A Source nothing fetched or held is "not fetched yet". Nothing here fetches on its own. Will, TODO 836
 * · docs/history/plan-836-data-through-nodes.md · TRAP T-a-simulation-reads-the-cache-and-writes-nothing
 *
 * Map:
 * - SOURCE_ROWS — The most rows a fetch keeps: 100,000.
 * - SOURCE_BYTES — The most a fetch keeps, by estimate: 50 MB.
 * - SourceLimit — The cap of a fetch: rows and bytes.
 * - SourceCache — A Source's cached rows, and whether the fetch stopped at the cap.
 * - cachedSource — The rows kept for a store, from this tab, a set a View holds, or the device; none, not fetched yet.
 * - fetchSource — Read a store once, at the cap, and keep the rows: the one fetch a press makes.
 * - forgetSource — Drop a store's cached rows: this tab's and the device's.
 * - sourceWords — A cache in words: its rows, and what the cap kept of what the store held.
 */
import { cacheOf } from '../data/store-cache.js';
import { report } from '../data/report.js';
import type { Row, Store } from '../data/store.js';
import { erase, hasDatabase, readOne, write, type SetRecord } from './database.js';

/** The most rows a fetch keeps: 100,000 (the data layer's plan: what the browser holds). */
export const SOURCE_ROWS = 100_000;
/** The most a fetch keeps, by estimate: 50 MB. */
export const SOURCE_BYTES = 50 * 1024 * 1024;

/** The cap of a fetch: rows and bytes. Left out, the two above. */
export interface SourceLimit {
  rows?: number;
  bytes?: number;
}

/** A Source's cached rows. `partial`: the fetch stopped at the cap, the store held `total` rows (`held` of them kept). */
export interface SourceCache {
  rows: readonly Row[];
  held: number;
  total?: number;
  partial: boolean;
  savedAt: number;
  /** The store said its rows moved since: Refetch takes the new ones. */
  stale?: boolean;
}

/** A store's cached rows in this tab, and the stores whose change was heard. */
const held = new Map<string, SourceCache>();
const listening = new WeakSet<Store>();

/** A record's name in the `sets` store: a graph's, apart from a View's kept set. */
const nameOf = (id: string): string => `source:${id}`;

/** The size of a row set, by estimate: the first rows, written out, times how many there are. */
function bytesOf(rows: readonly Row[]): number {
  const sample = rows.slice(0, 100);
  if (!sample.length) return 0;
  return (JSON.stringify(sample).length / sample.length) * rows.length;
}

/** A cache from rows: stopped at the cap, it is partial and says how many the store held. */
function made(rows: readonly Row[], total: number | undefined, limit: SourceLimit, savedAt = Date.now()): SourceCache {
  const most = limit.rows ?? SOURCE_ROWS;
  const per = rows.length ? bytesOf(rows) / rows.length : 0;
  const room = per ? Math.floor((limit.bytes ?? SOURCE_BYTES) / per) : most;
  const kept = rows.slice(0, Math.max(0, Math.min(most, room)));
  const cut = kept.length < rows.length || (total !== undefined && kept.length < total);
  return { rows: kept, held: kept.length, ...(cut && total !== undefined ? { total } : {}), partial: cut, savedAt };
}

/** The rows kept for a store: this tab's, else a set a View holds, else the device's; none, "not fetched yet". */
export async function cachedSource(store: Store, id: string): Promise<SourceCache | undefined> {
  const here = held.get(id);
  if (here) return here;
  const view = cacheOf(store).set;
  if (view) return { rows: view.rows, held: view.rows.length, partial: false, savedAt: Date.now() };
  if (!hasDatabase()) return undefined;
  try {
    const record = await readOne('sets', nameOf(id));
    if (!record || record.key !== store.key) return undefined;
    const kept: SourceCache = { rows: record.rows, held: record.rows.length, partial: !!record.total && record.total > record.rows.length,
      ...(record.total ? { total: record.total } : {}), savedAt: record.savedAt };
    held.set(id, kept);
    return kept;
  } catch {
    return undefined;
  }
}

/**
 * Read a store ONCE, at the cap, and keep what came: the press's fetch. The store pages itself and takes only what it is
 * asked, so a store that cannot say how many it has still stops at the cap, partial. A remote store's rows are written
 * to the device's `sets`, to be there when a tab opens; a local store is read again, the cheap way. Nothing narrows it:
 * the graph is never read backwards. Aborted, nothing is kept.
 */
export async function fetchSource(store: Store, id: string, options: { limit?: SourceLimit; signal?: AbortSignal } = {}): Promise<SourceCache> {
  const limit = options.limit ?? {};
  const most = limit.rows ?? SOURCE_ROWS;
  const result = await store.load({ take: most + 1, ...(options.signal ? { signal: options.signal } : {}) });
  options.signal?.throwIfAborted();
  const total = result.totalUnknown ? (result.rows.length > most ? undefined : result.rows.length) : result.total;
  const cache = made(result.rows, total, limit);
  held.set(id, cache);
  if (!listening.has(store)) {
    listening.add(store);
    store.addEventListener('change', () => { const was = held.get(id); if (was) held.set(id, { ...was, stale: true }); });
  }
  if (store.capabilities.remote && hasDatabase()) {
    const record: SetRecord = { name: nameOf(id), version: 1, key: store.key, savedAt: cache.savedAt, rows: [...cache.rows],
      ...(result.dropped ? { dropped: result.dropped } : {}), ...(cache.total !== undefined && cache.partial ? { total: cache.total } : {}) };
    try {
      await write('sets', [record]);
    } catch (error) {
      report({ code: 'source-cache-unwritten', message: 'fetchSource: the device could not keep these rows, so they are held in this tab only.',
        at: { source: id, error: error instanceof Error ? error.message : String(error) } });
    }
  }
  return cache;
}

/** Drop a store's cached rows: this tab's and the device's. */
export async function forgetSource(id: string): Promise<void> {
  held.delete(id);
  if (!hasDatabase()) return;
  try {
    await erase('sets', nameOf(id));
  } catch { /* no database */ }
}

/** A cache in words: "412 rows", or where the cap stopped it: "The first 100,000 of 412,000 rows". */
export function sourceWords(cache: SourceCache): string {
  const n = (v: number): string => v.toLocaleString('en');
  const stale = cache.stale ? ' Newer data is waiting: Refetch.' : '';
  if (!cache.partial) return `${n(cache.held)} rows.${stale}`;
  return `PARTIAL: the first ${n(cache.held)} of ${cache.total !== undefined ? n(cache.total) : 'more'} rows.${stale}`;
}
