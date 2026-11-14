/**
 * A SWITCH ROW HAS A BOOLEAN INPUT: a Scope's Filters, a Preset's and a Saved filter's On.
 * A connection into it DRIVES it — on from a true value, off from a false one; a number reads as
 * 1 or 0; a test's Pass drives it too (plans 944, 971 §9: no True or False socket) — read
 * only and marked Custom; cut the connection and the row's own state is back, for the draft kept
 * it. A page's Query has no way to say "driven by a node", so it refuses the connection by name.
 * Will, 2026-11-04 · plan 713 D7, TODO 732.
 *
 *   node --test test/unit/a-switch-row-takes-a-boolean.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const core = new URL('../../dist/core/data/', import.meta.url);
const { NODE_KINDS, accepts, drivenSwitch, socketType } = await import(new URL('node-kinds.js', core));
const { editWorkflow, workflowFaults, workflowGraph } = await import(new URL('workflow.js', core));
const { queryGraph, connectionRequest } = await import(new URL('query-graph.js', core));
const { readingsOf } = await import(new URL('where.js', core));

test('every switch row of every kind takes a boolean, and no other row is changed to', () => {
  const switches = Object.entries(NODE_KINDS).flatMap(([id, k]) => k.rows.filter((r) => r.control === 'switch').map((r) => `${id}/${r.name}`));
  // A bar's Switch is View Filters' and a card's Presentation's (plan 960 U4.8).
  assert.deepEqual(switches, ['view-filters/#filters', 'preset/on', 'saved/on', 'presentation/#filters']);
  for (const s of switches) {
    const [kind, row] = s.split('/');
    assert.equal(socketType(NODE_KINDS[kind], row, 'input'), 'boolean', s);
  }
  assert.equal(accepts('boolean', 'boolean'), true);
  assert.equal(accepts('value', 'boolean'), false);
});

test('a true value drives a switch on, a false one off, marked Custom; cutting the connection gives its own state back', () => {
  assert.deepEqual(drivenSwitch([]), { value: false, custom: true });
  assert.deepEqual(drivenSwitch([false, true]), { value: true, custom: true });
  const kinds = { ...NODE_KINDS, gate: { heading: 'Gate', icon: 'flag', rows: [{ name: 'on', label: 'On', control: 'switch', input: 'boolean' }], model: 'x', graphs: ['workflow'] } };
  // A boolean Value, true and false, a number 1 and 0, and a Condition, whose Pass is a row (plan 971 §9).
  const w = (from) => ({
    v: 3, id: 'g', nodes: [
      { id: 'f', kind: 'condition', x: 0, y: 0, values: { type: 'eq', b: 'a' } },
      { id: 'gate', kind: 'gate', x: 360, y: 0, values: { on: false } },
      { id: 'yes', kind: 'value', x: 0, y: 0, values: { type: 'boolean', value: 'true' } },
      { id: 'no', kind: 'value', x: 0, y: 0, values: { type: 'boolean', value: 'false' } },
      { id: 'one', kind: 'value', x: 0, y: 0, values: { type: 'integer', value: 1 } },
      { id: 'zero', kind: 'value', x: 0, y: 0, values: { type: 'integer', value: 0 } },
    ], connections: [{ from, to: 'gate/on' }],
  });
  const on = (flow) => workflowGraph(flow, {}, kinds).nodes[1].rows[0];
  assert.deepEqual(workflowFaults(w('yes/value'), kinds), []);
  const t = on(w('yes/value'));
  assert.deepEqual([t.value, t.custom, t.hint], [true, true, 'Custom, from Value']);
  const f = on(w('no/value'));
  assert.deepEqual([f.value, f.custom], [false, true]);
  assert.deepEqual([on(w('one/value')).value, on(w('zero/value')).value], [true, false], 'a number reads as 1 or 0');
  // A Condition's Pass drives it too, and its header and False send nothing (plans 944, 971 §9).
  assert.deepEqual([workflowFaults(w('f/pass'), kinds), on(w('f/pass')).custom, on(w('f/pass')).hint], [[], true, 'Custom, from Condition']);
  assert.deepEqual(workflowFaults(w('f/#false'), kinds), ['a connection leaves "f/#false", which is no output socket']);
  // The row's own state was kept: cut, and it is back.
  const cut = editWorkflow(w('yes/value'), { cut: 'gate/on' }, kinds);
  const back = on(cut);
  assert.deepEqual([back.value, back.custom], [false, undefined]);
  // A value is no boolean: it joins (TODO 770), but cannot drive it — the switch reads null, off, and the node warns.
  const fed = { ...w('f/pass'), nodes: [...w('f/pass').nodes, { id: 'v', kind: 'value', x: 0, y: 0, values: { value: 'yes' } }], connections: [{ from: 'v/value', to: 'gate/on' }] };
  assert.deepEqual(workflowFaults(fed, kinds), []);
  const gate = workflowGraph(fed, {}, kinds).nodes[1];
  assert.deepEqual([gate.rows[0].value, gate.rows[0].custom, gate.warnings], [null, undefined, [{ row: 'on', words: 'On takes a boolean; it was given "yes"' }]]);
});

test('the Query draws a boolean input on each switch row, and refuses a connection into it by name', () => {
  const definition = { v: 1, id: 'r', source: { store: 'customers', fields: { status: { label: 'Status' } }, scopes: { data: { label: 'Data', presets: [{ id: 'live', label: 'Live', where: { status: { eq: 'active' } } }] } } } };
  const query = { v: 1, scopes: { data: { holds: ['status'], readings: readingsOf({ status: { eq: 'active' } }) } } };
  const live = { presets: (s) => (s === 'data' ? [{ id: 'live', label: 'Live', readings: readingsOf({ status: { in: ['active'] } }) }] : []) };
  const g = queryGraph(query, definition, live);
  // A card's bar is on its Presentation.
  const scope = g.nodes.find((n) => n.id === 'presentation-data');
  assert.equal(scope.rows.find((r) => r.name === '#filters').input, 'boolean');
  const refused = connectionRequest(g, { from: scope.id, to: `${scope.id}/#filters` });
  assert.match(refused.refused, /takes no connection into .*Filters.*Switch is the reader's/);
  const preset = g.nodes.find((n) => n.kind === 'preset');
  assert.ok(preset, 'a preset node is drawn');
  assert.equal(preset.rows.find((r) => r.name === 'on').input, 'boolean');
  assert.match(connectionRequest(g, { from: scope.id, to: `${preset.id}/on` }).refused, /takes no connection into/);
});
