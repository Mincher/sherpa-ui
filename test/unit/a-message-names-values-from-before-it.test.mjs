/**
 * A MESSAGE NAMES VALUES FROM BEFORE IT: `{node.name}` in a message field is a value of a node its connections come from — a
 * row or property it sends, or a field of the rows a Source sends. One no connection gives is a warning on its row; the Preview
 * puts each value in. Plan 891, step 2.
 *
 *   node --test test/unit/a-message-names-values-from-before-it.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const core = new URL('../../dist/core/data/', import.meta.url);
const { NODE_KINDS } = await import(new URL('node-kinds.js', core));
const { filled, unreachedValues, valuesAt, valuesIn } = await import(new URL('node-messages.js', core));
const { workflowGraph } = await import(new URL('workflow.js', core));

const fieldsOf = { users: { name: { label: 'Name', type: 'string' }, seats: { label: 'Seats', type: 'number' } } };
const nodes = [
  { id: 's', kind: 'source', x: 0, y: 0, heading: 'Customers', values: { store: 'users' } },
  { id: 'n', kind: 'math', x: 300, y: 0, values: { type: 'add', a: 1, b: 2 } },
  { id: 'f', kind: 'output', x: 600, y: 0, values: { type: 'file' } },
  { id: 'o', kind: 'output', x: 900, y: 0, values: { type: 'notification', message: 'Hi {s.name}, {n.result} seats; see {f.link}' } },
  { id: 'lone', kind: 'value', x: 0, y: 400, values: { value: 'x' } },
];
const connections = [{ from: 's/rows', to: 'n' }, { from: 'n/result', to: 'f/data' }, { from: 'f/file', to: 'o' }];
const flow = (message, more = {}) => ({ v: 3, id: 'w', nodes: nodes.map((n) => (n.id === 'o' ? { ...n, values: { ...n.values, message } } : n)), connections, ...more });
const warningsOf = (g) => g.nodes.find((n) => n.id === 'o').warnings ?? [];

test('a text names its values in order, each a node and a name', () => {
  assert.deepEqual(valuesIn('Hi {s.name}, {n.result}').map((p) => [p.key, p.node, p.name, p.at]), [['{s.name}', 's', 'name', 3], ['{n.result}', 'n', 'result', 13]]);
  assert.deepEqual(valuesIn('no values, {not one}, {}'), []);
  assert.deepEqual(valuesIn(42), []);
});

test('the values a node can name: each node before it, nearest first; its rows and properties, a Source\'s fields', () => {
  const at = valuesAt(nodes, connections, 'o', NODE_KINDS, fieldsOf);
  assert.deepEqual(at.map((s) => s.node), ['f', 'n', 's'], 'nearest first; the lone Value is no connection\'s');
  assert.deepEqual(at.find((s) => s.node === 'f').values.map((v) => v.key), ['{f.file}', '{f.link}']);
  assert.deepEqual(at.find((s) => s.node === 'n').values.map((v) => [v.key, v.label]), [['{n.result}', 'Result']]);
  // A Source: its Count, then its store's fields; Results, a set of rows, is no value a message can say.
  assert.deepEqual(at.find((s) => s.node === 's').values.map((v) => [v.key, v.of]), [['{s.count}', 'number'], ['{s.name}', 'string'], ['{s.seats}', 'number']]);
  assert.equal(at.find((s) => s.node === 's').heading, 'Customers');
});

test('a value no connection gives warns on its row; one that is given does not', () => {
  assert.deepEqual(warningsOf(workflowGraph(flow('Hi {s.name}, {n.result} seats; see {f.link}'), { fieldsOf })), []);
  const words = warningsOf(workflowGraph(flow('{lone.value} and {s.nope} and {gone.x}'), { fieldsOf })).map((w) => [w.row, w.words]);
  assert.deepEqual(words, [
    ['message', '"{lone.value}" has no value here: no connection brings Value to this node'],
    ['message', '"{s.nope}" has no value here: Customers sends no "nope"'],
    ['message', '"{gone.x}" names no node'],
  ]);
  // With no fields known, a Source takes any field.
  assert.deepEqual(unreachedValues('{s.nope}', valuesAt(nodes, connections, 'o', NODE_KINDS), nodes, NODE_KINDS, false), []);
});

test('the Preview puts each value in; one it does not know stays as written', () => {
  const sample = { '{s.name}': 'Acme', '{n.result}': 3, '{f.link}': undefined, '{s.tags}': ['a', 'b'] };
  assert.equal(filled('Hi {s.name}, {n.result} seats; see {f.link}; {s.tags}', (k) => sample[k]), 'Hi Acme, 3 seats; see {f.link}; a, b');
  assert.equal(filled(undefined, () => 'x'), '');
});
