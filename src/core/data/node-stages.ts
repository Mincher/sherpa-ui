/**
 * node-stages.ts — STAGES: columns across a workflow's canvas, left to right. Every node is in one stage, the nearest where
 * it stands in none (TODO 899). A stage grows to hold its nodes, and pushes the stages after it, and their nodes, right. It
 * changes no data: a runner ignores it. Pure: no DOM. A workflow with no `stages` has one, Stage 1, and every node is in
 * it. Will, 2026-11-10
 *
 * Map:
 * - NodeStage — One stage: its id, its name, line and colour, and where its left edge stands.
 * - StageBand — One stage as drawn: its left and right edges, in plane px.
 * - STAGE_MIN — How wide an empty stage is.
 * - STAGE_PAD — How far a stage reaches past its nodes, each side.
 * - STAGE_GAP — The gap between two stages.
 * - STAGE_LEAST — How narrow a stage's edge drags it, at the least.
 * - DEFAULT_STAGE — The stage a workflow with none has.
 * - stagesOf — A workflow's stages: its own, or the one it has with none.
 * - stageOf — The stage a node is in, or none.
 * - stageBands — Each stage's band, and the moves that keep each clear of the one before.
 * - heldBands — Each stage's band as it stands, its left edge where it was last laid out, not laid out again; nodes `moving`…
 * - stageNodes — Each node in a stage before there is a layout, a writer's: named, else its nearest named, else by column.
 * - fitStages — The workflow with every node in a stage, each stage's edge, and the nodes a push moved.
 * - stageAt — The stage whose band holds a place across the canvas, or none.
 * - stagesHeld — The workflow with its stages written out: its one Stage 1, and every node in it.
 * - restage — The workflow with these nodes in the stage their middle stands in, or the point given does; else the nearest.
 * - orderStages — The workflow with its stages in a new order, each packed after the one before, its nodes with it.
 * - stageWidthRange — The widths a stage's end edge can give it: room for its nodes, and the next one's; or, pushing, their widest.
 * - resizeStage — The workflow with a stage this wide and the next as much narrower, by the edge between them; given the
 * - stageFaults — Every fault in a workflow's stages, in words.
 * - nextStageColour — The colour a new stage takes: the first of the palette no stage wears; all worn, the next in turn.
 * - colourStages — Each stage its colour: its own, else the next; made from nothing, stage i wears colour i.
 */
import { packBands, type BandGroup } from './node-bands.js';
import { START } from './node-start.js';

/** One stage: its id, its name, line and colour, and where its left edge stands (plane px). */
export interface NodeStage {
  id: string;
  label: string;
  description?: string;
  /** A CSS colour: the stage's bar and band wear it. None, the default look. */
  colour?: string;
  x: number;
  /** Its width, where its edge was dragged (TODO 900): its nodes may make it wider. None, as wide as they need. */
  w?: number;
}

/** One stage as drawn: its left and right edges, in plane px. */
export interface StageBand {
  id: string;
  left: number;
  right: number;
}

/** How wide an empty stage is, in plane px. */
export const STAGE_MIN = 320;
/** How far a stage reaches past its nodes, each side. */
export const STAGE_PAD = 48;
/** The gap between two stages. */
export const STAGE_GAP = 16;
/** How narrow a stage's edge drags it, at the least: its pad, each side. */
export const STAGE_LEAST = 2 * STAGE_PAD;
/** The stage a workflow with none has. */
export const DEFAULT_STAGE: NodeStage = { id: 'stage-1', label: 'Stage 1', x: 0 };

/** What the stages read of a workflow: its nodes' places and sizes, and its stages. */
interface Staged {
  nodes: readonly { id: string; x: number; y: number; stage?: string; size?: { w: number } }[];
  stages?: readonly NodeStage[];
}

/** A node's width, in plane px: its kind's natural width, times how far a reader grew it. */
type WidthOf = (node: Staged['nodes'][number]) => number;
/** Each node's height as drawn, by id: what a pushed node meets beside it (TODO 901). */
type Heights = Readonly<Record<string, number>>;

/** A Group Input or Output stands in no stage; the Start stands in the one it names, the first (plan 949). */
const apart = (node: { id: string; stage?: string }): boolean => node.id.startsWith('#') && !node.stage;

