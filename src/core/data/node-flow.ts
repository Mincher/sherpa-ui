/**
 * node-flow.ts — what flows into a node and out of it, as JSON, read from the graph's DEFINITION:
 * the connections and the values the rows hold; and the ONE reader of a graph as a condition, which the
 * Outgoing JSON shows and a Preset Filter compiles by. Nothing RUNS here: a run's values come with the
 * runner (N4). Each reads the graph as the data flows, through its portals. DOM-free. Will, TODOs 745, 776, 780, 783, 779
 * · TRAP T-a-preset-filter-is-a-preset-of-its-store · TRAP T-a-condition-is-a-tree-of-nodes · TRAP T-a-portal-hop-is-resolved-once
 *
 * Map:
 * - NodeFlow — A node's incoming and outgoing JSON.
 * - ConditionFacts — What reading a condition needs beyond its graph: the graph inside a use, drawn.
 * - RunBoolean — A part only a run gives: a boolean, named by where it comes from.
 * - Said — What a graph says as a condition: a tree, a constant that decides it, or a part only a run gives.
 * - ConditionRead — A condition read from a graph: what it says, each leaf naming its field, and each fault in words.
 * - conditionAt — The condition the connections into an input say, as ONE tree: And, Or, tests and uses read through.
 * - leafOf — One test as its node says it: the Field on its header, a comparison, Time's or a Tag's; or why it says none.
 * - nodeFlow — A node's flow, read from its graph; a fault in words for a node it does not hold.
 */
import { FALSE_SOCKET, ROWS, socketOf, type DrawnGraph, type GraphNode, type GraphRow, type NodeConnection } from './node-kinds.js';
import { coerce, readInput, truthOf } from './node-input.js';
import { portalFlow } from './node-portals.js';
import { OP_LABELS, OP_TAKES, type Condition, type ConditionLeaf, type Duration, type FilterOp } from './store.js';

/** A row's value as JSON writes it: a boolean as true or false, never 1 or 0, nor the words (COERCIONS, TODO 781). */
const inJson = (row: GraphRow): unknown => (row.gives ? coerce('json', { kind: row.gives, value: row.value })?.value ?? row.value : row.value);

/** A node's incoming and outgoing JSON: each socket, and what is connected to it or from it. */
export interface NodeFlow {
  incoming: readonly Record<string, unknown>[];
  outgoing: readonly Record<string, unknown>[];
  /** What the node stands for: a Condition's, a Tag's or a use's `where` tree, a Source's store, else its rows' values. */
  definition?: Record<string, unknown>;
}

/** What reading a condition needs beyond its graph: the graph inside a use of a Custom Node (an entity's),
 *  drawn, so its condition is read there, at its Group Output. None, a use says no condition. */
export interface ConditionFacts {
  inner?: (node: GraphNode) => DrawnGraph | undefined;
}

/** A part only a run gives: a boolean, named by where it comes from — "Source › True". TODO 780 */
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

/** A socket address in words: "Source › Rows"; a source's header is its True where the node forks. */
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

/** A drawn graph as the data flows: a connection from a portal's row is one from that row's source. */
type Flowing = DrawnGraph & { flowing: true };

/** A drawn graph as the data flows, by the ONE resolver; one read so already, as it is. TRAP T-a-portal-hop-is-resolved-once */
function flowing(graph: DrawnGraph): Flowing {
  return 'flowing' in graph ? (graph as Flowing) : { ...graph, connections: portalFlow(graph.nodes, graph.connections).connections, flowing: true };
}

/** The condition the connections into an input say, as ONE tree: each connection's source read, several ANDed. And and Or
 *  join what comes into them; a test — a Condition's comparison, Time, a Tag — is a leaf on the Field on its header,
 *  ANDed with what the rows into that Field carry; a use is read inside, at its Group Output, as `facts.inner` draws
 *  it. A node that says no condition is a fault. The Outgoing JSON shows what it reads, and a Preset Filter compiles
 *  by it. Plan 783 D7 · TRAP T-a-condition-is-a-tree-of-nodes */
export function conditionAt(graph: DrawnGraph, address: string, facts: ConditionFacts = {}): ConditionRead {
  return readAt(flowing(graph), address, facts, { seen: new Set(), path: [] });
}

