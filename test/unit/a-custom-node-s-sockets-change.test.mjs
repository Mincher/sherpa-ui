/**
 * A CUSTOM NODE'S SOCKETS CHANGE after it is made (plan 942 D4 A): an input or an output renamed, retyped or removed,
 * each ONE edit. The use it was made on follows the definition; once it is PUBLISHED (plan 972 D1 A, a draft edit keeps its
 * number), every other use says Update available, and this one has it already (D2 A). A removed socket
 * takes its connections, inside and on that use. Refused in words: a preset, a socket it has not, no name, no type.
 * Will, TODO 942 · docs/history/plan-942-custom-nodes-one-way.md
 *
 *   node --test test/unit/a-custom-node-s-sockets-change.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const core = new URL('../../dist/core/data/', import.meta.url);
const { socketEdit } = await import(new URL('node-group.js', core));
const lib = await import(new URL('node-library.js', core));

/** Has status: Records and a Status in, the matching rows out. */
const HAS = {
  v: 1, label: 'Has status',
  inputs: [{ name: 'records', label: 'Records', type: 'object', multiple: true }, { name: 'status', label: 'Status', type: 'value' }],
  outputs: [{ name: 'matching', label: 'Matching', type: 'object' }],
  nodes: [{ id: 'has-status', kind: 'condition', x: 0, y: 0, values: { type: 'eq' } }],
  connections: [{ from: '#in/records', to: 'has-status' }, { from: '#in/status', to: 'has-status/b' }, { from: 'has-status/pass', to: '#out/matching' }],
};
const hasLib = (preset = false) => ({ v: 1, nodes: { 'has-status': { ...structuredClone(HAS), ...(preset ? { preset: true } : {}) } } });
/** Two uses of Has status: the first fed and read, the second alone. */
const flow = (library = hasLib()) => ({ // has2's Status is fed too, so a removed Status takes both.
  v: 3, id: 'flow',
  nodes: [
    { id: 'start', kind: 'source', x: 0, y: 0, values: { store: 'users' } },
    { id: 'val', kind: 'value', x: 0, y: 200, values: { value: 'active' } },
    { ...lib.useOf(library, 'has-status', { id: 'has', x: 360, y: 0 }), values: { status: 'open' } },
    lib.useOf(library, 'has-status', { id: 'has2', x: 360, y: 400 }),
    { id: 'end', kind: 'result', x: 720, y: 0 },
  ],
  connections: [{ from: 'start/rows', to: 'has/records' }, { from: 'val/value', to: 'has/status' }, { from: 'val/value', to: 'has2/status' }, { from: 'has/matching', to: 'end' }],
});
const said = (connections) => (connections ?? []).map((r) => `${r.from} → ${r.to}`).sort();
const socket = (made, side, name) => made.library.nodes['has-status'][side].find((s) => s.name === name);
/** The library once the edited definition is published: its next number (plan 972). */
const published = (library) => ({ ...library, nodes: { ...library.nodes, 'has-status': { ...library.nodes['has-status'], version: 2 } } });

test('a rename is the socket\'s label: its name, and so every connection, stays; this use follows, the other says Update available', () => {
  const made = socketEdit(flow(), 'has', 'inputs', 'status', { label: '  State ' }, hasLib());
  assert.ok(!made.fault, made.fault);
  assert.equal(made.id, 'has-status');
  assert.deepEqual(socket(made, 'inputs', 'status'), { name: 'status', label: 'State', type: 'value' });
  assert.deepEqual(said(made.workflow.connections), said(flow().connections));
  assert.deepEqual(said(made.library.nodes['has-status'].connections), said(HAS.connections));
  // The use's row and the Group Input's row both read the new name.
  assert.equal(lib.nodeKindOf(made.library.nodes['has-status']).rows.find((r) => r.name === 'status').label, 'State');
  const inner = lib.innerOf(made.workflow.nodes.find((n) => n.id === 'has'), made.library);
  assert.equal(inner.kinds[lib.GROUP_INPUT].rows.find((r) => r.name === 'status').label, 'State');
  // A draft: no use sees it. Published: the other use says Update available; this one has it.
  assert.deepEqual(lib.staleUses(made.workflow, made.library), []);
  assert.deepEqual(lib.staleUses(made.workflow, published(made.library)), ['has2']);
  // Its own value stays.
  assert.deepEqual(made.workflow.nodes.find((n) => n.id === 'has').values, { status: 'open' });
});

