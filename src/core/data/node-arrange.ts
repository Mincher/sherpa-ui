/**
 * node-arrange.ts — lay picked nodes out on a grid: columns by flow, rows by fewest crossings. Pure: no DOM.
 * Will, TODO 752 · docs/history/plan-752-arrange.md
 *
 * Map:
 * - ArrangeGraph — What a layout reads: the nodes' places, the routes, the ties.
 * - ArrangeOptions — The gaps, the grid, and each node's drawn box.
 * - Arranged — Where each picked node and each tie goes.
 * - crossings — How many pairs of straight lines, centre to centre, cross in a layout.
 * - arrangeNodes — The picked nodes in columns along their routes, rows ordered to cross least, ties centred in the gaps.
 */
import { socketOf, type NodeRoute, type NodeTie } from './node-kinds.js';
import { tieLimit } from './workflow.js';

/** What a layout reads: the nodes' places, the routes, the ties. */
export interface ArrangeGraph {
  nodes: readonly { id: string; x: number; y: number }[];
  routes: readonly NodeRoute[];
  ties?: readonly NodeTie[];
}

/** The gaps, the grid, and each node's drawn box, all in plane px. */
export interface ArrangeOptions {
  gapX: number;
  gapY: number;
  /** Every place is a multiple of it. Default 4. */
  grid?: number;
  boxes: Readonly<Record<string, { w: number; h: number }>>;
}

/** Where each picked node and each tie goes. */
export interface Arranged {
  nodes: Record<string, { x: number; y: number }>;
  ties: Record<string, { x: number; y: number }>;
}

type Spot = { x: number; y: number };
type Box = { w: number; h: number };

/** How many pairs of straight lines, from a node's right edge to the next's left edge at mid height, cross. */
export function crossings(places: Readonly<Record<string, Spot>>, boxes: Readonly<Record<string, Box>>, routes: readonly NodeRoute[]): number {
  const lines = routes.flatMap((r) => {
    const [a, b] = [socketOf(r.from).node, socketOf(r.to).node];
    const [pa, pb, ba, bb] = [places[a], places[b], boxes[a], boxes[b]];
    return pa && pb && ba && bb && a !== b ? [{ a, b, x1: pa.x + ba.w, y1: pa.y + ba.h / 2, x2: pb.x, y2: pb.y + bb.h / 2 }] : [];
  });
  let count = 0;
  for (let i = 0; i < lines.length; i++) for (let j = i + 1; j < lines.length; j++) {
    const [p, q] = [lines[i]!, lines[j]!];
    if (p.a === q.a || p.b === q.b || p.a === q.b || p.b === q.a) continue;
    const side = (x: number, y: number, l: typeof p): number => Math.sign((l.x2 - l.x1) * (y - l.y1) - (l.y2 - l.y1) * (x - l.x1));
    if (side(q.x1, q.y1, p) * side(q.x2, q.y2, p) < 0 && side(p.x1, p.y1, q) * side(p.x2, p.y2, q) < 0) count++;
  }
  return count;
}

/**
 * Lay the picked nodes out: a node's column is its depth along the routes among them, so sources
 * stand left; rows in a column are ordered by a barycentre sweep and the order that crosses least
 * (by the lines drawn) wins, the current order a candidate. Columns are `gapX` apart and rows `gapY`,
 * every place on the grid, the block's top-left where the picked nodes' was. A tie whose routes all
 * join picked nodes stands in the gap before its shortest route's target, equally spaced with its
 * neighbours there, at the mean height of its routes, held inside `tieLimit`. A cycle: its closing
 * route is left out of the depth, so the walk ends. Fewer than two picked: nothing.
 */
