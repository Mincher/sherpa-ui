/**
 * workflow.ts — a workflow, set up from ONE JSON document: its nodes, their values and the
 * routes between their sockets. Its check, the graph it draws, and its edits, each pure.
 * Its kinds are the one registry's. A v1 is read ONCE into v2. Will, TODOs 78, 713
 * · docs/history/plan-78-workflow-data.md · TRAP T-a-workflow-is-its-definition · TRAP T-a-socket-says-its-type · TRAP T-a-condition-is-a-tree-of-nodes
 *
 * Map:
 * - WorkflowNode — One node, as a definition holds it: only what the reader may change.
 * - WorkflowDefinition — One workflow, as JSON (v2) — its nodes and its routes.
 * - WorkflowDefinitionV1 — A workflow as v1 saved it: its data rows left from a node's header.
 * - WorkflowRead — A workflow read as v2, and each fault the read met.
 * - readWorkflow — A workflow as v2: a v1's header routes moved to its Rows row, once.
 * - GROW_MIN — The least a node's size may be: its natural size, as 1.
 * - GROW_MAX — The most a node's size may be: double its natural size, as 2.
 * - keptRoutes — The routes a node keeps for another of its types: drawn nowhere, no fault, not saved.
 * - finalGraph — A graph as Save writes it: what the draft keeps for a node's other types left out.
 * - workflowFaults — Every fault in a workflow, in words: a node, a kind, a value or a route that cannot be.
 * - checkWorkflow — Check every node, kind and route; each fault reports. True when none is.
 * - WorkflowFacts — What drawing a workflow needs that it does not say: the fields a row picks, the stores.
 * - sentFrom — What one output socket sends, read through the routes: a Field's column by what reaches it.
 * - workflowGraph — A workflow as nodes and routes: each node its kind's, at its own place, with its values.
 * - NODE_WIDTH — A node's width on the plane, in px: where its output socket is from its x.
 * - TIE_GAP — The gap between two routes in a zip tie, in px.
 * - tieLimit — The range a zip tie's x may take: between the nodes its shortest tied route joins.
 * - tiesAmong — The ties left when only some routes remain: a tie keeps its routes still there, and none, it goes.
 * - WorkflowEdit — One edit: a row, a node, a size, a route, a bend, a tie, nodes placed together, a node added or removed.
 * - editWorkflow — The workflow after one edit; the one given untouched.
 * - addCustomValue — A Value node made for a picklist row and routed into it: the row mirrors it, and keeps its own pick.
 */
import { report } from './report.js';
import { typedValue } from './filter-state.js';
import { OPS_FOR_TYPE, OP_LABELS, type FilterOp } from './store.js';
import {
  NODE_KINDS, ROWS, FALSE_SOCKET, LIST_OPS, accepts, drivenSwitch, fixedChoices, truthy, kindIn, kindNode, kindOfNode, mirrored, rowChoices, rowFault, rowOf, rowOfOtherType, socketOf, socketType, takesMany, typeChoices, typeOf,
  type GraphRow, type NodeSize, type NodeKind, type NodeRoute, type NodeTie, type RowKind, type SocketType,
} from './node-kinds.js';
import { bendFault, clampBend, dropBend, placeBend, withoutBends, type Bend } from './route-bends.js';
import type { FieldType } from './filter-state.js';
import type { NodeSnapshot } from './node-library.js';
import { columnOf, fieldWords, givenAt, needOf, readInput, truthOf, type ColumnField, type InputNeeds, type Reached } from './node-input.js';
import { frameFaults, framed, framesAmong, type FramedGraph, type NodeFrame } from './node-frames.js';

/** One node, as a definition holds it: only what the reader may change. What it IS is its kind's. */
export interface WorkflowNode {
  id: string;
  kind: string;
  /** Its place on the canvas, in plane px. */
  x: number;
  y: number;
  /** How far a reader grew it, in times its natural size, 1 to 2 each way. */
  size?: NodeSize;
  /** Its own name and line, in place of its kind's. */
  heading?: string;
  description?: string;
  /** Each row's value, by the row's name. */
  values?: Readonly<Record<string, unknown>>;
  /** A use of a Custom Node: the version of its definition it follows, and the definition it was made from. */
  version?: string;
  was?: NodeSnapshot;
}

/** One workflow, as JSON (v2) — its nodes and its routes. A node's data comes in on its
 *  header and leaves from its Rows row, `node/rows`; where it forks, its header sends True
 *  and `node/#false` False. */
export interface WorkflowDefinition {
  $schema?: string;
  v: 2;
  id: string;
  label?: string;
  nodes: readonly WorkflowNode[];
  routes?: readonly NodeRoute[];
  /** Zip ties: a place and the routes each funnels, in order. A tie changes no data; a runner ignores them. TODO 562 */
  ties?: readonly NodeTie[];
  /** Frames: nodes under one header. A frame changes no data; its box is drawn round its nodes. TODO 778 */
  frames?: readonly NodeFrame[];
}

/** A workflow as v1 saved it: the same, but its data rows left from a node's header. */
export interface WorkflowDefinitionV1 extends Omit<WorkflowDefinition, 'v'> {
  v: 1;
}

type Kinds = Readonly<Record<string, NodeKind>>;

/** A workflow read as v2, and each fault the read met; no workflow, it is not one. */
export interface WorkflowRead {
  workflow?: WorkflowDefinition;
  faults: string[];
}

/** One value as a list: text split at its commas, anything else alone. */
const asList = (value: unknown): unknown[] => (Array.isArray(value) ? value
  : typeof value === 'string' ? value.split(/[,\r\n]+/).map((v) => v.trim()).filter(Boolean) : value == null || value === '' ? [] : [value]);

/** A list as one value: one item itself, several joined by commas, so a list again splits them back. */
const asOne = (value: unknown): unknown => (!Array.isArray(value) ? value : value.length === 1 ? value[0] : value.map(String).join(', '));

/**
 * A workflow as v2: a v2 as it is, the one given; a v1 read ONCE — each route that left a
 * node's header, its data rows, now leaves its Rows row. One a v2 kind cannot send from
 * there (no Rows row, and its header sends only True) is dropped, and a fault says so: it
 * would mean another thing. A kind or a type is read as it is named: an old one is none
 * (TODO 777). Plan 713 D8. TRAP T-a-workflow-is-its-definition
 */
