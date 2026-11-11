/**
 * node-title.ts — a node's TITLE: a title of the node's own follows its kind, "Field: Device type", so a reader always
 * sees what the node is. Tiny and DOM-free, so the data layer, the drawing and sherpa-node read the one rule.
 * Will, 2026-11-11 · TRAP T-a-custom-title-follows-its-kind
 *
 * Map:
 * - nodeTitle — A node's title: a title of its own after its kind; one that starts with its kind, or none, as it is.
 */

/** A node's title: a title of its own after its kind, "Field: Device type". One that is the kind, or already
 *  starts with it and a colon, is as it is; none, the kind's alone. */
export function nodeTitle(kind: string, own: string | undefined): string {
  const title = own?.trim();
  if (!title || title === kind || title.toLowerCase().startsWith(`${kind.toLowerCase()}:`)) return title || kind;
  return `${kind}: ${title}`;
}
