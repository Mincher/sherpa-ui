/**
 * node-library.ts — a Custom Node: a workflow body saved under one id and name, its inputs and
 * outputs said once. A library of them is JSON (schemas/nodes.v1.json); a USE is a plain
 * workflow node whose kind is a definition's id, with its own values (D11 B, an instance). A use
 * runs NESTED (D12 B): `innerOf` gives the graph inside it, for the checks, the drawing and a
 * runner. DOM-free. Will, TODO 719 · plan 713 §9, M9 · TRAP T-a-custom-node-is-an-instance
 *
 * Map:
 * - NodeSocket — One input a definition exposes: a name, a type, and what an instance may set.
 * - NodeOutput — One output a definition exposes: a name and the type it sends.
 * - NodeSnapshot — A definition as a use recorded it: what its checks and its diff read.
 * - NodeDefinition — One Custom Node as JSON: its sockets, and the workflow body inside.
 * - NodeLibrary — Every Custom Node of an app, by id.
 * - CustomKind — The NodeKind of a definition, with its category and its preset flag.
 * - GROUP_INPUT — The kind of the Group Input node drawn inside a definition: `#in`.
 * - GROUP_OUTPUT — The kind of the Group Output node drawn inside a definition: `#out`.
 * - versionOf — A definition's version: a hash of what a use follows, never its places.
 * - nodeKindOf — A definition as a NodeKind: a row per input and output, `model: 'graph'`.
 * - kindsOf — Every definition of a library as a kind, by id; one a shipped kind owns is left out.
 * - Inner — What a use runs: its definition, its body as a workflow, the kinds it needs, its parameters.
 * - innerOf — The graph inside one use: the body with Group Input and Output, and its parameters.
 * - useOf — A use of a definition, placed: it records the version and the definition it was made from.
 * - nodeLibraryFaults — Every fault in a library, in words, each named by its path.
 * - checkNodeLibrary — Check a library; each fault reports. True when none is.
 * - workflowFaultsDeep — A workflow's faults, and the faults inside each use, named by path.
 * - DefinitionDiff — What changed in a definition since a use recorded it: plain data.
 * - definitionDiff — The change between a use's recorded definition and the library's now.
 * - staleUses — The uses in a workflow that follow an older definition.
 * - updateInstance — The workflow with one use brought to the library's definition; its own values kept.
 * - updateAll — The workflow with every use of one definition brought to the library's.
 * - editDefinition — The library after one change to a definition; a preset's is refused.
 * - copyToMine — A custom, editable copy of a definition (a preset's, as "Copy to my nodes").
 */
import { withoutBends } from './route-bends.js';
import { tidyTags } from './tags.js';
import { report } from './report.js';
import { NODE_KINDS, rowOf, type NodeKind, type NodeRoute, type NodeTie, type RowKind, type RowControl } from './node-kinds.js';
import { editWorkflow, workflowFaults, type WorkflowDefinition, type WorkflowFacts, type WorkflowNode } from './workflow.js';
import type { NodeFrame } from './node-frames.js';

type Kinds = Readonly<Record<string, NodeKind>>;

/** One input a definition exposes: a name, a type, and what an instance may set. */
export interface NodeSocket {
  name: string;
  label?: string;
  type: 'value' | 'object' | 'boolean';
  /** It takes several routes (D4). */
  many?: true;
  /** Its list picks several: an object (D17). */
  multiple?: true;
  /** A control: an instance sets this input as a parameter, in its own values. */
  control?: RowControl;
  /** What an instance holds until it sets its own. */
  default?: unknown;
}

/** One output a definition exposes: a name and the type it sends. */
export interface NodeOutput {
  name: string;
  label?: string;
  type: 'value' | 'object' | 'boolean';
}

/** A definition as a use recorded it: what its checks and its diff read. */
export interface NodeSnapshot {
  v: 1;
  label: string;
  inputs: readonly NodeSocket[];
  outputs: readonly NodeOutput[];
  nodes: readonly WorkflowNode[];
  routes?: readonly NodeRoute[];
}

/** One Custom Node as JSON: its sockets, and the workflow body inside. Inner routes name its
 *  sockets `#in/<name>`, `#out` and `#out/<name>`. Its id is its key in the library. */
