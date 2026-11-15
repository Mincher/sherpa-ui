/**
 * A GRAPH IS DRAWN BY ITS TYPE: one door, `workflowGraph`, draws a workflow and a page's filter graph alike, each by its
 * `graph` (plan 1004b). A filter graph has no Start, and only the kinds, types and rows a Query takes; its checks say so in
 * its own words. TRAP T-a-graph-is-drawn-by-its-type
 *
 *   node --test test/unit/a-graph-is-drawn-by-its-type.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const core = new URL('../../dist/core/data/', import.meta.url);
const { kindIn, NODE_KINDS, rowChoices } = await import(new URL('node-kinds.js', core));
const { workflowFaults, workflowGraph } = await import(new URL('workflow.js', core));

const def = (nodes, graph) => ({ v: 3, id: 'g', nodes, ...(graph ? { graph } : {}) });
const SOURCE = { id: 'src', kind: 'source', x: 0, y: 0, values: { store: 'customers' } };
const CHECK = { id: 'c', kind: 'condition', x: 300, y: 0, values: { type: 'eq' } };
const drawn = (nodes, graph) => workflowGraph(def(nodes, graph));
const node = (g, id) => g.nodes.find((n) => n.id === id);

test('a workflow has its Start; a filter graph has none, and no Trigger is told to join one', () => {
  assert.ok(node(drawn([SOURCE]), '#start'), 'a workflow');
  assert.equal(node(drawn([SOURCE], 'query'), '#start'), undefined, 'a filter graph');
  assert.ok(node(drawn([SOURCE], 'workflow'), '#start'), 'a workflow, said');
  const trigger = { id: 't', kind: 'trigger', x: 0, y: 0, values: { type: 'action' } };
  const told = (graph) => (node(drawn([trigger], graph), 't').warnings ?? []).some((w) => w.words === 'Connect it to the Start');
  assert.equal(told(), true, 'a workflow\'s Trigger');
  assert.equal(told('query'), false, 'a filter graph\'s');
});

test('a filter graph draws only the rows a Query takes: a Source has no Fields there', () => {
  const rows = (graph) => node(drawn([SOURCE], graph), 'src').rows.map((r) => r.name);
  assert.ok(rows().includes('fields'), 'a workflow\'s Source has its Fields');
  assert.ok(!rows('query').includes('fields'), 'a filter graph\'s has none');
});

test('a filter graph offers only the types a Query takes: a Condition has no Not and no Is empty there', () => {
  const types = (graph) => node(drawn([CHECK], graph), 'c').rows.find((r) => r.name === 'type').choices.map((c) => c.value);
  assert.ok(types().includes('not') && types().includes('empty'), 'a workflow offers both');
  assert.deepEqual(types('query').filter((t) => t === 'not' || t === 'empty'), []);
});

test('a kind the graph does not take is a fault in that graph\'s words; one it takes is none', () => {
  const trigger = { id: 't', kind: 'trigger', x: 0, y: 0, values: { type: 'action' } };
  const filters = { id: 'vf', kind: 'view-filters', x: 0, y: 0 };
  const faults = (nodes, graph) => workflowFaults(def(nodes, graph)).filter((f) => f.includes('does not'));
  assert.deepEqual(faults([filters]), ['the node "vf" is of the kind "view-filters", which a workflow does not run']);
  assert.deepEqual(faults([filters], 'query'), []);
  assert.deepEqual(faults([trigger], 'query'), ['the node "t" is of the kind "trigger", which a page\'s filter graph does not draw']);
});

test('kindIn gives the kind itself where nothing is left out, and a kind the graph does not take none', () => {
  assert.equal(kindIn(NODE_KINDS['value'], 'workflow'), NODE_KINDS['value']);
  // A Field's Statuses is a Query's alone (plan 1004 D4).
  assert.deepEqual(kindIn(NODE_KINDS['field'], 'workflow').rows.map((r) => r.name), ['field', 'values']);
  assert.equal(kindIn(NODE_KINDS['trigger'], 'query'), undefined);
  // A Source's Fields is a workflow's; its Page size, Search fields and Apply on a Query's (plan 1004 D3).
  const rows = (graph) => kindIn(NODE_KINDS['source'], graph).rows.map((r) => r.name);
  assert.deepEqual([rows('workflow'), rows('query')], [['rows', 'store', 'fields'], ['rows', 'store', 'pageSize', 'search', 'applyOn']]);
});

test('a lens node is drawn as its lens says: its ref untouched, its icon and warnings, no row it omits, only the rows it names editable, each row\'s words (plan 1004d)', () => {
  const lens = { ...CHECK, ref: { scope: 'view', field: 'status' }, editable: ['b'], hints: { type: 'Its chip changes it' }, off: true, icon: 'filter', warnings: [{ words: 'Not the page\'s Source' }] };
  const at = node(drawn([lens], 'query'), 'c');
  assert.deepEqual(at.ref, { scope: 'view', field: 'status' });
  assert.equal(at.icon, 'filter');
  assert.ok(at.warnings.some((w) => w.words === 'Not the page\'s Source'));
  const rows = Object.fromEntries(at.rows.map((r) => [r.name, r]));
  assert.equal(rows.type.editable, false, 'a row the lens does not name is read only');
  assert.equal(rows.b.editable, true);
  assert.equal(rows.type.hint, 'Its chip changes it');
  // A row the lens leaves out is not drawn there: a kept Source has no page rows (D8).
  const kept = node(drawn([{ ...SOURCE, omit: ['pageSize', 'search', 'applyOn'] }], 'query'), 'src').rows.map((r) => r.name);
  assert.deepEqual(kept, ['rows', 'store']);
  // A kept graph's node names none: every row it can change, it may.
  assert.equal(node(drawn([CHECK]), 'c').rows.find((r) => r.name === 'type').editable, true);
});

/** A page's rows, a Field of a text and one of a number, each into a test, and both tests' Pass into a group (plan 1004 D5, D6). */
const FIELDS = { customers: { region: { label: 'Region', type: 'text', values: ['EMEA', 'APAC'] }, seats: { label: 'Seats', type: 'number' } } };
const TREE = [
  SOURCE,
  { id: 'f1', kind: 'field', x: 200, y: 0, values: { field: 'region' } }, { id: 'f2', kind: 'field', x: 200, y: 200, values: { field: 'seats' } },
  { id: 't1', kind: 'condition', x: 400, y: 0, values: { type: 'eq', b: 'EMEA' } }, { id: 't2', kind: 'condition', x: 400, y: 200, values: { type: 'gt', b: 3 } },
  { id: 'g', kind: 'condition', x: 600, y: 0, values: { type: 'and' } },
];
const JOINS = [{ from: 'src', to: 'f1' }, { from: 'src', to: 'f2' }, { from: 'f1/field', to: 't1' }, { from: 'f2/field', to: 't2' }, { from: 't1/pass', to: 'g' }, { from: 't2/pass', to: 'g' }];
const tree = (graph) => workflowGraph({ ...def(TREE, graph), connections: JOINS }, { fieldsOf: FIELDS });

