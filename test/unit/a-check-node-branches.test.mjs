/**
 * A CHECK NODE BRANCHES (Will, plan 944): no node has a True or a False socket. A test has a True property, 1 or 0, beside
 * its Results. The Check is the ONE node that branches: its test on its header, its Data on a row; Yes sends the Data where
 * the test holds, No where it does not, and the other way is not taken, so nothing after it runs. And and Or take anything,
 * several, and say Pass and Fail. Counting rows is a Math type, Count.
 *
 *   node --test test/unit/a-check-node-branches.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const core = new URL('../../dist/core/data/', import.meta.url);
const { simulateGraph, lightOf } = await import(new URL('node-simulate.js', core));
const { workflowFaults, workflowGraph } = await import(new URL('workflow.js', core));
const { nodeFlow } = await import(new URL('node-flow.js', core));
const { NODE_KINDS, resolveKind } = await import(new URL('node-kinds.js', core));

const N = (id, kind, values) => ({ id, kind, x: 0, y: 0, ...(values ? { values } : {}) });
const C = (from, to) => ({ from, to });
const graphOf = (nodes, connections) => workflowGraph({ v: 3, id: 'check', nodes, connections });
const out = (sim, id, socket) => sim.nodes[id].outgoing.find((s) => s.socket === socket);
const rows = [{ id: 1, status: 'active', plan: 'Free' }, { id: 2, status: 'active', plan: 'Pro' }, { id: 3, status: 'trial', plan: 'Free' }];
const users = [N('s', 'source', { store: 'users' }), N('f', 'field', { field: 'status' })];
const toStatus = [C('s/rows', 'f'), C('f/field', 'c')];

test('no kind forks: a test\'s True is a property, 1 or 0; the Check\'s Yes and No are its only ways; Count is no property', () => {
  assert.ok(Object.values(NODE_KINDS).every((k) => !('branches' in k)));
  for (const type of ['eq', 'gt', 'between', 'and', 'or', 'not', 'empty']) {
    const kind = resolveKind(NODE_KINDS.condition, type);
    assert.deepEqual(kind.rows.filter((r) => r.property).map((r) => r.name), ['rows', 'true', ...(['and', 'or'].includes(type) ? ['pass', 'fail'] : [])], type);
  }
  assert.deepEqual(NODE_KINDS.check.rows.map((r) => [r.name, r.input ?? r.output]), [['data', 'any'], ['yes', 'object'], ['no', 'object']]);
  for (const id of ['source', 'field', 'organise']) assert.ok(!NODE_KINDS[id].rows.some((r) => r.name === 'count'), id);
  assert.deepEqual(resolveKind(NODE_KINDS.math, 'count').rows.map((r) => r.name), ['type', 'rows', 'result']);
  // A line from a Condition's header is a fault: it has no such socket.
  const old = { v: 3, id: 'old', nodes: [...users, N('c', 'condition', { type: 'eq', b: 'active' }), N('o', 'result')], connections: [...toStatus, C('c', 'o')] };
  assert.match(workflowFaults(old).join('; '), /a connection leaves "c", which is no output socket/);
});

test('a test\'s True is 1 where any row passes, 0 where none does; Results are the rows that pass', () => {
  const sim = (b) => simulateGraph(graphOf([...users, N('c', 'condition', { type: 'eq', b })], toStatus), { users: rows });
  const yes = sim('active');
  assert.deepEqual([out(yes, 'c', 'c/true').value, out(yes, 'c', 'c/rows').rows.map((r) => r.id)], [1, [1, 2]]);
  assert.equal(out(sim('gone'), 'c', 'c/true').value, 0);
});

test('a Check sends its Data on Yes where its test holds; No is not taken, and what it feeds does not run; and the other way', () => {
  const run = (b) => simulateGraph(graphOf(
    [...users, N('c', 'condition', { type: 'eq', b }), N('k', 'check'), N('yes', 'response', { type: 'toast' }), N('no', 'response', { type: 'toast' })],
    [...toStatus, C('c/true', 'k'), C('s/rows', 'k/data'), C('k/yes', 'yes'), C('k/no', 'no')],
  ), { users: rows });
  const sim = run('active');
  assert.deepEqual(sim.faults, []);
  assert.deepEqual(out(sim, 'k', 'k/yes').rows.map((r) => r.id), [1, 2, 3]);
  assert.deepEqual([out(sim, 'k', 'k/no').note, out(sim, 'k', 'k/no').notTaken], ['Not taken', true]);
  assert.deepEqual([sim.nodes.yes.notTaken, sim.nodes.no.notTaken, lightOf(sim.nodes.no, 0)], [undefined, true, 'Not taken · <1 ms']);
  // No row is "gone": No sends the Data, and Yes is not taken.
  const off = run('gone');
  assert.deepEqual([out(off, 'k', 'k/no').rows.length, out(off, 'k', 'k/yes').notTaken, off.nodes.yes.notTaken], [3, true, true]);
});

test('a Check with no Data sends its test on the way taken; its Yes and No are drawn as what reaches its Data', () => {
  const sim = simulateGraph(graphOf([N('v', 'value', { type: 'integer', value: '5' }), N('k', 'check')], [C('v/value', 'k')]), {});
  assert.deepEqual([out(sim, 'k', 'k/yes').value, out(sim, 'k', 'k/no').notTaken], [5, true]);
  const drawn = (data) => graphOf([...users, N('v', 'value', { type: 'integer', value: '5' }), N('k', 'check')], [C('s/rows', 'f'), C(data, 'k/data')]).nodes.find((n) => n.id === 'k').rows;
  assert.deepEqual(drawn('v/value').filter((r) => r.passes).map((r) => r.output), ['value', 'value']);
  assert.deepEqual(drawn('s/rows').filter((r) => r.passes).map((r) => r.output), ['object', 'object']);
});

test('And and Or take anything: Pass and Fail; their True 1 or 0; an Or of 3, 0 and 5 is True, Pass 2, Fail 1 (Will)', () => {
  const counts = [3, 0, 5].map((n, i) => N(`n${i}`, 'value', { type: 'integer', value: n }));
  const sim = simulateGraph(graphOf([...counts, N('or', 'condition', { type: 'or' })], counts.map((n) => C(`${n.id}/value`, 'or'))), {});
  assert.deepEqual(['or/true', 'or/pass', 'or/fail'].map((s) => out(sim, 'or', s).value), [1, 2, 1]);
});

test('Math Count: how many rows come in', () => {
  const sim = simulateGraph(graphOf([...users, N('m', 'math', { type: 'count' })], [C('s/rows', 'm/rows')]), { users: rows });
  assert.equal(out(sim, 'm', 'm/result').value, 3);
});

test('a test\'s True or its Results into an Or say its tree, as the header did: the Query reads the same where', () => {
  const nodes = [...users, N('a', 'condition', { type: 'eq', b: 'active' }), N('t', 'condition', { type: 'eq', b: 'trial' }), N('or', 'condition', { type: 'or' })];
  const base = [C('s/rows', 'f'), C('f/field', 'a'), C('f/field', 't')];
  const where = (from) => nodeFlow(graphOf(nodes, [...base, ...from.map((x) => C(x, 'or'))]), 'or').definition.where;
  const tree = { or: [{ field: 'status', op: 'eq', value: 'active' }, { field: 'status', op: 'eq', value: 'trial' }] };
  assert.deepEqual([where(['a/true', 't/true']), where(['a/rows', 't/rows'])], [tree, tree]);
});
