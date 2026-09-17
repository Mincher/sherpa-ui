/**
 * session.ts — the app-level state store: one value, many readers.
 *
 * The third tier. A STORE holds records, a DATA SOURCE holds one query over
 * them, and this holds everything else an app knows about itself: which theme
 * is on, which customer is selected, which panel is open, who is signed in.
 *
 * It was already written — as `StateStore` in `render-view.ts`, where it is the
 * blob a view definition's `$state` pointers read and write. That was the right
 * class in the wrong file: nobody looking for "where does an app keep its
 * session state" would open a module named for view rendering. Same class,
 * addressable name, plus the one capability an app actually needs from it.
 *
 * ADDRESSED BY JSON POINTER (`/theme/mode`), not by a flat key, so a subscriber
 * can watch a branch and hear about anything beneath it. That is what lets one
 * value have many readers without them knowing about each other.
 */
import { getPointer, setPointer, pointersOverlap } from './pointer.js';

/** Where a persisted pointer is kept. */
export interface PersistOptions {
  /**
   * Share across TABS via localStorage rather than keeping it per tab.
   *
   * Default TRUE here, and that is the opposite of `persistView`'s default —
   * deliberately. A view's state is about one screen in one tab; a session
   * preference is about the person, and a theme that re-picks itself in a second
   * tab is a bug the reader has to fix by hand every time.
   */
  shared?: boolean;
  /** The storage key. Defaults to `sherpa:session:<pointer>`. */
  key?: string;
}

const PREFIX = 'sherpa:session:';

/**
 * Web Storage throws in a private window, with site data blocked, and during
 * preview or thumbnail capture — so every access is wrapped. A failure means
 * the value is not kept, never that the app breaks.
 */
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
 *   const session = new SessionStore({ theme: { mode: 'light' } });
 *   session.persist('/theme/mode');          // remembered across reloads
 *   session.subscribe('/theme', (v) => …);   // hears /theme/mode too
 *   session.set('/theme/mode', 'dark');
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
    // …then write through, for this pointer or any ancestor of it. Setting
    // `/theme` must persist a `/theme/mode` that was registered, or a branch
    // write would silently lose what a leaf write keeps.
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
   * RESTORES IMMEDIATELY if a stored value exists, so the caller does not have
   * to read it back — a theme picked last week should already be on before
   * anything subscribes. Returns whether it restored, for a caller that wants
   * to tell a first-time visitor apart from a returning one.
   *
   * This exists because the alternative is what every app was writing: a key
   * constant, a try/catch to read, a try/catch to write, and a wrapper to keep
   * the two in step. Four pieces to get right per preference, and the examples
   * were teaching it.
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
      // A stored value outlives the code that wrote it, so a shape this version
      // does not understand is DROPPED rather than half-applied.
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
      /* full, blocked, or a private window — the value is not kept */
    }
  }
}
