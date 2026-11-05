/**
 * A NODE ROW SAYS ITS OWN FAULT — plan 749 P4. A row that takes several words is TAGS, an object (D17):
 * Is one of and Is not one of, a Value's List, a Tag's Tags, the Query's Search fields. Where the field's
 * values are known, the tags are CLOSED to them. A Start or End is a date and time; Places and a span's
 * Value are counts. A value its row cannot hold — a stranger in a closed list, no date, a number off its
 * step or under its least — is a fault where it is held and where a route brings it, and the row draws
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
const { editWorkflow, finalGraph, keptRoutes, readWorkflow, workflowFaults, workflowGraph } = await import(new URL('workflow.js', core));
const { queryGraph } = await import(new URL('query-graph.js', core));

const facts = { fields: { status: { label: 'Status' }, plan: { label: 'Plan' }, seats: { label: 'Seats', type: 'number' } }, values: { status: ['active', 'trial'] } };
const flow = (values, more = [], routes = []) => ({
  v: 2, id: 'w',
  nodes: [{ id: 'c', kind: 'condition', x: 300, y: 0, values }, ...more],
  routes,
});
const list = (value) => ({ id: 'l', kind: 'value', x: 0, y: 0, values: { type: 'list', value } });
const row = (g, id, name) => g.nodes.find((n) => n.id === id).rows.find((r) => r.name === name);
const at = (g, id) => g.nodes.find((n) => n.id === id);

test('Is one of takes tags: an object in, free where the values are not known, CLOSED where they are', () => {
  const free = row(workflowGraph(flow({ field: 'plan', op: 'in', value: ['Pro', 'Free'] }), facts), 'c', 'value');
  assert.deepEqual([free.control, free.multiple, free.input, free.value, free.closed, free.fault], ['tags', true, 'object', ['Pro', 'Free'], undefined, undefined]);
  const closed = row(workflowGraph(flow({ field: 'status', op: 'notin', value: ['trial'] }), facts), 'c', 'value');
  assert.deepEqual([closed.control, closed.closed, closed.choices.map((c) => c.value)], ['tags', true, ['active', 'trial']]);
  // Equals stays one value, picked where the values are known.
  assert.deepEqual([row(workflowGraph(flow({ field: 'status', op: 'eq', value: 'trial' }), facts), 'c', 'value').control], ['values']);
  // Is one of is offered on a text or number field with no values known: its tags are typed.
  assert.ok(rowChoices({ control: 'op' }, { type: 'text' }).some((c) => c.value === 'in'));
  assert.ok(!rowChoices({ control: 'op' }, { type: 'date' }).some((c) => c.value === 'in'), 'a date picks its days');
  // Each part its own shape: the second part's Value is tags, the first's one value.
  const two = kindOfNode(NODE_KINDS, { kind: 'condition', values: { op: 'eq', 'op-2': 'in' } });
  assert.deepEqual(['value', 'value-2'].map((n) => two.rows.find((r) => r.name === n)?.control ?? two.rows.find((r) => r.repeat && r.name === 'value').control), ['values', 'tags']);
  const drawn = workflowGraph(flow({ field: 'plan', op: 'eq', value: 'Pro', 'field-2': 'plan', 'op-2': 'in', 'value-2': ['Free'] }), facts);
  assert.deepEqual([row(drawn, 'c', 'value').control, row(drawn, 'c', 'value-2').control], ['text', 'tags']);
});

test('a tag edit is typed by its field, and an operator change carries the value: one becomes a list, a list one', () => {
  let w = flow({ field: 'seats', op: 'in' });
  w = editWorkflow(w, { node: 'c', row: 'value', value: ['5', '10'] }, NODE_KINDS, facts);
  assert.deepEqual(w.nodes[0].values.value, [5, 10], 'a number field\'s tags are numbers');
  w = editWorkflow(flow({ field: 'plan', op: 'eq', value: 'Pro, Free' }), { node: 'c', row: 'op', value: 'in' }, NODE_KINDS, facts);
  assert.deepEqual(w.nodes[0].values.value, ['Pro', 'Free']);
  w = editWorkflow(w, { node: 'c', row: 'op', value: 'eq' }, NODE_KINDS, facts);
  assert.equal(w.nodes[0].values.value, 'Pro, Free', 'and back: off is not gone');
  assert.equal(editWorkflow(flow({ field: 'plan', op: 'in', value: ['Pro'] }), { node: 'c', row: 'op', value: 'ne' }).nodes[0].values.value, 'Pro');
  // A Value's Text becomes its List, and back.
  const v = { v: 2, id: 'w', nodes: [{ id: 'v', kind: 'value', x: 0, y: 0, values: { type: 'text', value: 'a, b' } }] };
  const asList = editWorkflow(v, { node: 'v', row: 'type', value: 'list' });
  assert.deepEqual(asList.nodes[0].values, { type: 'list', value: ['a', 'b'] });
  assert.deepEqual(workflowFaults(asList), []);
  assert.deepEqual(editWorkflow(asList, { node: 'v', row: 'type', value: 'text' }).nodes[0].values, { type: 'text', value: 'a, b' });
  // Saved before tags — a List as text, an Is one of as one pick — it reads once as its list.
  const old = { v: 2, id: 'w', nodes: [list('a, b'), { id: 'c', kind: 'condition', x: 300, y: 0, values: { field: 'plan', op: 'in', value: 'Pro' } }] };
  const read = readWorkflow(old).workflow;
  assert.deepEqual([read.nodes[0].values.value, read.nodes[1].values.value], [['a', 'b'], ['Pro']]);
  assert.deepEqual(workflowFaults(old, NODE_KINDS, facts), []);
});

test('a Value > List routed into Is one of OVERRIDES its tags (D7): read only, its own kept; cut, they are back', () => {
  const own = ['Pro'];
  const routed = flow({ field: 'plan', op: 'in', value: own }, [list(['Free', 'Team'])], [{ from: 'l/value', to: 'c/value' }]);
  assert.deepEqual(workflowFaults(routed, NODE_KINDS, facts), []);
  const shown = row(workflowGraph(routed, facts), 'c', 'value');
  assert.deepEqual([shown.value, shown.custom, shown.hint], [['Free', 'Team'], true, 'Custom values, from Value › Value']);
  assert.deepEqual(routed.nodes[0].values.value, own, 'its own wait in the draft');
  const cut = editWorkflow(routed, { cut: 'c/value' });
  assert.deepEqual(row(workflowGraph(cut, facts), 'c', 'value').value, own);
  // One value is no list: a Text into Is one of stays joined, its Value reads null and the node warns; Save keeps it,
  // and Equals again reads it. Any route joins any input (TODO 770).
  const text = { id: 't', kind: 'value', x: 0, y: 0, values: { value: 'Pro' } };
  const eq = flow({ field: 'plan', op: 'eq' }, [text], [{ from: 't/value', to: 'c/value' }]);
  const inOp = editWorkflow(eq, { node: 'c', row: 'op', value: 'in' }, NODE_KINDS, facts);
  assert.deepEqual([keptRoutes(inOp).length, workflowFaults(inOp, NODE_KINDS, facts), workflowGraph(inOp, facts).routes], [0, [], eq.routes]);
  assert.deepEqual([row(workflowGraph(inOp, facts), 'c', 'value').value, at(workflowGraph(inOp, facts), 'c').warnings], [null, [{ row: 'value', words: 'Value takes a list; it was given "Pro"' }]]);
  assert.deepEqual(finalGraph(inOp).routes, eq.routes, 'Save writes the route, as drawn');
  const again = workflowGraph(editWorkflow(inOp, { node: 'c', row: 'op', value: 'eq' }), facts);
  assert.deepEqual([again.routes, at(again, 'c').warnings, row(again, 'c', 'value').value], [eq.routes, undefined, 'Pro'], 'Equals again: it reads it');
});

test('PLANTED: a stranger in a closed list is a fault, held or brought, and the row says it in words', () => {
  const held = flow({ field: 'status', op: 'in', value: ['active', 'gold'] });
  assert.deepEqual(workflowFaults(held, NODE_KINDS, facts), ['the node "c"\'s Value: "gold" is not a value of Status']);
  assert.equal(row(workflowGraph(held, facts), 'c', 'value').fault, '"gold" is not a value of Status');
  const two = flow({ field: 'status', op: 'in', value: ['gold', 'silver', 'trial'] });
  assert.equal(row(workflowGraph(two, facts), 'c', 'value').fault, '"gold" and "silver" are not values of Status');
  const brought = flow({ field: 'status', op: 'in', value: ['active'] }, [list(['trial', 'gold'])], [{ from: 'l/value', to: 'c/value' }]);
  assert.deepEqual(workflowFaults(brought, NODE_KINDS, facts), ['the route "l/value" → "c/value": "gold" is not a value of Status']);
  assert.equal(row(workflowGraph(brought, facts), 'c', 'value').fault, '"gold" is not a value of Status');
  // The same list into a free row holds: only a closed list refuses.
  assert.deepEqual(workflowFaults(flow({ field: 'plan', op: 'in' }, [list(['gold'])], [{ from: 'l/value', to: 'c/value' }]), NODE_KINDS, facts), []);
  // A Tag's Tags are the same: closed to the field's values.
  const tag = { v: 2, id: 'w', nodes: [{ id: 'g', kind: 'tag', x: 0, y: 0, values: { field: 'status', value: ['trial', 'x'] } }] };
  assert.deepEqual(workflowFaults(tag, NODE_KINDS, facts), ['the node "g"\'s Tags: "x" is not a value of Status']);
  assert.deepEqual([row(workflowGraph(tag, facts), 'g', 'value').control, row(workflowGraph(tag, facts), 'g', 'value').closed], ['tags', true]);
  assert.equal(rowFault({ control: 'tags', closed: true, choices: [{ value: 'a', label: 'a' }] }, ['a']), undefined);
});

test('PLANTED: a Start or End that is no date is a fault, and drawn; a date and time holds', () => {
  const time = (start, end) => ({ v: 2, id: 'w', nodes: [{ id: 't', kind: 'time', x: 0, y: 0, values: { type: 'between', start, end } }] });
  assert.equal(row(workflowGraph(time()), 't', 'start').control, 'datetime');
  assert.deepEqual(workflowFaults(time('2024-01-12', '2024-03-01T10:30')), []);
  const bad = time('2024-02-30', 'next Tuesday');
  assert.deepEqual(workflowFaults(bad), [
    'the node "t"\'s Start: "2024-02-30" is not a date: pick one, or write it as 31 Jan 2024',
    'the node "t"\'s End: "next Tuesday" is not a date: pick one, or write it as 31 Jan 2024',
  ]);
  assert.equal(row(workflowGraph(bad), 't', 'start').fault, '"2024-02-30" is not a date: pick one, or write it as 31 Jan 2024');
  // A date a Value routes in is checked as it comes.
  const routed = { ...time(), nodes: [...time().nodes, { id: 'v', kind: 'value', x: 0, y: 0, values: { type: 'date', value: '2024-13-01' } }], routes: [{ from: 'v/value', to: 't/start' }] };
  assert.ok(workflowFaults(routed).includes('the route "v/value" → "t/start": "2024-13-01" is not a date: pick one, or write it as 31 Jan 2024'));
  // A typed date is kept as given, trimmed: the reader's words are read by the field.
  assert.equal(editWorkflow(time(), { node: 't', row: 'start', value: ' 2024-01-12T09:30 ' }).nodes[0].values.start, '2024-01-12T09:30');
});

test('PLANTED: Places is a whole number from 0, a span\'s Value from 1; a Unit says its words for the count', () => {
  const math = (places) => ({ v: 2, id: 'w', nodes: [{ id: 'm', kind: 'math', x: 0, y: 0, values: { type: 'round', ...(places === undefined ? {} : { places }) } }] });
  assert.deepEqual([row(workflowGraph(math(2)), 'm', 'places').min, row(workflowGraph(math(2)), 'm', 'places').step], [0, 1]);
  assert.deepEqual(workflowFaults(math(2)), []);
  assert.deepEqual(workflowFaults(math(2.5)), ['the node "m"\'s Places: 2.5 is not a whole number']);
  assert.deepEqual(workflowFaults(math(-1)), ['the node "m"\'s Places: -1 is less than 0']);
  assert.equal(row(workflowGraph(math(-1)), 'm', 'places').fault, '-1 is less than 0');
  assert.equal(row(workflowGraph(editWorkflow(math(), { node: 'm', row: 'places', value: 'two' })), 'm', 'places').fault, '"two" is not a number');
  // A Value routed into Places is read as its number.
  const routed = { ...math(), nodes: [...math().nodes, { id: 'v', kind: 'value', x: 0, y: 0, values: { type: 'decimal', value: '1.5' } }], routes: [{ from: 'v/value', to: 'm/places' }] };
  assert.deepEqual(workflowFaults(routed), ['the route "v/value" → "m/places": 1.5 is not a whole number']);
  const span = (n) => ({ v: 2, id: 'w', nodes: [{ id: 'd', kind: 'time', x: 0, y: 0, values: { type: 'duration', when: 'last', n, unit: 'week' } }] });
  assert.deepEqual(workflowFaults(span(0)), ['the node "d"\'s Value: 0 is less than 1']);
  const words = (n) => row(workflowGraph(span(n)), 'd', 'unit').choices.map((c) => c.label);
  assert.deepEqual(words(1), ['day', 'week', 'month', 'year']);
  assert.deepEqual(words(7), ['days', 'weeks', 'months', 'years']);
});

test('the Query draws Is one of with no values to pick as tags, and its Search fields as tags, read only', () => {
  const definition = { v: 1, id: 'p', source: { store: 'customers', search: ['name'], fields: { name: { label: 'Name' }, region: { label: 'Region' } } } };
  const query = { v: 1, scopes: { view: { holds: ['region'], readings: { region: { mode: 'advanced', tree: { op: 'in', value: ['EMEA', 'APAC'] } } } } } };
  const g = queryGraph(query, definition);
  const when = g.nodes.find((n) => n.kind === 'condition');
  const value = when.rows.find((r) => r.name === 'value');
  assert.deepEqual([value.control, value.value, value.editable], ['tags', ['EMEA', 'APAC'], true]);
  const search = g.nodes.find((n) => n.id === 'source').rows.find((r) => r.name === 'search');
  assert.deepEqual([search.control, search.editable, search.value], ['tags', undefined, ['name']]);
});
