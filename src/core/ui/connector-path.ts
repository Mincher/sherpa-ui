/**
 * connector-path.ts — a connection's curve on the plane: flat cubic pieces from one waypoint to the next. With no
 * bend point it is the default curve. A waypoint is a bend point or, on a tied connection, a zip tie's slot
 * (never both), sorted by x, so the curve is a function of x and never loops back. Pure: no DOM. Will, TODOs 562, 744, 754
 *
 * Map:
 * - Pt — A point on the plane, [x, y].
 * - Waypoint — A point a connection passes: a bend point (its index in `via`) or a tie's slot.
 * - controlsThrough — Each piece's two handles: flat at an end and a tie, smooth at a bend point.
 * - waypointsOf — The points a connection passes, left to right: its ties' slots; untied, its bend points.
 * - pathThrough — The `d` of a curve through points: a cubic piece to each, by its handles.
 * - dotsThrough — Points along the same curve, for the line a click or a box can land on.
 * - middleOf — The middle of one flat piece: the plain middle of its two ends, the piece being symmetric.
 * - handlesOf — The proposed mid-point handle of each piece of an untied connection, and the index it takes.
 * - Obstacle — A node a line must miss, by its box; its radius, half its largest side, is the quick test.
 * - sweepOf — A line's one bend from an Unfurl, or none: the gentlest that misses every node, with its turn.
 */
import type { Bend } from '../data/connector-bends.js';

/** A point on the plane, [x, y]. */
export type Pt = [number, number];

/** A point a connection passes: a bend point (`bend` is its index in `via`, `turn` its handles' turn) or a tie's slot. */
export interface Waypoint {
  at: Pt;
  bend?: number;
  turn?: number;
}

/** Each piece's two handles, out of one point and into the next. An end's and a tie's are flat, a tie's lines passing it side by
 *  side; a bent connection pulls by half the way, so a short piece never overshoots. A bend point's (`smooth`, by index) are one
 *  straight line along the way from the point before to the point after, of one length on both sides: a third of the shorter
 *  reach, and no more than half of each gap in x, so the curve passes without a corner and never loops back (Will, TODO 999).
 *  One an Unfurl set (`turns`, in degrees by index) lies at that turn instead (TODO 1010). TRAP T-a-bend-is-a-smooth-point */
export function controlsThrough(points: readonly Pt[], soft = false, smooth: ReadonlySet<number> = new Set(), turns: ReadonlyMap<number, number> = new Map()): [Pt, Pt][] {
  const along = (i: number): Pt | undefined => {
    if (!smooth.has(i) || i === 0 || i === points.length - 1) return undefined;
    const [p, at, n] = [points[i - 1]!, points[i]!, points[i + 1]!];
    const [dx, dy] = [n[0] - p[0], n[1] - p[1]];
    const way = Math.hypot(dx, dy);
    const turn = turns.get(i);
    const [ux, uy] = turn === undefined ? [dx / (way || 1), dy / (way || 1)] : [Math.cos((turn * Math.PI) / 180), Math.sin((turn * Math.PI) / 180)];
    if (!way || dx <= 0 || ux <= 0) return [0, 0];
    const reach = Math.min(Math.hypot(at[0] - p[0], at[1] - p[1]), Math.hypot(n[0] - at[0], n[1] - at[1])) / 3;
    const room = Math.min(at[0] - p[0], n[0] - at[0]) / 2 / ux;
    const length = Math.max(0, Math.min(reach, room));
    return [ux * length, uy * length];
  };
  return points.slice(1).map((b, i): [Pt, Pt] => {
    const a = points[i]!;
    const flat = soft ? Math.abs(b[0] - a[0]) / 2 : Math.max(40, Math.abs(b[0] - a[0]) / 2);
    const [out, into] = [along(i), along(i + 1)];
    return [out ? [a[0] + out[0], a[1] + out[1]] : [a[0] + flat, a[1]], into ? [b[0] - into[0], b[1] - into[1]] : [b[0] - flat, b[1]]];
  });
}

/** The points a connection passes, left to right: a tied connect its ties' slots alone, a tie being its handle; an untied one its bend points. */
export function waypointsOf(via: readonly Bend[] | undefined, stops: readonly Pt[]): Waypoint[] {
  const way = stops.length ? stops.map((at): Waypoint => ({ at })) : (via ?? []).map((b, bend): Waypoint => ({ at: [b.x, b.y], bend, ...(b.turn === undefined ? {} : { turn: b.turn }) }));
  return way.sort((p, q) => p.at[0] - q.at[0]);
}

/** The `d` of a curve through points: a cubic piece to each, by its handles. */
export function pathThrough(points: readonly Pt[], soft = false, smooth?: ReadonlySet<number>, turns?: ReadonlyMap<number, number>): string {
  const pieces = controlsThrough(points, soft, smooth, turns).map(([c1, c2], i) => `C ${c1[0]} ${c1[1]}, ${c2[0]} ${c2[1]}, ${points[i + 1]![0]} ${points[i + 1]![1]}`);
  return `M ${points[0]![0]} ${points[0]![1]} ${pieces.join(' ')}`;
}

/** A point of one cubic piece, at t from 0 to 1. */
const cubicAt = (a: Pt, [c1, c2]: [Pt, Pt], b: Pt, t: number): Pt => {
  const u = 1 - t;
  const at = (k: 0 | 1): number => u * u * u * a[k] + 3 * u * u * t * c1[k] + 3 * u * t * t * c2[k] + t * t * t * b[k];
  return [at(0), at(1)];
};

