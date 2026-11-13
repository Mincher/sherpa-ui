/**
 * content-hash.ts — a value's content as one short text: the same content, keys in any order, is the same hash. A
 * version's, not a secret. DOM-free. Plan 972
 *
 * Map:
 * - stable — A value as text, its keys in order, so the same content is the same text.
 * - hashOf — A 53-bit text hash (cyrb53).
 * - contentHash — A value's content hash: its stable text, hashed.
 */

/** A value as text, its keys in order, so the same content is the same text. An undefined key is no key. */
export function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

/** A 53-bit text hash (cyrb53): a version, not a secret. */
export function hashOf(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
}

/** A value's content hash: its stable text, hashed. */
export const contentHash = (value: unknown): string => hashOf(stable(value));
