/**
 * "SAVE AS CUSTOM NODE" AND "UNGROUP": several nodes of a workflow become one definition and one
 * use, each route over the edge a typed Group Input or Output row; Ungroup gives the same workflow
 * back (nodes, routes, places). A selection that cannot be saved is refused in words. A route
 * on a use's header lands on its row, and Ungroup joins it (759).
 * Will, TODO 719 · plan 713 M11, D9. TRAP T-a-custom-node-is-an-instance · TRAP T-a-custom-node-header-lands-on-a-row
 *
 *   node --test test/unit/a-custom-node-is-saved-from-nodes.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const core = new URL('../../dist/core/data/', import.meta.url);
const { groupNodes, ungroupUse } = await import(new URL('node-group.js', core));
const lib = await import(new URL('node-library.js', core));
const { editWorkflow, readWorkflow, workflowFaults, workflowGraph } = await import(new URL('workflow.js', core));
const { NODE_KINDS } = await import(new URL('node-kinds.js', core));

const empty = () => ({ v: 1, nodes: {} });
/** Store → Condition (Value 'x' into its value row) → Output: the Condition is the one to save. */
const flow = () => ({
  v: 2, id: 'flow',
  nodes: [
    { id: 'start', kind: 'store', x: 0, y: 0, values: { store: 'users' } },
    { id: 'val', kind: 'value', x: 0, y: 200, values: { value: 'active' } },
    { id: 'cond', kind: 'condition', x: 360, y: 40, values: { field: 'status', op: 'eq' } },
    { id: 'end', kind: 'output', x: 720, y: 0 },
  ],
  routes: [
    { from: 'start/rows', to: 'cond' }, { from: 'val/value', to: 'cond/value' }, { from: 'cond/rows', to: 'end' },
  ],
});
const sorted = (w) => ({
  nodes: [...w.nodes].sort((a, b) => (a.id < b.id ? -1 : 1)),
  routes: [...(w.routes ?? [])].sort((a, b) => `${a.from}${a.to}` < `${b.from}${b.to}` ? -1 : 1),
});
const facts = { fields: { status: { label: 'Status' } } };

test('save then ungroup gives the same workflow: nodes, routes and places', () => {
  const was = flow();
  assert.deepEqual(workflowFaults(was, undefined, facts), []);
  const made = groupNodes(was, ['cond'], empty(), { label: 'Status check', category: 'Logic' }, undefined, facts);
  assert.ok(!made.fault, made.fault);
  assert.equal(made.workflow.nodes.filter((n) => n.kind === made.id).length, 1);
  assert.equal(made.workflow.nodes.some((n) => n.id === 'cond'), false);
  const back = ungroupUse(made.workflow, made.use, made.library);
  assert.ok(!back.fault, back.fault);
  assert.deepEqual(sorted(back.workflow), sorted(was));
});

test('each route over the edge is a typed socket; the use is joined as the nodes were', () => {
  const made = groupNodes(flow(), ['cond'], empty(), { label: 'Status check' }, undefined, facts);
  const d = made.library.nodes[made.id];
  assert.deepEqual(d.inputs.map((i) => [i.name, i.type]), [['start-rows', 'object'], ['val-value', 'value']]);
  assert.deepEqual(d.outputs.map((o) => [o.name, o.type]), [['cond-rows', 'object']]);
  assert.deepEqual(made.workflow.routes.map((r) => `${r.from} → ${r.to}`).sort(), [
    `${made.use}/cond-rows → end`, `start/rows → ${made.use}/start-rows`, `val/value → ${made.use}/val-value`,
  ].sort());
  assert.deepEqual(lib.workflowFaultsDeep(made.workflow, made.library, undefined, facts), []);
  assert.equal(lib.checkNodeLibrary(made.library, undefined, facts), true);
  assert.deepEqual(lib.staleUses(made.workflow, made.library), []);
});

test('two nodes saved together keep the route between them inside; one source feeding two rows is one socket', () => {
  const w = flow();
  const made = groupNodes(w, ['val', 'cond'], empty(), { label: 'Pair' }, undefined, facts);
  assert.ok(!made.fault, made.fault);
  const d = made.library.nodes[made.id];
  assert.deepEqual(d.inputs.map((i) => i.name), ['start-rows']);
  assert.ok(d.routes.some((r) => r.from === 'val/value' && r.to === 'cond/value'));
  assert.deepEqual(sorted(ungroupUse(made.workflow, made.use, made.library).workflow), sorted(w));
});

