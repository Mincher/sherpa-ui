/**
 * tie-place.ts — where a NEW zip tie stands clear of the nodes: one that would stand behind a node moves to the side of
 * that node with the most room between it and the other nodes — a few x and y comparisons. Pure: no DOM. Will, TODO 882
 *
 * Map:
 * - Box — A node's box on the plane, in px.
 * - TIE_CLEAR — How far a moved tie stands off the node it cleared, at most.
 * - clearOfNodes — The place a tie of this height stands, clear of the nodes where it can be.
 */

/** A node's box on the plane, in px. */
export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** How far a moved tie stands off the node it cleared, at most: half the room, where there is less. */
export const TIE_CLEAR = 48;

/** The tie's own box: 4px wide, as tall as its slots and their ends. */
const tieBox = (at: { x: number; y: number }, high: number): Box => ({ left: at.x - 2, right: at.x + 2, top: at.y - high / 2, bottom: at.y + high / 2 });
const overlaps = (a: Box, b: Box): boolean => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

/**
 * The place a tie `high` px tall stands, clear of the nodes. Where it stands behind a node, it moves to the side of that
 * node with the most room before the next node — left, right, above or below — half way into it, TIE_CLEAR at most. A
 * side across that `limit` (the x range the tie may take) is not offered; with none left, it stays.
 */
export function clearOfNodes(at: { x: number; y: number }, high: number, boxes: readonly Box[], limit?: { min: number; max: number }): { x: number; y: number } {
  const hit = boxes.find((b) => overlaps(tieBox(at, high), b));
  if (!hit) return at;
  const others = boxes.filter((b) => b !== hit);
  const across = (b: Box): boolean => b.top < hit.bottom && hit.top < b.bottom;
  const along = (b: Box): boolean => b.left < hit.right && hit.left < b.right;
  const room = {
    left: hit.left - Math.max(-Infinity, ...others.filter((b) => across(b) && b.right <= hit.left).map((b) => b.right)),
    right: Math.min(Infinity, ...others.filter((b) => across(b) && b.left >= hit.right).map((b) => b.left)) - hit.right,
    above: hit.top - Math.max(-Infinity, ...others.filter((b) => along(b) && b.bottom <= hit.top).map((b) => b.bottom)),
    below: Math.min(Infinity, ...others.filter((b) => along(b) && b.top >= hit.bottom).map((b) => b.top)) - hit.bottom,
  };
  const off = (space: number, own: number): number => Math.max(own, Math.min(space / 2, TIE_CLEAR));
  const places = {
    left: { x: Math.round(hit.left - off(room.left, 4)), y: at.y },
    right: { x: Math.round(hit.right + off(room.right, 4)), y: at.y },
    above: { x: at.x, y: Math.round(hit.top - off(room.above, high / 2 + 4)) },
    below: { x: at.x, y: Math.round(hit.bottom + off(room.below, high / 2 + 4)) },
  };
  const sides = (Object.keys(room) as (keyof typeof room)[])
    .filter((side) => !limit || (places[side].x >= limit.min && places[side].x <= limit.max))
    .sort((a, b) => room[b] - room[a]);
  return sides.length ? places[sides[0]!] : at;
}
