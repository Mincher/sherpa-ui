/**
 * ONE MODEL FOR THE WHOLE GRAPH (plan 951): a Model joined to the Start's Model row is the graph's PRIMARY. Every AI node
 * uses it, in the graph and in every Custom Node inside it, unless a Model is joined to its own Model row; it says "From
 * the Start". A graph may go without one: the Start does not warn. `graphModels` lists every model used, the primary
 * first, each with how many AI nodes use it. Will, TODO 951 · docs/history/plan-951-one-model-for-the-graph.md
 *
 *   node --test test/unit/a-graph-has-one-model.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { schemaCheck } from '../../scripts/lib/schema-check.mjs';

const core = new URL('../../dist/core/data/', import.meta.url);
const { workflowGraph, workflowFaults } = await import(new URL('workflow.js', core));
const { START, START_KIND, primaryOf } = await import(new URL('node-start.js', core));
const { graphModels } = await import(new URL('graph-models.js', core));
const { innerOf, useOf } = await import(new URL('node-library.js', core));

const N = (id, kind, values) => ({ id, kind, x: 0, y: 0, ...(values ? { values } : {}) });
const node = (g, id) => g.nodes.find((n) => n.id === id);
const row = (n, name) => n.rows.find((r) => r.name === name);
const words = (g, id) => (node(g, id).warnings ?? []).map((w) => `${w.row ?? ''}: ${w.words}`);

/** A Trigger into the Start; a Model joined to the Start; a Prompt with none of its own, and a Skill with its own. */
const graph = () => ({
  v: 3, id: 'g',
  nodes: [
    N('when', 'trigger'), N(START, START),
    N('main', 'model', { provider: 'anthropic', model: 'sonnet' }), N('fast', 'model', { provider: 'anthropic', model: 'haiku' }),
    N('ask', 'prompt', { prompt: 'Is it late?' }), N('use', 'skill', { skill: 'summarise' }),
  ],
  connections: [{ from: 'when', to: START }, { from: 'main/model', to: `${START}/model` }, { from: 'fast/model', to: 'use/model' }],
});

test('the Start has a Model row a graph may go without; one joined is the primary, and no fault', () => {
  assert.deepEqual(START_KIND.rows.map((r) => [r.name, r.needs, r.optional]), [['model', 'model', true]]);
  assert.deepEqual(primaryOf(graph()), { provider: 'anthropic', model: 'sonnet' });
  assert.deepEqual(workflowFaults(graph()), []);
  // Its schemas take the line into the Start's row: a top workflow's, and an entity's graph (found by the Demos check).
  assert.deepEqual(schemaCheck('workflow.v3.json')(graph()), []);
  assert.deepEqual(schemaCheck('entity.v3.json')({ v: 3, type: 'workflow', id: 'g', label: 'G', graph: { nodes: graph().nodes, connections: graph().connections } }), []);
  const none = { ...graph(), connections: [{ from: 'when', to: START }] };
  assert.equal(primaryOf(none), undefined);
  assert.deepEqual(words(workflowGraph(none), START), []);
});

test('an AI node with no Model of its own uses the primary, and says so; one joined to its own overrides it', () => {
  const g = workflowGraph(graph());
  assert.deepEqual([row(node(g, 'ask'), 'model').value, row(node(g, 'ask'), 'model').hint], ['sonnet', 'From the Start']);
  assert.deepEqual(words(g, 'ask'), []);
  assert.equal(row(node(g, 'use'), 'model').value, 'haiku');
  assert.notEqual(row(node(g, 'use'), 'model').hint, 'From the Start');
  // No primary: it warns.
  const none = workflowGraph({ ...graph(), connections: [{ from: 'when', to: START }] });
  assert.deepEqual(words(none, 'ask'), ['model: Join a Model, here or to the Start']);
});

/** A Custom Node: a Prompt with no Model, and a Runbook fed its Model from the Group Input. */
const ASKS = {
  v: 1, label: 'Asks', inputs: [{ name: 'brain', label: 'Brain', type: 'object' }], outputs: [],
  nodes: [N('inner-ask', 'prompt', { prompt: 'Why?' }), N('inner-run', 'runbook', { instructions: 'Check it' })],
  connections: [{ from: '#in/brain', to: 'inner-run/model' }],
};
const library = () => ({ v: 1, nodes: { asks: structuredClone(ASKS) } });

test('inside a Custom Node, an AI node uses the top graph\'s primary, which the editor gives as a fact; opened alone, the graph that uses it', () => {
  const lib = library();
  const body = innerOf(useOf(lib, 'asks', { id: 'asks-1', x: 0, y: 0 }), lib);
  const inner = workflowGraph(body.workflow, { primary: { provider: 'anthropic', model: 'sonnet' } }, body.kinds);
  assert.deepEqual([row(node(inner, 'inner-ask'), 'model').value, row(node(inner, 'inner-ask'), 'model').hint], ['sonnet', 'From the Start']);
  // Opened alone, it uses the primary of whichever graph uses it, and does not warn; inside a graph with none, it warns.
  const alone = workflowGraph(body.workflow, {}, body.kinds);
  assert.deepEqual([row(node(alone, 'inner-ask'), 'model').hint, words(alone, 'inner-ask')], ['From the graph that uses it', []]);
  const bare = workflowGraph(body.workflow, { primary: null }, body.kinds);
  assert.deepEqual(words(bare, 'inner-ask'), ['model: Join a Model, here or to the Start']);
});

test('graphModels: the primary first, then each other model, with how many AI nodes use it, at any depth', () => {
  const lib = library();
  const top = graph();
  top.nodes.push(useOf(lib, 'asks', { id: 'asks-1', x: 0, y: 0 }));
  top.connections.push({ from: 'fast/model', to: 'asks-1/brain' });
  // The Prompt and the inner Prompt use the primary; the Skill and the inner Runbook (fed Fast through the Group Input) use Fast.
  assert.deepEqual(graphModels(top, lib), [
    { provider: 'anthropic', model: 'sonnet', uses: 2, primary: true },
    { provider: 'anthropic', model: 'haiku', uses: 2 },
  ]);
  // A primary no AI node uses is still first; nothing at all, an empty list.
  const lone = { v: 3, id: 'l', nodes: [N(START, START), N('main', 'model', { provider: 'anthropic', model: 'sonnet' })], connections: [{ from: 'main/model', to: `${START}/model` }] };
  assert.deepEqual(graphModels(lone), [{ provider: 'anthropic', model: 'sonnet', uses: 0, primary: true }]);
  assert.deepEqual(graphModels({ v: 3, id: 'e', nodes: [], connections: [] }), []);
});
