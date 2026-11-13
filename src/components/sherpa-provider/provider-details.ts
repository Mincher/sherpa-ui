/**
 * provider-details.ts — a grid whose rows OPEN on rows of another type (its `detail` names the type, and that type's
 * field holding a row's key): each page of rows it is given, the rows they open on are read from the type's store and
 * given to it, by each row's key. A User's Accounts, under the User. Will, TODO 963
 *
 * Map:
 * - DetailsHost — What the details ask of their provider.
 * - ProviderDetails — The grids whose rows open on another type's rows, and each one's read.
 * - .fill — A page of rows was given: the rows they open on, read and given.
 * - .leave — A grid let go: its read stops.
 */
import { detailRows } from '../../core/data/detail-rows.js';
import { report } from '../../core/data/report.js';
import type { Row, Store } from '../../core/data/store.js';

/** What the details ask of their provider. */
export interface DetailsHost {
  /** The app's stores, by name, as the page opening was given them: a type's among them. */
  stores(): Readonly<Record<string, Store>>;
}

/** A grid as its detail is read: the field that names its rows, and what its rows open on. */
type DetailGrid = Element & { key?: string | null; detail?: ({ key?: string; rows?: Record<string, Row[]> } & Record<string, unknown>) | null };

/** The grids whose rows open on another type's rows, and each one's read. */
export class ProviderDetails {
  /** Its provider. */
  readonly #host: DetailsHost;
  /** Each grid's read in flight: a newer page of rows stops it. */
  readonly #reads = new WeakMap<Element, AbortController>();

  constructor(host: DetailsHost) {
    this.#host = host;
  }

  /** A page of rows was given to a grid: the rows of `type` whose `by` holds each row's key, read in one go and given as
   *  its detail's rows, its sub-grid's key the type's own unless its detail names one. */
  fill(el: Element, { type, by }: { type: string; by: string }, payload: unknown): void {
    const grid = el as DetailGrid;
    const rows = (payload as { rows?: unknown } | null | undefined)?.rows;
    if (!Array.isArray(rows)) return;
    const store = this.#host.stores()[type];
    if (!store) {
      report({ code: 'detail-unknown-store', message: `sherpa-provider: a grid's detail names the type "${type}", whose store the app has not given.`, at: { type } });
      return;
    }
    // Its rows are kept by its key: with none, no row could find its own.
    const key = grid.key;
    if (!key) {
      report({ code: 'detail-without-key', message: 'sherpa-provider: a grid whose rows open on another type\'s rows needs its `key`, the field that names a row.', at: { type } });
      return;
    }
    this.#reads.get(el)?.abort();
    const read = new AbortController();
    this.#reads.set(el, read);
    detailRows(store, by, (rows as Row[]).map((row) => row[key]), read.signal).then((byKey) => {
      const detail = grid.detail;
      if (read.signal.aborted || !detail) return;
      grid.detail = { ...detail, key: detail.key ?? store.key, rows: byKey };
    }, (error: unknown) => {
      if (read.signal.aborted) return;
      report({ code: 'detail-read-failed', message: `sherpa-provider: the rows of "${type}" a grid's rows open on could not be read (${error instanceof Error ? error.message : String(error)}).`, at: { type } });
    });
  }

  /** A grid let go: its read stops. */
  leave(el: Element): void {
    this.#reads.get(el)?.abort();
    this.#reads.delete(el);
  }
}
