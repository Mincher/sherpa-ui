/**
 * RESULTS AND COUNT NEED ROWS: a node's Results (the rows that pass) and Count (how many) say rows, so where only a value,
 * or a test of one, reaches its header, they have nothing to say and hide (`idle`). Rows, or a Field's column, through
 * any chain of tests, and they show; nothing joined, they show. One a connection still leaves stays, and its node says
 * why. Every other property always shows. Will, TODO 924 (D1 A)
 *
 *   node --test test/unit/results-and-count-need-rows.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const core = new URL('../../dist/core/data/', import.meta.url);
const { workflowGraph } = await import(new URL('workflow.js', core));

const N = (id, kind, values) => ({ id, kind, x: 0, y: 0, ...(values ? { values } : {}) });
const graphOf = (nodes, connections) => workflowGraph({ v: 3, id: 'p', nodes, connections });
const idle = (g, id) => g.nodes.find((n) => n.id === id).rows.filter((r) => r.idle).map((r) => r.name);
const words = (g, id) => (g.nodes.find((n) => n.id === id).warnings ?? []).map((w) => `${w.row ?? ''}: ${w.words}`);

// A Source's rows, a Field's column, and the Field's Count.
const source = [N('s', 'source', { store: 'users' }), N('f', 'field', { field: 'status' })];
const fromSource = [{ from: 's/rows', to: 'f' }];

test('Will\'s case: a Count into a Condition\'s header is one test, True or False — its Results and Count hide', () => {
  const g = graphOf([...source, N('c', 'condition', { type: 'gt', b: '0' })], [...fromSource, { from: 'f/count', to: 'c' }]);
  assert.deepEqual(idle(g, 'c'), ['rows', 'count']);
  assert.deepEqual(words(g, 'c'), []);
});

test('a Field\'s column in, and they show; nothing joined, they show', () => {
  const g = graphOf([...source, N('c', 'condition', { type: 'eq', b: 'active' }), N('lone', 'condition')], [...fromSource, { from: 'f/field', to: 'c' }]);
  assert.deepEqual(idle(g, 'c'), []);
  assert.deepEqual(idle(g, 'lone'), []);
});

test('through a chain of tests: an And of tests over rows shows them; an And of tests of one value hides them', () => {
  const nodes = [
    ...source, N('n', 'value', { type: 'integer', value: 3 }),
    N('byRows', 'condition', { type: 'eq', b: 'active' }), N('byValue', 'condition', { type: 'gt', b: '1' }), N('alsoValue', 'condition', { type: 'lt', b: '9' }),
    N('mixed', 'condition', { type: 'and' }), N('values', 'condition', { type: 'and' }),
  ];
  const g = graphOf(nodes, [
    ...fromSource, { from: 'f/field', to: 'byRows' }, { from: 'n/value', to: 'byValue' }, { from: 'n/value', to: 'alsoValue' },
    { from: 'byRows', to: 'mixed' }, { from: 'byValue', to: 'mixed' },
    { from: 'byValue', to: 'values' }, { from: 'alsoValue', to: 'values' },
  ]);
  assert.deepEqual(idle(g, 'byValue'), ['rows', 'count']);
  assert.deepEqual(idle(g, 'mixed'), []);
  assert.deepEqual(idle(g, 'values'), ['rows']);
});

test('one a connection still leaves stays, and its node says why it sends nothing (D1 A)', () => {
  const g = graphOf(
    [...source, N('c', 'condition', { type: 'gt', b: '0' }), N('sorted', 'sort', { direction: 'asc' })],
    [...fromSource, { from: 'f/count', to: 'c' }, { from: 'c/rows', to: 'sorted' }],
  );
  assert.deepEqual(idle(g, 'c'), ['rows', 'count']);
  assert.deepEqual(words(g, 'c'), ['rows: Results has no rows: a value comes in']);
});

test('every other property always shows: a Source\'s, a Math Result, an AI Answer, an Output\'s', () => {
  const g = graphOf([
    N('s', 'source', { store: 'users' }), N('m', 'math', { type: 'add' }), N('q', 'prompt', { type: 'data' }), N('o', 'output', { type: 'toast' }),
    N('n', 'value', { type: 'integer', value: 1 }),
  ], [{ from: 'n/value', to: 'q' }, { from: 'n/value', to: 'o' }, { from: 'n/value', to: 'm/a' }]);
  for (const id of ['s', 'm', 'q', 'o']) assert.deepEqual(idle(g, id), [], id);
});
