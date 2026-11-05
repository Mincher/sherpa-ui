/**
 * A NODE READS NULL FROM WHAT IT CANNOT USE — Will, 2026-11-05 (TODO 764): "Nodes will determine which data
 * they need from the input. If there's no valid input then it's null and we style the node as a warning with
 * tooltip message." Graphs stay open, and any route joins any input (TODO 770): a node reads what it needs of
 * what reaches it. What it cannot use reads null there, and the node says why, in words from its kind's own
 * description (`needs`, its socket's type, `INPUT_WORDS`). A warning is no fault: Save does not wait. A row's
 * own fault (P4) stays as it was.
 *
 *   node --test test/unit/a-node-reads-null-from-what-it-cannot-use.test.mjs
 *
 * TRAP T-a-node-reads-null-from-what-it-cannot-use
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const core = new URL('../../dist/core/data/', import.meta.url);
const { NODE_KINDS, resolveKind } = await import(new URL('node-kinds.js', core));
const { INPUT_WORDS, givenAt, needOf, readInput } = await import(new URL('node-input.js', core));
const { checkWorkflow, editWorkflow, finalGraph, workflowFaults, workflowGraph } = await import(new URL('workflow.js', core));
const { nodeFlow } = await import(new URL('node-flow.js', core));
const { kindsOf, useOf } = await import(new URL('node-library.js', core));
const { libraryOf } = await import(new URL('entity-types.js', core));
const data = await import(new URL('../../data.js', core));

const facts = { fields: { status: { label: 'Status' }, seats: { label: 'Seats', type: 'number' }, joined: { label: 'Joined', type: 'date' } } };
const value = (id, v, type) => ({ id, kind: 'value', x: 0, y: 0, values: { ...(type ? { type } : {}), ...(v === undefined ? {} : { value: v }) } });
const store = { id: 's', kind: 'store', x: 0, y: 200, values: { store: 'users' } };
const flow = (nodes, routes) => ({ v: 2, id: 'w', nodes, routes });
const drawn = (w, f = facts, kinds) => workflowGraph(w, f, kinds);
const at = (g, id) => g.nodes.find((n) => n.id === id);
const row = (g, id, name) => at(g, id).rows.find((r) => r.name === name);
/** Each node's warnings in words, by its id: none, where it has none. */
const said = (g) => Object.fromEntries(g.nodes.filter((n) => n.warnings).map((n) => [n.id, n.warnings.map((w) => [w.row ?? '', w.words])]));

test('an ANY header reads what its kind needs: a Condition, a Collection and a Tag take rows, a Field an object, a Time a date', () => {
  const nodes = [
    value('v', 'active'), store,
    { id: 'c', kind: 'condition', x: 300, y: 0 }, { id: 'col', kind: 'collection', x: 300, y: 200, values: { type: 'count' } },
    { id: 'tag', kind: 'tag', x: 300, y: 400 }, { id: 'p', kind: 'field', x: 300, y: 600 }, { id: 't', kind: 'time', x: 300, y: 800 },
    { id: 'end', kind: 'output', x: 600, y: 0 },
  ];
  const wrong = flow(nodes, [
    { from: 'v/value', to: 'c' }, { from: 's', to: 'col' }, { from: 'v', to: 'tag' }, { from: 's/#false', to: 'p' }, { from: 's/rows', to: 't' }, { from: 'v/value', to: 'end' },
  ]);
  assert.deepEqual(said(drawn(wrong)), {
    c: [['', 'Condition takes rows; it was given "active"']],
    col: [['', 'Collection takes rows; it was given a boolean']],
    tag: [['', 'Tag takes rows; it was given a boolean']],
    p: [['', 'Field takes an object; it was given a boolean']],
    t: [['', 'Time takes a date; it was given rows']],
  }, 'the Output takes anything');
  const right = flow([...nodes, value('d', '2024-01-31', 'date')], [
    { from: 's/rows', to: 'c' }, { from: 's/rows', to: 'col' }, { from: 'c/rows', to: 'tag' }, { from: 's/rows', to: 'p' }, { from: 'd/value', to: 't' }, { from: 's', to: 'end' },
  ]);
  assert.deepEqual(said(drawn(right)), {});
  // A node's own name is the one a warning names.
  const named = flow([value('v', 'active'), { id: 'c', kind: 'condition', x: 300, y: 0, heading: 'Has role' }], [{ from: 'v/value', to: 'c' }]);
  assert.deepEqual(said(drawn(named)), { c: [['', 'Has role takes rows; it was given "active"']] });
});