export interface NodeDefinition extends NodeSnapshot {
  $schema?: string;
  category?: string;
  icon?: string;
  description?: string;
  /** Words to organise and find it by: the node panel lists it under each, and its search finds it by one. */
  tags?: readonly string[];
  /** From a file, read only: "Copy to my nodes" makes a custom one (D15). */
  preset?: true;
  /** Zip ties in the body: they change no data, so are no part of its version or its diff. */
  ties?: readonly NodeTie[];
  /** Frames in the body: no part of its version or its diff, as a tie is. TODO 778 */
  frames?: readonly NodeFrame[];
  /** An entity's own settings, where it is not a `node` (plan 746 E5): no part of its version; a copy keeps them. */
  settings?: Readonly<Record<string, unknown>>;
}

/** Every Custom Node of an app, by id (D13). */
export interface NodeLibrary {
  $schema?: string;
  v: 1;
  nodes: Readonly<Record<string, NodeDefinition>>;
}

/** The NodeKind of a definition, with its category and its preset flag. */
export interface CustomKind extends NodeKind {
  category: string;
  preset?: true;
}

/** The kind of the Group Input node drawn inside a definition: `#in`. */
export const GROUP_INPUT = '#group-input';
/** The kind of the Group Output node drawn inside a definition: `#out`. */
export const GROUP_OUTPUT = '#group-output';

const ID = /^[a-z][a-z0-9-]*$/;
/** A definition's key: its id, or `<type>:<id>` where an entity offers it (plan 746). */
const KEY = /^[a-z][a-z0-9-]*(:[a-z][a-z0-9-]*)?$/;
const TYPES: readonly string[] = ['value', 'object', 'boolean'];

/** A value as text, its keys in order, so the same content is the same text. */
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

/** Whether an id is a kind that is not a Custom Node: a use could not tell it apart. */
const shipped = (kinds: Kinds, id: string): boolean => !!kinds[id] && kinds[id]!.model !== 'graph';

/** A node as a version reads it: where it sits is no change. */
const unplaced = ({ x: _x, y: _y, ...rest }: WorkflowNode): Omit<WorkflowNode, 'x' | 'y'> => rest;

/** A 53-bit text hash (cyrb53): a version, not a secret. */
function hashOf(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
}

/** A definition's version: a hash of what a use follows — its name, sockets, nodes and routes,
 *  never where its nodes sit, nor its category or icon. */
export function versionOf(definition: NodeSnapshot): string {
  return hashOf(stable({ ...snapshotOf(definition), nodes: definition.nodes.map(unplaced) }));
}

/** What a use records of a definition. */
function snapshotOf(d: NodeSnapshot): NodeSnapshot {
  return { v: 1, label: d.label, inputs: d.inputs, outputs: d.outputs, nodes: d.nodes, ...(d.routes ? { routes: d.routes.map(withoutBends) } : {}) };
}

/** A definition as a NodeKind: a row per input and output, `model: 'graph'`, its header taking
 *  any type (D1) and forking True and False. Its category is its own, or "Custom Nodes". */
export function nodeKindOf(definition: NodeDefinition): CustomKind {
  const rows: RowKind[] = [
    ...definition.inputs.map((i): RowKind => ({
      name: i.name, label: i.label ?? i.name, input: i.type,
      ...(i.many ? { many: true as const } : {}), ...(i.multiple ? { multiple: true as const } : {}), ...(i.control ? { control: i.control } : {}),
    })),
    ...definition.outputs.map((o): RowKind => ({ name: o.name, label: o.label ?? o.name, output: o.type })),
  ];
  return {
    heading: definition.label, icon: definition.icon ?? 'folder', input: 'any', branches: true, rows, model: 'graph', graphs: ['workflow'],
    ...(definition.description ? { description: definition.description } : {}),
    // Tidied, so a bad file never breaks the panel; the check names its fault.
    ...(tidyTags(definition.tags).length ? { tags: tidyTags(definition.tags) } : {}),
    category: definition.category ?? 'Custom Nodes',
    ...(definition.preset ? { preset: true as const } : {}),
  };
}

/** Every definition of a library as a kind, by id: merge it into the kinds the workflow functions
 *  take, `{ ...NODE_KINDS, ...kindsOf(library) }`. An id a shipped kind owns is left out (a fault). */
