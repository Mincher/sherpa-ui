/**
 * A CUSTOM NODE IS AN INSTANCE: a workflow body saved under one name, its inputs and outputs said
 * once, as JSON (defs.v1 nodeDefinition). A use is a plain node whose kind is its id, fed its own connections and
 * holding its own values. It runs NESTED: innerOf gives the graph inside, the checks run there
 * with the same words and name each fault by path, and a Custom Node that holds itself is a loop.
 * A use records the version it was made from, so a change shows as a diff, and an update keeps
 * its own values. A preset is read only; a Clone makes one to edit (an-entity-keeps-its-versions).
 * Will, TODO 719 · plan 713 M9, D9-D13, D15. TRAP T-a-custom-node-is-an-instance
 *
 *   node --test test/unit/a-custom-node-is-an-instance.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { schemaCheck } from '../../scripts/lib/schema-check.mjs';

const core = new URL('../../dist/core/data/', import.meta.url);
const { NODE_KINDS } = await import(new URL('node-kinds.js', core));
const { editWorkflow, workflowFaults, workflowGraph } = await import(new URL('workflow.js', core));
const lib = await import(new URL('node-library.js', core));
const { onReport } = await import(new URL('report.js', core));

/** Org permissions: the rows in, their Role a Field, a Condition Equals the Role given as its Value B; Pass out. */
const ORG = {
  v: 1, label: 'Org permissions', category: 'Logic',
  inputs: [{ name: 'users', label: 'Users', type: 'object' }, { name: 'role', label: 'Role', type: 'value', control: 'text', default: 'admin' }],
  outputs: [{ name: 'allowed', label: 'Allowed', type: 'object' }],
  nodes: [{ id: 'role-field', kind: 'field', x: 0, y: 0, values: { field: 'role' } }, { id: 'has-role', kind: 'condition', x: 200, y: 0, values: { type: 'eq' } }],
  // The header out, made from the test's Pass (plan 971 §9).
  connections: [
    { from: '#in/users', to: 'role-field' }, { from: 'role-field/field', to: 'has-role' }, { from: '#in/role', to: 'has-role/b' },
    { from: 'has-role/pass', to: '#out/allowed' }, { from: 'has-role/pass', to: '#out' },
  ],
};
const library = (nodes = {}) => ({ v: 1, nodes: { 'org-permissions': structuredClone(ORG), ...structuredClone(nodes) } });
const flow = (use = {}) => ({
  v: 3, id: 'flow',
  nodes: [
    { id: 'start', kind: 'source', x: 0, y: 0, values: { store: 'users' } },
    { id: 'perm', kind: 'org-permissions', x: 360, y: 0, ...use },
    { id: 'end', kind: 'result', x: 720, y: 0 },
  ],
  connections: [{ from: 'start/rows', to: 'perm/users' }, { from: 'perm', to: 'end' }],
});
const faults = (w, l = library()) => lib.workflowFaultsDeep(w, l);
const heard = (fn) => {
  const said = [];
  const undo = onReport((r) => said.push(r.message));
  try { return { value: fn(), said }; } finally { undo(); }
};

test('a library passes its schema and the check; a planted fault in each rule fails the schema', () => {
  // Each definition by its schema (defs.v1 nodeDefinition): a library is built in memory, and no file holds one (plan 942).
  const check = (l) => Object.values(l.nodes).flatMap(schemaCheck('defs.v1.json#/$defs/nodeDefinition'));
  assert.deepEqual(check(library()), []);
  assert.equal(lib.checkNodeLibrary(library()), true);
  const bad = (change) => { const l = library(); change(l.nodes['org-permissions']); return check(l); };
  for (const [what, change] of [
    ['a label missing', (d) => delete d.label],
    ['an input of the type any', (d) => { d.inputs[0].type = 'any'; }],
    ['an output that takes many', (d) => { d.outputs[0].many = true; }],
    ['an unknown property', (d) => { d.x = 1; }],
    ['a connection to a made-up address', (d) => { d.connections[0].from = '#inn/users'; }],
    ['a socket that is no name', (d) => { d.inputs[0].name = 'Users'; }],
    ['no body', (d) => delete d.nodes],
  ]) assert.notDeepEqual(bad(change), [], what);
  // The library's own check says what its keys and version may be.
  assert.notDeepEqual(lib.nodeLibraryFaults({ v: 1, nodes: { 'Bad Id': ORG } }), [], 'a key that is no id');
  assert.notDeepEqual(lib.nodeLibraryFaults({ v: 2, nodes: {} }), [], 'only a v1');
});

