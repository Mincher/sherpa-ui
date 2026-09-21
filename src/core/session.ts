/**
 * session.ts — the app-level state store: one value, many readers.
 *
 * Third tier: a Store holds records, a DataSource one query over them, this
 * everything else an app knows about itself. Pointer-addressed, so a
 * subscriber can watch a BRANCH.
 *
 * TRAP T-session-store-is-the-third-tier
 */
import { getPointer, setPointer, pointersOverlap } from './pointer.js';

/** Where a persisted pointer is kept. */
export interface PersistOptions {
  /** Share across TABS. Default TRUE — TRAP T-session-persist-defaults-shared. */
  shared?: boolean;
  /** The storage key. Defaults to `sherpa:session:<pointer>`. */
  key?: string;
}

const PREFIX = 'sherpa:session:';

/** TRAP T-storage-access-throws — a failure only means the value is not kept. */
function storage(shared: boolean): Storage | null {
  try {
    return shared ? localStorage : sessionStorage;
  } catch {
    return null;
  }
}

/** What an app knows about itself, addressed by pointer.
 *  TRAP T-session-store-is-the-third-tier */
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
    // Write through for this pointer or any ANCESTOR: a branch write must not
    // lose what a leaf write keeps. TRAP T-session-store-is-the-third-tier
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
   * Remember this pointer across reloads. RESTORES IMMEDIATELY if a stored
   * value exists, and returns whether it did.
   * TRAP T-session-persist-defaults-shared
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
      // A stored shape this version cannot read is DROPPED, not half-applied.
      // TRAP T-session-persist-defaults-shared
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