function readAt(graph: Flowing, address: string, facts: ConditionFacts, walk: Walk): ConditionRead {
  return joined('and', graph.connections.filter((r) => r.to === address).map((r) => readFrom(graph, r.from, facts, walk)));
}

/** The condition an output socket sends: a test's True, a use's, or a fault where it says none. */
function readFrom(graph: Flowing, from: string, facts: ConditionFacts, walk: Walk): ConditionRead {
  const { node: id, row: at } = socketOf(from);
  const node = graph.nodes.find((n) => n.id === id);
  // A test's Results are the rows that pass it: they say its tree, as its True does (TODO 939).
  const row = at === ROWS.name && node && TESTS.has(node.kind) ? undefined : at;
  if (!node) return none(`a connection comes from "${id}", which the graph does not hold`);
  if (walk.seen.has(node.id)) return none(`"${node.heading}" reads itself, in a loop`);
  if (row === FALSE_SOCKET) return none(`"${node.heading}" › False is a boolean only, not rows: to keep the other rows, set the Check to its inverse`);
  return readNode(graph, node, row, facts, { ...walk, seen: new Set([...walk.seen, node.id]) });
}

/** The kinds whose True is a test of a field. */
const TESTS = new Set(['condition', 'time', 'tag']);

/** One test as its node says it: its field the Field on its header; a Condition's operator its Operation and its value
 *  Value B, the Values, or Start and End; Time's Between or Duration; a Tag's Includes. The ONE place a leaf is read
 *  (plan 783 D7). Why it says none, in words: no Field, or one that sends nothing. */
export function leafOf(drawn: DrawnGraph, node: GraphNode): { leaf: ConditionLeaf; field: GraphNode } | { fault: string } {
  const graph = flowing(drawn);
  const at = (name: string): unknown => node.rows.find((r) => r.name === name)?.value;
  const via = graph.connections.filter((r) => r.to === node.id).flatMap((r) => {
    const { node: id, row } = socketOf(r.from);
    const from = graph.nodes.find((n) => n.id === id);
    const out = from?.rows.find((x) => x.name === row);
    return from && out?.gives === 'field' ? [{ from, out }] : [];
  })[0];
  if (!TESTS.has(node.kind)) return { fault: `"${node.heading}" says no condition: connect a Condition` };
  if (!via || typeof via.out.value !== 'string' || !via.out.value) return { fault: `"${node.heading}" tests no Field: connect one in` };
  // A Field that reads null sends nothing, and says why.
  const silent = (via.from.warnings ?? []).find((w) => w.row === undefined || w.row === via.out.name);
  if (silent) return { fault: `"${node.heading}" tests "${via.from.heading}", which sends nothing: ${silent.words}` };
  const field = via.out.value;
  const type = String(at('type') ?? '');
  const ends = [at('start'), at('end')].filter((v) => v != null && v !== '');
  const leaf = (op: FilterOp, value: unknown): { leaf: ConditionLeaf; field: GraphNode } => ({ leaf: { field, op, value } as ConditionLeaf, field: via.from });
  if (node.kind === 'tag') return leaf('in', [at('value') ?? []].flat());
  if (node.kind === 'time') {
    const n = at('n');
    return type === 'duration' ? leaf((at('when') ?? 'last') as FilterOp, typeof n === 'number' ? { n, unit: (at('unit') ?? 'day') as Duration['unit'] } : undefined) : leaf('between', ends);
  }
  if (!(type in OP_LABELS)) return { fault: `"${node.heading}" is ${node.rows.find((r) => r.name === 'type')?.choices?.find((c) => c.value === type)?.label ?? type}, which a condition cannot say yet` };
  return leaf(type as FilterOp, OP_TAKES[type as FilterOp] === 'range' ? ends : at('b'));
}

/** What the rows into a Field carry, as a condition: a test's Rows row, the rows that hold it; a node that passes rows
 *  on (a Sort, a Field), what its own rows carry; a Source, nothing. */
function carried(graph: Flowing, node: GraphNode, facts: ConditionFacts, walk: Walk): ConditionRead {
  return joined('and', graph.connections.filter((r) => r.to === node.id).map((r): ConditionRead => {
    const { node: id, row } = socketOf(r.from);
    const from = graph.nodes.find((n) => n.id === id);
    if (!from || walk.seen.has(from.id) || row !== ROWS.name) return { faults: [] };
    const on = { ...walk, seen: new Set([...walk.seen, from.id]) };
    return TESTS.has(from.kind) ? readNode(graph, from, undefined, facts, on) : carried(graph, from, facts, on);
  }));
}

