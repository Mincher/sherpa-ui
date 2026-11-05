/**
 * node-group.ts — "Save as Custom Node" and its inverse "Ungroup", as two pure edits: several
 * nodes of a workflow become one definition and ONE use in their place, each route over the edge
 * a typed socket (a Group Input or Output row); Ungroup puts the nodes and the routes back. Both
 * check what they make, and refuse in words. DOM-free. Will, TODO 719 · plan 713 §9.2, M11, D9
 * TRAP T-a-custom-node-is-an-instance
 *
 * Map:
 * - GroupAsk — What "Save as Custom Node" is asked: a name; a description, tags, category and id if given.
 * - Grouped — The edit's answer: the workflow, the library and the use, or why it was refused.
 * - groupNodes — Several nodes as one Custom Node: a definition, and one use in their place.
 * - ungroupUse — A use as its nodes again, in place: the inverse of groupNodes.
 * - headerInput — A route let go on a use's header: a new input of its definition, and the route into the use's new row.
 * - heldInputs — Each route a use's header holds from before, read once as its own new input; a preset's stays.
 */
import { NODE_KINDS, FALSE_SOCKET, kindOfNode, rowOf, socketOf, socketType, type NodeKind, type NodeRoute, type SocketType } from './node-kinds.js';
import { kindsOf, updateInstance, useOf, versionOf, workflowFaultsDeep, type NodeDefinition, type NodeLibrary, type NodeOutput, type NodeSocket } from './node-library.js';
import { tidyTags } from './tags.js';
import { tiesAmong, type WorkflowDefinition, type WorkflowFacts, type WorkflowNode } from './workflow.js';
import { framesAmong, type NodeFrame } from './node-frames.js';

type Kinds = Readonly<Record<string, NodeKind>>;

/** What "Save as Custom Node" is asked: the name, the category, and an id if the reader gave one. */
export interface GroupAsk {
  label: string;
  category?: string;
  description?: string;
  /** The reader's words to organise and find it by. */
  tags?: readonly string[];
  id?: string;
}

/** The edit's answer: the workflow, the library and the use, or why it was refused. */
export type Grouped =
  | { workflow: WorkflowDefinition; library: NodeLibrary; id: string; use: string }
  | { fault: string };

const key = (r: NodeRoute): string => `${r.from}\u0000${r.to}`;
const slug = (text: string, fallback: string): string => {
  const s = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return /^[a-z]/.test(s) ? s : `${fallback}${s ? `-${s}` : ''}`;
};

/** A node's name as a reader sees it. */
const nameOf = (node: WorkflowNode | undefined, kinds: Kinds): string => node?.heading ?? kinds[node?.kind ?? '']?.heading ?? node?.kind ?? '?';

/** A socket address in words: "Store › Rows". */
function wordsOf(address: string, workflow: WorkflowDefinition, kinds: Kinds): string {
  const { node: id, row } = socketOf(address);
  const node = workflow.nodes.find((n) => n.id === id);
  const kind = kindOfNode(kinds, node);
  const part = row === FALSE_SOCKET ? 'False' : row === undefined ? (kind?.branches ? 'True' : '') : (rowOf(kind?.rows ?? [], row)?.label ?? row);
  return [nameOf(node, kinds), part].filter(Boolean).join(' › ');
}

/** The type a route carries, from the output it leaves; none, it has no such output. */
const sentBy = (address: string, workflow: WorkflowDefinition, kinds: Kinds): SocketType | undefined => {
  const { node: id, row } = socketOf(address);
  const kind = kindOfNode(kinds, workflow.nodes.find((n) => n.id === id));
  return kind && socketType(kind, row, 'output');
};

const asSocket = (type: SocketType | undefined): NodeSocket['type'] => (type === 'value' || type === 'boolean' ? type : 'object');

/** A name no socket holds yet: the address, as a name, then numbered. */
function freeName(base: string, taken: Set<string>): string {
  let name = base;
  for (let n = 2; taken.has(name); n++) name = `${base}-${n}`;
  taken.add(name);
  return name;
}

/**
 * Several nodes as one Custom Node (D9). The definition holds the nodes as they sit and the routes
 * between them; each route over the edge is a socket — one per outside output that feeds in (a
 * Group Input row), one per inside output that feeds out (a Group Output row) — typed by what its
 * source sends, as what it feeds reads it (TODO 770); ONE use takes their place, joined as they were.
 * Refused, in words: nothing picked, no name, a node of a Group, a loop that leaves the picked nodes
 * and returns, and a result with a fault the workflow did not have.
 */
