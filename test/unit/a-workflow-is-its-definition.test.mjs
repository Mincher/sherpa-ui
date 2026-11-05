/**
 * A WORKFLOW IS ITS DEFINITION: one JSON document of nodes, their values and
 * the routes between their sockets, checked by its schema and by checkWorkflow,
 * which reports each fault and never throws. Its kinds are the ONE registry's;
 * it draws as a graph, and each edit is a pure function that gives a new one.
 * It is a v2: a node's rows leave its Rows row. A v1 is read ONCE as v2, and
 * draws the same nodes and routes. Will, TODO 78 · plan 695 N1 · plan 713 M3, D8.
 * TRAP T-a-workflow-is-its-definition · TRAP T-one-node-registry
 *
 *   node --test test/unit/a-workflow-is-its-definition.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { schemaCheck } from '../../scripts/lib/schema-check.mjs';

const core = new URL('../../dist/core/data/', import.meta.url);
const { NODE_KINDS, socketOf } = await import(new URL('node-kinds.js', core));
const { checkWorkflow, editWorkflow, readWorkflow, workflowFaults, workflowGraph } = await import(new URL('workflow.js', core));
const { onReport } = await import(new URL('report.js', core));

const ROOT = new URL('../../', import.meta.url);
const json = async (path) => JSON.parse(await readFile(new URL(path, ROOT), 'utf8'));
const good = await json('test/unit/fixtures/active-customers.workflow.json');

/** The fixture as v1 saved it, before it was read once as v2: its rows left the headers. */
const SAVED_AS_V1 = {
  $schema: '../../../schemas/workflow.v1.json',
  v: 1, id: 'active-customers', label: 'Active customers',
  nodes: [
    { id: 'start', kind: 'store', x: 0, y: 0, values: { store: 'customers' } },
    { id: 'field', kind: 'field', x: 360, y: 0, values: { field: 'status' } },
    { id: 'status', kind: 'value', x: 360, y: 160, values: { value: 'active' } },
    { id: 'filter', kind: 'condition', x: 720, y: 0, values: { type: 'eq' } },
    { id: 'end', kind: 'output', x: 1080, y: 0 },
  ],
  routes: [{ from: 'start', to: 'field' }, { from: 'field/field', to: 'filter' }, { from: 'status/value', to: 'filter/b' }, { from: 'filter', to: 'end' }],
};

/** What checkWorkflow says of a definition: its answer, and each fault. */
function check(workflow, kinds) {
  const heard = [];
  const undo = onReport((r) => heard.push(r.message.replace('checkWorkflow: ', '')));
  try {
    return { ok: checkWorkflow(workflow, kinds), heard };
  } finally {
    undo();
  }
}

/** The good definition, with one change. */
const with_ = (change) => ({ ...structuredClone(good), ...change });

test('a real workflow passes its schema and the check', () => {
  assert.equal(good.v, 2);
  assert.deepEqual(schemaCheck('workflow.v2.json')(good), []);
  assert.deepEqual(check(good), { ok: true, heard: [] });
});

/** A workflow by id: each node's kind, place and values, and each route by the nodes it joins and the row it enters. */
const byId = (w) => ({
  nodes: w.nodes.map((n) => [n.id, n.kind, n.x, n.y, n.values]),
  routes: (w.routes ?? []).map((r) => [socketOf(r.from).node, socketOf(r.to).node, socketOf(r.to).row]),
});

test('a v1 is read ONCE as v2: each route that sent rows from a header leaves its Rows row; the rest is as it was', () => {
  assert.deepEqual(schemaCheck('workflow.v1.json')(SAVED_AS_V1), []);
  assert.notDeepEqual(schemaCheck('workflow.v2.json')(SAVED_AS_V1), [], 'a v1 is no v2 until it is read');
  const { workflow, faults } = readWorkflow(SAVED_AS_V1);
  assert.deepEqual(faults, []);
  // The converted fixture IS the read: no v1 file is left, and the same graph by id.
  assert.deepEqual(workflow, good);
  // The same graph by id: no kind is renamed on the way (TODO 777).
  assert.deepEqual(byId(good), byId(SAVED_AS_V1));
  assert.deepEqual(good.routes.map((r) => r.from), ['start/rows', 'field/field', 'status/value', 'filter/rows']);
  // A v2 is read as itself; a v1 checks, draws and edits as the v2 it reads as.
  assert.equal(readWorkflow(good).workflow, good);
  assert.deepEqual(check(SAVED_AS_V1), { ok: true, heard: [] });
  assert.deepEqual(workflowGraph(SAVED_AS_V1), workflowGraph(good));
  assert.deepEqual(editWorkflow(SAVED_AS_V1, { node: 'filter', row: 'type', value: 'ne' }), editWorkflow(good, { node: 'filter', row: 'type', value: 'ne' }));
  assert.equal(SAVED_AS_V1.v, 1, 'the one given is untouched');
});

