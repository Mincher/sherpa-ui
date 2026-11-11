/**
 * node-lanes.ts — SWIMLANES: rows down a workflow's canvas, one for each family of nodes (AI nodes in Agentic). A node is in
 * the lane its family names; a logic node or a portal, which has no lane, is in a JUNCTION: between the lanes of the nodes
 * it joins, or under the one lane they share — never in a lane (Will, TODO 915).
 * A lane grows to hold its nodes and pushes the ones under it, and their nodes, down; a lane or a junction with no node
 * takes no room. It changes no data: a runner ignores it. Pure: no DOM. Will, 2026-11-10
 *
 * Map:
 * - NodeLane — One lane: its id, its name, the families it holds, and its colour.
 * - LaneBand — One lane or junction as drawn: its top and bottom, in plane px.
 * - LANES_BY_FAMILY — The lanes a workflow is given when they are turned on.
 * - JUNCTION_FAMILIES — The families with no lane: a node of one stands between the lanes it joins.
 * - JUNCTION_KINDS — The kinds with no lane, whatever their family: a portal stands where its conditions do.
 * - LANE_PAD — How far a lane reaches past its nodes, above and below.
 * - LANE_GAP — The gap between two bands.
 * - laneOf — The band a node stands in: its family's lane, a junction, or none.
 * - laneBands — Each band holding a node, top to bottom, and the moves that keep each clear of the one above.
 * - fitLanes — The workflow with every node a push moved, as its bands say.
 * - laneFaults — Every fault in a workflow's lanes, in words.
 */
import { packBands } from './node-bands.js';
import { categorySlug, kindOfNode, socketOf, type NodeKind, type NodeRoute } from './node-kinds.js';

/** One lane: its id, its name, the families (node categories, as `data-category` writes them) it holds, and its colour. */
export interface NodeLane {
  id: string;
  label: string;
  families: readonly string[];
  /** A CSS colour its band wears. None, the default look. */
  colour?: string;
}

/** One lane or junction as drawn: its top and bottom, in plane px; a junction names the lane above it. */
export interface LaneBand {
  id: string;
  label: string;
  top: number;
  bottom: number;
  junction?: boolean;
}

/** The lanes a workflow is given when they are turned on: one for each family of nodes, top to bottom. */
export const LANES_BY_FAMILY: readonly NodeLane[] = [
  { id: 'data', label: 'Data', families: ['sources', 'status', 'presets', 'saved-filters', 'collections'] },
  { id: 'values', label: 'Values', families: ['variables', 'math', 'time', 'utils'] },
  { id: 'organise', label: 'Organise', families: ['organise'] },
  { id: 'agentic', label: 'Agentic', families: ['ai'] },
  { id: 'custom', label: 'Custom', families: ['custom-nodes'] },
  { id: 'output', label: 'Output', families: ['output'] },
];

/** The families with no lane: a conditional or logical node stands between the lanes of the nodes it joins. */
export const JUNCTION_FAMILIES: readonly string[] = ['logic'];
/** The kinds with no lane, whatever their family: a portal stands in the junction of what it links. TODO 915 */
export const JUNCTION_KINDS: readonly string[] = ['portal'];

/** How far a band reaches past its nodes, above and below: room for its name. */
export const LANE_PAD = 40;
/** The gap between two bands. */
export const LANE_GAP = 16;

/** What the lanes read of a workflow: its nodes, its routes and its lanes. */
interface Laned {
  nodes: readonly { id: string; kind: string; y: number; values?: Readonly<Record<string, unknown>> }[];
  routes?: readonly NodeRoute[];
  lanes?: readonly NodeLane[];
}
type Kinds = Readonly<Record<string, NodeKind>>;
/** A node's height, in plane px: as drawn. */
type HeightOf = (node: Laned['nodes'][number]) => number;

/** The junction under a lane: its id. */
const junctionOf = (lane: NodeLane): string => `junction:${lane.id}`;

/** A node's family: its kind's category, as `data-category` writes it. */
function familyOf(node: Laned['nodes'][number], kinds: Kinds): string | undefined {
  return categorySlug(kindOfNode(kinds, node)?.category);
}

/**
 * The band a node stands in: the lane its family names; a logic node or a portal (`JUNCTION_KINDS`), the junction just above
 * the lowest lane of the laned nodes it joins — through other logic nodes and portals, an In and an Out of one name as
 * joined — or the junction under the one lane they all share; else none.
 */
