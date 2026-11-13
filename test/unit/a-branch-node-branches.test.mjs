/**
 * A BRANCH NODE BRANCHES (Will, plans 944, 971 A): no node has a True or a False socket. A test gives Pass, the rows that
 * hold, and Fail, the rest, and a True property, 1 or 0. The Branch is the ONE node that branches: its test on its header,
 * its Data on a row, its When said on it; Yes sends ALL the Data where When holds, No where it does not, and the other way
 * is not taken, so nothing after it runs. And and Or take anything, several. Counting rows is a Math type, Count.
 *
 *   node --test test/unit/a-branch-node-branches.test.mjs
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
const graphOf = (nodes, connections) => workflowGraph({ v: 3, id: 'branch', nodes, connections });
const out = (sim, id, socket) => sim.nodes[id].outgoing.find((s) => s.socket === socket);
const rows = [{ id: 1, status: 'active', plan: 'Free' }, { id: 2, status: 'active', plan: 'Pro' }, { id: 3, status: 'trial', plan: 'Free' }];
const users = [N('s', 'source', { store: 'users' }), N('f', 'field', { field: 'status' })];
const toStatus = [C('s/rows', 'f'), C('f/field', 'c')];

test('no kind forks: a test\'s Pass, Fail and True are properties; the Branch\'s Yes and No are its only ways; Count is no property', () => {
  assert.ok(Object.values(NODE_KINDS).every((k) => !('branches' in k)));
  for (const type of ['eq', 'gt', 'between', 'and', 'or', 'not', 'empty']) {
    const kind = resolveKind(NODE_KINDS.condition, type);
    assert.deepEqual(kind.rows.filter((r) => r.property).map((r) => [r.name, r.gives]), [['pass', 'rows'], ['fail', 'rows'], ['true', 'number']], type);
  }
  // Its Type is its When: Any first; At least adds its N.
  assert.deepEqual([NODE_KINDS.branch.typeLabel, NODE_KINDS.branch.defaultType, Object.keys(NODE_KINDS.branch.types)], ['When', 'any', ['any', 'all', 'none', 'atleast']]);
  for (const when of ['any', 'all', 'none', 'atleast']) {
    const rows = resolveKind(NODE_KINDS.branch, when).rows.filter((r) => r.name !== 'type');
    assert.deepEqual(rows.map((r) => [r.name, r.input ?? r.output]), [...(when === 'atleast' ? [['n', 'value']] : []), ['data', 'any'], ['yes', 'object'], ['no', 'object']], when);
  }
  for (const id of ['source', 'field', 'organise']) assert.ok(!NODE_KINDS[id].rows.some((r) => r.name === 'count'), id);
  assert.deepEqual(resolveKind(NODE_KINDS.math, 'count').rows.map((r) => r.name), ['type', 'rows', 'result']);
  // A line from a Condition's header is a fault: it has no such socket.
  const old = { v: 3, id: 'old', nodes: [...users, N('c', 'condition', { type: 'eq', b: 'active' }), N('o', 'result')], connections: [...toStatus, C('c', 'o')] };
  assert.match(workflowFaults(old).join('; '), /a connection leaves "c", which is no output socket/);
});

test('a test\'s True is 1 where any row passes, 0 where none does; Pass is the rows that pass, Fail the rest', () => {
  const sim = (b) => simulateGraph(graphOf([...users, N('c', 'condition', { type: 'eq', b })], toStatus), { users: rows });
  const ids = (s, socket) => out(s, 'c', socket).rows.map((r) => r.id);
  const yes = sim('active');
  assert.deepEqual([out(yes, 'c', 'c/true').value, ids(yes, 'c/pass'), ids(yes, 'c/fail')], [1, [1, 2], [3]]);
  const gone = sim('gone');
  assert.deepEqual([out(gone, 'c', 'c/true').value, ids(gone, 'c/pass'), ids(gone, 'c/fail')], [0, [], [1, 2, 3]]);
});

test('a Branch sends its Data on Yes where its test holds; No is not taken, and what it feeds does not run; and the other way', () => {
  const run = (b) => simulateGraph(graphOf(
    [...users, N('c', 'condition', { type: 'eq', b }), N('k', 'branch'), N('yes', 'response', { type: 'toast' }), N('no', 'response', { type: 'toast' })],
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

test('a Branch with no Data sends its test on the way taken; its Yes and No are drawn as what reaches its Data', () => {
  const sim = simulateGraph(graphOf([N('v', 'value', { type: 'integer', value: '5' }), N('k', 'branch')], [C('v/value', 'k')]), {});
  assert.deepEqual([out(sim, 'k', 'k/yes').value, out(sim, 'k', 'k/no').notTaken], [5, true]);
  const drawn = (data) => graphOf([...users, N('v', 'value', { type: 'integer', value: '5' }), N('k', 'branch')], [C('s/rows', 'f'), C(data, 'k/data')]).nodes.find((n) => n.id === 'k').rows;
  assert.deepEqual(drawn('v/value').filter((r) => r.passes).map((r) => r.output), ['value', 'value']);
  assert.deepEqual(drawn('s/rows').filter((r) => r.passes).map((r) => r.output), ['object', 'object']);
});

test('And and Or take anything; their True 1 or 0; And\'s Pass is the rows in every input, Or\'s in any, Fail the rest (Will)', () => {
  const counts = [3, 0, 5].map((n, i) => N(`n${i}`, 'value', { type: 'integer', value: n }));
  const joins = [N('or', 'condition', { type: 'or' }), N('and', 'condition', { type: 'and' })];
  const sim = simulateGraph(graphOf([...counts, ...joins], counts.flatMap((n) => [C(`${n.id}/value`, 'or'), C(`${n.id}/value`, 'and')])), {});
  // An Or of 3, 0 and 5 is True, an And of them is not; values bring no rows to pass or fail.
  assert.deepEqual([out(sim, 'or', 'or/true').value, out(sim, 'and', 'and/true').value], [1, 0]);
  assert.deepEqual(['or/pass', 'or/fail', 'and/pass', 'and/fail'].map((s) => out(sim, s.split('/')[0], s).rows), [[], [], [], []]);
  // Two tests' Pass: active is 1 and 2, Free is 1 and 3.
  const tests = [...users, N('p', 'field', { field: 'plan' }), N('a', 'condition', { type: 'eq', b: 'active' }), N('fr', 'condition', { type: 'eq', b: 'Free' }), ...joins];
  const wires = [C('s/rows', 'f'), C('s/rows', 'p'), C('f/field', 'a'), C('p/field', 'fr'), ...['a/pass', 'fr/pass'].flatMap((x) => [C(x, 'and'), C(x, 'or')])];
  const run = simulateGraph(graphOf(tests, wires), { users: rows });
  const ids = (id, socket) => out(run, id, `${id}/${socket}`).rows.map((r) => r.id);
  assert.deepEqual([ids('and', 'pass'), ids('and', 'fail'), ids('or', 'pass'), ids('or', 'fail')], [[1], [2, 3], [1, 2, 3], []]);
});

test('a Branch\'s When reads its test: Any, a Pass row; All, no Fail row; None, no Pass row; At least, N Pass rows; a value by its truth', () => {
  const ways = (when, n) => [['ne', 'gone'], ['eq', 'active'], ['eq', 'gone']].map(([type, b]) => {
    const k = N('k', 'branch', { type: when, ...(n ? { n } : {}) });
    const sim = simulateGraph(graphOf([...users, N('c', 'condition', { type, b }), k], [...toStatus, C('c/true', 'k'), C('s/rows', 'k/data')]), { users: rows });
    return out(sim, 'k', 'k/yes').notTaken ? 'no' : 'yes';
  });
  // Every row passes; two of three; none.
  assert.deepEqual(ways('any'), ['yes', 'yes', 'no']);
  assert.deepEqual(ways('all'), ['yes', 'no', 'no']);
  assert.deepEqual(ways('none'), ['no', 'no', 'yes']);
  assert.deepEqual([ways('atleast', 2), ways('atleast', 3)], [['yes', 'yes', 'no'], ['yes', 'no', 'no']]);
  const plain = (value, when, n) => {
    const sim = simulateGraph(graphOf([N('v', 'value', { type: 'integer', value }), N('k', 'branch', { type: when, ...(n ? { n } : {}) })], [C('v/value', 'k')]), {});
    return out(sim, 'k', 'k/yes').notTaken ? 'no' : 'yes';
  };
  assert.deepEqual([plain(5, 'any'), plain(0, 'any'), plain(5, 'none'), plain(0, 'none'), plain(5, 'atleast', 5), plain(5, 'atleast', 6)], ['yes', 'no', 'no', 'yes', 'yes', 'no']);
});

test('Math Count: how many rows come in', () => {
  const sim = simulateGraph(graphOf([...users, N('m', 'math', { type: 'count' })], [C('s/rows', 'm/rows')]), { users: rows });
  assert.equal(out(sim, 'm', 'm/result').value, 3);
});

test('a test\'s True or its Pass into an Or say its tree, as the header did: the Query reads the same where', () => {
  const nodes = [...users, N('a', 'condition', { type: 'eq', b: 'active' }), N('t', 'condition', { type: 'eq', b: 'trial' }), N('or', 'condition', { type: 'or' })];
  const base = [C('s/rows', 'f'), C('f/field', 'a'), C('f/field', 't')];
  const where = (from) => nodeFlow(graphOf(nodes, [...base, ...from.map((x) => C(x, 'or'))]), 'or').definition.where;
  const tree = { or: [{ field: 'status', op: 'eq', value: 'active' }, { field: 'status', op: 'eq', value: 'trial' }] };
  assert.deepEqual([where(['a/true', 't/true']), where(['a/pass', 't/pass'])], [tree, tree]);
});

test('a test\'s Fail says the opposite of its tree: carried through a Field, and into an Or', () => {
  const ne = (value) => ({ field: 'status', op: 'ne', value });
  const nodes = [...users, N('a', 'condition', { type: 'eq', b: 'active' }), N('t', 'condition', { type: 'eq', b: 'trial' }), N('p', 'field', { field: 'plan' }), N('pro', 'condition', { type: 'eq', b: 'Pro' }), N('or', 'condition', { type: 'or' })];
  const flow = (connections, id) => nodeFlow(graphOf(nodes, [C('s/rows', 'f'), C('f/field', 'a'), C('f/field', 't'), ...connections]), id).definition.where;
  assert.deepEqual(flow([C('a/fail', 'p'), C('p/field', 'pro')], 'pro'), { and: [ne('active'), { field: 'plan', op: 'eq', value: 'Pro' }] });
  assert.deepEqual(flow([C('a/fail', 'or'), C('t/fail', 'or')], 'or'), { or: [ne('active'), ne('trial')] });
});
