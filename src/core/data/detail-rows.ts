/**
 * detail-rows.ts — the rows a row OPENS on, read from another type's store: those whose `by` field holds the row's key
 * (a ref, or a list of them), by that key. A User's Accounts, under the User. DOM-free. Will, TODO 963
 *
 * Map:
 * - detailRows — The rows of a store whose `by` field holds one of these keys, by each key.
 */
import { valueKey, type Row, type Store } from './store.js';

/** The rows of a store whose `by` field holds one of these keys, by each key (`valueKey`): one read for them all. A row
 *  whose `by` holds several keys is under each. */
export async function detailRows(store: Store, by: string, keys: readonly unknown[], signal?: AbortSignal): Promise<Record<string, Row[]>> {
  const byKey: Record<string, Row[]> = {};
  if (!keys.length) return byKey;
  const wanted = new Set(keys.map(valueKey));
  const { rows } = await store.load({ filter: [by, 'in', [...keys]], ...(signal ? { signal } : {}) });
  for (const row of rows) {
    const held = row[by];
    for (const key of Array.isArray(held) ? held : [held]) {
      const at = valueKey(key);
      if (wanted.has(at)) (byKey[at] ??= []).push(row);
    }
  }
  return byKey;
}
