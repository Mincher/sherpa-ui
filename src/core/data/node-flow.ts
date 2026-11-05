/**
 * node-flow.ts — what flows into a node and out of it, as JSON, read from the graph's DEFINITION:
 * the routes and the values the rows hold; and the ONE reader of a graph as a condition, which the
 * Outgoing JSON shows and a Preset Filter compiles by. Nothing RUNS here: a run's values come with the
 * runner (N4). DOM-free. Will, TODOs 745, 776, 780 · TRAP T-a-preset-filter-is-a-preset-of-its-store
 *
 * Map:
 * - NodeFlow — A node's incoming and outgoing JSON.
 * - ConditionFacts — What reading a condition needs beyond its graph: the graph inside a use, drawn.
 * - RunBoolean — A part only a run gives: a boolean, named by where it comes from.
 * - Said — What a graph says as a condition: a tree, a constant that decides it, or a part only a run gives.
 * - ConditionRead — A condition read from a graph: what it says, each leaf naming its field, and each fault in words.
 * - leafOf — One comparison of a Rows that hold, as its rows say it: its Field, Operator and Value.
 * - conditionAt — The condition the routes into an input say, as ONE tree: nested groups, And, Or and uses read through.
 * - nodeFlow — A node's flow, read from its graph; a fault in words for a node it does not hold.
 */
import { FALSE_SOCKET, partName, partOf, socketOf, type DrawnGraph, type GraphNode, type GraphRow } from './node-kinds.js';
import { coerce, truthOf } from './node-input.js';
import type { Condition } from './store.js';

/** A row's value as JSON writes it: a boolean as true or false, never 1 or 0, nor the words (COERCIONS, TODO 781). */
const inJson = (row: GraphRow): unknown => (row.gives ? coerce('json', { kind: row.gives, value: row.value })?.value ?? row.value : row.value);

/** A node's incoming and outgoing JSON: each socket, and what is routed to it or from it. */
export interface NodeFlow {
  incoming: readonly Record<string, unknown>[];
  outgoing: readonly Record<string, unknown>[];
  /** What the node stands for: a Condition's, a Tag's or a use's `where` tree, a Store's store, else its rows' values. */
  definition?: Record<string, unknown>;
}

/** What reading a condition needs beyond its graph: the graph inside a use of a Custom Node (an entity's),
 *  drawn, so its condition is read there, at its Group Output. None, a use says no condition. */
export interface ConditionFacts {
  inner?: (node: GraphNode) => DrawnGraph | undefined;
}

/** A part only a run gives: a boolean, named by where it comes from — "Store › True". TODO 780 */
export interface RunBoolean {
  boolean: string;
}

/** What a graph says as a condition: a tree of comparisons, its groups' parts any of these; `true` or `false`
 *  where a constant decides it; a part only a run gives. */
export type Said = Condition | boolean | RunBoolean;

/** A condition read from a graph: what it says, each leaf naming its field as its row holds it; and each fault in words. */
export interface ConditionRead {
  tree?: Said;
  faults: string[];
}

/** A socket address in words: "Store › Rows"; a source's header is its True where the node forks. */
function said(graph: DrawnGraph, address: string, source: boolean): string {
  const { node: id, row } = socketOf(address);
  const from = graph.nodes.find((n) => n.id === id);
  const part = row === FALSE_SOCKET ? 'False' : row ? from?.rows.find((r) => r.name === row)?.label : source && from?.branches ? 'True' : undefined;
  return [from?.heading ?? id, part].filter(Boolean).join(' › ');
}

/** No condition, and why. */
const none = (fault: string): ConditionRead => ({ faults: [fault] });

/** Several reads as one group, each one's faults kept. A constant folds: false ends All of, true ends Any of;
 *  the other drops out, and a group of constants alone is the one that does not end it. TODO 780 */
function joined(join: 'and' | 'or', reads: readonly ConditionRead[]): ConditionRead {
  const parts = reads.flatMap((r) => (r.tree !== undefined ? [r.tree] : []));
  const faults = reads.flatMap((r) => r.faults);
  if (!parts.length) return { faults };
  const ends = join === 'or';
  if (parts.includes(ends)) return { tree: ends, faults };
  const rest = parts.filter((p) => typeof p !== 'boolean');
  if (!rest.length) return { tree: !ends, faults };
  return { tree: rest.length === 1 ? rest[0]! : ({ [join]: rest } as unknown as Condition), faults };
}