export function laneOf(workflow: Laned, id: string, kinds: Kinds): string | undefined {
  const lanes = workflow.lanes ?? [];
  if (!lanes.length || id.startsWith('#')) return undefined;
  const byId = new Map(workflow.nodes.map((n) => [n.id, n]));
  const laneIndex = (nodeId: string): number => {
    const node = byId.get(nodeId);
    const family = node && !JUNCTION_KINDS.includes(node.kind) && familyOf(node, kinds);
    return family ? lanes.findIndex((l) => l.families.includes(family)) : -1;
  };
  // A portal's other end: every portal of its name.
  const named = (nodeId: string): string[] => {
    const node = byId.get(nodeId);
    const name = node?.kind === 'portal' ? node.values?.['name'] : undefined;
    return name ? workflow.nodes.filter((n) => n.kind === 'portal' && n.id !== nodeId && n.values?.['name'] === name).map((n) => n.id) : [];
  };
  const own = laneIndex(id);
  if (own >= 0) return lanes[own]!.id;
  // Every laned node it joins, either way, through other logic nodes: the lanes it stands between.
  const routes = workflow.routes ?? [];
  const joined = new Set<number>();
  const seen = new Set([id]);
  let ring = [id];
  while (ring.length) {
    const next: string[] = [];
    for (const at of ring) {
      const others = [...routes.map((r) => {
        const [from, to] = [socketOf(r.from).node, socketOf(r.to).node];
        return to === at ? from : from === at ? to : undefined;
      }), ...named(at)];
      for (const other of others) {
        if (!other || seen.has(other) || other.startsWith('#')) continue;
        seen.add(other);
        const lane = laneIndex(other);
        if (lane >= 0) joined.add(lane);
        else next.push(other);
      }
    }
    ring = next;
  }
  if (!joined.size) return undefined;
  const [top, bottom] = [Math.min(...joined), Math.max(...joined)];
  // One lane: the junction under it. Several: the junction just above the lowest.
  return junctionOf(lanes[top === bottom ? top : bottom - 1]!);
}

/**
 * Each band that holds a node, top to bottom — a lane, then the junction under it — and the moves (new y, by node) that
 * keep each LANE_GAP clear of the one above. A node in no band is not moved.
 */
export function laneBands(workflow: Laned, heightOf: HeightOf, kinds: Kinds): { bands: LaneBand[]; moves: Record<string, number> } {
  const lanes = workflow.lanes ?? [];
  if (!lanes.length) return { bands: [], moves: {} };
  const where = new Map(workflow.nodes.map((n) => [n.id, laneOf(workflow, n.id, kinds)]));
  const groups = lanes.flatMap((lane) => [lane.id, junctionOf(lane)]).map((id) => ({
    id,
    at: 0,
    skipEmpty: true,
    members: workflow.nodes.filter((n) => where.get(n.id) === id).map((n) => ({ id: n.id, start: n.y, size: heightOf(n) })),
  }));
  const { bands, moves } = packBands(groups, { min: 0, pad: LANE_PAD, gap: LANE_GAP });
  const label = (id: string): string => lanes.find((l) => l.id === id)?.label ?? 'Junction';
  return {
    bands: bands.map((b) => ({ id: b.id, label: label(b.id), top: b.start, bottom: b.end, ...(b.id.startsWith('junction:') ? { junction: true } : {}) })),
    moves,
  };
}

/** The workflow with every node a push moved, as its bands say. Unchanged, the same one. */
export function fitLanes<W extends Laned>(workflow: W, heightOf: HeightOf, kinds: Kinds): W {
  if (!workflow.lanes?.length) return workflow;
  const { moves } = laneBands(workflow, heightOf, kinds);
  if (!Object.keys(moves).length) return workflow;
  return { ...workflow, nodes: workflow.nodes.map((n) => (n.id in moves ? { ...n, y: Math.round(moves[n.id]!) } : n)) };
}

/** Every fault in a workflow's lanes, in words: two of one id, one with no name, a family in two lanes. */
export function laneFaults(workflow: Pick<Laned, 'lanes'>): string[] {
  const faults: string[] = [];
  const ids = new Set<string>();
  const families = new Map<string, string>();
  for (const lane of workflow.lanes ?? []) {
    if (ids.has(lane.id)) faults.push(`two lanes are "${lane.id}"`);
    ids.add(lane.id);
    if (!lane.label?.trim()) faults.push(`the lane "${lane.id}" has no name`);
    for (const family of lane.families ?? []) {
      const held = families.get(family);
      if (held) faults.push(`the family "${family}" is in two lanes, "${held}" and "${lane.id}"`);
      families.set(family, lane.id);
    }
  }
  return faults;
}
