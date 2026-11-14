/**
 * AND AND OR TAKE ANY BOOLEAN — Will, 2026-11-05 (TODO 780, 770's decision 1: B): "0/1 or True or False is data."
 * One test per Condition, and And and Or join tests (plan 783 D4): 780's rule, which the Group row kept, is theirs
 * now. A test's Pass brings its whole tree; any other boolean — a True or False, a value that says true or false,
 * 1 or 0 — is a CONSTANT one the graph holds, folded into the group; one only a run gives is named by where it
 * comes from. Since TODO 939 they take ANYTHING else too — rows, a count, a value, each true where it is above zero,
 * true, or not empty — with no warning; it says nothing in a Query's tree. No connection into it is a fault.
 * A Condition has no True: its Pass says its tree, its Fail the opposite (plans 971, 971 §9).
 *
 *   node --test test/unit/and-or-take-any-boolean.test.mjs
 *
 * TRAP T-a-condition-is-a-tree-of-nodes · TRAP T-a-node-reads-null-from-what-it-cannot-use
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const core = new URL('../../dist/core/data/', import.meta.url);
const { truthOf } = await import(new URL('node-input.js', core));
const { workflowFaults, workflowGraph } = await import(new URL('workflow.js', core));
const { nodeFlow } = await import(new URL('node-flow.js', core));
const { connectionRequest } = await import(new URL('query-graph.js', core));

const ACTIVE = { field: 'status', op: 'eq', value: 'active' };
const PRO = { field: 'plan', op: 'eq', value: 'Pro' };
const store = { id: 's', kind: 'source', x: 0, y: 0, values: { store: 'users' } };
/** Status Equals active: Source › Field › Condition. */
const status = [store, { id: 'fs', kind: 'field', x: 200, y: 0, values: { field: 'status' } }, { id: 'active', kind: 'condition', x: 400, y: 0, values: { type: 'eq', b: 'active' } }];
const statusConnections = [{ from: 's/rows', to: 'fs' }, { from: 'fs/field', to: 'active' }];
/** Plan Equals Pro, the same way. */
const plan = [{ id: 'fp', kind: 'field', x: 200, y: 300, values: { field: 'plan' } }, { id: 'pro', kind: 'condition', x: 400, y: 300, values: { type: 'eq', b: 'Pro' } }];
const planConnections = [{ from: 's/rows', to: 'fp' }, { from: 'fp/field', to: 'pro' }];
const value = (v, type) => ({ id: 'v', kind: 'value', x: 0, y: 600, values: { value: v, ...(type ? { type } : {}) } });
/** Status is active, joined by `join` with what `from` sends. */
const flow = (nodes, from, join = 'and', connections = []) => ({
  v: 3, id: 'w',
  nodes: [...status, ...nodes, { id: 'j', kind: 'condition', x: 600, y: 0, values: { type: join } }],
  connections: [...statusConnections, ...connections, { from: 'active/pass', to: 'j' }, { from, to: 'j' }],
});
const read = (w) => {
  const g = workflowGraph(w);
  return { faults: workflowFaults(w), warnings: g.nodes.find((n) => n.id === 'j').warnings, where: nodeFlow(g, 'j').definition?.where };
};

test('a boolean says true or false: true and false, the words, a number — 0 False, any other True (D2, TODO 781); nothing else does', () => {
  for (const [v, want] of [[true, true], [false, false], [1, true], [0, false], ['1', true], ['0', false], ['true', true], [' FALSE ', false], ['True', true], [2, true], [-1, true], [0.5, true], ['2', true]]) {
    assert.equal(truthOf(v), want, JSON.stringify(v));
  }
  for (const v of ['yes', 'no', '', null, undefined, [], {}, ['true'], Number.NaN]) assert.equal(truthOf(v), undefined, JSON.stringify(v));
});

test('every boolean joins And and Or, no fault and no warning: a test\'s Pass and Fail, a Not\'s, a Time\'s Out, a test of one value\'s Pass and Fail, a value that says one, 1 or 0', () => {
  const math = { id: 'm', kind: 'math', x: 0, y: 400 };
  // No False (plan 944): a Not's Pass, or a test of one value's Fail, says the other way (plan 971 §9).
  const not = { id: 'n', kind: 'condition', x: 500, y: 300, values: { type: 'not' } };
  const branch = { id: 'k', kind: 'condition', x: 500, y: 300, values: { type: 'gt', b: 0 } };
  const time = [{ id: 'fj', kind: 'field', x: 200, y: 300, values: { field: 'joined' } }, { id: 't', kind: 'time', x: 400, y: 300, values: { type: 'duration', when: 'last', n: 7, unit: 'day' } }];
  const cases = [
    [plan, 'pro/pass', planConnections], [plan, 'pro/fail', planConnections], [[value('true', 'boolean'), not], 'n/pass', [{ from: 'v/value', to: 'n' }]],
    [time, 't', [{ from: 's/rows', to: 'fj' }, { from: 'fj/field', to: 't' }]],
    [[value('1', 'integer'), branch], 'k/pass', [{ from: 'v/value', to: 'k' }]], [[value('1', 'integer'), branch], 'k/fail', [{ from: 'v/value', to: 'k' }]],
    [[value('true', 'boolean')], 'v/value'], [[value('false', 'boolean')], 'v/value'], [[value('1', 'integer')], 'v/value'], [[value('0', 'integer')], 'v/value'],
    [[value('True')], 'v/value'], [[math], 'm/result'], [[value('2', 'integer')], 'v/value'],
  ];
  for (const join of ['and', 'or']) {
    for (const [nodes, from, connections] of cases) {
      const r = read(flow(nodes, from, join, connections));
      assert.deepEqual([r.faults, r.warnings], [[], undefined], `${join}: ${from}`);
    }
  }
});