/** A workflow's stages: its own, or, with none, Stage 1 at the left of its nodes. */
export function stagesOf(workflow: Staged): readonly NodeStage[] {
  if (workflow.stages?.length) return workflow.stages;
  const xs = workflow.nodes.filter((n) => !apart(n)).map((n) => n.x);
  return [{ ...DEFAULT_STAGE, x: xs.length ? Math.min(...xs) - STAGE_PAD : 0 }];
}

/** The stage a node is in, or none. With no stages written, every node is in Stage 1. */
export function stageOf(workflow: Staged, node: Staged['nodes'][number]): string | undefined {
  if (apart(node)) return undefined;
  if (!workflow.stages?.length) return DEFAULT_STAGE.id;
  return node.stage && workflow.stages.some((s) => s.id === node.stage) ? node.stage : undefined;
}

/**
 * Each stage's band, left to right, and the moves that keep each clear of the one before. A stage reaches
 * STAGE_PAD past its nodes; empty, it is STAGE_MIN wide at its own left edge. A stage that would start
 * before the last one ends, plus STAGE_GAP, is pushed right, its nodes with it.
 */
export function stageBands(workflow: Staged, widthOf: WidthOf): { bands: StageBand[]; moves: Record<string, number> } {
  const stages = stagesOf(workflow);
  const member = (n: Staged['nodes'][number]): { id: string; start: number; size: number } => ({ id: n.id, start: n.x, size: widthOf(n) });
  // Nodes in NO stage are a band of their own where they stand, with no bar: the stages after them keep clear of them.
  const loose = workflow.stages?.length ? workflow.nodes.filter((n) => !n.id.startsWith('#') && !stageOf(workflow, n)) : [];
  const after = (n: Staged['nodes'][number]): number => stages.filter((s) => s.x <= n.x).length;
  const groups: BandGroup[] = [];
  for (let i = 0; i <= stages.length; i++) {
    const free = loose.filter((n) => after(n) === i);
    if (free.length) groups.push({ id: `loose:${i}`, at: Math.min(...free.map((n) => n.x)) - STAGE_PAD, members: free.map(member), min: 0 });
    const stage = stages[i];
    if (stage) groups.push({ id: stage.id, at: stage.x, members: workflow.nodes.filter((n) => stageOf(workflow, n) === stage.id).map(member), ...(stage.w ? { min: stage.w } : {}) });
  }
  const { bands, moves } = packBands(groups, { min: STAGE_MIN, pad: STAGE_PAD, gap: STAGE_GAP, flex: true });
  return { bands: bands.filter((b) => !b.id.startsWith('loose:')).map((b) => ({ id: b.id, left: b.start, right: b.end })), moves };
}

/**
 * Each stage's band as it stands, its left edge where it was last laid out, not laid out again; nodes `moving` are not in
 * it. A drag that takes nodes out of their stage draws these, so no stage follows them or slides away under them.
 */
export function heldBands(workflow: Staged, widthOf: WidthOf, moving: ReadonlySet<string> = new Set()): StageBand[] {
  return stagesOf(workflow).map((stage) => {
    const members = workflow.nodes.filter((n) => !moving.has(n.id) && stageOf(workflow, n) === stage.id);
    const right = members.length ? Math.max(...members.map((n) => n.x + widthOf(n))) + STAGE_PAD : stage.x;
    return { id: stage.id, left: stage.x, right: Math.round(Math.max(right, stage.x + (stage.w ?? STAGE_MIN))) };
  });
}

/**
 * Each node in a stage BEFORE there is a layout, a writer's (an act, the MCP): no widths, only x. The stage it names; else
 * its nearest named neighbour's, by x; with none named, the columns cut at their k − 1 widest gaps, a group to a stage, left
 * to right. The Start stands in the first; a Group Input or Output in none. Every node in its stage already: the same array.
 */