test('a row reads null where what comes cannot be used: text in a number, rows in a list, a stranger in a fixed list, a word that is no operator', () => {
  const w = flow([
    value('abc', 'abc'), value('five', '5'), value('side', 'sideways'), value('nope', 'nonsense'), value('mixed', ['1', 'x'], 'list'), store,
    { id: 'm', kind: 'math', x: 300, y: 0 }, { id: 'n', kind: 'math', x: 300, y: 200 }, { id: 'f', kind: 'math', x: 300, y: 400, values: { type: 'floor' } },
    { id: 'j', kind: 'text', x: 300, y: 600, values: { type: 'join' } }, { id: 'tag', kind: 'tag', x: 300, y: 800 },
    { id: 'col', kind: 'collection', x: 600, y: 0, values: { type: 'sort' } }, { id: 'c', kind: 'condition', x: 600, y: 200 },
  ], [
    { from: 'abc/value', to: 'm/a' }, { from: 'five/value', to: 'n/a' }, { from: 's/rows', to: 'f/values' }, { from: 'mixed/value', to: 'f/values' },
    { from: 's/rows', to: 'j/values' }, { from: 's/rows', to: 'tag/value' }, { from: 'side/value', to: 'col/direction' }, { from: 'nope/value', to: 'c/op' },
  ]);
  const g = drawn(w);
  assert.deepEqual(said(g), {
    m: [['a', 'Value A takes a number; it was given "abc"']],
    f: [['values', 'Values takes a list of numbers; it was given rows'], ['values', 'Values takes a list of numbers; it was given a list with "x"']],
    j: [['values', 'Values takes a list; it was given rows']],
    tag: [['value', 'Tags takes a list; it was given rows']],
    col: [['direction', 'Direction takes Ascending or Descending; it was given "sideways"']],
    c: [['op', 'Operator takes an operator; it was given "nonsense"']],
  });
  // It READS null there, read only, in place of mirroring what came: not "sideways Custom".
  assert.deepEqual([row(g, 'm', 'a').value, row(g, 'col', 'direction').value, row(g, 'c', 'op').value], [null, null, null]);
  assert.equal(row(g, 'col', 'direction').custom, undefined);
  // Text that reads as a number is a number, as the row reads it (T-a-value-is-typed-once).
  assert.deepEqual([row(g, 'n', 'a').value, at(g, 'n').warnings], ['5', undefined]);
  // A list in Join, a number in Value A, a direction it knows: each used.
  const fine = flow([value('l', ['a', 'b'], 'list'), value('d', 'desc'), { id: 'mr', kind: 'math', x: 0, y: 600 },
    { id: 'j', kind: 'text', x: 300, y: 0, values: { type: 'join' } }, { id: 'm', kind: 'math', x: 300, y: 200 }, { id: 'col', kind: 'collection', x: 300, y: 400 }],
  [{ from: 'l/value', to: 'j/values' }, { from: 'mr/result', to: 'm/a' }, { from: 'd/value', to: 'col/direction' }]);
  const ok = drawn(fine);
  assert.deepEqual([said(ok), row(ok, 'col', 'direction').value, row(ok, 'col', 'direction').custom], [{}, 'desc', true]);
});

test('a comparison\'s Value reads by its field: a number field takes a number, a date field a date', () => {
  const w = flow([value('abc', 'abc'), value('day', '2024-01-31'), value('n', '7'),
    { id: 'c1', kind: 'condition', x: 300, y: 0, values: { field: 'seats', op: 'gt' } },
    { id: 'c2', kind: 'condition', x: 300, y: 200, values: { field: 'joined', op: 'eq' } },
    { id: 'c3', kind: 'condition', x: 300, y: 400, values: { field: 'seats', op: 'eq' } },
    { id: 'c4', kind: 'condition', x: 300, y: 600, values: { field: 'status', op: 'eq' } }],
  [{ from: 'abc/value', to: 'c1/value' }, { from: 'abc/value', to: 'c2/value' }, { from: 'n/value', to: 'c3/value' }, { from: 'abc/value', to: 'c4/value' }]);
  assert.deepEqual(said(drawn(w)), { c1: [['value', 'Value takes a number; it was given "abc"']], c2: [['value', 'Value takes a date; it was given "abc"']] });
  assert.deepEqual(said(drawn(flow(w.nodes, [{ from: 'day/value', to: 'c2/value' }]))), {});
});