/** One part And or Or joins: a test's True, its Results or a use's brings its tree — one that says none is a boolean a run gives, and
 *  why stays said; a value the graph holds that says true or false is a CONSTANT, which folds; a boolean only a run gives
 *  is named by where it comes from; what the header cannot use (null) says nothing. TODO 780, plan 783 D4 */
function partFrom(graph: Flowing, via: NodeConnection, facts: ConditionFacts, walk: Walk): ConditionRead {
  const { node: id, row } = socketOf(via.from);
  const from = graph.nodes.find((n) => n.id === id);
  const run: ConditionRead = { tree: { boolean: said(graph, via.from, true) }, faults: [] };
  if (!from || (row === undefined && (TESTS.has(from.kind) || facts.inner?.(from))) || (row === ROWS.name && TESTS.has(from.kind))) {
    const nested = readFrom(graph, via.from, facts, walk);
    return nested.tree !== undefined || !from ? nested : { ...run, faults: nested.faults };
  }
  const out = row === undefined || row === FALSE_SOCKET ? undefined : from.rows.find((r) => r.name === row);
  if (!out) return run;
  if (out.control && (out.value === undefined || out.value === '')) return { faults: [] };
  const kind = out.gives ?? out.output;
  const read = kind && kind !== 'any' ? readInput({ label: '', needs: 'boolean' }, { kind, ...(out.control ? { value: out.value } : {}) }) : undefined;
  if (!read || read.warning) return { faults: [] };
  const constant = truthOf(read.value);
  return constant === undefined ? run : { tree: constant, faults: [] };
}

/** A node's own condition, read as its kind says: And and Or join what comes in; a test is a leaf on its Field. */
function readNode(graph: Flowing, node: GraphNode, row: string | undefined, facts: ConditionFacts, walk: Walk): ConditionRead {
  const at = (name: string): GraphRow | undefined => node.rows.find((r) => r.name === name);
  if (walk.path.includes(node.kind)) return none(`"${node.heading}" holds itself, in a loop`);
  const inner = facts.inner?.(node);
  if (inner) {
    // A use: the inside's Group Output, at the output it sends from; its header sends its first.
    const out = row ?? node.rows.find((r) => r.output)?.name;
    return out ? readAt(flowing(inner), `#out/${out}`, facts, { seen: new Set(), path: [...walk.path, node.kind] }) : none(`"${node.heading}" sends nothing out`);
  }
  if (row !== undefined) return none(`"${node.heading}" › ${at(row)?.label ?? row} is not its True`);
  const type = at('type')?.value;
  if (node.kind === 'condition' && (type === 'and' || type === 'or')) return joined(type, graph.connections.filter((r) => r.to === node.id).map((r) => partFrom(graph, r, facts, walk)));
  const read = leafOf(graph, node);
  if ('fault' in read) return none(read.fault);
  // The rows into its Field carry the tests before it: Source › Field › A › Rows › Field › B is A and B.
  return joined('and', [carried(graph, read.field, facts, walk), { tree: read.leaf, faults: [] }]);
}

/** A node's flow, from its graph. Incoming: each input socket, where its connections come from, and the value its row holds;
 *  what it cannot use is null, with its warning (TODO 764). Outgoing: each output socket and where it goes. A fault, in
 *  words, for an id the graph does not hold. A use's condition is read inside, given `facts.inner`. */
export function nodeFlow(graph: DrawnGraph, id: string, facts: ConditionFacts = {}): NodeFlow | { fault: string } {
  const node = graph.nodes.find((n) => n.id === id);
  if (!node) return { fault: `the graph holds no node "${id}"` };
  const into = (address: string): string[] => graph.connections.filter((r) => r.to === address).map((r) => said(graph, r.from, true));
  const onward = (address: string): string[] => graph.connections.filter((r) => r.from === address).map((r) => said(graph, r.to, false));
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
  const where = readNode(flowing(graph), node, undefined, facts, { seen: new Set([node.id]), path: [] }).tree;
  const definition = where !== undefined ? { where }
    : node.kind === 'source' ? { store: values['store'] ?? null }
      : Object.keys(values).length ? { rows: values } : undefined;
  return { incoming, outgoing, ...(definition ? { definition } : {}) };
}
