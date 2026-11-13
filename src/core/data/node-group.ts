/**
 * node-group.ts — "Save as Custom Node" and its inverse "Ungroup", as two pure edits, and a use's sockets changed: several
 * nodes of a workflow become one definition and ONE use in their place, each connection over the edge
 * a typed socket (a Group Input or Output row); Ungroup puts the nodes and the connections back. Both
 * check what they make, and refuse in words. A portal's name is local to its graph: a pick that cuts one in two is
 * refused, and Ungroup renumbers a name the graph holds. DOM-free. Will, TODOs 719, 779 · plan 713 §9.2, M11, D9
 * TRAP T-a-custom-node-is-an-instance · TRAP T-a-portal-hop-is-resolved-once
 *
 * Map:
 * - GroupAsk — What "Save as Custom Node" is asked: a name; a description, tags, category and id if given.
 * - Grouped — The edit's answer: the workflow, the library and the use, or why it was refused.
 * - groupNodes — Several nodes as one Custom Node: a definition, and one use in their place.
 * - ungroupUse — A use as its nodes again, in place: the inverse of groupNodes.
 * - headerInput — A connection let go on a use's header: a new input of its definition, joined to the use's new row.
 * - SocketChange — One change to a socket of a Custom Node: its new name, its new type, or none, so it goes.
 * - socketEdit — A socket of a use's definition renamed, retyped or removed: one edit, this use following it.
 * - heldInputs — Each connection a use's header holds from before, read once as its own new input; a preset's stays.
 */
import { NODE_KINDS, nodeKinds, kindOfNode, rowOf, socketOf, socketType, type NodeKind, type NodeConnection, type SocketType } from './node-kinds.js';
import { kindsOf, updateInstance, useOf, versionOf, workflowFaultsDeep, type NodeDefinition, type NodeLibrary, type NodeOutput, type NodeSocket } from './node-library.js';
import { tidyTags } from './tags.js';
import { nodeWidth, tiesAmong, type WorkflowDefinition, type WorkflowFacts, type WorkflowNode } from './workflow.js';
import { restage } from './node-stages.js';
import { framesAmong, type NodeFrame } from './node-frames.js';
import { PORTAL, addressOf, addressRow, cutNames, ungroupNames } from './node-portals.js';

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

const key = (r: NodeConnection): string => `${r.from}\u0000${r.to}`;
const slug = (text: string, fallback: string): string => {
  const s = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return /^[a-z]/.test(s) ? s : `${fallback}${s ? `-${s}` : ''}`;
};

/** A node's name as a reader sees it. */
const nameOf = (node: WorkflowNode | undefined, kinds: Kinds): string => node?.heading ?? kinds[node?.kind ?? '']?.heading ?? node?.kind ?? '?';

/** A socket address in words: "Source › Rows"; a portal's row, its source's words. */
function wordsOf(address: string, workflow: WorkflowDefinition, kinds: Kinds): string {
  const { node: id, row } = socketOf(address);
  const node = workflow.nodes.find((n) => n.id === id);
  const source = node?.kind === PORTAL ? addressOf(row) : undefined;
  if (source !== undefined) return wordsOf(source, workflow, kinds);
  const kind = kindOfNode(kinds, node);
  const part = row === undefined ? '' : (rowOf(kind?.rows ?? [], row)?.label ?? row);
  return [nameOf(node, kinds), part].filter(Boolean).join(' › ');
}

/** The type a connection carries, from the output it leaves; none, it has no such output. */
const sentBy = (address: string, workflow: WorkflowDefinition, kinds: Kinds): SocketType | undefined => {
  const { node: id, row } = socketOf(address);
  const node = workflow.nodes.find((n) => n.id === id);
  const source = node?.kind === PORTAL ? addressOf(row) : undefined;
  if (source !== undefined) return sentBy(source, workflow, kinds);
  const kind = kindOfNode(kinds, node);
  return kind && socketType(kind, row, 'output');
};

/** A portal Out's row address with its source rewritten, through any Out's row it names: none rewritten, as it was. */
function rerow(address: string, portal: (id: string) => boolean, rewrite: (source: string) => string | undefined): string {
  const { node, row } = socketOf(address);
  const source = portal(node) ? addressOf(row) : undefined;
  return source === undefined ? address : `${node}/${addressRow(rewrite(source) ?? rerow(source, portal, rewrite))}`;
}

const asSocket = (type: SocketType | undefined): NodeSocket['type'] => (type === 'value' || type === 'boolean' ? type : 'object');

