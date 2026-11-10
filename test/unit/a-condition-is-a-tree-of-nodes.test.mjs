/**
 * A CONDITION IS A TREE OF NODES: one test per Condition, And and Or joining tests, on a Field node (Will, plan 783
 * D4, D6): "The Graph chain would, at it's simplest, would then be Source>Field>Condition>Output." `A or (B and C)` on
 * Seats is 6 nodes — 1 Field, 3 Conditions, 1 And, 1 Or — in the Query editor as in a workflow; each Query edit goes
 * through the Query's one door and reads back the same tree; the root keeps `when-<scope>-<field>`.
 * TRAP T-a-condition-is-a-tree-of-nodes
 *
 *   node --test test/unit/a-condition-is-a-tree-of-nodes.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const core = new URL('../../dist/core/data/', import.meta.url);
const { queryGraph, graphRequest, placeRequest, routeRequest } = await import(new URL('query-graph.js', core));
const { answerTree } = await import(new URL('filter-state.js', core));
const { ArrayStore } = await import(new URL('stores.js', core));
const { openSource } = await import(new URL('page-definition.js', core));
const { NODE_KINDS, accepts, socketOf, socketType } = await import(new URL('node-kinds.js', core));
const { editWorkflow, readWorkflow, workflowFaults, workflowGraph } = await import(new URL('workflow.js', core));
const { nodeFlow } = await import(new URL('node-flow.js', core));

const page = {
  v: 1, id: 'records',
  source: {
    store: 'customers', pageSize: 25,
    fields: { seats: { label: 'Seats', type: 'number' }, plan: { label: 'Plan' } },
    scopes: {
      // A or (B and C): fewer than 5 seats, or more than 5 and fewer than 100.
      view: { label: 'View', holds: ['seats'], where: { seats: { or: [{ lt: 5 }, { gt: 5, lt: 100 }] } } },
    },
  },
};
const rows = [
  { id: 1, plan: 'Pro', seats: 120 }, { id: 2, plan: 'Free', seats: 4 }, { id: 3, plan: 'Free', seats: 8 }, { id: 4, plan: 'Pro', seats: 5 },
];
const opened = async () => {
  const source = await openSource(page.source, new ArrayStore(rows, { key: 'id' }));
  const facts = { type: (f) => page.source.fields[f]?.type };
  const draw = () => queryGraph(source.query.draft, page, facts);
  const tree = () => answerTree(source.query.draft.scopes.view.readings.seats);
  return { source, facts, draw, tree };
};
const node = (g, id) => g.nodes.find((n) => n.id === id);
const row = (g, id, name) => node(g, id).rows.find((r) => r.name === name);
/** The command an edit of a node's row asks. */
const edit = (g, facts, id, name, value) => graphRequest({ node: node(g, id), row: row(g, id, name), value }, facts);