export function kindsOf(library: NodeLibrary): Readonly<Record<string, CustomKind>> {
  const nodes = library?.nodes && typeof library.nodes === 'object' ? library.nodes : {};
  return Object.fromEntries(Object.entries(nodes).filter(([id, d]) => !(id in NODE_KINDS) && d && Array.isArray(d.inputs) && Array.isArray(d.outputs)).map(([id, d]) => [id, nodeKindOf(d)]));
}

/** What a use runs: its definition, its body as a workflow, the kinds it needs, its parameters. */
export interface Inner {
  definition: NodeDefinition;
  /** The body, with a Group Input node `#in` and a Group Output node `#out` laid out beside it. */
  workflow: WorkflowDefinition;
  /** The kinds the body needs: the given, the library's, and the two group kinds. */
  kinds: Kinds;
  /** Each input's value for this instance: its own, else the definition's default. */
  params: Readonly<Record<string, unknown>>;
}

/** A definition's body as a workflow, its Group Input and Output laid out either side. */
function inside(id: string, definition: NodeDefinition, base: Kinds, values: Readonly<Record<string, unknown>> = {}): Inner {
  const xs = definition.nodes.map((n) => n.x);
  const input: NodeKind = {
    heading: 'Group Input', icon: 'login', description: 'What comes into the Custom Node.', model: 'groupInput', graphs: ['workflow'],
    rows: definition.inputs.map((i) => ({ name: i.name, label: i.label ?? i.name, output: i.type, ...(i.multiple ? { multiple: true as const } : {}) })),
  };
  const output: NodeKind = {
    heading: 'Group Output', icon: 'logout', description: 'What the Custom Node gives.', input: 'any', model: 'groupOutput', graphs: ['workflow'],
    rows: definition.outputs.map((o) => ({ name: o.name, label: o.label ?? o.name, input: o.type })),
  };
  const params = Object.fromEntries(definition.inputs.flatMap((i) => {
    const value = values[i.name] ?? i.default;
    return value === undefined ? [] : [[i.name, value]];
  }));
  return {
    definition, params,
    kinds: { ...base, [GROUP_INPUT]: input, [GROUP_OUTPUT]: output },
    workflow: {
      v: 2, id, label: definition.label,
      nodes: [
        { id: '#in', kind: GROUP_INPUT, x: Math.min(0, ...xs) - 360, y: 0 }, ...definition.nodes,
        { id: '#out', kind: GROUP_OUTPUT, x: Math.max(0, ...xs) + 360, y: 0 },
      ],
      routes: definition.routes ?? [],
      ...(definition.ties?.length ? { ties: definition.ties } : {}),
      ...(definition.frames?.length ? { frames: definition.frames } : {}),
    },
  };
}

/** The graph inside one use, for the checks, the drawing and a runner: the definition's body with
 *  its Group Input and Output, and this instance's parameters over the defaults. None, the use is
 *  of no definition in the library. */
export function innerOf(use: Pick<WorkflowNode, 'id' | 'kind' | 'values'>, library: NodeLibrary, kinds: Kinds = NODE_KINDS): Inner | undefined {
  const definition = library?.nodes?.[use.kind];
  return definition && !shipped(kinds, use.kind) ? inside(use.id, definition, { ...kindsOf(library), ...kinds }, use.values) : undefined;
}

/** A use of a definition, placed: it records the version and the definition it was made from, so a
 *  later change shows as a diff. New uses follow the definition saved now. */
export function useOf(library: NodeLibrary, kind: string, at: Pick<WorkflowNode, 'id' | 'x' | 'y'> & Partial<WorkflowNode>): WorkflowNode {
  const definition = library.nodes[kind];
  return { ...at, kind, ...(definition ? { version: versionOf(definition), was: snapshotOf(structuredClone(definition)) } : {}) };
}

/** A fault inside a body, named by its path: "Org permissions › Condition: the node …". */
function named(path: readonly string[], fault: string, workflow: WorkflowDefinition, kinds: Kinds): string {
  if (!path.length) return fault;
  const id = /^the node "([^"]+)"/.exec(fault)?.[1];
  const node = workflow.nodes.find((n) => n.id === id);
  const heading = node && (node.heading ?? kinds[node.kind]?.heading ?? node.kind);
  return `${[...path, ...(heading ? [heading] : [])].join(' › ')}: ${fault}`;
}

