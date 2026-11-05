/**
 * node-flow.ts — what flows into a node and out of it, as JSON, read from the graph's DEFINITION:
 * the routes and the values the rows hold. Nothing RUNS here: a run's values come with the runner (N4).
 * DOM-free. Will, TODO 745
 *
 * Map:
 * - NodeFlow — A node's incoming and outgoing JSON.
 * - nodeFlow — A node's flow, read from its graph; a fault in words for a node it does not hold.
 */
import { FALSE_SOCKET, partName, partOf, socketOf, type DrawnGraph, type GraphNode, type GraphRow } from './node-kinds.js';

/** A node's incoming and outgoing JSON: each socket, and what is routed to it or from it. */
export interface NodeFlow {
  incoming: readonly Record<string, unknown>[];
  outgoing: readonly Record<string, unknown>[];
  /** What the node stands for: a Condition's or a Tag's `where` tree, a Store's store, else its rows' values. */
  definition?: Record<string, unknown>;
}

/** A socket address in words: "Store › Rows"; a source's header is its True where the node forks. */
function said(graph: DrawnGraph, address: string, source: boolean): string {
  const { node: id, row } = socketOf(address);
  const from = graph.nodes.find((n) => n.id === id);
  const part = row === FALSE_SOCKET ? 'False' : row ? from?.rows.find((r) => r.name === row)?.label : source && from?.branches ? 'True' : undefined;
  return [from?.heading ?? id, part].filter(Boolean).join(' › ');
}

/** A Condition node as the tree it says: its parts joined, a nested group read from the node routed into its Group row.
 *  None, it draws no part: a check of another type. */
function whereOf(graph: DrawnGraph, node: GraphNode, seen: ReadonlySet<string> = new Set()): unknown {
  const row = (name: string): GraphRow | undefined => node.rows.find((r) => r.name === name);
  const parts = new Set(node.rows.map((r) => partOf(r.name)).filter(({ base }) => ['field', 'group'].includes(base)).map(({ part }) => part));
  if (!parts.size) return undefined;
  const made = [...parts].sort((a, b) => a - b).flatMap((n): unknown[] => {
    const group = row(partName('group', n));
    if (group) {
      const via = graph.routes.find((r) => r.to === `${node.id}/${group.name}`);
      const inner = via && graph.nodes.find((x) => x.id === socketOf(via.from).node);
      const tree = inner && !seen.has(inner.id) ? whereOf(graph, inner, new Set([...seen, node.id])) : undefined;
      return tree === undefined ? [] : [tree];
    }
    return [{ field: row(partName('field', n))?.value, op: row(partName('op', n))?.value, value: row(partName('value', n))?.value }];
  });
  const join = row('join')?.value === 'or' ? 'or' : 'and';
  return made.length === 1 ? made[0] : { [join]: made };
}

/** A Tag › Includes as the condition it says: its field is one of the tags, as Logic's Is one of says it. Plan 749 P5 */
function tagWhere(node: GraphNode): unknown {
  const at = (name: string): unknown => node.rows.find((r) => r.name === name)?.value;
  return { field: at('field'), op: 'in', value: [at('value') ?? []].flat() };
}

/** A node's flow, from its graph. Incoming: each input socket, where its routes come from, and the value its row holds.
 *  Outgoing: each output socket and where it goes. A fault, in words, for an id the graph does not hold. */
export function nodeFlow(graph: DrawnGraph, id: string): NodeFlow | { fault: string } {
  const node = graph.nodes.find((n) => n.id === id);
  if (!node) return { fault: `the graph holds no node "${id}"` };
  const into = (address: string): string[] => graph.routes.filter((r) => r.to === address).map((r) => said(graph, r.from, true));
  const onward = (address: string): string[] => graph.routes.filter((r) => r.from === address).map((r) => said(graph, r.to, false));
  const incoming: Record<string, unknown>[] = [
    ...(node.input ? [{ socket: 'In', type: node.input, from: into(node.id) }] : []),
    ...node.rows.filter((r) => r.input).map((r) => ({
      socket: r.label, type: r.input, from: into(`${node.id}/${r.name}`), ...(r.value !== undefined && r.value !== '' ? { value: r.value } : {}),
    })),
  ];
  const outgoing: Record<string, unknown>[] = [
    ...(node.output || node.branches ? [{ socket: node.branches ? 'True' : 'Out', type: node.output ?? 'boolean', to: onward(node.id) }] : []),
    ...(node.branches ? [{ socket: 'False', type: 'boolean', to: onward(`${node.id}/${FALSE_SOCKET}`) }] : []),
    ...node.rows.filter((r) => r.output).map((r) => ({
      socket: r.label, type: r.output, to: onward(`${node.id}/${r.name}`), ...(r.control && r.value !== undefined ? { carries: r.value } : {}),
    })),
  ];
  const values = Object.fromEntries(node.rows.filter((r) => r.control && r.value !== undefined && r.value !== '').map((r) => [r.name, r.value]));
  const where = node.kind === 'condition' ? whereOf(graph, node) : node.kind === 'tag' ? tagWhere(node) : undefined;
  const definition = where !== undefined ? { where }
    : node.kind === 'store' ? { store: values['store'] ?? null }
      : Object.keys(values).length ? { rows: values } : undefined;
  return { incoming, outgoing, ...(definition ? { definition } : {}) };
}
