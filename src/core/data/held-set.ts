/**
 * held-set.ts — a REMOTE store's whole set, held on the client and asked as a
 * local store is asked: the same search, filter, sort and page. DOM-free.
 * TRAP T-a-remote-source-holds-its-whole-set
 *
 * Map:
 * - HeldSet — A remote store's whole set, asked on the client; its rows go out as copies.
 * - .size — How many rows it holds.
 * - .rows — Every row it holds, in place — to keep a copy, never to change.
 * - .refused — What the schema refused when the set was read.
 * - .patch — Take one store change in place; false when it cannot, and the set must be read again.
 * - .load — What a load asks, each row a copy keyed as its original, so a host's edit never reaches the set.
 * - .totalCount — The matches, unpaged and unsorted.
 * - .scan — Every row, in place.
 * - .distinct — Each field's values among the matches, read in place.
 */
import {
  applyOptions, distinctOf, readField, sameKey, type LoadOptions, type LoadResult, type Row, type Store, type StoreChangeDetail,
} from './store.js';
import { carryKey, isMadeUpKey, keyRow, rowKey } from './row-key.js';

/** A remote store's whole set, asked on the client; its rows go out as copies. */
export class HeldSet {
  /** The whole set, as the store sent it, with each change taken since. */
  readonly #rows: Row[];
  /** What the store's schema refused when the set was read, said on every load. TRAP T-dropped-rows-must-be-countable */
  readonly #refused: Pick<LoadResult, 'dropped' | 'issues'>;

  constructor(rows: readonly Row[], refused: Pick<LoadResult, 'dropped' | 'issues'> = {}) {
    this.#rows = [...rows];
    this.#refused = refused.dropped ? refused : {};
  }

  /** How many rows it holds. */
  get size(): number {
    return this.#rows.length;
  }

  /** Every row it holds, in place — to keep a copy, never to change. */
  get rows(): readonly Row[] {
    return this.#rows;
  }

  /** What the schema refused when the set was read. */
  get refused(): Pick<LoadResult, 'dropped' | 'issues'> {
    return this.#refused;
  }

  /**
   * Take one store change in place, exactly as a whole read would hold it: an
   * insert (and the rows a cap trimmed with it), an update's whole row, a
   * remove. False when it is not certain — no key, no row, a row it does not
   * hold, a key another row has, a place it cannot tell — and the set must be
   * read again. TRAP T-a-held-set-takes-a-change-in-place
   */
  patch(change: StoreChangeDetail, store: Pick<Store, 'key' | 'rowOrder'>): boolean {
    const { type, key, row } = change;
    const field = store.key;
    if (key == null) return false;
    const at = (k: unknown): number => this.#rows.findIndex((r) => sameKey(readField(r, field), k) || (isMadeUpKey(k) && rowKey(r) === k));
    const i = at(key);
    if (type === 'remove') {
      if (i < 0) return false;
      this.#rows.splice(i, 1);
      return true;
    }
    // Not the whole row — an envelope, say — is not certain.
    if (!row || (readField(row, field) == null && !isMadeUpKey(key))) return false;
    // Keyed as the store keys a read, so a grid keeps the row. TRAP T-a-made-up-key-never-leaves-the-data-layer
    const next = carryKey(i >= 0 ? this.#rows[i]! : row, { ...row });
    const now = readField(next, field);
    keyRow(next, now);
    if (type === 'insert') {
      const trimmed = (change.trimmed ?? []).map(at);
      if (i >= 0 || trimmed.some((t) => t < 0)) return false;
      const place = this.#placeOf(next, store, trimmed);
      if (place < 0) return false;
      for (const t of trimmed.sort((a, b) => b - a)) this.#rows.splice(t, 1);
      this.#rows.splice(place, 0, next);
      return true;
    }
    if (i < 0) return false;
    if (sameKey(now, readField(this.#rows[i]!, field))) {
      this.#rows[i] = next;
      return true;
    }
    // A changed key: one another row has, or a place it cannot tell, is not certain.
    if (at(now) >= 0 || !store.rowOrder) return false;
    if (store.rowOrder === 'insertion') {
      this.#rows[i] = next;
      return true;
    }
    this.#rows.splice(i, 1);
    const place = this.#placeOf(next, store, []);
    if (place < 0) return false;
    this.#rows.splice(place, 0, next);
    return true;
  }

  /** Where a new row goes, as the store's whole read would place it, or -1 when it cannot tell. */
  #placeOf(row: Row, store: Pick<Store, 'key' | 'rowOrder'>, gone: readonly number[]): number {
    if (store.rowOrder === 'insertion') return this.#rows.length - gone.length;
    if (store.rowOrder !== 'key') return -1;
    const key = readField(row, store.key);
    let place = 0;
    for (const [n, r] of this.#rows.entries()) {
      if (gone.includes(n)) continue;
      const order = keyOrder(readField(r, store.key), key);
      if (Number.isNaN(order)) return -1;
      if (order > 0) return place;
      place++;
    }
    return place;
  }

  /** What a load asks, each row a copy keyed as its original, so a host's edit never reaches the set. */
  load(options: LoadOptions = {}): Promise<LoadResult> {
    const result = applyOptions(this.#rows, options);
    return Promise.resolve({ ...result, ...this.#refused, rows: result.rows.map((r) => carryKey(r, { ...r })) });
  }

  /** The matches, unpaged and unsorted. */
  totalCount(options: LoadOptions = {}): Promise<number> {
    const { skip: _skip, take: _take, sort: _sort, group: _group, ...rest } = options;
    return Promise.resolve(applyOptions(this.#rows, rest).total);
  }

  /** Each field's values among the matches, read in place. */
  /** Every row, in place. */
  scan(): Promise<readonly Row[]> {
    return Promise.resolve(this.#rows);
  }

  distinct(fields: readonly string[], options: LoadOptions = {}): Promise<Record<string, unknown[]>> {
    const { skip: _skip, take: _take, sort: _sort, group: _group, ...rest } = options;
    return Promise.resolve(distinctOf(applyOptions(this.#rows, rest).rows, fields));
  }
}

/** IndexedDB's order of two keys of one kind, or NaN for any it cannot compare. */
function keyOrder(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'string' && typeof b === 'string') return a < b ? -1 : a > b ? 1 : 0;
  return NaN;
}
