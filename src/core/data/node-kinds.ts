/**
 * node-kinds.ts — the ONE registry of node kinds, for every graph Sherpa draws: a page's
 * Query and a workflow. Each kind once: its header, sockets, rows and what it stands for.
 * DOM-free. Will, TODOs 78, 555 · plan 695 N1 · TRAP T-one-node-registry
 *
 * Map:
 * - SocketCarries — What a socket carries: one value, or an object (a record, or rows).
 * - RowControl — The control a row draws: text, a number, a select, a switch or ticks.
 * - RowKind — One row a kind draws: its name, its label, its control and its sockets.
 * - NodeGraph — Where a kind is drawn: a page's Query, or a workflow.
 * - NodeKind — What a node IS: its header, its sockets, its rows, and what it stands for in the data layer.
 * - NODE_KINDS — Every kind the library ships, once. An app adds its own beside them.
 * - Socket — A socket address, read: its node, and its row or none for the header's.
 * - socketOf — Read a socket address: `node`, the header's, or `node/row`.
 * - NodeRoute — One route: an output socket to an input socket.
 * - GraphRow — One row as drawn: its kind's parts, the value it shows, and whether a reader may change it.
 * - GraphNode — One node as drawn: its header, its sockets, its rows and its place.
 * - DrawnGraph — Nodes and routes, ready to draw: a workflow's, or a page's Query.
 * - GraphEdit — One row a reader changed: its node, its row and the new value.
 * - NodePlaces — Each node's place by its id: where a reader moved it.
 * - kindNode — A node of a kind, its rows given: the kind's header and sockets, under its own.
 * - placed — A graph with each node at its kept place.
 */

/** What a socket carries: one value, or an object (a record, or rows). */
export type SocketCarries = 'value' | 'object';

/** The control a row draws: text, a number, a select of fields, operators, directions,
 *  stores or kinds; a switch; ticks. */
export type RowControl = 'text' | 'number' | 'field' | 'op' | 'direction' | 'store' | 'presentation' | 'switch' | 'values';

/** One row a kind draws: its name, its label, its control and its sockets. */
export interface RowKind {
  /** A route names the row by it, and a node keeps the row's value under it. */
  name: string;
  label: string;
  /** None: the row only names a socket, or shows a value. */
  control?: RowControl;
  input?: SocketCarries;
  output?: SocketCarries;
}

/** Where a kind is drawn: a page's Query, or a workflow. */
export type NodeGraph = 'query' | 'workflow';

/** What a node IS: its header, its sockets, its rows, and what it stands for in the data layer. */
export interface NodeKind {
  heading: string;
  icon: string;
  description?: string;
  /** The whole node's sockets, on its header. */
  input?: SocketCarries;
  output?: SocketCarries;
  /** Its fixed rows; a Query node adds its own after them (a scope's fields). */
  rows: readonly RowKind[];
  /** The data layer's name for what it stands for: a shape, or the function a workflow runs it by. */
  model: string;
  graphs: readonly NodeGraph[];
}

