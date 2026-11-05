/**
 * route-bends.ts — a route's BEND POINTS: the list `via` a reader's drag adds to a route, in plane px,
 * sorted by x. Pure: no DOM. Will, TODO 744 · docs/history/plan-744-connector-handles.md
 *
 * Map:
 * - Bend — One bend point: a place on the plane.
 * - bendFault — What is wrong with a bend list, in words; none, it is a good one.
 * - placeBend — A bend list with a point moved, or put in at an index; sorted by x, and the point's new index.
 * - dropBend — A bend list without the point at an index; none left, none.
 * - withoutBends — A route as it was before any bend: its two ends.
 */
import type { NodeRoute } from './node-kinds.js';

/** One bend point: a place on the plane. */
export interface Bend {
  x: number;
  y: number;
}

/** What is wrong with a bend list, in words; none, it is a good one: points that are real, sorted by x. */
export function bendFault(via: unknown): string | undefined {
  if (!Array.isArray(via) || !via.length) return 'its bend points are not a list of one or more points';
  if (!via.every((p) => p && Number.isFinite((p as Bend).x) && Number.isFinite((p as Bend).y))) return 'a bend point needs a finite x and y';
  if (via.some((p, i) => i > 0 && (p as Bend).x < (via[i - 1] as Bend).x)) return 'its bend points are not in order from left to right';
  return undefined;
}

/** A bend list with the point at an index moved, or (insert) a new point put in there; sorted by x. `at` is where the point is after. */
export function placeBend(via: readonly Bend[] | undefined, index: number, x: number, y: number, insert = false): { via: Bend[]; at: number } {
  const list = [...(via ?? [])];
  const point = { x: Math.round(x), y: Math.round(y) };
  if (insert) list.splice(Math.max(0, Math.min(index, list.length)), 0, point);
  else list[index] = point;
  const sorted = list.map((p, i) => ({ p, i })).sort((a, b) => a.p.x - b.p.x || a.i - b.i);
  const target = insert ? Math.max(0, Math.min(index, list.length - 1)) : index;
  return { via: sorted.map(({ p }) => p), at: sorted.findIndex(({ i }) => i === target) };
}

/** A bend list without the point at an index; none left, none. */
export function dropBend(via: readonly Bend[] | undefined, index: number): Bend[] | undefined {
  const left = (via ?? []).filter((_, i) => i !== index);
  return left.length ? left : undefined;
}

/** A route as it was before any bend: its two ends. */
export function withoutBends({ from, to }: NodeRoute): NodeRoute {
  return { from, to };
}
