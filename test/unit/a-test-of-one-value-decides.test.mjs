/**
 * A TEST OF ONE VALUE DECIDES (Will, plans 944, 971 A; §9: "Fold it into Condition"): no node has a True or a False socket,
 * and there is no Branch node. A test of a column gives Pass, the rows that hold, and Fail, the rest, and a True property,
 * 1 or 0. A test of ONE value (a number, a True, rows into Is empty) sends ALL its Data, else the value, by Pass where it
 * holds or Fail where not; the other way is not taken, so nothing after it runs. The Boolean passes on what comes in where
 * it is true. And and Or take anything, several.
 * Counting rows is a Math type, Count.
 *
 *   node --test test/unit/a-test-of-one-value-decides.test.mjs
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

test('no kind forks and there is no Branch: a test\'s Pass, Fail and True are properties, then its Data; Count is no property', () => {
  assert.ok(Object.values(NODE_KINDS).every((k) => !('branches' in k)));
  assert.equal(NODE_KINDS.branch, undefined, 'the Branch folds into Condition (plan 971 §9)');
  for (const type of ['eq', 'gt', 'between', 'and', 'or', 'not', 'empty']) {
    const kind = resolveKind(NODE_KINDS.condition, type);
    assert.deepEqual(kind.rows.filter((r) => r.property).map((r) => [r.name, r.gives]), [['pass', 'rows'], ['fail', 'rows'], ['true', 'number']], type);
    const data = kind.rows.find((r) => r.name === 'data');
    assert.deepEqual([data.input, data.optional, kind.rows.indexOf(data)], ['any', true, kind.rows.findIndex((r) => r.name === 'fail') + 1], type);
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

test('a test of one value sends ALL its Data by Pass where it holds; Fail is not taken, and what it feeds does not run; and the other way', () => {
  // How many users, more than b? The Count is ONE value: Pass or Fail sends the users, all of them.
  const run = (b) => simulateGraph(graphOf(
    [N('s', 'source', { store: 'users' }), N('m', 'math', { type: 'count' }), N('k', 'condition', { type: 'gt', b }), N('yes', 'response', { type: 'toast' }), N('no', 'response', { type: 'toast' })],
    [C('s/rows', 'm/rows'), C('m/result', 'k'), C('s/rows', 'k/data'), C('k/pass', 'yes'), C('k/fail', 'no')],
  ), { users: rows });
  const sim = run(2);
  assert.deepEqual(sim.faults, []);
  assert.deepEqual(out(sim, 'k', 'k/pass').rows.map((r) => r.id), [1, 2, 3]);
  assert.deepEqual([out(sim, 'k', 'k/fail').note, out(sim, 'k', 'k/fail').notTaken], ['Not taken', true]);
  assert.deepEqual([sim.nodes.yes.notTaken, sim.nodes.no.notTaken, lightOf(sim.nodes.no, 0)], [undefined, true, 'Not taken · <1 ms']);
  // 3 is not more than 5: Fail sends the users, and Pass is not taken.
  const off = run(5);
  assert.deepEqual([out(off, 'k', 'k/fail').rows.length, out(off, 'k', 'k/pass').notTaken, off.nodes.yes.notTaken], [3, true, true]);
});

test('a test of one value with no Data sends the value on the way taken; its Pass and Fail are drawn as what they send', () => {
  const sim = simulateGraph(graphOf([N('v', 'value', { type: 'integer', value: '5' }), N('k', 'condition', { type: 'gt', b: 1 })], [C('v/value', 'k')]), {});
  assert.deepEqual([out(sim, 'k', 'k/pass').value, out(sim, 'k', 'k/fail').notTaken], [5, true]);
  const drawn = (data) => graphOf([...users, N('v', 'value', { type: 'integer', value: '5' }), N('k', 'condition', { type: 'gt', b: 1 })], [C('s/rows', 'f'), C('v/value', 'k'), ...(data ? [C(data, 'k/data')] : [])]).nodes.find((n) => n.id === 'k').rows;
  assert.deepEqual(drawn('s/rows').filter((r) => r.fork).map((r) => r.output), ['object', 'object']);
  assert.deepEqual(drawn(undefined).filter((r) => r.fork).map((r) => r.output), ['value', 'value']);
  // On a column the rows split, and Data is not used, and says so.
  const column = graphOf([...users, N('k', 'condition', { type: 'eq', b: 'active' })], [...toStatus.map((c) => ({ ...c, to: c.to === 'c' ? 'k' : c.to })), C('s/rows', 'k/data')]).nodes.find((n) => n.id === 'k');
  assert.deepEqual(column.warnings?.filter((w) => w.row === 'data').map((w) => w.words), ['Data is not used: a column is tested, so Pass and Fail split its rows']);
});

test('And and Or take anything; their True 1 or 0; And\'s Pass is the rows in every input, Or\'s in any, Fail the rest (Will)', () => {
  const counts = [3, 0, 5].map((n, i) => N(`n${i}`, 'value', { type: 'integer', value: n }));
  const joins = [N('or', 'condition', { type: 'or' }), N('and', 'condition', { type: 'and' })];
  const sim = simulateGraph(graphOf([...counts, ...joins], counts.flatMap((n) => [C(`${n.id}/value`, 'or'), C(`${n.id}/value`, 'and')])), {});
  // An Or of 3, 0 and 5 is True, an And of them is not: values alone are ONE truth, so the way taken sends the first value.
  assert.deepEqual([out(sim, 'or', 'or/true').value, out(sim, 'and', 'and/true').value], [1, 0]);
  assert.deepEqual(['or/pass', 'or/fail', 'and/pass', 'and/fail'].map((s) => out(sim, s.split('/')[0], s)).map((o) => o.notTaken ? 'not taken' : o.value), [3, 'not taken', 'not taken', 3]);
  // Two tests' Pass: active is 1 and 2, Free is 1 and 3.
  const tests = [...users, N('p', 'field', { field: 'plan' }), N('a', 'condition', { type: 'eq', b: 'active' }), N('fr', 'condition', { type: 'eq', b: 'Free' }), ...joins];
  const wires = [C('s/rows', 'f'), C('s/rows', 'p'), C('f/field', 'a'), C('p/field', 'fr'), ...['a/pass', 'fr/pass'].flatMap((x) => [C(x, 'and'), C(x, 'or')])];
  const run = simulateGraph(graphOf(tests, wires), { users: rows });
  const ids = (id, socket) => out(run, id, `${id}/${socket}`).rows.map((r) => r.id);
  assert.deepEqual([ids('and', 'pass'), ids('and', 'fail'), ids('or', 'pass'), ids('or', 'fail')], [[1], [2, 3], [1, 2, 3], []]);
});

test('Branch\'s old jobs, as tests: "Any at risk?" is Is empty on a Pass, once; At least N is a Count into Greater or equal', () => {
  // Is empty on the rows a test passes is ONE value: its Pass sends all its Data once, only where none passed.
  const any = (b) => {
    const sim = simulateGraph(graphOf([...users, N('c', 'condition', { type: 'eq', b }), N('e', 'condition', { type: 'empty' })], [...toStatus, C('c/pass', 'e'), C('s/rows', 'e/data')]), { users: rows });
    return [out(sim, 'e', 'e/pass').notTaken ? 'not taken' : out(sim, 'e', 'e/pass').rows.length, out(sim, 'e', 'e/fail').notTaken ? 'not taken' : out(sim, 'e', 'e/fail').rows.length];
  };
  assert.deepEqual([any('active'), any('gone')], [['not taken', 3], [3, 'not taken']]);
  const atLeast = (n) => {
    const sim = simulateGraph(graphOf([...users, N('c', 'condition', { type: 'eq', b: 'active' }), N('m', 'math', { type: 'count' }), N('k', 'condition', { type: 'gte', b: n })],
      [...toStatus, C('c/pass', 'm/rows'), C('m/result', 'k'), C('s/rows', 'k/data')]), { users: rows });
    return out(sim, 'k', 'k/pass').notTaken ? 'no' : 'yes';
  };
  assert.deepEqual([atLeast(2), atLeast(3)], ['yes', 'no']);
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

test('the Boolean passes on what comes in where it is true — above 0, true, not empty — else the route stops (Will, plan 971 §9)', () => {
  const kind = NODE_KINDS.boolean;
  assert.deepEqual([kind.heading, kind.category, kind.input, kind.output, kind.passes, kind.rows.length], ['Boolean', 'Logic', 'any', 'object', true, 0]);
  // A Value of each kind in: the same out, or Not taken; what it feeds runs only where it went on.
  const run = (type, value) => {
    const sim = simulateGraph(graphOf([N('v', 'value', { type, value }), N('b', 'boolean'), N('o', 'response', { type: 'toast' })], [C('v/value', 'b'), C('b', 'o')]), {});
    const said = out(sim, 'b', 'b');
    return [said.notTaken ? 'not taken' : said.value, !!sim.nodes.o.notTaken];
  };
  assert.deepEqual(run('integer', '1'), [1, false]);
  assert.deepEqual(run('integer', '0'), ['not taken', true]);
  assert.deepEqual(run('integer', '-1'), ['not taken', true]);
  assert.deepEqual(run('text', 'ok'), ['ok', false]);
  assert.deepEqual(run('boolean', 'false'), ['not taken', true]);
  // Rows: some go on, none stop.
  const rowsIn = (b) => simulateGraph(graphOf([...users, N('c', 'condition', { type: 'eq', b }), N('g', 'boolean')], [...toStatus, C('c/pass', 'g')]), { users: rows });
  assert.deepEqual(out(rowsIn('active'), 'g', 'g').rows.map((r) => r.id), [1, 2]);
  assert.equal(out(rowsIn('gone'), 'g', 'g').notTaken, true);
  // Drawn as what comes in: a value, or rows (an object).
  const drawn = (from, extra = []) => graphOf([...users, N('v', 'value', { type: 'integer', value: '5' }), N('c', 'condition', { type: 'eq', b: 'active' }), N('g', 'boolean'), ...extra], [...toStatus, C(from, 'g')]).nodes.find((n) => n.id === 'g').output;
  assert.deepEqual([drawn('v/value'), drawn('c/pass')], ['value', 'object']);
});
