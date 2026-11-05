/**
 * A LOGIC TYPE IS AN OPERATOR: the Condition is the Logic family. Its first type, Rows that hold, is the tree
 * (the Query's only one); then And, Or and Figma's six comparisons, Not and Is empty, then Sherpa's operators,
 * each named by the ONE operator list. And of two booleans draws True and False; Compare A against B is a
 * boolean out; a route a type change orphans waits in the draft; a Query's Condition reads back the same tree.
 * Plan 749 P5. TRAP T-a-logic-type-is-an-operator
 *
 *   node --test test/unit/a-logic-type-is-an-operator.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const core = new URL('../../dist/core/data/', import.meta.url);
const { NODE_KINDS, LIST_OPS, kindIn, paletteMatch, paletteOf, resolveKind, socketType, typeChoices } = await import(new URL('node-kinds.js', core));
const { OP_LABELS } = await import(new URL('store.js', core));
const { editWorkflow, finalGraph, keptRoutes, workflowFaults, workflowGraph } = await import(new URL('workflow.js', core));
const { nodeFlow } = await import(new URL('node-flow.js', core));
const { queryGraph, graphRequest } = await import(new URL('query-graph.js', core));
const { answerTree } = await import(new URL('filter-state.js', core));
const { ArrayStore } = await import(new URL('stores.js', core));
const { openSource } = await import(new URL('page-definition.js', core));

const logic = NODE_KINDS.condition;
const node = (g, id) => g.nodes.find((n) => n.id === id);
const names = (n) => n.rows.map((r) => r.name);

test('Logic is the Condition: the tree, Figma\'s eight, Not and Is empty, then Sherpa\'s operators, each named by the one operator list', () => {
  assert.deepEqual(Object.keys(logic.types), [
    'rows', 'and', 'or', 'gt', 'gte', 'lt', 'lte', 'eq', 'ne', 'not', 'empty',
    'contains', 'notcontains', 'startswith', 'endswith', 'in', 'notin', 'between', 'notbetween',
  ]);
  assert.deepEqual([logic.typeLabel, logic.defaultType, logic.category], ['Operation', 'rows', 'Logic']);
  // One vocabulary: a comparison's words are the operator's own, never a copy.
  for (const [id, type] of Object.entries(logic.types)) if (id in OP_LABELS) assert.equal(type.label, OP_LABELS[id], id);
  // A span from today is Time › Duration's: two nodes would do one check.
  assert.deepEqual([logic.types.last, logic.types.next], [undefined, undefined]);
  for (const [id, type] of Object.entries(logic.types)) assert.ok(type.help, `${id} says what it does`);
  assert.equal(logic.types.gt.help, 'True when Value A is greater than Value B');
  assert.equal(logic.types.in.help, 'True when Value A is one of the Values');
  // Each comparison's rows are Value A and what its operator takes.
  const rows = (t) => resolveKind(logic, t).rows.map((r) => [r.name, r.control, r.input, r.multiple]);
  assert.deepEqual(rows('eq'), [['type', 'type', undefined, undefined], ['a', 'text', 'value', undefined], ['b', 'text', 'value', undefined]]);
  assert.deepEqual(rows('in'), [['type', 'type', undefined, undefined], ['a', 'text', 'value', undefined], ['b', 'tags', 'object', true]]);
  assert.deepEqual(rows('between').map(([n]) => n), ['type', 'a', 'start', 'end']);
  assert.deepEqual(rows('and'), [['type', 'type', undefined, undefined]]);
  assert.deepEqual(LIST_OPS, ['in', 'notin']);
  // The Operation select lists them all, in order.
  assert.deepEqual(typeChoices(logic).slice(0, 4).map((c) => c.label), ['Rows that hold', 'And', 'Or', 'Greater than']);
});

test('And of two booleans draws True and False: two comparisons\' True come into its header, which takes many', () => {
  const w = {
    v: 2, id: 'logic',
    nodes: [
      { id: 'active', kind: 'condition', x: 0, y: 0, values: { type: 'eq', a: 'active', b: 'active' } },
      { id: 'big', kind: 'condition', x: 0, y: 200, values: { type: 'gt', a: '120', b: '100' } },
      { id: 'both', kind: 'condition', x: 360, y: 0, values: { type: 'and' } },
      { id: 'end', kind: 'output', x: 720, y: 0 },
    ],
    routes: [{ from: 'active', to: 'both' }, { from: 'big', to: 'both' }, { from: 'both', to: 'end' }],
  };
  assert.deepEqual(workflowFaults(w), []);
  const g = workflowGraph(w);
  const both = node(g, 'both');
  assert.deepEqual(names(both), ['type']);
  assert.deepEqual([both.input, both.many, both.branches], ['boolean', true, true]);
  assert.deepEqual([socketType(both, undefined, 'output'), socketType(both, '#false', 'output')], ['boolean', 'boolean']);
  assert.equal(both.rows[0].hint, 'True when every value that comes in is true');
  const flow = nodeFlow(g, 'both');
  assert.deepEqual(flow.incoming.find((i) => i.socket === 'In'), { socket: 'In', type: 'boolean', from: ['Condition › True', 'Condition › True'] });
  assert.deepEqual(flow.outgoing.map((o) => [o.socket, o.type]), [['True', 'boolean'], ['False', 'boolean']]);
  // Or the same; Not takes ONE boolean: a second is a fault, said in words.
  assert.deepEqual(workflowFaults({ ...w, nodes: w.nodes.map((n) => (n.id === 'both' ? { ...n, values: { type: 'or' } } : n)) }), []);
  const not = { ...w, nodes: w.nodes.map((n) => (n.id === 'both' ? { ...n, values: { type: 'not' } } : n)) };
  assert.deepEqual(workflowFaults(not), ['two routes enter "both", which takes one']);
});

test('Compare A against B is a boolean out: no header input, its values its rows, True and False its sockets', () => {
  const w = {
    v: 2, id: 'compare',
    nodes: [
      { id: 'plan', kind: 'value', x: 0, y: 0, values: { value: 'Pro' } },
      { id: 'is', kind: 'condition', x: 360, y: 0, values: { type: 'eq', b: 'Pro' } },
      { id: 'sum', kind: 'math', x: 720, y: 0 },
      { id: 'end', kind: 'output', x: 720, y: 200 },
    ],
    routes: [{ from: 'plan/value', to: 'is/a' }, { from: 'is', to: 'end' }],
  };
  assert.deepEqual(workflowFaults(w), []);
  const is = node(workflowGraph(w), 'is');
  assert.deepEqual(names(is), ['type', 'a', 'b']);
  assert.deepEqual([is.input, is.branches, socketType(is, undefined, 'output')], [undefined, true, 'boolean']);
  // A routed Value shows in Value A, as any row mirrors one.
  assert.deepEqual(is.rows.map((r) => r.value), ['eq', 'Pro', 'Pro']);
  // PLANTED: its True is a boolean, rows are no value: each joins (TODO 770), no fault, and the node it enters warns.
  const toSum = { ...w, routes: [...w.routes, { from: 'is', to: 'sum/a' }] };
  assert.deepEqual([workflowFaults(toSum), node(workflowGraph(toSum), 'sum').warnings], [[], [{ row: 'a', words: 'Value A takes a number; it was given a boolean' }]]);
  const store = { id: 'start', kind: 'store', x: 0, y: 300, values: { store: 'customers' } };
  const rowsIn = { ...w, nodes: [...w.nodes, store], routes: [{ from: 'start/rows', to: 'is/a' }, { from: 'is', to: 'end' }] };
  assert.deepEqual([workflowFaults(rowsIn), node(workflowGraph(rowsIn), 'is').warnings], [[], [{ row: 'a', words: 'Value A takes a value; it was given rows' }]]);
});

test('a type change keeps in the draft only what loses its socket: Store\'s rows into And stay and warn, into a comparison\'s header they wait; a Field', () => {
  const facts = { fields: { status: { label: 'Status' } }, values: { status: ['active', 'trial'] } };
  let w = {
    v: 2, id: 'draft',
    nodes: [
      { id: 'start', kind: 'store', x: 0, y: 0, values: { store: 'customers' } },
      { id: 'text', kind: 'value', x: 0, y: 200, values: { value: 'trial' } },
      { id: 'c', kind: 'condition', x: 360, y: 0, values: { field: 'status', op: 'eq', value: 'active' } },
    ],
    routes: [{ from: 'start/rows', to: 'c' }],
  };
  assert.equal(node(workflowGraph(w, facts), 'c').input, 'any');
  // And: its header is still there, so the rows stay joined (TODO 770): no fault, the node warns, and Save keeps them.
  w = editWorkflow(w, { node: 'c', row: 'type', value: 'and' });
  assert.deepEqual([keptRoutes(w), workflowFaults(w, NODE_KINDS, facts), workflowGraph(w, facts).routes], [[], [], [{ from: 'start/rows', to: 'c' }]]);
  assert.deepEqual(node(workflowGraph(w, facts), 'c').warnings, [{ words: 'Condition takes a boolean; it was given rows' }]);
  assert.deepEqual(finalGraph(w).routes, [{ from: 'start/rows', to: 'c' }]);
  assert.deepEqual(finalGraph(w).nodes.find((n) => n.id === 'c').values, { type: 'and' });
  // Rows that hold again reads them, its tree's values back.
  const back = editWorkflow(w, { node: 'c', row: 'type', value: 'rows' });
  assert.deepEqual([keptRoutes(back), workflowGraph(back, facts).routes, node(workflowGraph(back, facts), 'c').warnings], [[], [{ from: 'start/rows', to: 'c' }], undefined]);
  assert.deepEqual(node(workflowGraph(back, facts), 'c').rows.map((r) => r.value).slice(0, 5), ['rows', undefined, 'status', 'eq', 'active']);
  // Equals takes nothing on its header: the rows wait in the draft, drawn nowhere, and Save leaves them out.
  let e = editWorkflow(editWorkflow(w, { node: 'c', row: 'type', value: 'eq' }), { node: 'c', row: 'b', value: 'trial' });
  assert.deepEqual([keptRoutes(e), finalGraph(e).routes], [[{ from: 'start/rows', to: 'c' }], []]);
  // A Text routed into B, then Is one of: B's value becomes its list; the Text stays joined, and Values warns.
  e = editWorkflow(e, { route: { from: 'text/value', to: 'c/b' } });
  assert.deepEqual(workflowFaults(e, NODE_KINDS, facts), []);
  e = editWorkflow(e, { node: 'c', row: 'type', value: 'in' });
  assert.deepEqual(e.nodes.find((n) => n.id === 'c').values.b, ['trial']);
  assert.ok(!keptRoutes(e).some((r) => r.from === 'text/value'));
  assert.deepEqual(node(workflowGraph(e, facts), 'c').warnings, [{ row: 'b', words: 'Values takes a list; it was given "trial"' }]);
  assert.deepEqual(workflowFaults(e, NODE_KINDS, facts), []);
  // The Field the draft keeps from the tree names nothing here: Values is free, not closed to Status's values.
  const values = node(workflowGraph(e, facts), 'c').rows.find((r) => r.name === 'b');
  assert.deepEqual([values.control, values.closed, values.fault], ['tags', undefined, undefined]);
  assert.deepEqual(workflowFaults(editWorkflow(e, { node: 'c', row: 'b', value: ['stranger'] }), NODE_KINDS, facts), []);
});

test('the panel: one Condition item naming its types; a search finds a type whole first; the Query\'s Condition is its tree alone', () => {
  const items = paletteOf(NODE_KINDS).flatMap((g) => g.items);
  assert.equal(items.filter((i) => i.id === 'condition').length, 1);
  const found = (q) => items.flatMap((i) => { const hit = paletteMatch(i.kind, q); return hit ? [[i.id, hit.type]] : []; });
  assert.deepEqual(found('equals'), [['condition', 'eq']]);
  assert.deepEqual(found('not'), [['condition', 'not']], 'Not, not Does not equal');
  assert.deepEqual(found('is empty'), [['condition', 'empty']]);
  assert.deepEqual(found('at least'), [['condition', 'gte']]);
  assert.deepEqual(found('and'), [['condition', 'and']]);
  // The Query panel lists the Condition with one type: no select, and its line is its own.
  const query = paletteOf(NODE_KINDS, 'query').flatMap((g) => g.items).find((i) => i.id === 'condition');
  assert.deepEqual(Object.keys(query.kind.types), ['rows']);
  assert.equal(paletteMatch(query.kind, 'equals'), undefined, 'the Query takes no comparison of two values');
  assert.equal(kindIn(logic, 'workflow'), logic);
});

test('a Query\'s Condition reads back the same tree: no Type row, and each row asked as it stands changes nothing', async () => {
  const page = {
    v: 1, id: 'records',
    source: {
      store: 'customers', pageSize: 25,
      fields: { seats: { label: 'Seats', type: 'number' } },
      scopes: { view: { label: 'View', holds: ['seats'], where: { seats: { or: [{ lt: 5 }, { gt: 5, lt: 100 }] } } } },
    },
  };
  const source = await openSource(page.source, new ArrayStore([{ id: 1, seats: 4 }, { id: 2, seats: 50 }], { key: 'id' }));
  const facts = { type: (f) => page.source.fields[f]?.type };
  const tree = () => answerTree(source.query.draft.scopes.view.readings.seats);
  const before = structuredClone(source.query.draft);
  const g = queryGraph(source.query.draft, page, facts);
  const conditions = g.nodes.filter((n) => n.kind === 'condition');
  assert.deepEqual(conditions.map((n) => n.id), ['when-view-seats', 'when-view-seats.2']);
  for (const n of conditions) assert.ok(!n.rows.some((r) => r.name === 'type' || r.control === 'type'), `${n.id} draws no type`);
  // The graph says the tree it was drawn from.
  const leaf = (op, value) => ({ field: 'seats', op, value });
  assert.deepEqual(nodeFlow(g, 'when-view-seats').definition.where, { or: [leaf('lt', 5), { and: [leaf('gt', 5), leaf('lt', 100)] }] });
  assert.deepEqual(tree(), { or: [{ op: 'lt', value: 5 }, { and: [{ op: 'gt', value: 5 }, { op: 'lt', value: 100 }] }] });
  // Every row a reader may change, asked again as it stands: the same tree, and after the first, the same Query.
  const first = tree();
  let settled;
  for (const n of conditions) {
    for (const row of n.rows.filter((r) => r.editable)) {
      await source.query.ask(graphRequest({ node: n, row, value: row.value }, facts));
      assert.deepEqual(tree(), first, `${n.id} › ${row.name}`);
      settled ??= structuredClone(source.query.draft);
      assert.deepEqual(source.query.draft, settled, `${n.id} › ${row.name}: nothing else moved`);
    }
  }
  assert.deepEqual(Object.keys(settled.scopes), Object.keys(before.scopes));
});

test('Tag › Includes says its condition as Logic\'s Is one of: its field, `in`, its tags', () => {
  const w = { v: 2, id: 't', nodes: [{ id: 'g', kind: 'tag', x: 0, y: 0, values: { field: 'status', value: ['trial', 'active'] } }] };
  const g = workflowGraph(w, { fields: { status: { label: 'Status' } }, values: { status: ['active', 'trial'] } });
  assert.deepEqual(nodeFlow(g, 'g').definition, { where: { field: 'status', op: 'in', value: ['trial', 'active'] } });
  assert.equal(logic.types.in.label, OP_LABELS.in);
  // None picked: a list of none, as Is one of with no tags.
  assert.deepEqual(nodeFlow(workflowGraph({ ...w, nodes: [{ ...w.nodes[0], values: { field: 'status' } }] }), 'g').definition, { where: { field: 'status', op: 'in', value: [] } });
  // A Condition of another type says no tree: its rows' values.
  const eq = workflowGraph({ v: 2, id: 'e', nodes: [{ id: 'c', kind: 'condition', x: 0, y: 0, values: { type: 'eq', a: '1', b: '2' } }] });
  assert.deepEqual(nodeFlow(eq, 'c').definition, { rows: { type: 'eq', a: '1', b: '2' } });
});