/** Every kind the library ships, once. An app adds its own beside them: `{ ...NODE_KINDS, mine }`. */
export const NODE_KINDS: Readonly<Record<string, NodeKind>> = {
  store: {
    heading: 'Store', icon: 'storage', description: 'Where the rows come from.', output: 'object',
    rows: [{ name: 'store', label: 'Store', control: 'store' }], model: 'Store', graphs: ['query', 'workflow'],
  },
  // A page's Query: its rows read left to right, as the data flows.
  status: {
    heading: 'Status field', icon: 'status-ok', description: 'Each row given a value by conditions on its other fields.',
    input: 'object', output: 'object', rows: [], model: 'StatusField', graphs: ['query'],
  },
  source: {
    heading: 'Source', icon: 'server', description: 'How the page reads its store.', input: 'object', output: 'object',
    rows: [
      { name: 'pageSize', label: 'Page size', control: 'number' },
      { name: 'search', label: 'Search fields', control: 'text' },
      { name: 'applyOn', label: 'Apply on', control: 'text' },
    ],
    model: 'SourceDefinition', graphs: ['query'],
  },
  // Its Switch, then a row per preset and per field it holds, each with an input.
  scope: {
    heading: 'Scope', icon: 'filter', input: 'object', output: 'object',
    rows: [{ name: '#filters', label: 'Filters', control: 'switch' }], model: 'ScopeQuery', graphs: ['query'],
  },
  condition: {
    heading: 'Condition', icon: 'function', output: 'value',
    rows: [
      { name: 'field', label: 'Field', control: 'field' },
      { name: 'op', label: 'Condition', control: 'op' },
      { name: 'value', label: 'Value', control: 'text' },
    ],
    model: 'FieldReading', graphs: ['query'],
  },
  // Its on, then each field it writes.
  preset: {
    heading: 'Preset', icon: 'star', description: 'The app\'s own named conditions: a chip leading its scope.', output: 'value',
    rows: [{ name: 'on', label: 'On', control: 'switch' }], model: 'ScopeDefinition.presets', graphs: ['query'],
  },
  saved: {
    heading: 'Saved filter', icon: 'floppy-disk', description: 'Filters kept under one name: a preset the reader made.', output: 'value',
    rows: [{ name: 'on', label: 'On', control: 'switch' }], model: 'SavedFilter', graphs: ['query'],
  },
  arrange: {
    heading: 'Arrange', icon: 'sort-ascending', description: 'The rows\' order, groups and search.', input: 'object', output: 'object',
    rows: [
      { name: 'sort', label: 'Sort', control: 'field' },
      { name: 'direction', label: 'Direction', control: 'direction' },
      { name: 'group', label: 'Group', control: 'field' },
      { name: 'search', label: 'Search', control: 'text' },
    ],
    model: 'Arrangement', graphs: ['query'],
  },
  presentation: {
    heading: 'Presentation', icon: 'insights', description: 'How a slot shows its rows.', input: 'object', output: 'object',
    rows: [
      { name: 'kind', label: 'Show as', control: 'presentation' },
      { name: 'primary', label: 'Primary', control: 'field' },
      { name: 'secondary', label: 'Secondary', control: 'field' },
      { name: 'group', label: 'Group', control: 'field' },
      { name: 'sort', label: 'Sort', control: 'direction' },
    ],
    model: 'Presentation', graphs: ['query'],
  },
  component: { heading: 'Component', icon: 'table-columns', input: 'object', rows: [], model: 'bindSource', graphs: ['query'] },
  // A workflow: each kind over the data-layer function it runs by.
  value: {
    heading: 'Value', icon: 'function', description: 'One value, typed.',
    rows: [{ name: 'value', label: 'Value', control: 'text', output: 'value' }], model: 'typedValue', graphs: ['workflow'],
  },
  pick: {
    heading: 'Pick', icon: 'price-tag', description: 'One field of the input.', input: 'object',
    rows: [{ name: 'field', label: 'Field', control: 'field', output: 'value' }], model: 'readField', graphs: ['workflow'],
  },
  // Its rows are one condition, `{ field, op, value }`: the condition tree's leaf.
  filter: {
    heading: 'Filter', icon: 'filter', description: 'The rows that match.', input: 'object', output: 'object',
    rows: [
      { name: 'field', label: 'Field', control: 'field' },
      { name: 'op', label: 'Condition', control: 'op' },
      { name: 'value', label: 'Value', control: 'text', input: 'value' },
      { name: 'matches', label: 'Matches', output: 'value' },
    ],
    model: 'filterRows', graphs: ['workflow'],
  },
  sort: {
    heading: 'Sort', icon: 'sort-ascending', description: 'The rows in order.', input: 'object', output: 'object',
    rows: [
      { name: 'field', label: 'Field', control: 'field' },
      { name: 'direction', label: 'Direction', control: 'direction' },
    ],
    model: 'sortRows', graphs: ['workflow'],
  },
  group: {
    heading: 'Group', icon: 'group', description: 'The rows by a field.', input: 'object', output: 'object',
    rows: [{ name: 'field', label: 'Field', control: 'field' }], model: 'groupRows', graphs: ['workflow'],
  },
  count: {
    heading: 'Count', icon: 'insights', description: 'How many rows.', input: 'object',
    rows: [{ name: 'count', label: 'Count', output: 'value' }], model: 'reduceRows', graphs: ['workflow'],
  },
  output: {
    heading: 'Output', icon: 'flag', description: 'Where the flow ends.', input: 'object', rows: [], model: 'LoadResult', graphs: ['workflow'],
  },
};

/** A socket address, read: its node, and its row or none for the header's. */
export interface Socket {
  node: string;
  row?: string;
}

/** Read a socket address: `node`, the header's, or `node/row`. */
export function socketOf(address: string): Socket {
  const at = address.indexOf('/');
  return at < 0 ? { node: address } : { node: address.slice(0, at), row: address.slice(at + 1) };
}

/** One route: an output socket to an input socket, each `node` or `node/row`. */
export interface NodeRoute {
  from: string;
  to: string;
}

/** One row as drawn: its kind's parts, the value it shows, and whether a reader may change it. */
export interface GraphRow extends RowKind {
  value?: unknown;
  /** A select's choices, by value. */
  choices?: readonly { value: string; label: string }[];
  /** A reader may change it; else it is read only. */
  editable?: boolean;
  /** A line under it: what it is, or why it is read only. */
  hint?: string;
}

/** One node as drawn: its header, its sockets, its rows and its place. */
export interface GraphNode {
  id: string;
  kind: string;
  heading: string;
  icon: string;
  description?: string;
  input?: SocketCarries;
  output?: SocketCarries;
  rows: readonly GraphRow[];
  x: number;
  y: number;
  /** What it stands for, for whoever takes its edits: a Query node's scope, field or preset. */
  ref?: Readonly<Record<string, string>>;
}

/** Nodes and routes, ready to draw: a workflow's, or a page's Query. */
export interface DrawnGraph {
  nodes: readonly GraphNode[];
  routes: readonly NodeRoute[];
}

/** One row a reader changed: its node, its row and the new value. */
export interface GraphEdit {
  node: GraphNode;
  row: GraphRow;
  value: unknown;
}

/** Each node's place by its id: where a reader moved it. */
export type NodePlaces = Readonly<Record<string, { x: number; y: number }>>;

/** A node of a kind, its rows given: the kind's header and sockets, under its own. */
export function kindNode(
  kinds: Readonly<Record<string, NodeKind>>, kind: string, id: string, rows: readonly GraphRow[], own: Partial<GraphNode> = {},
): Omit<GraphNode, 'x' | 'y'> {
  const k = kinds[kind]!;
  return {
    id, kind, heading: k.heading, icon: k.icon, rows,
    ...(k.description ? { description: k.description } : {}),
    ...(k.input ? { input: k.input } : {}),
    ...(k.output ? { output: k.output } : {}),
    ...own,
  };
}

/** A graph with each node at its kept place; one never moved stays where it was laid out. */
export function placed(graph: DrawnGraph, places: NodePlaces): DrawnGraph {
  return { ...graph, nodes: graph.nodes.map((n) => (places[n.id] ? { ...n, x: places[n.id]!.x, y: places[n.id]!.y } : n)) };
}
