/**
 * node-chain.ts — A CHAIN DRAG'S PULL AND PUSH (⌘ or Ctrl held): the dragged node pulls the nodes it joins along behind it,
 * and theirs behind them, each connector a rope as long as it was (follow-the-leader, Will D1 A), and no two nodes come
 * closer, centre to centre, than their two radii, half each one's largest side (D2 A). A plain drag moves only the nodes
 * held, and pushes none (Will, TODO 974). It changes no data. Pure: no DOM. Plan 918.
 *
 * Map:
 * - ChainNode — One node as a drag reads it: its place and its size, on the plane.
 * - ChainLink — One connector: the two nodes it joins, and where on each its socket is.
 * - ChainDrag — One drag: each node's place now, its connectors, the nodes the reader holds, the nodes it has moved.
 * - radiusOf — A node's radius: half its largest side.
 * - startDrag — A drag begun: the places and sizes, the connectors, the held nodes.
 * - dragTo — The drag a step on: the held nodes where the reader put them; on a chain drag, the rest pulled and pushed.
 */

/** One node as a drag reads it: its place (its top left) and its size, on the plane. */
export interface ChainNode {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** One connector: the two nodes it joins, and where on each its socket is, from that node's top left. */
export interface ChainLink {
  from: string;
  to: string;
  fromAt: readonly [number, number];
  toAt: readonly [number, number];
}

/** A node as the drag moves it: its top left, its half size, its radius. */
interface Placed { x: number; y: number; readonly hw: number; readonly hh: number; readonly r: number }
/** A connector as a rope: its leader is nearer the held nodes, and pulls its follower. */
interface Rope { lead: string; follow: string; leadAt: readonly [number, number]; followAt: readonly [number, number]; length: number; even: boolean }

/** One drag: each node's place now, its connectors, the nodes the reader holds, and the nodes it has moved. */
export interface ChainDrag {
  readonly at: ReadonlyMap<string, Placed>;
  /** Each node's centre as the drag began: a pair that began nearer than their radii may stay as near. */
  readonly began: ReadonlyMap<string, readonly [number, number]>;
  readonly links: readonly ChainLink[];
  readonly held: ReadonlySet<string>;
  /** Each node the drag has moved, by its steps from a held node: the farther of two gives way, so a push goes outward. */
  readonly moved: Map<string, number>;
  /** The ropes, measured as the chain comes on; none while it is off. */
  ropes: Rope[] | null;
}

/** Passes a step takes at most: each pull and push can undo a little of the last. */
const PASSES = 4;
const EPSILON = 0.5;

/** A node's radius: half its largest side. */
export const radiusOf = (size: { w: number; h: number }): number => Math.max(size.w, size.h) / 2;

const centre = (n: Placed): [number, number] => [n.x + n.hw, n.y + n.hh];

/** A drag begun: the places and sizes, the connectors, the held nodes. */
export function startDrag(nodes: readonly ChainNode[], links: readonly ChainLink[], held: Iterable<string>): ChainDrag {
  const at = new Map(nodes.map((n) => [n.id, { x: n.x, y: n.y, hw: n.w / 2, hh: n.h / 2, r: radiusOf(n) }]));
  return {
    at, began: new Map(nodes.map((n) => [n.id, [n.x + n.w / 2, n.y + n.h / 2] as const])),
    links: links.filter((l) => l.from !== l.to && at.has(l.from) && at.has(l.to)),
    held: new Set([...held].filter((id) => at.has(id))), moved: new Map(), ropes: null,
  };
}

/** Each connector as a rope, as long as it is now: led from the end nearer a held node. */
function ropesOf(drag: ChainDrag): Rope[] {
  const depth = new Map([...drag.held].map((id) => [id, 0]));
  const next = new Map<string, string[]>();
  for (const l of drag.links) {
    next.set(l.from, [...(next.get(l.from) ?? []), l.to]);
    next.set(l.to, [...(next.get(l.to) ?? []), l.from]);
  }
  for (let queue = [...drag.held]; queue.length;) {
    const id = queue.shift()!;
    for (const on of next.get(id) ?? []) if (!depth.has(on)) { depth.set(on, depth.get(id)! + 1); queue.push(on); }
  }
  const ropes: Rope[] = [];
  for (const l of drag.links) {
    const [df, dt] = [depth.get(l.from), depth.get(l.to)];
    if (df === undefined || dt === undefined || (drag.held.has(l.from) && drag.held.has(l.to))) continue;
    const forward = df <= dt;
    const [lead, follow, leadAt, followAt] = forward ? [l.from, l.to, l.fromAt, l.toAt] : [l.to, l.from, l.toAt, l.fromAt];
    const [a, b] = [drag.at.get(lead)!, drag.at.get(follow)!];
    const length = Math.hypot(b.x + followAt[0] - a.x - leadAt[0], b.y + followAt[1] - a.y - leadAt[1]);
    ropes.push({ lead, follow, leadAt, followAt, length, even: df === dt });
  }
  return ropes.sort((p, q) => (depth.get(p.lead)! - depth.get(q.lead)!));
}

/** A stretched rope pulls its follower back to its length; a slack one does nothing. True if it moved one. */
function pull(drag: ChainDrag, rope: Rope): boolean {
  const [a, b] = [drag.at.get(rope.lead) as Placed, drag.at.get(rope.follow) as Placed];
  const [gx, gy] = [b.x + rope.followAt[0] - a.x - rope.leadAt[0], b.y + rope.followAt[1] - a.y - rope.leadAt[1]];
  const d = Math.hypot(gx, gy);
  if (d <= rope.length + EPSILON) return false;
  const k = (d - rope.length) / d;
  // Two at one depth, neither held: each goes half way.
  const share = rope.even && !drag.held.has(rope.lead) ? 0.5 : 1;
  b.x -= gx * k * share;
  b.y -= gy * k * share;
  const step = (drag.moved.get(rope.lead) ?? 0) + 1;
  if (!drag.moved.has(rope.follow)) drag.moved.set(rope.follow, step);
  if (share < 1) {
    a.x += gx * k * share;
    a.y += gy * k * share;
    if (!drag.moved.has(rope.lead)) drag.moved.set(rope.lead, step);
  }
  return true;
}

/** Every moved node pushes any node nearer than their radii away, and that one pushes on. True if it moved one. */
function push(drag: ChainDrag): boolean {
  let reach = 0;
  for (const n of drag.at.values()) reach = Math.max(reach, n.r);
  const cell = Math.max(2 * reach, 1);
  const grid = new Map<string, string[]>();
  const key = (x: number, y: number): string => `${Math.floor(x / cell)},${Math.floor(y / cell)}`;
  for (const [id, n] of drag.at) {
    const [cx, cy] = centre(n);
    const k = key(cx, cy);
    grid.set(k, [...(grid.get(k) ?? []), id]);
  }
  let changed = false;
  for (const id of [...drag.moved.keys()]) {
    const a = drag.at.get(id)!;
    const [ax, ay] = centre(a);
    const [gx, gy] = [Math.floor(ax / cell), Math.floor(ay / cell)];
    for (let i = gx - 1; i <= gx + 1; i++) for (let j = gy - 1; j <= gy + 1; j++) for (const other of grid.get(`${i},${j}`) ?? []) {
      if (other === id || (drag.held.has(id) && drag.held.has(other))) continue;
      const b = drag.at.get(other)!;
      const [bx, by] = centre(b);
      const [sa, sb] = [drag.began.get(id)!, drag.began.get(other)!];
      const nearest = Math.min(a.r + b.r, Math.hypot(sb[0] - sa[0], sb[1] - sa[1]));
      const d = Math.hypot(bx - ax, by - ay);
      if (d >= nearest - EPSILON) continue;
      const [ux, uy] = d > 0 ? [(bx - ax) / d, (by - ay) / d] : [1, 0];
      const gap = nearest - d;
      // A held node is never pushed, and a still one is pushed all the way; of two moved ones, the one farther from a
      // held node gives way, and two as far go half each.
      const [ra, rb] = [drag.held.has(id) ? 0 : drag.moved.get(id)!, drag.held.has(other) ? 0 : drag.moved.get(other) ?? Infinity];
      const [moveA, moveB] = ra > rb ? [1, 0] : ra < rb ? [0, 1] : [0.5, 0.5];
      a.x -= ux * gap * moveA;
      a.y -= uy * gap * moveA;
      b.x += ux * gap * moveB;
      b.y += uy * gap * moveB;
      if (!drag.moved.has(other)) drag.moved.set(other, ra + 1);
      changed = true;
    }
  }
  return changed;
}

/** The drag a step on: each held node where the reader put it; on a chain drag (`chain`), the rest pulled and pushed, and
 *  on a plain one, none (TODO 974). Every node the drag has moved, where it is now, in whole px: one put back where it
 *  began is still named. */
export function dragTo(drag: ChainDrag, to: Readonly<Record<string, { x: number; y: number }>>, chain: boolean): Record<string, { x: number; y: number }> {
  // The ropes are as long as the connectors are when the chain comes on; off, they go, and are measured again.
  if (!chain) drag.ropes = null;
  else drag.ropes ??= ropesOf(drag);
  for (const [id, p] of Object.entries(to)) {
    const n = drag.at.get(id) as Placed | undefined;
    if (!n || !drag.held.has(id)) continue;
    n.x = p.x;
    n.y = p.y;
    drag.moved.set(id, 0);
  }
  for (let pass = 0; chain && pass < PASSES; pass++) {
    let changed = false;
    for (const rope of drag.ropes ?? []) changed = pull(drag, rope) || changed;
    changed = push(drag) || changed;
    if (!changed) break;
  }
  return Object.fromEntries([...drag.moved.keys()].map((id) => {
    const n = drag.at.get(id)!;
    return [id, { x: Math.round(n.x), y: Math.round(n.y) }];
  }));
}
