/**
 * node-unfurl.ts — UNFURL a graph: every node round its part's most connected one, inputs fanning left and outputs
 * right, each nearer or farther by its weight, none overlapping, every line left to right; a node's neighbours in the
 * order of the sockets they join. A frame moves whole. Pure: no DOM. Will, TODOs 569, 827 ·
 * docs/history/plan-569-unfurl.md · TRAP T-unfurl-keeps-the-flow
 *
 * Map:
 * - UnfurlGraph — What an unfurl reads: the nodes' places and stages, the connections, the ties, the frames and the stages.
 * - UnfurlOptions — The gaps, the grid, each node's drawn box and socket heights, and a frame's box past its nodes'.
 * - unfurlNodes — Every node round its part's anchor, by rings, weights and sockets, crossing least; each in its stage.
 */
import { crossings, type Arranged, type SocketHeights } from './node-arrange.js';
import { socketOf, type NodeConnection, type NodeTie } from './node-kinds.js';
import type { NodeFrame } from './node-frames.js';
import { STAGE_PAD, restage, stageBands, stageOf, type NodeStage } from './node-stages.js';
import { TIE_GAP, holdTies } from './workflow.js';

/** What an unfurl reads: the nodes' places and stages, the connections, the ties, the frames and the stages. */
export interface UnfurlGraph {
  nodes: readonly { id: string; x: number; y: number; stage?: string }[];
  connections: readonly NodeConnection[];
  ties?: readonly NodeTie[];
  frames?: readonly NodeFrame[];
  /** Hidden joins that draw no line, each a node to the node it hands on to (a Portal In to its Outs): they hold the flow
   *  left to right as a connection does, so a pair never flips the order. TODO 839 */
  hops?: readonly { from: string; to: string }[];
  /** A node that stands by its end of the graph: `left` (a Source, a Portal In), `right` (an Output, a Portal Out). */
  bands?: Readonly<Record<string, 'left' | 'right'>>;
  /** The stages, left to right: each node is laid out inside its own stage's band (TODO 950). None, as one graph. */
  stages?: readonly NodeStage[];
}

/** The gaps, the grid, each node's drawn box, and a frame's box past its nodes', all in plane px. */
export interface UnfurlOptions {
  gapX: number;
  gapY: number;
  /** Every place is a multiple of it. Default 4. */
  grid?: number;
  boxes: Readonly<Record<string, { w: number; h: number }>>;
  /** A frame's header and pad above its nodes, and its pad on the other sides. Default none. */
  frameMargin?: { top: number; side: number };
  /** Each socket's height in its node, as drawn: a node's neighbours stand in the order of the sockets they join
   *  (Will, TODO 827). A socket not given sits at mid height. */
  sockets?: SocketHeights;
}

/** The barycentre sweeps out and back; the centroid pulls; a ring's arc, each way from level; how far out a ring's
 *  middle bulges, by its height; a cell's reach out by its weight. */
const ROUNDS = 4;
const PULLS = 24;
const ARC = Math.PI / 3;
const BULGE = 8;
const REACH = 0.5;

/** One cell: a node, or a frame and its nodes, each at its offset in the cell's box; or a TIE, no node in it, at its middle. */
interface Cell { key: string; w: number; h: number; members: { id: string; dx: number; dy: number }[]; tie?: { x: number; y: number } }
/** A tie's cell: the bar's width, and its slots' top and step down it. */
const TIE_W = 4;
const TIE_TOP = 8;
/** One connection or more between two cells, in their main direction, and the topmost socket each joins them by. */
interface Link { s: number; t: number; m: number; ps: number; pt: number }
/** A link as one of its cells sees it: the other cell, its socket on this one (`port`) and on the other (`far`). */
interface Edge { to: number; m: number; down: boolean; port: number; far: number }

/** The heights nearest `want` (by weight), in order, each at least its gap below the one before. */
function project(want: readonly number[], weight: readonly number[], gap: readonly number[]): number[] {
  const at = [0];
  for (let i = 1; i < want.length; i++) at.push(at[i - 1]! + gap[i - 1]!);
  // Pool the adjacent violators of `want - at`: each pool sits at its weighted mean.
  const pools: { v: number; w: number; n: number }[] = [];
  want.forEach((v, i) => {
    let pool = { v: v - at[i]!, w: weight[i]!, n: 1 };
    while (pools.length && pools.at(-1)!.v > pool.v) {
      const last = pools.pop()!;
      pool = { v: (last.v * last.w + pool.v * pool.w) / (last.w + pool.w), w: last.w + pool.w, n: last.n + pool.n };
    }
    pools.push(pool);
  });
  const out: number[] = [];
  for (const pool of pools) for (let k = 0; k < pool.n; k++) out.push(pool.v + at[out.length]!);
  return out;
}