export function stageNodes<N extends Staged['nodes'][number]>(stages: readonly NodeStage[] | undefined, given: readonly N[]): readonly N[] {
  if (!stages?.length) return given;
  const ids = new Set(stages.map((s) => s.id));
  const first = stages[0]!.id;
  const named = (n: N): boolean => ids.has(n.stage ?? '');
  const nodes = given.map((n) => (n.id === START && n.stage !== first ? { ...n, stage: first } : n));
  const staged = nodes.filter((n) => !apart(n));
  if (staged.every(named)) return nodes.every((n, i) => n === given[i]) ? given : nodes;
  // The Start is placed by rule, never named by the writer: it leads no node to its stage, and takes no cut.
  const held = staged.filter((n) => named(n) && n.id !== START);
  if (held.length) {
    const nearest = (n: N): string => held.reduce((best, m) => (Math.abs(m.x - n.x) < Math.abs(best.x - n.x) ? m : best)).stage!;
    return nodes.map((n) => (apart(n) || named(n) ? n : { ...n, stage: nearest(n) }));
  }
  const xs = [...new Set(staged.filter((n) => n.id !== START).map((n) => n.x))].sort((a, b) => a - b);
  const cuts = xs.slice(1).map((x, i) => ({ at: x, gap: x - xs[i]! })).sort((a, b) => b.gap - a.gap)
    .slice(0, stages.length - 1).map((c) => c.at).sort((a, b) => a - b);
  return nodes.map((n) => (apart(n) || n.id === START ? n : { ...n, stage: stages[Math.min(cuts.filter((c) => n.x >= c).length, stages.length - 1)]!.id }));
}

/** The workflow with every node in a stage — one in none joins the nearest — each stage's left edge, and every node a
 *  push moved, as its bands say. Unchanged, the same one. */
export function fitStages<W extends Staged>(given: W, widthOf: WidthOf): W {
  if (!given.stages?.length) return given;
  // By where a placed node stands, its band; before any layout, by x alone, is `stageNodes`.
  const loose = given.nodes.filter((n) => !n.id.startsWith('#') && !stageOf(given, n)).map((n) => n.id);
  const workflow = loose.length ? restage(given, loose, widthOf) : given;
  const stages = given.stages;
  const { bands, moves } = stageBands(workflow, widthOf);
  const moved = Object.keys(moves).length > 0;
  const placed = stages.some((s, i) => s.x !== bands[i]!.left);
  if (!moved && !placed) return workflow;
  return {
    ...workflow,
    nodes: moved ? workflow.nodes.map((n) => (n.id in moves ? { ...n, x: Math.round(moves[n.id]!) } : n)) : workflow.nodes,
    stages: stages.map((s, i) => (s.x === bands[i]!.left ? s : { ...s, x: bands[i]!.left })),
  };
}

/** The stage whose band holds a place across the canvas, or none. */
export function stageAt(bands: readonly StageBand[], x: number): string | undefined {
  return bands.find((b) => x >= b.left && x < b.right)?.id;
}

/** The stage whose band holds x, else the one whose edge is nearest it: the left of two as near. */
function stageNear(bands: readonly StageBand[], x: number): string | undefined {
  const away = (b: StageBand): number => (x < b.left ? b.left - x : x >= b.right ? x - b.right : 0);
  return bands.reduce<StageBand | undefined>((best, b) => (!best || away(b) < away(best) ? b : best), undefined)?.id;
}

/** The workflow with its stages written out: its one Stage 1, at its place, and every node in it. Written, the same one. */
export function stagesHeld<W extends Staged>(workflow: W): W {
  if (workflow.stages?.length) return workflow;
  const [first] = stagesOf(workflow);
  return { ...workflow, stages: [first!], nodes: workflow.nodes.map((n) => (n.id.startsWith('#') ? n : { ...n, stage: first!.id })) };
}

/**
 * The workflow with these nodes in the stage their middle stands in, by the bands as they stand without them
 * (`heldBands`). A node let go between stages, or past them, joins the nearest: none stands outside a stage (TODO 899).
 * `together` (a frame's nodes): all in the stage under the middle of them all. `by`: the stage under that x, for them all
 * — where a new node was let go.
 */
export function restage<W extends Staged>(workflow: W, ids: readonly string[], widthOf: WidthOf, together = false, by?: number): W {
  if (!workflow.stages?.length || !ids.length) return workflow;
  const moving = new Set(ids);
  const bands = heldBands(workflow, widthOf, moving);
  // As ONE (a frame's nodes): the stage under the middle of them all.
  const all = workflow.nodes.filter((n) => moving.has(n.id));
  const middle = all.length ? (Math.min(...all.map((n) => n.x)) + Math.max(...all.map((n) => n.x + widthOf(n)))) / 2 : 0;
  const one = by !== undefined ? stageNear(bands, by) : together ? stageNear(bands, middle) : undefined;
  let changed = false;
  const nodes = workflow.nodes.map((n) => {
    if (!moving.has(n.id) || n.id.startsWith('#')) return n;
    const at = by !== undefined || together ? one : stageNear(bands, n.x + widthOf(n) / 2);
    if (at === n.stage) return n;
    changed = true;
    const { stage: _was, ...bare } = n;
    return at ? { ...bare, stage: at } : bare;
  });
  return changed ? { ...workflow, nodes } : workflow;
}

