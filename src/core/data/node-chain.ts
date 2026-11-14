/**
 * node-chain.ts — A CHAIN DRAG'S PULL AND PUSH (⌘ or Ctrl held): each node joined to a dragged one, through any number of
 * connectors, moves by the drag times a weight that falls off with its distance along them, 1 / (1 + d / 240) by px or
 * 1 / (1 + d) by connectors (Will, TODO 975), and no two nodes come closer, centre to centre, than their two radii, half
 * each one's largest side (plan 918 D2 A). A plain drag moves only the nodes held, and pushes none (Will, TODO 974). It
 * changes no data. Pure: no DOM.
 *
 * Map:
 * - ChainNode — One node as a drag reads it: its place and its size, on the plane.
 * - ChainLink — One connector: the two nodes it joins, and where on each its socket is.
 * - ChainFalloff — What a chain drag's pull falls off by: the distance along the connectors, or how many there are.
 * - CHAIN_REACH — The distance, in plane px, at which a chain drag pulls a node half as far as the drag.
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

/** What a chain drag's pull falls off by: the distance along the connectors, in px, or how many there are (TODO 975). */
export type ChainFalloff = 'distance' | 'connections';

/** The distance, in plane px, at which a chain drag pulls a node half as far as the drag: a node's width. */
export const CHAIN_REACH = 240;

/** A node as the drag moves it: its top left, its half size, its radius. */
interface Placed { x: number; y: number; readonly hw: number; readonly hh: number; readonly r: number }
/** A chain's pull, measured as it comes on: each pulled node's place then, its weight, and the held node it follows. */
interface Pull { readonly from: ReadonlyMap<string, [number, number]>; readonly weight: ReadonlyMap<string, number>; readonly lead: ReadonlyMap<string, string> }

/** One drag: each node's place now, its connectors, the nodes the reader holds, and the nodes it has moved. */
export interface ChainDrag {
  readonly at: ReadonlyMap<string, Placed>;
  /** Each node's centre as the drag began: a pair that began nearer than their radii may stay as near. */
  readonly began: ReadonlyMap<string, readonly [number, number]>;
  readonly links: readonly ChainLink[];
  readonly held: ReadonlySet<string>;
  /** Each node the drag has moved, by its connectors from a held node: the farther of two gives way, so a push goes outward. */
  readonly moved: Map<string, number>;
  /** The pull, measured as the chain comes on; none while it is off. */
  pull: Pull | null;
}

/** Passes a step's push takes at most: each push can undo a little of the last. */
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
    held: new Set([...held].filter((id) => at.has(id))), moved: new Map(), pull: null,
  };
}

/** The pull as it stands now: each node joined to a held one, by its shortest way along the connectors (centre to centre,
 *  or one a connector), its weight, and the held node nearest it. */
function pullOf(drag: ChainDrag, by: ChainFalloff): Pull {
  const next = new Map<string, string[]>();
  for (const l of drag.links) {
    next.set(l.from, [...(next.get(l.from) ?? []), l.to]);
    next.set(l.to, [...(next.get(l.to) ?? []), l.from]);
  }
  const length = (a: string, b: string): number => {
    if (by === 'connections') return 1;
    const [p, q] = [centre(drag.at.get(a)!), centre(drag.at.get(b)!)];
    return Math.hypot(q[0] - p[0], q[1] - p[1]);
  };
  // The shortest way from any held node: the nearest node not yet settled, each round.
  const far = new Map([...drag.held].map((id) => [id, 0]));
  const lead = new Map([...drag.held].map((id) => [id, id]));
  const hops = new Map([...drag.held].map((id) => [id, 0]));
  const settled = new Set<string>();
  for (;;) {
    let id: string | undefined;
    for (const [k, d] of far) if (!settled.has(k) && (id === undefined || d < far.get(id)!)) id = k;
    if (id === undefined) break;
    settled.add(id);
    for (const on of next.get(id) ?? []) {
      const d = far.get(id)! + length(id, on);
      if (drag.held.has(on) || d >= (far.get(on) ?? Infinity)) continue;
      far.set(on, d);
      lead.set(on, lead.get(id)!);
      hops.set(on, hops.get(id)! + 1);
    }
  }
  const reach = by === 'connections' ? 1 : CHAIN_REACH;
  const pulled = [...far.keys()].filter((id) => !drag.held.has(id));
  for (const id of pulled) drag.moved.set(id, Math.min(drag.moved.get(id) ?? Infinity, hops.get(id)!));
  return {
    from: new Map([...far.keys()].map((id) => { const n = drag.at.get(id)!; return [id, [n.x, n.y]]; })),
    weight: new Map(pulled.map((id) => [id, 1 / (1 + far.get(id)! / reach)])),
    lead: new Map(pulled.map((id) => [id, lead.get(id)!])),
  };
}

/** Each pulled node at its place when the chain came on, plus its held node's move since, times its weight. */
function pullAll(drag: ChainDrag, pull: Pull): void {
  for (const [id, w] of pull.weight) {
    const lead = pull.lead.get(id)!;
    const [[bx, by], [lx, ly]] = [pull.from.get(id)!, pull.from.get(lead)!];
    const [held, n] = [drag.at.get(lead)!, drag.at.get(id) as Placed];
    n.x = bx + (held.x - lx) * w;
    n.y = by + (held.y - ly) * w;
  }
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

/** The drag a step on: each held node where the reader put it; on a chain drag (`chain`), the rest pulled, by `falloff`,
 *  and pushed, and on a plain one, none (TODO 974). The pull is measured as the chain comes on, so a drag's way there does
 *  not change where it ends. Every node the drag has moved, where it is now, in whole px: one put back where it began is
 *  still named. */
export function dragTo(drag: ChainDrag, to: Readonly<Record<string, { x: number; y: number }>>, chain: boolean, falloff: ChainFalloff = 'distance'): Record<string, { x: number; y: number }> {
  if (!chain) drag.pull = null;
  else drag.pull ??= pullOf(drag, falloff);
  for (const [id, p] of Object.entries(to)) {
    const n = drag.at.get(id) as Placed | undefined;
    if (!n || !drag.held.has(id)) continue;
    n.x = p.x;
    n.y = p.y;
    drag.moved.set(id, 0);
  }
  if (drag.pull) pullAll(drag, drag.pull);
  for (let pass = 0; chain && pass < PASSES; pass++) if (!push(drag)) break;
  return Object.fromEntries([...drag.moved.keys()].map((id) => {
    const n = drag.at.get(id)!;
    return [id, { x: Math.round(n.x), y: Math.round(n.y) }];
  }));
}
