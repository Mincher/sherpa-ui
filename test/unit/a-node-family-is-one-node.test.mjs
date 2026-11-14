/**
 * A NODE FAMILY IS ONE NODE: a kind with `types` has a first row that picks the type, kept as the
 * node's `type` value; `resolveKind` gives an ordinary kind for it, so nothing else learns of types.
 * A row the new type lacks keeps its VALUE and its CONNECTION in the draft, for the type to come back to:
 * drawn nowhere, no fault, and Save writes only the final graph (`finalGraph`). A kind of one type
 * shows no select. Plan 749 P1; the kept connection, Will 2026-11-05.
 *
 *   node --test test/unit/a-node-family-is-one-node.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const core = new URL('../../dist/core/data/', import.meta.url);
const { NODE_KINDS, accepts, fitOf, kindIn, kindOfNode, resolveKind, rowChoices, socketType, typeChoices } = await import(new URL('node-kinds.js', core));
const { editWorkflow, finalGraph, keptConnections, readWorkflow, workflowFaults, workflowGraph } = await import(new URL('workflow.js', core));

// A family of our own, so this file holds whatever the registry ships.
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
  v: 3, id: 'w',
  nodes: [
    { id: 'v', kind: 'value', x: 0, y: 0, values: { value: 2, type: 'decimal' } },
    { id: 'm', kind: 'math', x: 300, y: 0, values: { ...(type ? { type } : {}), ...extra } },
    { id: 'o', kind: 'result', x: 600, y: 0 },
  ],
  connections: [{ from: 'v/value', to: 'm/places' }],
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
  assert.equal(resolveKind(NODE_KINDS.field), NODE_KINDS.field);
  assert.equal(kindOfNode(kinds, { kind: 'nope' }), undefined);
});

test('a kind of one type shows no select; the Query takes Logic\'s And, Or and comparisons, not Not or Is empty', () => {
  assert.deepEqual(resolveKind(lone).rows.map((r) => r.name), ['a']);
  assert.equal(typeChoices(lone).length, 1);
  // One test per Condition in both graphs (plan 783 D4, D6): Not and Is empty are a workflow's alone.
  const query = kindIn(NODE_KINDS.condition, 'query');
  assert.deepEqual(Object.keys(query.types), Object.keys(NODE_KINDS.condition.types).filter((t) => t !== 'not' && t !== 'empty'));
  assert.equal(query.defaultType, 'eq');
  assert.equal(kindIn(NODE_KINDS.condition, 'workflow'), NODE_KINDS.condition, 'a workflow takes every type');
  assert.equal(kindIn(NODE_KINDS.value, 'query'), undefined, 'a kind no Query draws');
  assert.equal(NODE_KINDS.field.types, undefined);
});

test('accepts follows the type: a boolean out of Compare joins a number\'s row, which reads it as 1 or 0 (TODOs 770, 781)', () => {
  const into = { v: 3, id: 'w', nodes: [{ id: 'm', kind: 'math', x: 0, y: 0, values: { type: 'compare' } }, { id: 'n', kind: 'math', x: 300, y: 0 }], connections: [{ from: 'm', to: 'n/a' }] };
  assert.equal(socketType(kindOfNode(kinds, into.nodes[0]), undefined, 'output'), 'boolean');
  assert.deepEqual(workflowFaults(into, kinds), []);
  assert.deepEqual(workflowGraph(into, {}, kinds).nodes.find((n) => n.id === 'n').warnings, undefined);
  const add = { ...into, nodes: [{ ...into.nodes[0], values: { type: 'add' } }, into.nodes[1]] };
  assert.deepEqual([workflowFaults(add, kinds), workflowGraph(add, {}, kinds).nodes.find((n) => n.id === 'n').warnings], [[], undefined]);
  assert.ok(accepts('value', 'value'));
  assert.ok(!accepts('boolean', 'value'));
  // Placing a family from a socket fits its default type.
  assert.deepEqual(fitOf(math, 'value', 'out'), { row: 'a' });
});

test('Round then Add keeps Places: its value waits, and comes back with Round', () => {
  let w = flow('round', { places: 2 });
  w = { ...w, connections: [] };
  w = editWorkflow(w, { node: 'm', row: 'type', value: 'add' }, kinds);
  assert.equal(w.nodes[1].values.places, 2, 'the value is kept');
  assert.deepEqual(workflowFaults(w, kinds), [], 'a kept value is no fault');
  assert.deepEqual(names(node(workflowGraph(w, {}, kinds), 'm')), ['type', 'a', 'b'], 'and drawn nowhere');
  w = editWorkflow(w, { node: 'm', row: 'type', value: 'round' }, kinds);
  assert.equal(node(workflowGraph(w, {}, kinds), 'm').rows.find((r) => r.name === 'places').value, 2);
});

test('a connection into a row that is gone is KEPT in the draft: drawn nowhere, no fault, and back with its type', () => {
  const round = flow('round', { places: 2 });
  assert.deepEqual(workflowFaults(round, kinds), []);
  const add = editWorkflow(round, { node: 'm', row: 'type', value: 'add' }, kinds);
  assert.deepEqual(add.connections, round.connections, 'the draft keeps the connection');
  assert.equal(add.nodes[1].values.places, 2, 'and the value');
  assert.deepEqual(workflowFaults(add, kinds), [], 'no fault: nothing to warn of');
  assert.deepEqual(keptConnections(add, kinds), round.connections);
  const graph = workflowGraph(add, {}, kinds);
  assert.deepEqual(graph.connections, [], 'drawn nowhere');
  assert.equal('stale' in graph, false);
  // Through JSON and a read: the read is lossless, so the draft keeps it still.
  const again = readWorkflow(JSON.parse(JSON.stringify(add)), kinds).workflow;
  assert.deepEqual(again.connections, round.connections);
  assert.deepEqual(workflowFaults(again, kinds), []);
  // Round again: the connection joins, and Places is back.
  const back = editWorkflow(again, { node: 'm', row: 'type', value: 'round' }, kinds);
  assert.deepEqual(workflowGraph(back, {}, kinds).connections, round.connections);
  assert.equal(back.nodes[1].values.places, 2, 'its own value is back');
  assert.equal(node(workflowGraph(back, {}, kinds), 'm').rows.find((r) => r.name === 'places').value, '2', 'and the row mirrors the Value connected in');
  assert.deepEqual(workflowFaults(back, kinds), []);
  // The reader may still cut it: Delete works on what it cannot see, through the node.
  assert.deepEqual(editWorkflow(add, { cut: add.connections[0] }, kinds).connections, []);
  // A connection out of a vanished row is the same.
  const out = editWorkflow({ ...flow('round'), connections: [{ from: 'm/places', to: 'o' }] }, { node: 'm', row: 'type', value: 'add' }, kinds);
  assert.deepEqual([workflowFaults(out, kinds), workflowGraph(out, {}, kinds).connections, keptConnections(out, kinds).length], [[], [], 1]);
});

test('Save writes the final graph: no connection to a vanished row, and no value for one', () => {
  const tied = { ...flow('round', { places: 2 }), connections: [{ from: 'v/value', to: 'm/places' }, { from: 'v/value', to: 'm/a' }] };
  const add = { ...editWorkflow(tied, { node: 'm', row: 'type', value: 'add' }, kinds), ties: [{ id: 't', x: 200, y: 0, connections: [{ from: 'v/value', to: 'm/places' }] }] };
  const final = finalGraph(add, kinds);
  assert.deepEqual(final.connections, [{ from: 'v/value', to: 'm/a' }]);
  assert.deepEqual(final.nodes[1].values, { type: 'add' });
  assert.equal(final.ties, undefined, 'a tie of only kept connections goes');
  assert.deepEqual(workflowFaults(final, kinds), []);
  // The type it was saved under keeps all of its own.
  assert.equal(finalGraph(tied, kinds), tied, 'a graph with nothing kept is the one given');
  assert.equal(finalGraph(editWorkflow(add, { node: 'm', row: 'type', value: 'round' }, kinds), kinds).connections.length, 2);
  // A value or a connection for a row NO type has is not the draft's to drop: it is a fault, and stays one.
  const bad = { ...flow('add', { nope: 1 }), connections: [{ from: 'v/value', to: 'm/nope' }] };
  assert.deepEqual(finalGraph(bad, kinds), bad);
  // A tied connection draws through its tie only: bends it holds (a hand-made or an old file) wait unseen in the draft, and Save drops them.
  const via = [{ x: 150, y: 40 }];
  const bent = { ...flow('add'), connections: [{ from: 'v/value', to: 'm/a', via }, { from: 'v/value', to: 'm/b', via }], ties: [{ id: 't', x: 200, y: 0, connections: [{ from: 'v/value', to: 'm/a' }] }] };
  assert.deepEqual(workflowFaults(bent, kinds), []);
  assert.deepEqual(finalGraph(bent, kinds).connections, [{ from: 'v/value', to: 'm/a' }, { from: 'v/value', to: 'm/b', via }], 'an untied connection keeps its bends');
  assert.deepEqual(finalGraph(bent, kinds).ties, bent.ties);
  assert.deepEqual(bent.connections[0].via, via, 'the draft keeps them');
  // A body of the same shape, as a Custom Node or an entity holds it, the same way.
  assert.deepEqual(finalGraph({ nodes: add.nodes, connections: add.connections }, kinds).connections, [{ from: 'v/value', to: 'm/a' }]);
});

test('planted faults: an unknown type, a type of another family, a row no type has', () => {
  const one = (kind, values) => ({ v: 3, id: 'w', nodes: [{ id: 'n', kind, x: 0, y: 0, values }] });
  assert.deepEqual(workflowFaults(one('math', { type: 'cube' }), kinds), ['the node "n" holds "cube" as its Operation, which is none of its choices']);
  assert.deepEqual(workflowFaults(one('math', { type: 'number' }), kinds), ['the node "n" holds "number" as its Operation, which is none of its choices']);
  assert.deepEqual(workflowFaults(one('value', { type: 'round' }), kinds), ['the node "n" holds "round" as its Type, which is none of its choices']);
  assert.deepEqual(workflowFaults(one('math', { type: 'add', nope: 1 }), kinds), ['the node "n" holds a value for "nope", a row its kind has not']);
  // An unknown type still draws, and never throws.
  assert.deepEqual(names(node(workflowGraph(one('math', { type: 'cube' }), {}, kinds), 'n')), ['type', 'a', 'b']);
  // A connection into a row no type has is its own fault, not a kept one.
  const bad = { ...flow('add'), connections: [{ from: 'v/value', to: 'm/nope' }] };
  assert.deepEqual(workflowFaults(bad, kinds), ['a connection enters "m/nope", which is no input socket']);
  assert.deepEqual(keptConnections(bad, kinds), []);
});

test('the Value node is a family of six types; a Number is none of them now (TODO 777: no legacy read)', () => {
  assert.deepEqual(typeChoices(NODE_KINDS.value).map((c) => c.value), ['text', 'integer', 'decimal', 'date', 'boolean', 'list']);
  const w = { v: 3, id: 'w', nodes: [{ id: 'v', kind: 'value', x: 0, y: 0, values: { value: 7, type: 'decimal' } }, { id: 'u', kind: 'value', x: 0, y: 90, values: { value: 'hi' } }] };
  assert.deepEqual(workflowFaults(w), []);
  const g = workflowGraph(w);
  assert.deepEqual([node(g, 'v').rows.map((r) => [r.name, r.value]), node(g, 'u').rows.map((r) => [r.name, r.value])], [[['type', 'decimal'], ['value', 7]], [['type', 'text'], ['value', 'hi']]]);
  assert.deepEqual(rowChoices(node(g, 'v').rows[0], { types: typeChoices(NODE_KINDS.value) }).map((c) => c.label), ['Text', 'Integer', 'Decimal', 'Date', 'True/false', 'List']);
  assert.deepEqual(workflowFaults({ ...w, nodes: [{ ...w.nodes[0], values: { value: 'x', type: 'decimal' } }] }), ['the node "v" holds "x" as its Value, which is no number']);
  assert.deepEqual(workflowFaults({ ...w, nodes: [{ ...w.nodes[0], values: { value: '7', type: 'number' } }] }), ['the node "v" holds "number" as its Type, which is none of its choices']);
});
