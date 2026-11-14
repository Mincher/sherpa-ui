/**
 * A WORKFLOW IS ITS DEFINITION: one JSON document of nodes, their values and
 * the connections between their sockets, checked by its schema and by checkWorkflow,
 * which reports each fault and never throws. Its kinds are the ONE registry's;
 * it draws as a graph, and each edit is a pure function that gives a new one.
 * It is a v2: a node's rows leave its Rows row; no v1 ships, and none is read
 * (Will, 2026-11-10). Will, TODO 78 · plan 695 N1 · plan 713 M3, D8.
 * TRAP T-a-workflow-is-its-definition · TRAP T-one-node-registry
 *
 *   node --test test/unit/a-workflow-is-its-definition.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { schemaCheck } from '../../scripts/lib/schema-check.mjs';

const core = new URL('../../dist/core/data/', import.meta.url);
const { NODE_KINDS, downstreamOf, socketOf } = await import(new URL('node-kinds.js', core));
const { checkWorkflow, editWorkflow, readWorkflow, workflowFaults, workflowGraph } = await import(new URL('workflow.js', core));
const { onReport } = await import(new URL('report.js', core));

const ROOT = new URL('../../', import.meta.url);
const json = async (path) => JSON.parse(await readFile(new URL(path, ROOT), 'utf8'));
const good = await json('test/unit/fixtures/active-customers.workflow.json');

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
  assert.equal(good.v, 3);
  assert.deepEqual(schemaCheck('workflow.v3.json')(good), []);
  assert.deepEqual(check(good), { ok: true, heard: [] });
});

test('a v3 is read as itself; anything else is no workflow, and says so: a v2, kept before plan 934, too (plan 960 D4)', () => {
  assert.equal(readWorkflow(good).workflow, good);
  assert.deepEqual(good.connections.map((r) => r.from), ['start/rows', 'field/field', 'status/value', 'filter/pass']);
  const kept = { v: 2, id: 'old', nodes: good.nodes, routes: good.connections };
  for (const odd of [kept, { v: 1, id: 'x', nodes: [] }, { v: 4, id: 'x', nodes: [] }, { id: 'x' }, null]) {
    assert.deepEqual(workflowFaults(odd), ['it is not a workflow definition: a v3']);
  }
});

test('a socket is a node\'s header, or one of its rows', () => {
  assert.deepEqual(socketOf('filter'), { node: 'filter' });
  assert.deepEqual(socketOf('filter/value'), { node: 'filter', row: 'value' });
});

test('downstream: every node the connections lead to from the given ones, and on from each; the given left out (TODO 889)', () => {
  const connections = [{ from: 'a/rows', to: 'b' }, { from: 'b/x', to: 'c/y' }, { from: 'c', to: 'a' }, { from: 'd', to: 'c' }];
  assert.deepEqual([...downstreamOf(connections, ['a'])].sort(), ['b', 'c'], 'a loop back to a stops at a');
  assert.deepEqual([...downstreamOf(connections, ['d'])].sort(), ['a', 'b', 'c']);
  assert.deepEqual([...downstreamOf(connections, ['a', 'b'])].sort(), ['c'], 'a given node is never its own downstream');
  assert.deepEqual([...downstreamOf(connections, [])], []);
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
  // The Condition is drawn in both, with no Branch (plan 971 §9), and so is Organise (plan 960 U4.2); a Trigger in a workflow
  // alone (plan 941).
  assert.deepEqual(drawnIn('workflow'), ['trigger', 'source', 'condition', 'fork', 'boolean', 'organise', 'value', 'field', 'math', 'time', 'text', 'portal', 'model', 'prompt', 'runbook', 'skill', 'notify', 'content', 'response', 'result', 'request', 'output-trigger']);
  // Sort and Group are rows of the one Organise kind (plan 960 U4.2); Collection and its Count are gone, a Count a type of
  // Math (plan 944).
  assert.deepEqual([NODE_KINDS.collection, NODE_KINDS.count, NODE_KINDS.sort, NODE_KINDS.group, NODE_KINDS.organise.category], [undefined, undefined, undefined, undefined, 'Organise']);
  assert.equal(NODE_KINDS.math.types.count.label, 'Count');
  // A page's Query draws View Filters, each card's Presentation and the View (plan 960 U4.8).
  assert.deepEqual(drawnIn('query'), ['source', 'view-filters', 'condition', 'preset', 'organise', 'presentation', 'view', 'field']);
  // One meaning per word: a Source is where rows come from, in both, and the Store kind is gone (TODO 808); a Condition
  // is one test, in both (plan 783 D4).
  assert.equal(NODE_KINDS.source.model, 'SourceDefinition');
  assert.equal(NODE_KINDS.store, undefined, 'the Store kind is gone: a Source names its store');
  assert.equal(NODE_KINDS.filter, undefined, 'the Filter kind is gone: a Condition is the one');
  // No True or False socket, and no True row: a test's Pass and Fail are rows (plans 944, 971 §9).
  assert.deepEqual(NODE_KINDS.condition.types.eq.rows.map((r) => r.name), ['pass', 'fail', 'data', 'b']);
});

test('each fault is reported by name, and the check says no', () => {
  const nodes = good.nodes;
  const cases = [
    [{ nodes: [...nodes, { id: 'end', kind: 'result', x: 0, y: 0 }] }, 'two nodes are "end"'],
    [{ nodes: [...nodes, { id: 'odd', kind: 'teleport', x: 0, y: 0 }] }, 'the node "odd" is of the kind "teleport", which is not one'],
    [{ nodes: [...nodes, { id: 'odd', kind: 'view-filters', x: 0, y: 0 }] }, 'the node "odd" is of the kind "view-filters", which a workflow does not run'],
    [{ nodes: [...nodes, { id: 'more', kind: 'value', x: 0, y: 0, values: { colour: 'red' } }] }, 'the node "more" holds a value for "colour", a row its kind has not'],
    [{ nodes: [...nodes, { id: 'more', kind: 'condition', x: 0, y: 0, values: { type: 'equals' } }] }, 'the node "more" holds "equals" as its Check, which is none of its choices'],
    [{ connections: [{ from: 'gone', to: 'filter' }] }, 'a connection leaves "gone", which is no output socket'],
    // Rows that hold is gone from a workflow (plan 783 D9): nothing converts it.
    [{ nodes: [...nodes, { id: 'old', kind: 'condition', x: 0, y: 0, values: { type: 'rows' } }] }, 'the node "old" holds "rows" as its Check, which is none of its choices'],
    [{ connections: [{ from: 'start/rows', to: 'filter/nope' }] }, 'a connection enters "filter/nope", which is no input socket'],
    // A Rows row only sends: the rows come in on the header.
    [{ connections: [{ from: 'status/value', to: 'start/rows' }] }, 'a connection enters "start/rows", its Results row, which only sends: what a node takes comes in on its header or an input row'],
    [{ nodes: [...nodes, { id: 'more', kind: 'source', x: 0, y: 0 }], connections: [{ from: 'start/rows', to: 'filter' }, { from: 'more/rows', to: 'filter' }] }, 'two connections enter "filter", which takes one'],
    [{ connections: [{ from: 'start/rows', to: 'filter' }, { from: 'start/rows', to: 'filter' }] }, 'the connection "start/rows" → "filter" is there twice'],
    [{ nodes: [...nodes, { id: 'again', kind: 'condition', x: 0, y: 0 }], connections: [{ from: 'filter/pass', to: 'again' }, { from: 'again', to: 'filter' }] }, 'its connections run in a loop'],
  ];
  for (const [change, said] of cases) {
    const { ok, heard } = check(with_(change));
    assert.equal(ok, false, said);
    assert.ok(heard.includes(`${said}.`), `${said} — heard: ${heard.join(' | ')}`);
  }
  // An object into Value B is no fault: any connection joins any input (TODO 770); Value B reads null, and the node warns.
  const rowsIn = with_({ connections: [...good.connections.slice(0, 2), { from: 'start/rows', to: 'filter/b' }] });
  assert.deepEqual(check(rowsIn), { ok: true, heard: [] });
  assert.deepEqual(workflowGraph(rowsIn).nodes.find((n) => n.id === 'filter').warnings, [{ row: 'b', words: 'Value B takes a value; it was given rows' }]);
});

test('an app adds its own kind beside the library\'s', () => {
  const mail = { heading: 'Mail', icon: 'chat', input: 'any', rows: [{ name: 'to', label: 'To', control: 'text' }], model: 'sendMail', graphs: ['workflow'] };
  const kinds = { ...NODE_KINDS, mail };
  // The rows that match, by its Pass (a Condition's header sends nothing, plan 944): a header takes any type.
  const workflow = with_({ nodes: [...good.nodes, { id: 'send', kind: 'mail', x: 0, y: 0, values: { to: 'ops' } }], connections: [...good.connections, { from: 'filter/pass', to: 'send' }] });
  // Without its kind, the node is not one — and so neither is its socket.
  assert.deepEqual(check(workflow), { ok: false, heard: [
    'the node "send" is of the kind "mail", which is not one.',
    'a connection enters "send", which is no input socket.',
  ] });
  assert.deepEqual(check(workflow, kinds), { ok: true, heard: [] });
});

const fields = { status: { label: 'Status' }, seats: { label: 'Seats', type: 'number' } };
// The fields of each store: the Field reads those of its Source's, customers (TODO 817).
const fieldsOf = { customers: fields };
const graph = workflowGraph(good, { fieldsOf, stores: ['customers'] });
const node = (id) => graph.nodes.find((n) => n.id === id);
const row = (id, name, g = graph) => g.nodes.find((n) => n.id === id).rows.find((r) => r.name === name);

test('a workflow DRAWS as its kinds say: each node at its place, its rows with its values, and its connections', () => {
  assert.deepEqual(graph.nodes.map((n) => [n.id, n.kind, n.heading, n.x, n.y]), [
    ['start', 'source', 'Source', 0, 0], ['field', 'field', 'Field', 360, 0], ['status', 'value', 'Value', 360, 160], ['filter', 'condition', 'Condition', 720, 0], ['end', 'result', 'Run result', 1080, 0],
    // A top graph's Start, always there, left of its nodes: no Trigger joins it (plan 949).
    ['#start', '#start', 'Start', -360, 0],
  ]);
  assert.deepEqual(graph.connections, good.connections);
  // Source › Field › Condition › Output (plan 783): the Condition tests the Field on its header, Value B the Value connected in.
  // Its Pass and Fail are rows, and it forks no more (plans 944, 971); its Data a row of its own, and no True (971 §9).
  assert.deepEqual(node('filter').rows.map((r) => [r.name, r.value, !!r.editable]), [['type', 'eq', true], ['pass', undefined, false], ['fail', undefined, false], ['data', undefined, false], ['b', 'active', true]]);
  assert.deepEqual([node('filter').input, node('filter').branches, ...['pass', 'fail'].flatMap((r) => [row('filter', r).output, row('filter', r).input])], ['any', undefined, 'object', undefined, 'object', undefined]);
  // The Field's list is its Source's store's fields; its row says its field and type.
  assert.deepEqual([row('field', 'field').choices, row('field', 'field').hint], [[{ value: 'status', label: 'Status' }, { value: 'seats', label: 'Seats' }], 'Status: a text field']);
  // A text column in: the types that fit text (TODO 940).
  assert.deepEqual(row('filter', 'type').choices.map((c) => c.value), ['and', 'or', 'eq', 'ne', 'empty', 'contains', 'notcontains', 'startswith', 'endswith', 'in', 'notin']);
  assert.deepEqual(row('start', 'store').choices, [{ value: 'customers', label: 'customers' }]);
  // An operator the field's type does not take warns; the Field on Seats takes it.
  const greater = editWorkflow(good, { node: 'filter', row: 'type', value: 'gt' });
  assert.deepEqual(workflowGraph(greater, { fieldsOf }).nodes.find((n) => n.id === 'filter').warnings, [{ words: 'Greater than takes a number or date field; it was given the Status column' }]);
  // On Seats it takes Greater than, and Value B takes a number: the Value's "active" warns.
  const numbered = workflowGraph(editWorkflow(greater, { node: 'field', row: 'field', value: 'seats' }), { fieldsOf });
  assert.deepEqual(numbered.nodes.find((n) => n.id === 'filter').warnings, [{ row: 'b', words: 'Value B takes a number; it was given "active"' }]);
});

test('each edit is a pure function: a value typed as its row takes it, a place, a name, a connection made or cut', () => {
  const before = structuredClone(good);
  const op = editWorkflow(good, { node: 'filter', row: 'type', value: 'ne' });
  assert.deepEqual(op.nodes[3].values, { type: 'ne' });
  assert.deepEqual(good, before, 'the one given is untouched');
  const moved = editWorkflow(good, { node: 'end', set: { x: 800, y: 40 } });
  assert.deepEqual([moved.nodes[4].x, moved.nodes[4].y], [800, 40]);
  const named = editWorkflow(editWorkflow(good, { node: 'end', set: { heading: 'Done' } }), { node: 'end', set: { heading: '' } });
  assert.equal(named.nodes[4].heading, undefined, 'an empty name gives back the kind\'s');
  // A connection into an input takes the place of the one there; a cut takes it away.
  const reconnected = editWorkflow(good, { connection: { from: 'start/rows', to: 'end' } });
  assert.deepEqual(reconnected.connections.filter((r) => r.to === 'end'), [{ from: 'start/rows', to: 'end' }]);
  assert.deepEqual(editWorkflow(good, { cut: 'filter/b' }).connections.map((r) => r.to), ['field', 'filter', 'end']);
  // A number row's value is typed: an app's kind with one.
  const kinds = { ...NODE_KINDS, top: { heading: 'Top', icon: 'flag', input: 'object', rows: [{ name: 'n', label: 'N', control: 'number' }], model: 'take', graphs: ['workflow'] } };
  const top = editWorkflow(with_({ nodes: [...good.nodes, { id: 'top', kind: 'top', x: 0, y: 0 }] }), { node: 'top', row: 'n', value: '12' }, kinds);
  assert.deepEqual(top.nodes[5].values, { n: 12 });
});

test('SAVE round-trips: definition → graph → edit → definition, checked, and the edit is in it', () => {
  // The reader picks "Does not equal" as the drawn Condition's Operation.
  const drawn = workflowGraph(good, { fieldsOf });
  const filter = drawn.nodes.find((n) => n.id === 'filter');
  const op = filter.rows.find((r) => r.name === 'type');
  const saved = editWorkflow(good, { node: filter.id, row: op.name, value: 'ne' });
  assert.deepEqual(schemaCheck('workflow.v3.json')(saved), []);
  assert.deepEqual(check(saved), { ok: true, heard: [] });
  assert.equal(saved.nodes.find((n) => n.id === 'filter').values.type, 'ne');
  assert.equal(row('filter', 'type', workflowGraph(saved, { fieldsOf })).value, 'ne');
});
