/**
 * node-stages.ts — STAGES: columns across a workflow's canvas, left to right. A node is in one stage at most; a stage
 * grows to hold its nodes, and pushes the stages after it, and their nodes, right. It changes no data: a runner ignores
 * it. Pure: no DOM. A workflow with no `stages` has one, Stage 1, and every node is in it. Will, 2026-11-10
 *
 * Map:
 * - NodeStage — One stage: its id, its name, line and colour, and where its left edge stands.
 * - StageBand — One stage as drawn: its left and right edges, in plane px.
 * - STAGE_MIN — How wide an empty stage is.
 * - STAGE_PAD — How far a stage reaches past its nodes, each side.
 * - STAGE_GAP — The gap between two stages.
 * - DEFAULT_STAGE — The stage a workflow with none has.
 * - stagesOf — A workflow's stages: its own, or the one it has with none.
 * - stageOf — The stage a node is in, or none.
 * - stageBands — Each stage's band, and the moves that keep each clear of the one before.
 * - heldBands — Each stage's band as it stands, its left edge where it was last laid out, not laid out again; nodes `moving`…
 * - fitStages — The workflow with each stage's left edge, and every node a push moved, as its bands say.
 * - stageAt — The stage whose band holds a place across the canvas, or none.
 * - stagesHeld — The workflow with its stages written out: its one Stage 1, and every node in it.
 * - restage — The workflow with these nodes in the stage their middle stands in, or in none.
 * - orderStages — The workflow with its stages in a new order, each packed after the one before, its nodes with it.
 * - stageFaults — Every fault in a workflow's stages, in words.
 */
import { packBands, type BandGroup } from './node-bands.js';

/** One stage: its id, its name, line and colour, and where its left edge stands (plane px). */
export interface NodeStage {
  id: string;
  label: string;
  description?: string;
  /** A CSS colour: the stage's bar and band wear it. None, the default look. */
  colour?: string;
  x: number;
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
/** The stage a workflow with none has. */
export const DEFAULT_STAGE: NodeStage = { id: 'stage-1', label: 'Stage 1', x: 0 };

/** What the stages read of a workflow: its nodes' places and sizes, and its stages. */
interface Staged {
  nodes: readonly { id: string; x: number; y: number; stage?: string; size?: { w: number } }[];
  stages?: readonly NodeStage[];
}

/** A node's width, in plane px: its kind's natural width, times how far a reader grew it. */
type WidthOf = (node: Staged['nodes'][number]) => number;

/** A workflow's stages: its own, or, with none, Stage 1 at the left of its nodes. */
export function stagesOf(workflow: Staged): readonly NodeStage[] {
  if (workflow.stages?.length) return workflow.stages;
  const xs = workflow.nodes.filter((n) => !n.id.startsWith('#')).map((n) => n.x);
  return [{ ...DEFAULT_STAGE, x: xs.length ? Math.min(...xs) - STAGE_PAD : 0 }];
}

/** The stage a node is in, or none. With no stages written, every node is in Stage 1. */
export function stageOf(workflow: Staged, node: Staged['nodes'][number]): string | undefined {
  if (node.id.startsWith('#')) return undefined;
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
    if (stage) groups.push({ id: stage.id, at: stage.x, members: workflow.nodes.filter((n) => stageOf(workflow, n) === stage.id).map(member) });
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
    return { id: stage.id, left: stage.x, right: Math.round(Math.max(right, stage.x + STAGE_MIN)) };
  });
}

/** The workflow with each stage's left edge, and every node a push moved, as its bands say. Unchanged, the same one. */
export function fitStages<W extends Staged>(workflow: W, widthOf: WidthOf): W {
  if (!workflow.stages?.length) return workflow;
  const { bands, moves } = stageBands(workflow, widthOf);
  const moved = Object.keys(moves).length > 0;
  const placed = workflow.stages.some((s, i) => s.x !== bands[i]!.left);
  if (!moved && !placed) return workflow;
  return {
    ...workflow,
    nodes: moved ? workflow.nodes.map((n) => (n.id in moves ? { ...n, x: Math.round(moves[n.id]!) } : n)) : workflow.nodes,
    stages: workflow.stages.map((s, i) => (s.x === bands[i]!.left ? s : { ...s, x: bands[i]!.left })),
  };
}

/** The stage whose band holds a place across the canvas, or none. */
export function stageAt(bands: readonly StageBand[], x: number): string | undefined {
  return bands.find((b) => x >= b.left && x < b.right)?.id;
}

/** The workflow with its stages written out: its one Stage 1, at its place, and every node in it. Written, the same one. */
export function stagesHeld<W extends Staged>(workflow: W): W {
  if (workflow.stages?.length) return workflow;
  const [first] = stagesOf(workflow);
  return { ...workflow, stages: [first!], nodes: workflow.nodes.map((n) => (n.id.startsWith('#') ? n : { ...n, stage: first!.id })) };
}

/**
 * The workflow with these nodes in the stage their middle stands in, by the bands as they stand without them
 * (`heldBands`), or in none. A node let go between stages, or past them, is in none. `together` (a frame's nodes): all
 * in the stage under the middle of them all.
 */
export function restage<W extends Staged>(workflow: W, ids: readonly string[], widthOf: WidthOf, together = false): W {
  if (!workflow.stages?.length || !ids.length) return workflow;
  const moving = new Set(ids);
  const bands = heldBands(workflow, widthOf, moving);
  // As ONE (a frame's nodes): the stage under the middle of them all.
  const all = workflow.nodes.filter((n) => moving.has(n.id));
  const middle = all.length ? (Math.min(...all.map((n) => n.x)) + Math.max(...all.map((n) => n.x + widthOf(n)))) / 2 : 0;
  const one = together ? stageAt(bands, middle) : undefined;
  let changed = false;
  const nodes = workflow.nodes.map((n) => {
    if (!moving.has(n.id) || n.id.startsWith('#')) return n;
    const at = together ? one : stageAt(bands, n.x + widthOf(n) / 2);
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

/** Every fault in a workflow's stages, in words: two of one id, one with no name, a node in a stage not there. */
export function stageFaults(workflow: Staged): string[] {
  const faults: string[] = [];
  const seen = new Set<string>();
  for (const s of workflow.stages ?? []) {
    if (seen.has(s.id)) faults.push(`two stages are "${s.id}"`);
    seen.add(s.id);
    if (!s.label?.trim()) faults.push(`the stage "${s.id}" has no name`);
  }
  for (const n of workflow.nodes) {
    if (n.stage && !seen.has(n.stage)) faults.push(`the node "${n.id}" is in the stage "${n.stage}", which is not there`);
  }
  return faults;
}