/** Where a read is: the nodes of this graph it came through, and the uses it is inside. */
type Walk = { seen: ReadonlySet<string>; path: readonly string[] };

/** The condition the routes into an input say, as ONE tree: each route's source read, several ANDed. A
 *  Condition's Rows that hold, its Group rows each a nested tree or a constant; Logic And and Or, what comes in
 *  joined; a Tag's Includes; a use read inside, at its Group Output, as `facts.inner` draws it. A node that says
 *  no condition is a fault. The Outgoing JSON shows what it reads, and a Preset Filter compiles by it. */
export function conditionAt(graph: DrawnGraph, address: string, facts: ConditionFacts = {}): ConditionRead {
  return readAt(graph, address, facts, { seen: new Set(), path: [] });
}

function readAt(graph: DrawnGraph, address: string, facts: ConditionFacts, walk: Walk): ConditionRead {
  return joined('and', graph.routes.filter((r) => r.to === address).map((r) => readFrom(graph, r.from, facts, walk)));
}

/** The condition an output socket sends: a Condition's True, a use's, or a fault where it says none. */
function readFrom(graph: DrawnGraph, from: string, facts: ConditionFacts, walk: Walk): ConditionRead {
  const { node: id, row } = socketOf(from);
  const node = graph.nodes.find((n) => n.id === id);
  if (!node) return none(`a route comes from "${id}", which the graph does not hold`);
  if (walk.seen.has(node.id)) return none(`"${node.heading}" reads itself, in a loop`);
  if (row === FALSE_SOCKET) return none(`"${node.heading}" › False is the rows that do not hold, which a condition cannot say yet`);
  return readNode(graph, node, row, facts, { ...walk, seen: new Set([...walk.seen, node.id]) });
}

/** One comparison of a Rows that hold, as its rows say it: its Field, Operator and Value, part `n`. The one
 *  place a comparison is read: Field as a node of its own (plan 783) changes it here. */
export function leafOf(node: Pick<GraphNode, 'rows'>, n: number): Condition {
  const at = (name: string): unknown => node.rows.find((r) => r.name === partName(name, n))?.value;
  return { field: at('field') as string, op: at('op'), value: at('value') } as Condition;
}

/** A Group row's part: a nested Condition's True or a use's brings its tree; else the constant the row holds, or
 *  the boolean only a run gives, by where it comes from. What the row cannot use (null) says nothing. TODO 780
 *  TRAP T-a-condition-is-a-tree-of-nodes */
function groupPart(graph: DrawnGraph, node: GraphNode, group: GraphRow, facts: ConditionFacts, walk: Walk): ConditionRead {
  const via = graph.routes.find((r) => r.to === `${node.id}/${group.name}`);
  if (!via) return { faults: [] };
  const from = graph.nodes.find((n) => n.id === socketOf(via.from).node);
  const nested = from && socketOf(via.from).row === undefined && (from.kind === 'condition' || facts.inner?.(from)) ? readFrom(graph, via.from, facts, walk) : undefined;
  if (nested?.tree !== undefined) return nested;
  // A nested node that says no tree is a boolean a run gives; why it says none stays said.
  const faults = nested?.faults ?? [];
  if (group.value === null) return { faults };
  return { tree: truthOf(group.value) ?? { boolean: said(graph, via.from, true) }, faults };
}

