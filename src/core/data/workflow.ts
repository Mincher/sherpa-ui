/**
 * workflow.ts — a workflow, set up from ONE JSON document: its nodes, their values and the
 * routes between their sockets. Its check, the graph it draws, and its edits, each pure.
 * Its kinds are the one registry's. Will, TODO 78 · docs/history/plan-78-workflow-data.md
 * TRAP T-a-workflow-is-its-definition
 *
 * Map:
 * - WorkflowNode — One node, as a definition holds it: only what the reader may change.
 * - WorkflowDefinition — One workflow, as JSON — its nodes and its routes.
 * - workflowFaults — Every fault in a workflow, in words: a node, a kind, a value or a route that cannot be.
 * - checkWorkflow — Check every node, kind and route; each fault reports. True when none is.
 * - WorkflowFacts — What drawing a workflow needs that it does not say: the fields a row picks, the stores.
 * - workflowGraph — A workflow as nodes and routes: each node its kind's, at its own place, with its values.
 * - WorkflowEdit — One edit to a workflow: a row's value, a node's own name, line or place, a route made or cut.
 * - editWorkflow — The workflow after one edit; the one given untouched.
 */
import { report } from './report.js';
import { typedValue } from './filter-state.js';
import { DATE_OP_LABELS, OP_LABELS, OPS_FOR_TYPE, type FilterOp } from './store.js';
import {
  NODE_KINDS, kindNode, socketOf,
  type DrawnGraph, type GraphRow, type NodeKind, type NodeRoute, type SocketCarries,
} from './node-kinds.js';

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

/** One workflow, as JSON — its nodes and its routes. */
export interface WorkflowDefinition {
  v: 1;
  id: string;
  label?: string;
  nodes: readonly WorkflowNode[];
  routes?: readonly NodeRoute[];
}

type Kinds = Readonly<Record<string, NodeKind>>;