/** A cycle of definitions as it reads from its first id in order, so each way round is one fault. */
function cycleOf(ids: readonly string[], library: NodeLibrary): string {
  const at = ids.indexOf([...ids].sort()[0]!);
  const ring = [...ids.slice(at), ...ids.slice(0, at)];
  return [...ring, ring[0]!].map((id) => library.nodes[id]?.label ?? id).join(' › ');
}

/** A workflow's faults, then the faults inside each use, in the one's own words. */
function nested(
  workflow: WorkflowDefinition, kinds: Kinds, base: Kinds, library: NodeLibrary, facts: Pick<WorkflowFacts, 'fieldsOf' | 'rowsFrom'>, path: readonly string[], stack: readonly string[],
): string[] {
  const problems = workflowFaults(workflow, kinds, facts).map((f) => named(path, f, workflow, kinds));
  for (const node of workflow.nodes) {
    const definition = library.nodes[node.kind];
    if (!definition || base[node.kind]?.model !== 'graph') continue;
    if (stack.includes(node.kind)) {
      const from = stack.indexOf(node.kind);
      problems.push(`a Custom Node holds itself, in a loop: ${cycleOf(stack.slice(from), library)}`);
      continue;
    }
    const inner = inside(node.id, definition, base, node.values);
    problems.push(...nested(inner.workflow, inner.kinds, base, library, facts, [...path, node.heading ?? definition.label], [...stack, node.kind]));
  }
  return problems;
}

/** Every fault in a library, in words: a library that is none, an id a shipped kind owns, a
 *  socket that is not one, a body that fails the workflow's own checks (named by its path), and a
 *  Custom Node that holds itself, at any depth. A kind the app adds is given in `kinds`. */
export function nodeLibraryFaults(library: NodeLibrary, kinds: Kinds = NODE_KINDS, facts: Pick<WorkflowFacts, 'fieldsOf' | 'rowsFrom'> = {}): string[] {
  const given = library as { v?: unknown; nodes?: unknown } | null;
  if (given?.v !== 1 || !given.nodes || typeof given.nodes !== 'object' || Array.isArray(given.nodes)) return ['it is not a Custom Node library: a v1 with its nodes by id'];
  const problems: string[] = [];
  const base: Kinds = { ...kindsOf(library), ...kinds };
  for (const [id, definition] of Object.entries(library.nodes)) {
    const at = `the Custom Node "${id}"`;
    if (!KEY.test(id)) problems.push(`${at} has an id that is not a name: lowercase letters, digits and hyphens`);
    if (shipped(kinds, id)) problems.push(`${at} has the id of a kind that is shipped, which a use could not tell apart`);
    if (!definition || typeof definition.label !== 'string' || !definition.label.trim()) problems.push(`${at} has no name`);
    const tags: unknown = definition?.tags;
    if (tags !== undefined && (!Array.isArray(tags) || tags.some((t) => typeof t !== 'string' || !t.trim()))) problems.push(`${at} has tags that are not a list of words`);
    else if (Array.isArray(tags) && new Set(tags.map((t: string) => t.toLowerCase())).size < tags.length) problems.push(`${at} has a tag twice`);
    if (!Array.isArray(definition?.inputs) || !Array.isArray(definition.outputs) || !Array.isArray(definition.nodes)) {
      problems.push(`${at} is not a definition: it needs its inputs, outputs and nodes`);
      continue;
    }
    const names = new Set<string>();
    for (const [side, list] of [['input', definition.inputs], ['output', definition.outputs]] as const) {
      for (const s of list as readonly (NodeSocket | NodeOutput)[]) {
        if (!ID.test(String(s?.name))) problems.push(`${at} has an ${side} named "${String(s?.name)}", which is not a name`);
        else if (names.has(s.name)) problems.push(`${at} has two sockets named "${s.name}"`);
        names.add(String(s?.name));
        if (!TYPES.includes(String(s?.type))) problems.push(`${at} has the ${side} "${String(s?.name)}" of the type "${String(s?.type)}", which a socket does not carry`);
        else if (side === 'input' && (s as NodeSocket).multiple && s.type !== 'object') problems.push(`${at} has the input "${s.name}", a list of picks, which is an object, not ${s.type}`);
      }
    }
    for (const n of definition.nodes) {
      if (String(n?.id).startsWith('#') || String(n?.kind).startsWith('#')) problems.push(`${at} holds a node "${String(n.id)}" of the kind "${String(n.kind)}": a # name is the Group Input's and Output's`);
    }
    const body = inside(id, definition, base);
    problems.push(...nested(body.workflow, body.kinds, base, library, facts, [definition.label ?? id], [id]).filter((f) => f));
  }
  return [...new Set(problems)];
}

