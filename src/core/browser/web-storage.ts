/**
 * web-storage.ts — Web Storage that cannot throw.
 *
 * `localStorage` throws on ACCESS in a private window, with site data blocked,
 * and during preview or thumbnail capture. Not on read — on touching the
 * global. So every access is wrapped, and `persist-view.ts` and `session.ts`
 * each carried a byte-identical `storage()` plus their own try/catch at every
 * call site: nineteen catch blocks across three files guarding one quirk.
 *
 * A failure here means the value is not KEPT. It never means the page breaks.
 *
 * TRAP T-storage-access-throws
 *
 * Map:
 * - StorageKind — `local` outlives the tab; `session` dies with it.
 * - readText — Read a raw string.
 * - writeText — Write a raw string.
 * - removeKey — delete one key, without throwing when storage is blocked
 * - readJson — Read JSON, and FORGET the key when it cannot be understood.
 * - writeJson — write a value as JSON, without throwing when storage is blocked
 * - isPlainObject — A plain object, which is all a stored shape can be trusted to be.
 */

/** `local` outlives the tab; `session` dies with it. */
export type StorageKind = 'local' | 'session';

/** The store, or `null` when the platform refuses. */
function store(kind: StorageKind): Storage | null {
  try {
    return kind === 'local' ? localStorage : sessionStorage;
  } catch {
    return null;
  }
}

/** Read a raw string. `null` when absent OR unavailable — the caller cannot tell, and should not need to. */
export function readText(kind: StorageKind, key: string): string | null {
  try {
    return store(kind)?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

/** Write a raw string. Silently does nothing when storage is full or blocked. */
export function writeText(kind: StorageKind, key: string, value: string): void {
  try {
    store(kind)?.setItem(key, value);
  } catch {
    /* quota, or storage revoked mid-session */
  }
}

/** Remove a key. Its own try — removing can throw too. */
export function removeKey(kind: StorageKind, key: string): void {
  try {
    store(kind)?.removeItem(key);
  } catch {
    /* storage unavailable */
  }
}

/**
 * Read JSON, and FORGET the key when it cannot be understood.
 *
 * A stored object is trustworthy in SHAPE, never in content: it outlives the
 * code that wrote it, and a hand-edited one is a plain string. A caller gets
 * the fallback and starts exactly where it would have without the store.
 *
 * `guard` is the shape check. Without one, any parsed value passes — which is
 * right for a caller that takes `unknown` and wrong for one that does not.
 */
export function readJson<T>(
  kind: StorageKind,
  key: string,
  fallback: T,
  guard?: (value: unknown) => value is T,
): T {
  const raw = readText(kind, key);
  if (raw == null) return fallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (guard && !guard(parsed)) {
      removeKey(kind, key);
      return fallback;
    }
    return parsed as T;
  } catch {
    // Not JSON, or a shape this code no longer understands.
    removeKey(kind, key);
    return fallback;
  }
}

/** Write JSON. A value that cannot be serialised is dropped, not thrown. */
export function writeJson(kind: StorageKind, key: string, value: unknown): void {
  try {
    writeText(kind, key, JSON.stringify(value));
  } catch {
    /* circular, or a BigInt */
  }
}

/** A plain object, which is all a stored shape can be trusted to be. */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
