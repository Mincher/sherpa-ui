/**
 * A FIELD UNFOLDS ITS VALUES (plan 960 U4.7a; Will, 2026-11-13, D1 and E1 A): a Field node's field row unfolds a row per
 * value the field picked on THAT node declares, each GIVING its value (join it to a Condition's Value B; filtering stays
 * the Condition's). A field that declares none unfolds none; one with more than UNFOLD_MOST, none, and its hint says how
 * many. One door for a node's outputs, `outputRow`, so a connection from a value row is checked, shown and simulated.
 *
 *   node --test test/unit/a-field-unfolds-its-values.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UNFOLD_MOST, outputRow, simulateGraph, unfoldedRows, workflowFaults, workflowGraph, nodeKinds } from '../../dist/data.js';

const fieldsOf = {
  customers: {
    status: { label: 'Status', values: ['active', 'trial', 'At risk'] },
    plan: { label: 'Plan', values: ['Free', 'Pro'] },
    name: { label: 'Name' },
    many: { label: 'Many', values: Array.from({ length: UNFOLD_MOST + 1 }, (_, i) => `v${i}`) },
  },
};
/** Customers › a Field on `field` › a Condition, and any connections more. */
const flow = (field, more = []) => ({
  v: 3, id: 'w',
  nodes: [
    { id: 's', kind: 'source', x: 0, y: 0, values: { store: 'customers' } },
    { id: 'f', kind: 'field', x: 300, y: 0, values: { field } },
    { id: 'c', kind: 'condition', x: 600, y: 0, values: { type: 'eq' } },
  ],
  connections: [{ from: 's/rows', to: 'f' }, { from: 'f/field', to: 'c' }, ...more],
});
const rowsOf = (graph, id) => graph.nodes.find((n) => n.id === id).rows;

test('a Field unfolds the values of the field picked on it, and no other field\'s; a new pick unfolds its own', () => {
  const status = rowsOf(workflowGraph(flow('status'), { fieldsOf }), 'f');
  assert.deepEqual(status.map((r) => [r.name, r.label, r.value ?? null]), [
    ['field', 'Field', 'status'], ['v-active', 'active', 'active'], ['v-trial', 'trial', 'trial'], ['v-at-risk', 'At risk', 'At risk'],
  ]);
  assert.ok(status.slice(1).every((r) => r.unfolded && r.output === 'value' && !r.editable && !r.input), 'each gives its value, read only');
  assert.deepEqual(rowsOf(workflowGraph(flow('plan'), { fieldsOf }), 'f').slice(1).map((r) => r.value), ['Free', 'Pro']);
});

test('a field that declares no values unfolds none; one with too many unfolds none, and says how many', () => {
  assert.deepEqual(rowsOf(workflowGraph(flow('name'), { fieldsOf }), 'f').map((r) => r.name), ['field']);
  const many = rowsOf(workflowGraph(flow('many'), { fieldsOf }), 'f');
  assert.deepEqual(many.map((r) => r.name), ['field']);
  assert.match(many[0].hint, new RegExp(`${UNFOLD_MOST + 1} values: too many to show each`));
});

test('a value row joined to a Condition\'s Value B is sound, shows its value there, and Simulate reads it', () => {
  const joined = flow('status', [{ from: 'f/v-trial', to: 'c/b' }]);
  assert.deepEqual(workflowFaults(joined, nodeKinds(), { fieldsOf }), []);
  const drawn = workflowGraph(joined, { fieldsOf });
  const b = rowsOf(drawn, 'c').find((r) => r.name === 'b');
  assert.equal(b.value, 'trial');
  const sim = simulateGraph(drawn, { customers: [{ status: 'active' }, { status: 'trial' }, { status: 'trial' }] });
  assert.equal(sim.nodes.c.incoming.find((s) => s.socket === 'c/b').value, 'trial');
  assert.equal(sim.nodes.c.outgoing.find((s) => s.socket === 'c/rows').rows.length, 2);
});

test('a connection from a value the field does not declare sends nothing, and the Field says so', () => {
  const ghost = workflowGraph(flow('status', [{ from: 'f/v-nope', to: 'c/b' }]), { fieldsOf });
  assert.deepEqual(ghost.nodes.find((n) => n.id === 'f').warnings, [{ words: '"nope" is no value of its field: it sends nothing' }]);
});

test('one door for a node\'s outputs: its own rows, else a value row where a row of it unfolds; a clash takes -2', () => {
  const field = nodeKinds().field;
  assert.equal(outputRow(field, 'field').gives, 'field');
  assert.equal(outputRow(field, 'v-anything').output, 'value');
  assert.equal(outputRow(nodeKinds().condition, 'v-anything'), undefined, 'a kind with no unfolding row has no value rows');
  assert.deepEqual(unfoldedRows(['At risk', 'at-risk', '']).map((r) => r.name), ['v-at-risk', 'v-at-risk-2', 'v-value']);
});