export function readWorkflow(given: WorkflowDefinition | WorkflowDefinitionV1, kinds: Kinds = NODE_KINDS): WorkflowRead {
  const v = (given as { v?: unknown } | null)?.v;
  if ((v !== 1 && v !== 2) || !Array.isArray(given.nodes)) return { faults: ['it is not a workflow definition: a v2, or a v1 to read as one'] };
  const workflow = given;
  if (workflow.v === 2) return { workflow, faults: [] };
  const faults: string[] = [];
  const kindOf = new Map(workflow.nodes.map((n) => [n.id, kindOfNode(kinds, n)]));
  const routes = (workflow.routes ?? []).flatMap((route): NodeRoute[] => {
    const { node, row } = socketOf(route.from);
    const kind = kindOf.get(node);
    // A row's route, a header that still sends its own, or one the check says is none: as it is.
    if (row !== undefined || !kind || (kind.output && !kind.branches)) return [route];
    if (kind.rows.some((r) => r.name === ROWS.name && r.output)) return [{ ...route, from: `${node}/${ROWS.name}` }];
    if (!kind.branches) return [route];
    // Its header sends True now: the same route would say another thing.
    faults.push(`the v1 route "${route.from}" → "${route.to}" sends rows from the header of "${node}", whose kind has no Rows row to send them from in v2`);
    return [];
  });
  const $schema = typeof workflow.$schema === 'string' ? { $schema: workflow.$schema.replace(/workflow\.v1\.json$/, 'workflow.v2.json') } : {};
  return { workflow: { ...workflow, ...$schema, v: 2, ...(workflow.routes ? { routes } : {}) }, faults };
}

/** A node's size runs from its natural size to double it, each way. */
export const GROW_MIN = 1;
export const GROW_MAX = 2;
const inGrowth = (n: unknown): boolean => typeof n === 'number' && n >= GROW_MIN && n <= GROW_MAX;

/** Whether a value or a socket names a row the node holds only under ANOTHER of its types. */
function keptRow(node: Pick<WorkflowNode, 'kind' | 'values'> | undefined, row: string | undefined, kinds: Kinds): boolean {
  // Only a type a workflow draws keeps a row: a Query's own is none of its.
  const kind = node && kinds[node.kind] && (kindIn(kinds[node.kind]!, 'workflow') ?? kinds[node.kind]);
  if (!node || !kind?.types || row === undefined || row === FALSE_SOCKET || rowOf(kindOfNode(kinds, node)!.rows, row)) return false;
  return !!rowOfOtherType(kind, node.values?.['type'], row);
}

/** Whether a route enters a family node's socket that is not there under its type now, and is under another: a
 *  Condition's header under a comparison, which takes nothing there. A socket that is there takes any route (TODO 770).
 *  TRAP T-a-logic-type-is-an-operator */
function retyped(route: NodeRoute, byId: ReadonlyMap<string, WorkflowNode>, kinds: Kinds): boolean {
  const into = socketOf(route.to);
  const to = byId.get(into.node);
  const family = to && kinds[to.kind];
  if (!to || !family?.types) return false;
  const has = (type?: string): boolean => {
    const kind = kindOfNode(kinds, type === undefined ? to : { ...to, values: { ...to.values, type } });
    return !!kind && !!socketType(kind, into.row, 'input');
  };
  const now = typeOf(family, to.values?.['type'])?.id;
  return !has() && Object.keys(family.types).some((t) => t !== now && has(t));
}

/** The routes a node keeps for another of its types: into or out of a row only that type has, or into a socket only
 *  another type has. The draft keeps them, so picking it back joins them again; none is drawn, none is a fault, and
 *  Save leaves them out (`finalGraph`). A route into a socket that is there is live, whatever it carries (TODO 770).
 *  Will, 2026-11-05 */
export function keptRoutes(workflow: Pick<WorkflowDefinition, 'nodes' | 'routes'>, kinds: Kinds = NODE_KINDS): NodeRoute[] {
  const byId = new Map(workflow.nodes.map((n) => [n.id, n]));
  const kept = (address: string): boolean => keptRow(byId.get(socketOf(address).node), socketOf(address).row, kinds);
  return (workflow.routes ?? []).filter((r) => kept(r.from) || kept(r.to) || retyped(r, byId, kinds));
}

/** A graph as Save writes it: each node with the values of its type's rows, and only the routes they join.
 *  What the draft keeps for another type is left out; so are the bends of a tied route, which the draft keeps
 *  unseen for its untying. Its ties keep the routes still there. Will, 2026-11-05 */
export function finalGraph<W extends Pick<WorkflowDefinition, 'nodes'> & Partial<Pick<WorkflowDefinition, 'routes' | 'ties' | 'frames'>>>(workflow: W, kinds: Kinds = NODE_KINDS): W {
  const gone = keptRoutes({ nodes: workflow.nodes, routes: workflow.routes ?? [] }, kinds);
  const nodes = workflow.nodes.map((node): WorkflowNode => {
    const lost = Object.keys(node.values ?? {}).filter((name) => keptRow(node, name, kinds));
    if (!lost.length) return node;
    const values = Object.fromEntries(Object.entries(node.values!).filter(([name]) => !lost.includes(name)));
    const { values: _was, ...bare } = node;
    return Object.keys(values).length ? { ...bare, values } : bare;
  });
  const live = (workflow.routes ?? []).filter((r) => !gone.includes(r));
  const ties = tiesAmong(workflow.ties, live);
  const tied = (r: NodeRoute): boolean => ties.some((t) => t.routes.some((x) => x.from === r.from && x.to === r.to));
  const bent = live.some((r) => r.via && tied(r));
  // A frame keeps the nodes still there; with none, it goes.
  const frames = framesAmong(workflow.frames, nodes.map((n) => n.id));
  const reframed = frames.length !== (workflow.frames?.length ?? 0) || frames.some((f, i) => f !== workflow.frames![i]);
  if (!gone.length && !bent && !reframed && nodes.every((n, i) => n === workflow.nodes[i])) return workflow;
  const routes = live.map((r) => {
    if (!r.via || !tied(r)) return r;
    const { via: _via, ...bare } = r;
    return bare;
  });
  const { ties: _ties, frames: _frames, ...rest } = workflow;
  return { ...rest, nodes, ...(workflow.routes ? { routes } : {}), ...(ties.length ? { ties } : {}), ...(frames.length ? { frames } : {}) } as unknown as W;
}

/** The field a node's rows read, its type, the values it may take and its words: what a typed Value B and a closed
 *  list read. */
interface ReadField {
  field: string;
  type?: string;
  known?: readonly string[];
  of: string;
}

/** The field a node's rows read: the Field whose column reaches its header — a Condition's, a Sort's, a Group by's, a
 *  Tag's (plan 783 D5). None: no Field comes in. */
function fieldAt(node: WorkflowNode, routes: readonly NodeRoute[], sends: (from: string) => Reached | undefined, facts: Pick<WorkflowFacts, 'values'> = {}): ReadField | undefined {
  const column = routes.filter((r) => r.to === node.id).map((r) => sends(r.from)).find((g) => g?.kind === 'field')?.field;
  if (!column) return undefined;
  const known = facts.values?.[column.name];
  return { field: column.name, ...(column.type ? { type: column.type } : {}), ...(known ? { known } : {}), of: column.label ?? column.name };
}

/** A row a node's field types: a value picked or typed, tags, a Start or an End. TRAP T-a-value-is-typed-once */
const typedRow = (row: Pick<RowKind, 'control'> | undefined): boolean => ['values', 'tags', 'text'].includes(row?.control ?? '');

/** A comparison's operator its field's type does not take, in words — "Contains takes a text field; it was given the
 *  Seats column"; none, it takes it. A warning, never a fault (plan 783 F2). */
