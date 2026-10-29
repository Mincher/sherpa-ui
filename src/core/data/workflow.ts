/**
 * workflow.ts — a workflow, set up from ONE JSON document, and what each KIND of node is.
 * Its nodes, their values and the routes between their sockets; and the check. Will, TODO 78.
 * docs/history/plan-78-workflow-data.md · TRAP T-a-workflow-is-its-definition
 *
 * Map:
 * - SocketCarries — What a socket carries: one value, or an object (a record, or rows).
 * - RowField — The field a row draws: text, a number, a select of keys, conditions or stores.
 * - RowKind — One row a kind draws: its name, its label, its field and its sockets.
 * - NodeKind — What a node IS: its header, its sockets and its rows.
 * - NODE_KINDS — The generic kinds the library ships, each over a data-layer function. An app adds its own.
 * - WorkflowNode — One node, as a definition holds it: only what the reader may change.
 * - WorkflowRoute — One route: an output socket to an input socket.
 * - WorkflowDefinition — One workflow, as JSON — its nodes and its routes.
 * - Socket — A socket address, read: its node, and its row or none for the header's.
 * - socketOf — Read a socket address: `node`, the header's, or `node/row`.
 * - checkWorkflow — Check every node, kind and route; each fault reports. True when none is.
 */
import { report } from './report.js';

/** What a socket carries: one value, or an object (a record, or rows). */
export type SocketCarries = 'value' | 'object';

/** The field a row draws: text, a number, a select of keys, conditions or stores. */
export type RowField = 'text' | 'number' | 'key' | 'condition' | 'direction' | 'store';

/** One row a kind draws: its name, its label, its field and its sockets. */
export interface RowKind {
  /** A route names the row by it, and the node keeps the row's value under it. */
  name: string;
  label: string;
  /** None: the row only names a socket. */
  field?: RowField;
  input?: SocketCarries;
  output?: SocketCarries;
}

/** What a node IS: its header, its sockets and its rows. */
export interface NodeKind {
  heading: string;
  icon: string;
  description?: string;
  /** The whole node's sockets, on its header. */
  input?: SocketCarries;
  output?: SocketCarries;
  rows: readonly RowKind[];
}

/** The generic kinds the library ships, each over a data-layer function. An app adds its own. */
export const NODE_KINDS: Readonly<Record<string, NodeKind>> = {
  source: {
    heading: 'Source', icon: 'storage', description: 'The rows of a store.', output: 'object',
    rows: [{ name: 'store', label: 'Store', field: 'store' }],
  },
  value: {
    heading: 'Value', icon: 'function', description: 'One value, typed.',
    rows: [{ name: 'value', label: 'Value', field: 'text', output: 'value' }],
  },
  pick: {
    heading: 'Pick', icon: 'price-tag', description: 'One key of the input.', input: 'object',
    rows: [{ name: 'key', label: 'Key', field: 'key', output: 'value' }],
  },
  filter: {
    heading: 'Filter', icon: 'filter', description: 'The rows that match.', input: 'object', output: 'object',
    rows: [
      { name: 'key', label: 'Key', field: 'key' },
      { name: 'op', label: 'Condition', field: 'condition' },
      { name: 'value', label: 'Value', field: 'text', input: 'value' },
      { name: 'matches', label: 'Matches', output: 'value' },
    ],
  },
  sort: {
    heading: 'Sort', icon: 'sort-ascending', description: 'The rows in order.', input: 'object', output: 'object',
    rows: [
      { name: 'key', label: 'Key', field: 'key' },
      { name: 'direction', label: 'Direction', field: 'direction' },
    ],
  },
  group: {
    heading: 'Group', icon: 'group', description: 'The rows by a key.', input: 'object', output: 'object',
    rows: [{ name: 'key', label: 'Key', field: 'key' }],
  },
  count: {
    heading: 'Count', icon: 'insights', description: 'How many rows.', input: 'object',
    rows: [{ name: 'count', label: 'Count', output: 'value' }],
  },
  output: {
    heading: 'Output', icon: 'flag', description: 'Where the flow ends.', input: 'object', rows: [],
  },
};

