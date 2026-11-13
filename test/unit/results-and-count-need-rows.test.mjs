/**
 * RESULTS NEED ROWS: a node's Results (the rows that pass) say rows, so where only a value, or a test of one, reaches its
 * header, they have nothing to say and hide (`idle`). Rows, or a Field's column, through any chain of tests, and they
 * show; nothing joined, they show. No node has a Count row now: a Math Count counts rows, and a test's True is 1 or 0
 * (plan 944). One a connection still leaves stays, and its node says why. Every other property always shows.
 * Will, TODO 924 (D1 A)
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

// A Source's rows, a Field's column, and a Math Count of the rows (plan 944).
const source = [N('s', 'source', { store: 'users' }), N('f', 'field', { field: 'status' }), N('m', 'math', { type: 'count' })];
const fromSource = [{ from: 's/rows', to: 'f' }, { from: 's/rows', to: 'm/rows' }];

test('Will\'s case: a Count into a Condition\'s header is one test, 1 or 0 — its Results hide (plan 944)', () => {
  const g = graphOf([...source, N('c', 'condition', { type: 'gt', b: '0' })], [...fromSource, { from: 'm/result', to: 'c' }]);
  assert.deepEqual(idle(g, 'c'), ['rows']);
  assert.deepEqual(words(g, 'c'), []);
});

test('a Field\'s column in, and they show; nothing joined, they show', () => {
  const g = graphOf([...source, N('c', 'condition', { type: 'eq', b: 'active' }), N('lone', 'condition')], [...fromSource, { from: 'f/field', to: 'c' }]);
  assert.deepEqual(idle(g, 'c'), []);
  assert.deepEqual(idle(g, 'lone'), []);
});

test('through a chain: an And fed a test\'s Results shows them; an And of Trues alone hides them, as an Or of numbers does (plan 944)', () => {
  const nodes = [
    ...source, N('n', 'value', { type: 'integer', value: 3 }),
    N('byRows', 'condition', { type: 'eq', b: 'active' }), N('byValue', 'condition', { type: 'gt', b: '1' }), N('alsoValue', 'condition', { type: 'lt', b: '9' }),
    N('mixed', 'condition', { type: 'and' }), N('values', 'condition', { type: 'and' }), N('counts', 'condition', { type: 'or' }),
  ];
  const g = graphOf(nodes, [
    ...fromSource, { from: 'f/field', to: 'byRows' }, { from: 'n/value', to: 'byValue' }, { from: 'n/value', to: 'alsoValue' },
    // Rows go by Results; a True is 1 or 0, and carries none (plan 944).
    { from: 'byRows/rows', to: 'mixed' }, { from: 'byValue/true', to: 'mixed' },
    { from: 'byValue/true', to: 'values' }, { from: 'alsoValue/true', to: 'values' },
    { from: 'm/result', to: 'counts' }, { from: 'n/value', to: 'counts' },
  ]);
  // A value in: Results hide; no Count to show (plan 944).
  assert.deepEqual(idle(g, 'byValue'), ['rows']);
  assert.deepEqual(idle(g, 'mixed'), []);
  assert.deepEqual(idle(g, 'values'), ['rows']);
  // Numbers in: Results, with no rows, hide.
  assert.deepEqual(idle(g, 'counts'), ['rows']);
});

test('one a connection still leaves stays, and its node says why it sends nothing (D1 A)', () => {
  const g = graphOf(
    [...source, N('c', 'condition', { type: 'gt', b: '0' }), N('sorted', 'organise', { direction: 'asc' })],
    [...fromSource, { from: 'm/result', to: 'c' }, { from: 'c/rows', to: 'sorted' }],
  );
  assert.deepEqual(idle(g, 'c'), ['rows']);
  assert.deepEqual(words(g, 'c'), ['rows: Results has no rows: a value comes in']);
});

test('every other property always shows: a Source\'s, a Math Result, an AI Answer, an Output\'s', () => {
  const g = graphOf([
    N('s', 'source', { store: 'users' }), N('m', 'math', { type: 'add' }), N('q', 'prompt', { type: 'data' }), N('o', 'response', { type: 'toast' }),
    N('n', 'value', { type: 'integer', value: 1 }),
  ], [{ from: 'n/value', to: 'q' }, { from: 'n/value', to: 'o' }, { from: 'n/value', to: 'm/a' }]);
  for (const id of ['s', 'm', 'q', 'o']) assert.deepEqual(idle(g, id), [], id);
});