/** The workflow with its stages in this order, each packed STAGE_GAP after the one before from where the first
 *  stood, its nodes moved with it. An id it does not hold is skipped; a stage not named keeps its place at the end. */
export function orderStages<W extends Staged>(workflow: W, ids: readonly string[], widthOf: WidthOf): W {
  const held = stagesHeld(workflow);
  const stages = held.stages!;
  const order = [...ids.flatMap((id) => stages.filter((s) => s.id === id)), ...stages.filter((s) => !ids.includes(s.id))];
  if (order.every((s, i) => s === stages[i])) return workflow;
  const { bands } = stageBands(held, widthOf);
  const band = (id: string): StageBand => bands.find((b) => b.id === id)!;
  let at = Math.min(...bands.map((b) => b.left));
  const shift: Record<string, number> = {};
  const placed = order.map((s) => {
    const b = band(s.id);
    shift[s.id] = at - b.left;
    const moved = { ...s, x: at };
    at += b.right - b.left + STAGE_GAP;
    return moved;
  });
  const nodes = held.nodes.map((n) => {
    const by = n.stage ? shift[n.stage] : 0;
    return by ? { ...n, x: n.x + by } : n;
  });
  return { ...held, stages: placed, nodes };
}

/** The widths the stage `id`'s END edge can give it, in plane px: room for its own nodes and STAGE_LEAST, and the same for
 *  the next stage's. None for the last, or one not there. */
export function stageWidthRange(workflow: Staged, id: string, widthOf: WidthOf, push = false): { least: number; most: number } | null {
  const stages = workflow.stages ?? [];
  const at = stages.findIndex((s) => s.id === id);
  if (at < 0 || at === stages.length - 1) return null;
  const { bands } = stageBands(workflow, widthOf);
  const [a, b] = [bands[at]!, bands[at + 1]!];
  const of = (stage: string): Staged['nodes'] => workflow.nodes.filter((n) => stageOf(workflow, n) === stage);
  // Pushing, a stage is as narrow as its widest node and its pads; else as its nodes stand.
  const widest = (stage: string): number => Math.max(STAGE_LEAST, ...of(stage).map((n) => widthOf(n) + 2 * STAGE_PAD));
  const least = push ? widest(a.id) : Math.max(STAGE_LEAST, ...of(a.id).map((n) => n.x + widthOf(n) + STAGE_PAD - a.left));
  const most = (push ? b.right - widest(b.id) : Math.min(b.right - STAGE_LEAST, ...of(b.id).map((n) => n.x - STAGE_PAD))) - STAGE_GAP - a.left;
  return { least: Math.round(least), most: Math.round(Math.max(most, least)) };
}

/** A stage's nodes pushed in from one side (`dir` -1, its end, leftward; 1, its start, rightward) to `limit`, in order: a
 *  node that meets one beside it, moved, pushes it on with their gap kept, up to STAGE_PAD; none past `stop`, where they
 *  may overlap. Each new x, by id. TODO 901 */
function pushIn(nodes: Staged['nodes'], widthOf: WidthOf, heights: Heights, limit: number, dir: -1 | 1, stop: number): Record<string, number> {
  const boxes = nodes.map((n) => ({ id: n.id, x: n.x, w: widthOf(n), top: n.y, bottom: n.y + (heights[n.id] ?? 0) }));
  const order = boxes.sort((p, q) => (dir < 0 ? q.x + q.w - (p.x + p.w) : p.x - q.x));
  const moved: { top: number; bottom: number; x: number; w: number; was: number }[] = [];
  const moves: Record<string, number> = {};
  for (const b of order) {
    // The edge first: nothing past `limit`. Then each node moved before it that it meets.
    let to = dir < 0 ? Math.min(b.x, limit - b.w) : Math.max(b.x, limit);
    for (const p of moved) {
      if (p.top >= b.bottom || b.top >= p.bottom) continue;
      if (dir < 0) to = Math.min(to, p.x - Math.max(0, Math.min(STAGE_PAD, p.was - (b.x + b.w))) - b.w);
      else to = Math.max(to, p.x + p.w + Math.max(0, Math.min(STAGE_PAD, b.x - (p.was + p.w))));
    }
    to = Math.round(dir < 0 ? Math.max(to, stop) : Math.min(to, stop - b.w));
    if (to === b.x) continue;
    moves[b.id] = to;
    moved.push({ top: b.top, bottom: b.bottom, x: to, w: b.w, was: b.x });
  }
  return moves;
}

