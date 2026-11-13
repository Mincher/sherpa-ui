/**
 * workflow.ts — a workflow, set up from ONE JSON document: its nodes, their values and the
 * connections between their sockets. Its check, the graph it draws, and its edits, each pure.
 * Its kinds are the one registry's. It is a v3. Will, TODOs 78, 713
 * · docs/history/plan-78-workflow-data.md · TRAP T-a-workflow-is-its-definition · TRAP T-a-socket-says-its-type · TRAP T-a-condition-is-a-tree-of-nodes
 *
 * Map:
 * - WorkflowNode — One node, as a definition holds it: only what the reader may change.
 * - WorkflowDefinition — One workflow, as JSON (v2) — its nodes and its connections.
 * - WorkflowRead — A workflow read as v2, and each fault the read met.
 * - readWorkflow — A workflow as v2, or the fault that it is none.
 * - GROW_MIN — The least a node's size may be: its natural size, as 1.
 * - GROW_MAX — The most a node's size may be: double its natural size, as 2.
 * - keptConnections — The connections a node keeps for another of its types: drawn nowhere, no fault, not saved.
 * - finalGraph — A graph as Save writes it: what the draft keeps for a node's other types left out.
 * - workflowFaults — Every fault in a workflow, in words: a node, a kind, a value or a connection that cannot be.
 * - checkWorkflow — Check every node, kind and connection; each fault reports. True when none is.
 * - WorkflowFacts — What drawing a workflow needs that it does not say: each store's fields, the stores.
 * - sentFrom — What one output socket sends, read through the connections: a Field's column by what reaches it.
 * - workflowGraph — A workflow as nodes and connections: each node its kind's, at its own place, with its values.
 * - NODE_WIDTH — A node's width on the plane, in px: where its output socket is from its x.
 * - TIE_GAP — The gap between two connections in a zip tie, in px.
 * - tieLimit — The range a zip tie's x may take: between the nodes its shortest tied connection joins.
 * - tiesAmong — The ties left when only some connections remain: a tie keeps its connections still there, and none, it goes.
 * - WorkflowEdit — One edit: a row, a node, a size, a connection, a bend, a tie, nodes placed together, a node added or removed.
 * - nodeWidth — A node's width on the canvas, in plane px: what a stage holds.
 * - editWorkflow — The workflow after one edit; the one given untouched.
 * - addCustomValue — A Value node made for a picklist row and connected to it: the row mirrors it, and keeps its own pick.
 */
import { nodeTitle } from './node-title.js';
import { entityGraph, type Entity } from './entity.js';
import { recipientTypes } from './entity-types.js';
import { startLoops } from './output-triggers.js';
import { report } from './report.js';
import { typedValue } from './filter-state.js';
import { OPS_FOR_TYPE, OP_LABELS, type FilterOp } from './store.js';
import { nodeKinds, ROWS, LIST_OPS, accepts, conditionFits, fitsCondition, CONDITION_INPUT_WORDS, type ConditionInput, drivenSwitch, fixedChoices, truthy, kindNode, kindOfNode, mirrored, rowChoices, rowFault, rowOf, rowOfOtherType, socketOf, socketType, takesMany, typeChoices, typeOf, type GraphRow, type RowChoice, type NodeSize, type NodeKind, type NodeConnection, type NodeTie, type RowKind, type SocketType } from './node-kinds.js';
import { bendFault, clampBend, dropBend, placeBend, withoutBends, type Bend } from './connector-bends.js';
import type { FieldType } from './filter-state.js';
import type { NodeSnapshot } from './node-library.js';
import { columnOf, fieldWords, givenAt, INPUT_WORDS, needOf, pickSent, readInput, truthOf, type ColumnField, type InputNeeds, type Reached } from './node-input.js';
import { frameFaults, framed, framesAmong, type FramedGraph, type NodeFrame } from './node-frames.js';
import { laneFaults, type NodeLane } from './node-lanes.js';
import { orderStages, resizeStage, restage, stageFaults, stagesHeld, stageBands, STAGE_GAP, type NodeStage } from './node-stages.js';
import { addressRow, portalFlow, portalHint, portalNames, portalOf, renamedPortals, type FlowConnection, type PortalFlow } from './node-portals.js';
import { unreachedValues, valuesAt, valuesIn, type MessageSource } from './node-messages.js';
import { NEW_CHOICE } from './ai-catalog.js';
import { hasStart, primaryOf, startFaults, unstarted, withStart, withStartKind, type ModelPick } from './node-start.js';

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
  /** The stage it is in: one of its workflow's `stages`. None, with stages written, it joins the nearest at the next fit. */
  stage?: string;
}

/** One workflow, as JSON (v3): its nodes and its connections. A node's data comes in on its header and leaves from its
 *  Rows row, `node/rows`. */
export interface WorkflowDefinition {
  $schema?: string;
  v: 3;
  id: string;
  label?: string;
  nodes: readonly WorkflowNode[];
  connections?: readonly NodeConnection[];
  /** Zip ties: a place and the connections each funnels, in order. A tie changes no data; a runner ignores them. TODO 562 */
  ties?: readonly NodeTie[];
  /** Frames: nodes under one header. A frame changes no data; its box is drawn round its nodes. TODO 778 */
  frames?: readonly NodeFrame[];
  /** Stages: columns across the canvas, left to right; a node names its own. A stage changes no data. None, it has one. */
  stages?: readonly NodeStage[];
  /** Swimlanes: rows down the canvas, one for each family of nodes, top to bottom; a logic node stands in a junction. None, off. */
  lanes?: readonly NodeLane[];
  /** Each node's place before Swimlanes were turned on: turning them off puts it back (TODO 929). */
  beforeLanes?: Readonly<Record<string, { x: number; y: number }>>;
  /** Not laid out yet, as a graph an agent made: the editor unfurls it the first time it shows it, and saves it without
   *  this (TODO 958). */
  unfurl?: true;
}

type Kinds = Readonly<Record<string, NodeKind>>;

/** A workflow read as v3, and each fault the read met; no workflow, it is not one. */
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
 * A workflow as v3, the one given; anything else is none, and says so. A kind or a type is
 * read as it is named: an old one is none (TODO 777). No v1 ships: its read is gone (Will,
 * 2026-11-10). TRAP T-a-workflow-is-its-definition
 */
export function readWorkflow(given: WorkflowDefinition): WorkflowRead {
  const v = (given as { v?: unknown } | null)?.v;
  if (v !== 3 || !Array.isArray(given.nodes)) return { faults: ['it is not a workflow definition: a v3'] };
  return { workflow: given, faults: [] };
}

/** A node's size runs from its natural size to double it, each way. */
export const GROW_MIN = 1;
export const GROW_MAX = 2;
const inGrowth = (n: unknown): boolean => typeof n === 'number' && n >= GROW_MIN && n <= GROW_MAX;

/** Whether a value or a socket names a row the node holds only under ANOTHER of its types. */
function keptRow(node: Pick<WorkflowNode, 'kind' | 'values'> | undefined, row: string | undefined, kinds: Kinds): boolean {
  const kind = node && kinds[node.kind];
  if (!node || !kind?.types || row === undefined || rowOf(kindOfNode(kinds, node)!.rows, row)) return false;
  return !!rowOfOtherType(kind, node.values?.['type'], row);
}

/** Whether a connection enters or leaves a family node's socket that is not there under its type now, and is under another:
 *  a Condition's header under a comparison, which takes nothing there; a portal's Out header, an In now. A socket that is
 *  there takes any connection (TODO 770). TRAP T-a-logic-type-is-an-operator */
function retyped(connection: NodeConnection, byId: ReadonlyMap<string, WorkflowNode>, kinds: Kinds): boolean {
  return ([['to', 'input'], ['from', 'output']] as const).some(([end, side]) => {
    const at = socketOf(connection[end]);
    const node = byId.get(at.node);
    const family = node && kinds[node.kind];
    if (!node || !family?.types) return false;
    const has = (type?: string): boolean => {
      const kind = kindOfNode(kinds, type === undefined ? node : { ...node, values: { ...node.values, type } });
      return !!kind && !!socketType(kind, at.row, side);
    };
    const now = typeOf(family, node.values?.['type'])?.id;
    return !has() && Object.keys(family.types).some((t) => t !== now && has(t));
  });
}

/** The connections a node keeps for another of its types: into or out of a row only that type has, or into a socket only
 *  another type has; and out of a portal's row whose connection into an In is gone (TODO 826). The draft keeps them, so
 *  picking it back joins them again; none is drawn, none is a fault, and Save leaves them out (`finalGraph`). A connection
 *  into a socket that is there is live, whatever it carries (TODO 770). Will, 2026-11-05 */
export function keptConnections(workflow: Pick<WorkflowDefinition, 'nodes' | 'connections'>, kinds: Kinds = nodeKinds()): NodeConnection[] {
  return flowOf(workflow, kinds).kept;
}

/** What one read of a workflow gives: the connections kept, the rest, the rest as the data flows, and each node's kind. */
interface Flow {
  kept: NodeConnection[];
  live: NodeConnection[];
  flow: PortalFlow;
  /** A node's kind as drawn: a portal's Out with a row per connection into an In of its name. */
  kindOf: (node: WorkflowNode | undefined) => NodeKind | undefined;
}

/** A workflow's connections: those kept for another type or a gone row, the rest, and the rest as the data flows through its
 *  portals — the ONE read every reader of what flows takes; the drawing takes the rest. TRAP T-a-portal-hop-is-resolved-once */
