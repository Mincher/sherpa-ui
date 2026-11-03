/**
 * notice-keep.ts — the notices a worker keeps until a page has seen them, in
 * IndexedDB, so one said with every tab shut still reaches the reader (D9).
 * Headless-safe: with no IndexedDB they are kept in memory.
 * Plan 652 S7b · TRAP T-a-newer-write-wins
 *
 * Map:
 * - NoticeKeep — Where a worker's kept notices wait to be seen.
 * - keepNotices — The kept notices on the device, or in memory where it has no IndexedDB.
 */
import { IdbStore } from './idb-store.js';
import type { UpdateNotice } from '../data/notices.js';
import type { Row } from '../data/store.js';

/** Where a worker's kept notices wait to be seen. */
export interface NoticeKeep {
  read(): Promise<UpdateNotice[]>;
  put(notice: UpdateNotice & { id: string }): Promise<void>;
  remove(id: string): Promise<void>;
  /** Forget every one: a sign-out. */
  clear(): Promise<void>;
}

let notices: IdbStore | null = null;

/** The kept notices on the device, or in memory where it has no IndexedDB. */
export function keepNotices(): NoticeKeep {
  if (!IdbStore.available) {
    const kept = new Map<string, UpdateNotice>();
    return {
      read: async () => [...kept.values()],
      put: async (notice) => void kept.set(notice.id, notice),
      remove: async (id) => void kept.delete(id),
      clear: async () => kept.clear(),
    };
  }
  const store = (notices ??= new IdbStore({ name: 'notices', database: 'sherpa-notices', key: 'id' }));
  return {
    read: async () => (await store.load()).rows as unknown as UpdateNotice[],
    put: async (notice) => void await store.putAll([notice as unknown as Row]),
    // Seen in another tab already: nothing to forget.
    remove: (id) => store.remove(id).catch(() => undefined),
    clear: () => store.clear(),
  };
}