test('an unconnected row with no value is not invalid input: no warning; nor is a route from a source that holds nothing', () => {
  const bare = flow([{ id: 'm', kind: 'math', x: 0, y: 0 }, { id: 't', kind: 'time', x: 0, y: 200 }, { id: 'c', kind: 'condition', x: 0, y: 400 }, { id: 'col', kind: 'collection', x: 0, y: 600 }], []);
  assert.deepEqual(said(drawn(bare)), {});
  assert.deepEqual(at(drawn(bare), 'm').rows.map((r) => r.value), ['add', undefined, undefined, undefined]);
  // An empty Value sends nothing (D2): Value A reads its own, unwarned, as it did.
  const empty = flow([value('v', undefined, 'text'), { id: 'm', kind: 'math', x: 300, y: 0, values: { a: 3 } }], [{ from: 'v/value', to: 'm/a' }]);
  assert.deepEqual([said(drawn(empty)), row(drawn(empty), 'm', 'a').value], [{}, 3]);
  // What a node works out is known only when it runs: a Text's Result in Value A may read as a number.
  const later = flow([{ id: 'x', kind: 'text', x: 0, y: 0 }, { id: 'p', kind: 'field', x: 0, y: 200 }, { id: 'm', kind: 'math', x: 300, y: 0 }, { id: 't', kind: 'time', x: 300, y: 200 }],
    [{ from: 'x/result', to: 'm/a' }, { from: 'p/field', to: 't' }]);
  assert.deepEqual(said(drawn(later)), {});
});

test('a warning is no fault and no Save block: the checks pass, Save writes the route, and nothing is red', () => {
  const w = flow([value('v', 'abc'), store, { id: 'm', kind: 'math', x: 300, y: 0 }, { id: 't', kind: 'time', x: 300, y: 200 }],
    [{ from: 'v/value', to: 'm/a' }, { from: 's/rows', to: 't' }]);
  assert.deepEqual(workflowFaults(w, NODE_KINDS, facts), []);
  assert.equal(checkWorkflow(w, NODE_KINDS, facts), true);
  assert.deepEqual(finalGraph(w).routes, w.routes);
  const g = drawn(w);
  assert.equal(at(g, 'm').warnings.length + at(g, 't').warnings.length, 2);
  assert.ok(g.nodes.every((n) => n.rows.every((r) => r.fault === undefined)), 'no row draws a fault');
  // Cut, it reads its own again: off is not gone.
  const cut = editWorkflow(w, { cut: 'm/a' });
  assert.deepEqual([at(drawn(cut), 'm').warnings, row(drawn(cut), 'm', 'a').value], [undefined, undefined]);
});

test('a route of another type joins and warns (TODO 770); a row\'s own fault stays as it was: red, never a warning', () => {
  const rows = flow([store, { id: 'm', kind: 'math', x: 300, y: 0 }], [{ from: 's/rows', to: 'm/a' }]);
  assert.deepEqual([workflowFaults(rows), said(drawn(rows))], [[], { m: [['a', 'Value A takes a number; it was given rows']] }]);
  // P4: a number off its step, routed in, is the row's fault; and not also a warning.
  const half = flow([value('h', '1.5', 'decimal'), { id: 'm', kind: 'math', x: 300, y: 0, values: { type: 'round' } }], [{ from: 'h/value', to: 'm/places' }]);
  assert.deepEqual(workflowFaults(half), ['the route "h/value" → "m/places": 1.5 is not a whole number']);
  assert.deepEqual([row(drawn(half), 'm', 'places').fault, at(drawn(half), 'm').warnings], ['1.5 is not a whole number', undefined]);
});

test('an entity\'s output and a Custom Node\'s: a Preset Filter\'s Where into a Collection is a boolean, and a Custom Node\'s header takes anything', () => {
  const entity = {
    v: 1, type: 'preset-filter', id: 'active', label: 'Active',
    graph: { nodes: [{ id: 'c', kind: 'condition', x: 0, y: 0 }], routes: [{ from: 'c', to: '#out/where' }] }, settings: { source: 'customers' },
  };
  const library = libraryOf([entity]);
  const kinds = { ...NODE_KINDS, ...kindsOf(library) };
  const w = flow([useOf(library, 'preset-filter:active', { id: 'use', x: 0, y: 0 }), { id: 'col', kind: 'collection', x: 300, y: 0 }, value('v', 'x')],
    [{ from: 'use/where', to: 'col' }, { from: 'v/value', to: 'use' }]);
  assert.deepEqual(said(drawn(w, facts, kinds)), { col: [['', 'Collection takes rows; it was given a boolean']] });
});