/** One node, as a definition holds it: only what the reader may change. What it IS is its kind's. */
export interface WorkflowNode {
  id: string;
  kind: string;
  /** Its place on the canvas, in plane px. */
  x: number;
  y: number;
  /** Its own name and line, in place of its kind's. */
  heading?: string;
  description?: string;
  /** Each row's value, by the row's name. */
  values?: Readonly<Record<string, unknown>>;
}

/** One route: an output socket to an input socket, each `node` or `node/row`. */
export interface WorkflowRoute {
  from: string;
  to: string;
}

/** One workflow, as JSON — its nodes and its routes. */
export interface WorkflowDefinition {
  v: 1;
  id: string;
  label?: string;
  nodes: readonly WorkflowNode[];
  routes?: readonly WorkflowRoute[];
}

/** A socket address, read: its node, and its row or none for the header's. */
export interface Socket {
  node: string;
  row?: string;
}

/** Read a socket address: `node`, the header's, or `node/row`. */
export function socketOf(address: string): Socket {
  const [node = '', row] = address.split('/');
  return row === undefined ? { node } : { node, row };
}

/** Check every node, kind and route; each fault reports. True when none is. */
export function checkWorkflow(
  workflow: WorkflowDefinition,
  kinds: Readonly<Record<string, NodeKind>> = NODE_KINDS,
): boolean {
  const problems: string[] = [];
  if (workflow?.v !== 1 || !Array.isArray(workflow.nodes)) {
    problems.push('it is not a v1 workflow definition');
  } else {
    const byId = new Map<string, NodeKind>();
    for (const node of workflow.nodes) {
      const kind = kinds[node.kind];
      if (byId.has(node.id)) problems.push(`two nodes are "${node.id}"`);
      if (!kind) problems.push(`the node "${node.id}" is of the kind "${node.kind}", which is not one`);
      else byId.set(node.id, kind);
      for (const name of Object.keys(node.values ?? {})) {
        if (kind && !kind.rows.some((row) => row.name === name)) {
          problems.push(`the node "${node.id}" holds a value for "${name}", a row its kind has not`);
        }
      }
    }
    // What a socket carries, and which way: undefined when it is not one.
    const carries = (address: string, side: 'input' | 'output'): SocketCarries | undefined => {
      const { node, row } = socketOf(address);
      const kind = byId.get(node);
      if (!kind) return undefined;
      return row === undefined ? kind[side] : kind.rows.find((r) => r.name === row)?.[side];
    };
    const fed = new Set<string>();
    const next = new Map<string, string[]>();
    for (const { from, to } of workflow.routes ?? []) {
      const out = carries(from, 'output');
      const into = carries(to, 'input');
      if (!out) problems.push(`a route leaves "${from}", which is no output socket`);
      if (!into) problems.push(`a route enters "${to}", which is no input socket`);
      if (out && into && out !== into) problems.push(`the route "${from}" → "${to}" joins ${out === 'value' ? 'a value' : 'an object'} to ${into === 'value' ? 'a value' : 'an object'}`);
      if (fed.has(to)) problems.push(`two routes enter "${to}": an input takes one`);
      fed.add(to);
      const [a, b] = [socketOf(from).node, socketOf(to).node];
      next.set(a, [...(next.get(a) ?? []), b]);
    }
    // A loop has no first node to run.
    const done = new Set<string>();
    const walking = new Set<string>();
    const loops = (id: string): boolean => {
      if (walking.has(id)) return true;
      if (done.has(id)) return false;
      walking.add(id);
      const found = (next.get(id) ?? []).some(loops);
      walking.delete(id);
      done.add(id);
      return found;
    };
    if ([...next.keys()].some(loops)) problems.push('its routes run in a loop');
  }
  for (const problem of problems) {
    report({ code: 'workflow-definition', message: `checkWorkflow: ${problem}.`, at: { workflow: workflow?.id } });
  }
  return !problems.length;
}
