/**
 * notice-keep.ts — the notices a worker keeps until a page has seen them, in the
 * one Sherpa database, so one said with every tab shut still reaches the reader (D9).
 * Headless-safe: with no IndexedDB they are kept in memory.
 * Plan 652 S7b · TRAP T-a-newer-write-wins
 *
 * Map:
 * - NoticeKeep — Where a worker's kept notices wait to be seen.
 * - keepNotices — The kept notices on the device, or in memory where it has no IndexedDB.
 */
import { clearStores, erase, hasDatabase, readAll, write, type NoticeRecord } from './database.js';
import type { UpdateNotice } from '../data/notices.js';

/** Where a worker's kept notices wait to be seen. */
export interface NoticeKeep {
  read(): Promise<UpdateNotice[]>;
  put(notice: NoticeRecord): Promise<void>;
  remove(id: string): Promise<void>;
  /** Forget every one: a sign-out. */
  clear(): Promise<void>;
}

/** The kept notices on the device, or in memory where it has no IndexedDB. */
export function keepNotices(): NoticeKeep {
  if (!hasDatabase()) {
    const kept = new Map<string, UpdateNotice>();
    return {
      read: async () => [...kept.values()],
      put: async (notice) => void kept.set(notice.id, notice),
      remove: async (id) => void kept.delete(id),
      clear: async () => kept.clear(),
    };
  }
  return {
    read: () => readAll('notices'),
    put: (notice) => write('notices', [notice]),
    // One seen in another tab already is no error.
    remove: (id) => erase('notices', id),
    clear: () => clearStores(['notices']),
  };
}