test('a test brings its tree; a constant folds — true drops out of And and ends Or, false the other way', () => {
  assert.deepEqual(read(flow(plan, 'pro/pass', 'or', planConnections)).where, { or: [ACTIVE, PRO] });
  assert.deepEqual(read(flow(plan, 'pro/pass', 'and', planConnections)).where, { and: [ACTIVE, PRO] });
  // Its Fail says the opposite (plan 971 A).
  assert.deepEqual(read(flow(plan, 'pro/fail', 'and', planConnections)).where, { and: [ACTIVE, { field: 'plan', op: 'ne', value: 'Pro' }] });
  assert.deepEqual(read(flow([value('true', 'boolean')], 'v/value')).where, ACTIVE, 'Status and true: Status');
  assert.deepEqual(read(flow([value('0', 'integer')], 'v/value')).where, false, 'Status and 0: never');
  assert.deepEqual(read(flow([value('1', 'integer')], 'v/value', 'or')).where, true, 'Status or 1: always');
  assert.deepEqual(read(flow([value('false', 'boolean')], 'v/value', 'or')).where, ACTIVE, 'Status or false: Status');
  // An Or whose own parts fold is a constant in its parent: Status and (Plan or 1) is Status.
  const always = { id: 'any', kind: 'condition', x: 500, y: 300, values: { type: 'or' } };
  const w = flow([...plan, value('1', 'integer'), always], 'any/pass', 'and', [...planConnections, { from: 'pro/pass', to: 'any' }, { from: 'v/value', to: 'any' }]);
  assert.deepEqual(read(w).where, ACTIVE);
  // Only constants: And of true is true; Or of false, false.
  const lone = (v, join) => ({ v: 3, id: 'w', nodes: [value(v, 'integer'), { id: 'j', kind: 'condition', x: 400, y: 0, values: { type: join } }], connections: [{ from: 'v/value', to: 'j' }] });
  assert.equal(read(lone('1', 'and')).where, true);
  assert.equal(read(lone('0', 'or')).where, false);
});

test('a boolean only a run gives is named by where it comes from; a test that says no tree is one, and says why', () => {
  // A comparison of two values: only a run says it; its Pass is a boolean, and why it says no tree stays said.
  const two = [value('Pro'), { id: 'eq', kind: 'condition', x: 300, y: 600, values: { type: 'eq', b: 'Pro' } }];
  const g = workflowGraph(flow(two, 'eq/pass', 'and', [{ from: 'v/value', to: 'eq' }]));
  assert.deepEqual(nodeFlow(g, 'j').definition.where, { and: [ACTIVE, { boolean: 'Condition › Pass' }] });
  // No False now (plan 944): a test of one value's Fail, named by its row (plan 971 §9).
  const branch = { id: 'k', kind: 'condition', x: 500, y: 600, values: { type: 'gt', b: 0 } };
  const off = workflowGraph(flow([...two, branch], 'k/fail', 'and', [{ from: 'v/value', to: 'eq' }, { from: 'eq/pass', to: 'k' }]));
  assert.deepEqual(nodeFlow(off, 'j').definition.where, { and: [ACTIVE, { boolean: 'Condition › Fail' }] });
});

test('anything else joins too (TODO 939): rows, a value, a list — no warning, and nothing in the Query\'s tree; no fault', () => {
  for (const [nodes, from] of [[[], 's/rows'], [[value('yes')], 'v/value'], [[value(['a'], 'list')], 'v/value']]) {
    for (const join of ['and', 'or']) {
      const r = read(flow(nodes, from, join));
      assert.deepEqual(r, { faults: [], warnings: undefined, where: ACTIVE }, `${join}: ${from}`);
    }
  }
});

test('the Query holds no constant: a connection into one of its Condition\'s Group rows is no request it takes', () => {
  const graph = {
    nodes: [
      { id: 'a', kind: 'condition', heading: 'Plan', icon: 'function', rows: [], x: 0, y: 0, ref: { scope: 'data', field: 'plan' } },
      { id: 'b', kind: 'condition', heading: 'Status', icon: 'function', rows: [{ name: 'group-2', label: 'Group', input: 'boolean' }], x: 300, y: 0, ref: { scope: 'data', field: 'status' } },
    ],
    connections: [],
  };
  assert.match(connectionRequest(graph, { from: 'a', to: 'b/group-2' }).refused, /a filter's Pass goes into a chip of View Filters/);
});