function opWarning(op: unknown, read: ReadField | undefined): string | undefined {
  if (!read || typeof op !== 'string' || !(op in OP_LABELS) || LIST_OPS.includes(op as FilterOp)) return undefined;
  if (OPS_FOR_TYPE[read.type ?? 'text']?.includes(op as FilterOp)) return undefined;
  const types = Object.keys(OPS_FOR_TYPE).filter((t) => OPS_FOR_TYPE[t]!.includes(op as FilterOp));
  const said = new Intl.ListFormat('en', { type: 'disjunction' }).format(types);
  return `${OP_LABELS[op as FilterOp]} takes a ${said} field; it was given the ${read.of} column`;
}

/** A row as its node's field shapes it: a tags row is CLOSED to the field's values, where they are known. */
function shapedRow<R extends RowKind>(row: R, known: readonly string[] | undefined): R & Pick<GraphRow, 'closed' | 'choices'> {
  const choices = row.control === 'tags' ? rowChoices(row, known ? { values: known } : {}) : undefined;
  return choices ? { ...row, closed: true, choices } : row;
}

/** The fault of a value in a node's row, in words, as the row draws it; none, it holds. A number row's text is read as its number.
 *  TRAP T-a-row-says-its-own-fault */
function faultOf(row: RowKind, value: unknown, read: ReadField | undefined): string | undefined {
  return rowFault(shapedRow(row, read?.known), row.control === 'number' ? typedValue('number', value) : value, read?.of);
}

/** What a Value of a type wants that its value is not, in words — "a whole number"; none, it holds. */
function typedWants(type: unknown, value: unknown): string | undefined {
  if (typeof type !== 'string' || value === undefined) return undefined;
  const text = String(value);
  const n = typedValue('number', text);
  const wants: Readonly<Record<string, readonly [boolean, string]>> = {
    integer: [Number.isInteger(n), 'a whole number'], decimal: [typeof n === 'number', 'a number'],
    boolean: [/^(true|false)$/i.test(text.trim()), 'true or false'], date: [/^\d{4}-\d{2}-\d{2}/.test(text.trim()), 'a date'],
  };
  const [ok, what] = wants[type] ?? [true, ''];
  return ok ? undefined : what;
}

/** Every fault in a workflow, in words: a node, a kind, a value or a route that cannot be.
 *  A v1 is read as v2 first, and each fault of the read leads. A value its row cannot hold — a stranger
 *  in a closed list, no date, a number off its step — is a fault where it is held and where a route brings it. */
