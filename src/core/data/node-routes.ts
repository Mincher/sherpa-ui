/**
 * node-routes.ts — a graph's ROUTES: each full path along its Connections from a Start node (a Source; inside a Custom Node,
 * its Group Input) to an End node (an Output; inside, its Group Output), and the BRANCHES where Routes part. Fetch and
 * Simulate need a Route. A Route runs along the kept Connections, through the portals (an In and an Out of one name are
 * joined) and through a use of a Custom Node whose inside joins its Group Input to its Group Output. Frames change no data.
 * Pure: no DOM. Will, TODO 836, plan 934 · TRAP T-a-simulation-reads-the-cache-and-writes-nothing · TRAP T-a-route-is-start-to-end
 *
 * Map:
 * - RouteFacts — What reading a Route needs beyond its graph: the graph inside a use of a Custom Node, drawn.
 * - RouteRead — Whether a graph has a Route, the Sources that reach an Output, and why not, in words.
 * - isSource — Whether a node is a Source: it names a store. A Start node.
 * - isOutput — Whether a node is an Output: an End node.
 * - routeRead — The Sources that reach an Output, or the words that say what is missing.
 * - routesOf — Each Route of a graph, Start node to End node, as the ids of its nodes.
 * - branchesAt — The Branches at a node: the Routes through it, by the node each goes to next.
 */
import { portalFlow } from './node-portals.js';
import { socketOf, type DrawnGraph, type GraphNode } from './node-kinds.js';

/** What reading a Route needs beyond its graph: the graph inside a use of a Custom Node, drawn. None, a use is no hop. */
export interface RouteFacts {
  inner?: (node: GraphNode) => DrawnGraph | undefined;
}

/** Whether a graph has a Route, the Sources that reach an Output, and why not, in words. */
export interface RouteRead {
  ok: boolean;
  /** The ids of the Sources with a Route to an Output. */
  sources: readonly string[];
  /** Each Source with no Route, by id: Fetch leaves it. */
  unjoined: readonly string[];
  /** What is missing, in words: the tip of an inactive Fetch or Simulate. Left out when there is a Route. */
  why?: string;
}

/** Whether a node is a Source: it names a store. A Start node. */
export const isSource = (node: GraphNode): boolean => node.rows.some((r) => r.control === 'store');

/** Whether a node is an Output: an End node. */
export const isOutput = (node: GraphNode): boolean => node.category === 'Output';

/** The nodes a graph's connections reach from one node, as the data flows (a portal hop resolved). */
function reach(graph: DrawnGraph, start: string, facts: RouteFacts, depth: number): Set<string> {
  const onward = new Map<string, string[]>();
  for (const r of portalFlow(graph.nodes, graph.connections).connections) {
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

/** The Sources that reach an Output, or the words that say what is missing: no Source, no Output, or no Route. */
export function routeRead(graph: DrawnGraph, facts: RouteFacts = {}): RouteRead {
  const sources = graph.nodes.filter(isSource).map((n) => n.id);
  const outputs = new Set(graph.nodes.filter(isOutput).map((n) => n.id));
  if (!sources.length) return { ok: false, sources: [], unjoined: [], why: 'Add a Source first' };
  if (!outputs.size) return { ok: false, sources: [], unjoined: sources, why: 'Add an Output first' };
  const joined = sources.filter((id) => [...reach(graph, id, facts, 0)].some((n) => outputs.has(n)));
  if (!joined.length) return { ok: false, sources: [], unjoined: sources, why: 'Join a Source to an Output' };
  return { ok: true, sources: joined, unjoined: sources.filter((id) => !joined.includes(id)) };
}

/** Each node's next nodes along the Connections, as the data flows (a portal hop resolved), in the order given. */
function onwardOf(graph: DrawnGraph): Map<string, string[]> {
  const onward = new Map<string, string[]>();
  for (const c of portalFlow(graph.nodes, graph.connections).connections) {
    const [from, to] = [socketOf(c.from).node, socketOf(c.to).node];
    const next = onward.get(from) ?? [];
    if (!next.includes(to)) next.push(to);
    onward.set(from, next);
  }
  return onward;
}

/** Each Route of a graph, Start node to End node, as the ids of its nodes: from each Source (and a Custom Node's
 *  Group Input, `#in`) to each Output (and its Group Output, `#out`) it reaches. A Value or a Field that nothing
 *  comes into feeds a Route; it starts none. A loop is walked once. At most `cap` Routes, the first found. */
export function routesOf(graph: DrawnGraph, cap = 200): string[][] {
  const onward = onwardOf(graph);
  const ids = new Set(graph.nodes.map((n) => n.id));
  const starts = [...graph.nodes.filter(isSource).map((n) => n.id), ...(ids.has('#in') ? ['#in'] : [])];
  const ends = new Set([...graph.nodes.filter(isOutput).map((n) => n.id), '#out']);
  const routes: string[][] = [];
  const walk = (route: string[]): void => {
    if (routes.length >= cap) return;
    const at = route[route.length - 1]!;
    if (ends.has(at) && route.length > 1) { routes.push(route); return; }
    for (const to of onward.get(at) ?? []) if (!route.includes(to)) walk([...route, to]);
  };
  for (const start of starts) walk([start]);
  return routes;
}

/** The Branches at a node: the Routes through it, by the node each goes to next. Fewer than two, and it is no
 *  place where Routes part: none. A Condition that forks (`branches`) parts its True and False here. */
export function branchesAt(graph: DrawnGraph, node: string, cap = 200): { to: string; routes: string[][] }[] {
  const by = new Map<string, string[][]>();
  for (const route of routesOf(graph, cap)) {
    const at = route.indexOf(node);
    if (at === -1 || at === route.length - 1) continue;
    const to = route[at + 1]!;
    by.set(to, [...(by.get(to) ?? []), route]);
  }
  return by.size < 2 ? [] : [...by].map(([to, routes]) => ({ to, routes }));
}
