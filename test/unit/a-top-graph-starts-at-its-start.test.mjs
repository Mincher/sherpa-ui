/**
 * A TOP GRAPH STARTS AT ITS START (Will, plan 949: D1 A, D2 A, D3 B). Every top graph has a Start, always there: added
 * where it has none, then kept as any node (TODO 955). Each Trigger joins it by its header's True; it sends nothing. A Trigger not joined warns; only
 * a Trigger's header may join it. A graph with a Group Input or Output has none. A type may say its entities are not
 * reusable (a Coworker): no node is made of one, and a graph that places one is refused.
 *
 *   node --test test/unit/a-top-graph-starts-at-its-start.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { schemaCheck } from '../../scripts/lib/schema-check.mjs';

const core = new URL('../../dist/core/data/', import.meta.url);
const { START, hasStart, withStart } = await import(new URL('node-start.js', core));
const { nodeWidth, workflowFaults, workflowGraph } = await import(new URL('workflow.js', core));
const { simulateGraph } = await import(new URL('node-simulate.js', core));
const { innerOf } = await import(new URL('node-library.js', core));
const { libraryOf, registerEntityType } = await import(new URL('entity-types.js', core));
const { entityFaults, graphWorkflow } = await import(new URL('entity-check.js', core));
const { onReport } = await import(new URL('report.js', core));

const trigger = (id, x, y, type = 'schedule') => ({ id, kind: 'trigger', x, y, values: { type } });
const flow = (nodes, connections = []) => ({ v: 3, id: 'w', nodes: [...nodes, { id: 'o', kind: 'result', x: 900, y: 0 }], connections });
const start = (g) => g.nodes.find((n) => n.id === START);

test('every top graph has its Start, last, left of its nodes where it had none; then it is kept, and stays where it is kept (955)', () => {
  const g = flow([{ id: 's', kind: 'source', x: 0, y: 40, values: { store: 'users' } }]);
  const drawn = workflowGraph(g);
  assert.deepEqual([drawn.nodes.at(-1).id, drawn.nodes.at(-1).heading, start(drawn).x, start(drawn).y], [START, 'Start', -360, 0]);
  // An output too, for its drawn lines to the Sources, which are never kept (Will).
  assert.deepEqual([start(drawn).input, start(drawn).many, start(drawn).output, start(drawn).rows.map((r) => r.name)], ['boolean', true, 'boolean', ['model']]);
  // Added once; kept as any node after, where it was put: a second pass moves it not, nor adds one.
  const kept = withStart(g, nodeWidth);
  assert.deepEqual([start(kept).x, start(kept).y], [-360, 0]);
  const moved = { ...kept, nodes: kept.nodes.map((n) => (n.id === START ? { ...n, x: 900, y: 500 } : n)) };
  assert.equal(withStart(moved, nodeWidth), moved);
  assert.deepEqual(workflowGraph(moved).nodes.filter((n) => n.id === START).map((n) => [n.x, n.y]), [[900, 500]]);
  // Kept, the schemas take it, as a workflow's node and an entity's.
  assert.deepEqual(schemaCheck('workflow.v3.json')(moved), []);
  assert.deepEqual(schemaCheck('entity.v3.json')({ v: 3, type: 'node', id: 'g', label: 'G', graph: { nodes: moved.nodes, connections: moved.connections }, settings: { inputs: [], outputs: [] } }), []);
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
  const undo = registerEntityType({ id: 'teammate', label: 'Teammate', graph: { reusable: false } });
  try {
    assert.equal(registerEntityType({ id: 'odd', label: 'Odd', graph: { reusable: 'no' } }), undefined, 'reusable is true or false');
    assert.deepEqual(schemaCheck('type.v1.json')({ v: 1, id: 'teammate', label: 'Teammate', graph: { reusable: false } }), []);
    const mate = { v: 3, type: 'teammate', id: 'ana', label: 'Ana', graph: { nodes: [trigger('when', 0, 0)], connections: [{ from: 'when', to: START }] } };
    assert.deepEqual(Object.keys(libraryOf([mate]).nodes), []);
    // Its own graph has no Group Input or Output, so it has a Start: the Trigger joined to it is no fault, and the schema takes it.
    assert.deepEqual(entityFaults(mate), []);
    assert.deepEqual(schemaCheck('entity.v3.json')(mate), []);
    assert.deepEqual(graphWorkflow(mate).workflow.nodes.map((n) => n.id), ['when']);
    const other = { v: 3, type: 'teammate', id: 'bo', label: 'Bo', graph: { nodes: [{ id: 'x', kind: 'teammate:ana', x: 0, y: 0 }] } };
    assert.ok(entityFaults(other, { entities: [mate] }).includes('the Teammate "bo" places "x", a Teammate, which is not reusable'));
  } finally {
    undo?.();
    stop();
  }
});

test('Unfurl lays out Trigger › Start › Source by the flow: the Start a node, its drawn lines a hop each (Will, TODO 955)', async () => {
  const { unfurlNodes } = await import(new URL('node-unfurl.js', core));
  // As the editor hands it: the Start kept, out of line; the Trigger joined to it; its line to the Source a hop.
  const nodes = [
    { id: 's', kind: 'source', x: 420, y: -416 }, { id: 'o', kind: 'result', x: 900, y: 0 },
    { id: 't', kind: 'trigger', x: 8, y: -416 }, { id: START, kind: START, x: 368, y: -198 },
  ];
  const boxes = Object.fromEntries(nodes.map((n) => [n.id, { w: 240, h: 120 }]));
  const placed = unfurlNodes({ nodes, connections: [{ from: 't', to: START }, { from: 's/rows', to: 'o' }], hops: [{ from: START, to: 's' }], bands: { s: 'left', o: 'right' } }, nodes.map((n) => n.id), { gapX: 120, gapY: 40, grid: 4, boxes });
  const x = (id) => placed.nodes[id].x;
  assert.ok(x('t') + 240 <= x(START) && x(START) + 240 <= x('s') && x('s') + 240 <= x('o'), JSON.stringify(placed.nodes));
});
