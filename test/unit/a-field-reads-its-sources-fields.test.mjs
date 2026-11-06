/**
 * A FIELD READS ITS SOURCE'S FIELDS — TODO 817 (Will, 802 pick 1; found by 785 and 783). The fields are keyed BY
 * STORE (`WorkflowFacts.fieldsOf`): a Field's list, its tip words, its stranger check, a Condition's Value B values,
 * its operator warning and a Tag's closed tags read the fields of the store of the first Source up its routes,
 * through the portals. No Source: it offers nothing and warns. A Custom Node's Group Input brings any store's rows;
 * a Preset Filter with no Source reads its own store's (`rowsFrom`).
 *
 *   node --test test/unit/a-field-reads-its-sources-fields.test.mjs
 *
 * TRAP T-a-field-reads-its-sources-fields
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const core = new URL('../../dist/core/data/', import.meta.url);
const { NODE_KINDS } = await import(new URL('node-kinds.js', core));
const { editWorkflow, sentFrom, workflowFaults, workflowGraph } = await import(new URL('workflow.js', core));
const { innerOf } = await import(new URL('node-library.js', core));
const { presetOfEntity } = await import(new URL('preset-filter.js', core));

// Two stores: Health is in both, with other words and values; Seats a number in one, text in the other.
const FIELDS = {
  customers: { status: { label: 'Status', values: ['active', 'trial'] }, health: { label: 'Health', values: ['Good', 'Poor'] }, seats: { label: 'Seats', type: 'number' } },
  devices: { health: { label: 'Device health', values: ['Healthy', 'Critical'] }, type: { label: 'Type', values: ['Laptop', 'Server'] }, seats: { label: 'Seats' } },
};
const facts = { fieldsOf: FIELDS, stores: ['customers', 'devices'] };
const LONE = 'No store\'s rows come in: route a Source in';

const source = (id, store, y = 0) => ({ id, kind: 'source', x: 0, y, values: { store } });
const field = (id, name, y = 0, x = 300) => ({ id, kind: 'field', x, y, values: { field: name } });
const cond = (id, type, y = 0, b) => ({ id, kind: 'condition', x: 600, y, values: { type, ...(b === undefined ? {} : { b }) } });
const portal = (id, type, name, y = 0) => ({ id, kind: 'portal', x: 150, y, values: { type, name } });
const flow = (nodes, routes) => ({ v: 2, id: 'w', nodes, routes });
const route = (...pairs) => pairs.map((p) => { const [from, to] = p.split(' → '); return { from, to }; });
const at = (g, id) => g.nodes.find((n) => n.id === id);
const row = (g, id, name) => at(g, id).rows.find((r) => r.name === name);
const listed = (g, id, name = 'field') => row(g, id, name).choices?.map((c) => c.value);
/** Each node's warnings in words, by its id: none, where it has none. */
const said = (g) => Object.fromEntries(g.nodes.filter((n) => n.warnings).map((n) => [n.id, n.warnings.map((w) => [w.row ?? '', w.words])]));

/** Customers › Health, and Devices › Health, in one graph. */
const both = (c = 'health', d = 'health') => flow(
  [source('c', 'customers'), source('d', 'devices', 300), field('fc', c), field('fd', d, 300)],
  route('c/rows → fc', 'd/rows → fd'),
);

test('two Sources in one graph: each Field lists its own store\'s fields, says its own words, and checks against its own', () => {
  const g = workflowGraph(both(), facts);
  assert.deepEqual([listed(g, 'fc'), listed(g, 'fd')], [['status', 'health', 'seats'], ['health', 'type', 'seats']]);
  assert.deepEqual([row(g, 'fc', 'field').hint, row(g, 'fd', 'field').hint], ['Health: a text field', 'Device health: a text field']);
  assert.deepEqual(said(g), {});
  // A field of the OTHER store is a stranger: it warns and sends nothing. A warning, never a fault (783 D8).
  const crossed = both('type', 'status');
  assert.deepEqual(said(workflowGraph(crossed, facts)), {
    fc: [['field', '"type" is not a field of the rows that come in']],
    fd: [['field', '"status" is not a field of the rows that come in']],
  });
  assert.deepEqual([sentFrom(crossed, 'fc/field', facts), sentFrom(crossed, 'fd/field', facts)], [undefined, undefined]);
  assert.deepEqual(workflowFaults(crossed, NODE_KINDS, facts), []);
  // What it sends is its store's field: its words, its type and its values.
  assert.deepEqual(sentFrom(both(), 'fd/field', facts), { kind: 'field', field: { name: 'health', label: 'Device health', values: ['Healthy', 'Critical'] } });
});

