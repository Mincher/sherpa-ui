/**
 * connector-bends.ts — a connection's BEND POINTS: the list `via` a reader's drag adds to a connection, in plane px,
 * sorted by x. Only a point the reader moved is one; a tied connection has none. Pure: no DOM.
 * Will, TODOs 744, 754 · docs/history/plan-744-connector-handles.md
 *
 * Map:
 * - Bend — One bend point: a place on the plane.
 * - bendFault — What is wrong with a bend list, in words; none, it is a good one.
 * - placeBend — A bend list with a point moved, or put in at an index; sorted by x, and the point's new index.
 * - dropBend — A bend list without the point at an index; none left, none.
 * - BEND_INSET — How far inside a connector's two end sockets a bend point stays, in px: the last piece is never vertical.
 * - BEND_GAP — The least gap between two bend points, in px.
 * - clampBend — The x a bend point may take: between the end sockets, and between its neighbours.
 * - clampedVia — A bend list held inside its end sockets and apart, as drawn; the saved list is not rewritten.
 * - withoutBends — A connection as it was before any bend: its two ends.
 */
import type { NodeConnection } from './node-kinds.js';

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

/** How far inside a connector's two end sockets a bend point stays, in px: the last piece is never vertical. */
export const BEND_INSET = 16;
/** The least gap between two bend points, in px. */
export const BEND_GAP = 8;

const hold = (x: number, lo: number, hi: number): number => (hi < lo ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, x)));

/** The x a bend point may take: inside the end sockets, and between its neighbours in `via`. */
export function clampBend(ends: { from: number; to: number }, via: readonly Bend[] | undefined, index: number, x: number, insert = false): number {
  const list = via ?? [];
  const before = index > 0 ? [list[index - 1]!.x] : [];
  const after = list[insert ? index : index + 1] ? [list[insert ? index : index + 1]!.x] : [];
  const lo = Math.max(ends.from + BEND_INSET, ...before.map((n) => n + BEND_GAP));
  const hi = Math.min(ends.to - BEND_INSET, ...after.map((n) => n - BEND_GAP));
  return Math.round(hold(x, lo, hi));
}

/** A bend list held inside its end sockets and apart, as drawn: a node moved later never leaves a loop-back. The saved list is not rewritten. */
export function clampedVia(via: readonly Bend[], ends: { from: number; to: number }): Bend[] {
  const [min, max] = [ends.from + BEND_INSET, ends.to - BEND_INSET];
  const out = via.map((p) => ({ x: hold(p.x, min, max), y: p.y }));
  for (let i = 1; i < out.length; i++) out[i]!.x = Math.max(out[i]!.x, out[i - 1]!.x + BEND_GAP);
  for (let i = out.length - 2; i >= 0; i--) out[i]!.x = Math.min(out[i]!.x, out[i + 1]!.x - BEND_GAP);
  return out.map((p, i) => (p.x === via[i]!.x ? via[i]! : p));
}

/** A connection as it was before any bend: its two ends. */
export function withoutBends({ from, to }: NodeConnection): NodeConnection {
  return { from, to };
}