test('a use is a node of the definition\'s kind: nodeKindOf gives a row per input and output, and kindsOf merges', () => {
  const kind = lib.nodeKindOf(ORG);
  assert.deepEqual([kind.heading, kind.model, kind.category, kind.output, kind.input], ['Org permissions', 'graph', 'Logic', 'boolean', 'any']);
  assert.deepEqual(kind.rows.map((r) => [r.name, r.input ?? r.output, r.control ?? null]), [['users', 'object', null], ['role', 'value', 'text'], ['allowed', 'object', null]]);
  assert.equal(lib.nodeKindOf({ ...ORG, category: undefined }).category, 'Custom Nodes');
  const kinds = { ...NODE_KINDS, ...lib.kindsOf(library()) };
  assert.deepEqual(faults(flow()), []);
  assert.deepEqual(workflowFaults(flow(), kinds), []);
  // It draws closed: one node with its rows, its own values shown.
  const graph = workflowGraph(flow({ values: { role: 'owner' } }), {}, kinds);
  const perm = graph.nodes.find((n) => n.id === 'perm');
  assert.deepEqual([perm.heading, perm.rows.map((r) => r.name), perm.rows.find((r) => r.name === 'role').value], ['Org permissions', ['users', 'role', 'allowed'], 'owner']);
  // A shipped kind's id is never a Custom Node's.
  assert.deepEqual(Object.keys(lib.kindsOf(library({ source: ORG }))), ['org-permissions']);
});

test('a use runs nested: innerOf gives the body with Group Input and Output, and this instance\'s parameters over the defaults', () => {
  const l = library();
  const own = lib.innerOf(flow({ values: { role: 'owner' } }).nodes[1], l);
  assert.deepEqual(own.workflow.nodes.map((n) => n.id), ['#in', 'role-field', 'has-role', '#out']);
  assert.deepEqual(own.params, { role: 'owner' });
  assert.deepEqual(lib.innerOf(flow().nodes[1], l).params, { role: 'admin' }, 'the default, until the instance sets its own');
  assert.deepEqual(workflowFaults(own.workflow, own.kinds), [], 'the body is a workflow, checked by the same function');
  assert.deepEqual(workflowGraph(own.workflow, {}, own.kinds).nodes.map((n) => n.heading), ['Group Input', 'Field', 'Condition', 'Group Output']);
  assert.equal(lib.innerOf({ id: 'x', kind: 'source' }, l), undefined, 'a shipped kind has no inside');
  assert.equal(lib.innerOf({ id: 'x', kind: 'nope' }, l), undefined);
});

test('a use gives the same faults inside, named by path', () => {
  const inside = library();
  inside.nodes['org-permissions'].nodes[1].values = { type: 'nonsense' };
  const said = faults(flow(), inside);
  assert.equal(said.length, 1);
  assert.match(said[0], /^Org permissions › Condition: the node "has-role" holds "nonsense" as its Check, which is none of its choices$/);
  // The same words as the body checked by itself.
  const body = lib.innerOf(flow().nodes[1], inside);
  assert.ok(workflowFaults(body.workflow, body.kinds).some((f) => said[0].endsWith(f)));
  // Two levels: the path goes through the use's own name.
  const deep = library({ outer: { v: 1, label: 'Outer', inputs: [{ name: 'users', type: 'object' }], outputs: [], nodes: [{ id: 'in-it', kind: 'org-permissions', heading: 'Inner', x: 0, y: 0 }], connections: [{ from: '#in/users', to: 'in-it/users' }] } });
  deep.nodes['org-permissions'] = inside.nodes['org-permissions'];
  assert.ok(lib.nodeLibraryFaults(deep).some((f) => f.startsWith('Outer › Inner › Condition: ')), lib.nodeLibraryFaults(deep).join('\n'));
  // And the library checker names the body's own path.
  assert.ok(lib.nodeLibraryFaults(inside).some((f) => f.startsWith('Org permissions › Condition: ')));
});

test('a connection to a socket the definition lost, or never had, is a fault; so is one inside to a lost socket', () => {
  assert.deepEqual(faults(flow()), []);
  const lost = library();
  lost.nodes['org-permissions'].inputs.shift();
  assert.ok(faults(flow(), lost).some((f) => f.includes('"perm/users", which is no input socket')));
  const inner = library();
  inner.nodes['org-permissions'].outputs = [];
  assert.ok(lib.nodeLibraryFaults(inner).some((f) => f.includes('"#out/allowed", which is no input socket')));
});