export function groupNodes(
  workflow: WorkflowDefinition, picked: readonly string[], library: NodeLibrary, ask: GroupAsk, kinds: Kinds = NODE_KINDS, facts: Pick<WorkflowFacts, 'fields'> = {},
): Grouped {
  const all: Kinds = { ...kindsOf(library), ...kinds };
  const ids = new Set(picked.filter((id) => workflow.nodes.some((n) => n.id === id)));
  const label = ask.label.trim();
  if (picked.some((id) => id.startsWith('#'))) return { fault: 'Group Input and Group Output belong to a Custom Node: they cannot be saved into another' };
  if (!ids.size) return { fault: 'pick the nodes to save first: none of them are on the graph' };
  if (!label) return { fault: 'give the Custom Node a name' };
  const routes = workflow.routes ?? [];
  const inside = (address: string): boolean => ids.has(socketOf(address).node);
  // A route that leaves the picked nodes and comes back would make the Custom Node hold a loop through the graph.
  const queue = routes.filter((r) => inside(r.from) && !inside(r.to)).map((r) => socketOf(r.to).node);
  const seen = new Set<string>();
  while (queue.length) {
    const at = queue.shift()!;
    if (seen.has(at)) continue;
    seen.add(at);
    for (const r of routes) {
      if (socketOf(r.from).node !== at) continue;
      if (inside(r.to)) {
        const outer = workflow.nodes.find((n) => n.id === at);
        return { fault: `"${nameOf(outer, all)}" takes what leaves the picked nodes and gives it back to "${nameOf(workflow.nodes.find((n) => n.id === socketOf(r.to).node), all)}": the Custom Node would hold a loop through it. Pick "${nameOf(outer, all)}" too, or leave one of them out` };
      }
      queue.push(socketOf(r.to).node);
    }
  }
  const ins = routes.filter((r) => !inside(r.from) && inside(r.to));
  const outs = routes.filter((r) => inside(r.from) && !inside(r.to));
  const taken = new Set<string>();
  const inputs: NodeSocket[] = [];
  const outputs: NodeOutput[] = [];
  const inner: NodeRoute[] = routes.filter((r) => inside(r.from) && inside(r.to));
  const outer: NodeRoute[] = routes.filter((r) => !inside(r.from) && !inside(r.to));
  const base = slug(ask.id ?? label, 'node');
  const id = ((): string => {
    let n = 1;
    let free = base;
    while (free in library.nodes || free in NODE_KINDS || free in kinds) free = `${base}-${++n}`;
    return free;
  })();
  const use = ((): string => {
    let n = 1;
    while (workflow.nodes.some((x) => x.id === `${id}-${n}`)) n++;
    return `${id}-${n}`;
  })();
  // A socket per outside output that feeds in: every inside input it reaches hangs off its row.
  for (const from of [...new Set(ins.map((r) => r.from))]) {
    const reached = ins.filter((r) => r.from === from);
    const name = freeName(slug(from.replace('/', '-').replace('#', ''), 'in'), taken);
    inputs.push({ name, label: wordsOf(from, workflow, all), type: asSocket(sentBy(from, workflow, all)) });
    for (const r of reached) inner.push({ from: `#in/${name}`, to: r.to });
    outer.push({ from, to: `${use}/${name}` });
  }
  // A socket per inside output that feeds out: every outside input it reaches hangs off its row.
  for (const from of [...new Set(outs.map((r) => r.from))]) {
    const name = freeName(slug(from.replace('/', '-').replace('#', ''), 'out'), taken);
    outputs.push({ name, label: wordsOf(from, workflow, all), type: asSocket(sentBy(from, workflow, all)) });
    inner.push({ from, to: `#out/${name}` });
    for (const r of outs.filter((x) => x.from === from)) outer.push({ from: `${use}/${name}`, to: r.to });
  }
  const nodes = workflow.nodes.filter((n) => ids.has(n.id));
  // A tie of inner routes only goes inside; a tie of outer ones stays.
  const tied = (workflow.ties ?? []).filter((t) => t.routes.every((r) => inner.some((x) => x.from === r.from && x.to === r.to)));
  // A frame of picked nodes only goes inside; one partly picked keeps the rest. TODO 778
  const framed = (workflow.frames ?? []).filter((f) => f.nodes.every((n) => ids.has(n)));
  const definition: NodeDefinition = {
    v: 1, label, ...(ask.description?.trim() ? { description: ask.description.trim() } : {}), ...(ask.category?.trim() ? { category: ask.category.trim() } : {}),
    ...(tidyTags(ask.tags).length ? { tags: tidyTags(ask.tags) } : {}),
    inputs, outputs, nodes: structuredClone(nodes), routes: inner,
    ...(tied.length ? { ties: structuredClone(tied) } : {}),
    ...(framed.length ? { frames: structuredClone(framed) } : {}),
  };
  const made: NodeLibrary = { ...library, nodes: { ...library.nodes, [id]: definition } };
  const x = Math.round(nodes.reduce((s, n) => s + n.x, 0) / nodes.length);
  const y = Math.round(nodes.reduce((s, n) => s + n.y, 0) / nodes.length);
  const at = workflow.nodes.findIndex((n) => ids.has(n.id));
  const placed = workflow.nodes.filter((n) => !ids.has(n.id));
  const after: WorkflowNode[] = [...placed.slice(0, at), useOf(made, id, { id: use, x, y }), ...placed.slice(at)];
  const { ties: _ties, frames: _frames, ...flat } = workflow;
  const stay = tiesAmong(workflow.ties, outer);
  const frames = framesAmong((workflow.frames ?? []).filter((f) => !framed.includes(f)), placed.map((n) => n.id));
  const next: WorkflowDefinition = { ...flat, nodes: after, routes: outer, ...(stay.length ? { ties: stay } : {}), ...(frames.length ? { frames } : {}) };
  const was = new Set(workflowFaultsDeep(workflow, library, kinds, facts));
  const added = workflowFaultsDeep(next, made, kinds, facts).filter((f) => !was.has(f));
  if (added.length) return { fault: `the Custom Node would not pass the checks: ${added.join('; ')}` };
  return { workflow: next, library: made, id, use };
}

