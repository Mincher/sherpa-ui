/**
 * outbox-keep.ts — a store's outbox kept on the device, in IndexedDB, so a write
 * made offline outlives its worker; sent under a Web Lock, so it is sent once.
 * Headless-safe: with no IndexedDB it waits in memory, and says so.
 * Plan 652 S7a · TRAP T-a-write-made-offline-waits
 *
 * Map:
 * - keepOutbox — A store's outbox on the device: its writes wait there until sent.
 */
import { IdbStore } from './idb-store.js';
import { memoryOutbox, type OutboxEntry, type OutboxPort } from '../data/outbox.js';
import { report } from '../data/report.js';

/** One entry, as it is kept: which outbox it waits in, and its slot there — its
 *  name, as two outboxes may make one id in the same ms. */
interface Kept extends OutboxEntry {
  outbox: string;
  slot: string;
}

let entries: IdbStore | null = null;

/** The shared object store, its own database, so an app's version never moves it. */
function entriesStore(): IdbStore {
  return (entries ??= new IdbStore({ name: 'entries', database: 'sherpa-outbox', key: 'slot' }));
}

/** Web Locks, where the engine has them: all three do, in a page and a worker. */
type Locks = { request<T>(name: string, run: () => Promise<T>): Promise<T> };

/** A store's outbox on the device: its writes wait there until sent. `name` is
 *  the store's — carry the user or tenant in it, as the writes outlive the session. */
export function keepOutbox(name: string): OutboxPort {
  if (!IdbStore.available) {
    report({ code: 'outbox-unavailable', message: `keepOutbox: this browser has no IndexedDB, so "${name}"'s writes made offline wait in memory only.`, at: { outbox: name } });
    return memoryOutbox();
  }
  const memory = memoryOutbox();
  const locks = (globalThis as { navigator?: { locks?: Locks } }).navigator?.locks;
  return {
    async read(): Promise<OutboxEntry[]> {
      const { rows } = await entriesStore().load();
      return (rows as unknown as Kept[])
        .filter((row) => row.outbox === name)
        .map(({ outbox: _outbox, slot: _slot, ...entry }) => entry as OutboxEntry)
        .sort((a, b) => (a.id < b.id ? -1 : 1));
    },
    async add(entry): Promise<void> {
      await entriesStore().putAll([{ ...entry, outbox: name, slot: `${name}|${entry.id}` }]);
    },
    async remove(id): Promise<void> {
      await entriesStore().remove(`${name}|${id}`);
    },
    alone: (send) => (locks ? locks.request(`sherpa-outbox:${name}`, send) : memory.alone(send)),
  };
}
