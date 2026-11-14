/**
 * A MERGE JOINS TWO SETS OF ROWS BY A FIELD OF EACH — plan 992 O3 A (Will, 2026-11-14: one Merge, no Compare): a Field of
 * the A rows on its header, one of the B rows on B; Matched, Only in A, Only in B and Changed. What it sends holds both
 * sets' fields, so a Field after it picks from both.
 * TRAP T-a-merge-joins-by-a-field-of-each
 *
 *   node --test test/unit/a-merge-joins-by-a-field-of-each.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { graphText, workflowFaults, workflowGraph } from '../../dist/data.js';
import { NODE_KINDS } from '../../dist/core/data/node-kinds.js';
import { simulateGraph } from '../../dist/core/data/node-simulate.js';

const fieldsOf = {
  devices: { id: { type: 'number' }, customer: { label: 'Customer', type: 'number' }, name: { label: 'Name' }, os: { label: 'OS' } },
  customers: { id: { type: 'number' }, name: { label: 'Name' }, region: { label: 'Region' } },
};
const devices = [{ id: 1, customer: 10, name: 'd1', os: 'win' }, { id: 2, customer: 11, name: 'd2', os: 'mac' }, { id: 3, customer: 99, name: 'd3', os: 'win' }, { id: 4, customer: null, name: 'd4', os: 'mac' }];
const customers = [{ id: 10, name: 'Acme', region: 'EU' }, { id: 11, name: 'Beta', region: 'US' }, { id: 12, name: 'Gamma', region: 'EU' }];
const N = (id, kind, values) => ({ id, kind, x: 0, y: 0, ...(values ? { values } : {}) });
const C = (from, to) => ({ from, to });
/** Devices by Customer, customers by id, into a Merge; a Field on its Matched. */
const flow = (more = [], wires = []) => ({
  v: 3, id: 'm',
  nodes: [N('sa', 'source', { store: 'devices' }), N('fa', 'field', { field: 'customer' }), N('sb', 'source', { store: 'customers' }), N('fb', 'field', { field: 'id' }), N('m', 'merge'), ...more],
  connections: [C('sa/rows', 'fa'), C('sb/rows', 'fb'), C('fa/field', 'm'), C('fb/field', 'm/b'), ...wires],
});
const run = (w, stores = { devices, customers }) => simulateGraph(workflowGraph(w, { fieldsOf }), stores);
const out = (sim, socket) => sim.nodes.m.outgoing.find((s) => s.socket === `m/${socket}`);

test('a Merge takes a Field of A on its header and one of B on B; Compare picks from A\'s fields; four outputs of rows', () => {
  assert.deepEqual([NODE_KINDS.merge.category, NODE_KINDS.merge.needs, NODE_KINDS.merge.joins, NODE_KINDS.merge.graphs], ['Organise', 'field', true, ['workflow']]);
  const m = workflowGraph(flow(), { fieldsOf }).nodes.find((n) => n.id === 'm');
  assert.deepEqual(m.rows.map((r) => [r.name, r.label, r.input ?? null, r.output ?? null]), [
    ['b', 'B', 'any', null], ['compare', 'Compare', null, null],
    ['matched', 'Matched', null, 'object'], ['only-a', 'Only in A', null, 'object'], ['only-b', 'Only in B', null, 'object'], ['changed', 'Changed', null, 'object'],
  ]);
  assert.deepEqual(m.rows.find((r) => r.name === 'compare').choices.map((c) => c.value), ['id', 'customer', 'name', 'os']);
  assert.deepEqual([workflowFaults(flow(), NODE_KINDS, { fieldsOf }), m.warnings], [[], undefined]);
});

test('what a Merge sends holds the fields of both sets: a Field after it picks a B field, no stranger', () => {
  const w = flow([N('r', 'field', { field: 'region' })], [C('m/matched', 'r')]);
  const r = workflowGraph(w, { fieldsOf }).nodes.find((n) => n.id === 'r');
  assert.deepEqual(r.rows.find((x) => x.name === 'field').choices.map((c) => c.value), ['id', 'customer', 'name', 'os', 'region']);
  assert.deepEqual([workflowFaults(w, NODE_KINDS, { fieldsOf }), r.warnings], [[], undefined]);
});

test('a run: Matched is each A row over its B row; Only in A and Only in B the rows that match none; an empty value matches none', () => {
  const sim = run(flow());
  assert.deepEqual(out(sim, 'matched').rows, [{ id: 1, customer: 10, name: 'd1', os: 'win', region: 'EU' }, { id: 2, customer: 11, name: 'd2', os: 'mac', region: 'US' }]);
  assert.deepEqual([out(sim, 'only-a').rows.map((r) => r.id), out(sim, 'only-b').rows.map((r) => r.id)], [[3, 4], [12]]);
  // One A row to many B rows: a row per pair.
  const many = run(flow(), { devices, customers: [...customers, { id: 10, name: 'Acme EU', region: 'DE' }] });
  assert.deepEqual(out(many, 'matched').rows.filter((r) => r.id === 1).map((r) => r.region), ['EU', 'DE']);
  // A side not joined says so.
  const half = run({ ...flow(), connections: flow().connections.filter((c) => c.to !== 'm/b') });
  assert.equal(out(half, 'matched').note, 'No rows reach B: connect a Field in');
});

test('Changed: the matched pairs whose Compare columns differ; none picked, every column both hold but the two fields', () => {
  const crm = [{ email: 'a@x', plan: 'Pro', seats: 5 }, { email: 'b@x', plan: 'Free', seats: 1 }, { email: 'c@x', plan: 'Pro', seats: 9 }];
  const billing = [{ email: 'a@x', plan: 'Pro', seats: 6 }, { email: 'b@x', plan: 'Pro', seats: 1 }, { email: 'c@x', plan: 'Pro', seats: 9 }];
  const facts = { fieldsOf: { crm: { email: {}, plan: {}, seats: { type: 'number' } }, billing: { email: {}, plan: {}, seats: { type: 'number' } } } };
  const w = (compare) => ({
    v: 3, id: 'c',
    nodes: [N('sa', 'source', { store: 'crm' }), N('fa', 'field', { field: 'email' }), N('sb', 'source', { store: 'billing' }), N('fb', 'field', { field: 'email' }), N('m', 'merge', compare ? { compare } : undefined)],
    connections: [C('sa/rows', 'fa'), C('sb/rows', 'fb'), C('fa/field', 'm'), C('fb/field', 'm/b')],
  });
  const changed = (compare) => out(simulateGraph(workflowGraph(w(compare), facts), { crm, billing }), 'changed').rows.map((r) => r.email);
  assert.deepEqual([changed(undefined), changed(['plan']), changed(['seats'])], [['a@x', 'b@x'], ['b@x'], ['a@x']]);
});

test('the text lens says the Merge in words, by its two fields', () => {
  assert.match(graphText(flow()).stages.join('\n'), /Merge: join the rows by .*customer.* and .*id.*\./);
});