/**
 * A use as its nodes again, in place (Ungroup): the definition's nodes where the definition put
 * them, its inner routes, and each route into a row joined to every inner socket that row feeds.
 * A row that feeds nothing inside, and the header, which is no row, have nowhere to go: their
 * routes are dropped. A socket no route fed gives its value to the inner row it reached, where the
 * use held one. A node whose id the graph holds takes the use's name in front. Refused, in words,
 * when the use is none. TRAP T-a-custom-node-header-adds-an-input
 */
export function ungroupUse(
  workflow: WorkflowDefinition, useId: string, library: NodeLibrary, kinds: Kinds = NODE_KINDS,
): { workflow: WorkflowDefinition } | { fault: string } {
  const use = workflow.nodes.find((n) => n.id === useId);
  const definition = use && library?.nodes?.[use.kind];
  if (!use || !definition || (!!kinds[use.kind] && kinds[use.kind]!.model !== 'graph')) return { fault: 'only a Custom Node can be ungrouped' };
  const held = new Set(workflow.nodes.filter((n) => n.id !== useId).map((n) => n.id));
  const rename = new Map(definition.nodes.map((n) => [n.id, held.has(n.id) ? `${useId}-${n.id}` : n.id] as const));
  const moved = (address: string): string => {
    const { node, row } = socketOf(address);
    return `${rename.get(node) ?? node}${row === undefined ? '' : `/${row}`}`;
  };
  const routes = workflow.routes ?? [];
  const touching = (r: NodeRoute): boolean => socketOf(r.from).node === useId || socketOf(r.to).node === useId;
  const sockets = (side: 'in' | 'out', name: string | undefined): string => `${side === 'in' ? '#in' : '#out'}${name === undefined ? '' : `/${name}`}`;
  const joined: NodeRoute[] = [];
  const values = new Map<string, Record<string, unknown>>();
  for (const r of routes.filter((x) => socketOf(x.to).node === useId)) {
    const { row } = socketOf(r.to);
    if (row === undefined) continue;
    for (const inner of (definition.routes ?? []).filter((x) => x.from === sockets('in', row))) joined.push({ from: r.from, to: moved(inner.to) });
  }
  for (const r of routes.filter((x) => socketOf(x.from).node === useId)) {
    const { row } = socketOf(r.from);
    if (row === FALSE_SOCKET) continue;
    for (const inner of (definition.routes ?? []).filter((x) => x.to === sockets('out', row))) joined.push({ from: moved(inner.from), to: r.to });
  }
  // A parameter nothing fed: the row it reached holds its value.
  for (const input of definition.inputs) {
    if (routes.some((r) => r.to === `${useId}/${input.name}`)) continue;
    const value = use.values?.[input.name] ?? input.default;
    if (value === undefined) continue;
    for (const inner of (definition.routes ?? []).filter((x) => x.from === `#in/${input.name}`)) {
      const { node, row } = socketOf(moved(inner.to));
      if (row !== undefined) values.set(node, { ...values.get(node), [row]: value });
    }
  }
  const body = (definition.routes ?? []).filter((r) => !r.from.startsWith('#') && !r.to.startsWith('#')).map((r) => ({ from: moved(r.from), to: moved(r.to) }));
  const nodes: WorkflowNode[] = structuredClone(definition.nodes as WorkflowNode[]).map((n) => {
    const own = values.get(rename.get(n.id)!);
    return { ...n, id: rename.get(n.id)!, ...(own ? { values: { ...n.values, ...own } } : {}) };
  });
  const at = workflow.nodes.findIndex((n) => n.id === useId);
  const rest = workflow.nodes.filter((n) => n.id !== useId);
  const seen = new Set<string>();
  const all = [...routes.filter((r) => !touching(r)), ...body, ...joined].filter((r) => !seen.has(key(r)) && !!seen.add(key(r)));
  const kept = tiesAmong(workflow.ties, all);
  // The definition's frames come out, by the nodes' new ids; one whose id the graph holds takes the use's name in front.
  const outer = framesAmong(workflow.frames, rest.map((n) => n.id));
  const out: NodeFrame[] = (definition.frames ?? []).map((f) => ({
    ...structuredClone(f), id: outer.some((o) => o.id === f.id) ? `${useId}-${f.id}` : f.id, nodes: f.nodes.map((id) => rename.get(id) ?? id),
  }));
  const frames = framesAmong([...outer, ...out], [...rest, ...nodes].map((n) => n.id));
  const { ties: _ties, frames: _frames, ...flat } = workflow;
  return { workflow: { ...flat, nodes: [...rest.slice(0, at), ...nodes, ...rest.slice(at)], routes: all, ...(kept.length ? { ties: kept } : {}), ...(frames.length ? { frames } : {}) } };
}

