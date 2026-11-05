/**
 * A LOGIC TYPE IS AN OPERATOR: the Condition is the Logic family, one test each (plan 783 D4). And and Or join the
 * tests that come in; then Figma's six comparisons, Not and Is empty, then Sherpa's operators, each named by the ONE
 * operator list. A comparison tests what comes in on its header (D3): a Field's column, or a value. Every type leads
 * with Rows. A route a type change orphans waits in the draft; a Query's Condition reads back the same tree.
 * Plan 749 P5. TRAP T-a-logic-type-is-an-operator
 *
 *   node --test test/unit/a-logic-type-is-an-operator.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const core = new URL('../../dist/core/data/', import.meta.url);
const { NODE_KINDS, LIST_OPS, ROWS, kindIn, paletteMatch, paletteOf, resolveKind, socketType, typeChoices } = await import(new URL('node-kinds.js', core));
const { OP_LABELS } = await import(new URL('store.js', core));
const { editWorkflow, finalGraph, keptRoutes, sentFrom, workflowFaults, workflowGraph } = await import(new URL('workflow.js', core));
const { nodeFlow } = await import(new URL('node-flow.js', core));
const { queryGraph, graphRequest } = await import(new URL('query-graph.js', core));
const { answerTree } = await import(new URL('filter-state.js', core));
const { ArrayStore } = await import(new URL('stores.js', core));
const { openSource } = await import(new URL('page-definition.js', core));

const logic = NODE_KINDS.condition;
const workflowLogic = kindIn(logic, 'workflow');
const node = (g, id) => g.nodes.find((n) => n.id === id);
const names = (n) => n.rows.map((r) => r.name);
const store = { id: 'start', kind: 'source', x: 0, y: 0, values: { store: 'customers' } };
const field = (id, name) => ({ id, kind: 'field', x: 200, y: 0, values: { field: name } });
const facts = { fieldsOf: { customers: { status: { label: 'Status', values: ['active', 'trial'] }, seats: { label: 'Seats', type: 'number' } } } };

test('Logic is the Condition: And and Or, Figma\'s six, Not and Is empty, then Sherpa\'s operators, each named by the one operator list', () => {
  assert.deepEqual(Object.keys(workflowLogic.types), [
    'and', 'or', 'gt', 'gte', 'lt', 'lte', 'eq', 'ne', 'not', 'empty',
    'contains', 'notcontains', 'startswith', 'endswith', 'in', 'notin', 'between', 'notbetween',
  ]);
  assert.deepEqual([logic.typeLabel, logic.defaultType, logic.category], ['Operation', 'eq', 'Logic']);
  // One vocabulary: a comparison's words are the operator's own, never a copy.
  for (const [id, type] of Object.entries(logic.types)) if (id in OP_LABELS) assert.equal(type.label, OP_LABELS[id], id);
  // A span from today is Time › Duration's: two nodes would do one check.
  assert.deepEqual([logic.types.last, logic.types.next], [undefined, undefined]);
  for (const [id, type] of Object.entries(logic.types)) assert.ok(type.help, `${id} says what it does`);
  assert.equal(logic.types.gt.help, 'True when what comes in is greater than Value B');
  assert.equal(logic.types.in.help, 'True when what comes in is one of the Values');
  // Each type leads with Rows; a comparison's rows are then what its operator takes. Value A is gone (D3).
  const rows = (t) => resolveKind(logic, t).rows.map((r) => [r.name, r.control, r.input, r.multiple]);
  assert.deepEqual(rows('eq'), [['type', 'type', undefined, undefined], ['rows', undefined, undefined, undefined], ['b', 'values', 'value', undefined]]);
  assert.deepEqual(rows('in'), [['type', 'type', undefined, undefined], ['rows', undefined, undefined, undefined], ['b', 'tags', 'object', true]]);
  assert.deepEqual(rows('between').map(([n]) => n), ['type', 'rows', 'start', 'end']);
  assert.deepEqual(rows('and').map(([n]) => n), ['type', 'rows']);
  for (const t of Object.keys(workflowLogic.types)) assert.equal(resolveKind(logic, t).rows[1], ROWS, `${t} leads with Rows`);
  assert.deepEqual(LIST_OPS, ['in', 'notin']);
  // The Operation select lists them all, in order.
  assert.deepEqual(typeChoices(workflowLogic).slice(0, 4).map((c) => c.label), ['And', 'Or', 'Greater than', 'At least']);
});

test('And joins tests: two Conditions on two Fields, their True into its header, which takes many; its Rows the rows that hold', () => {
  const w = {
    v: 2, id: 'logic',
    nodes: [
      store, field('status', 'status'), field('seats', 'seats'),
      { id: 'active', kind: 'condition', x: 400, y: 0, values: { type: 'eq', b: 'active' } },
      { id: 'big', kind: 'condition', x: 400, y: 200, values: { type: 'gt', b: 100 } },
      { id: 'both', kind: 'condition', x: 600, y: 0, values: { type: 'and' } },
      { id: 'end', kind: 'output', x: 800, y: 0 },
    ],
    routes: [
      { from: 'start/rows', to: 'status' }, { from: 'start/rows', to: 'seats' }, { from: 'status/field', to: 'active' }, { from: 'seats/field', to: 'big' },
      { from: 'active', to: 'both' }, { from: 'big', to: 'both' }, { from: 'both/rows', to: 'end' },
    ],
  };
  assert.deepEqual(workflowFaults(w, NODE_KINDS, facts), []);
  const g = workflowGraph(w, facts);
  const both = node(g, 'both');
  assert.deepEqual(names(both), ['type', 'rows']);
  assert.deepEqual([both.input, both.many, both.branches, both.warnings], ['boolean', true, true, undefined]);
  assert.deepEqual([socketType(both, undefined, 'output'), socketType(both, '#false', 'output')], ['boolean', 'boolean']);
  assert.equal(both.rows[0].hint, 'True when every value that comes in is true');
  // Its rows: what the tests' rows carry; with nothing in, none.
  assert.deepEqual([sentFrom(w, 'both/rows', facts), sentFrom({ ...w, routes: [] }, 'both/rows', facts)], [{ kind: 'rows' }, undefined]);
  const flow = nodeFlow(g, 'both');
  assert.deepEqual(flow.incoming.find((i) => i.socket === 'In'), { socket: 'In', type: 'boolean', from: ['Condition › True', 'Condition › True'] });
  assert.deepEqual(flow.outgoing.map((o) => [o.socket, o.type]), [['True', 'boolean'], ['False', 'boolean'], ['Rows', 'object']]);
  // Or the same; Not takes ONE boolean: a second is a fault, said in words.
  assert.deepEqual(workflowFaults({ ...w, nodes: w.nodes.map((n) => (n.id === 'both' ? { ...n, values: { type: 'or' } } : n)) }), []);
  const not = { ...w, nodes: w.nodes.map((n) => (n.id === 'both' ? { ...n, values: { type: 'not' } } : n)) };
  assert.deepEqual(workflowFaults(not), ['two routes enter "both", which takes one']);
});

test('a comparison tests what comes in on its header — a Field\'s column, or a value — against Value B; rows warn: route a Field in', () => {
  const w = {
    v: 2, id: 'compare',
    nodes: [
      { id: 'plan', kind: 'value', x: 0, y: 0, values: { value: 'Pro' } },
      { id: 'is', kind: 'condition', x: 360, y: 0, values: { type: 'eq', b: 'Pro' } },
      { id: 'sum', kind: 'math', x: 720, y: 0 },
      { id: 'end', kind: 'output', x: 720, y: 200 },
    ],
    routes: [{ from: 'plan/value', to: 'is' }, { from: 'is', to: 'end' }],
  };
  assert.deepEqual(workflowFaults(w), []);
  const is = node(workflowGraph(w), 'is');
  assert.deepEqual(names(is), ['type', 'rows', 'b']);
  assert.deepEqual([is.input, is.branches, is.warnings, socketType(is, undefined, 'output')], ['any', true, undefined, 'boolean']);
  // A value came in, no rows: its Rows row sends nothing.
  assert.equal(sentFrom(w, 'is/rows'), undefined);
  // Its True joins a number's row and reads as 1 or 0 (TODO 781); rows into its header join (770), and warn.
  const toSum = { ...w, routes: [...w.routes, { from: 'is', to: 'sum/a' }] };
  assert.deepEqual([workflowFaults(toSum), node(workflowGraph(toSum), 'sum').warnings], [[], undefined]);
  const rowsIn = { ...w, nodes: [...w.nodes, store], routes: [{ from: 'start/rows', to: 'is' }, { from: 'is', to: 'end' }] };
  assert.deepEqual([workflowFaults(rowsIn), node(workflowGraph(rowsIn), 'is').warnings], [[], [{ words: 'Equals takes a field or a value; it was given rows: route a Field in' }]]);
  // Source › Field › Condition: the column fits, and its Rows row sends the rows that hold.
  const chain = { ...rowsIn, nodes: [...rowsIn.nodes, field('f', 'status')], routes: [{ from: 'start/rows', to: 'f' }, { from: 'f/field', to: 'is' }, { from: 'is/rows', to: 'end' }] };
  assert.deepEqual([node(workflowGraph(chain, facts), 'is').warnings, sentFrom(chain, 'is/rows', facts)], [undefined, { kind: 'rows' }]);
  // An operator the field's type does not take warns, never a fault; a Value B of another type is the row's fault.
  const seats = editWorkflow(chain, { node: 'f', row: 'field', value: 'seats' });
  assert.deepEqual(workflowFaults(seats, NODE_KINDS, facts), ['the node "is" holds "Pro" as its Value B, which is no number, as "seats", a number field takes']);
  const contains = editWorkflow(editWorkflow(seats, { node: 'is', row: 'b', value: '5' }, NODE_KINDS, facts), { node: 'is', row: 'type', value: 'contains' });
  assert.equal(contains.nodes.find((n) => n.id === 'is').values.b, 5, 'typed by the Field on its header');
  assert.deepEqual([workflowFaults(contains, NODE_KINDS, facts), node(workflowGraph(contains, facts), 'is').warnings], [[], [{ words: 'Contains takes a text field; it was given the Seats column' }]]);
});

test('a type change keeps in the draft only what loses its socket: a column into And stays and warns; Values closes to the Field\'s values', () => {
  let w = {
    v: 2, id: 'draft',
    nodes: [store, field('f', 'status'), { id: 'text', kind: 'value', x: 0, y: 200, values: { value: 'trial' } }, { id: 'c', kind: 'condition', x: 360, y: 0, values: { type: 'eq', b: 'active' } }],
    routes: [{ from: 'start/rows', to: 'f' }, { from: 'f/field', to: 'c' }],
  };
  assert.equal(node(workflowGraph(w, facts), 'c').input, 'any');
  // And: its header is still there, so the column stays joined (TODO 770): no fault, the node warns, and Save keeps it.
  w = editWorkflow(w, { node: 'c', row: 'type', value: 'and' });
  assert.deepEqual([keptRoutes(w), workflowFaults(w, NODE_KINDS, facts), workflowGraph(w, facts).routes], [[], [], w.routes]);
  assert.deepEqual(node(workflowGraph(w, facts), 'c').warnings, [{ words: 'And takes a boolean; it was given the Status column' }]);
  assert.deepEqual(finalGraph(w).routes, w.routes);
  assert.deepEqual(finalGraph(w).nodes.find((n) => n.id === 'c').values, { type: 'and' }, 'Value B is the draft\'s');
  // Equals again reads it, its Value B back.
  let e = editWorkflow(w, { node: 'c', row: 'type', value: 'eq' });
  assert.deepEqual([keptRoutes(e), node(workflowGraph(e, facts), 'c').warnings, node(workflowGraph(e, facts), 'c').rows.map((r) => r.value)], [[], undefined, ['eq', undefined, 'active']]);
  // A Text routed into B, then Is one of: B's value becomes its list; the Text stays joined, and Values warns.
  e = editWorkflow(e, { route: { from: 'text/value', to: 'c/b' } });
  assert.deepEqual(workflowFaults(e, NODE_KINDS, facts), []);
  e = editWorkflow(e, { node: 'c', row: 'type', value: 'in' });
  assert.deepEqual(e.nodes.find((n) => n.id === 'c').values.b, ['active']);
  assert.ok(!keptRoutes(e).some((r) => r.from === 'text/value'));
  assert.deepEqual(node(workflowGraph(e, facts), 'c').warnings, [{ row: 'b', words: 'Values takes a list; it was given "trial"' }]);
  // The Field on its header closes Values to Status's values: a stranger is the row's fault.
  const values = node(workflowGraph(e, facts), 'c').rows.find((r) => r.name === 'b');
  assert.deepEqual([values.control, values.closed], ['tags', true]);
  assert.deepEqual(workflowFaults(editWorkflow({ ...e, routes: e.routes.slice(0, 2) }, { node: 'c', row: 'b', value: ['stranger'] }), NODE_KINDS, facts), ['the node "c"\'s Values: "stranger" is not a value of Status']);
});

test('the panel: one Condition item naming its types; a search finds a type whole first; the Query\'s takes its tests, not Not or Is empty', () => {
  const items = paletteOf(NODE_KINDS).flatMap((g) => g.items);
  assert.equal(items.filter((i) => i.id === 'condition').length, 1);
  const found = (q) => items.flatMap((i) => { const hit = paletteMatch(i.kind, q); return hit ? [[i.id, hit.type]] : []; });
  assert.deepEqual(found('equals'), [['condition', 'eq']]);
  assert.deepEqual(found('not'), [['condition', 'not']], 'Not, not Does not equal');
  assert.deepEqual(found('is empty'), [['condition', 'empty']]);
  assert.deepEqual(found('at least'), [['condition', 'gte']]);
  assert.deepEqual(found('and'), [['condition', 'and']]);
  assert.deepEqual(found('rows that hold'), [], 'a workflow takes no Rows that hold (plan 783 D4)');
  // The Query draws its trees with the same Condition (plan 783 D6): And, Or and the comparisons; Not and Is empty are a workflow's.
  const query = paletteOf(NODE_KINDS, 'query').flatMap((g) => g.items).find((i) => i.id === 'condition');
  assert.deepEqual(Object.keys(query.kind.types), Object.keys(logic.types).filter((t) => t !== 'not' && t !== 'empty'));
  assert.deepEqual(paletteMatch(query.kind, 'equals'), { type: 'eq' });
  assert.equal(kindIn(logic, 'workflow'), logic, 'a workflow takes every type');
  // And the Field, in Variables.
  assert.deepEqual(paletteOf(NODE_KINDS, 'query').find((g) => g.category === 'Variables').items.map((i) => i.id), ['field']);
});

test('a Query\'s Conditions read back the same tree: each row asked as it stands changes nothing', async () => {
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
  const conditions = g.nodes.filter((n) => n.kind === 'condition' || n.kind === 'field');
  assert.deepEqual(conditions.map((n) => n.id), ['field-view-seats', 'when-view-seats', 'when-view-seats.1', 'when-view-seats.2', 'when-view-seats.2.1', 'when-view-seats.2.2']);
  // An And or an Or lists And and Or; a leaf its field's operators.
  assert.deepEqual(node(g, 'when-view-seats').rows[0].choices.map((c) => c.label), ['And', 'Or']);
  assert.ok(node(g, 'when-view-seats.1').rows[0].choices.some((c) => c.label === 'Greater than'));
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

test('Tag › Includes says its condition as Logic\'s Is one of: the Field on its header, `in`, its tags', () => {
  const w = { v: 2, id: 't', nodes: [{ id: 'g', kind: 'tag', x: 0, y: 0, values: { value: ['trial', 'active'] } }, field('f', 'status'), store], routes: [{ from: 'start/rows', to: 'f' }, { from: 'f/field', to: 'g' }] };
  const g = workflowGraph(w, facts);
  assert.deepEqual(nodeFlow(g, 'g').definition, { where: { field: 'status', op: 'in', value: ['trial', 'active'] } });
  assert.equal(logic.types.in.label, OP_LABELS.in);
  // None picked: a list of none, as Is one of with no tags.
  assert.deepEqual(nodeFlow(workflowGraph({ ...w, nodes: [{ ...w.nodes[0], values: {} }, ...w.nodes.slice(1)] }), 'g').definition, { where: { field: 'status', op: 'in', value: [] } });
  // A comparison with no Field says no tree: its rows' values.
  const eq = workflowGraph({ v: 2, id: 'e', nodes: [{ id: 'c', kind: 'condition', x: 0, y: 0, values: { type: 'eq', b: '2' } }] });
  assert.deepEqual(nodeFlow(eq, 'c').definition, { rows: { type: 'eq', b: '2' } });
});