/**
 * The workflow with the stage `id` `w` wide, by its END edge, and the stage after it starting as far on, as much
 * narrower: its right edge stays (TODO 900). Each keeps room for its nodes and STAGE_LEAST; the edge stops there, and no
 * node moves. Given the nodes' `heights` (TODO 901), the edge goes past them: the stage it narrows pushes its nodes in, as
 * `pushIn` says, and stops at its widest node. The last stage has no edge to drag: the same one.
 */
export function resizeStage<W extends Staged>(workflow: W, id: string, w: number, widthOf: WidthOf, heights?: Heights): W {
  const range = stageWidthRange(workflow, id, widthOf, !!heights);
  if (!range) return workflow;
  const stages = workflow.stages!;
  const at = stages.findIndex((s) => s.id === id);
  const { bands } = stageBands(workflow, widthOf);
  const [a, b] = [bands[at]!, bands[at + 1]!];
  const edge = a.left + Math.round(Math.min(Math.max(w, range.least), range.most));
  if (edge === a.right) return workflow;
  const start = edge + STAGE_GAP;
  const of = (stage: string): Staged['nodes'] => workflow.nodes.filter((n) => stageOf(workflow, n) === stage);
  const moves = !heights ? {}
    : edge < a.right ? pushIn(of(a.id), widthOf, heights, edge - STAGE_PAD, -1, a.left + STAGE_PAD)
      : pushIn(of(b.id), widthOf, heights, start + STAGE_PAD, 1, b.right - STAGE_PAD);
  return {
    ...workflow,
    stages: stages.map((s, i) => (i === at ? { ...s, x: a.left, w: edge - a.left } : i === at + 1 ? { ...s, x: start, w: b.right - start } : s)),
    ...(Object.keys(moves).length ? { nodes: workflow.nodes.map((n) => (n.id in moves ? { ...n, x: moves[n.id]! } : n)) } : {}),
  };
}

/** Every fault in a workflow's stages, in words: two of one id, one with no name, a node in a stage not there. */
export function stageFaults(workflow: Staged): string[] {
  const faults: string[] = [];
  const seen = new Set<string>();
  for (const s of workflow.stages ?? []) {
    if (seen.has(s.id)) faults.push(`two stages are "${s.id}"`);
    seen.add(s.id);
    if (!s.label?.trim()) faults.push(`the stage "${s.id}" has no name`);
  }
  // The Start is placed each time, never kept: its stage is no fault (plan 949).
  for (const n of workflow.nodes) {
    if (n.stage && !n.id.startsWith('#') && !seen.has(n.stage)) faults.push(`the node "${n.id}" is in the stage "${n.stage}", which is not there`);
  }
  return faults;
}

/** The colour a new stage takes, from the palette given (Will, TODO 957: "iterate through the available colours"): the
 *  first that no stage wears; all worn, the next in turn. None given, none. */
export function nextStageColour(stages: readonly Pick<NodeStage, 'colour'>[], colours: readonly string[]): string | undefined {
  return colours.find((c) => !stages.some((s) => s.colour === c)) ?? colours[stages.length % colours.length];
}

/** Each stage its colour: its own, else the next by `nextStageColour`. Made from nothing, stage i wears colour i. */
export function colourStages<S extends Pick<NodeStage, 'colour'>>(stages: readonly S[], colours: readonly string[]): S[] {
  const done: S[] = [];
  for (const [i, s] of stages.entries()) {
    const colour = s.colour ? undefined : nextStageColour([...done, ...stages.slice(i + 1)], colours);
    done.push(colour ? { ...s, colour } : s);
  }
  return done;
}