export function arrangeNodes(graph: ArrangeGraph, picked: readonly string[], options: ArrangeOptions): Arranged {
  const grid = options.grid ?? 4;
  const up = (n: number): number => Math.ceil(n / grid) * grid;
  const near = (n: number): number => Math.round(n / grid) * grid;
  const at = new Map(graph.nodes.map((n) => [n.id, n]));
  const ids = [...new Set(picked)].filter((id) => at.has(id));
  const out: Arranged = { nodes: {}, ties: {} };
  if (ids.length < 2) return out;
  const box = (id: string): Box => options.boxes[id] ?? { w: 240, h: 120 };
  const mid = (id: string): number => at.get(id)!.y + box(id).h / 2;
  const first = [...ids].sort((a, b) => mid(a) - mid(b) || (a < b ? -1 : 1));
  const set = new Set(ids);
  // The routes among them, once each, with a cycle's closing route left out.
  const all = graph.routes.map((r) => [socketOf(r.from).node, socketOf(r.to).node] as const).filter(([a, b]) => a !== b && set.has(a) && set.has(b));
  const next = new Map<string, string[]>(first.map((id) => [id, []]));
  for (const [a, b] of all) if (!next.get(a)!.includes(b)) next.get(a)!.push(b);
  const state = new Map<string, 1 | 2>();
  const edges: [string, string][] = [];
  const order: string[] = [];
  const walk = (id: string): void => {
    state.set(id, 1);
    for (const to of next.get(id)!) {
      if (state.get(to) === 1) continue;
      edges.push([id, to]);
      if (!state.has(to)) walk(to);
    }
    state.set(id, 2);
    order.push(id);
  };
  for (const id of first) if (!state.has(id)) walk(id);
  const depth = new Map<string, number>(first.map((id) => [id, 0]));
  for (const id of order.reverse()) for (const [a, b] of edges) if (a === id) depth.set(b, Math.max(depth.get(b)!, depth.get(id)! + 1));
  const columns = Math.max(...depth.values()) + 1;
  // One item per node, and one per column a long route crosses, so a sweep sees every line.
  const layers: string[][] = Array.from({ length: columns }, () => []);
  for (const id of first) layers[depth.get(id)!]!.push(id);
  const links: [string, string][] = [];
  for (const [a, b] of edges) {
    let from = a;
    for (let k = depth.get(a)! + 1; k < depth.get(b)!; k++) {
      const dummy = `${a}>${b}@${k}`;
      layers[k]!.push(dummy);
      links.push([from, dummy]);
      from = dummy;
    }
    links.push([from, b]);
  }
  // Candidates: the current order, then each sweep of barycentres, down and up.
  const candidates: string[][][] = [layers.map((l) => [...l])];
  let cur = layers.map((l) => [...l]);
  for (let round = 0; round < 8; round++) {
    const down = round % 2 === 0;
    const range = down ? [...cur.keys()].slice(1) : [...cur.keys()].slice(0, -1).reverse();
    for (const k of range) {
      const pos = new Map(cur[down ? k - 1 : k + 1]!.map((id, i) => [id, i] as const));
      const own = new Map(cur[k]!.map((id, i) => [id, i] as const));
      const key = (id: string): number => {
        const ns = links.flatMap(([a, b]) => (down ? (b === id ? [a] : []) : (a === id ? [b] : []))).map((n) => pos.get(n)!);
        return ns.length ? ns.reduce((s, v) => s + v, 0) / ns.length : own.get(id)!;
      };
      cur[k] = [...cur[k]!].sort((a, b) => key(a) - key(b) || own.get(a)! - own.get(b)! || (a < b ? -1 : 1));
    }
    cur = cur.map((l) => [...l]);
    candidates.push(cur);
  }
  const anchor = { x: near(Math.min(...ids.map((id) => at.get(id)!.x))), y: near(Math.min(...ids.map((id) => at.get(id)!.y))) };
  const place = (lay: readonly (readonly string[])[]): { nodes: Record<string, Spot>; gaps: { left: number; right: number }[] } => {
    const real = lay.map((l) => l.filter((id) => set.has(id)));
    const widths = real.map((l) => Math.max(...l.map((id) => box(id).w)));
    const heights = real.map((l) => l.reduce((s, id, i) => s + (i ? up(options.gapY) : 0) + up(box(id).h), 0));
    const tall = Math.max(...heights);
    const nodes: Record<string, Spot> = {};
    const gaps: { left: number; right: number }[] = [];
    let x = anchor.x;
    real.forEach((l, k) => {
      let y = anchor.y + near((tall - heights[k]!) / 2);
      for (const id of l) {
        nodes[id] = { x, y };
        y += up(box(id).h) + up(options.gapY);
      }
      const right = up(x + widths[k]! + options.gapX);
      gaps.push({ left: x + widths[k]!, right });
      x = right;
    });
    return { nodes, gaps };
  };
  // The order that crosses least by the lines as drawn; the layer count only said which orders to try.
  const layouts = candidates.map(place);
  const boxes = Object.fromEntries(ids.map((id) => [id, box(id)]));
  const lines = edges.map(([from, to]) => ({ from, to }));
  const scored = layouts.map((l) => crossings(l.nodes, boxes, lines));
  const pickIt = scored.indexOf(Math.min(...scored));
  const chosen = layouts[pickIt]!;
  out.nodes = chosen.nodes;
  // Ties: each in the gap before its shortest route's target, equally spaced.
  const sits = new Map<number, NodeTie[]>();
  for (const tie of graph.ties ?? []) {
    const pair = tie.routes.map((r) => [socketOf(r.from).node, socketOf(r.to).node] as const);
    if (!pair.length || !pair.every(([a, b]) => set.has(a) && set.has(b))) continue;
    const col = Math.min(...pair.map(([, b]) => depth.get(b)!));
    if (col < 1) continue;
    sits.set(col, [...(sits.get(col) ?? []), tie]);
  }
  const final = { ...Object.fromEntries(graph.nodes.map((n) => [n.id, { x: n.x, y: n.y }])), ...chosen.nodes };
  const mean = (tie: NodeTie, x?: number): number => {
    const ys = tie.routes.map((r) => {
      const [a, b] = [socketOf(r.from).node, socketOf(r.to).node];
      const [x1, y1, x2, y2] = [final[a]!.x + box(a).w, final[a]!.y + box(a).h / 2, final[b]!.x, final[b]!.y + box(b).h / 2];
      const t = x === undefined || x2 === x1 ? 0.5 : Math.min(1, Math.max(0, (x - x1) / (x2 - x1)));
      return y1 + (y2 - y1) * t;
    });
    return ys.reduce((s, v) => s + v, 0) / ys.length;
  };
  const moved = { nodes: graph.nodes.map((n) => ({ id: n.id, x: final[n.id]!.x })) };
  for (const [col, ties] of sits) {
    const gap = chosen.gaps[col - 1]!;
    const sorted = [...ties].sort((a, b) => mean(a) - mean(b) || (a.id < b.id ? -1 : 1));
    sorted.forEach((tie, i) => {
      const limit = tieLimit(moved, tie);
      const spot = gap.left + ((i + 1) * (gap.right - gap.left)) / (sorted.length + 1);
      const x = Math.round(limit ? Math.min(limit.max, Math.max(limit.min, spot)) : spot);
      out.ties[tie.id] = { x, y: near(mean(tie, x)) };
    });
  }
  return out;
}
