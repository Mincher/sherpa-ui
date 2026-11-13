/**
 * seed-version.ts — a seed's version, made from the seed itself: the same rows or entities, the same number, so
 * changed seed data is a new seed and no one bumps a number. DOM-free. Will, plan 960 U3
 *
 * Map:
 * - seedVersionOf — A number made from JSON values: the same values, the same number.
 */

/** A number made from JSON values: the same values, the same number. FNV-1a over their JSON: a version, never a secret. */
export function seedVersionOf(values: unknown): number {
  const text = JSON.stringify(values) ?? '';
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193);
  return hash >>> 0;
}