test('the store is read through the routes: past a test\'s Rows to the Field before it, and through a portal', () => {
  // Devices › Field (Type) › Condition › Rows › Field: the second Field reads Devices too.
  const chain = flow([source('d', 'devices'), field('f1', 'type'), cond('c', 'eq', 0, 'Laptop'), field('f2', 'health', 0, 900)], route('d/rows → f1', 'f1/field → c', 'c/rows → f2'));
  assert.deepEqual(listed(workflowGraph(chain, facts), 'f2'), ['health', 'type', 'seats']);
  // Through a portal: no line joins the In and the Out, and the Field still reads the In's Source.
  const hop = flow([source('d', 'devices'), portal('in', 'in', 'devices'), portal('out', 'out', 'devices', 200), field('f', 'type')], route('d/rows → in', 'out/@d/rows → f'));
  const g = workflowGraph(hop, facts);
  assert.deepEqual([listed(g, 'f'), said(g)], [['health', 'type', 'seats'], {}]);
  assert.equal(sentFrom(hop, 'f/field', facts).field.label, 'Type');
  // A Value routed into a Source's Store row names the store its Fields read.
  const named = flow([source('s', 'customers'), { id: 'v', kind: 'value', x: 0, y: 200, values: { value: 'devices' } }, field('f', 'type')], route('v/value → s/store', 's/rows → f'));
  assert.deepEqual([listed(workflowGraph(named, facts), 'f'), said(workflowGraph(named, facts))], [['health', 'type', 'seats'], {}]);
  // Rows of two stores into one And: the Field after it reads the first route's (the header's, in order).
  const joined = flow([
    source('c', 'customers'), source('d', 'devices', 300), field('fc', 'status'), field('fd', 'type', 300),
    cond('tc', 'eq', 0, 'active'), cond('td', 'eq', 300, 'Laptop'), { id: 'and', kind: 'condition', x: 900, y: 0, values: { type: 'and' } }, field('after', 'health', 0, 1200),
  ], route('c/rows → fc', 'd/rows → fd', 'fc/field → tc', 'fd/field → td', 'tc → and', 'td → and', 'and/rows → after'));
  assert.deepEqual(listed(workflowGraph(joined, facts), 'after'), ['status', 'health', 'seats']);
});

test('no Source upstream: a Field offers nothing, warns "route a Source in", and sends nothing; never a fault', () => {
  const lone = flow([field('f', 'status'), cond('c', 'eq', 0, 'active')], route('f/field → c'));
  const g = workflowGraph(lone, facts);
  // Only its own pick, as its own words: no store's fields.
  assert.deepEqual(row(g, 'f', 'field').choices, [{ value: 'status', label: 'status' }]);
  assert.deepEqual(said(g), { f: [['field', LONE]] });
  assert.equal(sentFrom(lone, 'f/field', facts), undefined);
  assert.equal(row(g, 'c', 'b').choices, undefined, 'the Condition after it has no values to offer');
  assert.deepEqual(workflowFaults(lone, NODE_KINDS, facts), []);
  // Placed alone, it says so too.
  assert.deepEqual(said(workflowGraph(flow([field('f')], []), facts)), { f: [['field', LONE]] });
  // A header that warns already says the one warning: a Value is no rows.
  const valued = flow([{ id: 'v', kind: 'value', x: 0, y: 0, values: { value: 'active' } }, field('f', 'status')], route('v/value → f'));
  assert.deepEqual(said(workflowGraph(valued, facts)), { f: [['', 'Field takes an object; it was given "active"']] });
  // With no fields known, the list is open and nothing warns: no facts, no check.
  assert.deepEqual(said(workflowGraph(lone, {})), {});
  // A Source of a store the facts do not know: open too.
  const unknown = flow([source('s', 'orders'), field('f', 'total')], route('s/rows → f'));
  assert.deepEqual(said(workflowGraph(unknown, facts)), {});
});