/** Check a library; each fault reports, and it never throws. True when none is. */
export function checkNodeLibrary(library: NodeLibrary, kinds: Kinds = NODE_KINDS, facts: Pick<WorkflowFacts, 'fieldsOf' | 'rowsFrom'> = {}): boolean {
  const problems = nodeLibraryFaults(library, kinds, facts);
  for (const problem of problems) report({ code: 'node-library', message: `checkNodeLibrary: ${problem}.`, at: {} });
  return !problems.length;
}

/** A workflow's faults, and the faults inside each use, named by path ("Org permissions ›
 *  Condition: …"). The same checks run in a use as at the top, so the same faults come. */
export function workflowFaultsDeep(workflow: WorkflowDefinition, library: NodeLibrary, kinds: Kinds = NODE_KINDS, facts: Pick<WorkflowFacts, 'fieldsOf' | 'rowsFrom'> = {}): string[] {
  const base: Kinds = { ...kindsOf(library), ...kinds };
  return [...new Set(nested(workflow, base, base, library, facts, [], []))];
}

/** What changed in a definition since a use recorded it: plain data for an update overlay. */
export interface DefinitionDiff {
  /** The use follows an older definition (or records none). */
  stale: boolean;
  /** The use recorded the definition it was made from, so the lists below are known. */
  known: boolean;
  /** The versions: the use's, and the library's now. */
  recorded?: string;
  current: string;
  label?: { from: string; to: string };
  inputs: SocketDiff;
  outputs: SocketDiff;
  nodes: { added: string[]; removed: string[]; changed: string[] };
  routes: { added: NodeRoute[]; removed: NodeRoute[] };
}

/** Sockets added, removed, retyped, or changed in what they say. */
interface SocketDiff {
  added: string[];
  removed: string[];
  retyped: { name: string; from: string; to: string }[];
  changed: string[];
}

const socketDiff = (was: readonly (NodeSocket | NodeOutput)[], now: readonly (NodeSocket | NodeOutput)[]): SocketDiff => {
  const old = new Map(was.map((s) => [s.name, s]));
  const cur = new Map(now.map((s) => [s.name, s]));
  const both = now.filter((s) => old.has(s.name));
  return {
    added: now.filter((s) => !old.has(s.name)).map((s) => s.name),
    removed: was.filter((s) => !cur.has(s.name)).map((s) => s.name),
    retyped: both.filter((s) => old.get(s.name)!.type !== s.type).map((s) => ({ name: s.name, from: old.get(s.name)!.type, to: s.type })),
    changed: both.filter((s) => old.get(s.name)!.type === s.type && stable(old.get(s.name)) !== stable(s)).map((s) => s.name),
  };
};

/** The change between a use's recorded definition and the library's now. None: the use is of no
 *  definition in the library. A use that recorded no definition is stale with nothing listed. */
export function definitionDiff(use: Pick<WorkflowNode, 'kind' | 'version' | 'was'>, library: NodeLibrary): DefinitionDiff | undefined {
  const now = library?.nodes?.[use.kind];
  if (!now) return undefined;
  const current = versionOf(now);
  const was = use.was;
  const none: SocketDiff = { added: [], removed: [], retyped: [], changed: [] };
  const diff: DefinitionDiff = {
    stale: use.version !== current, known: !!was, current, ...(use.version ? { recorded: use.version } : {}),
    inputs: none, outputs: none, nodes: { added: [], removed: [], changed: [] }, routes: { added: [], removed: [] },
  };
  if (!was || !diff.stale) return diff;
  const before = new Map(was.nodes.map((n) => [n.id, stable(unplaced(n))]));
  const after = new Map(now.nodes.map((n) => [n.id, stable(unplaced(n))]));
  const key = (r: NodeRoute): string => `${r.from}→${r.to}`;
  const oldRoutes = new Map((was.routes ?? []).map((r) => [key(r), r]));
  const newRoutes = new Map((now.routes ?? []).map((r) => [key(r), r]));
  return {
    ...diff,
    ...(was.label !== now.label ? { label: { from: was.label, to: now.label } } : {}),
    inputs: socketDiff(was.inputs, now.inputs), outputs: socketDiff(was.outputs, now.outputs),
    nodes: {
      added: [...after.keys()].filter((id) => !before.has(id)),
      removed: [...before.keys()].filter((id) => !after.has(id)),
      changed: [...after.keys()].filter((id) => before.has(id) && before.get(id) !== after.get(id)),
    },
    routes: { added: [...newRoutes].filter(([k]) => !oldRoutes.has(k)).map(([, r]) => r), removed: [...oldRoutes].filter(([k]) => !newRoutes.has(k)).map(([, r]) => r) },
  };
}