test('a name that is taken, an id a shipped kind owns: a free id', () => {
  const a = groupNodes(flow(), ['cond'], empty(), { label: 'Store' }, undefined, facts);
  assert.equal(a.id, 'store-2');
  const b = groupNodes(flow(), ['cond'], a.library, { label: 'Store' }, undefined, facts);
  assert.equal(b.id, 'store-3');
});

test('refused in words: nothing picked, no name, a Group node, a loop through outside, mixed types', () => {
  assert.match(groupNodes(flow(), [], empty(), { label: 'x' }).fault, /pick the nodes/);
  assert.match(groupNodes(flow(), ['cond'], empty(), { label: '  ' }).fault, /give the Custom Node a name/);
  assert.match(groupNodes(flow(), ['#in'], empty(), { label: 'x' }).fault, /nodes of a Custom Node|belong to a Custom Node/);
  // A loop: start → cond → sort → ... back into a picked node. Pick start and end, leave cond out.
  const loop = groupNodes(flow(), ['start', 'end'], empty(), { label: 'Ends' }, undefined, facts);
  assert.match(loop.fault, /would hold a loop through it/);
  assert.match(loop.fault, /Condition/);
  // Mixed: a Store's rows (an object) forged into a value row, beside the header it feeds.
  const bad = flow();
  bad.routes = [...bad.routes, { from: 'start/rows', to: 'cond/value' }];
  const mixed = groupNodes(bad, ['cond'], empty(), { label: 'Mixed' });
  assert.match(mixed.fault, /carries one type/);
  assert.match(mixed.fault, /Store › Rows[\s\S]*an object and a value/);
});

/** Has status, as the Demos' preset: Records and a Status in, the matching rows out. */
const HAS = {
  v: 1, label: 'Has status',
  inputs: [{ name: 'records', label: 'Records', type: 'object' }, { name: 'status', label: 'Status', type: 'value' }],
  outputs: [{ name: 'matching', label: 'Matching', type: 'object' }],
  nodes: [{ id: 'has-status', kind: 'condition', x: 0, y: 0, values: { field: 'status', op: 'eq' } }],
  routes: [{ from: '#in/records', to: 'has-status' }, { from: '#in/status', to: 'has-status/value' }, { from: 'has-status/rows', to: '#out/matching' }, { from: 'has-status', to: '#out' }],
};
const hasLib = () => ({ v: 1, nodes: { 'has-status': structuredClone(HAS) } });
/** A Store and a Value into one use of Has status: the rows on its HEADER, as "Add a node" and a drop there join them. */
const fedOnHeader = () => ({
  v: 2, id: 'flow',
  nodes: [
    { id: 'start', kind: 'store', x: 0, y: 0, values: { store: 'users' } },
    { id: 'val', kind: 'value', x: 0, y: 200, values: { value: 'active' } },
    { id: 'has', kind: 'has-status', x: 360, y: 0 },
    { id: 'end', kind: 'output', x: 720, y: 0 },
  ],
  routes: [{ from: 'start/rows', to: 'has' }, { from: 'val/value', to: 'has/status' }, { from: 'has/matching', to: 'end' }],
});
const said = (w) => (w.routes ?? []).map((r) => `${r.from} → ${r.to}`).sort();

test('a route into a Custom Node\'s header lands on the input row it fits; one held from before reads once onto it', () => {
  const kinds = { ...lib.kindsOf(hasLib()), ...NODE_KINDS };
  const bare = { ...fedOnHeader(), routes: [{ from: 'val/value', to: 'has/status' }] };
  // A drop on the header: the Records row, the one free row that takes rows.
  assert.deepEqual(said(editWorkflow(bare, { route: { from: 'start/rows', to: 'has' } }, kinds)), ['start/rows → has/records', 'val/value → has/status']);
  // A second value on the header: the Status row, fed, where it takes the place of the one there, as a drop on the row would.
  const two = { ...bare, nodes: [...bare.nodes, { id: 'val2', kind: 'value', x: 0, y: 300, values: { value: 'trial' } }] };
  assert.deepEqual(said(editWorkflow(two, { route: { from: 'val2/value', to: 'has' } }, kinds)), ['val2/value → has/status']);
  // A boolean no row takes stays on the header (D1): the Group Input's header sends it inside.
  const fork = editWorkflow({ ...bare, nodes: [...bare.nodes, { id: 'c', kind: 'condition', x: 0, y: 400 }] }, { route: { from: 'c', to: 'has' } }, kinds);
  assert.ok(said(fork).includes('c → has'));
  // A workflow saved with the rows on the header reads once with them on the row; drawn there too.
  assert.deepEqual(said(readWorkflow(fedOnHeader(), kinds).workflow), ['has/matching → end', 'start/rows → has/records', 'val/value → has/status']);
  assert.ok(workflowGraph(fedOnHeader(), {}, kinds).routes.some((r) => r.from === 'start/rows' && r.to === 'has/records'));
  // Nothing on a Custom Node's header: the one given, untouched.
  const plain = flow();
  assert.equal(readWorkflow(plain, kinds).workflow, plain);
});

