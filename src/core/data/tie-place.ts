/**
 * tie-place.ts — ROOM round a box on the canvas, and what stands in it: a NEW zip tie that would stand behind a node moves
 * to the side of that node with the most room (TODO 882); a PASTED copy stands beside its original, on the side with the
 * most room. A few x and y comparisons. Pure: no DOM. Will, 2026-11-10
 *
 * Map:
 * - Box — A node's box on the plane, in px.
 * - TIE_CLEAR — How far a moved tie stands off the node it cleared, at most.
 * - roomAround — How far a box has to the nearest other box on each side.
 * - placeBeside — How far a copy of a box moves to stand beside it, on the side with the most room.
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

/** How far a box has to the nearest other box on each side: one that overlaps it across (left, right) or along (above, below). */
export function roomAround(box: Box, others: readonly Box[]): { left: number; right: number; above: number; below: number } {
  const across = (b: Box): boolean => b.top < box.bottom && box.top < b.bottom;
  const along = (b: Box): boolean => b.left < box.right && box.left < b.right;
  return {
    left: box.left - Math.max(-Infinity, ...others.filter((b) => across(b) && b.right <= box.left).map((b) => b.right)),
    right: Math.min(Infinity, ...others.filter((b) => across(b) && b.left >= box.right).map((b) => b.left)) - box.right,
    above: box.top - Math.max(-Infinity, ...others.filter((b) => along(b) && b.bottom <= box.top).map((b) => b.bottom)),
    below: Math.min(Infinity, ...others.filter((b) => along(b) && b.top >= box.bottom).map((b) => b.top)) - box.bottom,
  };
}

/**
 * How far a COPY of a box moves to stand beside it, `gap` off: on the side where it fits with a gap each side, the most
 * room first, then right, below, left, above; where none fits, the side with the most room. Boxes inside it (what it was
 * drawn round) are not in the way.
 */
export function placeBeside(original: Box, boxes: readonly Box[], gap = TIE_CLEAR): { dx: number; dy: number } {
  const inside = (b: Box): boolean => b.left >= original.left && b.right <= original.right && b.top >= original.top && b.bottom <= original.bottom;
  const room = roomAround(original, boxes.filter((b) => !inside(b)));
  const [w, h] = [original.right - original.left, original.bottom - original.top];
  const need = { left: w + 2 * gap, right: w + 2 * gap, above: h + 2 * gap, below: h + 2 * gap };
  const shift = { left: { dx: -(w + gap), dy: 0 }, right: { dx: w + gap, dy: 0 }, above: { dx: 0, dy: -(h + gap) }, below: { dx: 0, dy: h + gap } };
  const fits = (side: keyof typeof room): number => (room[side] >= need[side] ? 1 : 0);
  // Room alike (endless on both, say): the way a graph reads, right, then below, then left, then above.
  const order = ['right', 'below', 'left', 'above'] as const;
  const [best] = [...order].sort((a, b) => fits(b) - fits(a) || room[b] - room[a] || order.indexOf(a) - order.indexOf(b));
  return shift[best!];
}

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
  const room = roomAround(hit, boxes.filter((b) => b !== hit));
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