test('A or (B and C) is 1 Field, 3 Conditions, 1 And and 1 Or: each leaf on the Field, each True into its group, the root into its scope', async () => {
  const { source, draw } = await opened();
  const g = draw();
  const tree = g.nodes.filter((n) => n.kind === 'condition' || n.kind === 'field');
  assert.deepEqual(tree.map((n) => [n.id, n.kind, n.rows.map((r) => [r.name, r.value])]), [
    ['field-view-seats', 'field', [['field', 'seats']]],
    ['when-view-seats', 'condition', [['type', 'or']]],
    ['when-view-seats.1', 'condition', [['type', 'lt'], ['b', 5]]],
    ['when-view-seats.2', 'condition', [['type', 'and']]],
    ['when-view-seats.2.1', 'condition', [['type', 'gt'], ['b', 5]]],
    ['when-view-seats.2.2', 'condition', [['type', 'lt'], ['b', 100]]],
  ]);
  assert.deepEqual(g.routes.filter((r) => /seats/.test(r.from)).map((r) => `${r.from} → ${r.to}`), [
    'field-view-seats/field → when-view-seats.1', 'when-view-seats.1 → when-view-seats',
    'field-view-seats/field → when-view-seats.2.1', 'when-view-seats.2.1 → when-view-seats.2',
    'field-view-seats/field → when-view-seats.2.2', 'when-view-seats.2.2 → when-view-seats.2',
    'when-view-seats.2 → when-view-seats', 'when-view-seats → scope-view/seats',
  ]);
  // An And or an Or takes many booleans; a leaf the Field's column; the Field takes nothing in a Query.
  assert.deepEqual([node(g, 'when-view-seats').input, node(g, 'when-view-seats').many, node(g, 'when-view-seats.1').input, node(g, 'field-view-seats').input], ['boolean', true, 'any', undefined]);
  for (const { from, to } of g.routes) {
    const [a, b] = [socketOf(from), socketOf(to)];
    assert.ok(accepts(socketType(node(g, a.node), a.row, 'output'), socketType(node(g, b.node), b.row, 'input')), `${from} → ${to}`);
  }
  // It reads the tree it was drawn from, as a Preset Filter's graph reads (one reader).
  assert.deepEqual(nodeFlow(g, 'when-view-seats').definition.where, { or: [{ field: 'seats', op: 'lt', value: 5 }, { and: [{ field: 'seats', op: 'gt', value: 5 }, { field: 'seats', op: 'lt', value: 100 }] }] });
  // The tree filters as it draws: asked again unchanged, it keeps the rows 4 and 8.
  await source.query.ask(edit(g, { type: (f) => page.source.fields[f]?.type }, 'when-view-seats.1', 'type', 'lt'));
  assert.equal(source.total, 2);
});

test('a group is drawn where it stands: (B and C) or A puts the And first, and an edit keeps the order', async () => {
  const { source, facts } = await opened();
  await source.query.ask({ scope: 'view', field: 'seats', reading: { tree: { or: [{ and: [{ op: 'gt', value: 5 }, { op: 'lt', value: 100 }] }, { op: 'lt', value: 5 }] }, mode: 'advanced' } });
  const g = queryGraph(source.query.draft, page, facts);
  assert.deepEqual(['when-view-seats.1', 'when-view-seats.2'].map((id) => row(g, id, 'type').value), ['and', 'lt']);
  await source.query.ask(edit(g, facts, 'when-view-seats.2', 'type', 'lte'));
  assert.deepEqual(answerTree(source.query.draft.scopes.view.readings.seats), { or: [{ and: [{ op: 'gt', value: 5 }, { op: 'lt', value: 100 }] }, { op: 'lte', value: 5 }] });
});

test('an And or Or\'s Operation, a leaf\'s Operation and its Value B each edit through ask() and change the Query, and nothing else', async () => {
  const { source, facts, draw, tree } = await opened();
  const first = tree();
  const query = () => structuredClone(source.query.draft);
  const edits = [
    // The root's join, then the nested group's own.
    ['when-view-seats', 'type', 'and', { or: undefined, and: [{ op: 'lt', value: 5 }, { and: [{ op: 'gt', value: 5 }, { op: 'lt', value: 100 }] }] }],
    ['when-view-seats.2', 'type', 'or', { or: [{ op: 'lt', value: 5 }, { or: [{ op: 'gt', value: 5 }, { op: 'lt', value: 100 }] }] }],
    // An operator, and a value: typed by its field, so a number's 70 is 70.
    ['when-view-seats.1', 'type', 'lte', { or: [{ op: 'lte', value: 5 }, { and: [{ op: 'gt', value: 5 }, { op: 'lt', value: 100 }] }] }],
    ['when-view-seats.1', 'b', '7', { or: [{ op: 'lt', value: 7 }, { and: [{ op: 'gt', value: 5 }, { op: 'lt', value: 100 }] }] }],
    ['when-view-seats.2.2', 'b', '70', { or: [{ op: 'lt', value: 5 }, { and: [{ op: 'gt', value: 5 }, { op: 'lt', value: 70 }] }] }],
  ];
  for (const [id, name, value, expected] of edits) {
    await source.query.ask(edit(draw(), facts, id, name, value));
    const clean = JSON.parse(JSON.stringify(expected));
    assert.deepEqual(tree(), clean, `${id} › ${name}`);
    // Nothing else moved: the other scopes and fields are as they were, and the reading is still ONE tree on Seats.
    assert.deepEqual(Object.keys(source.query.draft.scopes.view.readings), ['seats']);
    assert.equal(source.query.draft.scopes.view.suspended, undefined);
    await source.query.ask({ scope: 'view', field: 'seats', reading: { tree: first, mode: 'advanced' } });
    assert.deepEqual(tree(), first, 'put back');
  }
  // An edit that changes nothing reads back the same tree, and the same Query.
  const before = query();
  await source.query.ask(edit(draw(), facts, 'when-view-seats.2.1', 'type', 'gt'));
  assert.deepEqual(query(), before);
  // A range draws Start and End, and each edits its own end.
  await source.query.ask({ scope: 'view', field: 'seats', reading: { tree: { op: 'between', value: [5, 100] }, mode: 'advanced' } });
  assert.deepEqual(draw().nodes.find((n) => n.id === 'when-view-seats').rows.map((r) => [r.name, r.value]), [['type', 'between'], ['start', '5'], ['end', '100']]);
  await source.query.ask(edit(draw(), facts, 'when-view-seats', 'start', '10'));
  assert.deepEqual(tree(), { op: 'between', value: [10, 100] });
  await source.query.ask(edit(draw(), facts, 'when-view-seats', 'end', '50'));
  assert.deepEqual(tree(), { op: 'between', value: [10, 50] });
});