/**
 * Every node of `ids` laid out round its part's ANCHOR, the cell with the most connection ends (its weight squared, as
 * Will said). Each cell has a ring by the flow: the anchor's outputs ring 1, its inputs ring −1, every connection going
 * to a higher ring. Each ring is ordered by its neighbours' barycentre; each cell pulled to its neighbours' weighted
 * centroid in height, in its ring's order and gaps; each ring an arc round the anchor, a cell farther out as its
 * weight nears its heaviest neighbour's; then each moved out in x past its sources and anything in its height band.
 * A neighbour is read at the socket it joins, the topmost where several connections join two nodes (Will, TODO 827): the
 * cells that hang from one cell stand on their ring in its sockets' order, and each line is pulled level; then the
 * order whose lines cross least, socket to socket, wins. A frame is one cell, so its nodes keep their column. The MAIN part
 * (the most nodes) keeps its anchor's place; every other part and lone node but a Source stack on its left, top to bottom as
 * they stood, lone Sources left of them; every place on the grid. A TIE is a cell of no width that its connections pass through,
 * at their slots: it stands in the flow, what feeds it on its left and what it feeds on its right, in its slots' order, and a
 * tie of many connections is the anchor, keeping its place (Will, TODO 888). A tie it cannot hold so (a connection ends outside the
 * moved nodes, or in one cell) goes to its connections' middle if they all moved. Each held by `tieLimit`. In STAGES (TODO 950),
 * each stage's nodes stand in its own band, the main part's as laid and a stack of its own, the stages left to right as
 * `stageBands` packs them, the first stage where it stood: each stage's left edge comes back in `stages`. Fewer than two: nothing.
 */