test('a v1 the reader cannot map is reported, and the route that would mean another thing is dropped', () => {
  // An app's kind that sent its rows from its header in v1, and forks now with no Rows row.
  const kinds = { ...NODE_KINDS, tag: { heading: 'Tag', icon: 'price-tag', input: 'any', branches: true, rows: [{ name: 'label', label: 'Label', control: 'text' }], model: 'tag', graphs: ['workflow'] } };
  const v1 = { ...structuredClone(SAVED_AS_V1), nodes: [...SAVED_AS_V1.nodes, { id: 'tag', kind: 'tag', x: 0, y: 0 }], routes: [...SAVED_AS_V1.routes, { from: 'tag', to: 'end' }] };
  const said = 'the v1 route "tag" → "end" sends rows from the header of "tag", whose kind has no Rows row to send them from in v2';
  const { workflow, faults } = readWorkflow(v1, kinds);
  assert.deepEqual(faults, [said]);
  assert.ok(!workflow.routes.some((r) => r.from === 'tag'), 'its header sends True now: the route is not kept');
  assert.deepEqual(check(v1, kinds), { ok: false, heard: [`${said}.`] });
  // Not a workflow at all: neither version.
  for (const odd of [{ v: 3, id: 'x', nodes: [] }, { id: 'x' }, null]) {
    assert.deepEqual(workflowFaults(odd), ['it is not a workflow definition: a v2, or a v1 to read as one']);
  }
});

test('a socket is a node\'s header, or one of its rows', () => {
  assert.deepEqual(socketOf('filter'), { node: 'filter' });
  assert.deepEqual(socketOf('filter/value'), { node: 'filter', row: 'value' });
});

test('ONE registry: every kind once, with a header, its own row names, what it stands for and where it is drawn', () => {
  const headings = new Set();
  for (const [name, kind] of Object.entries(NODE_KINDS)) {
    assert.ok(kind.heading && kind.icon && kind.model && kind.graphs.length, name);
    assert.ok(!headings.has(kind.heading), `${name}: one heading, one kind`);
    headings.add(kind.heading);
    const names = kind.rows.map((row) => row.name);
    assert.equal(new Set(names).size, names.length, name);
  }
  const drawnIn = (graph) => Object.keys(NODE_KINDS).filter((k) => NODE_KINDS[k].graphs.includes(graph));
  assert.deepEqual(drawnIn('workflow'), ['store', 'condition', 'value', 'field', 'math', 'time', 'collection', 'text', 'tag', 'output']);
  // Sort, Group and Count are a Collection's types now: their names are gone, and a file read once (plan 749 P3).
  assert.deepEqual(['sort', 'group', 'count'].map((k) => NODE_KINDS[k]), [undefined, undefined, undefined]);
  assert.deepEqual(drawnIn('query'), ['store', 'status', 'source', 'scope', 'condition', 'preset', 'saved', 'arrange', 'presentation', 'component', 'field']);
  // One meaning per word: a Store is where rows come from, in both; a Condition is one group of the condition tree, in both.
  assert.equal(NODE_KINDS.source.model, 'SourceDefinition');
  assert.equal(NODE_KINDS.filter, undefined, 'the Filter kind is gone: a Condition is the one');
  // No row sends a result: True is on the header, False on the footer. Will, 2026-11-05
  assert.deepEqual(NODE_KINDS.condition.types.rows.rows.map((r) => r.name), ['rows', 'join', 'field', 'op', 'value', 'group']);
});