function flowOf(workflow: Pick<WorkflowDefinition, 'nodes' | 'connections'>, kinds: Kinds): Flow {
  const held = new Map(workflow.nodes.map((n) => [n.id, n]));
  const keep = (address: string): boolean => keptRow(held.get(socketOf(address).node), socketOf(address).row, kinds);
  const all = workflow.connections ?? [];
  const typed = all.filter((r) => keep(r.from) || keep(r.to) || retyped(r, held, kinds));
  const flow = portalFlow(workflow.nodes, all.filter((r) => !typed.includes(r)));
  const gone = new Set([...typed, ...flow.orphans]);
  return { kept: all.filter((r) => gone.has(r)), live: all.filter((r) => !gone.has(r)), flow, kindOf: rowsOf(held, flow, kinds) };
}

/** Each node's kind, a portal's Out with its rows: one per connection into an In of its name, named and typed by that connection's
 *  source, "Source › Rows", as a Group Input's is (763). TODO 826 */
function rowsOf(held: ReadonlyMap<string, WorkflowNode>, flow: PortalFlow, kinds: Kinds): Flow['kindOf'] {
  const made = new Map<string, NodeKind | undefined>();
  const kindOf = (node: WorkflowNode | undefined): NodeKind | undefined => {
    if (!node) return undefined;
    if (made.has(node.id)) return made.get(node.id);
    const kind = kindOfNode(kinds, node);
    // Its own first: a row whose source is another Out's row reads that Out, never this one again.
    made.set(node.id, kind);
    const rows = flow.rows.get(node.id);
    if (!kind || !rows?.length) return kind;
    const out = { ...kind, rows: [...kind.rows, ...rows.map(connection)] };
    made.set(node.id, out);
    return out;
  };
  const connection = (source: string): RowKind => {
    const { node: id, row } = socketOf(source);
    const from = held.get(id);
    const kind = kindOf(from);
    const part = row === undefined ? undefined : rowOf(kind?.rows ?? [], row)?.label;
    const output = (kind && socketType(kind, row, 'output')) || 'object';
    return { name: addressRow(source), label: [from?.heading ? nodeTitle(kind?.heading ?? id, from.heading) : kind?.heading ?? id, part].filter(Boolean).join(' › '), output: output === 'any' ? 'object' : output };
  };
  return kindOf;
}

/** A graph as Save writes it: each node with the values of its type's rows, and only the connections they join.
 *  What the draft keeps for another type is left out; so are the bends of a tied connection, which the draft keeps
 *  unseen for its untying. Its ties keep the connections still there. Will, 2026-11-05 */