/**
 * A route let go on a use's header (Will, 2026-11-05): the header takes ANYTHING, and matches it to
 * no row. Its definition gains a new input — a Group Input row inside, a row on every use — named
 * and typed by the source, as groupNodes names one; it feeds nothing inside until the reader routes
 * it. The route enters this use's new row, and the use follows the new definition where it followed
 * the old; every other use says Update available (D11). Refused, in words: a preset, read only, and
 * what is no use's header. TRAP T-a-custom-node-header-adds-an-input
 */
export function headerInput(
  workflow: WorkflowDefinition, route: NodeRoute, library: NodeLibrary, kinds: Kinds = NODE_KINDS,
): { workflow: WorkflowDefinition; library: NodeLibrary; id: string } | { fault: string } {
  const all: Kinds = { ...kindsOf(library), ...kinds };
  const { node: useId, row } = socketOf(route.to);
  const use = workflow.nodes.find((n) => n.id === useId);
  const definition = use && library?.nodes?.[use.kind];
  if (!use || !definition || row !== undefined || all[use.kind]?.model !== 'graph') return { fault: 'only a Custom Node\'s header takes a new input' };
  if (definition.preset) return { fault: 'a preset is read only: Copy to my nodes to add an input' };
  const taken = new Set([...definition.inputs, ...definition.outputs].map((s) => s.name));
  const name = freeName(slug(route.from.replace('/', '-').replace('#', ''), 'in'), taken);
  const input: NodeSocket = { name, label: wordsOf(route.from, workflow, all), type: asSocket(sentBy(route.from, workflow, all)) };
  const made: NodeLibrary = { ...library, nodes: { ...library.nodes, [use.kind]: { ...definition, inputs: [...definition.inputs, input] } } };
  // A route held on the header moves onto the row, its bends and ties with it; a new one is added.
  const same = (r: NodeRoute): boolean => r.from === route.from && r.to === route.to;
  const onRow = (r: NodeRoute): NodeRoute => (same(r) ? { ...r, to: `${useId}/${name}` } : r);
  const routes = workflow.routes ?? [];
  const next: WorkflowDefinition = {
    ...workflow,
    routes: routes.some(same) ? routes.map(onRow) : [...routes, onRow(route)],
    ...(workflow.ties ? { ties: workflow.ties.map((t) => ({ ...t, routes: t.routes.map(onRow) })) } : {}),
  };
  return { workflow: use.version === versionOf(definition) ? updateInstance(next, useId, made, kinds) : next, library: made, id: use.kind };
}

/** Each route a use's header holds from a file saved before, read ONCE as its own new input, as
 *  headerInput makes one; a preset's stays where it is. Save writes the new form. */
export function heldInputs(
  workflow: WorkflowDefinition, library: NodeLibrary, kinds: Kinds = NODE_KINDS,
): { workflow: WorkflowDefinition; library: NodeLibrary; ids: string[] } {
  let read = { workflow, library };
  const ids = new Set<string>();
  for (const r of workflow.routes ?? []) {
    const made = socketOf(r.to).row === undefined ? headerInput(read.workflow, r, read.library, kinds) : undefined;
    if (!made || 'fault' in made) continue;
    read = made;
    ids.add(made.id);
  }
  return { ...read, ids: [...ids] };
}
