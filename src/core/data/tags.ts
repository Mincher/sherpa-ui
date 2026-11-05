/**
 * tags.ts — a reader's TAGS, as words: what an entity, a Custom Node and the node panel share.
 * Its own module, so the outlet, which carries the graph Views, carries only this. DOM-free.
 * Will, TODO 784.
 *
 * Map:
 * - tidyTags — Tags as words: each trimmed, an empty one or a stranger dropped, a repeat kept once.
 */

/** Tags as words: each trimmed, an empty one or one that is no text dropped, a repeat (in any case) kept once. */
export function tidyTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  const seen = new Set<string>();
  return tags.flatMap((t) => {
    const word = typeof t === 'string' ? t.trim() : '';
    if (!word || seen.has(word.toLowerCase())) return [];
    seen.add(word.toLowerCase());
    return [word];
  });
}