test('a use of an unknown id, and an id a shipped kind owns, are faults', () => {
  const w = flow();
  w.nodes[1].kind = 'nowhere';
  assert.ok(faults(w).some((f) => f.includes('of the kind "nowhere", which is not one')));
  assert.ok(lib.nodeLibraryFaults(library({ source: ORG })).some((f) => f.includes('"source" has the id of a kind that is shipped')));
  const shipped = heard(() => lib.checkNodeLibrary(library({ source: ORG })));
  assert.equal(shipped.value, false);
  assert.ok(shipped.said.every((m) => m.startsWith('checkNodeLibrary: ')) && shipped.said.length);
  assert.deepEqual(lib.nodeLibraryFaults({ v: 3 }), ['it is not a Custom Node library: a v1 with its nodes by id']);
});

test('a Custom Node that holds itself is a loop, at any depth, said once per cycle', () => {
  const use = (kind) => ({ id: 'again', kind, x: 0, y: 0 });
  const self = library({ again: { ...ORG, label: 'Again', nodes: [use('again')], connections: [] } });
  assert.deepEqual(lib.nodeLibraryFaults(self).filter((f) => f.includes('holds itself')), ['a Custom Node holds itself, in a loop: Again › Again']);
  const two = library({ a: { ...ORG, label: 'A', nodes: [use('b')], connections: [] }, b: { ...ORG, label: 'B', nodes: [use('a')], connections: [] } });
  assert.deepEqual(lib.nodeLibraryFaults(two).filter((f) => f.includes('holds itself')), ['a Custom Node holds itself, in a loop: A › B › A']);
  const three = library({ a: { ...ORG, label: 'A', nodes: [use('b')], connections: [] }, b: { ...ORG, label: 'B', nodes: [use('c')], connections: [] }, c: { ...ORG, label: 'C', nodes: [use('a')], connections: [] } });
  assert.equal(lib.nodeLibraryFaults(three).filter((f) => f.includes('holds itself')).length, 1);
  // A workflow that uses a loop stops, and says so.
  assert.ok(faults({ ...flow(), nodes: [{ id: 'p', kind: 'a', x: 0, y: 0 }] }, two).some((f) => f.includes('holds itself')));
});

test('an id # in a body is reserved for Group Input and Output', () => {
  const l = library();
  l.nodes['org-permissions'].nodes.push({ id: '#in', kind: 'condition', x: 0, y: 0 });
  assert.ok(lib.nodeLibraryFaults(l).some((f) => f.includes('a # name is the Group Input')));
  const dup = library();
  dup.nodes['org-permissions'].inputs.push({ name: 'allowed', type: 'value' });
  assert.ok(lib.nodeLibraryFaults(dup).some((f) => f.includes('two sockets named "allowed"')));
});

test('definitionDiff: each kind of change, plain data; a version ignores where a node sits', () => {
  const l = library();
  const use = lib.useOf(l, 'org-permissions', { id: 'perm', x: 0, y: 0 });
  // It follows the published number; none published, 1 (plan 972).
  assert.equal(use.version, 1);
  assert.equal(lib.definitionDiff(use, l).stale, false);
  const moved = structuredClone(l);
  moved.nodes['org-permissions'].nodes[0].x = 999;
  assert.equal(lib.definitionDiff(use, moved).stale, false, 'moving a node is no change');
  // Each change PUBLISHED, as version 2: a draft edit keeps the number, and no use sees it (plan 972 D1 A).
  const change = (fn) => { const next = structuredClone(l); fn(next.nodes['org-permissions']); next.nodes['org-permissions'].version = 2; return lib.definitionDiff(use, next); };
  assert.deepEqual(change((d) => d.inputs.push({ name: 'org', type: 'value' })).inputs.added, ['org']);
  assert.deepEqual(change((d) => d.inputs.shift()).inputs.removed, ['users']);
  assert.deepEqual(change((d) => { d.inputs[0].type = 'value'; }).inputs.retyped, [{ name: 'users', from: 'object', to: 'value' }]);
  assert.deepEqual(change((d) => { d.inputs[1].default = 'owner'; }).inputs.changed, ['role']);
  assert.deepEqual(change((d) => d.outputs.push({ name: 'blocked', type: 'object' })).outputs.added, ['blocked']);
  assert.deepEqual(change((d) => { d.nodes[1].values.type = 'ne'; }).nodes.changed, ['has-role']);
  assert.deepEqual(change((d) => d.nodes.push({ id: 'more', kind: 'organise', x: 0, y: 0 })).nodes.added, ['more']);
  assert.deepEqual(change((d) => d.nodes.pop()).nodes.removed, ['has-role']);
  assert.deepEqual(change((d) => d.connections.pop()).connections.removed, [{ from: 'has-role/pass', to: '#out' }]);
  assert.deepEqual(change((d) => { d.label = 'Org rules'; }).label, { from: 'Org permissions', to: 'Org rules' });
  assert.equal(change((d) => { d.category = 'Other'; }).stale, false, 'a category is no change to a use');
  assert.equal(lib.definitionDiff({ kind: 'org-permissions' }, l).known, false, 'a use that recorded nothing is stale, with nothing listed');
  assert.equal(lib.definitionDiff({ kind: 'nope' }, l), undefined);
});

