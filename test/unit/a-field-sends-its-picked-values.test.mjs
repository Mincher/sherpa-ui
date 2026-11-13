/**
 * A FIELD SENDS ITS PICKED VALUES (plan 960 U4.7a; Will, 2026-11-13: "It should be just 1 dropdown with a mulit-select menu
 * on a single node row"; "In nodes this is the preferred approach for multi select scenarios"): a Field node's Values is ONE
 * row, a dropdown with a menu of ticks of the values the field picked on THAT node declares; drawn only where it declares
 * some. It sends what is picked: one value, or the list; none picked, nothing, and it says so. A node's multi-select is one
 * row, never a row per choice: a Condition's Is one of picks from known values the same way.
 *
 *   node --test test/unit/a-field-sends-its-picked-values.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nodeKinds, simulateGraph, workflowFaults, workflowGraph } from '../../dist/data.js';

const fieldsOf = {
  customers: {
    status: { label: 'Status', values: ['active', 'trial', 'At risk'] },
    plan: { label: 'Plan', values: ['Free', 'Pro'] },
    name: { label: 'Name' },
  },
};
/** Customers › a Field on `field` (its Values picked) › a Condition of `op`, and any connections more. */
const flow = (field, picked, op = 'eq', more = []) => ({
  v: 3, id: 'w',
  nodes: [
    { id: 's', kind: 'source', x: 0, y: 0, values: { store: 'customers' } },
    { id: 'f', kind: 'field', x: 300, y: 0, values: { field, ...(picked ? { values: picked } : {}) } },
    { id: 'c', kind: 'condition', x: 600, y: 0, values: { type: op } },
  ],
  connections: [{ from: 's/rows', to: 'f' }, { from: 'f/field', to: 'c' }, ...more],
});
const rowOf = (graph, id, name) => graph.nodes.find((n) => n.id === id).rows.find((r) => r.name === name);
const ROWS = [{ status: 'active' }, { status: 'trial' }, { status: 'trial' }, { status: 'At risk' }];

test('a Field\'s Values is ONE row, a dropdown of ticks of the values its own field declares; a new pick, its values', () => {
  const values = rowOf(workflowGraph(flow('status'), { fieldsOf }), 'f', 'values');
  assert.deepEqual([values.control, values.multiple, values.output, values.choices.map((c) => c.value)], ['values', true, 'value', ['active', 'trial', 'At risk']]);
  assert.equal(values.hint, 'None picked: it sends nothing');
  assert.deepEqual(rowOf(workflowGraph(flow('plan'), { fieldsOf }), 'f', 'values').choices.map((c) => c.value), ['Free', 'Pro']);
  assert.equal(workflowGraph(flow('status'), { fieldsOf }).nodes.find((n) => n.id === 'f').rows.filter((r) => r.name !== 'field').length, 1, 'never a row per value');
});

test('a field that declares no values has no Values row', () => {
  assert.equal(rowOf(workflowGraph(flow('name'), { fieldsOf }), 'f', 'values'), undefined);
});

test('one value picked joins a Condition\'s Value B; Simulate reads it', () => {
  const joined = flow('status', ['trial'], 'eq', [{ from: 'f/values', to: 'c/b' }]);
  assert.deepEqual(workflowFaults(joined, nodeKinds(), { fieldsOf }), []);
  const drawn = workflowGraph(joined, { fieldsOf });
  assert.equal(rowOf(drawn, 'c', 'b').value, 'trial');
  const sim = simulateGraph(drawn, { customers: ROWS });
  assert.equal(sim.nodes.c.incoming.find((s) => s.socket === 'c/b').value, 'trial');
  assert.equal(sim.nodes.c.outgoing.find((s) => s.socket === 'c/rows').rows.length, 2);
});

test('several picked send their list: they join a Condition\'s Values (Is one of)', () => {
  const joined = flow('status', ['trial', 'At risk'], 'in', [{ from: 'f/values', to: 'c/b' }]);
  const drawn = workflowGraph(joined, { fieldsOf });
  assert.deepEqual(rowOf(drawn, 'c', 'b').value, ['trial', 'At risk']);
  const sim = simulateGraph(drawn, { customers: ROWS });
  assert.equal(sim.nodes.c.outgoing.find((s) => s.socket === 'c/rows').rows.length, 3);
});

test('a value picked that its field does not declare is shown, and said: never kept quietly', () => {
  const stale = rowOf(workflowGraph(flow('status', ['Contoso']), { fieldsOf }), 'f', 'values');
  assert.ok(stale.choices.some((c) => c.value === 'Contoso'));
  assert.match(stale.fault ?? '', /"Contoso" is not a value of/);
  // A Condition's Value B too, after its Field changed.
  const old = flow('status');
  old.nodes = old.nodes.map((n) => (n.id === 'c' ? { ...n, values: { type: 'eq', b: 'Contoso' } } : n));
  assert.match(rowOf(workflowGraph(old, { fieldsOf }), 'c', 'b').fault ?? '', /"Contoso" is not a value of/);
  assert.ok(workflowFaults(old, nodeKinds(), { fieldsOf }).some((f) => /"Contoso" is not a value of/.test(f)));
});

test('a node\'s multi-select is one row: a Condition\'s Is one of picks from known values in one dropdown of ticks', () => {
  const b = rowOf(workflowGraph(flow('status', undefined, 'in'), { fieldsOf }), 'c', 'b');
  assert.deepEqual([b.control, b.multiple, b.choices.map((c) => c.value)], ['values', true, ['active', 'trial', 'At risk']]);
});