/** Points along the whole curve, 17 a piece, for the line a click or a box can land on. */
export function dotsThrough(points: readonly Pt[], soft = false, smooth?: ReadonlySet<number>, turns?: ReadonlyMap<number, number>): Pt[] {
  return controlsThrough(points, soft, smooth, turns).flatMap((handles, i) => Array.from({ length: 17 }, (_, k) => cubicAt(points[i]!, handles, points[i + 1]!, k / 16)));
}

/** The middle of one flat piece: the plain middle of its two ends, the piece being symmetric. */
export function middleOf([x1, y1]: Pt, [x2, y2]: Pt): Pt {
  return [(x1 + x2) / 2, (y1 + y2) / 2];
}

/** The proposed mid-point handle of each piece, left to right, and the index in `via` a point put there takes. A tied connection has none: its ties are its handles. */
export function handlesOf(from: Pt, to: Pt, waypoints: readonly Waypoint[]): { at: Pt; insert: number }[] {
  if (waypoints.some((w) => w.bend === undefined)) return [];
  const points: Pt[] = [from, ...waypoints.map((w) => w.at), to];
  // On the curve as drawn: a piece by a smooth bend is no longer symmetric.
  const smooth = new Set(waypoints.map((_, i) => i + 1));
  return controlsThrough(points, waypoints.length > 0, smooth).map((handles, i) => ({ at: cubicAt(points[i]!, handles, points[i + 1]!, 0.5), insert: i }));
}

/** A node a line must miss, by its box; its radius, half its largest side round its middle, is the quick test. */
export interface Obstacle {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Whether a point is in a node: the quick test by its radius first, then its box. */
const inside = (o: Obstacle, [x, y]: Pt): boolean => {
  const [cx, cy, r] = [(o.left + o.right) / 2, (o.top + o.bottom) / 2, Math.max(o.right - o.left, o.bottom - o.top) / 2];
  return Math.hypot(x - cx, y - cy) <= r && x >= o.left && x <= o.right && y >= o.top && y <= o.bottom;
};

/** How much a bend's place and turn cost against a line's own: px moved, and px a degree its handles turn from the curve's. */
const TURN_COST = 4;

/** The one bend an Unfurl writes on a line from `a` to `b`, or none. A line whose default curve misses every node needs none.
 *  Else, of the bends that miss them all, the gentlest: on the default curve or moved square off it, its handles at the curve's
 *  own turn there or a little off it, the least moved and least turned (`TURN_COST`), so the line sweeps through in one curve
 *  (Will, TODO 1010). None misses: the one that meets the fewest. TRAP T-a-line-sweeps-round-a-node */
export function sweepOf(a: Pt, b: Pt, nodes: readonly Obstacle[], step = 24, far = 800): Bend | undefined {
  const dx = b[0] - a[0];
  if (dx <= 0) return undefined;
  // A dot every few px along each piece: 17 a piece, as a click lands, slip past a node's corner.
  const meets = (points: readonly Pt[], turns?: ReadonlyMap<number, number>): number => {
    const bent = points.length > 2;
    return controlsThrough(points, bent, bent ? new Set([1]) : new Set(), turns).reduce((hits, handles, i) => {
      const [from, to] = [points[i]!, points[i + 1]!];
      const n = Math.max(17, Math.ceil(Math.hypot(to[0] - from[0], to[1] - from[1]) / 6));
      for (let k = 0; k <= n; k++) if (nodes.some((o) => inside(o, cubicAt(from, handles, to, k / n)))) hits++;
      return hits;
    }, 0);
  };
  if (!meets([a, b])) return undefined;
  // The default curve, as `controlsThrough` gives an unbent line: its flat handles.
  const flat = Math.max(40, dx / 2);
  const curve: [Pt, Pt] = [[a[0] + flat, a[1]], [b[0] - flat, b[1]]];
  let best: { at: Pt; turn: number; hit: number; cost: number } | undefined;
  for (let s = 0; s <= far && !(best && !best.hit && s > best.cost); s += step) {
    for (const t of [0.5, 0.4, 0.6, 0.3, 0.7]) {
      const on = cubicAt(a, curve, b, t);
      // The curve's way at t, its derivative: the turn its handles take, and the square it moves along.
      const u = 1 - t;
      const way: Pt = [3 * u * u * (curve[0][0] - a[0]) + 6 * u * t * (curve[1][0] - curve[0][0]) + 3 * t * t * (b[0] - curve[1][0]),
        3 * u * u * (curve[0][1] - a[1]) + 6 * u * t * (curve[1][1] - curve[0][1]) + 3 * t * t * (b[1] - curve[1][1])];
      const length = Math.hypot(way[0], way[1]) || 1;
      const own = Math.round((Math.atan2(way[1], way[0]) * 180) / Math.PI);
      for (const side of s ? [1, -1] : [1]) {
        const at: Pt = [on[0] - (way[1] / length) * s * side, on[1] + (way[0] / length) * s * side];
        if (at[0] <= a[0] + step || at[0] >= b[0] - step) continue;
        for (const off of [0, -10, 10, -20, 20, -30, 30, -40, 40]) {
          const turn = Math.max(-80, Math.min(80, own + off));
          const cost = s + TURN_COST * Math.abs(off) + 200 * Math.abs(t - 0.5);
          if (best && !best.hit && cost >= best.cost) continue;
          const hit = meets([a, at, b], new Map([[1, turn]]));
          if (!best || hit < best.hit || (hit === best.hit && cost < best.cost)) best = { at, turn, hit, cost };
        }
      }
    }
  }
  return best && { x: Math.round(best.at[0]), y: Math.round(best.at[1]), turn: best.turn };
}