/** The uses in a workflow that follow an older definition: where the update indicator shows. */
export function staleUses(workflow: WorkflowDefinition, library: NodeLibrary): string[] {
  return workflow.nodes.filter((n) => definitionDiff(n, library)?.stale).map((n) => n.id);
}

/**
 * The workflow with one use brought to the library's definition: it records the new version, and
 * keeps its own values for each row the definition still has; a value for a row it lost goes. A
 * route to a socket the definition lost stays, and is a fault to see. Pure, through editWorkflow:
 * the EDITOR gives the draft and keeps the saved copy, so an updated instance holds its draft
 * changes until the reader saves or discards them (D11); the confirmation is its too.
 */
export function updateInstance(workflow: WorkflowDefinition, id: string, library: NodeLibrary, kinds: Kinds = NODE_KINDS): WorkflowDefinition {
  const use = workflow.nodes.find((n) => n.id === id);
  const definition = use && library?.nodes?.[use.kind];
  if (!use || !definition || shipped(kinds, use.kind)) return workflow;
  const all: Kinds = { ...kindsOf(library), ...kinds };
  const lost = Object.keys(use.values ?? {}).filter((name) => !rowOf(all[use.kind]!.rows, name));
  const kept = lost.reduce((w, row) => editWorkflow(w, { node: id, row, value: null }, all), workflow);
  return editWorkflow(kept, { node: id, set: { version: versionOf(definition), was: snapshotOf(structuredClone(definition)) } }, all);
}

/** The workflow with every use of one definition brought to the library's (Update all instances on
 *  graph). Every workflow of the app is the caller's loop (Update all instances). */
export function updateAll(workflow: WorkflowDefinition, kind: string, library: NodeLibrary, kinds: Kinds = NODE_KINDS): WorkflowDefinition {
  return workflow.nodes.filter((n) => n.kind === kind).reduce((w, n) => updateInstance(w, n.id, library, kinds), workflow);
}

/** The library after one change to a definition. A preset's is refused, and so is one that is not
 *  there: the library given, untouched. */
export function editDefinition(
  library: NodeLibrary, id: string, change: Partial<Pick<NodeDefinition, 'label' | 'category' | 'icon' | 'description' | 'tags' | 'inputs' | 'outputs' | 'nodes' | 'routes' | 'ties' | 'frames'>>,
): NodeLibrary {
  const was = library.nodes[id];
  if (!was || was.preset) return library;
  return { ...library, nodes: { ...library.nodes, [id]: { ...was, ...change } } };
}

/** A custom, editable copy of a definition — a preset's, as "Copy to my nodes" — under a free id.
 *  `id` is none when the definition is not there. */
export function copyToMine(library: NodeLibrary, id: string): { library: NodeLibrary; id?: string } {
  const was = library.nodes[id];
  if (!was) return { library };
  // An entity's key is `<type>:<id>`, and one id names one entity of any type (plan 746).
  const bare = (key: string): string => key.slice(key.indexOf(':') + 1);
  const taken = new Set(Object.keys(library.nodes).map(bare));
  const free = (n: number): string => { const next = n === 1 ? `${id}-copy` : `${id}-copy-${n}`; return taken.has(bare(next)) ? free(n + 1) : next; };
  const copy = free(1);
  const { preset: _preset, ...mine } = structuredClone(was);
  return { library: { ...library, nodes: { ...library.nodes, [copy]: { ...mine, label: `${was.label} copy` } } }, id: copy };
}
