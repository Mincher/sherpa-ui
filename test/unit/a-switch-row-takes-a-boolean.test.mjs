/**
 * A SWITCH ROW HAS A BOOLEAN INPUT: a Scope's Filters, a Preset's and a Saved filter's On.
 * A route into it DRIVES it — True from a True socket, False from a False socket — read
 * only and marked Custom; cut the route and the row's own state is back, for the draft kept
 * it. A page's Query has no way to say "driven by a node", so it refuses the route by name.
 * Will, 2026-11-04 · plan 713 D7, TODO 732.
 *
 *   node --test test/unit/a-switch-row-takes-a-boolean.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const core = new URL('../../dist/core/data/', import.meta.url);
const { NODE_KINDS, accepts, drivenSwitch, socketType } = await import(new URL('node-kinds.js', core));
const { editWorkflow, workflowFaults, workflowGraph } = await import(new URL('workflow.js', core));
const { queryGraph, routeRequest } = await import(new URL('query-graph.js', core));
const { readingsOf } = await import(new URL('where.js', core));

test('every switch row of every kind takes a boolean, and no other row is changed to', () => {
  const switches = Object.entries(NODE_KINDS).flatMap(([id, k]) => k.rows.filter((r) => r.control === 'switch').map((r) => `${id}/${r.name}`));
  assert.deepEqual(switches, ['scope/#filters', 'preset/on', 'saved/on']);
  for (const s of switches) {
    const [kind, row] = s.split('/');
    assert.equal(socketType(NODE_KINDS[kind], row, 'input'), 'boolean', s);
  }
  assert.equal(accepts('boolean', 'boolean'), true);
  assert.equal(accepts('value', 'boolean'), false);
});

test('a True drives a switch on, a False off, marked Custom; cutting the route gives its own state back', () => {
  assert.deepEqual(drivenSwitch([]), { value: false, custom: true });
  assert.deepEqual(drivenSwitch([false, true]), { value: true, custom: true });
  const kinds = { ...NODE_KINDS, gate: { heading: 'Gate', icon: 'flag', rows: [{ name: 'on', label: 'On', control: 'switch', input: 'boolean' }], model: 'x', graphs: ['workflow'] } };
  const w = (from) => ({
    v: 2, id: 'g', nodes: [
      { id: 'f', kind: 'condition', x: 0, y: 0, values: { type: 'eq', b: 'a' } },
      { id: 'gate', kind: 'gate', x: 360, y: 0, values: { on: false } },
    ], routes: [{ from, to: 'gate/on' }],
  });
  const on = (flow) => workflowGraph(flow, {}, kinds).nodes[1].rows[0];
  assert.deepEqual(workflowFaults(w('f'), kinds), []);
  const t = on(w('f'));
  assert.deepEqual([t.value, t.custom, t.hint], [true, true, 'Custom, from Condition']);
  const f = on(w('f/#false'));
  assert.deepEqual([f.value, f.custom], [false, true]);
  // The row's own state was kept: cut, and it is back.
  const cut = editWorkflow(w('f'), { cut: 'gate/on' }, kinds);
  const back = on(cut);
  assert.deepEqual([back.value, back.custom], [false, undefined]);
  // A value is no boolean: it joins (TODO 770), but cannot drive it — the switch reads null, off, and the node warns.
  const fed = { ...w('f'), nodes: [...w('f').nodes, { id: 'v', kind: 'value', x: 0, y: 0, values: { value: 'yes' } }], routes: [{ from: 'v/value', to: 'gate/on' }] };
  assert.deepEqual(workflowFaults(fed, kinds), []);
  const gate = workflowGraph(fed, {}, kinds).nodes[1];
  assert.deepEqual([gate.rows[0].value, gate.rows[0].custom, gate.warnings], [null, undefined, [{ row: 'on', words: 'On takes a boolean; it was given "yes"' }]]);
});

test('the Query draws a boolean input on each switch row, and refuses a route into it by name', () => {
  const definition = { v: 1, id: 'r', source: { store: 'customers', fields: { status: { label: 'Status' } }, scopes: { data: { label: 'Data', presets: [{ id: 'live', label: 'Live', where: { status: { eq: 'active' } } }] } } } };
  const query = { v: 1, scopes: { data: { holds: ['status'], readings: readingsOf({ status: { eq: 'active' } }) } } };
  const live = { presets: (s) => (s === 'data' ? [{ id: 'live', label: 'Live', readings: readingsOf({ status: { in: ['active'] } }) }] : []) };
  const g = queryGraph(query, definition, live);
  const scope = g.nodes.find((n) => n.kind === 'scope');
  assert.equal(scope.rows.find((r) => r.name === '#filters').input, 'boolean');
  const refused = routeRequest(g, { from: scope.id, to: `${scope.id}/#filters` });
  assert.match(refused.refused, /takes no route into .*Filters.*Switch is the reader's/);
  const preset = g.nodes.find((n) => n.kind === 'preset');
  assert.ok(preset, 'a preset node is drawn');
  assert.equal(preset.rows.find((r) => r.name === 'on').input, 'boolean');
  assert.match(routeRequest(g, { from: scope.id, to: `${preset.id}/on` }).refused, /takes no route into/);
});
