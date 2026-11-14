/**
 * node-lanes.ts — SWIMLANES: rows down a workflow's canvas, one for each family of nodes (AI nodes in Agentic). A node is in
 * the lane its family names; a logic node or a portal, which has no lane, is in a JUNCTION, never a lane: under the lane
 * its inputs come from, so the junction nodes one lane feeds share one junction (Will, TODOs 915, 928).
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
import { categorySlug, kindOfNode, socketOf, type NodeKind, type NodeConnection } from './node-kinds.js';

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
  { id: 'data', label: 'Data', families: ['sources', 'triggers', 'status', 'presets', 'collections'] },
  { id: 'values', label: 'Values', families: ['variables', 'math', 'time', 'utils'] },
  { id: 'organise', label: 'Organise', families: ['organise'] },
  { id: 'agentic', label: 'Agentic', families: ['ai'] },
  { id: 'custom', label: 'Custom', families: ['custom-nodes', 'runbooks'] },
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

/** What the lanes read of a workflow: its nodes, its connections and its lanes. */
interface Laned {
  nodes: readonly { id: string; kind: string; y: number; values?: Readonly<Record<string, unknown>> }[];
  connections?: readonly NodeConnection[];
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
 * The band a node stands in: the lane its family names; a logic node or a portal (`JUNCTION_KINDS`), the junction under the
 * lowest lane its inputs come from — through other logic nodes and portals, an Out's In among them (TODO 928). Fed from no
 * lane: the junction under the one lane it joins, or just above the lowest of several (915). Else none.
 */
export function laneOf(workflow: Laned, id: string, kinds: Kinds): string | undefined {
  return bandsOf(workflow, kinds)(id);
}

/** `laneOf` for every node of one workflow: what it reads of the graph is read once, so a band costs its own walk. */
function bandsOf(workflow: Laned, kinds: Kinds): (id: string) => string | undefined {
  const lanes = workflow.lanes ?? [];
  const byId = new Map(workflow.nodes.map((n) => [n.id, n]));
  const index = new Map<string, number>();
  const laneIndex = (nodeId: string): number => {
    if (index.has(nodeId)) return index.get(nodeId)!;
    const node = byId.get(nodeId);
    const family = node && !JUNCTION_KINDS.includes(node.kind) && familyOf(node, kinds);
    const at = family ? lanes.findIndex((l) => l.families.includes(family)) : -1;
    index.set(nodeId, at);
    return at;
  };
  // Who feeds each node, and whom it feeds; and the portals of each name.
  const [into, outOf] = [new Map<string, string[]>(), new Map<string, string[]>()];
  for (const r of workflow.connections ?? []) {
    const [from, to] = [socketOf(r.from).node, socketOf(r.to).node];
    into.set(to, [...(into.get(to) ?? []), from]);
    outOf.set(from, [...(outOf.get(from) ?? []), to]);
  }
  const portals = Object.groupBy(workflow.nodes.filter((n) => n.kind === 'portal' && n.values?.['name']), (n) => String(n.values!['name']));
  // A portal's other end: every portal of its name; going against the flow, an Out's In only.
  const named = (nodeId: string, back: boolean): string[] => {
    const node = byId.get(nodeId);
    const name = node?.kind === 'portal' ? node.values?.['name'] : undefined;
    if (!name || (back && node!.values?.['type'] !== 'out')) return [];
    return (portals[String(name)] ?? []).filter((n) => n.id !== nodeId && (!back || n.values?.['type'] !== 'out')).map((n) => n.id);
  };
  return (id) => {
    if (!lanes.length || id.startsWith('#')) return undefined;
    const own = laneIndex(id);
    if (own >= 0) return lanes[own]!.id;
    // The lanes of the laned nodes it reaches through other junction nodes: going against the flow (`back`), or either way.
    const reached = (back: boolean): Set<number> => {
      const lanesMet = new Set<number>();
      const seen = new Set([id]);
      let ring = [id];
      while (ring.length) {
        const next: string[] = [];
        for (const at of ring) {
          for (const other of [...(into.get(at) ?? []), ...(back ? [] : outOf.get(at) ?? []), ...named(at, back)]) {
            if (seen.has(other) || other.startsWith('#')) continue;
            seen.add(other);
            const lane = laneIndex(other);
            if (lane >= 0) lanesMet.add(lane);
            else next.push(other);
          }
        }
        ring = next;
      }
      return lanesMet;
    };
    // Under the lane its inputs come from, the lowest of them: junction nodes fed from one lane share its junction (TODO 928).
    const fed = reached(true);
    if (fed.size) return junctionOf(lanes[Math.max(...fed)]!);
    // Fed from no lane: by every lane it joins — under the one, or just above the lowest of several (915).
    const joined = reached(false);
    if (!joined.size) return undefined;
    const [top, bottom] = [Math.min(...joined), Math.max(...joined)];
    return junctionOf(lanes[top === bottom ? top : bottom - 1]!);
  };
}

/**
 * Each band that holds a node, top to bottom — a lane, then the junction under it — and the moves (new y, by node) that
 * keep each LANE_GAP clear of the one above. A node in no band is not moved.
 */
export function laneBands(workflow: Laned, heightOf: HeightOf, kinds: Kinds): { bands: LaneBand[]; moves: Record<string, number> } {
  const lanes = workflow.lanes ?? [];
  if (!lanes.length) return { bands: [], moves: {} };
  const bandOf = bandsOf(workflow, kinds);
  const where = Object.groupBy(workflow.nodes, (n) => bandOf(n.id) ?? '');
  const groups = lanes.flatMap((lane) => [lane.id, junctionOf(lane)]).map((id) => ({
    id,
    at: 0,
    skipEmpty: true,
    members: (where[id] ?? []).map((n) => ({ id: n.id, start: n.y, size: heightOf(n) })),
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
