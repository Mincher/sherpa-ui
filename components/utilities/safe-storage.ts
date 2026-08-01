/**
 * safe-storage.ts — quota- and privacy-safe localStorage JSON helpers.
 *
 * localStorage throws in private mode, when disabled, or when the quota is
 * exceeded. These helpers never throw: reads fall back to a supplied default,
 * writes silently no-op on failure. Extracted from sherpa-nav, which persisted
 * quick-access lists and user-applied ordering with the same try/catch pattern
 * in four places.
 */

/** Read and JSON-parse a localStorage key; returns `fallback` on any failure. */
export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    const parsed = JSON.parse(raw) as unknown;
    return parsed == null ? fallback : (parsed as T);
  } catch {
    return fallback;
  }
}

/** JSON-stringify and write a value to localStorage; silently no-ops on failure. */
export function writeJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable / quota exceeded — persistence is best-effort */
  }
}

/** Remove a key; silently no-ops on failure. */
export function removeKey(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* noop */
  }
}
