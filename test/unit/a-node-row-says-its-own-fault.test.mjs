/**
 * A NODE ROW SAYS ITS OWN FAULT — plan 749 P4. A row that takes several words is TAGS, an object (D17):
 * Is one of and Is not one of, a Value's List, a Tag's Tags, the Query's Search fields. Where the field's
 * values are known, the tags are CLOSED to them. A Start or End is a date and time; Places and a span's
 * Value are counts. A value its row cannot hold — a stranger in a closed list, no date, a number off its
 * step or under its least — is a fault where it is held and where a connection brings it, and the row draws
 * it in words. What a change of type or operator orphans is no such fault: the draft keeps it.
 *
 *   node --test test/unit/a-node-row-says-its-own-fault.test.mjs
 *
 * TRAP T-a-row-says-its-own-fault · TRAP T-an-operator-shapes-its-value
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const core = new URL('../../dist/core/data/', import.meta.url);
const { NODE_KINDS, kindOfNode, rowChoices, rowFault } = await import(new URL('node-kinds.js', core));
const { editWorkflow, finalGraph, keptConnections, readWorkflow, workflowFaults, workflowGraph } = await import(new URL('workflow.js', core));
const { queryGraph } = await import(new URL('query-lens.js', core));

// The store's fields, Status with the values it takes: a Field reads its Source's (TODO 817).
const facts = { fieldsOf: { customers: { status: { label: 'Status', values: ['active', 'trial'] }, plan: { label: 'Plan' }, seats: { label: 'Seats', type: 'number' } } } };
/** A Condition `c` testing the Field `f` on `field`, its rows the Source `s`'s, with its values; more nodes and connections. */
const flow = (field, values, more = [], connections = []) => ({
  v: 3, id: 'w',
  nodes: [{ id: 'c', kind: 'condition', x: 300, y: 0, values }, { id: 'f', kind: 'field', x: 0, y: 0, values: { field } }, { id: 's', kind: 'source', x: -300, y: 0, values: { store: 'customers' } }, ...more],
  connections: [{ from: 's/rows', to: 'f' }, { from: 'f/field', to: 'c' }, ...connections],
});
const list = (value) => ({ id: 'l', kind: 'value', x: 0, y: 0, values: { type: 'list', value } });
const row = (g, id, name) => g.nodes.find((n) => n.id === id).rows.find((r) => r.name === name);
const at = (g, id) => g.nodes.find((n) => n.id === id);

test('Is one of takes tags: an object in, free where the Field\'s values are not known, CLOSED where they are', () => {
  const free = row(workflowGraph(flow('plan', { type: 'in', b: ['Pro', 'Free'] }), facts), 'c', 'b');
  assert.deepEqual([free.control, free.multiple, free.input, free.value, free.closed, free.fault], ['tags', true, 'object', ['Pro', 'Free'], undefined, undefined]);
  const closed = row(workflowGraph(flow('status', { type: 'notin', b: ['trial'] }), facts), 'c', 'b');
  // Known: ONE dropdown of ticks, closed to them (TRAP T-a-multi-select-is-one-row).
  assert.deepEqual([closed.control, closed.closed, closed.choices.map((c) => c.value)], ['values', true, ['active', 'trial']]);
  // Equals stays one value, picked where the values are known, typed where not.
  assert.deepEqual([row(workflowGraph(flow('status', { type: 'eq', b: 'trial' }), facts), 'c', 'b').control], ['values']);
  assert.deepEqual([row(workflowGraph(flow('plan', { type: 'eq', b: 'Pro' }), facts), 'c', 'b').control], ['text']);
  // The operator shapes Value B: one value under Equals, a list under Is one of.
  assert.deepEqual(['eq', 'in'].map((type) => kindOfNode(NODE_KINDS, { kind: 'condition', values: { type } }).rows.find((r) => r.name === 'b').control), ['values', 'tags']);
});