export function workflowFaults(given: WorkflowDefinition | WorkflowDefinitionV1, kinds: Kinds = NODE_KINDS, facts: Pick<WorkflowFacts, 'fields' | 'values'> = {}): string[] {
  const { workflow, faults } = readWorkflow(given, kinds);
  if (!workflow) return faults;
  const problems = [...faults];
  const byId = new Map<string, NodeKind>();
  // A route to a row another type holds is kept for that type: no fault, and Save leaves it out.
  const kept = keptRoutes(workflow, kinds);
  const live = (workflow.routes ?? []).filter((r) => !kept.includes(r));
  const held = new Map(workflow.nodes.map((n) => [n.id, n]));
  const sends = sender(held, live, kinds, facts);
  const reads = new Map<string, ReadField | undefined>();
  for (const node of workflow.nodes) {
    const shipped = kinds[node.kind];
    const kind = kindOfNode(kinds, node);
    if (byId.has(node.id)) problems.push(`two nodes are "${node.id}"`);
    if (!kind) problems.push(`the node "${node.id}" is of the kind "${node.kind}", which is not one`);
    else if (!kind.graphs.includes('workflow')) problems.push(`the node "${node.id}" is of the kind "${node.kind}", which a workflow does not run`);
    else byId.set(node.id, kind);
    if (node.size && !(inGrowth(node.size.w) && inGrowth(node.size.h))) problems.push(`the node "${node.id}" is sized ${node.size.w} by ${node.size.h} times its natural size, and a size runs from ${GROW_MIN} to ${GROW_MAX}`);
    const read = kind && fieldAt(node, live, sends, facts);
    reads.set(node.id, read);
    for (const [name, value] of Object.entries(node.values ?? {})) {
      const row = kind && rowOf(kind.rows, name);
      // A family's type is a value of its first row; the value of a row another type holds is KEPT.
      if (shipped?.types && name === 'type') {
        if (typeof value !== 'string' || !Object.hasOwn(shipped.types, value)) problems.push(`the node "${node.id}" holds "${String(value)}" as its ${shipped.typeLabel ?? 'Type'}, which is none of its choices`);
      } else if (shipped?.types && !row && rowOfOtherType(kindIn(shipped, 'workflow') ?? shipped, node.values?.['type'], name)) continue;
      else if (kind && !row) problems.push(`the node "${node.id}" holds a value for "${name}", a row its kind has not`);
      // A value is typed as its row's control takes it. TRAP T-a-value-is-typed-once
      else if (row?.control === 'op' && !(String(value) in OP_LABELS)) problems.push(`the node "${node.id}" holds "${String(value)}" as its ${row.label}, which is no operator`);
      else if (row?.control === 'number' && typeof value !== 'number') problems.push(`the node "${node.id}" holds "${String(value)}" as its ${row.label}, which is no number`);
      else if (row?.multiple && !Array.isArray(value)) problems.push(`the node "${node.id}" holds "${String(value)}" as its ${row.label}, which is no list`);
      else if (row && fixedChoices(row.control) && ![value].flat().every((v) => fixedChoices(row.control)!.some((c) => c.value === String(v)))) {
        problems.push(`the node "${node.id}" holds "${String(value)}" as its ${row.label}, which is none of its choices`);
      } else {
        const fault = row && faultOf(row, value, read);
        if (fault) problems.push(`the node "${node.id}"'s ${row!.label}: ${fault}`);
        // A comparison's value is of its field's type: a number field's is a number. Its operator only warns.
        const bad = row && read?.type === 'number' && kind?.model === 'Condition' && typedRow(row) && ![typedValue('number', value)].flat().every((v) => typeof v === 'number');
        if (bad) problems.push(`the node "${node.id}" holds "${String(value)}" as its ${row!.label}, which is no number, as "${read!.field}", a number field takes`);
      }
    }
    const what = kind?.model === 'typedValue' ? typedWants(node.values?.['type'], node.values?.['value']) : undefined;
    if (what) problems.push(`the node "${node.id}" holds "${String(node.values!['value'])}" as its Value, which is not ${what}`);
  }
  // What a socket carries, which way, and whether it takes many: undefined when it is not one.
  const at = (address: string, side: 'input' | 'output'): { type: SocketType; many: boolean } | undefined => {
    const { node, row } = socketOf(address);
    const kind = byId.get(node);
    const type = kind && socketType(kind, row, side);
    return kind && type && { type, many: takesMany(kind, row) };
  };
  // Each input's routes so far, by where they leave. Any type joins any input: what it cannot use reads null (TODO 770).
  const fed = new Map<string, string[]>();
  const next = new Map<string, string[]>();
  for (const route of workflow.routes ?? []) {
    const { from, to } = route;
    if (kept.includes(route)) continue;
    const bad = route.via === undefined ? undefined : bendFault(route.via);
    if (bad) problems.push(`the route "${from}" → "${to}": ${bad}`);
    const leaves = at(from, 'output');
    const out = leaves?.type === 'any' ? undefined : leaves;
    const into = at(to, 'input');
    const there = fed.get(to) ?? [];
    if (!leaves) problems.push(`a route leaves "${from}", which is no output socket`);
    else if (!out) problems.push(`a route leaves "${from}", which sends any type: an output says the one it sends`);
    // A Rows row only sends: a v1 habit, the rows in, says so.
    if (!into && socketOf(to).row === ROWS.name && byId.has(socketOf(to).node)) problems.push(`a route enters "${to}", a Rows row, which only sends: a node's rows come in on its header`);
    else if (!into) problems.push(`a route enters "${to}", which is no input socket`);
    if (there.includes(from)) problems.push(`the route "${from}" → "${to}" is there twice`);
    else if (there.length && !into?.many) problems.push(`two routes enter "${to}", which takes one`);
    fed.set(to, [...there, from]);
    // What a route brings from a node that holds it, its row must hold too; one of another type it reads as null.
    const [source, target] = [held.get(socketOf(from).node), held.get(socketOf(to).node)];
    const brought = socketOf(from).row === undefined ? undefined : source?.values?.[socketOf(from).row!];
    const row = target && into && rowOf(byId.get(target.id)!.rows, socketOf(to).row ?? '');
    const fault = row && out && accepts(out.type, into!.type) && brought !== undefined ? faultOf(row, brought, reads.get(target!.id)) : undefined;
    if (fault) problems.push(`the route "${from}" → "${to}": ${fault}`);
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
  const tied = new Set<string>();
  for (const tie of workflow.ties ?? []) {
    if (tied.has(tie.id)) problems.push(`two ties are "${tie.id}"`);
    tied.add(tie.id);
    if (!tie.routes?.length) problems.push(`the tie "${tie.id}" ties no route`);
    for (const r of tie.routes ?? []) {
      if (!(workflow.routes ?? []).some((x) => x.from === r.from && x.to === r.to)) problems.push(`the tie "${tie.id}" ties the route "${r.from}" → "${r.to}", which is not there`);
    }
  }
  problems.push(...frameFaults(workflow.frames, workflow.nodes.map((n) => n.id)));
  return problems;
}

/** Check every node, kind and route; each fault reports, and it never throws. True when none is. */
export function checkWorkflow(workflow: WorkflowDefinition | WorkflowDefinitionV1, kinds: Kinds = NODE_KINDS, facts: Pick<WorkflowFacts, 'fields' | 'values'> = {}): boolean {
  const problems = workflowFaults(workflow, kinds, facts);
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
  /** Every value a field may take, by the field: a Value row picks from them. */
  values?: Readonly<Record<string, readonly string[]>>;
}

/** The field a Field row picks, as it shows it — a Value routed in, else its own pick — with its words and type from the
 *  facts; `stranger` where the facts know fields and not this one. None: it picks none. Plan 783 D8 */
function pickedField(
  held: ReadonlyMap<string, WorkflowNode>, routes: readonly NodeRoute[], facts: Pick<WorkflowFacts, 'fields'>, address: string,
): { field: ColumnField; stranger?: true } | undefined {
  const { node: id, row = '' } = socketOf(address);
  const into = routes.find((r) => r.to === address && socketOf(r.from).row !== undefined);
  const brought = into ? held.get(socketOf(into.from).node)?.values?.[socketOf(into.from).row!] : undefined;
  const name = String(brought ?? held.get(id)?.values?.[row] ?? '');
  if (!name) return undefined;
  const known = facts.fields?.[name];
  const field: ColumnField = { name, ...(known?.label ? { label: known.label } : {}), ...(known?.type ? { type: known.type } : {}) };
  return { field, ...(facts.fields && !known ? { stranger: true as const } : {}) };
}

/** What each output socket sends, read through the routes: what its row gives (`givenAt`); a Field row, the column of what
 *  reaches its header or one record's value (`columnOf`), none where its field is a stranger or its header read null; the
 *  Rows row of a node its rows come into, rows only where its header reads rows, a column, an object, or a test's True or
 *  False that carries them (plan 783 D4). A loop sends what its kind says. Plan 783 D2 */
function sender(held: ReadonlyMap<string, WorkflowNode>, routes: readonly NodeRoute[], kinds: Kinds, facts: Pick<WorkflowFacts, 'fields'>): (from: string) => Reached | undefined {
  const busy = new Set<string>();
  const sends = (from: string): Reached | undefined => {
    const { node: id, row } = socketOf(from);
    const node = held.get(id);
    const kind = kindOfNode(kinds, node);
    const out = kind && row !== undefined ? rowOf(kind.rows, row) : undefined;
    const passes = out?.gives === 'rows' && !!kind!.input;
    if (!kind || !out || (out.gives !== 'field' && !passes) || busy.has(id)) return givenAt(node, row, kinds);
    const picked = passes ? undefined : pickedField(held, routes, facts, from);
    if (!passes && (!picked || picked.stranger)) return undefined;
    busy.add(id);
    try {
      const need = needOf(kind);
      // What its header reads of each route: what it cannot use is null.
      const heard = routes.filter((r) => r.to === id).map((r) => {
        const got = sends(r.from);
        return { from: r.from, got: got && need && readInput({ label: kind.heading, needs: need }, got).warning ? null : got };
      });
      if (passes) {
        const carries = heard.some(({ from: f, got }) => !!got && (['rows', 'field', 'object'].includes(got.kind)
          || (got.kind === 'boolean' && sends(`${socketOf(f).node}/${ROWS.name}`)?.kind === 'rows')));
        return carries ? { kind: 'rows' } : undefined;
      }
      return columnOf(picked!.field, heard[0]?.got);
    } finally {
      busy.delete(id);
    }
  };
  return sends;
}

/** What one output socket of a workflow sends, read through its routes: a Field's column, `{ rows, field }`, by what
 *  reaches its header and the facts' fields. None: it sends nothing before a run. Plan 783 D2 */
export function sentFrom(given: WorkflowDefinition | WorkflowDefinitionV1, from: string, facts: Pick<WorkflowFacts, 'fields'> = {}, kinds: Kinds = NODE_KINDS): Reached | undefined {
  const { workflow } = readWorkflow(given, kinds);
  if (!workflow) return undefined;
  const kept = keptRoutes(workflow, kinds);
  return sender(new Map(workflow.nodes.map((n) => [n.id, n])), (workflow.routes ?? []).filter((r) => !kept.includes(r)), kinds, facts)(from);
}

/** A workflow as nodes and routes, a v1 read as v2: each node its kind's, at its own place,
 *  with its values. A row a route drives is read only. Where the route comes from a node that
 *  holds its value (a Value), the row MIRRORS it — a picklist shows it marked Custom (D7) —
 *  and its own pick stays in the draft; else it shows its own until N4 runs the flow. What
 *  reaches an input that it cannot use reads null, and the node says why in `warnings`.
 *  TRAP T-a-node-reads-null-from-what-it-cannot-use */
export function workflowGraph(given: WorkflowDefinition | WorkflowDefinitionV1, facts: WorkflowFacts = {}, kinds: Kinds = NODE_KINDS): FramedGraph {
  const { workflow } = readWorkflow(given, kinds);
  if (!workflow) return { nodes: [], routes: [] };
  // A route kept for another type or operator is drawn nowhere, drives no row, nor holds its place in a tie.
  const kept = keptRoutes(workflow, kinds);
  const routes = (workflow.routes ?? []).filter((r) => !kept.includes(r));
  const held = new Map(workflow.nodes.map((n) => [n.id, n]));
  // What a route brings: its output row's value, where its node holds one; and where from, in words.
  const brings = (from: string): { value: unknown; said: string } | undefined => {
    const { node: id, row } = socketOf(from);
    const at = held.get(id);
    const out = row === undefined ? undefined : rowOf(kindOfNode(kinds, at)?.rows ?? [], row);
    const value = row === undefined ? undefined : at?.values?.[row];
    return at && out && value !== undefined ? { value, said: `${at.heading ?? kinds[at.kind]!.heading} › ${out.label}` } : undefined;
  };
  const sent = sender(held, routes, kinds, facts);
  const nodes = workflow.nodes.filter((n) => kinds[n.kind]).map((node) => {
    const values = node.values ?? {};
    const family = kinds[node.kind]!;
    const kind = kindOfNode(kinds, node)!;
    const at = typeOf(family, values['type']);
    // What each route into an input reads: what it brings, coerced (TODO 781); what it cannot use, null, and the node says why.
    const warnings: { row?: string; words: string }[] = [];
    const readsAt = (to: string, input: InputNeeds): Map<NodeRoute, ReturnType<typeof readInput>> => new Map(routes.flatMap((r) => {
      const got = r.to === to ? sent(r.from) : undefined;
      const read = got && readInput(input, got);
      if (read?.warning) warnings.push({ ...(to === node.id ? {} : { row: socketOf(to).row! }), words: read.warning });
      return read ? [[r, read] as const] : [];
    }));
    // A header's words name the node, or a family's type: "Sort takes a field".
    const head = needOf(kind);
    const headed = node.heading ?? (Object.keys(family.types ?? {}).length > 1 ? at?.type.label : undefined) ?? kind.heading;
    if (head) readsAt(node.id, { label: headed, needs: head });
    // The field its rows read: the Field reaching its header. Its operator warns where the field's type does not take it.
    const read = fieldAt(node, routes, sent, facts);
    const { type, known, of } = read ?? {};
    const op = kind.model === 'Condition' ? opWarning(at?.id, read) : undefined;
    if (op) warnings.push({ words: op });
    const rows = kind.rows.map((row): GraphRow => {
      const has = values[row.name];
      // A Value row with no values to pick from is typed, as it was.
      const plain = row.control === 'values' && !known?.length ? { ...row, control: 'text' as const } : row;
      // A Unit says its words for the count beside it: "1 day", "7 days".
      const count = row.control === 'unit' && typeof values['n'] === 'number' ? { count: values['n'] } : {};
      const list = rowChoices({ ...plain, value: has }, {
        ...(facts.fields ? { fields: facts.fields } : {}), ...(facts.stores ? { stores: facts.stores } : {}), ...(family.types ? { types: typeChoices(kindIn(family, 'workflow') ?? family)! } : {}), ...(known ? { values: known } : {}), ...(type ? { type } : {}), ...count,
      });
      // A Type row says the type's own value, and the line the type gives.
      const typed = row.control === 'type' ? { value: at?.id ?? '', ...(at?.type.help ? { hint: at.type.help } : {}) } : {};
      const closed = plain.control === 'tags' && list ? { closed: true as const } : {};
      const own: GraphRow = { ...plain, value: has, ...(plain.control ? { editable: true } : {}), ...(list ? { choices: list } : {}), ...closed, ...typed };
      // A fault of the value it shows, in words, as `workflowFaults` finds it: its own, or what a route brings.
      const said = (shown: GraphRow, routed = false): GraphRow => {
        const value = shown.control === 'number' ? typedValue('number', shown.value) : shown.value;
        const wants = kind.model === 'typedValue' && row.name === 'value' ? typedWants(at?.id, value) : undefined;
        const text = !routed && shown.control === 'number' && typeof value === 'string' && value.trim() !== '';
        const fault = wants ? `"${String(value)}" is not ${wants}` : text ? `"${String(value)}" is not a number` : rowFault(shown, value, of);
        return fault ? { ...shown, fault } : shown;
      };
      const address = `${node.id}/${row.name}`;
      const need = row.input ? needOf(row, typedRow(row) ? type : undefined) : undefined;
      const fixed = fixedChoices(row.control);
      const reads = need ? readsAt(address, { label: row.label, needs: need, ...(fixed ? { choices: fixed } : {}) }) : new Map<NodeRoute, ReturnType<typeof readInput>>();
      const bad = [...reads].filter(([, read]) => read.warning).map(([r]) => r);
      // What a route brings, as the row reads it: coerced, where COERCIONS reads it.
      const reading = (r: NodeRoute): { value: unknown; said: string } | undefined => {
        const brought = brings(r.from);
        const read = reads.get(r);
        return brought && read && read.value !== undefined ? { ...brought, value: read.value } : brought;
      };
      const coming = routes.filter((r) => r.to === address && !bad.includes(r)).flatMap((r) => reading(r) ?? []);
      // A Field row says its field and its type; one the rows do not have warns, and sends nothing (D8).
      const picked = row.gives === 'field' ? pickedField(held, routes, facts, address) : undefined;
      if (picked?.stranger) warnings.push({ row: row.name, words: `"${picked.field.name}" is not a field of the rows that come in` });
      const told = picked && !picked.stranger ? { hint: fieldWords(picked.field) } : {};
      // A switch is driven by the road a boolean names: a True socket is on, a False socket off.
      if (row.control === 'switch') {
        const ins = routes.filter((r) => r.to === address && !bad.includes(r));
        if (!ins.length) return bad.length ? { ...own, value: null } : own;
        const says = ins.map((r) => {
          const { node: id, row: out } = socketOf(r.from);
          if (out === FALSE_SOCKET) return false;
          const value = reading(r)?.value;
          return out === undefined ? !!kinds[held.get(id)?.kind ?? '']?.branches : truthOf(value) ?? truthy(value);
        });
        const at = (r: NodeRoute): string => { const n = held.get(socketOf(r.from).node); return n?.heading ?? kinds[n?.kind ?? '']?.heading ?? r.from; };
        return { ...own, ...drivenSwitch(says), hint: `Custom, from ${[...new Set(ins.map(at))].join(', ')}` };
      }
      // Only what it cannot use came in: it reads null, read only.
      if (!coming.length) return bad.length && bad.length === routes.filter((r) => r.to === address).length ? { ...own, value: null } : said({ ...own, ...told });
      const shown = mirrored(row, coming.map((c) => c.value), list);
      const from = [...new Set(coming.map((c) => c.said))].join(', ');
      // A list routed into tags OVERRIDES them (D7): its values show, read only; cut, the row's own are back.
      return said(list || row.control === 'tags'
        ? { ...own, ...shown, hint: `Custom ${row.multiple ? 'values' : 'value'}, from ${from}${told.hint ? `. ${told.hint}` : ''}` }
        : { ...own, value: shown.value }, true);
    });
    const heads = { ...(node.heading ? { heading: node.heading } : {}), ...(node.description ? { description: node.description } : {}) };
    return { ...kindNode({ ...kinds, [node.kind]: kind }, node.kind, node.id, rows, heads), x: node.x, y: node.y, ...(node.size ? { size: node.size } : {}), ...(warnings.length ? { warnings } : {}) };
  });
  const ties = kept.length ? tiesAmong(workflow.ties, routes) : workflow.ties ?? [];
  const frames = framesAmong(workflow.frames, nodes.map((n) => n.id));
  return { nodes, routes, ...(ties.length ? { ties } : {}), ...(frames.length ? { frames } : {}) };
}

/** A node's width on the plane, in px: its output socket is at its x plus this. */
export const NODE_WIDTH = 240;
/** The gap between two routes in a zip tie, in px. */
export const TIE_GAP = 12;

/**
 * The range a tie's x may take. Each tied route spans from its source's right edge
 * (`x + NODE_WIDTH`) to its target's `x`; the SHORTEST one's span is the range. A span
 * with the target left of its source is the one point halfway. None, no tied route is there.
 */
export function tieLimit(workflow: { nodes: readonly { id: string; x: number }[] }, tie: Pick<NodeTie, 'routes'>): { min: number; max: number } | undefined {
  const x = new Map(workflow.nodes.map((n) => [n.id, n.x]));
  const spans = tie.routes.flatMap((r) => {
    const [a, b] = [x.get(socketOf(r.from).node), x.get(socketOf(r.to).node)];
    return a === undefined || b === undefined ? [] : [{ min: a + NODE_WIDTH, max: b }];
  });
  if (!spans.length) return undefined;
  const short = spans.reduce((best, s) => (s.max - s.min < best.max - best.min ? s : best));
  if (short.max >= short.min) return short;
  const mid = (short.min + short.max) / 2;
  return { min: mid, max: mid };
}

/** The ties left when only these routes remain: a tie keeps its routes still there; with none, it goes. */
export function tiesAmong(ties: readonly NodeTie[] | undefined, routes: readonly NodeRoute[]): NodeTie[] {
  return (ties ?? []).flatMap((t) => {
    const kept = t.routes.filter((r) => routes.some((x) => x.from === r.from && x.to === r.to));
    return kept.length ? [kept.length === t.routes.length ? t : { ...t, routes: kept }] : [];
  });
}

/** One edit to a workflow: a row's value, a node's own name, line or place, a route made
 *  (into an input, in place of the one there, or beside it where the input takes many), or cut
 *  (each by the input it enters, or the one route), a node added (its id free), or removed
 *  with every route that touches it. */
export type WorkflowEdit =
  | { node: string; row: string; value: unknown }
  | { node: string; set: Partial<Pick<WorkflowNode, 'heading' | 'description' | 'x' | 'y' | 'version' | 'was'>> }
  | { route: NodeRoute }
  | { cut: string | NodeRoute }
  | { add: WorkflowNode }
  | { remove: string }
  | { resize: { node: string; w: number; h: number } }
  | { tie: { id?: string; x: number; y: number; routes: readonly NodeRoute[] } }
  | { untie: string }
  | { moveTie: { id: string; x?: number; y?: number } }
  | { tieAdd: { id: string; route: NodeRoute } }
  | { bend: { route: NodeRoute; at: number; x: number; y: number; insert?: boolean } }
  | { unbend: { route: NodeRoute; index: number } }
  | { place: { nodes: Readonly<Record<string, { x: number; y: number }>>; ties?: Readonly<Record<string, { x: number; y: number }>>; bends?: 'reset' | { dx: number; dy: number } } }
  | { frame: { nodes: readonly string[]; id?: string; label?: string; description?: string } }
  | { unframe: string }
  | { setFrame: { id: string; label?: string; description?: string } };

/** No value, empty text or an empty list: a row holding it holds none. */
const empty = (value: unknown): boolean => value === '' || value == null || (Array.isArray(value) && !value.length);

/** A node's values after its type or an operator changed: a row both shapes have, one value under one and a
 *  list under the other, takes its value along — split at its commas, or joined by them — so going back
 *  gives it again. Off is not gone. TRAP T-an-operator-shapes-its-value */
function reshape(node: WorkflowNode, values: Readonly<Record<string, unknown>>, kinds: Kinds, type: FieldType | undefined): Readonly<Record<string, unknown>> {
  const [before, after] = [kindOfNode(kinds, node)?.rows ?? [], kindOfNode(kinds, { ...node, values })?.rows ?? []];
  const moved = Object.entries(values).flatMap(([name, held]) => {
    const [was, now] = [rowOf(before, name), rowOf(after, name)];
    if (!was || !now || !!was.multiple === !!now.multiple) return [];
    const shaped = now.multiple ? asList(held) : asOne(held);
    return [[name, type && typedRow(now) ? typedValue(type, shaped) : shaped] as const];
  });
  if (!moved.length) return values;
  return Object.fromEntries([...Object.entries(values).filter(([name]) => !moved.some(([m]) => m === name)), ...moved.filter(([, v]) => !empty(v))]);
}

/** Why an edit was refused, said once through `report`. */
function refuse(message: string): void {
  report({ code: 'workflow-edit', message: `editWorkflow: ${message}.` });
}

/** The workflow after one edit, a v2 — a v1 read as one first; the one given untouched. A
 *  value is typed as its row takes it. */
export function editWorkflow(
  given: WorkflowDefinition | WorkflowDefinitionV1, edit: WorkflowEdit, kinds: Kinds = NODE_KINDS, facts: Pick<WorkflowFacts, 'fields'> = {},
): WorkflowDefinition {
  const workflow = readWorkflow(given, kinds).workflow;
  if (!workflow) return given as WorkflowDefinition;
  const same = (a: NodeRoute, b: NodeRoute): boolean => a.from === b.from && a.to === b.to;
  // A route that is gone leaves its ties, and a tie with none goes.
  const untied = (w: WorkflowDefinition): WorkflowDefinition => {
    if (!w.ties) return w;
    const { ties: _was, ...bare } = w;
    const ties = tiesAmong(w.ties, w.routes ?? []);
    return ties.length ? { ...bare, ties } : bare;
  };
  if ('route' in edit) {
    const routes = workflow.routes ?? [];
    if (routes.some((r) => same(r, edit.route))) return workflow;
    const { node, row } = socketOf(edit.route.to);
    const kind = kindOfNode(kinds, workflow.nodes.find((n) => n.id === node));
    const many = !!kind && takesMany(kind, row);
    return untied({ ...workflow, routes: [...routes.filter((r) => many || r.to !== edit.route.to), { ...edit.route }] });
  }
  // A route a tie takes drops its bends: a tie is its handle. TODO 754
  const unbent = (tied: readonly NodeRoute[]): Pick<WorkflowDefinition, 'routes'> =>
    (workflow.routes ? { routes: workflow.routes.map((r) => (r.via && tied.some((t) => same(t, r)) ? withoutBends(r) : r)) } : {});
  if ('tie' in edit) {
    const free = (n: number): string => ((workflow.ties ?? []).some((t) => t.id === `tie-${n}`) ? free(n + 1) : `tie-${n}`);
    const id = edit.tie.id ?? free(1);
    if ((workflow.ties ?? []).some((t) => t.id === id)) return workflow;
    const routes = edit.tie.routes.filter((r, i, all) => all.findIndex((q) => same(q, r)) === i).map(({ from, to }) => ({ from, to }));
    const limit = tieLimit(workflow, { routes });
    const x = limit ? Math.min(limit.max, Math.max(limit.min, edit.tie.x)) : edit.tie.x;
    return { ...workflow, ...unbent(routes), ties: [...(workflow.ties ?? []), { id, x, y: edit.tie.y, routes }] };
  }
  if ('untie' in edit) return untied({ ...workflow, ties: (workflow.ties ?? []).filter((t) => t.id !== edit.untie) });
  if ('moveTie' in edit) {
    const { id, x, y } = edit.moveTie;
    return { ...workflow, ties: (workflow.ties ?? []).map((t) => {
      if (t.id !== id) return t;
      const limit = tieLimit(workflow, t);
      const to = x === undefined ? t.x : limit ? Math.min(limit.max, Math.max(limit.min, x)) : x;
      return { ...t, x: to, y: y ?? t.y };
    }) };
  }
  if ('tieAdd' in edit) {
    const { id, route } = edit.tieAdd;
    const tie = (workflow.ties ?? []).find((t) => t.id === id);
    const name = `"${route.from}" → "${route.to}"`;
    if (!tie) return refuse(`the tie "${id}" is not there`), workflow;
    if (!(workflow.routes ?? []).some((r) => same(r, route))) return refuse(`the route ${name} is not there`), workflow;
    if (tie.routes.some((r) => same(r, route))) return refuse(`the route ${name} is in the tie "${id}" already`), workflow;
    const routes = [...tie.routes, { from: route.from, to: route.to }];
    // Its nodes must leave the tie where it stands: the tie moves only by the reader's hand.
    const limit = tieLimit(workflow, { routes });
    if (limit && (tie.x < limit.min || tie.x > limit.max)) return refuse(`the tie "${id}" cannot take ${name}: its nodes leave no room for the tie where it stands`), workflow;
    return { ...workflow, ...unbent([route]), ties: (workflow.ties ?? []).map((t) => (t.id === id ? { ...t, routes } : t)) };
  }
  if ('bend' in edit || 'unbend' in edit) {
    const { route, at } = 'bend' in edit ? edit.bend : { ...edit.unbend, at: edit.unbend.index };
    const held = (workflow.routes ?? []).find((r) => same(r, route));
    const name = `"${route.from}" → "${route.to}"`;
    if (!held) return refuse(`the route ${name} is not there`), workflow;
    let via: readonly Bend[] | undefined;
    if ('bend' in edit) {
      const { x, y, insert } = edit.bend;
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isInteger(at)) return refuse('a bend point needs a finite x and y, and a whole index'), workflow;
      if ((workflow.ties ?? []).some((t) => t.routes.some((r) => same(r, route)))) return refuse(`the route ${name} is tied: its ties are its handles`), workflow;
      if (at < 0 || at > (held.via?.length ?? 0) - (insert ? 0 : 1)) return refuse(`the route ${name} has no bend point at ${at}`), workflow;
      // Inside the end sockets, and clear of its neighbours: a bend never loops the line back.
      const [a, b] = [socketOf(route.from).node, socketOf(route.to).node].map((id) => workflow.nodes.find((n) => n.id === id));
      const placed = a && b ? clampBend({ from: a.x + NODE_WIDTH, to: b.x }, held.via, at, x, insert) : x;
      via = placeBend(held.via, at, placed, y, insert).via;
    } else {
      if (!held.via?.[at]) return refuse(`the route ${name} has no bend point at ${at}`), workflow;
      via = dropBend(held.via, at);
    }
    return { ...workflow, routes: (workflow.routes ?? []).map((r) => {
      if (r !== held) return r;
      const { via: _was, ...bare } = r;
      return via ? { ...bare, via } : bare;
    }) };
  }
  if ('place' in edit) {
    // Several nodes, and the ties and bends that go with them, in one edit: a group drag, or an arrange.
    const { nodes, ties, bends } = edit.place;
    const names = Object.keys(nodes);
    const fault = names.length < 2 ? 'placing nodes needs two or more'
      : names.find((id) => !workflow.nodes.some((n) => n.id === id)) !== undefined ? `the node "${names.find((id) => !workflow.nodes.some((n) => n.id === id))}" is not there`
        : Object.values({ ...nodes, ...ties }).some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y)) ? 'a place needs a finite x and y'
          : Object.keys(ties ?? {}).find((id) => !(workflow.ties ?? []).some((t) => t.id === id)) !== undefined ? `the tie "${Object.keys(ties ?? {}).find((id) => !(workflow.ties ?? []).some((t) => t.id === id))}" is not there` : undefined;
    if (fault) return refuse(fault), workflow;
    const moved = { ...workflow, nodes: workflow.nodes.map((n) => (nodes[n.id] ? { ...n, x: nodes[n.id]!.x, y: nodes[n.id]!.y } : n)) };
    const has = (r: NodeRoute, all: boolean): boolean => {
      const ends = [socketOf(r.from).node, socketOf(r.to).node].map((id) => id in nodes);
      return all ? ends.every(Boolean) : ends.some(Boolean);
    };
    const result: WorkflowDefinition = { ...moved };
    if (workflow.routes && bends) {
      result.routes = workflow.routes.map((r) => {
        if (!r.via || !has(r, bends === 'reset' ? false : true)) return r;
        const { via: _was, ...bare } = r;
        return bends === 'reset' ? bare : { ...bare, via: r.via.map((p) => ({ x: p.x + bends.dx, y: p.y + bends.dy })) };
      });
    }
    if (workflow.ties) {
      // A tie touching a moved node stays inside the range its nodes now leave it.
      result.ties = workflow.ties.map((t) => {
        const to = ties?.[t.id];
        const limit = tieLimit(moved, t);
        const touches = t.routes.some((r) => has(r, false));
        const x = to ? to.x : t.x;
        const held = limit && (to || touches) ? Math.min(limit.max, Math.max(limit.min, x)) : x;
        return to || held !== t.x ? { ...t, x: held, y: to ? to.y : t.y } : t;
      });
    }
    return result;
  }
  if ('resize' in edit) {
    const { node, w, h } = edit.resize;
    const size = { w: Math.round(w * 100) / 100, h: Math.round(h * 100) / 100 };
    return { ...workflow, nodes: workflow.nodes.map((n) => {
      if (n.id !== node) return n;
      // Natural size is no size kept.
      if (size.w === 1 && size.h === 1) { const { size: _was, ...bare } = n; return bare; }
      return { ...n, size };
    }) };
  }
  if ('frame' in edit || 'unframe' in edit || 'setFrame' in edit) return frameEdit(workflow, edit);
  if ('add' in edit) return workflow.nodes.some((n) => n.id === edit.add.id) ? workflow : { ...workflow, nodes: [...workflow.nodes, { ...edit.add }] };
  if ('remove' in edit) {
    const gone = (address: string): boolean => socketOf(address).node === edit.remove;
    const routes = (workflow.routes ?? []).filter((r) => !gone(r.from) && !gone(r.to));
    const nodes = workflow.nodes.filter((n) => n.id !== edit.remove);
    // It leaves its frame; a frame left with none goes.
    const { frames: _was, ...bare } = workflow;
    const frames = framesAmong(workflow.frames, nodes.map((n) => n.id));
    return untied({ ...bare, nodes, ...(workflow.routes ? { routes } : {}), ...(frames.length ? { frames } : {}) });
  }
  if ('cut' in edit) {
    const { cut } = edit;
    return untied({ ...workflow, routes: (workflow.routes ?? []).filter((r) => (typeof cut === 'string' ? r.to !== cut : !same(r, cut))) });
  }
  const nodes = workflow.nodes.map((node) => {
    if (node.id !== edit.node) return node;
    if ('set' in edit) {
      // An empty name or line gives back its kind's.
      const set = Object.entries(edit.set).filter(([, v]) => v !== undefined);
      const gone = new Set(set.filter(([, v]) => v === '').map(([key]) => key));
      const kept = Object.entries(node).filter(([key]) => !gone.has(key));
      return Object.fromEntries([...kept, ...set.filter(([, v]) => v !== '')]) as unknown as WorkflowNode;
    }
    const kind = kindOfNode(kinds, node);
    const row = kind && rowOf(kind.rows, edit.row);
    // A comparison's value, or a field's tags, is typed by the field that reaches it. TRAP T-a-value-is-typed-once
    const live = (workflow.routes ?? []).filter((r) => !keptRoutes(workflow, kinds).includes(r));
    const held = new Map(workflow.nodes.map((n) => [n.id, n]));
    const field = kind && fieldAt(node, live, sender(held, live, kinds, facts))?.type as FieldType | undefined;
    const type = typedRow(row) ? field : undefined;
    const list = row?.multiple ? [edit.value ?? []].flat().map(String) : undefined;
    const value = row?.control === 'number' ? typedValue('number', String(edit.value ?? ''))
      : type ? typedValue(type, list ?? edit.value)
      : list ?? (row?.control === 'datetime' && typeof edit.value === 'string' ? edit.value.trim() : edit.value);
    const { [edit.row]: _was, ...rest } = node.values ?? {};
    const set = empty(value) ? rest : { ...rest, [edit.row]: value };
    // A type or an operator may make a row it keeps hold a list, or one value: its value goes with it.
    const values = edit.row === 'type' ? reshape(node, set, kinds, field) : set;
    const { values: _old, ...bare } = node;
    return Object.keys(values).length ? { ...bare, values } : bare;
  });
  return { ...workflow, nodes };
}

