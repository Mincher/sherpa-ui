/**
 * store-history.ts — what changed in a store this session, by field: the number
 * of the last change that moved each one. It never grows (Will, 345 phase 3 D1).
 * Pure and DOM-free. TRAP T-a-store-keeps-its-history
 *
 * Map:
 * - changedFields — The fields whose values differ between two versions of a row.
 * - StoreHistory — One store's clock, and the last change that moved each field, the rows, or everything.
 * - .seq — The store's clock: the number of its last change; 0 is ground zero.
 * - .record — Note one change, and give its number.
 * - .changedSince — Did any of these fields, or the rows, move after change `seq`?
 * - .since — What moved after change `seq`: the rows, and which fields.
 */
import { valueKey, type Row, type StoreChangeDetail } from './store.js';

/** A dot path answers to its top field: `customer.name` to `customer`. */
const top = (field: string): string => field.split('.')[0]!;

/** The fields whose values differ between two versions of a row, compared as a
 *  filter compares them. A value SENT as the same object the row held was changed
 *  in place, so the old value cannot be read: it counts as changed. */
export function changedFields(before: Row, after: Row, sent: Row = after): string[] {
  const out: string[] = [];
  for (const f of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const was = before[f];
    const now = after[f];
    const inPlace = f in sent && typeof sent[f] === 'object' && sent[f] !== null && Object.is(was, sent[f]);
    if (inPlace || typeof was !== typeof now || valueKey(was) !== valueKey(now)) out.push(f);
  }
  return out;
}

/** One store's clock, and the last change that moved each field, the rows, or
 *  everything. Starts at 0 when the store is made — each session. */
export class StoreHistory {
  /** The store's clock: the number of its last change; 0 is ground zero. */
  get seq(): number {
    return this.#seq;
  }

  /**
   * Note one change, and give its number. No key moves everything; an insert,
   * a remove or a changed key moves the rows; an update moves the fields it
   * names, or every field when it names none.
   */
  record(change: StoreChangeDetail, key: string): number {
    const seq = ++this.#seq;
    if (change.key === undefined) this.#all = seq;
    else if (change.type !== 'update') this.#rows = seq;
    else if (!change.fields) this.#all = seq;
    else {
      for (const f of change.fields) {
        this.#fields.set(top(f), seq);
        if (top(f) === top(key)) this.#rows = seq;
      }
    }
    return seq;
  }

  /** Did any of these fields, or the rows, move after change `seq`? */
  changedSince(seq: number, fields: readonly string[] | 'all'): boolean {
    if (this.#all > seq || this.#rows > seq) return true;
    if (fields === 'all') return this.#seq > seq;
    return fields.some((f) => (this.#fields.get(top(f)) ?? 0) > seq);
  }

  /** What moved after change `seq`: the rows, and which fields. */
  since(seq: number): { rows: boolean; fields: string[] | 'all' } {
    const all = this.#all > seq;
    return {
      rows: all || this.#rows > seq,
      fields: all ? 'all' : [...this.#fields].filter(([, at]) => at > seq).map(([f]) => f),
    };
  }

  /** The number of the last change. */
  #seq = 0;
  /** The last change that moved the rows: an insert, a remove, a changed key. */
  #rows = 0;
  /** The last change that may have moved every field. */
  #all = 0;
  /** Each field's last change, by its top field. */
  #fields = new Map<string, number>();
}