test('a tag edit is typed by its Field, and an operator change carries the value: one becomes a list, a list one', () => {
  let w = flow('seats', { type: 'in' });
  w = editWorkflow(w, { node: 'c', row: 'b', value: ['5', '10'] }, NODE_KINDS, facts);
  assert.deepEqual(w.nodes[0].values.b, [5, 10], 'a number field\'s tags are numbers');
  assert.deepEqual(editWorkflow(flow('seats', { type: 'gt' }), { node: 'c', row: 'b', value: '70' }, NODE_KINDS, facts).nodes[0].values.b, 70);
  assert.equal(editWorkflow({ ...flow('seats', { type: 'gt' }), connections: [] }, { node: 'c', row: 'b', value: '70' }, NODE_KINDS, facts).nodes[0].values.b, '70', 'no Field: text');
  w = editWorkflow(flow('plan', { type: 'eq', b: 'Pro, Free' }), { node: 'c', row: 'type', value: 'in' }, NODE_KINDS, facts);
  assert.deepEqual(w.nodes[0].values.b, ['Pro', 'Free']);
  w = editWorkflow(w, { node: 'c', row: 'type', value: 'eq' }, NODE_KINDS, facts);
  assert.equal(w.nodes[0].values.b, 'Pro, Free', 'and back: off is not gone');
  assert.equal(editWorkflow(flow('plan', { type: 'in', b: ['Pro'] }), { node: 'c', row: 'type', value: 'ne' }).nodes[0].values.b, 'Pro');
  // A Value's Text becomes its List, and back.
  const v = { v: 3, id: 'w', nodes: [{ id: 'v', kind: 'value', x: 0, y: 0, values: { type: 'text', value: 'a, b' } }] };
  const asList = editWorkflow(v, { node: 'v', row: 'type', value: 'list' });
  assert.deepEqual(asList.nodes[0].values, { type: 'list', value: ['a', 'b'] });
  assert.deepEqual(workflowFaults(asList), []);
  assert.deepEqual(editWorkflow(asList, { node: 'v', row: 'type', value: 'text' }).nodes[0].values, { type: 'text', value: 'a, b' });
  // A list row holding one value is a fault, a tags row too: nothing is read as it was before tags (TODO 777).
  const old = flow('plan', { type: 'in', b: 'Pro' }, [list('a, b')]);
  assert.equal(readWorkflow(old).workflow, old);
  assert.deepEqual(workflowFaults(old, NODE_KINDS, facts), ['the node "c" holds "Pro" as its Values, which is no list', 'the node "l" holds "a, b" as its Value, which is no list']);
});

test('a Value > List connected to Is one of OVERRIDES its tags (D7): read only, its own kept; cut, they are back', () => {
  const own = ['Pro'];
  const connected = flow('plan', { type: 'in', b: own }, [list(['Free', 'Team'])], [{ from: 'l/value', to: 'c/b' }]);
  assert.deepEqual(workflowFaults(connected, NODE_KINDS, facts), []);
  const shown = row(workflowGraph(connected, facts), 'c', 'b');
  assert.deepEqual([shown.value, shown.custom, shown.hint], [['Free', 'Team'], true, 'Custom values, from Value › Value']);
  assert.deepEqual(connected.nodes[0].values.b, own, 'its own wait in the draft');
  const cut = editWorkflow(connected, { cut: 'c/b' });
  assert.deepEqual(row(workflowGraph(cut, facts), 'c', 'b').value, own);
  // One value is no list: a Text into Is one of stays joined, Values reads null and the node warns; Save keeps it,
  // and Equals again reads it. Any connection joins any input (TODO 770).
  const text = { id: 't', kind: 'value', x: 0, y: 0, values: { value: 'Pro' } };
  const eq = flow('plan', { type: 'eq' }, [text], [{ from: 't/value', to: 'c/b' }]);
  const inOp = editWorkflow(eq, { node: 'c', row: 'type', value: 'in' }, NODE_KINDS, facts);
  assert.deepEqual([keptConnections(inOp).length, workflowFaults(inOp, NODE_KINDS, facts), workflowGraph(inOp, facts).connections], [0, [], eq.connections]);
  assert.deepEqual([row(workflowGraph(inOp, facts), 'c', 'b').value, at(workflowGraph(inOp, facts), 'c').warnings], [null, [{ row: 'b', words: 'Values takes a list; it was given "Pro"' }]]);
  assert.deepEqual(finalGraph(inOp).connections, eq.connections, 'Save writes the connection, as drawn');
  const again = workflowGraph(editWorkflow(inOp, { node: 'c', row: 'type', value: 'eq' }), facts);
  assert.deepEqual([again.connections, at(again, 'c').warnings, row(again, 'c', 'b').value], [eq.connections, undefined, 'Pro'], 'Equals again: it reads it');
});

test('PLANTED: a stranger in a closed list is a fault, held or brought, and the row says it in words', () => {
  const held = flow('status', { type: 'in', b: ['active', 'gold'] });
  assert.deepEqual(workflowFaults(held, NODE_KINDS, facts), ['the node "c"\'s Values: "gold" is not a value of Status']);
  assert.equal(row(workflowGraph(held, facts), 'c', 'b').fault, '"gold" is not a value of Status');
  const two = flow('status', { type: 'in', b: ['gold', 'silver', 'trial'] });
  assert.equal(row(workflowGraph(two, facts), 'c', 'b').fault, '"gold" and "silver" are not values of Status');
  const brought = flow('status', { type: 'in', b: ['active'] }, [list(['trial', 'gold'])], [{ from: 'l/value', to: 'c/b' }]);
  assert.deepEqual(workflowFaults(brought, NODE_KINDS, facts), ['the connection "l/value" → "c/b": "gold" is not a value of Status']);
  assert.equal(row(workflowGraph(brought, facts), 'c', 'b').fault, '"gold" is not a value of Status');
  // The same list into a free row holds: only a closed list refuses; a Condition with no Field is free.
  assert.deepEqual(workflowFaults(flow('plan', { type: 'in' }, [list(['gold'])], [{ from: 'l/value', to: 'c/b' }]), NODE_KINDS, facts), []);
  assert.deepEqual(workflowFaults({ ...held, connections: [] }, NODE_KINDS, facts), []);
  // A number field's Value B is a number: the row's own fault.
  assert.deepEqual(workflowFaults(flow('seats', { type: 'gt', b: 'many' }), NODE_KINDS, facts), ['the node "c" holds "many" as its Value B, which is no number, as "seats", a number field takes']);
  assert.equal(rowFault({ control: 'tags', closed: true, choices: [{ value: 'a', label: 'a' }] }, ['a']), undefined);
});

