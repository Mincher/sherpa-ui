/**
 * AI NODES: a Model says which provider and model, both (plan 951); a Prompt, a Runbook and a Skill ask it. Each of the three EXPECTS an
 * answer — True/false, Text, Number, Data or List — its Type picker, and its sockets follow: True/false gives a True row,
 * 1 or 0 (plan 944); the rest give an Answer. The app gives the lists (`registerAiCatalog`); Sherpa ships none. With no
 * Model joined and no primary, a node says so; a Model with a pick left blank says so. Simulate asks no model. Will, plan 926 (D1 A, D2 A). A Runbook is its own words:
 * the app's runbooks are nodes of the Runbooks category (plan 936 D1 B).
 *
 *   node --test test/unit/an-ai-node-expects-its-answer.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const core = new URL('../../dist/core/data/', import.meta.url);
const { NODE_KINDS, NODE_CATEGORIES, kindOfNode, paletteOf, nodeKinds } = await import(new URL('node-kinds.js', core));
const { registerAiCatalog, aiCatalog } = await import(new URL('ai-catalog.js', core));
const { workflowGraph } = await import(new URL('workflow.js', core));
const { simulateGraph, lightOf } = await import(new URL('node-simulate.js', core));

const N = (id, kind, values) => ({ id, kind, x: 0, y: 0, ...(values ? { values } : {}) });
const graphOf = (nodes, connections = []) => workflowGraph({ v: 3, id: 'ai', nodes, connections });
const node = (g, id) => g.nodes.find((n) => n.id === id);
const row = (n, name) => n.rows.find((r) => r.name === name);
const CATALOG = {
  providers: { anthropic: { label: 'Anthropic', models: { opus: 'Claude Opus 5.5', sonnet: 'Claude Sonnet 5.5' } }, other: { label: 'Other', models: { m1: 'Model One' } } },
  skills: { summarise: { label: 'Summarise tickets' } },
};
// A Model, and a Prompt asking it.
const asked = (expects, more = {}) => [
  [N('m', 'model', { provider: 'anthropic', model: 'opus' }), N('q', 'prompt', { type: expects, prompt: 'Is it late?', ...more })],
  [{ from: 'm/model', to: 'q/model' }],
];

test('four AI kinds, in the AI category, in workflows only; the panel lists them under AI; no Provider node (plan 951)', () => {
  assert.equal(NODE_KINDS.provider, undefined);
  for (const id of ['model', 'prompt', 'runbook', 'skill']) {
    assert.equal(NODE_KINDS[id].category, 'AI', id);
    assert.deepEqual(NODE_KINDS[id].graphs, ['workflow'], id);
  }
  assert.ok(NODE_CATEGORIES.indexOf('AI') === NODE_CATEGORIES.indexOf('Logic') + 1, 'after Logic');
  const ai = paletteOf(nodeKinds()).find((s) => s.category === 'AI');
  assert.deepEqual(ai.items.map((i) => i.id), ['model', 'prompt', 'runbook', 'skill']);
});

test('Expects is the Type picker of a Prompt, a Runbook and a Skill; its sockets follow the pick', () => {
  for (const id of ['prompt', 'runbook', 'skill']) {
    assert.equal(NODE_KINDS[id].typeLabel, 'Expects', id);
    assert.deepEqual(Object.keys(NODE_KINDS[id].types), ['boolean', 'text', 'number', 'data', 'list', 'category'], id);
  }
  const of = (type) => kindOfNode(NODE_KINDS, { kind: 'prompt', values: { type } });
  // True/false gives a True, 1 or 0; no fork, and no Answer (plan 944).
  assert.equal(of('boolean').branches, undefined);
  assert.deepEqual(of('boolean').rows.filter((r) => r.property).map((r) => [r.name, r.label, r.output, r.gives]), [['true', 'True', 'value', 'number']]);
  // The rest give an Answer, a property, as finely as the pick says.
  const answer = (type) => of(type).rows.find((r) => r.name === 'answer');
  assert.deepEqual([answer('text').output, answer('text').gives], ['value', 'value']);
  assert.deepEqual([answer('number').output, answer('number').gives], ['value', 'number']);
  assert.deepEqual([answer('data').output, answer('data').gives], ['object', 'rows']);
  assert.deepEqual([answer('list').output, answer('list').gives], ['object', 'list']);
  // A Category's Answer is a column it makes, one of its Categories on each row (plan 992 O6).
  assert.deepEqual([answer('category').output, answer('category').gives, answer('category').makes], ['object', 'field', 'categories']);
  assert.ok(!of('text').rows.some((r) => r.name === 'true'));
  // Text is the default.
  assert.equal(kindOfNode(NODE_KINDS, { kind: 'prompt' }).rows.find((r) => r.name === 'answer').gives, 'value');
});

test('the lists are the app\'s: none shipped; a Model lists its own Provider\'s models', () => {
  assert.deepEqual(Object.keys(aiCatalog().providers), [], 'Sherpa ships none');
  const undo = registerAiCatalog(CATALOG);
  try {
    const [nodes, connections] = asked('text');
    const g = graphOf(nodes, connections);
    assert.deepEqual(row(node(g, 'm'), 'provider').choices.map((c) => c.label), ['Anthropic', 'Other']);
    assert.deepEqual(row(node(g, 'm'), 'model').choices.map((c) => c.label), ['Claude Opus 5.5', 'Claude Sonnet 5.5']);
    // Another provider picked: its models.
    nodes[0].values = { provider: 'other', model: '' };
    assert.deepEqual(row(node(graphOf(nodes, connections), 'm'), 'model').choices.map((c) => c.label), ['Pick one', 'Model One']);
    // A Skill lists the app's, then New; a Runbook picks nothing: it is its Model and its Instructions (plan 936 D1 B), and
    // its Retries, a setting (plan 992 O7).
    const r = graphOf([N('r', 'runbook'), N('s', 'skill')]);
    assert.deepEqual(node(r, 'r').rows.map((x) => x.name), ['type', 'retries', 'model', 'instructions', 'answer']);
    assert.deepEqual(row(node(r, 's'), 'skill').choices.map((c) => c.label), ['Pick one', 'Summarise tickets', 'New skill']);
  } finally {
    undo();
  }
  assert.deepEqual(Object.keys(aiCatalog().providers), [], 'undone');
});

test('with no Model joined and no primary an AI node says so; a Model with a pick blank says so; a wrong input reads null and warns', () => {
  const words = (g, id) => (node(g, id).warnings ?? []).map((w) => `${w.row ?? ''}: ${w.words}`);
  const g = graphOf([N('q', 'prompt'), N('m', 'model')]);
  assert.deepEqual(words(g, 'q'), ['model: Join a Model, here or to the Start']);
  assert.deepEqual(words(g, 'm'), ['provider: Pick a provider', 'model: Pick a model']);
  assert.deepEqual(words(graphOf([N('m', 'model', { provider: 'anthropic' })]), 'm'), ['model: Pick a model']);
  // A Value is no model.
  const wrong = graphOf([N('v', 'value', { type: 'text', value: 'opus' }), N('q', 'prompt')], [{ from: 'v/value', to: 'q/model' }]);
  assert.match(words(wrong, 'q').join(), /Model takes a model; it was given/);
  // A Runbook with no instructions has nothing to do.
  const empty = graphOf([N('r', 'runbook')]);
  assert.ok(words(empty, 'r').includes('instructions: Write its instructions'));
  const written = graphOf([N('r', 'runbook', { instructions: 'Check the patches' })]);
  assert.ok(!words(written, 'r').some((w) => w.startsWith('instructions')));
  // Joined, no warning.
  const undo = registerAiCatalog(CATALOG);
  try {
    const [nodes, connections] = asked('text');
    const ok = graphOf(nodes, connections);
    assert.deepEqual([...words(ok, 'q'), ...words(ok, 'm')], []);
  } finally {
    undo();
  }
});

test('Simulate asks no model: it says what it would do, and each answer is a stand-in by its shape', () => {
  const run = (expects) => {
    const [nodes, connections] = asked(expects);
    return simulateGraph(graphOf(nodes, connections), {});
  };
  const out = (sim, socket) => sim.nodes.q.outgoing.find((s) => s.socket === socket);
  const text = run('text');
  assert.equal(text.nodes.q.would, 'Would ask the model');
  assert.match(lightOf(text.nodes.q, 1), /Would ask the model/);
  assert.equal(out(text, 'q/answer').value, 'Answer, simulated');
  assert.equal(out(run('number'), 'q/answer').value, 0);
  assert.deepEqual(out(run('data'), 'q/answer').rows, []);
  assert.deepEqual(out(run('list'), 'q/answer').value, []);
  // True/false: its True is 1, and there is no fork (plan 944).
  const fork = run('boolean');
  assert.equal(out(fork, 'q/true').value, 1);
  assert.deepEqual([out(fork, 'q'), out(fork, 'q/#false')], [undefined, undefined]);
  // A Model sends its pick.
  assert.equal(text.nodes.m.outgoing.find((s) => s.socket === 'm/model').value, 'opus');
});