/** A frame's edits: frame two or more nodes, release one (its nodes stay), or set its title and line. A refusal reports and
 *  writes nothing. TRAP T-a-frame-is-drawn-round-its-nodes */
function frameEdit(workflow: WorkflowDefinition, edit: Extract<WorkflowEdit, { frame: unknown } | { unframe: unknown } | { setFrame: unknown }>): WorkflowDefinition {
  const { frames: _was, ...bare } = workflow;
  const withFrames = (frames: readonly NodeFrame[]): WorkflowDefinition => (frames.length ? { ...bare, frames } : bare);
  if ('unframe' in edit) {
    if (!(workflow.frames ?? []).some((f) => f.id === edit.unframe)) return refuse(`the frame "${edit.unframe}" is not there`), workflow;
    return withFrames((workflow.frames ?? []).filter((f) => f.id !== edit.unframe));
  }
  if ('setFrame' in edit) {
    const { id, ...set } = edit.setFrame;
    if (!(workflow.frames ?? []).some((f) => f.id === id)) return refuse(`the frame "${id}" is not there`), workflow;
    // An empty title or line is none: the header says "Frame".
    return withFrames((workflow.frames ?? []).map((f) => {
      if (f.id !== id) return f;
      const said = Object.entries(set).filter(([, v]) => v !== undefined).map(([key, v]) => [key, v!.trim()] as const);
      const kept = Object.entries(f).filter(([key]) => !said.some(([k]) => k === key));
      return Object.fromEntries([...kept, ...said.filter(([, v]) => v)]) as unknown as NodeFrame;
    }));
  }
  const ids = [...new Set(edit.frame.nodes)];
  const missing = ids.find((id) => !workflow.nodes.some((n) => n.id === id));
  const fault = ids.length < 2 ? 'framing nodes needs two or more'
    : ids.some((id) => id.startsWith('#')) ? 'the Group Input and Output stand where their Custom Node puts them: they cannot be framed'
      : missing !== undefined ? `the node "${missing}" is not there`
        : edit.frame.id !== undefined && (workflow.frames ?? []).some((f) => f.id === edit.frame.id) ? `two frames would be "${edit.frame.id}"` : undefined;
  if (fault) return refuse(fault), workflow;
  return withFrames(framed(workflow.frames, ids, edit.frame));
}