/** Every fault in a workflow, in words: a node, a kind, a value or a route that cannot be. */
export function workflowFaults(workflow: WorkflowDefinition, kinds: Kinds = NODE_KINDS): string[] {
  if (workflow?.v !== 1 || !Array.isArray(workflow.nodes)) return ['it is not a v1 workflow definition'];
  const problems: string[] = [];
  const byId = new Map<string, NodeKind>();
  for (const node of workflow.nodes) {
    const kind = kinds[node.kind];
    if (byId.has(node.id)) problems.push(`two nodes are "${node.id}"`);
    if (!kind) problems.push(`the node "${node.id}" is of the kind "${node.kind}", which is not one`);
    else if (!kind.graphs.includes('workflow')) problems.push(`the node "${node.id}" is of the kind "${node.kind}", which a workflow does not run`);
    else byId.set(node.id, kind);
    for (const [name, value] of Object.entries(node.values ?? {})) {
      const row = kind?.rows.find((r) => r.name === name);
      if (kind && !row) problems.push(`the node "${node.id}" holds a value for "${name}", a row its kind has not`);
      // A value is typed as its row's control takes it. TRAP T-a-value-is-typed-once
      else if (row?.control === 'op' && !(String(value) in OP_LABELS)) problems.push(`the node "${node.id}" holds "${String(value)}" as its ${row.label}, which is no operator`);
      else if (row?.control === 'number' && typeof value !== 'number') problems.push(`the node "${node.id}" holds "${String(value)}" as its ${row.label}, which is no number`);
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
  return problems;
}

/** Check every node, kind and route; each fault reports, and it never throws. True when none is. */
export function checkWorkflow(workflow: WorkflowDefinition, kinds: Kinds = NODE_KINDS): boolean {
  const problems = workflowFaults(workflow, kinds);
  for (const problem of problems) {
    report({ code: 'workflow-definition', message: `checkWorkflow: ${problem}.`, at: { workflow: workflow?.id } });
  }
  return !problems.length;
}

/** What drawing a workflow needs that it does not say: the fields a row picks, the stores. */
export interface WorkflowFacts {
  /** The fields a Field row picks, by name: a page definition's `source.fields`. */
  fields?: Readonly<Record<string, { label?: string; type?: string }>>;
  /** The stores a Store row picks, by the names the app registered them under. */
  stores?: readonly string[];
}

const DIRECTIONS = [{ value: 'asc', label: 'Ascending' }, { value: 'desc', label: 'Descending' }];

/** A workflow as nodes and routes: each node its kind's, at its own place, with its values.
 *  A row a route drives shows its own value, read only, until N4 runs the flow. */
export function workflowGraph(workflow: WorkflowDefinition, facts: WorkflowFacts = {}, kinds: Kinds = NODE_KINDS): DrawnGraph {
  const fields = Object.entries(facts.fields ?? {}).map(([value, f]) => ({ value, label: f.label ?? value }));
  // A value the facts do not list is still offered, so a select shows it.
  const withOwn = (list: readonly { value: string; label: string }[], own: unknown): { value: string; label: string }[] =>
    (own == null || own === '' || list.some((c) => c.value === String(own)) ? [...list] : [...list, { value: String(own), label: String(own) }]);
  const nodes = workflow.nodes.filter((n) => kinds[n.kind]).map((node) => {
    const values = node.values ?? {};
    const type = facts.fields?.[String(values['field'] ?? '')]?.type;
    const choices = (row: NodeKind['rows'][number]): GraphRow['choices'] => {
      const own = values[row.name];
      if (row.control === 'field') return withOwn(fields, own);
      if (row.control === 'store') return withOwn((facts.stores ?? []).map((s) => ({ value: s, label: s })), own);
      if (row.control === 'direction') return DIRECTIONS;
      if (row.control !== 'op') return undefined;
      const labels: Partial<Record<FilterOp, string>> = type === 'date' ? { ...OP_LABELS, ...DATE_OP_LABELS } : OP_LABELS;
      return withOwn((OPS_FOR_TYPE[type ?? 'text'] ?? []).map((op) => ({ value: op, label: labels[op] ?? op })), own);
    };
    const rows = kinds[node.kind]!.rows.map((row): GraphRow => {
      const list = choices(row);
      return { ...row, value: values[row.name], ...(row.control ? { editable: true } : {}), ...(list ? { choices: list } : {}) };
    });
    const own = { ...(node.heading ? { heading: node.heading } : {}), ...(node.description ? { description: node.description } : {}) };
    return { ...kindNode(kinds, node.kind, node.id, rows, own), x: node.x, y: node.y };
  });
  return { nodes, routes: [...workflow.routes ?? []] };
}

/** One edit to a workflow: a row's value, a node's own name, line or place, a route made
 *  (into an input, in place of the one there) or cut (by the input it enters). */
export type WorkflowEdit =
  | { node: string; row: string; value: unknown }
  | { node: string; set: Partial<Pick<WorkflowNode, 'heading' | 'description' | 'x' | 'y'>> }
  | { route: NodeRoute }
  | { cut: string };

/** The workflow after one edit; the one given untouched. A value is typed as its row takes it. */
export function editWorkflow(workflow: WorkflowDefinition, edit: WorkflowEdit, kinds: Kinds = NODE_KINDS): WorkflowDefinition {
  if ('route' in edit) {
    return { ...workflow, routes: [...(workflow.routes ?? []).filter((r) => r.to !== edit.route.to), { ...edit.route }] };
  }
  if ('cut' in edit) return { ...workflow, routes: (workflow.routes ?? []).filter((r) => r.to !== edit.cut) };
  const nodes = workflow.nodes.map((node) => {
    if (node.id !== edit.node) return node;
    if ('set' in edit) {
      // An empty name or line gives back its kind's.
      const set = Object.entries(edit.set).filter(([, v]) => v !== undefined);
      const gone = new Set(set.filter(([, v]) => v === '').map(([key]) => key));
      const kept = Object.entries(node).filter(([key]) => !gone.has(key));
      return Object.fromEntries([...kept, ...set.filter(([, v]) => v !== '')]) as unknown as WorkflowNode;
    }
    const row = kinds[node.kind]?.rows.find((r) => r.name === edit.row);
    const value = row?.control === 'number' ? typedValue('number', String(edit.value ?? '')) : edit.value;
    const { [edit.row]: _was, ...rest } = node.values ?? {};
    const values = value === '' || value == null ? rest : { ...rest, [edit.row]: value };
    const { values: _old, ...bare } = node;
    return Object.keys(values).length ? { ...bare, values } : bare;
  });
  return { ...workflow, nodes };
}