test('Ungroup joins a route on the header to what its row fed: no route is lost', () => {
  const back = ungroupUse(fedOnHeader(), 'has', hasLib());
  assert.ok(!back.fault, back.fault);
  assert.deepEqual(said(back.workflow), ['has-status/rows → end', 'start/rows → has-status', 'val/value → has-status/value']);
  // The header's True goes on from what reached the Group Output's header.
  const tru = { ...fedOnHeader(), routes: [...fedOnHeader().routes, { from: 'has', to: 'end' }].filter((r) => r.from !== 'has/matching') };
  assert.ok(said(ungroupUse(tru, 'has', hasLib()).workflow).includes('has-status → end'));
  // Where the Group Input's header is routed inside, the header's route goes that way.
  const own = hasLib();
  own.nodes['has-status'].routes = [{ from: '#in', to: 'has-status' }, ...own.nodes['has-status'].routes.filter((r) => r.from !== '#in/records')];
  const c = { ...fedOnHeader(), nodes: [...fedOnHeader().nodes, { id: 'c', kind: 'condition', x: 0, y: 400 }], routes: [{ from: 'c', to: 'has' }] };
  assert.deepEqual(said(ungroupUse(c, 'has', own).workflow), ['c → has-status']);
});

test('the Group Input shows a row per connected input, each an output socket routed to the nodes it feeds', () => {
  // Store's rows into two Conditions, a Value into both their Value rows: two inputs, each joined to both.
  const w = {
    v: 2, id: 'flow',
    nodes: [
      { id: 'start', kind: 'store', x: 0, y: 0, values: { store: 'users' } },
      { id: 'val', kind: 'value', x: 0, y: 200, values: { value: 'active' } },
      { id: 'a', kind: 'condition', x: 360, y: 0, values: { field: 'status', op: 'eq' } },
      { id: 'b', kind: 'condition', x: 360, y: 300, values: { field: 'status', op: 'ne' } },
      { id: 'end', kind: 'output', x: 720, y: 0 },
    ],
    routes: [
      { from: 'start/rows', to: 'a' }, { from: 'start/rows', to: 'b' }, { from: 'val/value', to: 'a/value' }, { from: 'val/value', to: 'b/value' }, { from: 'a/rows', to: 'end' },
    ],
  };
  const made = groupNodes(w, ['a', 'b'], empty(), { label: 'Both' }, undefined, facts);
  assert.ok(!made.fault, made.fault);
  const inner = lib.innerOf(made.workflow.nodes.find((n) => n.id === made.use), made.library);
  const rows = inner.kinds[lib.GROUP_INPUT].rows;
  assert.deepEqual(rows.map((r) => [r.name, r.output]), [['start-rows', 'object'], ['val-value', 'value']]);
  for (const r of rows) assert.deepEqual(inner.workflow.routes.filter((x) => x.from === `#in/${r.name}`).map((x) => x.to).sort(), r.name === 'start-rows' ? ['a', 'b'] : ['a/value', 'b/value']);
  assert.deepEqual(sorted(ungroupUse(made.workflow, made.use, made.library).workflow), sorted(w));
});

test('ungroup of what is no Custom Node is refused; a parameter nothing fed lands on its row', () => {
  assert.match(ungroupUse(flow(), 'cond', empty()).fault, /only a Custom Node/);
  const made = groupNodes(flow(), ['cond'], empty(), { label: 'Status check' }, undefined, facts);
  const loose = { ...made.workflow, routes: made.workflow.routes.filter((r) => r.from !== 'val/value') };
  const lib2 = structuredClone(made.library);
  lib2.nodes[made.id].inputs.find((i) => i.name === 'val-value').default = 'trial';
  const back = ungroupUse(loose, made.use, lib2);
  assert.equal(back.workflow.nodes.find((n) => n.id === 'cond').values.value, 'trial');
});
