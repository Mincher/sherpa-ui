/**
 * A NODE FAMILY IS ONE NODE: a kind with `types` has a first row that picks the type, kept as the
 * node's `type` value; `resolveKind` gives an ordinary kind for it, so nothing else learns of types.
 * A row the new type lacks keeps its VALUE and its ROUTE: the route draws greyed, with a fault in
 * words, and survives a round trip. A kind of one type shows no select. Plan 749 P1.
 *
 *   node --test test/unit/a-node-family-is-one-node.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const core = new URL('../../dist/core/data/', import.meta.url);
const { NODE_KINDS, accepts, fitOf, kindOfNode, resolveKind, rowChoices, socketType, typeChoices } = await import(new URL('node-kinds.js', core));
const { editWorkflow, readWorkflow, staleRoutes, workflowFaults, workflowGraph } = await import(new URL('workflow.js', core));

// A family of our own: P1 ships none but Value.
const a = { name: 'a', label: 'Value A', control: 'number', input: 'value' };
const b = { name: 'b', label: 'Value B', control: 'number', input: 'value' };
const places = { name: 'places', label: 'Places', control: 'number', input: 'value' };
const math = {
  heading: 'Math', icon: 'function', typeLabel: 'Operation', defaultType: 'add', output: 'value', rows: [], model: 'math', graphs: ['workflow'], category: 'Math',
  types: {
    add: { label: 'Add', help: 'Add Value B to Value A', rows: [a, b] },
    round: { label: 'Round', help: 'Rounds a decimal to a set number of places', rows: [places, a, b] },
    compare: { label: 'Compare', rows: [a, b], output: 'boolean' },
  },
};
const lone = { heading: 'Lone', icon: 'flag', rows: [a], model: 'lone', graphs: ['workflow'], types: { only: { label: 'Only' } } };
const kinds = { ...NODE_KINDS, math, lone };
const flow = (type, extra = {}) => ({
  v: 2, id: 'w',
  nodes: [
    { id: 'v', kind: 'value', x: 0, y: 0, values: { value: '2', type: 'number' } },
    { id: 'm', kind: 'math', x: 300, y: 0, values: { ...(type ? { type } : {}), ...extra } },
    { id: 'o', kind: 'output', x: 600, y: 0 },
  ],
  routes: [{ from: 'v/value', to: 'm/places' }],
});
const node = (g, id) => g.nodes.find((n) => n.id === id);
const names = (n) => n.rows.map((r) => r.name);

test('each type draws its rows: the type first, its words and hint, the sockets of the type', () => {
  const add = node(workflowGraph(flow('add'), {}, kinds), 'm');
  assert.deepEqual(names(add), ['type', 'a', 'b']);
  assert.deepEqual([add.rows[0].label, add.rows[0].value, add.rows[0].hint, add.rows[0].editable], ['Operation', 'add', 'Add Value B to Value A', true]);
  assert.deepEqual(add.rows[0].choices.map((c) => c.label), ['Add', 'Round', 'Compare']);
  assert.deepEqual(names(node(workflowGraph(flow('round'), {}, kinds), 'm')), ['type', 'places', 'a', 'b']);
  // No type kept: the default is drawn, and none is written by the drawing.
  assert.equal(node(workflowGraph(flow(), {}, kinds), 'm').rows[0].value, 'add');
  // The header's output follows the type.
  assert.equal(node(workflowGraph(flow('add'), {}, kinds), 'm').output, 'value');
  assert.equal(node(workflowGraph(flow('compare'), {}, kinds), 'm').output, 'boolean');
  // resolveKind is an ordinary kind: no types left on it, and a plain kind is the same one.
  assert.equal(resolveKind(math, 'round').types, undefined);
  assert.equal(resolveKind(NODE_KINDS.condition), NODE_KINDS.condition);
  assert.equal(kindOfNode(kinds, { kind: 'nope' }), undefined);
});

test('a kind of one type shows no select; the Query\'s Condition is unchanged', () => {
  assert.deepEqual(resolveKind(lone).rows.map((r) => r.name), ['a']);
  assert.equal(typeChoices(lone).length, 1);
  assert.equal(NODE_KINDS.condition.types, undefined);
  assert.deepEqual(resolveKind(NODE_KINDS.condition).rows, NODE_KINDS.condition.rows);
  assert.equal(NODE_KINDS.pick.types, undefined);
});

test('accepts follows the type: a boolean out of Compare does not join a value in', () => {
  const into = { v: 2, id: 'w', nodes: [{ id: 'm', kind: 'math', x: 0, y: 0, values: { type: 'compare' } }, { id: 'n', kind: 'math', x: 300, y: 0 }], routes: [{ from: 'm', to: 'n/a' }] };
  assert.equal(socketType(kindOfNode(kinds, into.nodes[0]), undefined, 'output'), 'boolean');
  assert.deepEqual(workflowFaults(into, kinds), ['the route "m" → "n/a" joins a boolean to a value']);
  assert.deepEqual(workflowFaults({ ...into, nodes: [{ ...into.nodes[0], values: { type: 'add' } }, into.nodes[1]] }, kinds), []);
  assert.ok(accepts('value', 'value'));
  // Placing a family from a socket fits its default type.
  assert.deepEqual(fitOf(math, 'value', 'out'), { row: 'a' });
});

test('Round then Add keeps Places: its value waits, and comes back with Round', () => {
  let w = flow('round', { places: 2 });
  w = { ...w, routes: [] };
  w = editWorkflow(w, { node: 'm', row: 'type', value: 'add' }, kinds);
  assert.equal(w.nodes[1].values.places, 2, 'the value is kept');
  assert.deepEqual(workflowFaults(w, kinds), [], 'a kept value is no fault');
  assert.deepEqual(names(node(workflowGraph(w, {}, kinds), 'm')), ['type', 'a', 'b'], 'and drawn nowhere');
  w = editWorkflow(w, { node: 'm', row: 'type', value: 'round' }, kinds);
  assert.equal(node(workflowGraph(w, {}, kinds), 'm').rows.find((r) => r.name === 'places').value, 2);
});

test('a route into a row that is gone is KEPT, greyed and named, and survives a round trip', () => {
  const round = flow('round');
  assert.deepEqual(workflowFaults(round, kinds), []);
  const add = editWorkflow(round, { node: 'm', row: 'type', value: 'add' }, kinds);
  assert.deepEqual(add.routes, round.routes, 'the route stays');
  const fault = 'the node "m" is of the Add type, which has no "Places" row: the route "v/value" → "m/places" is kept, greyed';
  assert.deepEqual(workflowFaults(add, kinds), [fault]);
  const graph = workflowGraph(add, {}, kinds);
  assert.deepEqual(graph.routes, round.routes);
  assert.deepEqual(graph.stale, [{ from: 'v/value', to: 'm/places', fault }]);
  assert.deepEqual(staleRoutes(add, kinds).map((r) => r.fault), [fault]);
  // Through JSON and a read: the same route, the same fault, and the same drawing.
  const again = readWorkflow(JSON.parse(JSON.stringify(add)), kinds).workflow;
  assert.deepEqual(workflowFaults(again, kinds), [fault]);
  assert.deepEqual(workflowGraph(again, {}, kinds), graph);
  // Round again: it is live, and no fault stands.
  const back = editWorkflow(again, { node: 'm', row: 'type', value: 'round' }, kinds);
  assert.deepEqual(workflowFaults(back, kinds), []);
  assert.equal(workflowGraph(back, {}, kinds).stale, undefined);
  // The reader cuts it: Delete works on a greyed route.
  assert.deepEqual(workflowFaults(editWorkflow(add, { cut: add.routes[0] }, kinds), kinds), []);
  // A route out of a vanished row is the same.
  const out = { ...flow('round'), routes: [{ from: 'm/places', to: 'o' }] };
  assert.equal(workflowFaults(editWorkflow(out, { node: 'm', row: 'type', value: 'add' }, kinds), kinds).length, 1);
});

test('planted faults: an unknown type, a type of another family, a row no type has', () => {
  const one = (kind, values) => ({ v: 2, id: 'w', nodes: [{ id: 'n', kind, x: 0, y: 0, values }] });
  assert.deepEqual(workflowFaults(one('math', { type: 'cube' }), kinds), ['the node "n" holds "cube" as its Operation, which is none of its choices']);
  assert.deepEqual(workflowFaults(one('math', { type: 'number' }), kinds), ['the node "n" holds "number" as its Operation, which is none of its choices']);
  assert.deepEqual(workflowFaults(one('value', { type: 'round' }), kinds), ['the node "n" holds "round" as its Type, which is none of its choices']);
  assert.deepEqual(workflowFaults(one('math', { type: 'add', nope: 1 }), kinds), ['the node "n" holds a value for "nope", a row its kind has not']);
  // An unknown type still draws, and never throws.
  assert.deepEqual(names(node(workflowGraph(one('math', { type: 'cube' }), {}, kinds), 'n')), ['type', 'a', 'b']);
  // A route into a row no type has is its own fault, not a kept one.
  const bad = { ...flow('add'), routes: [{ from: 'v/value', to: 'm/nope' }] };
  assert.deepEqual(workflowFaults(bad, kinds), ['a route enters "m/nope", which is no input socket']);
  assert.equal(workflowGraph(bad, {}, kinds).stale, undefined);
});

test('the Value node is a family of today\'s four types: old graphs read the same', () => {
  assert.deepEqual(typeChoices(NODE_KINDS.value).map((c) => c.value), ['text', 'number', 'date', 'boolean']);
  const old = { v: 2, id: 'w', nodes: [{ id: 'v', kind: 'value', x: 0, y: 0, values: { value: '7', type: 'number' } }, { id: 'u', kind: 'value', x: 0, y: 90, values: { value: 'hi' } }] };
  assert.deepEqual(workflowFaults(old), []);
  const g = workflowGraph(old);
  assert.deepEqual([node(g, 'v').rows.map((r) => [r.name, r.value]), node(g, 'u').rows.map((r) => [r.name, r.value])], [[['type', 'number'], ['value', '7']], [['type', 'text'], ['value', 'hi']]]);
  assert.deepEqual(rowChoices(node(g, 'v').rows[0], { types: typeChoices(NODE_KINDS.value) }).map((c) => c.label), ['Text', 'Number', 'Date', 'True/false']);
  assert.deepEqual(workflowFaults({ ...old, nodes: [{ ...old.nodes[0], values: { value: 'x', type: 'number' } }] }), ['the node "v" holds "x" as its Value, which is not a number']);
});