test('a new type keeps each connection; only an object\'s list picks several', () => {
  const made = socketEdit(flow(), 'has', 'inputs', 'records', { type: 'value' }, hasLib());
  assert.ok(!made.fault, made.fault);
  assert.deepEqual(socket(made, 'inputs', 'records'), { name: 'records', label: 'Records', type: 'value' });
  assert.deepEqual(said(made.workflow.connections), said(flow().connections));
  const out = socketEdit(flow(), 'has', 'outputs', 'matching', { type: 'boolean' }, hasLib());
  assert.equal(socket(out, 'outputs', 'matching').type, 'boolean');
  assert.deepEqual(lib.staleUses(out.workflow, published(out.library)), ['has2']);
});

test('a removed input takes its connections, inside and on every use of this graph, and this use\'s value for it', () => {
  const made = socketEdit(flow(), 'has', 'inputs', 'status', null, hasLib());
  assert.ok(!made.fault, made.fault);
  assert.deepEqual(made.library.nodes['has-status'].inputs.map((i) => i.name), ['records']);
  assert.deepEqual(said(made.library.nodes['has-status'].connections), ['#in/records → has-status', 'has-status/pass → #out/matching']);
  assert.deepEqual(said(made.workflow.connections), ['has/matching → end', 'start/rows → has/records']);
  assert.equal(made.workflow.nodes.find((n) => n.id === 'has').values?.status, undefined);
  assert.deepEqual(lib.staleUses(made.workflow, published(made.library)), ['has2']);
  // Nothing left is a fault: a connection kept on has2's Status would be one, as it is drawn from the definition now.
  assert.deepEqual(lib.workflowFaultsDeep(made.workflow, made.library), []);
});

test('a removed output takes its connections, inside and on this use', () => {
  const made = socketEdit(flow(), 'has', 'outputs', 'matching', null, hasLib());
  assert.ok(!made.fault, made.fault);
  assert.deepEqual(made.library.nodes['has-status'].outputs, []);
  assert.deepEqual(said(made.library.nodes['has-status'].connections), ['#in/records → has-status', '#in/status → has-status/b']);
  assert.deepEqual(said(made.workflow.connections), ['start/rows → has/records', 'val/value → has/status', 'val/value → has2/status']);
});

test('a use that does not follow its definition is left as it was: it says Update available', () => {
  const library = hasLib();
  // It follows an older number: it is left as it was, and is behind the draft; the other use, at the number, is not.
  const stale = { ...flow(library), nodes: flow(library).nodes.map((n) => (n.id === 'has' ? { ...n, version: 0 } : n)) };
  const made = socketEdit(stale, 'has', 'inputs', 'status', { label: 'State' }, library);
  assert.equal(made.workflow.nodes.find((n) => n.id === 'has').version, 0);
  assert.deepEqual(lib.staleUses(made.workflow, made.library), ['has']);
});

test('refused, in words: a preset, a socket it has not, a name that is none, a type that is none, a node that is no Custom Node', () => {
  assert.equal(socketEdit(flow(hasLib(true)), 'has', 'inputs', 'status', { label: 'State' }, hasLib(true)).fault, 'a preset is read only: clone it to change its sockets');
  assert.equal(socketEdit(flow(), 'has', 'outputs', 'status', null, hasLib()).fault, 'it has no output "status"');
  assert.equal(socketEdit(flow(), 'has', 'inputs', 'status', { label: '  ' }, hasLib()).fault, 'an input needs a name');
  assert.equal(socketEdit(flow(), 'has', 'inputs', 'status', { type: 'number' }, hasLib()).fault, '"number" is no socket type: value, object or boolean');
  assert.equal(socketEdit(flow(), 'val', 'inputs', 'value', null, hasLib()).fault, 'only a Custom Node has sockets to change');
});