test('the Field picks another field: the whole reading MOVES there, as one change; a part cannot be moved alone', async () => {
  const { facts, draw } = await opened();
  const g = draw();
  const asked = edit(g, facts, 'field-view-seats', 'field', 'plan');
  assert.equal(asked.length, 2);
  assert.deepEqual([asked[0].field, asked[0].reading, asked[1].field], ['seats', null, 'plan']);
  assert.deepEqual(edit(g, facts, 'field-view-seats', 'field', 'seats').field, 'seats', 'the same field: the reading as it is');
  assert.equal(routeRequest(g, { from: 'when-view-seats.2', to: 'scope-view/seats' }, facts).refused !== undefined, true, 'a part\'s True goes into its group, drawn: the Query holds a whole tree');
  assert.equal(routeRequest(g, { from: 'field-view-seats/field', to: 'scope-view/seats' }, facts).refused !== undefined, true, 'a Field is no condition');
});

test('placing a Field in a Query holds the scope\'s next field; a Condition is refused in words: it tests a Field', async () => {
  const { source } = await opened();
  const facts = { holds: (s) => source.query.scope(s), fields: () => ['seats', 'plan'], presets: () => [], on: () => false };
  assert.deepEqual(placeRequest('field', 'view', facts), { request: { scope: 'view', hold: ['seats', 'plan'] } });
  assert.match(placeRequest('condition', 'view', facts).refused, /^A Condition tests a Field: route one in\./);
  assert.match(placeRequest('field', 'view', { ...facts, fields: () => ['seats'] }).refused, /holds every field it may, so it takes no new Field/);
});

/** A or (B and C) on Seats, in a workflow: one Field into three Conditions, an And and an Or (plan 783 D4). */
const seatsFlow = () => ({
  v: 2, id: 'tree',
  nodes: [
    { id: 'start', kind: 'source', x: 0, y: 0, values: { store: 'customers' } },
    { id: 'seats', kind: 'field', x: 200, y: 0, values: { field: 'seats' } },
    { id: 'a', kind: 'condition', x: 400, y: 0, values: { type: 'lt', b: 5 } },
    { id: 'b', kind: 'condition', x: 400, y: 200, values: { type: 'gt', b: 5 } },
    { id: 'c', kind: 'condition', x: 400, y: 400, values: { type: 'lt', b: 100 } },
    { id: 'and', kind: 'condition', x: 600, y: 300, values: { type: 'and' } },
    { id: 'or', kind: 'condition', x: 800, y: 0, values: { type: 'or' } },
    { id: 'end', kind: 'output', x: 1000, y: 0 },
  ],
  routes: [
    { from: 'start/rows', to: 'seats' }, { from: 'seats/field', to: 'a' }, { from: 'seats/field', to: 'b' }, { from: 'seats/field', to: 'c' },
    { from: 'b', to: 'and' }, { from: 'c', to: 'and' }, { from: 'a', to: 'or' }, { from: 'and', to: 'or' }, { from: 'or/rows', to: 'end' },
  ],
});
const fields = { seats: { type: 'number' }, plan: { type: 'text' } };
// The fields of the store the Source names: the Field reads them (TODO 817).
const fieldsOf = { customers: fields };