export function finalGraph<W extends Pick<WorkflowDefinition, 'nodes'> & Partial<Pick<WorkflowDefinition, 'connections' | 'ties' | 'frames'>>>(workflow: W, kinds: Kinds = nodeKinds()): W {
  const gone = keptConnections({ nodes: workflow.nodes, connections: workflow.connections ?? [] }, kinds);
  const nodes = workflow.nodes.map((node): WorkflowNode => {
    const lost = Object.keys(node.values ?? {}).filter((name) => keptRow(node, name, kinds));
    if (!lost.length) return node;
    const values = Object.fromEntries(Object.entries(node.values!).filter(([name]) => !lost.includes(name)));
    const { values: _was, ...bare } = node;
    return Object.keys(values).length ? { ...bare, values } : bare;
  });
  const live = (workflow.connections ?? []).filter((r) => !gone.includes(r));
  const ties = tiesAmong(workflow.ties, live);
  const tied = (r: NodeConnection): boolean => ties.some((t) => t.connections.some((x) => x.from === r.from && x.to === r.to));
  const bent = live.some((r) => r.via && tied(r));
  // A frame keeps the nodes still there; with none, it goes.
  const frames = framesAmong(workflow.frames, nodes.map((n) => n.id));
  const reframed = frames.length !== (workflow.frames?.length ?? 0) || frames.some((f, i) => f !== workflow.frames![i]);
  if (!gone.length && !bent && !reframed && nodes.every((n, i) => n === workflow.nodes[i])) return workflow;
  const connections = live.map((r) => {
    if (!r.via || !tied(r)) return r;
    const { via: _via, ...bare } = r;
    return bare;
  });
  const { ties: _ties, frames: _frames, ...rest } = workflow;
  return { ...rest, nodes, ...(workflow.connections ? { connections } : {}), ...(ties.length ? { ties } : {}), ...(frames.length ? { frames } : {}) } as unknown as W;
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
 *  Tag's (plan 783 D5) — with the values its store says it takes. None: no Field comes in. */
function fieldAt(node: WorkflowNode, connections: readonly NodeConnection[], sends: (from: string) => Reached | undefined): ReadField | undefined {
  const column = connections.filter((r) => r.to === node.id).map((r) => sends(r.from)).find((g) => g?.kind === 'field')?.field;
  if (!column) return undefined;
  const { values: known } = column;
  return { field: column.name, ...(column.type ? { type: column.type } : {}), ...(known ? { known } : {}), of: column.label ?? column.name };
}

/** A row a node's field types: a value picked or typed, tags, a Start or an End. TRAP T-a-value-is-typed-once */
const typedRow = (row: Pick<RowKind, 'control'> | undefined): boolean => ['values', 'tags', 'text'].includes(row?.control ?? '');

/** The socket a given is drawn as: a value or a number a circle, a boolean a circle in its ink, else a diamond. */
function socketOfGiven(given: string | undefined): SocketType {
  return given === 'value' || given === 'number' ? 'value' : given === 'boolean' ? 'boolean' : 'object';
}

/** A value's or a column's type as a Condition's input: a number, a date, a boolean, or text (TODO 940). A list is data. */
const FIELD_INPUTS: Readonly<Record<string, ConditionInput>> = { text: 'text', number: 'number', integer: 'number', decimal: 'number', date: 'date', boolean: 'boolean', list: 'data' };

/** What a Logic type takes, in words, by the inputs it fits: "a number or a date". TODO 940 */
function fitWords(type: string): string[] {
  return (Object.keys(CONDITION_INPUT_WORDS) as ConditionInput[]).filter((i) => fitsCondition(type, i)).map((i) => CONDITION_INPUT_WORDS[i]);
}

/** A comparison's operator its field's type does not take, in words — "Contains takes a text field; it was given the
 *  Seats column"; none, it takes it. A warning, never a fault (plan 783 F2). */
function opWarning(op: unknown, read: ReadField | undefined): string | undefined {
  if (!read || typeof op !== 'string' || !(op in OP_LABELS) || LIST_OPS.includes(op as FilterOp)) return undefined;
  if (OPS_FOR_TYPE[read.type ?? 'text']?.includes(op as FilterOp)) return undefined;
  const types = Object.keys(OPS_FOR_TYPE).filter((t) => OPS_FOR_TYPE[t]!.includes(op as FilterOp));
  const said = new Intl.ListFormat('en', { type: 'disjunction' }).format(types);
  return `${OP_LABELS[op as FilterOp]} takes a ${said} field; it was given the ${read.of} column`;
}

/** A row as its node's field shapes it: a tags row, or a pick of its values, is CLOSED to the field's values where they are
 *  known; a value held that is not one of them is its fault (Will: a value it cannot use is said, never kept quietly). */
function shapedRow<R extends RowKind>(row: R, known: readonly string[] | undefined): R & Pick<GraphRow, 'closed' | 'choices'> {
  const closes = row.control === 'tags' || (row.control === 'values' && !!known?.length);
  // Its choices are the field's alone: a value it holds is no choice of its own here.
  const choices = closes ? rowChoices({ ...(row as RowKind), value: undefined }, known ? { values: known } : {}) : undefined;
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

/** Every fault in a workflow, in words: a node, a kind, a value or a connection that cannot be.
 *  One that is no v2 is that fault alone. A value its row cannot hold — a stranger
 *  in a closed list, no date, a number off its step — is a fault where it is held and where a connection brings it. */
export function workflowFaults(given: WorkflowDefinition, shipped: Kinds = nodeKinds(), facts: Pick<WorkflowFacts, 'fieldsOf' | 'rowsFrom'> = {}): string[] {
  const kinds = withStartKind(shipped);
  const { workflow: read, faults } = readWorkflow(given);
  if (!read) return faults;
  // A top graph's Start is placed each time, and its Triggers join it (plan 949).
  const workflow = withStart(read, nodeWidth);
  const problems = [...faults, ...startFaults(workflow)];
  const byId = new Map<string, NodeKind>();
  // A connection to a row another type holds is kept for that type: no fault, and Save leaves it out. What flows is read through the portals.
  const { kept, flow, kindOf } = flowOf(workflow, kinds);
  const held = new Map(workflow.nodes.map((n) => [n.id, n]));
  const sends = sender(held, flow.connections, kinds, fieldsReach(held, flow.connections, kinds, facts));
  const reads = new Map<string, ReadField | undefined>();
  for (const node of workflow.nodes) {
    const shipped = kinds[node.kind];
    const kind = kindOf(node);
    if (byId.has(node.id)) problems.push(`two nodes are "${node.id}"`);
    if (!kind) problems.push(`the node "${node.id}" is of the kind "${node.kind}", which is not one`);
    else if (!kind.graphs.includes('workflow')) problems.push(`the node "${node.id}" is of the kind "${node.kind}", which a workflow does not run`);
    else byId.set(node.id, kind);
    if (node.size && !(inGrowth(node.size.w) && inGrowth(node.size.h))) problems.push(`the node "${node.id}" is sized ${node.size.w} by ${node.size.h} times its natural size, and a size runs from ${GROW_MIN} to ${GROW_MAX}`);
    const read = kind && fieldAt(node, flow.connections, sends);
    reads.set(node.id, read);
    for (const [name, value] of Object.entries(node.values ?? {})) {
      const row = kind && rowOf(kind.rows, name);
      // A family's type is a value of its first row; the value of a row another type holds is KEPT.
      if (shipped?.types && name === 'type') {
        if (typeof value !== 'string' || !Object.hasOwn(shipped.types, value)) problems.push(`the node "${node.id}" holds "${String(value)}" as its ${shipped.typeLabel ?? 'Type'}, which is none of its choices`);
      } else if (shipped?.types && !row && rowOfOtherType(shipped, node.values?.['type'], name)) continue;
      else if (kind && !row) problems.push(`the node "${node.id}" holds a value for "${name}", a row its kind has not`);
      // A value is typed as its row's control takes it. TRAP T-a-value-is-typed-once
      else if (row?.control === 'number' && typeof value !== 'number') problems.push(`the node "${node.id}" holds "${String(value)}" as its ${row.label}, which is no number`);
      else if (row?.multiple && !Array.isArray(value)) problems.push(`the node "${node.id}" holds "${String(value)}" as its ${row.label}, which is no list`);
      else if (row && fixedChoices(row) && value !== '' && ![value].flat().every((v) => fixedChoices(row)!.some((c) => c.value === String(v)))) {
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
  // What a connection brings from a node that holds it, its row must hold too; one of another type it reads as null.
  const broughtFault = (from: string, to: string, out: { type: SocketType } | undefined, into: { type: SocketType } | undefined): string | undefined => {
    const [source, target] = [held.get(socketOf(from).node), held.get(socketOf(to).node)];
    const brought = socketOf(from).row === undefined ? undefined : source?.values?.[socketOf(from).row!];
    const row = target && into && rowOf(byId.get(target.id)!.rows, socketOf(to).row ?? '');
    return row && out && accepts(out.type, into!.type) && brought !== undefined ? faultOf(row, brought, reads.get(target!.id)) : undefined;
  };
  // Each input's connections so far, by where they leave. Any type joins any input: what it cannot use reads null (TODO 770).
  const fed = new Map<string, string[]>();
  for (const connection of workflow.connections ?? []) {
    const { from, to } = connection;
    if (kept.includes(connection)) continue;
    const bad = connection.via === undefined ? undefined : bendFault(connection.via);
    if (bad) problems.push(`the connection "${from}" → "${to}": ${bad}`);
    const leaves = at(from, 'output');
    const out = leaves?.type === 'any' ? undefined : leaves;
    const into = at(to, 'input');
    const there = fed.get(to) ?? [];
    if (!leaves) problems.push(`a connection leaves "${from}", which is no output socket`);
    else if (!out) problems.push(`a connection leaves "${from}", which sends any type: an output says the one it sends`);
    // A property only sends (Results, a test's Pass and Fail, a Branch's Yes and No): a connection into it says so.
    const sends = into ? undefined : rowOf(byId.get(socketOf(to).node)?.rows ?? [], socketOf(to).row ?? '');
    if (sends?.property) problems.push(`a connection enters "${to}", its ${sends.label} row, which only sends: what a node takes comes in on its header or an input row`);
    else if (!into) problems.push(`a connection enters "${to}", which is no input socket`);
    if (there.includes(from)) problems.push(`the connection "${from}" → "${to}" is there twice`);
    else if (there.length && !into?.many) problems.push(`two connections enter "${to}", which takes one`);
    fed.set(to, [...there, from]);
    const fault = broughtFault(from, to, out, into);
    if (fault) problems.push(`the connection "${from}" → "${to}": ${fault}`);
  }
  // A hop through a portal brings a value as a connection does.
  for (const { from, to, portal } of flow.connections) {
    const fault = portal ? broughtFault(from, to, at(from, 'output'), at(to, 'input')) : undefined;
    if (fault) problems.push(`the connection "${from}" → "${to}", through the portal "${portal}": ${fault}`);
  }
  // A loop has no first node to run: read as the data flows, so one through a portal is one (TODO 779).
  const next = new Map<string, FlowConnection[]>();
  for (const r of flow.connections) next.set(socketOf(r.from).node, [...(next.get(socketOf(r.from).node) ?? []), r]);
  const done = new Set<string>();
  const walking: string[] = [];
  const path: FlowConnection[] = [];
  let ring: FlowConnection[] = [];
  const loops = (id: string): boolean => {
    if (walking.includes(id)) { ring = path.slice(walking.indexOf(id)); return true; }
    if (done.has(id)) return false;
    walking.push(id);
    const found = (next.get(id) ?? []).some((r) => {
      path.push(r);
      if (loops(socketOf(r.to).node)) return true;
      path.pop();
      return false;
    });
    walking.pop();
    done.add(id);
    return found;
  };
  if ([...next.keys()].some(loops)) {
    const through = [...new Set(ring.flatMap((r) => (r.portal ? [`"${r.portal}"`] : [])))];
    problems.push(`its connections run in a loop${through.length ? `, through the portal ${through.join(', ')}` : ''}`);
  }
  const tied = new Set<string>();
  for (const tie of workflow.ties ?? []) {
    if (tied.has(tie.id)) problems.push(`two ties are "${tie.id}"`);
    tied.add(tie.id);
    if (!tie.connections?.length) problems.push(`the tie "${tie.id}" ties no connection`);
    for (const r of tie.connections ?? []) {
      if (!(workflow.connections ?? []).some((x) => x.from === r.from && x.to === r.to)) problems.push(`the tie "${tie.id}" ties the connection "${r.from}" → "${r.to}", which is not there`);
    }
  }
  problems.push(...frameFaults(workflow.frames, workflow.nodes.map((n) => n.id)));
  problems.push(...stageFaults(workflow));
  problems.push(...laneFaults(workflow));
  return problems;
}

/** Check every node, kind and connection; each fault reports, and it never throws. True when none is. */
export function checkWorkflow(workflow: WorkflowDefinition, kinds: Kinds = nodeKinds(), facts: Pick<WorkflowFacts, 'fieldsOf' | 'rowsFrom'> = {}): boolean {
  const problems = workflowFaults(workflow, kinds, facts);
  for (const problem of problems) {
    report({ code: 'workflow-definition', message: `checkWorkflow: ${problem}.`, at: { workflow: workflow?.id } });
  }
  return !problems.length;
}

/** What drawing a workflow needs that it does not say: each store's fields, the stores. */
export interface WorkflowFacts {
  /** Each store's fields, by the store's name — a page definition's `source.fields`, each with the values it may take:
   *  a Field picks from the fields of the Source its rows come from. TRAP T-a-field-reads-its-sources-fields */
  fieldsOf?: Readonly<Record<string, Readonly<Record<string, { label?: string; type?: string; values?: readonly string[] }>>>>;
  /** The store whose rows a Field reads where no Source's reach it: a Filter's own, its `settings.source`. */
  rowsFrom?: string;
  /** The stores a Source's Store row picks, by the names the app registered them under. */
  stores?: readonly string[];
  /** The shelf's entities, read at each draw: what an entity row picks, and where an Output Trigger's loop is looked for
   *  (plan 949). */
  entities?: () => readonly Pick<Entity, 'type' | 'id' | 'label' | 'graph'>[];
  /** A store's rows, each by its key and title (`rowPicks`): what a Source's Rows picks from. The app holds them. */
  storeRows?: (store: string) => readonly RowChoice[];
  /** The primary model of the top graph a Custom Node's body is opened inside: its AI nodes use it (plan 951). `null`: that
   *  graph has none. None given: the body is opened alone, and uses the primary of whichever graph uses it. */
  primary?: ModelPick | null;
}

type StoreFields = NonNullable<WorkflowFacts['fieldsOf']>[string];

/** The fields of the rows that reach a node, and `none` where no Source's do. */
interface Reach {
  fields?: StoreFields;
  /** The store they come from, where a Source names one. */
  store?: string;
  none?: true;
}

/** What a row shows: a Value connected in, else its own. */
function shownAt(held: ReadonlyMap<string, WorkflowNode>, connections: readonly NodeConnection[], address: string): unknown {
  const { node: id, row = '' } = socketOf(address);
  const into = connections.find((r) => r.to === address && socketOf(r.from).row !== undefined);
  const brought = into ? held.get(socketOf(into.from).node)?.values?.[socketOf(into.from).row!] : undefined;
  return brought ?? held.get(id)?.values?.[row];
}

/** The fields of the rows that reach each node: the store of the FIRST Source up its connections — its header's first, then its
 *  rows', through the portals. A Group Input brings its use's rows, of any store: every store's fields. No Source: the
 *  facts' `rowsFrom`, else `none`. No facts, or a store they do not know: open. TODO 817 · TRAP T-a-field-reads-its-sources-fields */
function fieldsReach(held: ReadonlyMap<string, WorkflowNode>, connections: readonly NodeConnection[], kinds: Kinds, facts: Pick<WorkflowFacts, 'fieldsOf' | 'rowsFrom'>): (id: string) => Reach {
  const known = facts.fieldsOf;
  if (!known) return () => ({});
  const up = (id: string, seen: Set<string>): { store: unknown } | 'inside' | undefined => {
    seen.add(id);
    const into = connections.filter((r) => socketOf(r.to).node === id);
    for (const r of [...into.filter((r) => socketOf(r.to).row === undefined), ...into.filter((r) => socketOf(r.to).row !== undefined)]) {
      const from = socketOf(r.from).node;
      const kind = kindOfNode(kinds, held.get(from));
      const row = kind?.rows.find((x) => x.control === 'store');
      if (row) return { store: shownAt(held, connections, `${from}/${row.name}`) };
      if (kind?.model === 'groupInput') return 'inside';
      const found = seen.has(from) ? undefined : up(from, seen);
      if (found) return found;
    }
    return undefined;
  };
  const any = (): StoreFields => {
    const all: Record<string, StoreFields[string]> = {};
    for (const fields of Object.values(known)) for (const [name, field] of Object.entries(fields)) all[name] ??= field;
    return all;
  };
  const of = (store: unknown): Reach => (typeof store !== 'string' ? {} : Object.hasOwn(known, store) ? { fields: known[store]!, store } : { store });
  const memo = new Map<string, Reach>();
  return (id) => {
    if (memo.has(id)) return memo.get(id)!;
    const found = up(id, new Set());
    const reach = found === 'inside' ? { fields: any() } : found ? of(found.store) : facts.rowsFrom !== undefined ? of(facts.rowsFrom) : { fields: {}, none: true as const };
    memo.set(id, reach);
    return reach;
  };
}

/** The field a Field row picks, as it shows it — a Value connected in, else its own pick — with its words, type and values
 *  from the fields that reach it; `stranger` where they are known and it is not one. None: it picks none. Plan 783 D8 */
function pickedField(held: ReadonlyMap<string, WorkflowNode>, connections: readonly NodeConnection[], reach: Reach, address: string): { field: ColumnField; stranger?: true } | undefined {
  const name = String(shownAt(held, connections, address) ?? '');
  if (!name) return undefined;
  const known = reach.fields?.[name];
  const field: ColumnField = { name, ...(known?.label ? { label: known.label } : {}), ...(known?.type ? { type: known.type } : {}), ...(known?.values ? { values: known.values } : {}) };
  return { field, ...(reach.fields && !known ? { stranger: true as const } : {}) };
}

/** A Field that no Source's rows reach, in words: "connect a Source in", by the kind that names a store. */
function storelessWords(kinds: Kinds): string {
  const source = Object.values(kinds).find((k) => k.graphs.includes('workflow') && k.rows.some((r) => r.control === 'store'));
  return `No store's rows come in: connect a ${source?.heading ?? 'Source'} in`;
}

/** What each output socket sends, read through the connections: what its row gives (`givenAt`); a Field row, the column of what
 *  reaches its header or one record's value (`columnOf`), none where its field is a stranger or its header read null; the
 *  Rows row of a node its rows come into, rows only where its header reads rows, a column, an object, or a test's True or
 *  False that carries them (plan 783 D4). A loop sends what its kind says. Plan 783 D2 */
function sender(held: ReadonlyMap<string, WorkflowNode>, connections: readonly NodeConnection[], kinds: Kinds, reach: (id: string) => Reach): (from: string) => Reached | undefined {
  const busy = new Set<string>();
  const sends = (from: string): Reached | undefined => {
    const { node: id, row } = socketOf(from);
    const node = held.get(id);
    const kind = kindOfNode(kinds, node);
    const out = kind && row !== undefined ? rowOf(kind.rows, row) : undefined;
    // A Branch's Yes and No send what reaches its Data, else its test (plan 944).
    if (out?.passes && !busy.has(id)) {
      const into = connections.find((r) => r.to === `${id}/${out.passes}`) ?? connections.find((r) => r.to === id);
      busy.add(id);
      try {
        return into ? sends(into.from) : undefined;
      } finally {
        busy.delete(id);
      }
    }
    const passes = out?.gives === 'rows' && !!kind!.input;
    if (!kind || !out || (out.gives !== 'field' && !passes) || busy.has(id)) return givenAt(node, row, kinds);
    const picked = passes ? undefined : pickedField(held, connections, reach(id), from);
    if (!passes && (!picked || picked.stranger)) return undefined;
    busy.add(id);
    try {
      const need = needOf(kind);
      // What its header reads of each connection: what it cannot use is null.
      const heard = connections.filter((r) => r.to === id).map((r) => {
        const got = sends(r.from);
        return { from: r.from, got: got && need && readInput({ label: kind.heading, needs: need }, got).warning ? null : got };
      });
      if (passes) {
        // Rows (Results, a test's Pass and Fail) are carried where rows, a column or an object come in; a test of one value has none.
        const carries = heard.some(({ got }) => !!got && ['rows', 'field', 'object'].includes(got.kind));
        return carries ? { kind: 'rows' } : undefined;
      }
      return columnOf(picked!.field, heard[0]?.got);
    } finally {
      busy.delete(id);
    }
  };
  return sends;
}

/** What one output socket of a workflow sends, read through its connections and its portals: a Field's column, `{ rows, field }`,
 *  by what reaches its header and the fields of its Source. None: it sends nothing before a run. Plan 783 D2, TODO 779 */
export function sentFrom(given: WorkflowDefinition, from: string, facts: Pick<WorkflowFacts, 'fieldsOf' | 'rowsFrom'> = {}, kinds: Kinds = nodeKinds()): Reached | undefined {
  const { workflow } = readWorkflow(given);
  if (!workflow) return undefined;
  const held = new Map(workflow.nodes.map((n) => [n.id, n]));
  const { connections } = flowOf(workflow, kinds).flow;
  return sender(held, connections, kinds, fieldsReach(held, connections, kinds, facts))(from);
}

/** A workflow as nodes and connections: each node its kind's, at its own place,
 *  with its values. A row a connection drives is read only. Where the connection comes from a node that
 *  holds its value (a Value), the row MIRRORS it — a picklist shows it marked Custom (D7) —
 *  and its own pick stays in the draft; else it shows its own until N4 runs the flow, and one
 *  that holds none shows nothing, and says where its value comes from (TODO 774). What
 *  reaches an input that it cannot use reads null, and the node says why in `warnings`.
 *  TRAP T-a-node-reads-null-from-what-it-cannot-use */
export function workflowGraph(given: WorkflowDefinition, facts: WorkflowFacts = {}, shipped: Kinds = nodeKinds()): FramedGraph {
  const kinds = withStartKind(shipped);
  const { workflow: read } = readWorkflow(given);
  if (!read) return { nodes: [], connections: [] };
  const workflow = withStart(read, nodeWidth);
  // A connection kept for another type or operator is drawn nowhere, drives no row, nor holds its place in a tie.
  // What each input reads, it reads as the data flows: through the portals (TODO 779).
  const { kept, live: connections, flow, kindOf } = flowOf(workflow, kinds);
  const flows = flow.connections;
  const names = portalNames(workflow.nodes);
  // The shelf, once a draw; and each Output Trigger that would start a loop, blocked (plan 949 D5 A).
  const shelf = facts.entities?.() ?? [];
  const top = hasStart(workflow);
  // The model an AI node uses with none joined to its own: its graph's Start's, or the top graph's it is inside (plan 951).
  const primary = top ? primaryOf(workflow) : facts.primary;
  const alone = !top && facts.primary === undefined;
  const loops = shelf.length ? startLoops({ id: workflow.id, ...(workflow.label ? { label: workflow.label } : {}), graph: workflow }, shelf.map((e) => ({ ...e, graph: entityGraph(e) })), kinds) : new Map<string, string>();
  const held = new Map(workflow.nodes.map((n) => [n.id, n]));
  // The store the rows a connection brings come from: a Source's own, else the one reaching its node.
  const storeOfRows = (from: string): string | undefined => {
    const { node: id } = socketOf(from);
    const row = kindOfNode(kinds, held.get(id))?.rows.find((r) => r.control === 'store');
    const own = row && shownAt(held, flows, `${id}/${row.name}`);
    return typeof own === 'string' && own ? own : reach(id).store;
  };
  // Where a connection comes from, in words: "Group Input › Status".
  const whence = (from: string): string => {
    const { node: id, row } = socketOf(from);
    const at = held.get(id);
    const out = row === undefined ? undefined : rowOf(kindOfNode(kinds, at)?.rows ?? [], row);
    return [at?.heading ? nodeTitle(kinds[at.kind]?.heading ?? id, at.heading) : kinds[at?.kind ?? '']?.heading ?? id, out?.label].filter(Boolean).join(' › ');
  };
  // What a connection brings: its output row's value, where its node holds one; and where from, in words.
  const brings = (from: string): { value: unknown; said: string } | undefined => {
    const { node: id, row } = socketOf(from);
    const at = held.get(id);
    const out = row === undefined ? undefined : rowOf(kindOfNode(kinds, at)?.rows ?? [], row);
    // A Field's Values sends its one value, or its list; none picked, nothing. TRAP T-a-multi-select-is-one-row
    const raw = row === undefined ? undefined : at?.values?.[row];
    const value = !out?.valuesOf ? raw : Array.isArray(raw) && !raw.length ? undefined : pickSent(raw);
    return at && out && value !== undefined ? { value, said: whence(from) } : undefined;
  };
  const reach = fieldsReach(held, flows, kinds, facts);
  const sent = sender(held, flows, kinds, reach);
  /** Whether ROWS reach a node's header (TODO 924): true where rows, a column, an object, or a test that may be over rows
   *  comes in; false where only values, or tests of one, do; undefined where nothing it can use is joined. */
  const heardOf = new Map<string, boolean | undefined>();
  const rowsHeard = (id: string, seen = new Set<string>()): boolean | undefined => {
    if (heardOf.has(id)) return heardOf.get(id);
    if (seen.has(id)) return true;
    seen.add(id);
    const at = held.get(id);
    const need = at && needOf(kindOf(at) ?? {});
    // A steer into a node's header gates it, and is no data; a joiner (And, Or, Not) takes it as an input: no rows.
    const answers = flows.filter((c) => c.to === id).flatMap((c) => {
      const got = sent(c.from);
      // What it cannot use, it reads as null, and says so: no answer here.
      if (!got || (need && readInput({ label: '', needs: need }, got).warning)) return [];
      // By what its source row gives: a Field's column is over rows where the Field's own header hears rows.
      const { node: fromId, row } = socketOf(c.from);
      const from = held.get(fromId);
      const given = givenAt(from, row, kinds)?.kind ?? got.kind;
      if (given === 'field') return [rowsHeard(fromId, seen) !== false];
      // A boolean — a check's, or a steer into a joiner — is no rows (TODO 939).
      return [!['value', 'number', 'boolean', 'model'].includes(given)];
    });
    const heard = answers.length ? answers.some(Boolean) : undefined;
    heardOf.set(id, heard);
    return heard;
  };
  /** What one connection into a Condition's header is (TODO 940): a value or a column by its type, or data; what says
   *  nothing it could test, none. */
  const inputOf = (from: string): ConditionInput | undefined => {
    const got = sent(from);
    if (got?.kind === 'field') return FIELD_INPUTS[got.field?.type ?? 'text'] ?? 'text';
    if (got?.kind === 'number' || got?.kind === 'boolean') return got.kind;
    if (got?.kind === 'rows' || got?.kind === 'object' || got?.kind === 'list') return 'data';
    if (got?.kind !== 'value') return undefined;
    const at = held.get(socketOf(from).node);
    return at?.kind === 'value' ? FIELD_INPUTS[String(at.values?.['type'] ?? 'text')] ?? 'text' : 'text';
  };
  const nodes = workflow.nodes.filter((n) => kinds[n.kind]).map((node) => {
    const values = node.values ?? {};
    const family = kinds[node.kind]!;
    const kind = kindOf(node)!;
    const at = typeOf(family, values['type']);
    // What comes in on a Condition's header picks the types that fit (TODO 940). One its pick does not fit is IGNORED where
    // another fits (D2); where none does, the pick stays and the node warns (D1).
    const inputs = kind.model === 'Condition' ? flows.filter((c) => c.to === node.id).flatMap((c) => {
      const is = inputOf(c.from);
      // Data in its own words: rows, an object, a list.
      const said = is === 'data' ? INPUT_WORDS[sent(c.from)!.kind] : is && CONDITION_INPUT_WORDS[is];
      return is ? [{ from: c.from, is, said: said! }] : [];
    }) : [];
    const fits = conditionFits(inputs.map((i) => i.is));
    const fitting = at ? inputs.filter((i) => fitsCondition(at.id, i.is)) : inputs;
    const ignored = fitting.length ? inputs.filter((i) => !fitting.includes(i)) : [];
    const takes = at && fits ? `${at.type.label} takes ${new Intl.ListFormat('en', { type: 'disjunction' }).format(fitWords(at.id))}` : '';
    // What each connection into an input reads: what it brings, coerced (TODO 781); what it cannot use, null, and the node says why.
    const ring = loops.get(node.id);
    const warnings: { row?: string; words: string }[] = [
      ...(unstarted(workflow, node) ? [{ words: 'Connect it to the Start' }] : []), ...(ring ? [{ words: `Blocked: it would start a loop, ${ring}` }] : []),
    ];
    const readsAt = (to: string, input: InputNeeds): Map<NodeConnection, ReturnType<typeof readInput>> => new Map(flows.flatMap((r) => {
      // A steer into the header gates the node: it is no data, so it is not read, and nothing warns (TODO 939).
      // What its type ignores is not read, and warns nothing (TODO 940 D2).
      if (to === node.id && r.to === to && ignored.some((i) => i.from === r.from)) return [];
      const got = r.to === to ? sent(r.from) : undefined;
      const read = got && readInput(input, got);
      if (read?.warning) warnings.push({ ...(to === node.id ? {} : { row: socketOf(to).row! }), words: read.warning });
      return read ? [[r, read] as const] : [];
    }));
    // A header's words name the node, or a family's type: "Sort takes a field".
    const head = needOf(kind);
    const headed = node.heading ?? (Object.keys(family.types ?? {}).length > 1 ? at?.type.label : undefined) ?? kind.heading;
    if (head) readsAt(node.id, { label: headed, needs: head });
    // A portal says its own: an Out of no name, or one no In names.
    for (const w of flow.warnings) if (w.node === node.id) warnings.push({ words: w.words });
    // The field its rows read: the Field reaching its header. Its operator warns where the field's type does not take it.
    const read = fieldAt(node, ignored.length ? flows.filter((c) => !(c.to === node.id && ignored.some((i) => i.from === c.from))) : flows, sent);
    const { type, known, of } = read ?? {};
    const op = kind.model === 'Condition' && !ignored.length ? opWarning(at?.id, read) : undefined;
    if (op) warnings.push({ words: op });
    else if (at && fits && !fits.has(at.id) && !warnings.some((w) => w.row === undefined)) {
      const given = new Intl.ListFormat('en').format([...new Set(inputs.map((i) => i.said))]);
      warnings.push({ words: `${takes}; it was given ${given}` });
    }
    const types = family.types ? typeChoices(family)!.filter((c) => !fits || fits.has(c.value) || c.value === at?.id) : undefined;
    let sources: MessageSource[] | undefined;
    // The rows it sends (Results, a test's Pass and Fail): where only a value, or a test of one, reaches its header, they have nothing to say.
    // Nothing usable joined: they show (TODO 924).
    const rowless = !!kind.input && kind.rows.some(saysRows) && rowsHeard(node.id) === false;
    // A Condition's Count also says the counts that pass: it shows where a number comes in (TODO 939; Will, 2026-11-11: a
    // Count into Between passes through).
    const rows = kind.rows.map((row): GraphRow => {
      const has = values[row.name];
      // A message's values: each one no connection gives warns, by its row (plan 891).
      if (row.control === 'message' && valuesIn(has).length) {
        sources ??= valuesAt(workflow.nodes, flows, node.id, kinds, facts.fieldsOf);
        for (const words of unreachedValues(has, sources, workflow.nodes, kinds, !!facts.fieldsOf)) warnings.push({ row: row.name, words });
      }
      // The values it picks from: its node's own field's (a Field's Values), else the field reaching its node.
      const here = row.valuesOf ? pickedField(held, flows, reach(node.id), `${node.id}/${row.valuesOf}`)?.field.values : known;
      // A Value row with no values to pick from is typed, as it was. Tags with values to pick from are one dropdown with a
      // menu of ticks: a node's multi-select is one row (Will, 2026-11-13). TRAP T-a-multi-select-is-one-row
      const plain = row.control === 'values' && !here?.length ? { ...row, control: 'text' as const }
        : row.control === 'tags' && here?.length ? { ...row, control: 'values' as const, multiple: true as const } : row;
      // A Unit says its words for the count beside it: "1 day", "7 days".
      const count = row.control === 'unit' && typeof values['n'] === 'number' ? { count: values['n'] } : {};
      // A Field row picks from the fields of the Source its rows come from (TODO 817).
      const fields = row.control === 'field' ? reach(node.id).fields : undefined;
      // A Model row picks from the models of its node's own Provider (plans 926, 951).
      const provider = row.control === 'model' ? values['provider'] : undefined;
      const list = rowChoices({ ...plain, value: has }, {
        ...(provider ? { provider } : {}),
        ...(fields ? { fields } : {}), ...(facts.stores ? { stores: facts.stores } : {}), ...(types ? { types } : {}), ...(here ? { values: here } : {}), ...count,
        ...(row.control === 'portal' ? { portals: names } : {}),
        ...(row.control === 'entity' ? { entities: shelf.filter((e) => e.type === row.of).map((e) => ({ value: e.id, label: e.label })) } : {}),
        ...(row.control === 'rows' ? { rows: facts.storeRows?.(String(values['store'] ?? '')) ?? [] } : {}),
      });
      // A Type row says the type's own value, and the line the type gives.
      const typed = row.control === 'type' ? { value: at?.id ?? '', ...(at?.type.help ? { hint: at.type.help } : {}) } : {};
      // Closed to its values where they are known: tags, or the dropdown of ticks they draw as (TRAP T-a-multi-select-is-one-row).
      const closed = (plain.control === 'tags' || (plain.control === 'values' && plain.multiple && !!here?.length)) && list ? { closed: true as const } : {};
      // Idle, it hides; one a connection still leaves stays, and says why it sends nothing (Will, 924 D1 A).
      const idle = saysRows(row) && rowless;
      if (idle && flows.some((c) => c.from === `${node.id}/${row.name}`)) {
        warnings.push({ row: row.name, words: `${row.label} has no rows: a value comes in` });
      }
      // A Branch's Yes and No are drawn as what they send: what reaches its Data (plan 944).
      const through = row.passes ? { output: socketOfGiven(sent(`${node.id}/${row.name}`)?.kind) } : {};
      // A Field's Values with none picked sends nothing, and says so.
      const silent = row.valuesOf && (has == null || (Array.isArray(has) && !has.length)) ? { hint: 'None picked: it sends nothing' } : {};
      const own: GraphRow = { ...plain, value: has, ...silent, ...(plain.control ? { editable: true } : {}), ...(list ? { choices: list } : {}), ...closed, ...typed, ...(idle ? { idle: true as const } : {}), ...through };
      // A fault of the value it shows, in words, as `workflowFaults` finds it: its own, or what a connection brings.
      const said = (shown: GraphRow, connected = false): GraphRow => {
        const value = shown.control === 'number' ? typedValue('number', shown.value) : shown.value;
        const wants = kind.model === 'typedValue' && row.name === 'value' ? typedWants(at?.id, value) : undefined;
        const text = !connected && shown.control === 'number' && typeof value === 'string' && value.trim() !== '';
        const fault = wants ? `"${String(value)}" is not ${wants}` : text ? `"${String(value)}" is not a number` : rowFault(shapedRow(shown, here), value, of);
        return fault ? { ...shown, fault } : shown;
      };
      const address = `${node.id}/${row.name}`;
      const need = row.input ? needOf(row, typedRow(row) ? type : undefined) : undefined;
      const fixed = fixedChoices(row);
      const reads = need ? readsAt(address, { label: row.label, needs: need, ...(fixed ? { choices: fixed } : {}) }) : new Map<NodeConnection, ReturnType<typeof readInput>>();
      const bad = [...reads].filter(([, read]) => read.warning).map(([r]) => r);
      // What a connection brings, as the row reads it: coerced, where COERCIONS reads it.
      const reading = (r: NodeConnection): { value: unknown; said: string } | undefined => {
        const brought = brings(r.from);
        const read = reads.get(r);
        return brought && read && read.value !== undefined ? { ...brought, value: read.value } : brought;
      };
      const ins = flows.filter((r) => r.to === address && !bad.includes(r));
      const coming = ins.flatMap((r) => reading(r) ?? []);
      // An AI node asks a model: with none joined, it uses the primary, and says so; with none, it warns. A body opened
      // alone uses the primary of the graph that uses it (plans 926, 951).
      const unjoined = !ins.length && !bad.length && row.needs === 'model' && !row.optional;
      if (unjoined && !primary && !alone) warnings.push({ row: row.name, words: 'Join a Model, here or to the Start' });
      // A pick it cannot do without, left blank (plan 951).
      if (row.required && !ins.length && (has == null || has === '')) warnings.push({ row: row.name, words: `Pick a ${row.label.toLowerCase()}` });
      // A Runbook, or a new skill, is its instructions: with none, it has nothing to do.
      if (row.name === 'instructions' && (node.kind === 'runbook' || values['skill'] === NEW_CHOICE) && !String(has ?? '').trim() && !ins.length) {
        warnings.push({ row: row.name, words: 'Write its instructions' });
      }
      // A Field row says its field and its type; one the rows do not have warns, and sends nothing (D8). No Source, it says
      // so, where its header says nothing worse.
      const picked = row.gives === 'field' ? pickedField(held, flows, reach(node.id), address) : undefined;
      if (row.gives === 'field' && reach(node.id).none) {
        if (!warnings.some((w) => w.row === undefined)) warnings.push({ row: row.name, words: storelessWords(kinds) });
      } else if (picked?.stranger) warnings.push({ row: row.name, words: `"${picked.field.name}" is not a field of the rows that come in` });
      // A portal's Name says how many portals of its name it is joined to, and an Out its rows.
      const told = picked && !picked.stranger ? { hint: fieldWords(picked.field) } : row.control === 'portal' ? { hint: portalHint(workflow.nodes, node.id, flow.rows.get(node.id)?.length) } : {};
      // A switch is driven by the road a boolean names: a True socket is on, a False socket off.
      if (row.control === 'switch') {
        if (!ins.length) return bad.length ? { ...own, value: null } : own;
        const says = ins.map((r) => {
          const value = reading(r)?.value;
          return truthOf(value) ?? truthy(value);
        });
        const at = (r: NodeConnection): string => { const n = held.get(socketOf(r.from).node); return n?.heading ? nodeTitle(kinds[n.kind]?.heading ?? r.from, n.heading) : kinds[n?.kind ?? '']?.heading ?? r.from; };
        return { ...own, ...drivenSwitch(says), hint: `Custom, from ${[...new Set(ins.map(at))].join(', ')}` };
      }
      // Only what it cannot use came in: it reads null, read only.
      if (bad.length && !ins.length) return { ...own, value: null };
      if (unjoined && primary) return { ...own, value: primary.model, hint: 'From the Start' };
      if (unjoined && alone) return { ...own, hint: 'From the graph that uses it' };
      // Connected, nothing sent yet, nothing held: it shows nothing — never a list's first choice — and says where from.
      const none = has == null || has === '' || (Array.isArray(has) && !has.length);
      if (!coming.length && ins.length && row.control && none) {
        const blank = list || row.control === 'tags' ? mirrored(row, [], list) : { custom: true as const };
        return said({ ...own, ...blank, hint: `From ${[...new Set(ins.map((r) => whence(r.from)))].join(', ')}${told.hint ? `. ${told.hint}` : ''}` }, true);
      }
      if (!coming.length) return said({ ...own, ...told });
      const shown = mirrored(row, coming.map((c) => c.value), list);
      const from = [...new Set(coming.map((c) => c.said))].join(', ');
      // A list connected to tags OVERRIDES them (D7): its values show, read only; cut, the row's own are back.
      return said(list || row.control === 'tags'
        ? { ...own, ...shown, hint: `Custom ${row.multiple ? 'values' : 'value'}, from ${from}${told.hint ? `. ${told.hint}` : ''}` }
        : { ...own, value: shown.value }, true);
    });
    // A row whose choices are its field's values (a Field's Values) is drawn only where that field declares some.
    const shownRows = rows.filter((r) => !r.valuesOf || !!r.choices?.length);
    // A value kept on a row that takes none, an input of rows (a To once typed): unused, and said so, never kept quietly.
    for (const row of kind.rows) {
      const kept = values[row.name];
      if (!row.control && !row.property && row.input && kept != null && kept !== '') warnings.push({ row: row.name, words: `${row.label} takes a connection: "${String(kept)}" is not used` });
    }
    // Rows into a recipients row are a recipient type's: another type's warn, naming the app's (plan 960 U4.9).
    const recipients = recipientTypes();
    for (const row of recipients.length ? kind.rows.filter((r) => r.recipients) : []) {
      const list = new Intl.ListFormat('en', { type: 'disjunction' }).format(recipients.map((t) => t.label));
      for (const c of flows.filter((f) => f.to === `${node.id}/${row.name}`)) {
        const store = storeOfRows(c.from);
        if (store && !recipients.some((t) => t.id === store)) warnings.push({ row: row.name, words: `${row.label} takes rows of a ${list}: these come from "${store}"` });
      }
    }
    // A title of its own stays the node's; its kind rides beside it, drawn before it. TRAP T-a-custom-title-follows-its-kind
    const titled = node.heading && node.heading !== family.heading;
    const heads = { ...(node.heading ? { heading: node.heading } : {}), ...(titled ? { kindHeading: family.heading } : {}), ...(node.description ? { description: node.description } : {}) };
    const ignores = ignored.length ? { ignored: { from: ignored.map((i) => i.from), words: `Ignored: ${takes}` } } : {};
    const blocked = ring ? { would: 'Blocked: it would start a loop' } : {};
    // A Source the Start's drawn line reaches (plan 949).
    const started = top && kind.rows.some((r) => r.control === 'store') ? { started: true as const } : {};
    return { ...kindNode({ ...kinds, [node.kind]: kind }, node.kind, node.id, shownRows, heads), x: node.x, y: node.y, ...(node.size ? { size: node.size } : {}), ...(warnings.length ? { warnings } : {}), ...ignores, ...blocked, ...started };
  });
  const ties = kept.length ? tiesAmong(workflow.ties, connections) : workflow.ties ?? [];
  const frames = framesAmong(workflow.frames, nodes.map((n) => n.id));
  return { nodes, connections, ...(ties.length ? { ties } : {}), ...(frames.length ? { frames } : {}) };
}

/** A row that says rows: Results, or a test's Pass and Fail (plan 971 A); an AI node's Answer is no such row. */
const saysRows = (row: RowKind): boolean => row.name === ROWS.name || (!!row.fork && row.gives === 'rows');

/** A node's width on the plane, in px: its output socket is at its x plus this. */
export const NODE_WIDTH = 240;
/** The gap between two connections in a zip tie, in px. */
export const TIE_GAP = 12;

/**
 * The range a tie's x may take. Each tied connection spans from its source's right edge
 * (`x + NODE_WIDTH`) to its target's `x`; the SHORTEST one's span is the range. A span
 * with the target left of its source is the one point halfway. None, no tied connection is there.
 */
export function tieLimit(workflow: { nodes: readonly { id: string; x: number }[] }, tie: Pick<NodeTie, 'connections'>): { min: number; max: number } | undefined {
  const x = new Map(workflow.nodes.map((n) => [n.id, n.x]));
  const spans = tie.connections.flatMap((r) => {
    const [a, b] = [x.get(socketOf(r.from).node), x.get(socketOf(r.to).node)];
    return a === undefined || b === undefined ? [] : [{ min: a + NODE_WIDTH, max: b }];
  });
  if (!spans.length) return undefined;
  const short = spans.reduce((best, s) => (s.max - s.min < best.max - best.min ? s : best));
  if (short.max >= short.min) return short;
  const mid = (short.min + short.max) / 2;
  return { min: mid, max: mid };
}

/** The ties left when only these connections remain: a tie keeps its connections still there; with none, it goes. */
export function tiesAmong(ties: readonly NodeTie[] | undefined, connections: readonly NodeConnection[]): NodeTie[] {
  return (ties ?? []).flatMap((t) => {
    const kept = t.connections.filter((r) => connections.some((x) => x.from === r.from && x.to === r.to));
    return kept.length ? [kept.length === t.connections.length ? t : { ...t, connections: kept }] : [];
  });
}

/** One edit to a workflow: a row's value, a node's own name, line or place, a connection made
 *  (into an input, in place of the one there, or beside it where the input takes many), or cut
 *  (each by the input it enters, or the one connection), a node added (its id free), or removed
 *  with every connection that touches it. */
export type WorkflowEdit =
  | { node: string; row: string; value: unknown }
  | { node: string; set: Partial<Pick<WorkflowNode, 'heading' | 'description' | 'x' | 'y' | 'version' | 'was'>> }
  | { connection: NodeConnection }
  | { cut: string | NodeConnection }
  | { add: WorkflowNode }
  | { remove: string }
  | { resize: { node: string; w: number; h: number } }
  | { tie: { id?: string; x: number; y: number; connections: readonly NodeConnection[] } }
  | { untie: string }
  | { moveTie: { id: string; x?: number; y?: number } }
  | { tieAdd: { id: string; connection: NodeConnection } }
  | { bend: { connection: NodeConnection; at: number; x: number; y: number; insert?: boolean } }
  | { unbend: { connection: NodeConnection; index: number } }
  | { place: { nodes: Readonly<Record<string, { x: number; y: number; stage?: string }>>; ties?: Readonly<Record<string, { x: number; y: number }>>; bends?: 'reset' | 'follow'; stages?: Readonly<Record<string, number>> } }
  | { frame: { nodes: readonly string[]; id?: string; label?: string; description?: string } }
  | { unframe: string }
  | { setFrame: { id: string; label?: string; description?: string } }
  | { renamePortal: { from: string; to: string } }
  | { addStage: { id?: string; label?: string; description?: string; colour?: string; before?: string; after?: string } }
  | { setStage: { id: string; label?: string; description?: string; colour?: string } }
  | { removeStage: string }
  | { orderStages: readonly string[] }
  | { resizeStage: { id: string; w: number; heights?: Readonly<Record<string, number>> } }
  | { restage: readonly string[]; together?: boolean; by?: number }
  | { lanes: readonly NodeLane[] | null };

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

/** A node's width on the canvas, in plane px: what a stage holds. */
export const nodeWidth = (node: { size?: { w: number } }): number => NODE_WIDTH * (node.size?.w ?? 1);

/** A stage's default name: its place, "Stage 2". */
const DEFAULT_STAGE = /^Stage \d+$/;

/** Each stage of a default name takes its place's: one put before Stage 1 is Stage 1, the old one Stage 2. Will, TODO 893 */
function numbered(workflow: WorkflowDefinition): WorkflowDefinition {
  const stages = workflow.stages ?? [];
  if (stages.every((s, i) => !DEFAULT_STAGE.test(s.label) || s.label === `Stage ${i + 1}`)) return workflow;
  return { ...workflow, stages: stages.map((s, i) => (DEFAULT_STAGE.test(s.label) ? { ...s, label: `Stage ${i + 1}` } : s)) };
}

/** A stage edit: written out first where the workflow had only its one Stage 1. */
function staged(workflow: WorkflowDefinition, edit: Extract<WorkflowEdit, { addStage: unknown } | { setStage: unknown } | { removeStage: unknown } | { orderStages: unknown } | { resizeStage: unknown } | { restage: unknown }>): WorkflowDefinition {
  if ('restage' in edit) return restage(workflow, edit.restage, nodeWidth, !!edit.together, edit.by);
  if ('resizeStage' in edit) return resizeStage(workflow, edit.resizeStage.id, edit.resizeStage.w, nodeWidth, edit.resizeStage.heights);
  if ('orderStages' in edit) return numbered(orderStages(workflow, edit.orderStages, nodeWidth));
  const held = stagesHeld(workflow);
  const stages = held.stages!;
  if ('addStage' in edit) {
    const free = (n: number): string => (stages.some((s) => s.id === `stage-${n}`) ? free(n + 1) : `stage-${n}`);
    const id = edit.addStage.id ?? free(stages.length + 1);
    if (stages.some((s) => s.id === id)) return refuse(`two stages would be "${id}"`), workflow;
    const { bands } = stageBands(held, nodeWidth);
    const x = Math.max(...bands.map((b) => b.right)) + STAGE_GAP;
    const { id: _id, before, after, ...said } = edit.addStage;
    // Before or after a stage: put last, then ordered into its place, the stages after it moving on with their nodes.
    const next = before ?? after;
    const at = next === undefined ? stages.length : stages.findIndex((s) => s.id === next) + (after === undefined ? 0 : 1);
    if (next !== undefined && !stages.some((s) => s.id === next)) return refuse(`the stage "${next}" is not there`), workflow;
    const added = { ...held, stages: [...stages, { id, label: said.label?.trim() || `Stage ${stages.length + 1}`, ...said, x }] };
    const order = [...stages.slice(0, at).map((s) => s.id), id, ...stages.slice(at).map((s) => s.id)];
    return numbered(at === stages.length ? added : orderStages(added, order, nodeWidth));
  }
  if ('setStage' in edit) {
    const { id, ...set } = edit.setStage;
    if (!stages.some((s) => s.id === id)) return refuse(`the stage "${id}" is not there`), workflow;
    return { ...held, stages: stages.map((s) => {
      if (s.id !== id) return s;
      const next: NodeStage = { ...s, ...set, label: set.label?.trim() || s.label };
      // An empty line or colour takes it away.
      if (!next.description) delete next.description;
      if (!next.colour) delete next.colour;
      return next;
    }) };
  }
  if (!stages.some((s) => s.id === edit.removeStage)) return refuse(`the stage "${edit.removeStage}" is not there`), workflow;
  if (stages.length < 2) return refuse('a workflow keeps one stage at least'), workflow;
  // Its nodes stay where they stand, in the stage before it, or the first after it where it was the first (TODO 899).
  const at = stages.findIndex((s) => s.id === edit.removeStage);
  const into = (stages[at - 1] ?? stages[at + 1])!.id;
  return numbered({
    ...held,
    stages: stages.filter((s) => s.id !== edit.removeStage),
    nodes: held.nodes.map((n) => (n.stage === edit.removeStage ? { ...n, stage: into } : n)),
  });
}

/** The workflow after one edit, a v2; the one given untouched. A
 *  value is typed as its row takes it. */
export function editWorkflow(
  given: WorkflowDefinition, edit: WorkflowEdit, kinds: Kinds = nodeKinds(), facts: Pick<WorkflowFacts, 'fieldsOf' | 'rowsFrom'> = {},
): WorkflowDefinition {
  const workflow = readWorkflow(given).workflow;
  if (!workflow) return given as WorkflowDefinition;
  const same = (a: NodeConnection, b: NodeConnection): boolean => a.from === b.from && a.to === b.to;
  // A connection that is gone leaves its ties, and a tie with none goes.
  const untied = (w: WorkflowDefinition): WorkflowDefinition => {
    if (!w.ties) return w;
    const { ties: _was, ...bare } = w;
    const ties = tiesAmong(w.ties, w.connections ?? []);
    return ties.length ? { ...bare, ties } : bare;
  };
  if ('connection' in edit) {
    const connections = workflow.connections ?? [];
    if (connections.some((r) => same(r, edit.connection))) return workflow;
    const { node, row } = socketOf(edit.connection.to);
    const kind = kindOfNode(kinds, workflow.nodes.find((n) => n.id === node));
    const many = !!kind && takesMany(kind, row);
    return untied({ ...workflow, connections: [...connections.filter((r) => many || r.to !== edit.connection.to), { ...edit.connection }] });
  }
  // A connection a tie takes drops its bends: a tie is its handle. TODO 754
  const unbent = (tied: readonly NodeConnection[]): Pick<WorkflowDefinition, 'connections'> =>
    (workflow.connections ? { connections: workflow.connections.map((r) => (r.via && tied.some((t) => same(t, r)) ? withoutBends(r) : r)) } : {});
  if ('tie' in edit) {
    const free = (n: number): string => ((workflow.ties ?? []).some((t) => t.id === `tie-${n}`) ? free(n + 1) : `tie-${n}`);
    const id = edit.tie.id ?? free(1);
    if ((workflow.ties ?? []).some((t) => t.id === id)) return workflow;
    const connections = edit.tie.connections.filter((r, i, all) => all.findIndex((q) => same(q, r)) === i).map(({ from, to }) => ({ from, to }));
    const limit = tieLimit(workflow, { connections });
    const x = limit ? Math.min(limit.max, Math.max(limit.min, edit.tie.x)) : edit.tie.x;
    return { ...workflow, ...unbent(connections), ties: [...(workflow.ties ?? []), { id, x, y: edit.tie.y, connections }] };
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
    const { id, connection } = edit.tieAdd;
    const tie = (workflow.ties ?? []).find((t) => t.id === id);
    const name = `"${connection.from}" → "${connection.to}"`;
    if (!tie) return refuse(`the tie "${id}" is not there`), workflow;
    if (!(workflow.connections ?? []).some((r) => same(r, connection))) return refuse(`the connection ${name} is not there`), workflow;
    if (tie.connections.some((r) => same(r, connection))) return refuse(`the connection ${name} is in the tie "${id}" already`), workflow;
    const connections = [...tie.connections, { from: connection.from, to: connection.to }];
    // Its nodes must leave the tie where it stands: the tie moves only by the reader's hand.
    const limit = tieLimit(workflow, { connections });
    if (limit && (tie.x < limit.min || tie.x > limit.max)) return refuse(`the tie "${id}" cannot take ${name}: its nodes leave no room for the tie where it stands`), workflow;
    return { ...workflow, ...unbent([connection]), ties: (workflow.ties ?? []).map((t) => (t.id === id ? { ...t, connections } : t)) };
  }
  if ('bend' in edit || 'unbend' in edit) {
    const { connection, at } = 'bend' in edit ? edit.bend : { ...edit.unbend, at: edit.unbend.index };
    const held = (workflow.connections ?? []).find((r) => same(r, connection));
    const name = `"${connection.from}" → "${connection.to}"`;
    if (!held) return refuse(`the connection ${name} is not there`), workflow;
    let via: readonly Bend[] | undefined;
    if ('bend' in edit) {
      const { x, y, insert } = edit.bend;
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isInteger(at)) return refuse('a bend point needs a finite x and y, and a whole index'), workflow;
      if ((workflow.ties ?? []).some((t) => t.connections.some((r) => same(r, connection)))) return refuse(`the connection ${name} is tied: its ties are its handles`), workflow;
      if (at < 0 || at > (held.via?.length ?? 0) - (insert ? 0 : 1)) return refuse(`the connection ${name} has no bend point at ${at}`), workflow;
      // Inside the end sockets, and clear of its neighbours: a bend never loops the line back.
      const [a, b] = [socketOf(connection.from).node, socketOf(connection.to).node].map((id) => workflow.nodes.find((n) => n.id === id));
      const placed = a && b ? clampBend({ from: a.x + NODE_WIDTH, to: b.x }, held.via, at, x, insert) : x;
      via = placeBend(held.via, at, placed, y, insert).via;
    } else {
      if (!held.via?.[at]) return refuse(`the connection ${name} has no bend point at ${at}`), workflow;
      via = dropBend(held.via, at);
    }
    return { ...workflow, connections: (workflow.connections ?? []).map((r) => {
      if (r !== held) return r;
      const { via: _was, ...bare } = r;
      return via ? { ...bare, via } : bare;
    }) };
  }
  if ('place' in edit) {
    // Several nodes, and the ties, bends and stages that go with them, in one edit: a group drag, an arrange, or an unfurl.
    const { nodes, ties, bends, stages } = edit.place;
    const names = Object.keys(nodes);
    const absent = (ids: readonly string[], have: readonly { id: string }[] = []): string | undefined => ids.find((id) => !have.some((h) => h.id === id));
    const [node, tie, stage] = [absent(names, workflow.nodes), absent(Object.keys(ties ?? {}), workflow.ties), absent([...Object.keys(stages ?? {}), ...Object.values(nodes).flatMap((p) => p.stage ?? [])], workflow.stages)];
    const fault = names.length < 2 ? 'placing nodes needs two or more'
      : node !== undefined ? `the node "${node}" is not there`
        : [...Object.values({ ...nodes, ...ties }).flatMap((p) => [p.x, p.y]), ...Object.values(stages ?? {})].some((v) => !Number.isFinite(v)) ? 'a place needs a finite x and y'
          : tie !== undefined ? `the tie "${tie}" is not there`
            : stage !== undefined ? `the stage "${stage}" is not there` : undefined;
    if (fault) return refuse(fault), workflow;
    const moved = { ...workflow, nodes: workflow.nodes.map((n) => { const to = nodes[n.id]; return to ? { ...n, x: to.x, y: to.y, ...(to.stage ? { stage: to.stage } : {}) } : n; }),
      ...(stages && workflow.stages ? { stages: workflow.stages.map((s) => {
        if (!(s.id in stages)) return s;
        // A stage placed fits its nodes: a width kept from a drag goes (Will, 2026-11-12, TODO 950).
        const { w: _w, ...fit } = s;
        return { ...fit, x: stages[s.id]! };
      }) } : {}) };
    const has = (r: NodeConnection, all: boolean): boolean => {
      const ends = [socketOf(r.from).node, socketOf(r.to).node].map((id) => id in nodes);
      return all ? ends.every(Boolean) : ends.some(Boolean);
    };
    const result: WorkflowDefinition = { ...moved };
    // A bend between two placed nodes follows them: by the mean of its ends' moves, one move for a group.
    const shift = (id: string): [number, number] => {
      const [was, to] = [workflow.nodes.find((n) => n.id === id), nodes[id]];
      return was && to ? [to.x - was.x, to.y - was.y] : [0, 0];
    };
    if (workflow.connections && bends) {
      result.connections = workflow.connections.map((r) => {
        if (!r.via || !has(r, bends === 'reset' ? false : true)) return r;
        const { via: _was, ...bare } = r;
        if (bends === 'reset') return bare;
        const [[ax, ay], [bx, by]] = [shift(socketOf(r.from).node), shift(socketOf(r.to).node)];
        return { ...bare, via: r.via.map((p) => ({ x: p.x + (ax + bx) / 2, y: p.y + (ay + by) / 2 })) };
      });
    }
    if (workflow.ties) {
      // A tie touching a moved node stays inside the range its nodes now leave it.
      result.ties = workflow.ties.map((t) => {
        const to = ties?.[t.id];
        const limit = tieLimit(moved, t);
        const touches = t.connections.some((r) => has(r, false));
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
  if ('renamePortal' in edit) {
    // Every portal of the name takes the new one: its links stay (TODO 779).
    const [from, to] = [edit.renamePortal.from.trim(), edit.renamePortal.to.trim()];
    if (!to) return refuse('a portal needs a name'), workflow;
    if (!workflow.nodes.some((n) => portalOf(n)?.name === from)) return refuse(`no portal is named "${from}"`), workflow;
    return from === to ? workflow : { ...workflow, nodes: renamedPortals(workflow.nodes, from, to) };
  }
  // — Stages: a new one after the last; its name, line and colour; one taken away, its nodes in the one before; an order;
  // a node let go, in the stage it stands in, or the nearest; an edge dragged (900). A workflow keeps at least one.
  // — Swimlanes: on, with the lanes given, each node's place kept; null, off, each node back where it stood before they were
  // on — one placed since stays where it is. Will, 2026-11-10, TODO 929
  if ('lanes' in edit) {
    const { lanes: _was, beforeLanes: before, ...bare } = workflow;
    if (edit.lanes?.length) {
      const kept = before ?? Object.fromEntries(workflow.nodes.filter((n) => !n.id.startsWith('#')).map((n) => [n.id, { x: n.x, y: n.y }]));
      return { ...bare, lanes: edit.lanes.map((l) => ({ ...l, families: [...l.families] })), beforeLanes: kept };
    }
    if (!before) return bare;
    return { ...bare, nodes: bare.nodes.map((n) => (before[n.id] ? { ...n, x: before[n.id]!.x, y: before[n.id]!.y } : n)) };
  }
  if ('addStage' in edit || 'setStage' in edit || 'removeStage' in edit || 'orderStages' in edit || 'resizeStage' in edit || 'restage' in edit) return staged(workflow, edit);
  if ('add' in edit) return workflow.nodes.some((n) => n.id === edit.add.id) ? workflow : { ...workflow, nodes: [...workflow.nodes, { ...edit.add }] };
  if ('remove' in edit) {
    const gone = (address: string): boolean => socketOf(address).node === edit.remove;
    const connections = (workflow.connections ?? []).filter((r) => !gone(r.from) && !gone(r.to));
    const nodes = workflow.nodes.filter((n) => n.id !== edit.remove);
    // It leaves its frame; a frame left with none goes.
    const { frames: _was, ...bare } = workflow;
    const frames = framesAmong(workflow.frames, nodes.map((n) => n.id));
    return untied({ ...bare, nodes, ...(workflow.connections ? { connections } : {}), ...(frames.length ? { frames } : {}) });
  }
  if ('cut' in edit) {
    const { cut } = edit;
    return untied({ ...workflow, connections: (workflow.connections ?? []).filter((r) => (typeof cut === 'string' ? r.to !== cut : !same(r, cut))) });
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
    const flows = flowOf(workflow, kinds).flow.connections;
    const held = new Map(workflow.nodes.map((n) => [n.id, n]));
    const field = kind && fieldAt(node, flows, sender(held, flows, kinds, fieldsReach(held, flows, kinds, facts)))?.type as FieldType | undefined;
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
 * A Value node made for a picklist row, and connected to it: it holds the row's own pick, at
 * a place, and the row now mirrors it, read only. The pick stays on the row, so cutting the
 * connection gives it back. The workflow given, untouched, where the row is no picklist, takes no
 * single value, or is not there. Plan 713 §5
 */
export function addCustomValue(
  given: WorkflowDefinition, to: string, at: { x: number; y: number }, kinds: Kinds = nodeKinds(),
): WorkflowDefinition {
  const workflow = readWorkflow(given).workflow;
  const { node: id, row: name } = socketOf(to);
  const into = workflow?.nodes.find((n) => n.id === id);
  const row = into && name !== undefined ? rowOf(kindOfNode(kinds, into)?.rows ?? [], name) : undefined;
  if (!workflow || !into || !row || row.input !== 'value' || row.many || rowChoices(row) === undefined) return workflow ?? (given as WorkflowDefinition);
  const free = (n: number): string => (workflow.nodes.some((x) => x.id === `value-${n}`) ? free(n + 1) : `value-${n}`);
  const own = into.values?.[name!];
  const made: WorkflowNode = { id: free(1), kind: 'value', x: at.x, y: at.y, ...(own !== undefined && own !== '' ? { values: { value: String(own) } } : {}) };
  return editWorkflow(editWorkflow(workflow, { add: made }, kinds), { connection: { from: `${made.id}/value`, to } }, kinds);
}
