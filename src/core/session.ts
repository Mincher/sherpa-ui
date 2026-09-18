/**
 * session.ts — the app-level state store: one value, many readers.
 *
 * TRAP T-session-store-is-the-third-tier — records, then one query over them,
 * then everything else an app knows about itself, addressed by JSON pointer.
 */
import { getPointer, setPointer, pointersOverlap } from './pointer.js';

/** Where a persisted pointer is kept. */
export interface PersistOptions {
  /**
   * Share across TABS via localStorage rather than keeping it per tab.
   *
   * Default TRUE — TRAP T-session-persist-defaults-shared, the opposite of
   * `persistView`'s default and deliberately so.
   */
  shared?: boolean;
  /** The storage key. Defaults to `sherpa:session:<pointer>`. */
  key?: string;
}

const PREFIX = 'sherpa:session:';

/** TRAP T-storage-access-throws — every access is wrapped; a failure only means
 *  the value is not kept. */
function storage(shared: boolean): Storage | null {
  try {
    return shared ? localStorage : sessionStorage;
  } catch {
    return null;
  }
}

/**
 * What an app knows about itself, addressed by pointer.
 *
 * TRAP T-session-store-is-the-third-tier.
 */
export class SessionStore {
  #data: Record<string, unknown>;
  #subs = new Set<{ pointer: string; run: (value: unknown) => void }>();
  /** Pointers whose value is written to storage on every change. */
  #persisted = new Map<string, { key: string; shared: boolean }>();

  constructor(initial: Record<string, unknown> = {}) {
    this.#data = structuredClone(initial);
  }

  get(pointer: string): unknown {
    return getPointer(this.#data, pointer);
  }

  set(pointer: string, value: unknown): void {
    setPointer(this.#data, pointer, value);
    for (const sub of this.#subs) {
      if (pointersOverlap(sub.pointer, pointer)) sub.run(this.get(sub.pointer));
    }
    // …then write through, for this pointer or any ANCESTOR of it —
    // TRAP T-session-store-is-the-third-tier.
    for (const [p, where] of this.#persisted) {
      if (pointersOverlap(p, pointer)) this.#write(p, where);
    }
  }

  subscribe(pointer: string, run: (value: unknown) => void): () => void {
    const sub = { pointer, run };
    this.#subs.add(sub);
    return () => this.#subs.delete(sub);
  }

  snapshot(): Record<string, unknown> {
    return structuredClone(this.#data);
  }

  /**
   * Remember this pointer across reloads.
   *
   * RESTORES IMMEDIATELY if a stored value exists, and returns whether it did —
   * TRAP T-session-persist-defaults-shared.
   */
  persist(pointer: string, options: PersistOptions = {}): boolean {
    const shared = options.shared ?? true;
    const key = options.key ?? PREFIX + pointer;
    this.#persisted.set(pointer, { key, shared });

    const raw = (() => {
      try {
        return storage(shared)?.getItem(key) ?? null;
      } catch {
        return null;
      }
    })();
    if (raw == null) return false;

    try {
      // An unreadable shape is DROPPED, not half-applied —
      // TRAP T-session-persist-defaults-shared.
      this.set(pointer, JSON.parse(raw));
      return true;
    } catch {
      return false;
    }
  }

  /** Stop persisting a pointer, and forget what was stored. */
  forget(pointer: string): void {
    const where = this.#persisted.get(pointer);
    this.#persisted.delete(pointer);
    if (!where) return;
    try {
      storage(where.shared)?.removeItem(where.key);
    } catch {
      /* storage unavailable */
    }
  }

  #write(pointer: string, where: { key: string; shared: boolean }): void {
    const value = this.get(pointer);
    try {
      if (value === undefined) storage(where.shared)?.removeItem(where.key);
      else storage(where.shared)?.setItem(where.key, JSON.stringify(value));
    } catch {
      /* full, blocked, or a private window — TRAP T-storage-access-throws */
    }
  }
}