test('a Condition\'s Value B values, its operator warning and a Tag\'s tags are its Field\'s store\'s', () => {
  const tests = flow([...both().nodes, cond('cc', 'eq'), cond('cd', 'eq', 300), { id: 'tag', kind: 'tag', x: 600, y: 600 }], [...both().routes, ...route('fc/field → cc', 'fd/field → cd', 'fd/field → tag')]);
  const g = workflowGraph(tests, facts);
  assert.deepEqual([listed(g, 'cc', 'b'), listed(g, 'cd', 'b')], [['Good', 'Poor'], ['Healthy', 'Critical']]);
  assert.deepEqual([row(g, 'tag', 'value').closed, listed(g, 'tag', 'value')], [true, ['Healthy', 'Critical']]);
  // A tag its store's field never holds is a fault, in its store's words.
  const gold = { ...tests, nodes: tests.nodes.map((n) => (n.id === 'tag' ? { ...n, values: { value: ['Good'] } } : n)) };
  assert.deepEqual(workflowFaults(gold, NODE_KINDS, facts), ['the node "tag"\'s Tags: "Good" is not a value of Device health']);
  // Seats: a number in Customers, text in Devices. "many" is no number only after Customers; Greater than warns only after Devices.
  const seats = (type, b) => flow([...both('seats', 'seats').nodes, cond('cc', type, 0, b), cond('cd', type, 300, b)], [...both().routes, ...route('fc/field → cc', 'fd/field → cd')]);
  assert.deepEqual(workflowFaults(seats('eq', 'many'), NODE_KINDS, facts), ['the node "cc" holds "many" as its Value B, which is no number, as "seats", a number field takes']);
  assert.deepEqual(said(workflowGraph(seats('gt', '5'), facts)), { cd: [['', 'Greater than takes a number or date field; it was given the Seats column']] });
  // An edit types Value B by its store's field: a number after Customers, text after Devices.
  const typed = (id) => editWorkflow(seats('eq'), { node: id, row: 'b', value: '7' }, NODE_KINDS, facts).nodes.find((n) => n.id === id).values.b;
  assert.deepEqual([typed('cc'), typed('cd')], [7, '7']);
});

test('inside a Custom Node the Group Input brings any store\'s rows: every store\'s fields, the first one\'s words', () => {
  const definition = {
    v: 1, label: 'Has field', inputs: [{ name: 'rows', label: 'Rows', type: 'object' }], outputs: [{ name: 'out', label: 'Out', type: 'object' }],
    nodes: [field('f', 'type')], routes: route('#in/rows → f', 'f/field → #out/out'),
  };
  const drawn = (d) => {
    const inner = innerOf({ id: 'use', kind: 'has-field' }, { v: 1, nodes: { 'has-field': d } });
    return workflowGraph(inner.workflow, facts, inner.kinds);
  };
  const g = drawn(definition);
  assert.deepEqual([listed(g, 'f'), row(g, 'f', 'field').hint, at(g, 'f').warnings], [['status', 'health', 'seats', 'type'], 'Type: a text field', undefined]);
  // A field no store has is a stranger there too.
  const ghost = { ...definition, nodes: [field('f', 'ghost')] };
  assert.deepEqual(said(drawn(ghost)).f, [['field', '"ghost" is not a field of the rows that come in']]);
});

test('a Preset Filter with no Source reads its own store\'s rows: its settings\' source (`rowsFrom`)', () => {
  const preset = (store) => ({
    v: 1, type: 'preset-filter', id: `laptops-${store}`, label: 'Laptops', settings: { source: store },
    graph: { nodes: [field('f', 'type'), cond('c', 'eq', 0, 'Laptop')], routes: route('f/field → c', 'c → #out/where') },
  });
  assert.deepEqual(presetOfEntity(preset('devices'), { fieldsOf: FIELDS }).preset.where, { type: { eq: 'Laptop' } });
  // Over Customers, Type is no field of its rows: no preset, and why.
  assert.match(presetOfEntity(preset('customers'), { fieldsOf: FIELDS }).fault, /"type" is not a field of the rows that come in/);
  // The drawing reads the same fact: the store's fields, and no warning.
  const lone = flow([field('f', 'type')], []);
  const g = workflowGraph(lone, { ...facts, rowsFrom: 'devices' });
  assert.deepEqual([listed(g, 'f'), said(g)], [['health', 'type', 'seats'], {}]);
});