test('an update keeps the instance\'s own values, drops those of a row lost, and is pure', () => {
  const l = library();
  const w = { ...flow({ values: { role: 'owner' } }) };
  w.nodes = w.nodes.map((n) => (n.id === 'perm' ? { ...lib.useOf(l, 'org-permissions', n), values: { role: 'owner', gone: 'x' } } : n));
  const next = structuredClone(l);
  next.nodes['org-permissions'].outputs.push({ name: 'blocked', type: 'object' });
  next.nodes['org-permissions'].inputs.push({ name: 'org', type: 'value', control: 'text' });
  next.nodes['org-permissions'].version = 2;
  assert.deepEqual(lib.staleUses(w, next), ['perm']);
  const frozen = structuredClone(w);
  const kinds = { ...NODE_KINDS, ...lib.kindsOf(next) };
  const updated = lib.updateInstance(w, 'perm', next);
  assert.deepEqual(w, frozen, 'the one given, untouched');
  const perm = updated.nodes.find((n) => n.id === 'perm');
  assert.deepEqual(perm.values, { role: 'owner' }, 'its own value kept; the lost row\'s gone');
  assert.equal(perm.version, 2);
  assert.deepEqual(lib.staleUses(updated, next), []);
  assert.deepEqual(workflowFaults(updated, kinds), []);
  assert.equal(lib.updateInstance(w, 'end', next), w, 'a node that is no use');
  // Update all instances on graph: every use of the kind, and no other.
  const two = { ...w, nodes: [...w.nodes, { ...w.nodes[1], id: 'perm-2', values: { role: 'viewer' } }] };
  const both = lib.updateAll(two, 'org-permissions', next);
  assert.deepEqual(lib.staleUses(both, next), []);
  assert.deepEqual(both.nodes.map((n) => n.values?.role), [undefined, 'owner', undefined, 'viewer']);
  // An update leaves a connection to a lost socket in place, a fault to see.
  const lose = structuredClone(l);
  lose.nodes['org-permissions'].inputs.shift();
  assert.ok(workflowFaults(lib.updateInstance(w, 'perm', lose), { ...NODE_KINDS, ...lib.kindsOf(lose) }).some((f) => f.includes('"perm/users", which is no input socket')));
  // A use in a saved workflow passes the workflow schema, its record included.
  assert.deepEqual(schemaCheck('workflow.v3.json')(updated), []);
  assert.deepEqual(editWorkflow(updated, { node: 'perm', row: 'role', value: 'viewer' }, kinds).nodes[1].values.role, 'viewer');
});

test('a preset is read only: an edit to it is refused, and its kind says so', () => {
  const l = library({ shipped: { ...ORG, label: 'Shipped', preset: true } });
  assert.equal(lib.editDefinition(l, 'shipped', { label: 'Mine' }), l, 'refused: the one given');
  assert.equal(lib.editDefinition(l, 'nope', { label: 'Mine' }), l);
  assert.equal(lib.editDefinition(l, 'org-permissions', { label: 'Mine' }).nodes['org-permissions'].label, 'Mine');
  assert.equal(lib.nodeKindOf(l.nodes.shipped).preset, true);
  assert.deepEqual(Object.values(l.nodes).flatMap(schemaCheck('defs.v1.json#/$defs/nodeDefinition')), []);
});
