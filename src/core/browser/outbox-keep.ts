/**
 * outbox-keep.ts — a store's outbox kept on the device, in the one Sherpa
 * database, so a write made offline outlives its worker; sent under a Web Lock,
 * so it is sent once. Headless-safe: with no IndexedDB it waits in memory, and says so.
 * Plan 652 S7a · TRAP T-a-write-made-offline-waits
 *
 * Map:
 * - keepOutbox — A store's outbox on the device: its writes wait there until sent.
 */
import { erase, hasDatabase, readAll, within, write } from './database.js';
import { memoryOutbox, type OutboxEntry, type OutboxPort } from '../data/outbox.js';
import { report } from '../data/report.js';

/** Web Locks, where the engine has them: all three do, in a page and a worker. */
type Locks = { request<T>(name: string, run: () => Promise<T>): Promise<T> };

/** A store's outbox on the device: its writes wait there until sent. `name` is
 *  the store's — carry the user or tenant in it, as the writes outlive the session. */
export function keepOutbox(name: string): OutboxPort {
  if (!hasDatabase()) {
    report({ code: 'outbox-unavailable', message: `keepOutbox: this browser has no IndexedDB, so "${name}"'s writes made offline wait in memory only.`, at: { outbox: name } });
    return memoryOutbox();
  }
  const memory = memoryOutbox();
  const locks = (globalThis as { navigator?: { locks?: Locks } }).navigator?.locks;
  return {
    // Keyed `[outbox, id]`, so they come back in the order made.
    read: async () => (await readAll('outbox', within(name))).map(({ outbox: _outbox, ...entry }): OutboxEntry => entry),
    add: (entry) => write('outbox', [{ ...entry, outbox: name }]),
    remove: (id) => erase('outbox', [name, id]),
    alone: (send) => (locks ? locks.request(`sherpa-outbox:${name}`, send) : memory.alone(send)),
  };
}
