/**
 * connector-path.ts — a connection's curve on the plane: flat cubic pieces from one waypoint to the next. With no
 * bend point it is the default curve. A waypoint is a bend point or, on a tied connection, a zip tie's slot
 * (never both), sorted by x, so the curve is a function of x and never loops back. Pure: no DOM. Will, TODOs 562, 744, 754
 *
 * Map:
 * - Pt — A point on the plane, [x, y].
 * - Waypoint — A point a connection passes: a bend point (its index in `via`) or a tie's slot.
 * - piece — One cubic piece, out of one point and into the next, flat at both.
 * - waypointsOf — The points a connection passes, left to right: its ties' slots; untied, its bend points.
 * - pathThrough — The `d` of a curve through points: a flat piece to each.
 * - dotsThrough — Points along the same curve, for the line a click or a box can land on.
 * - middleOf — The middle of one piece: the plain middle of its two ends, the piece being symmetric.
 * - handlesOf — The proposed mid-point handle of each piece of an untied connection, and the index it takes.
 */
import type { Bend } from '../data/connector-bends.js';

/** A point on the plane, [x, y]. */
export type Pt = [number, number];

/** A point a connection passes: a bend point (`bend` is its index in `via`) or a tie's slot. */
export interface Waypoint {
  at: Pt;
  bend?: number;
}

/** One cubic piece, out of one point and into the next, flat at both. A bent connection pulls by half the way, so a short piece never overshoots. */
export function piece([x1, y1]: Pt, [x2, y2]: Pt, soft = false): string {
  const bend = soft ? Math.abs(x2 - x1) / 2 : Math.max(40, Math.abs(x2 - x1) / 2);
  return `C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`;
}

/** The points a connection passes, left to right: a tied connect its ties' slots alone, a tie being its handle; an untied one its bend points. */
export function waypointsOf(via: readonly Bend[] | undefined, stops: readonly Pt[]): Waypoint[] {
  const way = stops.length ? stops.map((at): Waypoint => ({ at })) : (via ?? []).map((b, bend): Waypoint => ({ at: [b.x, b.y], bend }));
  return way.sort((p, q) => p.at[0] - q.at[0]);
}

/** The `d` of a curve through points: a flat piece to each. */
export function pathThrough(points: readonly Pt[], soft = false): string {
  return `M ${points[0]![0]} ${points[0]![1]} ${points.slice(1).map((p, i) => piece(points[i]!, p, soft)).join(' ')}`;
}

/** Points along one piece, 17 of them. */
function along([x1, y1]: Pt, [x2, y2]: Pt, soft: boolean): Pt[] {
  const bend = soft ? Math.abs(x2 - x1) / 2 : Math.max(40, Math.abs(x2 - x1) / 2);
  const [c1, c2] = [x1 + bend, x2 - bend];
  return Array.from({ length: 17 }, (_, i) => {
    const t = i / 16;
    const u = 1 - t;
    const at = (a: number, b: number, c: number, d: number): number => u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
    return [at(x1, c1, c2, x2), at(y1, y1, y2, y2)];
  });
}

/** Points along the whole curve, for the line a click or a box can land on. */
export function dotsThrough(points: readonly Pt[], soft = false): Pt[] {
  return points.slice(1).flatMap((p, i) => along(points[i]!, p, soft));
}

/** The middle of one piece: the plain middle of its two ends, the piece being symmetric. */
export function middleOf([x1, y1]: Pt, [x2, y2]: Pt): Pt {
  return [(x1 + x2) / 2, (y1 + y2) / 2];
}

/** The proposed mid-point handle of each piece, left to right, and the index in `via` a point put there takes. A tied connection has none: its ties are its handles. */
export function handlesOf(from: Pt, to: Pt, waypoints: readonly Waypoint[]): { at: Pt; insert: number }[] {
  if (waypoints.some((w) => w.bend === undefined)) return [];
  const points: Pt[] = [from, ...waypoints.map((w) => w.at), to];
  return points.slice(1).map((p, i) => ({ at: middleOf(points[i]!, p), insert: i }));
}