test('PLANTED: a Start or End that is no date is a fault, and drawn; a date and time holds', () => {
  const time = (start, end) => ({ v: 3, id: 'w', nodes: [{ id: 't', kind: 'time', x: 0, y: 0, values: { type: 'between', start, end } }] });
  assert.equal(row(workflowGraph(time()), 't', 'start').control, 'datetime');
  assert.deepEqual(workflowFaults(time('2024-01-12', '2024-03-01T10:30')), []);
  const bad = time('2024-02-30', 'next Tuesday');
  assert.deepEqual(workflowFaults(bad), [
    'the node "t"\'s Start: "2024-02-30" is not a date: pick one, or write it as 31 Jan 2024',
    'the node "t"\'s End: "next Tuesday" is not a date: pick one, or write it as 31 Jan 2024',
  ]);
  assert.equal(row(workflowGraph(bad), 't', 'start').fault, '"2024-02-30" is not a date: pick one, or write it as 31 Jan 2024');
  // A date a Value connects in is checked as it comes.
  const connected = { ...time(), nodes: [...time().nodes, { id: 'v', kind: 'value', x: 0, y: 0, values: { type: 'date', value: '2024-13-01' } }], connections: [{ from: 'v/value', to: 't/start' }] };
  assert.ok(workflowFaults(connected).includes('the connection "v/value" → "t/start": "2024-13-01" is not a date: pick one, or write it as 31 Jan 2024'));
  // A typed date is kept as given, trimmed: the reader's words are read by the field.
  assert.equal(editWorkflow(time(), { node: 't', row: 'start', value: ' 2024-01-12T09:30 ' }).nodes[0].values.start, '2024-01-12T09:30');
});

test('PLANTED: Places is a whole number from 0, a span\'s Value from 1; a Unit says its words for the count', () => {
  const math = (places) => ({ v: 3, id: 'w', nodes: [{ id: 'm', kind: 'math', x: 0, y: 0, values: { type: 'round', ...(places === undefined ? {} : { places }) } }] });
  assert.deepEqual([row(workflowGraph(math(2)), 'm', 'places').min, row(workflowGraph(math(2)), 'm', 'places').step], [0, 1]);
  assert.deepEqual(workflowFaults(math(2)), []);
  assert.deepEqual(workflowFaults(math(2.5)), ['the node "m"\'s Places: 2.5 is not a whole number']);
  assert.deepEqual(workflowFaults(math(-1)), ['the node "m"\'s Places: -1 is less than 0']);
  assert.equal(row(workflowGraph(math(-1)), 'm', 'places').fault, '-1 is less than 0');
  assert.equal(row(workflowGraph(editWorkflow(math(), { node: 'm', row: 'places', value: 'two' })), 'm', 'places').fault, '"two" is not a number');
  // A Value connected to Places is read as its number.
  const connected = { ...math(), nodes: [...math().nodes, { id: 'v', kind: 'value', x: 0, y: 0, values: { type: 'decimal', value: 1.5 } }], connections: [{ from: 'v/value', to: 'm/places' }] };
  assert.deepEqual(workflowFaults(connected), ['the connection "v/value" → "m/places": 1.5 is not a whole number']);
  const span = (n) => ({ v: 3, id: 'w', nodes: [{ id: 'd', kind: 'time', x: 0, y: 0, values: { type: 'duration', when: 'last', n, unit: 'week' } }] });
  assert.deepEqual(workflowFaults(span(0)), ['the node "d"\'s Value: 0 is less than 1']);
  const words = (n) => row(workflowGraph(span(n)), 'd', 'unit').choices.map((c) => c.label);
  assert.deepEqual(words(1), ['day', 'week', 'month', 'year']);
  assert.deepEqual(words(7), ['days', 'weeks', 'months', 'years']);
});

test('the Query draws Is one of with no values to pick as tags, and its Search fields as a field pick, read only', () => {
  const definition = { v: 1, id: 'p', source: { store: 'customers', search: ['name'], fields: { name: { label: 'Name' }, region: { label: 'Region' } } } };
  const query = { v: 1, scopes: { view: { holds: ['region'], readings: { region: { mode: 'advanced', tree: { op: 'in', value: ['EMEA', 'APAC'] } } } } } };
  const g = queryGraph(query, definition);
  const when = g.nodes.find((n) => n.kind === 'condition');
  const value = when.rows.find((r) => r.name === 'b');
  assert.deepEqual([value.control, value.value, value.editable], ['tags', ['EMEA', 'APAC'], true]);
  const search = g.nodes.find((n) => n.id === 'source').rows.find((r) => r.name === 'search');
  // The Source kind's own row in a Query (plan 1004 D3): its fields picked, as a Source's Fields picks them.
  assert.deepEqual([search.control, search.multiple, search.editable, search.value], ['field', true, false, ['name']]);
});