/**
 * A Value node made for a picklist row, and routed into it: it holds the row's own pick, at
 * a place, and the row now mirrors it, read only. The pick stays on the row, so cutting the
 * route gives it back. The workflow given, untouched, where the row is no picklist, takes no
 * single value, or is not there. Plan 713 §5
 */
export function addCustomValue(
  given: WorkflowDefinition | WorkflowDefinitionV1, to: string, at: { x: number; y: number }, kinds: Kinds = NODE_KINDS,
): WorkflowDefinition {
  const workflow = readWorkflow(given, kinds).workflow;
  const { node: id, row: name } = socketOf(to);
  const into = workflow?.nodes.find((n) => n.id === id);
  const row = into && name !== undefined ? rowOf(kindOfNode(kinds, into)?.rows ?? [], name) : undefined;
  if (!workflow || !into || !row || row.input !== 'value' || row.many || rowChoices(row) === undefined) return workflow ?? (given as WorkflowDefinition);
  const free = (n: number): string => (workflow.nodes.some((x) => x.id === `value-${n}`) ? free(n + 1) : `value-${n}`);
  const own = into.values?.[name!];
  const made: WorkflowNode = { id: free(1), kind: 'value', x: at.x, y: at.y, ...(own !== undefined && own !== '' ? { values: { value: String(own) } } : {}) };
  return editWorkflow(editWorkflow(workflow, { add: made }, kinds), { route: { from: `${made.id}/value`, to } }, kinds);
}
