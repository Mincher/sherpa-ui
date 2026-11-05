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
 * - readWorkflow — A workflow as v2: a v1's header routes moved to its Rows row; a Filter node read as a Condition.
 * - GROW_MIN — The least a node's size may be: its natural size, as 1.
 * - GROW_MAX — The most a node's size may be: double its natural size, as 2.
 * - workflowFaults — Every fault in a workflow, in words: a node, a kind, a value or a route that cannot be.
 * - checkWorkflow — Check every node, kind and route; each fault reports. True when none is.
 * - WorkflowFacts — What drawing a workflow needs that it does not say: the fields a row picks, the stores.
 * - workflowGraph — A workflow as nodes and routes: each node its kind's, at its own place, with its values.
 * - NODE_WIDTH — A node's width on the plane, in px: where its output socket is from its x.
 * - TIE_GAP — The gap between two routes in a zip tie, in px.
 * - tieLimit — The range a zip tie's x may take: between the nodes its shortest tied route joins.
 * - tiesAmong — The ties left when only some routes remain: a tie keeps its routes still there, and none, it goes.
 * - WorkflowEdit — One edit: a row, a node's part or size, a route made, bent or cut, a tie, a node added or removed.
 * - editWorkflow — The workflow after one edit; the one given untouched.
 * - addCustomValue — A Value node made for a picklist row and routed into it: the row mirrors it, and keeps its own pick.
 */
import { report } from './report.js';
import { typedValue } from './filter-state.js';
import { OPS_FOR_TYPE, OP_LABELS } from './store.js';
import {
  NODE_KINDS, ROWS, SOCKET_WORDS, FALSE_SOCKET, accepts, conditionRows, drivenSwitch, fixedChoices, truthy, kindNode, mirrored, partName, partOf, rowChoices, rowOf, socketOf, socketType, takesMany,
  type DrawnGraph, type GraphRow, type NodeSize, type NodeKind, type NodeRoute, type NodeTie, type PartKind, type SocketType,
} from './node-kinds.js';
import { bendFault, clampBend, dropBend, placeBend, type Bend } from './route-bends.js';
import type { FieldType } from './filter-state.js';
import type { NodeSnapshot } from './node-library.js';

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

/** A kind the registry renamed: what a workflow saved before reads as, once. Plan 713 M4 */
const RENAMED: Readonly<Record<string, string>> = { filter: 'condition' };

/**
 * A workflow as v2: a v2 as it is, the one given; a v1 read ONCE — each route that left a
 * node's header, its data rows, now leaves its Rows row. One a v2 kind cannot send from
 * there (no Rows row, and its header sends only True) is dropped, and a fault says so: it
 * would mean another thing. Plan 713 D8. TRAP T-a-workflow-is-its-definition
 */
