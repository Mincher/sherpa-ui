/**
 * A CONDITION IS A TREE OF NODES: one Condition node is ONE group of the condition tree — its join, then
 * each part, a comparison's Field, Operator and Value or a Group row for a nested group, whose own node
 * routes its True in. `A or (B and C)` is two nodes; each edit goes through the Query's one door and
 * reads back the same tree. The workflow's Filter is the Condition it became. Will, plan 713 M4, D3.
 * TRAP T-a-condition-is-a-tree-of-nodes
 *
 *   node --test test/unit/a-condition-is-a-tree-of-nodes.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const core = new URL('../../dist/core/data/', import.meta.url);
const { queryGraph, graphRequest, routeRequest } = await import(new URL('query-graph.js', core));
const { answerTree } = await import(new URL('filter-state.js', core));
const { ArrayStore } = await import(new URL('stores.js', core));
const { openSource } = await import(new URL('page-definition.js', core));
const { NODE_KINDS, accepts, partName, partOf, resolveKind, rowOf, socketOf, socketType } = await import(new URL('node-kinds.js', core));
const { editWorkflow, readWorkflow, workflowFaults, workflowGraph } = await import(new URL('workflow.js', core));

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

test('A or (B and C) is TWO Condition nodes: the group\'s True goes into its parent\'s Group row', async () => {
  const { source, draw } = await opened();
  const g = draw();
  const conditions = g.nodes.filter((n) => n.kind === 'condition');
  assert.deepEqual(conditions.map((n) => n.id), ['when-view-seats', 'when-view-seats.2']);
  // The parent: Any of, A's Field, Operator and Value, then the Group row of part two.
  assert.deepEqual(node(g, 'when-view-seats').rows.map((r) => [r.name, r.value]), [
    ['join', 'or'], ['field', 'seats'], ['op', 'lt'], ['value', 5], ['group-2', 'All of 2 conditions'],
  ]);
  // The child: All of, B's and C's, each part its own Field, Operator and Value.
  assert.deepEqual(node(g, 'when-view-seats.2').rows.map((r) => [r.name, r.value]), [
    ['join', 'and'], ['field', 'seats'], ['op', 'gt'], ['value', 5], ['field-2', 'seats'], ['op-2', 'lt'], ['value-2', 100],
  ]);
  assert.deepEqual(g.routes.filter((r) => r.from.startsWith('when-view-seats')).map((r) => `${r.from} → ${r.to}`), [
    'when-view-seats.2 → when-view-seats/group-2', 'when-view-seats → scope-view/seats',
  ]);
  // Every route joins what it can, and a Group row takes one boolean.
  assert.deepEqual([row(g, 'when-view-seats', 'group-2').input, row(g, 'when-view-seats', 'join').input], ['boolean', undefined]);
  for (const { from, to } of g.routes) {
    const [a, b] = [socketOf(from), socketOf(to)];
    assert.ok(accepts(socketType(node(g, a.node), a.row, 'output'), socketType(node(g, b.node), b.row, 'input')), `${from} → ${to}`);
  }
  // The tree filters as it draws: asked again unchanged, it keeps the rows 4 and 8, fewer than 5 or between 5 and 100.
  await source.query.ask(edit(g, { type: (f) => page.source.fields[f]?.type }, 'when-view-seats', 'op', 'lt'));
  assert.equal(source.total, 2);
});

test('a group is drawn where it stands: (B and C) or A puts the Group row first, and an edit keeps the order', async () => {
  const { source, facts } = await opened();
  await source.query.ask({ scope: 'view', field: 'seats', reading: { tree: { or: [{ and: [{ op: 'gt', value: 5 }, { op: 'lt', value: 100 }] }, { op: 'lt', value: 5 }] }, mode: 'advanced' } });
  const g = queryGraph(source.query.draft, page, facts);
  assert.deepEqual(node(g, 'when-view-seats').rows.map((r) => r.name), ['join', 'group', 'field-2', 'op-2', 'value-2']);
  await source.query.ask(edit(g, facts, 'when-view-seats', 'op-2', 'lte'));
  assert.deepEqual(answerTree(source.query.draft.scopes.view.readings.seats), { or: [{ and: [{ op: 'gt', value: 5 }, { op: 'lt', value: 100 }] }, { op: 'lte', value: 5 }] });
});

test('a Join, a field, an operator and a value each edit through ask() and change the Query, and nothing else', async () => {
  const { source, facts, draw, tree } = await opened();
  const first = tree();
  const query = () => structuredClone(source.query.draft);
  const edits = [
    // The root's join, then the nested group's own.
    ['when-view-seats', 'join', 'and', { or: undefined, and: [{ op: 'lt', value: 5 }, { and: [{ op: 'gt', value: 5 }, { op: 'lt', value: 100 }] }] }],
    ['when-view-seats.2', 'join', 'or', { or: [{ op: 'lt', value: 5 }, { or: [{ op: 'gt', value: 5 }, { op: 'lt', value: 100 }] }] }],
    // An operator, and a value: typed by its field, so a number's 70 is 70.
    ['when-view-seats', 'op', 'lte', { or: [{ op: 'lte', value: 5 }, { and: [{ op: 'gt', value: 5 }, { op: 'lt', value: 100 }] }] }],
    ['when-view-seats', 'value', '7', { or: [{ op: 'lt', value: 7 }, { and: [{ op: 'gt', value: 5 }, { op: 'lt', value: 100 }] }] }],
    ['when-view-seats.2', 'value-2', '70', { or: [{ op: 'lt', value: 5 }, { and: [{ op: 'gt', value: 5 }, { op: 'lt', value: 70 }] }] }],
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
  await source.query.ask(edit(draw(), facts, 'when-view-seats.2', 'op', 'gt'));
  assert.deepEqual(query(), before);
});

test('another field takes the whole tree, as one change; a nested group cannot be moved alone', async () => {
  const { source, facts, draw } = await opened();
  const g = draw();
  const asked = edit(g, facts, 'when-view-seats.2', 'field-2', 'plan');
  assert.equal(asked.length, 2);
  assert.deepEqual([asked[0].field, asked[0].reading, asked[1].field], ['seats', null, 'plan']);
  assert.equal(routeRequest(g, { from: 'when-view-seats.2', to: 'scope-view/seats' }, facts).refused !== undefined, true, 'a nested True goes into its parent, drawn: the Query holds a whole tree');
});

test('a planted fault in each check: an operator the field\'s type does not take, a value of the wrong type; a Group row takes any boolean (780)', () => {
  const nodes = [
    { id: 'start', kind: 'store', x: 0, y: 0, values: { store: 'customers' } },
    { id: 'pick', kind: 'pick', x: 0, y: 100, values: { field: 'seats' } },
    { id: 'when', kind: 'condition', x: 360, y: 0, values: { join: 'or', field: 'seats', op: 'gt', value: 5, 'field-2': 'plan', 'op-2': 'eq', 'value-2': 'Pro' } },
    { id: 'inner', kind: 'condition', x: 0, y: 200, values: { field: 'seats', op: 'lt', value: 100 } },
    { id: 'end', kind: 'output', x: 720, y: 0 },
  ];
  const routes = [{ from: 'start/rows', to: 'when' }, { from: 'inner', to: 'when/group-3' }, { from: 'when/rows', to: 'end' }];
  const fields = { seats: { type: 'number' }, plan: { type: 'text' } };
  const sound = { v: 2, id: 'tree', nodes, routes };
  assert.deepEqual(workflowFaults(sound, NODE_KINDS, { fields }), []);
  const planted = (values, more = {}) => workflowFaults({ ...sound, ...more, nodes: nodes.map((n) => (n.id === 'when' ? { ...n, values: { ...n.values, ...values } } : n)) }, NODE_KINDS, { fields });
  assert.deepEqual(planted({ 'op-2': 'gt' }), ['the node "when" holds "gt" as its Operator, which "plan", a text field does not take']);
  assert.deepEqual(planted({ op: 'contains' }), ['the node "when" holds "contains" as its Operator, which "seats", a number field does not take']);
  assert.deepEqual(planted({ value: 'many' }), ['the node "when" holds "many" as its Value, which is no number, as "seats", a number field takes']);
  assert.deepEqual(planted({ 'value-2': 7 }), [], 'text takes what it is given');
  assert.deepEqual(planted({ op: 'in', value: ['5', '6'] }), [], 'Is one of takes a list of the type');
  // A Group row takes any boolean, no fault (TODO 780): a Condition's True, a pick's, a False; what is no boolean reads null and warns.
  const into = (from) => planted({}, { routes: [routes[0], { from, to: 'when/group-3' }, routes[2]] });
  for (const from of ['inner', 'pick', 'inner/#false', 'start/rows']) assert.deepEqual(into(from), [], from);
  const rows = { ...sound, routes: [routes[0], { from: 'start/rows', to: 'when/group-3' }, routes[2]] };
  assert.deepEqual(workflowGraph(rows, { fields }).nodes.find((n) => n.id === 'when').warnings, [{ row: 'group-3', words: 'Group takes a boolean; it was given rows' }]);
  // A part has no row of a name the kind has not.
  assert.deepEqual(planted({ 'colour-2': 'red' }), ['the node "when" holds a value for "colour-2", a row its kind has not']);
});

test('a workflow Condition draws a part for each comparison it holds, and a Join from two; an edit types a value by its field', () => {
  const w = { v: 2, id: 'w', nodes: [{ id: 'c', kind: 'condition', x: 0, y: 0, values: { field: 'seats', op: 'gt', value: 5, 'field-2': 'plan', 'op-2': 'eq', 'value-2': 'Pro' } }] };
  const fields = { seats: { type: 'number' }, plan: { type: 'text' } };
  const g = workflowGraph(w, { fields });
  assert.deepEqual(g.nodes[0].rows.map((r) => r.name), ['type', 'rows', 'join', 'field', 'op', 'value', 'field-2', 'op-2', 'value-2']);
  assert.equal(row(g, 'c', 'join').value, 'and', 'the join\'s default shows');
  // Each part's operators are its own field's type's.
  assert.ok(row(g, 'c', 'op').choices.some((c) => c.label === 'Greater than'));
  assert.ok(!row(g, 'c', 'op-2').choices.some((c) => c.label === 'Greater than'));
  assert.deepEqual(row(g, 'c', 'join').choices, [{ value: 'and', label: 'All of' }, { value: 'or', label: 'Any of' }]);
  assert.equal(editWorkflow(w, { node: 'c', row: 'value', value: '70' }, NODE_KINDS, { fields }).nodes[0].values.value, 70);
  assert.equal(editWorkflow(w, { node: 'c', row: 'value-2', value: '70' }, NODE_KINDS, { fields }).nodes[0].values['value-2'], '70');
  assert.equal(editWorkflow(w, { node: 'c', row: 'join', value: 'or' }).nodes[0].values.join, 'or');
  // One comparison draws no Join; a Group row is drawn where a route enters it.
  const one = workflowGraph({ ...w, nodes: [{ id: 'c', kind: 'condition', x: 0, y: 0, values: { field: 'seats' } }] }, { fields });
  assert.deepEqual(one.nodes[0].rows.map((r) => r.name), ['type', 'rows', 'field', 'op', 'value']);
  const grouped = workflowGraph({ ...w, nodes: [...w.nodes, { id: 'd', kind: 'condition', x: 0, y: 0 }], routes: [{ from: 'd', to: 'c/group-3' }] }, { fields });
  assert.deepEqual(grouped.nodes[0].rows.map((r) => r.name).slice(-1), ['group-3']);
});

test('the Filter kind is gone, and no file reads as one (TODO 777): a node of it is a fault, in a v1 and a v2', () => {
  assert.equal(NODE_KINDS.filter, undefined);
  const saved = (v) => ({ v, id: 'old', nodes: [{ id: 'f', kind: 'filter', x: 0, y: 0, values: { field: 'status', op: 'eq' } }], routes: [] });
  for (const v of [1, 2]) assert.equal(readWorkflow(saved(v)).workflow.nodes[0].kind, 'filter', `v${v}`);
  assert.deepEqual(workflowFaults(saved(2)), ['the node "f" is of the kind "filter", which is not one']);
  // An app that registers its own `filter` keeps it.
  const mine = { ...NODE_KINDS, filter: { heading: 'Mine', icon: 'flag', rows: [], model: 'mine', graphs: ['workflow'] } };
  assert.equal(readWorkflow({ ...saved(2), nodes: [{ id: 'f', kind: 'filter', x: 0, y: 0 }] }, mine).workflow.nodes[0].kind, 'filter');
});

test('a repeated row is its kind\'s: field-3 is the third part\'s field; field-1 is no row', () => {
  assert.deepEqual([partName('field', 1), partName('field', 3)], ['field', 'field-3']);
  assert.deepEqual([partOf('field-3'), partOf('field'), partOf('field-1'), partOf('join')], [{ base: 'field', part: 3 }, { base: 'field', part: 1 }, { base: 'field-1', part: 1 }, { base: 'join', part: 1 }]);
  const rows = resolveKind(NODE_KINDS.condition).rows;
  assert.equal(rowOf(rows, 'op-4').name, 'op');
  assert.equal(rowOf(rows, 'join-2'), undefined, 'a Join does not repeat');
  assert.equal(rowOf(rows, 'field-1'), undefined);
});
