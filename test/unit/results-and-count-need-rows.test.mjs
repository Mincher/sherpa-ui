/**
 * RESULTS NEED ROWS: a node's Results say rows, so where only a value reaches its header, they have nothing to say and hide
 * (`idle`). A test's Pass and Fail never hide: on a column they split its rows; on ONE value they send its Data, else the
 * value (plan 971 §9). Nothing joined, they show. No node has a Count row now: a Math Count counts rows (plan 944), and a
 * test has no True (plan 971 §9). Results a connection still leaves stay, and their node says why. Every other property always shows.
 * Will, TODO 924 (D1 A)
 *
 *   node --test test/unit/results-and-count-need-rows.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const core = new URL('../../dist/core/data/', import.meta.url);
const { workflowGraph } = await import(new URL('workflow.js', core));
const { NODE_KINDS, ROWS } = await import(new URL('node-kinds.js', core));

const N = (id, kind, values) => ({ id, kind, x: 0, y: 0, ...(values ? { values } : {}) });
const graphOf = (nodes, connections) => workflowGraph({ v: 3, id: 'p', nodes, connections });
const idle = (g, id) => g.nodes.find((n) => n.id === id).rows.filter((r) => r.idle).map((r) => r.name);
const words = (g, id) => (g.nodes.find((n) => n.id === id).warnings ?? []).map((w) => `${w.row ?? ''}: ${w.words}`);

// A Source's rows, a Field's column, and a Math Count of the rows (plan 944).
const source = [N('s', 'source', { store: 'users' }), N('f', 'field', { field: 'status' }), N('m', 'math', { type: 'count' })];
const fromSource = [{ from: 's/rows', to: 'f' }, { from: 's/rows', to: 'm/rows' }];

test('Will\'s case: a Count into a Condition\'s header is ONE test — its Pass and Fail show, and send its Data, else the Count (plan 971 §9)', () => {
  const g = graphOf([...source, N('c', 'condition', { type: 'gt', b: '0' })], [...fromSource, { from: 'm/result', to: 'c' }]);
  assert.deepEqual(idle(g, 'c'), []);
  assert.deepEqual(words(g, 'c'), []);
});

test('a Field\'s column in, and they show; nothing joined, they show', () => {
  const g = graphOf([...source, N('c', 'condition', { type: 'eq', b: 'active' }), N('lone', 'condition')], [...fromSource, { from: 'f/field', to: 'c' }]);
  assert.deepEqual(idle(g, 'c'), []);
  assert.deepEqual(idle(g, 'lone'), []);
});

test('through a chain: a test\'s Pass and Fail show, an And of rows or of one value\'s Passes, an Or of numbers (plan 971 §9)', () => {
  const nodes = [
    ...source, N('n', 'value', { type: 'integer', value: 3 }),
    N('byRows', 'condition', { type: 'eq', b: 'active' }), N('byValue', 'condition', { type: 'gt', b: '1' }), N('alsoValue', 'condition', { type: 'lt', b: '9' }),
    N('mixed', 'condition', { type: 'and' }), N('values', 'condition', { type: 'and' }), N('counts', 'condition', { type: 'or' }),
  ];
  const g = graphOf(nodes, [
    ...fromSource, { from: 'f/field', to: 'byRows' }, { from: 'n/value', to: 'byValue' }, { from: 'n/value', to: 'alsoValue' },
    // Rows go by Pass; a test of one value's Pass sends the value (plan 971 §9).
    { from: 'byRows/pass', to: 'mixed' }, { from: 'byValue/pass', to: 'mixed' },
    { from: 'byValue/pass', to: 'values' }, { from: 'alsoValue/pass', to: 'values' },
    { from: 'm/result', to: 'counts' }, { from: 'n/value', to: 'counts' },
  ]);
  // A value in, or numbers, or one value's Passes: one value, so Pass and Fail send it on. Rows in: they split them.
  for (const id of ['byValue', 'mixed', 'values', 'counts']) assert.deepEqual(idle(g, id), [], id);
});

test('Results a connection still leaves stay, and their node says why they send nothing (D1 A)', () => {
  // An app's kind: anything on its header, its Results out.
  const kinds = { ...NODE_KINDS, keep: { heading: 'Keep', icon: 'flag', input: 'any', rows: [ROWS], model: 'keep', graphs: ['workflow'] } };
  const of = (connections) => workflowGraph({ v: 3, id: 'p', nodes: [...source, N('k', 'keep'), N('then', 'organise')], connections }, {}, kinds);
  assert.deepEqual(idle(of([...fromSource, { from: 'm/result', to: 'k' }]), 'k'), ['rows']);
  const left = of([...fromSource, { from: 'm/result', to: 'k' }, { from: 'k/rows', to: 'then' }]);
  assert.deepEqual([idle(left, 'k'), words(left, 'k')], [['rows'], ['rows: Results has no rows: a value comes in']]);
});

test('every other property always shows: a Source\'s, a Math Result, an AI Answer, an Output\'s', () => {
  const g = graphOf([
    N('s', 'source', { store: 'users' }), N('m', 'math', { type: 'add' }), N('q', 'prompt', { type: 'data' }), N('o', 'response', { type: 'toast' }),
    N('n', 'value', { type: 'integer', value: 1 }),
  ], [{ from: 'n/value', to: 'q' }, { from: 'n/value', to: 'o' }, { from: 'n/value', to: 'm/a' }]);
  for (const id of ['s', 'm', 'q', 'o']) assert.deepEqual(idle(g, id), [], id);
});