test('in a filter graph no node drives a value: a row with a control takes no connection; a header and a row of none still do (D5)', () => {
  const inputs = (graph, id) => node(tree(graph), id).rows.filter((r) => r.input && r.control).map((r) => r.name);
  assert.deepEqual(inputs('query', 't1'), [], 'a test\'s Value B is the reader\'s');
  assert.deepEqual(inputs('query', 'f1'), [], 'a Field\'s field too');
  assert.ok(inputs(undefined, 't1').includes('b'), 'a workflow\'s Value B takes a line');
  assert.equal(node(tree('query'), 't1').input, 'any', 'the header still takes the column');
  assert.equal(tree('query').connections.length, JOINS.length, 'each line is drawn');
});

test('in a filter graph a type pick keeps the node\'s shape: a test is offered no And or Or, a group only And and Or (D6)', () => {
  const types = (graph, id) => node(tree(graph), id).rows.find((r) => r.name === 'type').choices.map((c) => c.value);
  assert.deepEqual(types('query', 't1'), ['eq', 'ne', 'contains', 'notcontains', 'startswith', 'endswith', 'in', 'notin'], 'a text field\'s');
  assert.deepEqual(types('query', 't2'), ['gt', 'gte', 'lt', 'lte', 'eq', 'ne', 'in', 'notin', 'between', 'notbetween'], 'a number field\'s');
  assert.deepEqual(types('query', 'g'), ['and', 'or']);
  assert.ok(types(undefined, 't1').includes('and'), 'a workflow\'s test may become a group');
});

test('a single pick that may be empty offers None first, picked or not, in every graph; one that may not says Pick one while empty (D7)', () => {
  const choices = (row) => rowChoices(row, { stores: ['customers'] }).map((c) => c.label);
  const pick = { control: 'pick', choices: [{ value: 'a', label: 'A' }] };
  assert.deepEqual(choices({ ...pick, optional: true }), ['None', 'A']);
  assert.deepEqual(choices({ ...pick, optional: true, value: 'a' }), ['None', 'A']);
  assert.deepEqual(choices(pick), ['Pick one', 'A']);
  assert.deepEqual(choices({ ...pick, value: 'a' }), ['A']);
  assert.deepEqual(choices({ control: 'store', optional: true, value: 'customers' }), ['None', 'customers']);
  assert.deepEqual(choices({ control: 'store' }), ['Pick a store', 'customers']);
  assert.deepEqual(choices({ ...pick, optional: true, multiple: true }), ['A'], 'a many pick clears by its ticks');
  assert.equal(choices({ control: 'direction', optional: true })[0], 'None', 'a fixed list too: a Segment order');
  assert.notEqual(choices({ control: 'direction' })[0], 'None');
});
