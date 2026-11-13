/**
 * A GRAPH READS AS STEPS (Will, TODO 959), beside `routeRead`: each stage's steps in order, numbered "stage.place", and
 * where each step's flow goes, a Check's Yes and No apart. The order is the flow's depth, then the place. A link into a
 * row that only carries data (a Check's Data, an AI node's Model) is no flow, and a node that only gives a model is no
 * step; nor are the Start and a Group Input or Output. An app says the words; this is the order and the numbers.
 *
 *   node --test test/unit/a-graph-reads-as-steps.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const core = new URL('../../dist/core/data/', import.meta.url);
const { graphSteps } = await import(new URL('graph-steps.js', core));
const { flowDepths } = await import(new URL('node-routes.js', core));

const N = (id, kind, x, y, stage, values) => ({ id, kind, x, y, ...(stage ? { stage } : {}), ...(values ? { values } : {}) });
/** Find: a Source, its Field, a Condition. Act: a Check that sends Yes to a Prompt and No to the Run result; a Model for
 *  the Prompt; the Start. */
const graph = () => ({
  stages: [{ id: 'find', label: 'Find', x: 0 }, { id: 'act', label: 'Act', x: 1000 }],
  nodes: [
    N('#start', '#start', -300, 0, 'find'), N('s', 'source', 0, 0, 'find', { store: 'devices' }), N('f', 'field', 300, 0, 'find', { field: 'status' }),
    N('cond', 'condition', 600, 0, 'find', { type: 'eq' }), N('c', 'check', 1100, 0, 'act'), N('m', 'model', 1100, 400, 'act', { provider: 'anthropic', model: 'sonnet' }),
    N('q', 'prompt', 1400, 0, 'act'), N('o', 'result', 1700, 0, 'act'),
  ],
  connections: [
    { from: 's/rows', to: 'f' }, { from: 'f/field', to: 'cond' }, { from: 'cond/true', to: 'c' }, { from: 's/rows', to: 'c/data' },
    { from: 'c/yes', to: 'q' }, { from: 'c/no', to: 'o' }, { from: 'm/model', to: 'q/model' }, { from: 'q/answer', to: 'o' },
  ],
});
const brief = (read) => read.map((s) => [s.label, s.steps.map((t) => `${t.number} ${t.node}`)]);

test('each stage\'s steps in the flow\'s order, numbered stage.place; the Start and a Model that only gives a model are no step', () => {
  assert.deepEqual(brief(graphSteps(graph())), [['Find', ['1.1 s', '1.2 f', '1.3 cond']], ['Act', ['2.1 c', '2.2 q', '2.3 o']]]);
});

test('where each step goes, by number; a Check\'s Yes and No apart; the end stops', () => {
  const steps = graphSteps(graph()).flatMap((s) => s.steps);
  const at = (id) => steps.find((t) => t.node === id);
  assert.deepEqual(at('c').branches, { yes: [{ step: '2.2', node: 'q' }], no: [{ step: '2.3', node: 'o' }] });
  assert.deepEqual(at('c').goes, [{ step: '2.2', node: 'q' }, { step: '2.3', node: 'o' }]);
  assert.deepEqual(at('cond').goes, [{ step: '2.1', node: 'c' }]);
  assert.deepEqual(at('o').goes, [{ stop: true }]);
  assert.equal(at('q').branches, undefined);
});

test('a body: a step that sends to the Group Output goes to that output; with no stages, every step is in Stage 1', () => {
  const body = {
    nodes: [N('#in', '#in', -300, 0), N('f', 'field', 0, 0, undefined, { field: 'status' }), N('cond', 'condition', 300, 0, undefined, { type: 'eq' }), N('#out', '#out', 600, 0)],
    connections: [{ from: '#in/rows', to: 'f' }, { from: 'f/field', to: 'cond' }, { from: 'cond/rows', to: '#out/kept' }],
  };
  const read = graphSteps(body);
  assert.deepEqual(brief(read), [['Stage 1', ['1.1 f', '1.2 cond']]]);
  assert.deepEqual(read[0].steps[1].goes, [{ output: 'kept' }]);
});

test('flowDepths: the most links that lead to a node; a loop\'s closing link is left out', () => {
  const { depth, edges } = flowDepths(['a', 'b', 'c'], [['a', 'b'], ['b', 'c'], ['a', 'c'], ['c', 'a']]);
  assert.deepEqual([...depth], [['a', 0], ['b', 1], ['c', 2]]);
  assert.deepEqual(edges, [['a', 'b'], ['b', 'c'], ['a', 'c']]);
});