test('each fault is reported by name, and the check says no', () => {
  const nodes = good.nodes;
  const cases = [
    [{ nodes: [...nodes, { id: 'end', kind: 'output', x: 0, y: 0 }] }, 'two nodes are "end"'],
    [{ nodes: [...nodes, { id: 'odd', kind: 'teleport', x: 0, y: 0 }] }, 'the node "odd" is of the kind "teleport", which is not one'],
    [{ nodes: [...nodes, { id: 'odd', kind: 'scope', x: 0, y: 0 }] }, 'the node "odd" is of the kind "scope", which a workflow does not run'],
    [{ nodes: [...nodes, { id: 'more', kind: 'value', x: 0, y: 0, values: { colour: 'red' } }] }, 'the node "more" holds a value for "colour", a row its kind has not'],
    [{ nodes: [...nodes, { id: 'more', kind: 'condition', x: 0, y: 0, values: { type: 'equals' } }] }, 'the node "more" holds "equals" as its Operation, which is none of its choices'],
    [{ routes: [{ from: 'gone', to: 'filter' }] }, 'a route leaves "gone", which is no output socket'],
    // Rows that hold is gone from a workflow (plan 783 D9): nothing converts it.
    [{ nodes: [...nodes, { id: 'old', kind: 'condition', x: 0, y: 0, values: { type: 'rows' } }] }, 'the node "old" is of the kind "condition", which a workflow does not run'],
    [{ routes: [{ from: 'start/rows', to: 'filter/nope' }] }, 'a route enters "filter/nope", which is no input socket'],
    // A Rows row only sends: the rows come in on the header.
    [{ routes: [{ from: 'start/rows', to: 'filter/rows' }] }, 'a route enters "filter/rows", a Rows row, which only sends: a node\'s rows come in on its header'],
    [{ nodes: [...nodes, { id: 'more', kind: 'store', x: 0, y: 0 }], routes: [{ from: 'start/rows', to: 'filter' }, { from: 'more/rows', to: 'filter' }] }, 'two routes enter "filter", which takes one'],
    [{ routes: [{ from: 'start/rows', to: 'filter' }, { from: 'start/rows', to: 'filter' }] }, 'the route "start/rows" → "filter" is there twice'],
    [{ nodes: [...nodes, { id: 'again', kind: 'condition', x: 0, y: 0 }], routes: [{ from: 'filter/rows', to: 'again' }, { from: 'again', to: 'filter' }] }, 'its routes run in a loop'],
  ];
  for (const [change, said] of cases) {
    const { ok, heard } = check(with_(change));
    assert.equal(ok, false, said);
    assert.ok(heard.includes(`${said}.`), `${said} — heard: ${heard.join(' | ')}`);
  }
  // An object into Value B is no fault: any route joins any input (TODO 770); Value B reads null, and the node warns.
  const rowsIn = with_({ routes: [...good.routes.slice(0, 2), { from: 'start/rows', to: 'filter/b' }] });
  assert.deepEqual(check(rowsIn), { ok: true, heard: [] });
  assert.deepEqual(workflowGraph(rowsIn).nodes.find((n) => n.id === 'filter').warnings, [{ row: 'b', words: 'Value B takes a value; it was given rows' }]);
});

test('an app adds its own kind beside the library\'s', () => {
  const mail = { heading: 'Mail', icon: 'chat', input: 'any', rows: [{ name: 'to', label: 'To', control: 'text' }], model: 'sendMail', graphs: ['workflow'] };
  const kinds = { ...NODE_KINDS, mail };
  // The rows that match, by its True: a header takes any type.
  const workflow = with_({ nodes: [...good.nodes, { id: 'send', kind: 'mail', x: 0, y: 0, values: { to: 'ops' } }], routes: [...good.routes, { from: 'filter', to: 'send' }] });
  // Without its kind, the node is not one — and so neither is its socket.
  assert.deepEqual(check(workflow), { ok: false, heard: [
    'the node "send" is of the kind "mail", which is not one.',
    'a route enters "send", which is no input socket.',
  ] });
  assert.deepEqual(check(workflow, kinds), { ok: true, heard: [] });
});

const fields = { status: { label: 'Status' }, seats: { label: 'Seats', type: 'number' } };
const graph = workflowGraph(good, { fields, stores: ['customers'] });
const node = (id) => graph.nodes.find((n) => n.id === id);
const row = (id, name, g = graph) => g.nodes.find((n) => n.id === id).rows.find((r) => r.name === name);