/** A node's own condition: its rows', its nested groups' and what comes into it, read as its kind says. */
function readNode(graph: DrawnGraph, node: GraphNode, row: string | undefined, facts: ConditionFacts, walk: Walk): ConditionRead {
  const at = (name: string): GraphRow | undefined => node.rows.find((r) => r.name === name);
  if (node.kind === 'tag') return { tree: { field: at('field')?.value as string, op: 'in', value: [at('value')?.value ?? []].flat() }, faults: [] };
  if (walk.path.includes(node.kind)) return none(`"${node.heading}" holds itself, in a loop`);
  const inner = facts.inner?.(node);
  if (inner) {
    // A use: the inside's Group Output, at the output it sends from; its header sends its first.
    const out = row ?? node.rows.find((r) => r.output)?.name;
    return out ? readAt(inner, `#out/${out}`, facts, { seen: new Set(), path: [...walk.path, node.kind] }) : none(`"${node.heading}" sends nothing out`);
  }
  if (node.kind !== 'condition') return none(`"${node.heading}" says no condition: route a Condition`);
  if (row !== undefined) return none(`"${node.heading}" › ${at(row)?.label ?? row} is not its True`);
  const type = at('type')?.value;
  if (type === 'and' || type === 'or') return joined(type, graph.routes.filter((r) => r.to === node.id).map((r) => readFrom(graph, r.from, facts, walk)));
  // Rows that hold: a comparison for each part its rows name, a Group row's part where it has one.
  const parts = new Set(node.rows.map((r) => partOf(r.name)).filter(({ base }) => ['field', 'group'].includes(base)).map(({ part }) => part));
  if (!parts.size) return none(`"${node.heading}" compares values, not a field of rows: use Rows that hold`);
  const reads = [...parts].sort((a, b) => a - b).map((n): ConditionRead => {
    const group = at(partName('group', n));
    return group ? groupPart(graph, node, group, facts, walk) : { tree: leafOf(node, n), faults: [] };
  });
  // One part is the tree itself; several, the group its Join says.
  return joined(at('join')?.value === 'or' ? 'or' : 'and', reads);
}

/** A node's flow, from its graph. Incoming: each input socket, where its routes come from, and the value its row holds;
 *  what it cannot use is null, with its warning (TODO 764). Outgoing: each output socket and where it goes. A fault, in
 *  words, for an id the graph does not hold. A use's condition is read inside, given `facts.inner`. */
export function nodeFlow(graph: DrawnGraph, id: string, facts: ConditionFacts = {}): NodeFlow | { fault: string } {
  const node = graph.nodes.find((n) => n.id === id);
  if (!node) return { fault: `the graph holds no node "${id}"` };
  const into = (address: string): string[] => graph.routes.filter((r) => r.to === address).map((r) => said(graph, r.from, true));
  const onward = (address: string): string[] => graph.routes.filter((r) => r.from === address).map((r) => said(graph, r.to, false));
  const warned = (row?: string): { warning: string } | Record<string, never> => {
    const words = (node.warnings ?? []).filter((w) => w.row === row).map((w) => w.words);
    return words.length ? { warning: words.join('\n') } : {};
  };
  const incoming: Record<string, unknown>[] = [
    ...(node.input ? [{ socket: 'In', type: node.input, from: into(node.id), ...('warning' in warned() ? { value: null } : {}), ...warned() }] : []),
    ...node.rows.filter((r) => r.input).map((r) => ({
      socket: r.label, type: r.input, from: into(`${node.id}/${r.name}`), ...(r.value !== undefined && r.value !== '' ? { value: r.value } : {}), ...warned(r.name),
    })),
  ];
  const outgoing: Record<string, unknown>[] = [
    ...(node.output || node.branches ? [{ socket: node.branches ? 'True' : 'Out', type: node.output ?? 'boolean', to: onward(node.id) }] : []),
    ...(node.branches ? [{ socket: 'False', type: 'boolean', to: onward(`${node.id}/${FALSE_SOCKET}`) }] : []),
    ...node.rows.filter((r) => r.output).map((r) => ({
      socket: r.label, type: r.output, to: onward(`${node.id}/${r.name}`), ...(r.control && r.value !== undefined ? { carries: inJson(r) } : {}),
    })),
  ];
  const values = Object.fromEntries(node.rows.filter((r) => r.control && r.value !== undefined && r.value !== '').map((r) => [r.name, r.value]));
  // What its True says, where it says a condition: a Condition, a Tag, a use read inside.
  const where = readNode(graph, node, undefined, facts, { seen: new Set([node.id]), path: [] }).tree;
  const definition = where !== undefined ? { where }
    : node.kind === 'store' ? { store: values['store'] ?? null }
      : Object.keys(values).length ? { rows: values } : undefined;
  return { incoming, outgoing, ...(definition ? { definition } : {}) };
}
