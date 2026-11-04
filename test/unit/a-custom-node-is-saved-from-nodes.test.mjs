/**
 * "SAVE AS CUSTOM NODE" AND "UNGROUP": several nodes of a workflow become one definition and one
 * use, each route over the edge a typed Group Input or Output row; Ungroup gives the same workflow
 * back (nodes, routes, places). A selection that cannot be saved is refused in words.
 * Will, TODO 719 · plan 713 M11, D9. TRAP T-a-custom-node-is-an-instance
 *
 *   node --test test/unit/a-custom-node-is-saved-from-nodes.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const core = new URL('../../dist/core/data/', import.meta.url);
const { groupNodes, ungroupUse } = await import(new URL('node-group.js', core));
const lib = await import(new URL('node-library.js', core));
const { workflowFaults } = await import(new URL('workflow.js', core));

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

test('ungroup of what is no Custom Node is refused; a parameter nothing fed lands on its row', () => {
  assert.match(ungroupUse(flow(), 'cond', empty()).fault, /only a Custom Node/);
  const made = groupNodes(flow(), ['cond'], empty(), { label: 'Status check' }, undefined, facts);
  const loose = { ...made.workflow, routes: made.workflow.routes.filter((r) => r.from !== 'val/value') };
  const lib2 = structuredClone(made.library);
  lib2.nodes[made.id].inputs.find((i) => i.name === 'val-value').default = 'trial';
  const back = ungroupUse(loose, made.use, lib2);
  assert.equal(back.workflow.nodes.find((n) => n.id === 'cond').values.value, 'trial');
});