test('in a workflow, A or (B and C) is one Field into three Conditions, an And and an Or: each test one node, and no fault', () => {
  const w = seatsFlow();
  assert.deepEqual(workflowFaults(w, NODE_KINDS, { fieldsOf }), []);
  const g = workflowGraph(w, { fieldsOf });
  for (const id of ['a', 'b', 'c']) assert.deepEqual(node(g, id).rows.map((r) => r.name), ['type', 'rows', 'b', 'count'], id);
  for (const id of ['and', 'or']) assert.deepEqual(node(g, id).rows.map((r) => r.name), ['type', 'rows'], id);
  assert.ok(g.nodes.every((n) => !n.warnings), 'every route reads what it needs');
  // Each Condition's operators are the Field's type's; an edit types Value B by it.
  assert.equal(editWorkflow(w, { node: 'a', row: 'b', value: '70' }, NODE_KINDS, { fieldsOf }).nodes.find((n) => n.id === 'a').values.b, 70);
  assert.equal(editWorkflow(editWorkflow(w, { node: 'seats', row: 'field', value: 'plan' }), { node: 'a', row: 'b', value: '70' }, NODE_KINDS, { fieldsOf }).nodes.find((n) => n.id === 'a').values.b, '70');
});

test('a planted fault in each check: an operator the Field\'s type does not take warns; a value of the wrong type is a fault', () => {
  const sound = seatsFlow();
  const planted = (id, values) => ({ ...sound, nodes: sound.nodes.map((n) => (n.id === id ? { ...n, values: { ...n.values, ...values } } : n)) });
  const warned = (w) => Object.fromEntries(workflowGraph(w, { fieldsOf }).nodes.filter((n) => n.warnings).map((n) => [n.id, n.warnings.map((x) => x.words)]));
  assert.deepEqual([workflowFaults(planted('a', { type: 'contains' }), NODE_KINDS, { fieldsOf }), warned(planted('a', { type: 'contains' }))], [[], { a: ['Contains takes a text field; it was given the seats column'] }]);
  assert.deepEqual(workflowFaults(planted('b', { b: 'many' }), NODE_KINDS, { fieldsOf }), ['the node "b" holds "many" as its Value B, which is no number, as "seats", a number field takes']);
  assert.deepEqual(workflowFaults(planted('c', { type: 'in', b: ['5', '6'] }), NODE_KINDS, { fieldsOf }), [], 'Is one of takes a list of the type');
  // On a text Field, text takes what it is given.
  assert.deepEqual(workflowFaults(planted('seats', { field: 'plan' }), NODE_KINDS, { fieldsOf }), [], 'text takes what it is given');
  // A Condition has no row of a name its type has not; the Group row and the Join are gone (D4).
  assert.deepEqual(workflowFaults(planted('a', { colour: 'red' })), ['the node "a" holds a value for "colour", a row its kind has not']);
  assert.deepEqual(workflowFaults(planted('or', { join: 'or' })), ['the node "or" holds a value for "join", a row its kind has not']);
});

test('the Filter kind is gone, and no file reads as one (TODO 777): a node of it is a fault', () => {
  assert.equal(NODE_KINDS.filter, undefined);
  const saved = (v) => ({ v, id: 'old', nodes: [{ id: 'f', kind: 'filter', x: 0, y: 0, values: { field: 'status', op: 'eq' } }], routes: [] });
  assert.equal(readWorkflow(saved(2)).workflow.nodes[0].kind, 'filter');
  assert.deepEqual(workflowFaults(saved(2)), ['the node "f" is of the kind "filter", which is not one']);
});
