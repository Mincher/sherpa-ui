/**
 * node-paths.ts — is there a complete PATH from a Source to an Output? Fetch and Simulate need one. A path runs along the
 * kept routes, through the portals (an In and an Out of one name are joined) and through a use of a Custom Node whose
 * inside joins its Group Input to its Group Output. Frames change no data. Pure: no DOM. Will, TODO 836 ·
 * docs/history/plan-836-data-through-nodes.md · TRAP T-a-simulation-reads-the-cache-and-writes-nothing
 *
 * Map:
 * - PathFacts — What reading a path needs beyond its graph: the graph inside a use of a Custom Node, drawn.
 * - PathRead — Whether a graph has a path, the Sources that reach an Output, and why not, in words.
 * - isSource — Whether a node is a Source: it names a store.
 * - isOutput — Whether a node is an Output: the end of a path.
 * - pathRead — The Sources that reach an Output, or the words that say what is missing.
 */
import { portalFlow } from './node-portals.js';
import { socketOf, type DrawnGraph, type GraphNode } from './node-kinds.js';

/** What reading a path needs beyond its graph: the graph inside a use of a Custom Node, drawn. None, a use is no hop. */
export interface PathFacts {
  inner?: (node: GraphNode) => DrawnGraph | undefined;
}

/** Whether a graph has a path, the Sources that reach an Output, and why not, in words. */
export interface PathRead {
  ok: boolean;
  /** The ids of the Sources with a path to an Output. */
  sources: readonly string[];
  /** Each Source with no path, by id: Fetch leaves it. */
  unjoined: readonly string[];
  /** What is missing, in words: the tip of an inactive Fetch or Simulate. Left out when there is a path. */
  why?: string;
}

/** Whether a node is a Source: it names a store. */
export const isSource = (node: GraphNode): boolean => node.rows.some((r) => r.control === 'store');

/** Whether a node is an Output: the end of a path. */
export const isOutput = (node: GraphNode): boolean => node.category === 'Output';

/** The nodes a graph's routes reach from one node, as the data flows (a portal hop resolved). */
function reach(graph: DrawnGraph, start: string, facts: PathFacts, depth: number): Set<string> {
  const onward = new Map<string, string[]>();
  for (const r of portalFlow(graph.nodes, graph.routes).routes) {
    const [from, to] = [socketOf(r.from).node, socketOf(r.to).node];
    onward.set(from, [...(onward.get(from) ?? []), to]);
  }
  const held = new Map(graph.nodes.map((n) => [n.id, n]));
  const seen = new Set([start]);
  const queue = [start];
  for (let i = 0; i < queue.length; i++) {
    const at = queue[i]!;
    // A use is a hop only if its inside joins its Group Input to its Group Output.
    const node = held.get(at);
    const inside = node && depth < 8 ? facts.inner?.(node) : undefined;
    if (inside && !reach(inside, '#in', facts, depth + 1).has('#out')) continue;
    for (const to of onward.get(at) ?? []) if (!seen.has(to)) { seen.add(to); queue.push(to); }
  }
  return seen;
}

/** The Sources that reach an Output, or the words that say what is missing: no Source, no Output, or no path. */
export function pathRead(graph: DrawnGraph, facts: PathFacts = {}): PathRead {
  const sources = graph.nodes.filter(isSource).map((n) => n.id);
  const outputs = new Set(graph.nodes.filter(isOutput).map((n) => n.id));
  if (!sources.length) return { ok: false, sources: [], unjoined: [], why: 'Add a Source: Fetch and Simulate read its rows' };
  if (!outputs.size) return { ok: false, sources: [], unjoined: sources, why: 'Add an Output: Fetch and Simulate need a path to one' };
  const joined = sources.filter((id) => [...reach(graph, id, facts, 0)].some((n) => outputs.has(n)));
  if (!joined.length) return { ok: false, sources: [], unjoined: sources, why: 'No path from a Source to an Output: join Source › … › Output' };
  return { ok: true, sources: joined, unjoined: sources.filter((id) => !joined.includes(id)) };
}
