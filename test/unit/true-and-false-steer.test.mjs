/**
 * TRUE AND FALSE STEER (Will, TODO 939): a fork's True says "if true, do this", its False "if false, do this"; each sends
 * true or false and carries no rows. A node down a Branch not taken does not run. And and Or take anything, several: an
 * input is true where it is above zero, true, or not empty. Their Results are the rows of the true inputs, Count those
 * rows and the SUM of the true counts, Pass and Fail how many inputs pass and fail. A test's Results say its tree, as its True.
 *
 *   node --test test/unit/true-and-false-steer.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const core = new URL('../../dist/core/data/', import.meta.url);
const { lightOf, simulateGraph } = await import(new URL('node-simulate.js', core));
const { workflowGraph } = await import(new URL('workflow.js', core));

const N = (id, kind, values) => ({ id, kind, x: 0, y: 0, ...(values ? { values } : {}) });
const C = (from, to) => ({ from, to });
const graphOf = (nodes, connections) => workflowGraph({ v: 3, id: 'steer', nodes, connections });
const out = (sim, id, socket) => sim.nodes[id].outgoing.find((s) => s.socket === socket);
const counts = (...ns) => ns.map((n, i) => N(`n${i}`, 'value', { type: 'integer', value: n }));

test('an Or of counts: true where any is above zero; Count the sum of the true ones; Pass and Fail; no rows (Will: 3, 0, 5)', () => {
  const sim = simulateGraph(graphOf([...counts(3, 0, 5), N('or', 'condition', { type: 'or' })], [C('n0/value', 'or'), C('n1/value', 'or'), C('n2/value', 'or')]), {});
  assert.deepEqual(['or', 'or/#false', 'or/count', 'or/pass', 'or/fail'].map((s) => out(sim, 'or', s).value), [true, false, 8, 2, 1]);
  assert.deepEqual(out(sim, 'or', 'or/rows').rows, []);
});

test('an And of counts: true only where every one is; Count still the sum of the true ones', () => {
  const sim = simulateGraph(graphOf([...counts(3, 0), N('and', 'condition', { type: 'and' })], [C('n0/value', 'and'), C('n1/value', 'and')]), {});
  assert.deepEqual(['and', 'and/#false', 'and/count', 'and/pass', 'and/fail'].map((s) => out(sim, 'and', s).value), [false, true, 3, 1, 1]);
});

test('rows and counts together: Results the rows of the true inputs, Count their rows and the counts', () => {
  const rows = [{ id: 1, status: 'active' }, { id: 2, status: 'trial' }, { id: 3, status: 'active' }];
  const g = graphOf(
    [N('s', 'source', { store: 'users' }), N('f', 'field', { field: 'status' }), N('c', 'condition', { type: 'eq', b: 'active' }), ...counts(4), N('or', 'condition', { type: 'or' })],
    [C('s/rows', 'f'), C('f/field', 'c'), C('c/rows', 'or'), C('n0/value', 'or')],
  );
  const sim = simulateGraph(g, { users: rows });
  assert.deepEqual(out(sim, 'or', 'or/rows').rows.map((r) => r.id), [1, 3]);
  assert.equal(out(sim, 'or', 'or/count').value, 2 + 4);
});

test('a Branch not taken does not run: what its True or its False steers says Not taken; the other runs', () => {
  const rows = [{ id: 1, status: 'active' }];
  const g = graphOf(
    [N('s', 'source', { store: 'users' }), N('f', 'field', { field: 'status' }), N('c', 'condition', { type: 'eq', b: 'active' }),
      N('yes', 'output', { type: 'toast' }), N('no', 'output', { type: 'toast' })],
    [C('s/rows', 'f'), C('f/field', 'c'), C('c', 'yes'), C('c/#false', 'no')],
  );
  const sim = simulateGraph(g, { users: rows });
  // Every row passes: True steers on, False does not.
  assert.deepEqual([out(sim, 'c', 'c').value, out(sim, 'c', 'c/#false').value], [true, false]);
  assert.equal(out(sim, 'yes', 'yes/shown').value, true);
  assert.equal(out(sim, 'no', 'no/shown').note, 'Not taken');
  // It would do nothing, and its light says so.
  assert.deepEqual([sim.nodes.no.notTaken, sim.nodes.no.would, lightOf(sim.nodes.no, 0)], [true, undefined, 'Not taken · <1 ms']);
  assert.equal(sim.nodes.yes.notTaken, undefined);
});

test('a steer into a header is no data: it gates the node, and warns nothing', () => {
  const g = graphOf(
    [N('s', 'source', { store: 'users' }), N('f', 'field', { field: 'status' }), N('c', 'condition', { type: 'eq', b: 'active' }), N('sorted', 'sort')],
    [C('s/rows', 'f'), C('f/field', 'c'), C('c', 'sorted')],
  );
  assert.equal(g.nodes.find((n) => n.id === 'sorted').warnings, undefined);
});

test('a test\'s Results into an Or say its tree, as its True does: the Query reads the same where', async () => {
  const { nodeFlow } = await import(new URL('node-flow.js', core));
  const nodes = [N('s', 'source', { store: 'users' }), N('f', 'field', { field: 'status' }), N('a', 'condition', { type: 'eq', b: 'active' }),
    N('t', 'condition', { type: 'eq', b: 'trial' }), N('or', 'condition', { type: 'or' })];
  const base = [C('s/rows', 'f'), C('f/field', 'a'), C('f/field', 't')];
  const where = (from) => nodeFlow(graphOf(nodes, [...base, ...from.map((x) => C(x, 'or'))]), 'or').definition.where;
  const tree = { or: [{ field: 'status', op: 'eq', value: 'active' }, { field: 'status', op: 'eq', value: 'trial' }] };
  assert.deepEqual([where(['a', 't']), where(['a/rows', 't/rows'])], [tree, tree]);
});