test('a workflow DRAWS as its kinds say: each node at its place, its rows with its values, and its routes', () => {
  assert.deepEqual(graph.nodes.map((n) => [n.id, n.kind, n.heading, n.x, n.y]), [
    ['start', 'store', 'Store', 0, 0], ['field', 'field', 'Field', 360, 0], ['status', 'value', 'Value', 360, 160], ['filter', 'condition', 'Condition', 720, 0], ['end', 'output', 'Output', 1080, 0],
  ]);
  assert.deepEqual(graph.routes, good.routes);
  // Store › Field › Condition › Output (plan 783): the Condition tests the Field on its header, Value B the Value routed in.
  assert.deepEqual(node('filter').rows.map((r) => [r.name, r.value, !!r.editable]), [['type', 'eq', true], ['rows', undefined, false], ['b', 'active', true]]);
  assert.deepEqual([node('filter').input, node('filter').branches, row('filter', 'rows').output, row('filter', 'rows').input], ['any', true, 'object', undefined]);
  // The Field's list is the facts' fields; its row says its field and type.
  assert.deepEqual([row('field', 'field').choices, row('field', 'field').hint], [[{ value: 'status', label: 'Status' }, { value: 'seats', label: 'Seats' }], 'Status: a text field']);
  assert.deepEqual(row('filter', 'type').choices.slice(0, 3).map((c) => c.label), ['And', 'Or', 'Greater than']);
  assert.deepEqual(row('start', 'store').choices, [{ value: 'customers', label: 'customers' }]);
  // An operator the field's type does not take warns; the Field on Seats takes it.
  const greater = editWorkflow(good, { node: 'filter', row: 'type', value: 'gt' });
  assert.deepEqual(workflowGraph(greater, { fields }).nodes.find((n) => n.id === 'filter').warnings, [{ words: 'Greater than takes a number or date field; it was given the Status column' }]);
  // On Seats it takes Greater than, and Value B takes a number: the Value's "active" warns.
  const numbered = workflowGraph(editWorkflow(greater, { node: 'field', row: 'field', value: 'seats' }), { fields });
  assert.deepEqual(numbered.nodes.find((n) => n.id === 'filter').warnings, [{ row: 'b', words: 'Value B takes a number; it was given "active"' }]);
});

test('each edit is a pure function: a value typed as its row takes it, a place, a name, a route made or cut', () => {
  const before = structuredClone(good);
  const op = editWorkflow(good, { node: 'filter', row: 'type', value: 'ne' });
  assert.deepEqual(op.nodes[3].values, { type: 'ne' });
  assert.deepEqual(good, before, 'the one given is untouched');
  const moved = editWorkflow(good, { node: 'end', set: { x: 800, y: 40 } });
  assert.deepEqual([moved.nodes[4].x, moved.nodes[4].y], [800, 40]);
  const named = editWorkflow(editWorkflow(good, { node: 'end', set: { heading: 'Done' } }), { node: 'end', set: { heading: '' } });
  assert.equal(named.nodes[4].heading, undefined, 'an empty name gives back the kind\'s');
  // A route into an input takes the place of the one there; a cut takes it away.
  const rerouted = editWorkflow(good, { route: { from: 'start/rows', to: 'end' } });
  assert.deepEqual(rerouted.routes.filter((r) => r.to === 'end'), [{ from: 'start/rows', to: 'end' }]);
  assert.deepEqual(editWorkflow(good, { cut: 'filter/b' }).routes.map((r) => r.to), ['field', 'filter', 'end']);
  // A number row's value is typed: an app's kind with one.
  const kinds = { ...NODE_KINDS, top: { heading: 'Top', icon: 'flag', input: 'object', rows: [{ name: 'n', label: 'N', control: 'number' }], model: 'take', graphs: ['workflow'] } };
  const top = editWorkflow(with_({ nodes: [...good.nodes, { id: 'top', kind: 'top', x: 0, y: 0 }] }), { node: 'top', row: 'n', value: '12' }, kinds);
  assert.deepEqual(top.nodes[5].values, { n: 12 });
});

test('SAVE round-trips: definition → graph → edit → definition, checked, and the edit is in it', () => {
  // The reader picks "Does not equal" as the drawn Condition's Operation.
  const drawn = workflowGraph(good, { fields });
  const filter = drawn.nodes.find((n) => n.id === 'filter');
  const op = filter.rows.find((r) => r.name === 'type');
  const saved = editWorkflow(good, { node: filter.id, row: op.name, value: 'ne' });
  assert.deepEqual(schemaCheck('workflow.v2.json')(saved), []);
  assert.deepEqual(check(saved), { ok: true, heard: [] });
  assert.equal(saved.nodes.find((n) => n.id === 'filter').values.type, 'ne');
  assert.equal(row('filter', 'type', workflowGraph(saved, { fields })).value, 'ne');
  // A v1 edited is saved as v2.
  assert.equal(editWorkflow(SAVED_AS_V1, { node: 'filter', row: 'type', value: 'ne' }).v, 2);
});
