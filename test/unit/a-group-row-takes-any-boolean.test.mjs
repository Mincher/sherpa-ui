/**
 * A GROUP ROW TAKES ANY BOOLEAN — Will, 2026-11-05 (TODO 780, 770's decision 1: B): "0/1 or True or False is
 * data." A Condition's Group row takes a nested Condition's True, which brings its whole tree, or any other
 * boolean: a True or False, a value that says true or false, 1 or 0. One its graph holds is a CONSTANT part —
 * true always holds, false never — folded into its group; one only a run gives is named by where it comes from.
 * Anything else reads null, and the node warns. No route into it is a fault.
 *
 *   node --test test/unit/a-group-row-takes-any-boolean.test.mjs
 *
 * TRAP T-a-condition-is-a-tree-of-nodes · TRAP T-a-node-reads-null-from-what-it-cannot-use
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const core = new URL('../../dist/core/data/', import.meta.url);
const { truthOf } = await import(new URL('node-input.js', core));
const { workflowFaults, workflowGraph } = await import(new URL('workflow.js', core));
const { nodeFlow } = await import(new URL('node-flow.js', core));
const { routeRequest } = await import(new URL('query-graph.js', core));

const ACTIVE = { field: 'status', op: 'eq', value: 'active' };
/** The outer Condition: Status is active, and a Group in its second part, joined by `join`. */
const outer = (join = 'and') => ({ id: 'out', kind: 'condition', x: 400, y: 0, values: { join, field: 'status', op: 'eq', value: 'active' } });
const value = (v, type) => ({ id: 'v', kind: 'value', x: 0, y: 0, values: { value: v, ...(type ? { type } : {}) } });
const flow = (nodes, from, join) => ({ v: 2, id: 'w', nodes: [...nodes, outer(join)], routes: [{ from, to: 'out/group-2' }] });
const read = (w) => {
  const g = workflowGraph(w);
  return { faults: workflowFaults(w), warnings: g.nodes.find((n) => n.id === 'out').warnings, where: nodeFlow(g, 'out').definition?.where };
};

test('a boolean says true or false: true and false, the words, a number — 0 False, any other True (D2, TODO 781); nothing else does', () => {
  for (const [v, want] of [[true, true], [false, false], [1, true], [0, false], ['1', true], ['0', false], ['true', true], [' FALSE ', false], ['True', true], [2, true], [-1, true], [0.5, true], ['2', true]]) {
    assert.equal(truthOf(v), want, JSON.stringify(v));
  }
  for (const v of ['yes', 'no', '', null, undefined, [], {}, ['true'], Number.NaN]) assert.equal(truthOf(v), undefined, JSON.stringify(v));
});

test('every boolean joins a Group row, no fault and no warning: a Condition\'s True, a True, a False, a value that says one, 1 or 0', () => {
  const store = { id: 's', kind: 'store', x: 0, y: 0, values: { store: 'users' } };
  const inner = { id: 'in', kind: 'condition', x: 0, y: 200, values: { field: 'plan', op: 'eq', value: 'Pro' } };
  const math = { id: 'm', kind: 'math', x: 0, y: 400 };
  const cases = [
    [[inner], 'in'], [[store], 's'], [[store], 's/#false'], [[inner], 'in/#false'],
    [[value('true', 'boolean')], 'v/value'], [[value('false', 'boolean')], 'v/value'], [[value('1', 'integer')], 'v/value'], [[value('0', 'integer')], 'v/value'],
    [[value('True')], 'v/value'], [[math], 'm/result'], [[value('2', 'integer')], 'v/value'],
  ];
  for (const [nodes, from] of cases) {
    const r = read(flow(nodes, from));
    assert.deepEqual([r.faults, r.warnings], [[], undefined], from);
  }
});

test('a nested Condition brings its tree; a constant folds — true drops out of All of and ends Any of, false the other way', () => {
  const inner = { id: 'in', kind: 'condition', x: 0, y: 200, values: { field: 'plan', op: 'eq', value: 'Pro' } };
  assert.deepEqual(read(flow([inner], 'in', 'or')).where, { or: [ACTIVE, { field: 'plan', op: 'eq', value: 'Pro' }] });
  assert.deepEqual(read(flow([value('true', 'boolean')], 'v/value')).where, ACTIVE, 'Status and true: Status');
  assert.deepEqual(read(flow([value('0', 'integer')], 'v/value')).where, false, 'Status and 0: never');
  assert.deepEqual(read(flow([value('1', 'integer')], 'v/value', 'or')).where, true, 'Status or 1: always');
  assert.deepEqual(read(flow([value('false', 'boolean')], 'v/value', 'or')).where, ACTIVE, 'Status or false: Status');
  // A nested Condition whose own group folds is a constant in its parent.
  const always = { id: 'in', kind: 'condition', x: 0, y: 200, values: { join: 'or', field: 'plan', op: 'eq', value: 'Pro' } };
  const w = { v: 2, id: 'w', nodes: [value('1', 'integer'), always, outer('and')], routes: [{ from: 'v/value', to: 'in/group-2' }, { from: 'in', to: 'out/group-2' }] };
  assert.deepEqual(read(w).where, ACTIVE, 'Status and (Plan or 1): Status');
  // Only constants: All of true is true; Any of false, false.
  const lone = (v, join) => ({ v: 2, id: 'w', nodes: [value(v, 'integer'), { id: 'out', kind: 'condition', x: 400, y: 0, values: { join } }], routes: [{ from: 'v/value', to: 'out/group' }] });
  assert.equal(read(lone('1', 'and')).where, true);
  assert.equal(read(lone('0', 'or')).where, false);
});

test('a boolean only a run gives is named by where it comes from; the Group row says a constant it holds', () => {
  const store = { id: 's', kind: 'store', x: 0, y: 0, values: { store: 'users' } };
  assert.deepEqual(read(flow([store], 's')).where, { and: [ACTIVE, { boolean: 'Store › True' }] });
  const g = workflowGraph(flow([value('1', 'integer')], 'v/value'));
  assert.equal(g.nodes.find((n) => n.id === 'out').rows.find((r) => r.name === 'group-2').value, 'true', '1 reads as its boolean');
});

test('anything else reads null and warns in words, and says nothing in the tree; no fault', () => {
  const store = { id: 's', kind: 'store', x: 0, y: 0, values: { store: 'users' } };
  for (const [nodes, from, given] of [[[store], 's/rows', 'rows'], [[value('yes')], 'v/value', '"yes"'], [[value(['a'], 'list')], 'v/value', 'a list']]) {
    const r = read(flow(nodes, from));
    assert.deepEqual(r, { faults: [], warnings: [{ row: 'group-2', words: `Group takes a boolean; it was given ${given}` }], where: ACTIVE }, from);
    assert.equal(workflowGraph(flow(nodes, from)).nodes.find((n) => n.id === 'out').rows.find((r) => r.name === 'group-2').value, null);
  }
});

test('the Query holds no constant: a route into one of its Condition\'s Group rows is no request it takes', () => {
  const graph = {
    nodes: [
      { id: 'a', kind: 'condition', heading: 'Plan', icon: 'function', rows: [], x: 0, y: 0, ref: { scope: 'data', field: 'plan' } },
      { id: 'b', kind: 'condition', heading: 'Status', icon: 'function', rows: [{ name: 'group-2', label: 'Group', input: 'boolean' }], x: 300, y: 0, ref: { scope: 'data', field: 'status' } },
    ],
    routes: [],
  };
  assert.match(routeRequest(graph, { from: 'a', to: 'b/group-2' }).refused, /a condition's True goes into a field of a scope/);
});
