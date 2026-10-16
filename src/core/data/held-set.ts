/**
 * held-set.ts — a REMOTE store's whole set, held on the client and asked as a
 * local store is asked: the same search, filter, sort and page. DOM-free.
 * TRAP T-a-remote-source-holds-its-whole-set
 *
 * Map:
 * - HeldSet — A remote store's whole set, asked on the client; its rows go out as copies.
 * - .size — How many rows it holds.
 * - .load — What a load asks, each row a copy keyed as its original, so a host's edit never reaches the set.
 * - .totalCount — The matches, unpaged and unsorted.
 * - .distinct — Each field's values among the matches, read in place.
 */
import { applyOptions, distinctOf, type LoadOptions, type LoadResult, type Row } from './store.js';
import { carryKey } from './row-key.js';

/** A remote store's whole set, asked on the client; its rows go out as copies. */
export class HeldSet {
  /** The whole set, as the store sent it. */
  readonly #rows: readonly Row[];
  /** What the store's schema refused when the set was read, said on every load. TRAP T-dropped-rows-must-be-countable */
  readonly #refused: Pick<LoadResult, 'dropped' | 'issues'>;

  constructor(rows: readonly Row[], refused: Pick<LoadResult, 'dropped' | 'issues'> = {}) {
    this.#rows = rows;
    this.#refused = refused.dropped ? refused : {};
  }

  /** How many rows it holds. */
  get size(): number {
    return this.#rows.length;
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
  distinct(fields: readonly string[], options: LoadOptions = {}): Promise<Record<string, unknown[]>> {
    const { skip: _skip, take: _take, sort: _sort, group: _group, ...rest } = options;
    return Promise.resolve(distinctOf(applyOptions(this.#rows, rest).rows, fields));
  }
}