export function unfurlNodes(graph: UnfurlGraph, ids: readonly string[], options: UnfurlOptions): Arranged {
  const grid = options.grid ?? 4;
  const { gapX, gapY } = options;
  const margin = options.frameMargin ?? { top: 0, side: 0 };
  const near = (n: number): number => Math.round(n / grid) * grid;
  const at = new Map(graph.nodes.map((n) => [n.id, n]));
  const picked = [...new Set(ids)].filter((id) => at.has(id)).sort();
  const out: Arranged = { nodes: {}, ties: {} };
  if (picked.length < 2) return out;
  const box = (id: string): { w: number; h: number } => options.boxes[id] ?? { w: 240, h: 120 };
  const boxes = Object.fromEntries(picked.map((id) => [id, box(id)]));
  // Cells: a frame is one, its nodes at their offsets; every other node its own.
  const cells: Cell[] = [];
  const cellOf = new Map<string, number>();
  for (const frame of [...(graph.frames ?? [])].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    const members = frame.nodes.filter((id) => picked.includes(id) && !cellOf.has(id));
    if (!members.length) continue;
    const left = Math.min(...members.map((id) => at.get(id)!.x)), top = Math.min(...members.map((id) => at.get(id)!.y));
    const right = Math.max(...members.map((id) => at.get(id)!.x + box(id).w)), bottom = Math.max(...members.map((id) => at.get(id)!.y + box(id).h));
    for (const id of members) cellOf.set(id, cells.length);
    cells.push({ key: frame.id, w: right - left + 2 * margin.side, h: bottom - top + margin.top + margin.side,
      members: members.map((id) => ({ id, dx: at.get(id)!.x - left + margin.side, dy: at.get(id)!.y - top + margin.top })) });
  }
  for (const id of picked) if (!cellOf.has(id)) { cellOf.set(id, cells.length); cells.push({ key: id, ...box(id), members: [{ id, dx: 0, dy: 0 }] }); }
  // A TIE whose every connection joins two moved cells: a cell its connections pass through, slot by slot. Will, TODO 888
  const tieCell = new Map<string, number>();
  const through = new Map<string, { cell: number; slot: number; x: number }[]>();
  const key = (r: NodeConnection): string => `${r.from}>${r.to}`;
  for (const tie of [...(graph.ties ?? [])].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    const ends = tie.connections.map((r) => [cellOf.get(socketOf(r.from).node), cellOf.get(socketOf(r.to).node)]);
    if (!ends.length || ends.some(([a, b]) => a === undefined || b === undefined || a === b)) continue;
    tieCell.set(tie.id, cells.length);
    tie.connections.forEach((r, slot) => through.set(key(r), [...(through.get(key(r)) ?? []), { cell: cells.length, slot, x: tie.x }]));
    cells.push({ key: `#tie:${tie.id}`, w: TIE_W, h: (tie.connections.length - 1) * TIE_GAP + 2 * TIE_TOP, members: [], tie: { x: tie.x, y: tie.y } });
  }
  // A socket's height in its cell: its node's offset there, and its own height in the node, else mid height.
  const offset = new Map(cells.flatMap((cell) => cell.members.map((m) => [m.id, m.dy] as const)));
  const heightOf = (address: string, heights: SocketHeights['inputs'] | undefined): number => {
    const id = socketOf(address).node;
    return offset.get(id)! + (heights?.[address] ?? box(id).h / 2);
  };
  // Weights: each connection end, so several connections on one socket count each. A connection inside one cell counts for none.
  // Several connections between two cells: the topmost socket on each decides (Will, TODO 827).
  const n = cells.length;
  const weight = new Array<number>(n).fill(0);
  const pairs = new Map<number, { a: number; b: number; m: number; ab: number; pa: number; pb: number }>();
  // A hop holds the order as a connection does, with no line to cross or to read at a socket. A connection through ties is a piece
  // to each, left to right, and one on: at a tie, its slot is its socket.
  const pieces: { a: number; b: number; out: number; into: number }[] = [];
  for (const r of [...graph.connections, ...(graph.hops ?? [])]) {
    const [a, b] = [cellOf.get(socketOf(r.from).node), cellOf.get(socketOf(r.to).node)];
    if (a === undefined || b === undefined || a === b) continue;
    const stops = [...(through.get(key(r)) ?? [])].sort((p, q) => p.x - q.x).map((t) => ({ cell: t.cell, at: TIE_TOP + t.slot * TIE_GAP }));
    const ends = [{ cell: a, at: heightOf(r.from, options.sockets?.outputs) }, ...stops, { cell: b, at: heightOf(r.to, options.sockets?.inputs) }];
    for (let i = 1; i < ends.length; i++) pieces.push({ a: ends[i - 1]!.cell, b: ends[i]!.cell, out: ends[i - 1]!.at, into: ends[i]!.at });
  }
  for (const { a, b, out, into } of pieces) {
    weight[a]!++;
    weight[b]!++;
    const [lo, hi] = a < b ? [a, b] : [b, a];
    const pair = pairs.get(lo * n + hi) ?? { a: lo, b: hi, m: 0, ab: 0, pa: Infinity, pb: Infinity };
    pair.m++;
    if (a === lo) pair.ab++;
    pair.pa = Math.min(pair.pa, a === lo ? out : into);
    pair.pb = Math.min(pair.pb, a === lo ? into : out);
    pairs.set(lo * n + hi, pair);
  }
  const links: Link[] = [...pairs.entries()].sort((p, q) => p[0] - q[0])
    .map(([, p]) => (2 * p.ab >= p.m ? { s: p.a, t: p.b, m: p.m, ps: p.pa, pt: p.pb } : { s: p.b, t: p.a, m: p.m, ps: p.pb, pt: p.pa }));
  const adj = Array.from({ length: n }, () => [] as Edge[]);
  for (const l of links) {
    adj[l.s]!.push({ to: l.t, m: l.m, down: true, port: l.ps, far: l.pt });
    adj[l.t]!.push({ to: l.s, m: l.m, down: false, port: l.pt, far: l.ps });
  }
  const byKey = (a: number, b: number): number => (cells[a]!.key < cells[b]!.key ? -1 : cells[a]!.key > cells[b]!.key ? 1 : a - b);
  // Parts: the cells connections join.
  const part = new Array<number>(n).fill(-1);
  const parts: number[][] = [];
  for (let s = 0; s < n; s++) {
    if (part[s]! >= 0) continue;
    const list = [s];
    part[s] = parts.length;
    for (let i = 0; i < list.length; i++) for (const e of adj[list[i]!]!) if (part[e.to]! < 0) { part[e.to] = parts.length; list.push(e.to); }
    parts.push(list);
  }
  const placesOf = (list: readonly number[], x: ReadonlyMap<number, number>, y: ReadonlyMap<number, number>): Record<string, { x: number; y: number }> =>
    Object.fromEntries(list.flatMap((c) => cells[c]!.members.map((m) => [m.id, { x: x.get(c)! - cells[c]!.w / 2 + m.dx, y: y.get(c)! - cells[c]!.h / 2 + m.dy }])));

  /** One part round its anchor, each cell's centre with the anchor's at 0, 0. */
  const unfurlPart = (list: readonly number[]): { anchor: number; list: readonly number[]; x: Map<number, number>; y: Map<number, number> } => {
    const anchor = [...list].sort((a, b) => weight[b]! - weight[a]! || adj[b]!.length - adj[a]!.length || byKey(a, b))[0]!;
    const pull = (c: number): number => (c === anchor ? weight[c]! * weight[c]! : Math.max(1, weight[c]!));
    // Generations out from the anchor; each a ring past its parent's, right if the parent sends to it, left if it sends to the parent.
    const prefer = new Map([[anchor, 0]]);
    // Each cell's parent, the one that reached it first: the cell it hangs from, on which side, by which socket.
    const parent = new Map<number, { p: number; down: boolean; port: number }>();
    const order = [anchor];
    for (let i = 0; i < order.length; i++) {
      const c = order[i]!;
      const next = [...adj[c]!].sort((p, q) => q.m - p.m || weight[q.to]! - weight[p.to]! || p.port - q.port || byKey(p.to, q.to));
      for (const e of next) {
        if (prefer.has(e.to)) continue;
        prefer.set(e.to, prefer.get(c)! + (e.down ? 1 : -1));
        order.push(e.to);
        parent.set(e.to, { p: c, down: e.down, port: e.port });
      }
    }
    // The connections the flow holds: a loop's closing connection is left out, as Arrange leaves it.
    const into = new Map(list.map((c) => [c, [] as number[]])), from = new Map(list.map((c) => [c, [] as number[]]));
    const state = new Map<number, 1 | 2>();
    const walk = (c: number): void => {
      state.set(c, 1);
      for (const e of adj[c]!) {
        if (!e.down || state.get(e.to) === 1) continue;
        into.get(e.to)!.push(c);
        from.get(c)!.push(e.to);
        if (!state.has(e.to)) walk(e.to);
      }
      state.set(c, 2);
    };
    for (const c of order) if (!state.has(c)) walk(c);
    // Valid rings: the longest path from the sources, then each cell as near its own ring as its connections let it.
    const ring = new Map<number, number>();
    const depth = new Map<number, number>();
    const deep = (c: number): number => {
      if (!depth.has(c)) depth.set(c, Math.max(0, ...into.get(c)!.map((s) => deep(s) + 1)));
      return depth.get(c)!;
    };
    for (const c of list) ring.set(c, deep(c) - deep(anchor));
    for (let pass = 0, moved = true; moved && pass < list.length; pass++) {
      moved = false;
      for (const c of order) {
        if (c === anchor) continue;
        const lo = Math.max(-Infinity, ...into.get(c)!.map((s) => ring.get(s)! + 1));
        const hi = Math.min(Infinity, ...from.get(c)!.map((t) => ring.get(t)! - 1));
        const v = Math.min(hi, Math.max(lo, prefer.get(c)!));
        if (v !== ring.get(c)) { ring.set(c, v); moved = true; }
      }
    }
    const rings = [...new Set(ring.values())].sort((a, b) => a - b);
    const right = rings.filter((r) => r > 0), left = rings.filter((r) => r < 0).reverse();
    const layers = new Map(rings.map((r) => [r, [] as number[]]));
    for (const c of order) layers.get(ring.get(c)!)!.push(c);
    // Orders: by the barycentre of the neighbours nearer the anchor going out, and farther coming back, each neighbour
    // read at the socket the line joins it by, so those it sends to or hears from stand in its sockets' order. Each new one a candidate.
    const pos = new Map<number, number>();
    const index = (l: readonly number[]): void => l.forEach((c, i) => pos.set(c, l.length > 1 ? i / (l.length - 1) : 0.5));
    for (const l of layers.values()) index(l);
    const slot = (c: number): number => 1 / Math.max(1, layers.get(ring.get(c)!)!.length - 1);
    const atSocket = (e: Edge): number => pos.get(e.to)! + (e.far / cells[e.to]!.h - 0.5) * slot(e.to);
    const sweep = (rs: readonly number[], inward: boolean): void => {
      for (const r of rs) {
        const l = layers.get(r)!;
        const key = new Map(l.map((c) => {
          const ns = adj[c]!.filter((e) => ring.get(e.to) !== r && (inward ? Math.abs(ring.get(e.to)!) < Math.abs(r) : Math.abs(ring.get(e.to)!) > Math.abs(r)));
          const sum = ns.reduce((s, e) => s + e.m, 0);
          return [c, sum ? ns.reduce((s, e) => s + atSocket(e) * e.m, 0) / sum : pos.get(c)!];
        }));
        l.sort((a, b) => key.get(a)! - key.get(b)! || pos.get(a)! - pos.get(b)! || byKey(a, b));
        index(l);
      }
    };
    const outward = [0, ...right, ...left], back = [...[...right].reverse(), ...[...left].reverse(), 0];
    const seen = new Set<string>();
    const candidates: Map<number, number[]>[] = [];
    // Will's order, in every candidate: the cells that hang from one cell, on one side of it, take their own slots on
    // their ring in the order of its sockets; nothing else moves. TODO 827
    const inSocketOrder = (): Map<number, number[]> => new Map([...layers].map(([r, l]) => {
      const next = [...l];
      const groups = new Map<string, number[]>();
      l.forEach((c, i) => {
        const up = parent.get(c);
        if (up) groups.set(`${up.p}|${up.down}`, [...(groups.get(`${up.p}|${up.down}`) ?? []), i]);
      });
      for (const slots of groups.values()) {
        const dealt = [...slots].sort((i, j) => parent.get(l[i]!)!.port - parent.get(l[j]!)!.port || i - j);
        slots.forEach((i, k) => { next[i] = l[dealt[k]!]!; });
      }
      return [r, next];
    }));
    const keep = (): void => {
      const lay = inSocketOrder();
      const said = rings.map((r) => lay.get(r)!.join()).join('|');
      if (!seen.has(said)) { seen.add(said); candidates.push(lay); }
    };
    keep();
    for (let k = 0; k < ROUNDS; k++) { sweep(outward, true); keep(); sweep(back, false); keep(); }

    /** One order drawn: heights by the centroid pull, x by the arcs, then by the flow and the bands. */
    const draw = (lay: ReadonlyMap<number, readonly number[]>): { x: Map<number, number>; y: Map<number, number> } => {
      const y = new Map<number, number>();
      for (const l of lay.values()) {
        let s = -l.reduce((sum, c) => sum + cells[c]!.h + gapY, -gapY) / 2;
        for (const c of l) { y.set(c, s + cells[c]!.h / 2); s += cells[c]!.h + gapY; }
      }
      const level = y.get(anchor)!;
      for (const c of lay.get(0)!) y.set(c, y.get(c)! - level);
      // Each cell toward its neighbours' weighted centroid, its ring's order and gaps kept; the anchor holds at 0. Each
      // neighbour asks for the height that sets the two sockets of their line level.
      for (let k = 0; k < PULLS; k++) for (const r of [...outward, ...back]) {
        const l = lay.get(r)!;
        const want = l.map((c) => {
          if (c === anchor) return 0;
          let [sum, total] = [y.get(c)! / 2, 0.5];
          for (const e of adj[c]!) {
            const w = e.m * pull(e.to);
            sum += (y.get(e.to)! + e.far - cells[e.to]!.h / 2 - e.port + cells[c]!.h / 2) * w;
            total += w;
          }
          return sum / total;
        });
        const gaps = l.slice(1).map((c, i) => (cells[l[i]!]!.h + cells[c]!.h) / 2 + gapY + grid);
        project(want, l.map((c) => (c === anchor ? 1e9 : pull(c))), gaps).forEach((v, i) => y.set(l[i]!, v));
      }
      // The arcs: each ring's middle a gap past the ring inside it, and a little more as the ring is taller; its heights
      // within the arc, so its ends bend back. A heavier cell stands farther out.
      const x = new Map(lay.get(0)!.map((c) => [c, 0]));
      const widest = (r: number): number => Math.max(...lay.get(r)!.map((c) => cells[c]!.w));
      for (const [side, rs] of [[1, right], [-1, left]] as const) {
        let [radius, inner] = [0, 0];
        for (const r of rs) {
          const l = lay.get(r)!;
          const reach = Math.max(...l.map((c) => Math.abs(y.get(c)!) + cells[c]!.h / 2));
          radius += (widest(inner) + widest(r)) / 2 + gapX + Math.min(gapX, reach / BULGE);
          const tall = reach / Math.sin(ARC);
          for (const c of l) {
            const ratio = Math.min(1, pull(c) / Math.max(...adj[c]!.map((e) => pull(e.to))));
            x.set(c, side * (radius + REACH * gapX * ratio) * Math.sqrt(Math.max(0, 1 - (y.get(c)! / tall) ** 2)));
          }
          inner = r;
        }
      }
      // In x alone, ring by ring out: past each source (each target, on the left) and past every cell placed in its band.
      const placed = [...lay.get(0)!];
      const band = (a: number, b: number): boolean => Math.abs(y.get(a)! - y.get(b)!) < (cells[a]!.h + cells[b]!.h) / 2 + gapY + grid;
      const clear = (a: number, b: number, gap: number): number => (cells[a]!.w + cells[b]!.w) / 2 + gap;
      for (const [side, rs] of [[1, right], [-1, left]] as const) for (const r of rs) {
        const l = lay.get(r)!;
        for (const c of l) {
          let v = x.get(c)!;
          for (const o of side > 0 ? into.get(c)! : from.get(c)!) v = side > 0 ? Math.max(v, x.get(o)! + clear(o, c, gapX)) : Math.min(v, x.get(o)! - clear(o, c, gapX));
          for (const o of placed) if (band(o, c)) v = side > 0 ? Math.max(v, x.get(o)! + clear(o, c, gapX + grid)) : Math.min(v, x.get(o)! - clear(o, c, gapX + grid));
          x.set(c, v);
        }
        placed.push(...l);
      }
      return { x, y };
    };
    // How often a cell's neighbours on one side stand out of its sockets' order: two lines whose ends swap heights.
    const swapped = (y: ReadonlyMap<number, number>): number => {
      let count = 0;
      for (const c of list) for (const down of [true, false]) {
        const side = adj[c]!.filter((e) => e.down === down);
        const end = side.map((e) => y.get(e.to)! - cells[e.to]!.h / 2 + e.far);
        for (let i = 0; i < side.length; i++) for (let j = i + 1; j < side.length; j++) if ((side[i]!.port - side[j]!.port) * (end[i]! - end[j]!) < 0) count++;
      }
      return count;
    };
    // The order whose lines cross least, counted socket to socket; of those, the one keeping most of the sockets' order.
    let best: { v: number; k: number; x: Map<number, number>; y: Map<number, number> } | undefined;
    for (const lay of candidates) {
      const { x, y } = draw(lay);
      const v = swapped(y);
      const k = crossings(placesOf(list, x, y), boxes, graph.connections, options.sockets);
      if (!best || k < best.k || (k === best.k && v < best.v)) best = { v, k, x, y };
    }
    return { anchor, list, x: best!.x, y: best!.y };
  };

  // The MAIN part — the most nodes — keeps its place. Every other part (a chain) and every lone node but a Source stand in
  // ONE stack on its left, top to bottom, in the order they stood: clear of every line the main part draws, which runs left
  // to right inside it; top to bottom as they stood. Lone Sources and Portal Ins stand left of the stack. Will, 2026-11-10
  // In stages, each stage is laid so: the main part's nodes in it, and a stack of its own. TODO 950
  const stood = (list: readonly number[]): [number, number] => {
    const ns = list.flatMap((c) => cells[c]!.members.map((m) => at.get(m.id)!));
    return [Math.min(...ns.map((nd) => nd.x)), Math.min(...ns.map((nd) => nd.y))];
  };
  const before = (a: readonly number[], b: readonly number[], key: number): number => {
    const [[ax, ay], [bx, by]] = [stood(a), stood(b)];
    return ax - bx || ay - by || key;
  };
  const laid = parts.filter((l) => l.length > 1).map(unfurlPart).sort((a, b) => before(a.list, b.list, byKey(a.anchor, b.anchor)));
  const lone = parts.filter((l) => l.length === 1).map((l) => l[0]!).sort((a, b) => before([a], [b], byKey(a, b)));
  const corner = new Map<number, { x: number; y: number }>();
  const extent = (p: (typeof laid)[number], list: readonly number[] = p.list): { minX: number; minY: number; maxX: number; maxY: number } => ({
    minX: Math.min(...list.map((c) => p.x.get(c)! - cells[c]!.w / 2)), minY: Math.min(...list.map((c) => p.y.get(c)! - cells[c]!.h / 2)),
    maxX: Math.max(...list.map((c) => p.x.get(c)! + cells[c]!.w / 2)), maxY: Math.max(...list.map((c) => p.y.get(c)! + cells[c]!.h / 2)),
  });
  const mainPart = laid.reduce<(typeof laid)[number] | undefined>((m, p) => (!m || p.list.length > m.list.length ? p : m), undefined);
  const bandOf = (c: number): 'left' | 'right' | undefined => graph.bands?.[cells[c]!.key];
  type Item = { cells: readonly number[]; w: number; h: number; place: (x: number, y: number) => void };
  if (mainPart) for (const c of mainPart.list) corner.set(c, { x: mainPart.x.get(c)! - cells[c]!.w / 2, y: mainPart.y.get(c)! - cells[c]!.h / 2 });
  /** The cells of one scope placed — the whole graph, or one stage: the main part's as it laid them, the stack on their
   *  left, lone Sources left of that; a scope with none of the main part's at the main part's top. */
  const stack = (inScope: (c: number) => boolean): void => {
    const mains = mainPart ? mainPart.list.filter(inScope) : [];
    const around = mainPart && extent(mainPart, mains.length ? mains : mainPart.list);
    const [left, top] = around ? [around.minX, around.minY] : [0, 0];
    // The stack: each other part whole, each lone node but a Source, in the order they stood.
    const items: Item[] = [
      ...laid.filter((p) => p !== mainPart).flatMap((p): Item[] => {
        const list = p.list.filter(inScope);
        if (!list.length) return [];
        const e = extent(p, list);
        return [{ cells: list, w: e.maxX - e.minX, h: e.maxY - e.minY, place: (x, y) => { for (const c of list) corner.set(c, { x: x + p.x.get(c)! - cells[c]!.w / 2 - e.minX, y: y + p.y.get(c)! - cells[c]!.h / 2 - e.minY }); } }];
      }),
      ...lone.filter((c) => inScope(c) && bandOf(c) !== 'left').map((c): Item => ({ cells: [c], w: cells[c]!.w, h: cells[c]!.h, place: (x, y) => corner.set(c, { x, y }) })),
    ].sort((a, b) => {
      // Top to bottom as they stood.
      const [[ax, ay], [bx, by]] = [stood(a.cells), stood(b.cells)];
      return ay - by || ax - bx || byKey(a.cells[0]!, b.cells[0]!);
    });
    const stackW = items.length ? Math.max(...items.map((i) => i.w)) : 0;
    const stackX = mains.length ? left - (items.length ? stackW + gapX + grid : 0) : 0;
    let y0 = top;
    for (const item of items) {
      item.place(stackX, y0);
      y0 += item.h + gapY + grid;
    }
    // Lone Sources and Portal Ins: one column, left of the stack.
    const sources = lone.filter((c) => inScope(c) && bandOf(c) === 'left');
    if (sources.length) {
      const wide = Math.max(...sources.map((c) => cells[c]!.w));
      const start = items.length || mains.length ? stackX : 0;
      let ys = top;
      for (const c of sources) { corner.set(c, { x: start - wide - gapX - grid + (wide - cells[c]!.w) / 2, y: ys }); ys += cells[c]!.h + gapY + grid; }
    }
  };
  // In stages, each cell's stage: its first node's, one in none joining the nearest, as `fitStages` would; a tie's, where
  // its connections' nodes are all in one. A tie across stages is in none: it goes to its connections' middle.
  const staged = graph.stages?.length ? graph.stages : undefined;
  const stageIn = new Map<string, string>();
  const scopeOf = new Map<number, string>();
  if (staged) {
    const sorted = restage(graph, picked.filter((id) => !stageOf(graph, at.get(id)!)), (nd) => box(nd.id).w);
    for (const nd of sorted.nodes) stageIn.set(nd.id, stageOf(sorted, nd) ?? staged[0]!.id);
    cells.forEach((cell, c) => { if (cell.members.length) scopeOf.set(c, stageIn.get(cell.members[0]!.id)!); });
    for (const tie of graph.ties ?? []) {
      const c = tieCell.get(tie.id);
      const ins = new Set(tie.connections.flatMap((r) => [socketOf(r.from).node, socketOf(r.to).node].map((id) => stageIn.get(id))));
      if (c !== undefined && ins.size === 1) scopeOf.set(c, [...ins][0]!);
    }
    for (const s of staged) stack((c) => scopeOf.get(c) === s.id);
  } else stack(() => true);
  // The main part's anchor keeps its place — a tie's, its middle where it was; with none, the first lone node's.
  const main = mainPart?.anchor ?? lone[0]!;
  const home = (cell: Cell): { x: number; y: number } => {
    if (cell.tie) return { x: cell.tie.x - cell.w / 2, y: cell.tie.y - cell.h / 2 };
    const [lead] = cell.members;
    const was = at.get(lead!.id)!;
    return { x: near(was.x) - lead!.dx, y: near(was.y) - lead!.dy };
  };
  const shift = { x: home(cells[main]!).x - corner.get(main)!.x, y: home(cells[main]!).y - corner.get(main)!.y };
  cells.forEach((cell, c) => {
    for (const m of cell.members) out.nodes[m.id] = { x: near(corner.get(c)!.x + shift.x + m.dx), y: near(corner.get(c)!.y + shift.y + m.dy) };
  });
  // In stages, each stage's nodes move across into its band, as `stageBands` lays them out: the first stage's left edge
  // where it stood, each after it the gap on. So fitting the stages after moves none. TODO 950
  const moveX = new Map<string, number>();
  if (staged) {
    const ids = staged.map((s) => picked.filter((id) => stageIn.get(id) === s.id));
    const leftOf = (list: readonly string[]): number => Math.min(...list.map((id) => out.nodes[id]!.x));
    const lift = ids[0]!.length ? Math.ceil((staged[0]!.x + STAGE_PAD) / grid) * grid - leftOf(ids[0]!) : 0;
    const from = staged.map((s, i) => (i && ids[i]!.length ? leftOf(ids[i]!) - STAGE_PAD : s.x));
    const nodes = ids.flatMap((list, i) => list.map((id) => ({ id, x: out.nodes[id]!.x + (i ? 0 : lift), y: out.nodes[id]!.y, stage: staged[i]!.id })));
    // A width kept from a drag holds no band: each fits its unfurled nodes (Will, 2026-11-12), and the place edit clears it.
    const { bands } = stageBands({ stages: staged.map(({ w: _w, ...s }, i) => ({ ...s, x: from[i]! })), nodes }, (nd) => box(nd.id).w);
    staged.forEach((s, i) => moveX.set(s.id, i ? bands[i]!.left - from[i]! : lift));
    for (const id of picked) {
      out.nodes[id]!.x += moveX.get(stageIn.get(id)!)!;
      // One in none says the stage it joined, so fitting the stages after keeps it there.
      if (!id.startsWith('#') && !stageOf(graph, at.get(id)!)) out.nodes[id]!.stage = stageIn.get(id)!;
    }
    out.stages = Object.fromEntries(bands.map((b) => [b.id, b.left]));
  }
  const across = (c: number): number => moveX.get(scopeOf.get(c) ?? '') ?? 0;
  // Ties: one held as a cell where its cell stands; else, its connections all joining moved nodes, at their middle. Then each
  // held in its own section of its connector set (TODO 973).
  const final = { ...Object.fromEntries(graph.nodes.map((nd) => [nd.id, { x: nd.x, y: nd.y }])), ...out.nodes };
  for (const tie of graph.ties ?? []) {
    const c = tieCell.get(tie.id);
    const ends = tie.connections.map((r) => [socketOf(r.from).node, socketOf(r.to).node] as const);
    if (c === undefined && (!ends.length || !ends.every(([a, b]) => a in out.nodes && b in out.nodes))) continue;
    const mids = ends.map(([a, b]) => ({ x: (final[a]!.x + box(a).w + final[b]!.x) / 2, y: (final[a]!.y + box(a).h / 2 + final[b]!.y + box(b).h / 2) / 2 }));
    const spot = c !== undefined && (!staged || scopeOf.has(c))
      ? { x: corner.get(c)!.x + shift.x + cells[c]!.w / 2 + across(c), y: corner.get(c)!.y + shift.y + cells[c]!.h / 2 }
      : { x: mids.reduce((s, p) => s + p.x, 0) / mids.length, y: mids.reduce((s, p) => s + p.y, 0) / mids.length };
    out.ties[tie.id] = { x: Math.round(spot.x), y: near(spot.y) };
  }
  const held = holdTies({ nodes: graph.nodes.map((nd) => ({ id: nd.id, x: final[nd.id]!.x, w: box(nd.id).w })),
    ties: (graph.ties ?? []).map((t) => (out.ties[t.id] ? { ...t, ...out.ties[t.id] } : t)) }, (nd) => (nd as { w: number }).w);
  for (const tie of held.ties ?? []) if (out.ties[tie.id]) out.ties[tie.id]!.x = tie.x;
  return out;
}
