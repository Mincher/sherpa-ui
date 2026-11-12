/**
 * A TOP GRAPH STARTS AT ITS START (Will, plan 949: D1 A, D2 A, D3 B). Every top graph has a Start, always there, placed
 * each time and never kept: each Trigger joins it by its header's True; it sends nothing. A Trigger not joined warns; only
 * a Trigger's header may join it. A graph with a Group Input or Output has none. A type may say its entities are not
 * reusable (a Coworker): no node is made of one, and a graph that places one is refused.
 *
 *   node --test test/unit/a-top-graph-starts-at-its-start.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { schemaCheck } from '../../scripts/lib/schema-check.mjs';

const core = new URL('../../dist/core/data/', import.meta.url);
const { START, hasStart, withStart, withoutStart } = await import(new URL('node-start.js', core));
const { nodeWidth, workflowFaults, workflowGraph } = await import(new URL('workflow.js', core));
const { simulateGraph } = await import(new URL('node-simulate.js', core));
const { innerOf } = await import(new URL('node-library.js', core));
const { libraryOf, registerEntityType } = await import(new URL('entity-types.js', core));
const { entityFaults, graphWorkflow } = await import(new URL('entity-check.js', core));
const { onReport } = await import(new URL('report.js', core));

const trigger = (id, x, y, type = 'schedule') => ({ id, kind: 'trigger', x, y, values: { type } });
const flow = (nodes, connections = []) => ({ v: 3, id: 'w', nodes: [...nodes, { id: 'o', kind: 'result', x: 900, y: 0 }], connections });
const start = (g) => g.nodes.find((n) => n.id === START);

test('every top graph draws its Start, last, left of its nodes; it is never kept', () => {
  const g = flow([{ id: 's', kind: 'source', x: 0, y: 40, values: { store: 'users' } }]);
  const drawn = workflowGraph(g);
  assert.deepEqual([drawn.nodes.at(-1).id, drawn.nodes.at(-1).heading, start(drawn).x, start(drawn).y], [START, 'Start', -360, 0]);
  assert.deepEqual([start(drawn).input, start(drawn).many, start(drawn).output, start(drawn).rows], ['boolean', true, undefined, []]);
  assert.equal(start(g), undefined, 'the workflow keeps no Start');
  assert.deepEqual(withoutStart(withStart(g, nodeWidth)), g);
  assert.equal(withStart(withStart(g, nodeWidth), nodeWidth).nodes.filter((n) => n.id === START).length, 1);
});

test('each Trigger joins it by its header; the Start stands right of them, at their middle; no fault, and the schema takes it', () => {
  const g = flow([trigger('a', 0, 0), trigger('b', 0, 200, 'ui')], [{ from: 'a', to: START }, { from: 'b', to: START }]);
  assert.deepEqual(workflowFaults(g), []);
  assert.deepEqual(schemaCheck('workflow.v3.json')(g), []);
  assert.deepEqual([start(withStart(g, nodeWidth)).x, start(withStart(g, nodeWidth)).y], [360, 100]);
  assert.deepEqual(workflowGraph(g).nodes.flatMap((n) => n.warnings ?? []), []);
});

test('a Trigger not joined warns; only a Trigger, by its header, may join the Start', () => {
  const lone = workflowGraph(flow([trigger('a', 0, 0)]));
  assert.deepEqual(lone.nodes.find((n) => n.id === 'a').warnings, [{ words: 'Connect it to the Start' }]);
  const source = { id: 's', kind: 'source', x: 0, y: 300, values: { store: 'users' } };
  assert.ok(workflowFaults(flow([source], [{ from: 's/rows', to: START }])).includes(`the connection "s/rows" → "${START}": only a Trigger joins the Start, by its header`));
  assert.ok(workflowFaults(flow([trigger('a', 0, 0, 'action')], [{ from: 'a/by', to: START }])).some((f) => /only a Trigger joins the Start/.test(f)));
});

test('a graph with a Group Input or Output has no Start: a Custom Node\'s body is entered by them', () => {
  const library = { v: 1, nodes: { org: { v: 1, label: 'Org', inputs: [{ name: 'rows', label: 'Rows', type: 'object' }], outputs: [], nodes: [{ id: 'f', kind: 'field', x: 0, y: 0, values: { field: 'role' } }], connections: [{ from: '#in/rows', to: 'f' }] } } };
  const inner = innerOf({ id: 'use', kind: 'org' }, library).workflow;
  assert.deepEqual([hasStart(inner), inner.nodes.map((n) => n.id)], [false, ['#in', 'f']]);
  assert.equal(start(workflowGraph(inner, {}, innerOf({ id: 'use', kind: 'org' }, library).kinds)), undefined);
});

test('Simulate: a Trigger\'s header sends True; the Start says what would start it, and runs no step', () => {
  const one = simulateGraph(workflowGraph(flow([trigger('a', 0, 0)], [{ from: 'a', to: START }])), {});
  assert.deepEqual([one.faults, one.nodes[START].would, one.nodes.a.outgoing.find((s) => s.socket === 'a').value], [[], 'Would start on its schedule', 1]);
  const two = simulateGraph(workflowGraph(flow([trigger('a', 0, 0), trigger('b', 0, 200, 'ui')], [{ from: 'a', to: START }, { from: 'b', to: START }])), {});
  assert.equal(two.nodes[START].would, 'Would start when one of its 2 Triggers fires');
  assert.equal(START in simulateGraph(workflowGraph(flow([])), {}).nodes, false, 'nothing joins it: no line');
});

test('a type that is not reusable makes no node: the panel has none, and a graph that places one is refused', () => {
  const stop = onReport(() => {});
  const undo = registerEntityType({ id: 'teammate', label: 'Teammate', reusable: false });
  try {
    assert.equal(registerEntityType({ id: 'odd', label: 'Odd', reusable: 'no' }), undefined, 'reusable is true or false');
    assert.deepEqual(schemaCheck('node-type.v1.json')({ label: 'Teammate', reusable: false }), []);
    const mate = { v: 2, type: 'teammate', id: 'ana', label: 'Ana', graph: { nodes: [trigger('when', 0, 0)], connections: [{ from: 'when', to: START }] } };
    assert.deepEqual(Object.keys(libraryOf([mate]).nodes), []);
    // Its own graph has no Group Input or Output, so it has a Start: the Trigger joined to it is no fault.
    assert.deepEqual(entityFaults(mate), []);
    assert.deepEqual(graphWorkflow(mate).workflow.nodes.map((n) => n.id), ['when']);
    const other = { v: 2, type: 'teammate', id: 'bo', label: 'Bo', graph: { nodes: [{ id: 'x', kind: 'teammate:ana', x: 0, y: 0 }] } };
    assert.ok(entityFaults(other, { entities: [mate] }).includes('the Teammate "bo" places "x", a Teammate, which is not reusable'));
  } finally {
    undo?.();
    stop();
  }
});