export function readWorkflow(given: WorkflowDefinition | WorkflowDefinitionV1, kinds: Kinds = NODE_KINDS): WorkflowRead {
  const v = (given as { v?: unknown } | null)?.v;
  if ((v !== 1 && v !== 2) || !Array.isArray(given.nodes)) return { faults: ['it is not a workflow definition: a v2, or a v1 to read as one'] };
  // A Filter node is a Condition now, with the same rows.
  const moved = (n: WorkflowNode): boolean => n.kind in RENAMED && !kinds[n.kind];
  const workflow = given.nodes.some(moved) ? { ...given, nodes: given.nodes.map((n) => (moved(n) ? { ...n, kind: RENAMED[n.kind]! } : n)) } : given;
  if (workflow.v === 2) return { workflow, faults: [] };
  const faults: string[] = [];
  const kindOf = new Map(workflow.nodes.map((n) => [n.id, kinds[n.kind]]));
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

/** Every fault in a workflow, in words: a node, a kind, a value or a route that cannot be.
 *  A v1 is read as v2 first, and each fault of the read leads. */
export function workflowFaults(given: WorkflowDefinition | WorkflowDefinitionV1, kinds: Kinds = NODE_KINDS, facts: Pick<WorkflowFacts, 'fields'> = {}): string[] {
  const { workflow, faults } = readWorkflow(given, kinds);
  if (!workflow) return faults;
  const problems = [...faults];
  const byId = new Map<string, NodeKind>();
  const kindOf = new Map<string, string>();
  for (const node of workflow.nodes) {
    const kind = kinds[node.kind];
    if (byId.has(node.id)) problems.push(`two nodes are "${node.id}"`);
    if (!kind) problems.push(`the node "${node.id}" is of the kind "${node.kind}", which is not one`);
    else if (!kind.graphs.includes('workflow')) problems.push(`the node "${node.id}" is of the kind "${node.kind}", which a workflow does not run`);
    else {
      byId.set(node.id, kind);
      kindOf.set(node.id, node.kind);
    }
    if (node.size && !(inGrowth(node.size.w) && inGrowth(node.size.h))) problems.push(`the node "${node.id}" is sized ${node.size.w} by ${node.size.h} times its natural size, and a size runs from ${GROW_MIN} to ${GROW_MAX}`);
    for (const [name, value] of Object.entries(node.values ?? {})) {
      const row = kind && rowOf(kind.rows, name);
      if (kind && !row) problems.push(`the node "${node.id}" holds a value for "${name}", a row its kind has not`);
      // A value is typed as its row's control takes it. TRAP T-a-value-is-typed-once
      else if (row?.control === 'op' && !(String(value) in OP_LABELS)) problems.push(`the node "${node.id}" holds "${String(value)}" as its ${row.label}, which is no operator`);
      else if (row?.control === 'number' && typeof value !== 'number') problems.push(`the node "${node.id}" holds "${String(value)}" as its ${row.label}, which is no number`);
      else if (row?.multiple && !Array.isArray(value)) problems.push(`the node "${node.id}" holds "${String(value)}" as its ${row.label}, which is no list`);
      else if (row && fixedChoices(row.control) && ![value].flat().every((v) => fixedChoices(row.control)!.some((c) => c.value === String(v)))) {
        problems.push(`the node "${node.id}" holds "${String(value)}" as its ${row.label}, which is none of its choices`);
      }
    }
    const typed = node.values?.['type'];
    if (kind?.model === 'typedValue' && typeof typed === 'string' && node.values?.['value'] !== undefined) {
      const text = String(node.values['value']);
      const ok = typed === 'number' ? typeof typedValue('number', text) === 'number'
        : typed === 'boolean' ? /^(true|false)$/i.test(text.trim())
        : typed === 'date' ? /^\d{4}-\d{2}-\d{2}/.test(text.trim()) : true;
      if (!ok) problems.push(`the node "${node.id}" holds "${text}" as its Value, which is not ${typed === 'number' ? 'a number' : typed === 'boolean' ? 'true or false' : 'a date'}`);
    }
    // A comparison by its field's type: an operator it takes, and a value of its type.
    for (const [name, field] of Object.entries(node.values ?? {})) {
      const { base, part } = partOf(name);
      const type = base === 'field' ? facts.fields?.[String(field)]?.type : undefined;
      if (!kind || !type || !rowOf(kind.rows, 'field')?.repeat) continue;
      const op = node.values?.[partName('op', part)];
      const value = node.values?.[partName('value', part)];
      const name_ = `"${String(field)}", a ${type} field`;
      if (op !== undefined && String(op) in OP_LABELS && !(OPS_FOR_TYPE[type]?.includes(String(op) as never) || op === 'in' || op === 'notin')) {
        problems.push(`the node "${node.id}" holds "${String(op)}" as its ${rowOf(kind.rows, 'op')?.label}, which ${name_} does not take`);
      }
      const bad = type === 'number' && value !== undefined && ![typedValue(type as FieldType, value)].flat().every((v) => typeof v === 'number');
      if (bad) problems.push(`the node "${node.id}" holds "${String(value)}" as its ${rowOf(kind.rows, 'value')?.label}, which is no number, as ${name_} takes`);
    }
  }
  // What a socket carries, which way, and whether it takes many: undefined when it is not one.
  const at = (address: string, side: 'input' | 'output'): { type: SocketType; many: boolean } | undefined => {
    const { node, row } = socketOf(address);
    const kind = byId.get(node);
    const type = kind && socketType(kind, row, side);
    return kind && type && { type, many: takesMany(kind, row) };
  };
  // Each input's routes so far, by what they carry.
  const fed = new Map<string, { from: string; type?: SocketType }[]>();
  const next = new Map<string, string[]>();
  for (const route of workflow.routes ?? []) {
    const { from, to } = route;
    const bad = route.via === undefined ? undefined : bendFault(route.via);
    if (bad) problems.push(`the route "${from}" → "${to}": ${bad}`);
    const leaves = at(from, 'output');
    const out = leaves?.type === 'any' ? undefined : leaves;
    const into = at(to, 'input');
    const there = fed.get(to) ?? [];
    if (!leaves) problems.push(`a route leaves "${from}", which is no output socket`);
    else if (!out) problems.push(`a route leaves "${from}", which sends any type: an output says the one it sends`);
    // A Rows row only sends: a v1 habit, the rows in, says so.
    // A Group row takes only the True of a node of its kinds: a nested group.
    const group = into && rowOf(byId.get(socketOf(to).node)?.rows ?? [], socketOf(to).row ?? '')?.from;
    const feeds = kindOf.get(socketOf(from).node);
    if (group && (socketOf(from).row !== undefined || !feeds || !group.includes(feeds))) {
      problems.push(`the route "${from}" → "${to}" enters a Group row, which takes only the True of a ${group.join(' or ')}`);
    }
    if (!into && socketOf(to).row === ROWS.name && byId.has(socketOf(to).node)) problems.push(`a route enters "${to}", a Rows row, which only sends: a node's rows come in on its header`);
    else if (!into) problems.push(`a route enters "${to}", which is no input socket`);
    if (out && into && !accepts(out.type, into.type)) problems.push(`the route "${from}" → "${to}" joins ${SOCKET_WORDS[out.type]} to ${SOCKET_WORDS[into.type]}`);
    // An any input that takes many takes one type at a time.
    const mixed = into?.type === 'any' && out ? there.find((r) => r.type && r.type !== out.type)?.type : undefined;
    if (there.some((r) => r.from === from)) problems.push(`the route "${from}" → "${to}" is there twice`);
    else if (there.length && !into?.many) problems.push(`two routes enter "${to}", which takes one`);
    else if (mixed && out) problems.push(`routes of two types enter "${to}": ${SOCKET_WORDS[mixed]} and ${SOCKET_WORDS[out.type]}`);
    fed.set(to, [...there, { from, ...(out ? { type: out.type } : {}) }]);
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
  return problems;
}

/** Check every node, kind and route; each fault reports, and it never throws. True when none is. */
export function checkWorkflow(workflow: WorkflowDefinition | WorkflowDefinitionV1, kinds: Kinds = NODE_KINDS, facts: Pick<WorkflowFacts, 'fields'> = {}): boolean {
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

/** The parts of a group a Condition holds: a comparison for each part its values name, a nested group
 *  for each Group row a route enters; a part nothing names is a blank comparison. */
function partsOf(node: WorkflowNode, routes: readonly NodeRoute[]): PartKind[] {
  const named = new Map<number, PartKind>();
  for (const name of Object.keys(node.values ?? {})) if (['field', 'op', 'value'].includes(partOf(name).base)) named.set(partOf(name).part, 'leaf');
  for (const { to } of routes) {
    const { node: at, row = '' } = socketOf(to);
    const { base, part } = partOf(row);
    if (at === node.id && base === 'group' && !named.has(part)) named.set(part, 'group');
  }
  return Array.from({ length: Math.max(1, ...named.keys()) }, (_, i) => named.get(i + 1) ?? 'leaf');
}

/** A workflow as nodes and routes, a v1 read as v2: each node its kind's, at its own place,
 *  with its values. A row a route drives is read only. Where the route comes from a node that
 *  holds its value (a Value), the row MIRRORS it — a picklist shows it marked Custom (D7) —
 *  and its own pick stays in the draft; else it shows its own until N4 runs the flow. */
export function workflowGraph(given: WorkflowDefinition | WorkflowDefinitionV1, facts: WorkflowFacts = {}, kinds: Kinds = NODE_KINDS): DrawnGraph {
  const { workflow } = readWorkflow(given, kinds);
  if (!workflow) return { nodes: [], routes: [] };
  const routes = workflow.routes ?? [];
  const held = new Map(workflow.nodes.map((n) => [n.id, n]));
  // What a route brings: its output row's value, where its node holds one; and where from, in words.
  const brings = (from: string): { value: unknown; said: string } | undefined => {
    const { node: id, row } = socketOf(from);
    const at = held.get(id);
    const out = row === undefined ? undefined : rowOf(kinds[at?.kind ?? '']?.rows ?? [], row);
    const value = row === undefined ? undefined : at?.values?.[row];
    return at && out && value !== undefined ? { value, said: `${at.heading ?? kinds[at.kind]!.heading} › ${out.label}` } : undefined;
  };
  const nodes = workflow.nodes.filter((n) => kinds[n.kind]).map((node) => {
    const values = node.values ?? {};
    const kind = kinds[node.kind]!;
    // A Condition draws a part for each comparison its values hold and each Group row a route enters.
    const drawn = node.kind === 'condition' ? conditionRows(kind, partsOf(node, workflow.routes ?? [])) : kind.rows;
    const rows = drawn.map((row): GraphRow => {
      const { part } = partOf(row.name);
      const field = String(values[partName('field', part)] ?? values['field'] ?? '');
      const type = facts.fields?.[field]?.type;
      const known = facts.values?.[field];
      const has = row.name === 'join' ? values['join'] ?? 'and' : values[row.name];
      // A Value row with no values to pick from is typed, as it was.
      const plain = row.control === 'values' && !known?.length ? { ...row, control: 'text' as const } : row;
      const list = rowChoices({ ...plain, value: has }, {
        ...(facts.fields ? { fields: facts.fields } : {}), ...(facts.stores ? { stores: facts.stores } : {}), ...(known ? { values: known } : {}), ...(type && row.name !== 'join' ? { type } : {}),
      });
      const own: GraphRow = { ...plain, value: has, ...(plain.control ? { editable: true } : {}), ...(list ? { choices: list } : {}) };
      const coming = routes.filter((r) => r.to === `${node.id}/${row.name}`).flatMap((r) => brings(r.from) ?? []);
      // A switch is driven by the road a boolean names: a True socket is on, a False socket off.
      if (row.control === 'switch') {
        const ins = routes.filter((r) => r.to === `${node.id}/${row.name}`);
        if (!ins.length) return own;
        const says = ins.map((r) => {
          const { node: id, row: out } = socketOf(r.from);
          if (out === FALSE_SOCKET) return false;
          return out === undefined ? !!kinds[held.get(id)?.kind ?? '']?.branches : truthy(brings(r.from)?.value);
        });
        const at = (r: NodeRoute): string => { const n = held.get(socketOf(r.from).node); return n?.heading ?? kinds[n?.kind ?? '']?.heading ?? r.from; };
        return { ...own, ...drivenSwitch(says), hint: `Custom, from ${[...new Set(ins.map(at))].join(', ')}` };
      }
      if (!coming.length) return own;
      const shown = mirrored(row, coming.map((c) => c.value), list);
      const from = [...new Set(coming.map((c) => c.said))].join(', ');
      return list
        ? { ...own, ...shown, hint: `Custom ${row.multiple ? 'values' : 'value'}, from ${from}` }
        : { ...own, value: shown.value };
    });
    const heads = { ...(node.heading ? { heading: node.heading } : {}), ...(node.description ? { description: node.description } : {}) };
    return { ...kindNode(kinds, node.kind, node.id, rows, heads), x: node.x, y: node.y, ...(node.size ? { size: node.size } : {}) };
  });
  return { nodes, routes: [...routes], ...(workflow.ties?.length ? { ties: workflow.ties } : {}) };
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
  | { unbend: { route: NodeRoute; index: number } };

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
    const kind = kinds[workflow.nodes.find((n) => n.id === node)?.kind ?? ''];
    const many = !!kind && takesMany(kind, row);
    return untied({ ...workflow, routes: [...routes.filter((r) => many || r.to !== edit.route.to), { ...edit.route }] });
  }
  if ('tie' in edit) {
    const free = (n: number): string => ((workflow.ties ?? []).some((t) => t.id === `tie-${n}`) ? free(n + 1) : `tie-${n}`);
    const id = edit.tie.id ?? free(1);
    if ((workflow.ties ?? []).some((t) => t.id === id)) return workflow;
    const routes = edit.tie.routes.filter((r, i, all) => all.findIndex((q) => same(q, r)) === i).map(({ from, to }) => ({ from, to }));
    const limit = tieLimit(workflow, { routes });
    const x = limit ? Math.min(limit.max, Math.max(limit.min, edit.tie.x)) : edit.tie.x;
    return { ...workflow, ties: [...(workflow.ties ?? []), { id, x, y: edit.tie.y, routes }] };
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
    return { ...workflow, ties: (workflow.ties ?? []).map((t) => (t.id === id ? { ...t, routes } : t)) };
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
      if (at < 0 || at > (held.via?.length ?? 0) - (insert ? 0 : 1)) return refuse(`the route ${name} has no bend point at ${at}`), workflow;
      // Inside the end sockets, and clear of its neighbours and the ties' slots: a bend never loops the line back.
      const [a, b] = [socketOf(route.from).node, socketOf(route.to).node].map((id) => workflow.nodes.find((n) => n.id === id));
      const slots = (workflow.ties ?? []).filter((t) => t.routes.some((r) => same(r, route))).map((t) => t.x);
      const placed = a && b ? clampBend({ from: a.x + NODE_WIDTH, to: b.x }, held.via, at, x, insert, slots) : x;
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
  if ('add' in edit) return workflow.nodes.some((n) => n.id === edit.add.id) ? workflow : { ...workflow, nodes: [...workflow.nodes, { ...edit.add }] };
  if ('remove' in edit) {
    const gone = (address: string): boolean => socketOf(address).node === edit.remove;
    const routes = (workflow.routes ?? []).filter((r) => !gone(r.from) && !gone(r.to));
    return untied({ ...workflow, nodes: workflow.nodes.filter((n) => n.id !== edit.remove), ...(workflow.routes ? { routes } : {}) });
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
    const kind = kinds[node.kind];
    const row = kind && rowOf(kind.rows, edit.row);
    // A comparison's value is typed by its field. TRAP T-a-value-is-typed-once
    const field = node.values?.[partName('field', partOf(edit.row).part)];
    const type = row?.name === 'value' ? facts.fields?.[String(field ?? '')]?.type as FieldType | undefined : undefined;
    const value = row?.control === 'number' ? typedValue('number', String(edit.value ?? ''))
      : row?.multiple ? [edit.value ?? []].flat().map(String)
      : type ? typedValue(type, edit.value) : edit.value;
    const { [edit.row]: _was, ...rest } = node.values ?? {};
    // No value, empty text or an empty list: the row holds none.
    const values = value === '' || value == null || (Array.isArray(value) && !value.length) ? rest : { ...rest, [edit.row]: value };
    const { values: _old, ...bare } = node;
    return Object.keys(values).length ? { ...bare, values } : bare;
  });
  return { ...workflow, nodes };
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
  const row = into && name !== undefined ? rowOf(kinds[into.kind]?.rows ?? [], name) : undefined;
  if (!workflow || !into || !row || row.input !== 'value' || row.many || rowChoices(row) === undefined) return workflow ?? (given as WorkflowDefinition);
  const free = (n: number): string => (workflow.nodes.some((x) => x.id === `value-${n}`) ? free(n + 1) : `value-${n}`);
  const own = into.values?.[name!];
  const made: WorkflowNode = { id: free(1), kind: 'value', x: at.x, y: at.y, ...(own !== undefined && own !== '' ? { values: { value: String(own) } } : {}) };
  return editWorkflow(editWorkflow(workflow, { add: made }, kinds), { route: { from: `${made.id}/value`, to } }, kinds);
}
