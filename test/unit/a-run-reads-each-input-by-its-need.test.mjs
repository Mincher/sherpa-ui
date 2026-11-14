/**
 * A RUN READS EACH INPUT BY ITS NEED (Will, 2026-11-11: "The fixes should not be specific to node properties and connections.
 * It should be fixed generically on how to handle data types."). Simulate reads what reaches a row by the ONE table the drawn
 * graph reads (`readInput`, COERCIONS), whatever node sends it: a Math Result, a Math Count, a True. A Condition tests against
 * the value a connection brings to Value B or Start and End, not the row's own. A test of one value says the way it took,
 * and its value.
 *
 *   node --test test/unit/a-run-reads-each-input-by-its-need.test.mjs
 *
 * TRAP T-a-node-reads-null-from-what-it-cannot-use
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const core = new URL('../../dist/core/data/', import.meta.url);
const { simulateGraph, lightOf } = await import(new URL('node-simulate.js', core));
const { workflowGraph } = await import(new URL('workflow.js', core));

const N = (id, kind, values) => ({ id, kind, x: 0, y: 0, ...(values ? { values } : {}) });
const C = (from, to) => ({ from, to });
const rows = Array.from({ length: 40 }, (_, i) => ({ id: i, seats: i }));
const fieldsOf = { u: { seats: { label: 'Seats', type: 'number' } } };
const run = (nodes, connections) => simulateGraph(workflowGraph({ v: 3, id: 'w', nodes, connections }, { fieldsOf }), { u: rows });
const out = (sim, id, socket) => sim.nodes[id].outgoing.find((s) => s.socket === socket);
const into = (sim, id, socket) => sim.nodes[id].incoming.find((s) => s.socket === socket);
const seats = [N('s', 'source', { store: 'u' }), N('f', 'field', { field: 'seats' })];
const toSeats = [C('s/rows', 'f'), C('f/field', 'c')];

test('a Math Result into Value B is what the rows are tested against: Seats > 1 + 2 keeps 36 of 40', () => {
  const sim = run([...seats, N('m', 'math', { type: 'add', a: '1', b: '2' }), N('c', 'condition', { type: 'gt' })], [...toSeats, C('m/result', 'c/b')]);
  // Its Pass keeps 36, its Fail the other 4 (plan 971).
  assert.deepEqual([sim.faults, out(sim, 'c', 'c/pass').rows.length, out(sim, 'c', 'c/fail').rows.length], [[], 36, 4]);
});

test('a Count into Start: Seats between 3 and 30, its Start a run gives, keeps 28; a Count into Value B too', () => {
  const sim = run([...seats, N('m', 'math', { type: 'add', a: '1', b: '2' }), N('c', 'condition', { type: 'between', end: '30' })], [...toSeats, C('m/result', 'c/start')]);
  assert.equal(out(sim, 'c', 'c/pass').rows.length, 28);
  // A Math Count of the Source's rows, as no Count row is left (plan 944).
  const counted = run([...seats, N('k', 'math', { type: 'count' }), N('c', 'condition', { type: 'lt' })], [...toSeats, C('s/rows', 'k/rows'), C('k/result', 'c/b')]);
  assert.deepEqual([into(counted, 'c', 'c/b').value, out(counted, 'c', 'c/pass').rows.length], [40, 40], 'every seat is under the 40 rows');
});

test('a value a row takes is coerced as the drawn graph coerces it: a True into a Math reads 1', () => {
  const sim = run([N('v', 'value', { type: 'boolean', value: 'true' }), N('m', 'math', { type: 'add', b: '2' })], [C('v/value', 'm/a')]);
  assert.equal(out(sim, 'm', 'm/result').value, 3);
});

test('a test of one value lights its value; one fed nothing it can use says why, with no fault', () => {
  // A Math Count of the Source's rows into the Condition: its light is the way it took, and the value it sends (plan 971 §9).
  const counted = (b) => run([N('s', 'source', { store: 'u' }), N('m', 'math', { type: 'count' }), N('c', 'condition', { type: 'gt', b })], [C('s/rows', 'm/rows'), C('m/result', 'c')]);
  assert.equal(lightOf(counted('1').nodes.c, 0), 'Pass = 40 · <1 ms');
  assert.equal(lightOf(counted('50').nodes.c, 0), 'Fail = 40 · <1 ms');
  // An Average takes a list; one number is no list (plan 783 D2), so the Condition says so, and nothing faults.
  const none = run([N('s', 'source', { store: 'u' }), N('k', 'math', { type: 'count' }), N('m', 'math', { type: 'average' }), N('c', 'condition', { type: 'gt', b: '1' })],
    [C('s/rows', 'k/rows'), C('k/result', 'm/values'), C('m/result', 'c')]);
  assert.deepEqual([none.faults, out(none, 'c', 'c/pass').note], [[], 'Values takes a list of numbers; it was given "40"']);
});
