/**
 * outbox.ts — the writes a store could not send, as its source was unreached,
 * waiting to be sent in order, once. DOM-free: where they wait is a port —
 * memory here, IndexedDB under a Web Lock in a browser (`keepOutbox`).
 * Plan 652 S7a · TRAP T-a-write-made-offline-waits
 *
 * Map:
 * - OutboxEntry — One write that waits: what it does, to which row, and when it was made.
 * - OutboxPort — Where a store's writes wait, and how one sender at a time sends them.
 * - memoryOutbox — An outbox in memory: gone with its worker, so only for a test or a page.
 * - outboxEntry — A new entry for a write, named so entries sort in the order they were made.
 */
import type { Row } from './store.js';

/** One write that waits: what it does, to which row, and when it was made. */
export interface OutboxEntry {
  /** Its name, and its place: entries sort in the order they were made. */
  id: string;
  type: 'insert' | 'update' | 'remove';
  /** The row's key; an insert's is in its values. */
  key?: unknown;
  /** What an insert or an update writes. */
  values?: Row;
  /** When it was made, in ms. A newer write wins (D3). */
  at: number;
}

/** Where a store's writes wait, and how one sender at a time sends them. */
export interface OutboxPort {
  /** Every entry, in the order made. */
  read(): Promise<OutboxEntry[]>;
  add(entry: OutboxEntry): Promise<void>;
  remove(id: string): Promise<void>;
  /** Run `send` with no other sender over this outbox at once — another tab's
   *  page, or a worker starting while the last one stops. */
  alone<T>(send: () => Promise<T>): Promise<T>;
}

/** An outbox in memory: gone with its worker, so only for a test or a page. */
export function memoryOutbox(): OutboxPort {
  const entries = new Map<string, OutboxEntry>();
  let queue: Promise<unknown> = Promise.resolve();
  return {
    read: async () => [...entries.values()].sort((a, b) => (a.id < b.id ? -1 : 1)),
    add: async (entry) => void entries.set(entry.id, entry),
    remove: async (id) => void entries.delete(id),
    alone<T>(send: () => Promise<T>): Promise<T> {
      const run = queue.then(send, send);
      queue = run.catch(() => undefined);
      return run;
    },
  };
}

let made = 0;

/** A new entry for a write, named so entries sort in the order they were made. */
export function outboxEntry(write: Omit<OutboxEntry, 'id' | 'at'>, at = Date.now()): OutboxEntry {
  made = (made + 1) % 1_000_000;
  return { ...write, id: `${String(at).padStart(15, '0')}-${String(made).padStart(6, '0')}`, at };
}