test('the incoming JSON says it: null where the node cannot use what came, and why', () => {
  const g = drawn(flow([value('v', 'abc'), store, { id: 'm', kind: 'math', x: 300, y: 0 }, { id: 't', kind: 'time', x: 300, y: 200 }],
    [{ from: 'v/value', to: 'm/a' }, { from: 's/rows', to: 't' }]));
  const [t, m] = [nodeFlow(g, 't').incoming, nodeFlow(g, 'm').incoming];
  assert.deepEqual(t[0], { socket: 'In', type: 'any', from: ['Store › Rows'], value: null, warning: 'Time takes a date; it was given rows' });
  assert.deepEqual(m.find((s) => s.socket === 'Value A'), { socket: 'Value A', type: 'value', from: ['Value › Value'], value: null, warning: 'Value A takes a number; it was given "abc"' });
  assert.equal('warning' in m.find((s) => s.socket === 'Value B'), false);
});

test('the words come from one place: the kind says what it needs, INPUT_WORDS says it; a runner reads through the same door', () => {
  // Every need and given a kind can say has its words.
  for (const word of ['value', 'number', 'boolean', 'object', 'list', 'rows', 'date', 'numbers', 'operator', 'field']) assert.equal(typeof INPUT_WORDS[word], 'string', word);
  assert.equal(INPUT_WORDS.object, data.SOCKET_WORDS.object, 'a socket type says the words a socket\'s tip says');
  // The kinds say it: what each header needs, and each row by its control, list or field.
  assert.deepEqual(['condition', 'collection', 'tag', 'field', 'time', 'output'].map((k) => resolveKind(NODE_KINDS[k]).needs), ['rows', 'rows', 'rows', 'object', 'date', undefined]);
  // A family's type says its own: Logic's Rows that hold takes rows; Is empty anything; And takes booleans by its socket.
  assert.deepEqual(['rows', 'empty', 'and'].map((t) => resolveKind(NODE_KINDS.condition, t).needs), ['rows', undefined, undefined]);
  assert.deepEqual([needOf({ control: 'number' }), needOf({ control: 'datetime' }), needOf({ control: 'direction' }), needOf({ control: 'op' }), needOf({ control: 'text' })], ['number', 'date', 'choice', 'operator', undefined]);
  assert.deepEqual([needOf({ control: 'values' }, 'number'), needOf({ control: 'tags', multiple: true, input: 'object' }, 'number'), needOf({ control: 'tags', multiple: true, input: 'object' })], ['number', 'numbers', 'list']);
  // An app's kind says its own need, and its warning says it in the same words.
  const kinds = { ...NODE_KINDS, gauge: { heading: 'Gauge', icon: 'insights', input: 'any', needs: 'number', rows: [], model: 'x', graphs: ['workflow'] } };
  const g = drawn(flow([store, { id: 'g', kind: 'gauge', x: 300, y: 0 }], [{ from: 's/rows', to: 'g' }]), facts, kinds);
  assert.deepEqual(said(g), { g: [['', `Gauge takes ${INPUT_WORDS.number}; it was given ${INPUT_WORDS.rows}`]] });
  // The door a runner reads by (N4): a value it can use, or null and why.
  assert.deepEqual(readInput({ label: 'Value A', needs: 'number' }, { kind: 'value', value: 42 }), { value: 42 });
  assert.deepEqual(readInput({ label: 'Value A', needs: 'number' }, { kind: 'rows' }), { value: null, warning: 'Value A takes a number; it was given rows' });
  assert.deepEqual(readInput({ label: 'Anything' }, { kind: 'boolean' }), { value: undefined });
  // What a socket sends: rows from a Rows row, a list from a List, a number from a Result; nothing from a Value that holds none.
  assert.deepEqual([givenAt(store, 'rows', NODE_KINDS), givenAt(value('l', ['a'], 'list'), 'value', NODE_KINDS), givenAt({ kind: 'math' }, 'result', NODE_KINDS), givenAt(value('e'), 'value', NODE_KINDS), givenAt(store, '#false', NODE_KINDS)],
    [{ kind: 'rows' }, { kind: 'list', value: ['a'] }, { kind: 'number' }, undefined, { kind: 'boolean' }]);
  for (const name of ['INPUT_WORDS', 'givenAt', 'needOf', 'readInput']) assert.equal(typeof data[name], name === 'INPUT_WORDS' ? 'object' : 'function', `sherpa-ui/data exports ${name}`);
});