/** A name no socket holds yet: the address, as a name, then numbered. */
function freeName(base: string, taken: Set<string>): string {
  let name = base;
  for (let n = 2; taken.has(name); n++) name = `${base}-${n}`;
  taken.add(name);
  return name;
}

/**
 * Several nodes as one Custom Node (D9). The definition holds the nodes as they sit and the connections
 * between them; each connection over the edge is a socket — one per outside output that feeds in (a
 * Group Input row), one per inside output that feeds out (a Group Output row) — typed by what its
 * source sends, as what it feeds reads it (TODO 770); ONE use takes their place, joined as they were.
 * Refused, in words: nothing picked, no name, a node of a Group, a loop that leaves the picked nodes
 * and returns, and a result with a fault the workflow did not have.
 */
export function groupNodes(
  workflow: WorkflowDefinition, picked: readonly string[], library: NodeLibrary, ask: GroupAsk, kinds: Kinds = nodeKinds(), facts: Pick<WorkflowFacts, 'fieldsOf' | 'rowsFrom'> = {},
): Grouped {
  const all: Kinds = { ...kindsOf(library), ...kinds };
  const ids = new Set(picked.filter((id) => workflow.nodes.some((n) => n.id === id)));
  const label = ask.label.trim();
  if (picked.some((id) => id.startsWith('#'))) return { fault: 'Group Input and Group Output belong to a Custom Node: they cannot be saved into another' };
  if (!ids.size) return { fault: 'pick the nodes to save first: none of them are on the graph' };
  if (!label) return { fault: 'give the Custom Node a name' };
  // A name is local to its graph: one whose portals are on both sides would be cut in two.
  const cut = cutNames(workflow.nodes, ids);
  if (cut.length) return { fault: `the portal ${cut.map((n) => `"${n}"`).join(', ')} joins picked nodes to others: pick every portal of its name, or none` };
  const connections = workflow.connections ?? [];
  const inside = (address: string): boolean => ids.has(socketOf(address).node);
  // A connection that leaves the picked nodes and comes back would make the Custom Node hold a loop through the graph.
  const queue = connections.filter((r) => inside(r.from) && !inside(r.to)).map((r) => socketOf(r.to).node);
  const seen = new Set<string>();
  while (queue.length) {
    const at = queue.shift()!;
    if (seen.has(at)) continue;
    seen.add(at);
    for (const r of connections) {
      if (socketOf(r.from).node !== at) continue;
      if (inside(r.to)) {
        const outer = workflow.nodes.find((n) => n.id === at);
        return { fault: `"${nameOf(outer, all)}" takes what leaves the picked nodes and gives it back to "${nameOf(workflow.nodes.find((n) => n.id === socketOf(r.to).node), all)}": the Custom Node would hold a loop through it. Pick "${nameOf(outer, all)}" too, or leave one of them out` };
      }
      queue.push(socketOf(r.to).node);
    }
  }
  const ins = connections.filter((r) => !inside(r.from) && inside(r.to));
  const outs = connections.filter((r) => inside(r.from) && !inside(r.to));
  const taken = new Set<string>();
  const inputs: NodeSocket[] = [];
  const outputs: NodeOutput[] = [];
  const inner: NodeConnection[] = connections.filter((r) => inside(r.from) && inside(r.to));
  const outer: NodeConnection[] = connections.filter((r) => !inside(r.from) && !inside(r.to));
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
  const fed = new Map<string, string>();
  for (const from of [...new Set(ins.map((r) => r.from))]) {
    const reached = ins.filter((r) => r.from === from);
    const name = freeName(slug(from.replace('/', '-').replace('#', ''), 'in'), taken);
    fed.set(from, `#in/${name}`);
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
  // A portal Out's row whose source is outside is the Group Input's row it now comes in by. TODO 826
  const portal = (node: string): boolean => ids.has(node) && workflow.nodes.find((n) => n.id === node)?.kind === PORTAL;
  for (const [n, r] of inner.entries()) inner[n] = { ...r, from: rerow(r.from, portal, (source) => fed.get(source)) };
  const nodes = workflow.nodes.filter((n) => ids.has(n.id));
  // A tie of inner connections only goes inside; a tie of outer ones stays.
  const tied = (workflow.ties ?? []).filter((t) => t.connections.every((r) => inner.some((x) => x.from === r.from && x.to === r.to)));
  // A frame of picked nodes only goes inside; one partly picked keeps the rest. TODO 778
  const framed = (workflow.frames ?? []).filter((f) => f.nodes.every((n) => ids.has(n)));
  // A stage a picked node is in goes inside with it, so the nodes that name it find it. TODO 947
  const staged = (workflow.stages ?? []).filter((s) => nodes.some((n) => n.stage === s.id));
  const definition: NodeDefinition = {
    v: 1, label, ...(ask.description?.trim() ? { description: ask.description.trim() } : {}), ...(ask.category?.trim() ? { category: ask.category.trim() } : {}),
    ...(tidyTags(ask.tags).length ? { tags: tidyTags(ask.tags) } : {}),
    inputs, outputs, nodes: structuredClone(nodes), connections: inner,
    ...(tied.length ? { ties: structuredClone(tied) } : {}),
    ...(framed.length ? { frames: structuredClone(framed) } : {}),
    ...(staged.length ? { stages: structuredClone(staged) } : {}),
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
  // The use stands in the stage it is placed in, as a new node does.
  const next: WorkflowDefinition = restage({ ...flat, nodes: after, connections: outer, ...(stay.length ? { ties: stay } : {}), ...(frames.length ? { frames } : {}) }, [use], nodeWidth);
  const was = new Set(workflowFaultsDeep(workflow, library, kinds, facts));
  const added = workflowFaultsDeep(next, made, kinds, facts).filter((f) => !was.has(f));
  if (added.length) return { fault: `the Custom Node would not pass the checks: ${added.join('; ')}` };
  return { workflow: next, library: made, id, use };
}

/**
 * A use as its nodes again, in place (Ungroup): the definition's nodes where the definition put
 * them, its inner connections, and each connection into a row joined to every inner socket that row feeds.
 * A row that feeds nothing inside, and the header, which is no row, have nowhere to go: their
 * connections are dropped. A socket no connection fed gives its value to the inner row it reached, where the
 * use held one. A node whose id the graph holds takes the use's name in front. Refused, in words,
 * when the use is none. TRAP T-a-custom-node-header-adds-an-input
 */
export function ungroupUse(
  workflow: WorkflowDefinition, useId: string, library: NodeLibrary, kinds: Kinds = nodeKinds(),
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
  // A portal Out's row, by its source's new address: one from the Group Input is a row per connect the use's input took. TODO 826
  const portal = (node: string): boolean => definition.nodes.some((n) => n.id === node && n.kind === PORTAL);
  const feeders = (name: string): string[] => (workflow.connections ?? []).filter((r) => r.to === `${useId}/${name}`).map((r) => r.from);
  const expand = (address: string): string[] => {
    const { node, row } = socketOf(address);
    const source = portal(node) ? addressOf(row) : undefined;
    if (source === undefined) return [moved(address)];
    const from = source.startsWith('#in/') ? feeders(socketOf(source).row ?? '') : expand(source);
    return from.map((f) => `${rename.get(node) ?? node}/${addressRow(f)}`);
  };
  const connections = workflow.connections ?? [];
  const touching = (r: NodeConnection): boolean => socketOf(r.from).node === useId || socketOf(r.to).node === useId;
  const sockets = (side: 'in' | 'out', name: string | undefined): string => `${side === 'in' ? '#in' : '#out'}${name === undefined ? '' : `/${name}`}`;
  const joined: NodeConnection[] = [];
  const values = new Map<string, Record<string, unknown>>();
  for (const r of connections.filter((x) => socketOf(x.to).node === useId)) {
    const { row } = socketOf(r.to);
    if (row === undefined) continue;
    for (const inner of (definition.connections ?? []).filter((x) => x.from === sockets('in', row))) joined.push({ from: r.from, to: moved(inner.to) });
  }
  for (const r of connections.filter((x) => socketOf(x.from).node === useId)) {
    const { row } = socketOf(r.from);
    for (const inner of (definition.connections ?? []).filter((x) => x.to === sockets('out', row))) for (const from of expand(inner.from)) joined.push({ from, to: r.to });
  }
  // A parameter nothing fed: the row it reached holds its value.
  for (const input of definition.inputs) {
    if (connections.some((r) => r.to === `${useId}/${input.name}`)) continue;
    const value = use.values?.[input.name] ?? input.default;
    if (value === undefined) continue;
    for (const inner of (definition.connections ?? []).filter((x) => x.from === `#in/${input.name}`)) {
      const { node, row } = socketOf(moved(inner.to));
      if (row !== undefined) values.set(node, { ...values.get(node), [row]: value });
    }
  }
  const body = (definition.connections ?? []).filter((r) => !r.from.startsWith('#') && !r.to.startsWith('#')).flatMap((r) => expand(r.from).map((from) => ({ from, to: moved(r.to) })));
  // A portal name the graph holds already takes the next free number: nothing links that did not.
  const names = ungroupNames(workflow.nodes.filter((n) => n.id !== useId), definition.nodes);
  const nodes: WorkflowNode[] = structuredClone(definition.nodes as WorkflowNode[]).map((n) => {
    const own = values.get(rename.get(n.id)!);
    const name = n.kind === PORTAL ? names.get(String(n.values?.['name'] ?? '').trim()) : undefined;
    const kept = own || name ? { values: { ...n.values, ...own, ...(name ? { name } : {}) } } : {};
    return { ...n, id: rename.get(n.id)!, ...kept };
  });
  const at = workflow.nodes.findIndex((n) => n.id === useId);
  const rest = workflow.nodes.filter((n) => n.id !== useId);
  const seen = new Set<string>();
  const all = [...connections.filter((r) => !touching(r)), ...body, ...joined].filter((r) => !seen.has(key(r)) && !!seen.add(key(r)));
  const kept = tiesAmong(workflow.ties, all);
  // The definition's frames come out, by the nodes' new ids; one whose id the graph holds takes the use's name in front.
  const outer = framesAmong(workflow.frames, rest.map((n) => n.id));
  const out: NodeFrame[] = (definition.frames ?? []).map((f) => ({
    ...structuredClone(f), id: outer.some((o) => o.id === f.id) ? `${useId}-${f.id}` : f.id, nodes: f.nodes.map((id) => rename.get(id) ?? id),
  }));
  const frames = framesAmong([...outer, ...out], [...rest, ...nodes].map((n) => n.id));
  const { ties: _ties, frames: _frames, ...flat } = workflow;
  return { workflow: { ...flat, nodes: [...rest.slice(0, at), ...nodes, ...rest.slice(at)], connections: all, ...(kept.length ? { ties: kept } : {}), ...(frames.length ? { frames } : {}) } };
}

/** A workflow whose use takes its definition's change where it followed the definition before; else as it was (D11). */
function follows(workflow: WorkflowDefinition, use: WorkflowNode, was: NodeDefinition, library: NodeLibrary, kinds: Kinds): WorkflowDefinition {
  return use.version === versionOf(was) ? updateInstance(workflow, use.id, library, kinds) : workflow;
}

/**
 * A connection let go on a use's header (Will, 2026-11-05): the header takes ANYTHING, and matches it to
 * no row. Its definition gains a new input — a Group Input row inside, a row on every use — named
 * and typed by the source, as groupNodes names one; it feeds nothing inside until the reader connections
 * it. The connection enters this use's new row, and the use follows the new definition where it followed
 * the old; every other use says Update available (D11). Refused, in words: a preset, read only, and
 * what is no use's header. TRAP T-a-custom-node-header-adds-an-input
 */
export function headerInput(
  workflow: WorkflowDefinition, connection: NodeConnection, library: NodeLibrary, kinds: Kinds = nodeKinds(),
): { workflow: WorkflowDefinition; library: NodeLibrary; id: string } | { fault: string } {
  const all: Kinds = { ...kindsOf(library), ...kinds };
  const { node: useId, row } = socketOf(connection.to);
  const use = workflow.nodes.find((n) => n.id === useId);
  const definition = use && library?.nodes?.[use.kind];
  if (!use || !definition || row !== undefined || all[use.kind]?.model !== 'graph') return { fault: 'only a Custom Node\'s header takes a new input' };
  if (definition.preset) return { fault: 'a preset is read only: Copy to my nodes to add an input' };
  const taken = new Set([...definition.inputs, ...definition.outputs].map((s) => s.name));
  const name = freeName(slug(connection.from.replace('/', '-').replace('#', ''), 'in'), taken);
  const input: NodeSocket = { name, label: wordsOf(connection.from, workflow, all), type: asSocket(sentBy(connection.from, workflow, all)) };
  const made: NodeLibrary = { ...library, nodes: { ...library.nodes, [use.kind]: { ...definition, inputs: [...definition.inputs, input] } } };
  // A connection held on the header moves onto the row, its bends and ties with it; a new one is added.
  const same = (r: NodeConnection): boolean => r.from === connection.from && r.to === connection.to;
  const onRow = (r: NodeConnection): NodeConnection => (same(r) ? { ...r, to: `${useId}/${name}` } : r);
  const connections = workflow.connections ?? [];
  const next: WorkflowDefinition = {
    ...workflow,
    connections: connections.some(same) ? connections.map(onRow) : [...connections, onRow(connection)],
    ...(workflow.ties ? { ties: workflow.ties.map((t) => ({ ...t, connections: t.connections.map(onRow) })) } : {}),
  };
  return { workflow: follows(next, use, definition, made, kinds), library: made, id: use.kind };
}

/** One change to a socket of a Custom Node: its new name, its new type, or none, so it goes. */
export type SocketChange = { label: string } | { type: NodeSocket['type'] } | null;

const SOCKET_TYPES: readonly string[] = ['value', 'object', 'boolean'];

/**
 * A socket of a use's definition renamed, retyped or removed (plan 942 D4 A), ONE edit as headerInput is: the
 * definition changed, and this use follows it where it followed the old; every other use says Update available. A
 * removed socket takes its connections with it, inside the body and on each use of this graph. A new type keeps each connection:
 * one that no longer fits warns, as any does. Refused, in words: a preset, a socket it has not, a name that is none.
 */
export function socketEdit(
  workflow: WorkflowDefinition, useId: string, side: 'inputs' | 'outputs', name: string, change: SocketChange,
  library: NodeLibrary, kinds: Kinds = nodeKinds(),
): { workflow: WorkflowDefinition; library: NodeLibrary; id: string } | { fault: string } {
  const use = workflow.nodes.find((n) => n.id === useId);
  const definition = use && library?.nodes?.[use.kind];
  if (!use || !definition || ({ ...kindsOf(library), ...kinds })[use.kind]?.model !== 'graph') return { fault: 'only a Custom Node has sockets to change' };
  if (definition.preset) return { fault: 'a preset is read only: Copy to my nodes to change its sockets' };
  const word = side === 'inputs' ? 'input' : 'output';
  const sockets: readonly (NodeSocket | NodeOutput)[] = definition[side];
  const was = sockets.find((s) => s.name === name);
  if (!was) return { fault: `it has no ${word} "${name}"` };
  let next: (NodeSocket | NodeOutput)[];
  if (change === null) next = sockets.filter((s) => s !== was);
  else if ('label' in change) {
    const label = String(change.label ?? '').trim();
    if (!label) return { fault: `an ${word} needs a name` };
    next = sockets.map((s) => (s === was ? { ...s, label } : s));
  } else {
    if (!SOCKET_TYPES.includes(change.type)) return { fault: `"${String(change.type)}" is no socket type: value, object or boolean` };
    // Only an object's list picks several (D17).
    next = sockets.map((s) => {
      if (s !== was) return s;
      const { multiple: _multiple, ...rest } = s as NodeSocket;
      return change.type === 'object' && (s as NodeSocket).multiple ? { ...rest, type: change.type, multiple: true } : { ...rest, type: change.type };
    });
  }
  // A removed socket's connections go: inside, from `#in/<name>` or into `#out/<name>`; outside, at the row of EVERY use on
  // this graph, as each is drawn from the definition now, and one left would be a fault.
  const inner = side === 'inputs' ? `#in/${name}` : `#out/${name}`;
  const rows = new Set(workflow.nodes.filter((n) => n.kind === use.kind).map((n) => `${n.id}/${name}`));
  const body = change === null ? (definition.connections ?? []).filter((r) => (side === 'inputs' ? r.from : r.to) !== inner) : definition.connections;
  const outside = change === null ? (workflow.connections ?? []).filter((r) => !rows.has(side === 'inputs' ? r.to : r.from)) : workflow.connections;
  const changed: NodeDefinition = {
    ...definition, [side]: next,
    ...(body ? { connections: body } : {}), ...(definition.ties && body ? { ties: tiesAmong(definition.ties, body) } : {}),
  };
  const made: NodeLibrary = { ...library, nodes: { ...library.nodes, [use.kind]: changed } };
  const after: WorkflowDefinition = {
    ...workflow, ...(outside ? { connections: outside } : {}), ...(workflow.ties && outside ? { ties: tiesAmong(workflow.ties, outside) } : {}),
  };
  return { workflow: follows(after, use, definition, made, kinds), library: made, id: use.kind };
}

/** Each connection a use's header holds from a file saved before, read ONCE as its own new input, as
 *  headerInput makes one; a preset's stays where it is. Save writes the new form. */
export function heldInputs(
  workflow: WorkflowDefinition, library: NodeLibrary, kinds: Kinds = nodeKinds(),
): { workflow: WorkflowDefinition; library: NodeLibrary; ids: string[] } {
  let read = { workflow, library };
  const ids = new Set<string>();
  for (const r of workflow.connections ?? []) {
    const made = socketOf(r.to).row === undefined ? headerInput(read.workflow, r, read.library, kinds) : undefined;
    if (!made || 'fault' in made) continue;
    read = made;
    ids.add(made.id);
  }
  return { ...read, ids: [...ids] };
}
