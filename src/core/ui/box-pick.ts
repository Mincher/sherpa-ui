/**
 * box-pick.ts — what a dragged box picks on a canvas's plane: every node it ENCLOSES whole; or,
 * when it encloses no node, every route whose sampled path it CROSSES (a part of a route is
 * enough). Never both (Will, 2026-11-05).
 * Pure geometry: no DOM. Will, TODO 735.
 *
 * Map:
 * - PickBox — A box on the plane, in plane px.
 * - touches — Whether two boxes overlap, an edge's touch included.
 * - encloses — Whether a box holds another whole.
 * - crosses — Whether a path, sampled as points, passes through a box.
 * - boxPick — The nodes a box encloses; else the routes it crosses.
 */

/** A box on the plane, in plane px. */
export interface PickBox { left: number; top: number; right: number; bottom: number }

/** Whether two boxes overlap, an edge's touch included. */
export function touches(a: PickBox, b: PickBox): boolean {
  return a.left <= b.right && b.left <= a.right && a.top <= b.bottom && b.top <= a.bottom;
}

/** Whether the first box holds the second whole, an edge included. */
export function encloses(a: PickBox, b: PickBox): boolean {
  return a.left <= b.left && a.top <= b.top && b.right <= a.right && b.bottom <= a.bottom;
}

/** Whether a segment passes through a box: Liang-Barsky, the segment clipped to the box's four sides. */
function segmentIn(box: PickBox, [ax, ay]: [number, number], [bx, by]: [number, number]): boolean {
  let [t0, t1] = [0, 1];
  const [dx, dy] = [bx - ax, by - ay];
  for (const [p, q] of [[-dx, ax - box.left], [dx, box.right - ax], [-dy, ay - box.top], [dy, box.bottom - ay]] as const) {
    if (p === 0) {
      if (q < 0) return false;
    } else {
      const r = q / p;
      if (p < 0) t0 = Math.max(t0, r);
      else t1 = Math.min(t1, r);
      if (t0 > t1) return false;
    }
  }
  return true;
}

/** Whether a path, sampled as points, passes through a box. */
export function crosses(box: PickBox, dots: readonly [number, number][]): boolean {
  if (dots.length === 1) return touches(box, { left: dots[0]![0], top: dots[0]![1], right: dots[0]![0], bottom: dots[0]![1] });
  return dots.some((dot, i) => i > 0 && segmentIn(box, dots[i - 1]!, dot));
}

/** The nodes a box encloses whole; with none, the routes it crosses. Each in the order given. */
export function boxPick<R>(
  box: PickBox, nodes: Iterable<readonly [string, PickBox]>, lanes: Iterable<{ route: R; dots: readonly [number, number][] }>,
): { nodes: string[]; routes: R[] } {
  const hit = [...nodes].filter(([, b]) => encloses(box, b)).map(([id]) => id);
  if (hit.length) return { nodes: hit, routes: [] };
  return { nodes: [], routes: [...lanes].filter((l) => crosses(box, l.dots)).map((l) => l.route) };
}
