/**
 * row-key.ts — the key a row goes by, kept BESIDE the row and never on it.
 * TRAP T-a-made-up-key-never-leaves-the-data-layer
 *
 * Map:
 * - MADE_UP — What every key the data never had starts with.
 * - rowKey — The key a row goes by, or undefined for a row nothing has keyed.
 * - keyRow — Key a row: its own value, one it carries, or one made up.
 * - carryKey — A copy of a row goes by the original's key.
 * - isMadeUpKey — Is this a key the data never had?
 * - isStaleKey — Is this a made-up key from another page load, which names no row now?
 */

const keys = new WeakMap<object, string>();

/** What every key the data never had starts with. */
export const MADE_UP = 'sherpa:';

// One per page load, so an old made-up key can never name a new row.
const LOAD = `${MADE_UP}${Math.random().toString(36).slice(2, 8)}:`;
let made = 0;

/** The key a row goes by, or undefined for a row nothing has keyed. */
export function rowKey(row: object): string | undefined {
  return keys.get(row);
}

/** Key a row: its own value, one it carries already, or one made up. */
export function keyRow(row: object, own?: unknown): string {
  const key = own != null && own !== '' ? String(own) : keys.get(row) ?? `${LOAD}${++made}`;
  keys.set(row, key);
  return key;
}

/** A copy of a row goes by the original's key. */
export function carryKey<T extends object>(from: object, to: T): T {
  const key = keys.get(from);
  if (key) keys.set(to, key);
  return to;
}

/** Is this a key the data never had? A saved View may not keep it. */
export function isMadeUpKey(key: unknown): boolean {
  return typeof key === 'string' && key.startsWith(MADE_UP);
}

/** Is this a made-up key from another page load? It names no row now. */
export function isStaleKey(key: unknown): boolean {
  return isMadeUpKey(key) && !(key as string).startsWith(LOAD);
}
