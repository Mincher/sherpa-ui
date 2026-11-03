/**
 * A WORKFLOW IS ITS DEFINITION: one JSON document of nodes, their values and
 * the routes between their sockets, checked by its schema and by checkWorkflow,
 * which reports each fault and never throws. Its kinds are the ONE registry's;
 * it draws as a graph, and each edit is a pure function that gives a new one.
 * Will, TODO 78 · plan 695 N1. TRAP T-a-workflow-is-its-definition · TRAP T-one-node-registry
 *
 *   node --test test/unit/a-workflow-is-its-definition.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { schemaCheck } from '../../scripts/lib/schema-check.mjs';

const core = new URL('../../dist/core/data/', import.meta.url);
const { NODE_KINDS, socketOf } = await import(new URL('node-kinds.js', core));
const { checkWorkflow, editWorkflow, workflowGraph } = await import(new URL('workflow.js', core));
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
  assert.deepEqual(schemaCheck('workflow.v1.json')(good), []);
  assert.deepEqual(check(good), { ok: true, heard: [] });
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
  assert.deepEqual(drawnIn('workflow'), ['store', 'value', 'pick', 'filter', 'sort', 'group', 'count', 'output']);
  assert.deepEqual(drawnIn('query'), ['store', 'status', 'source', 'scope', 'condition', 'preset', 'saved', 'arrange', 'presentation', 'component']);
  // One meaning per word: a Store is where rows come from, in both; a Filter's rows are one condition leaf.
  assert.equal(NODE_KINDS.source.model, 'SourceDefinition');
  assert.deepEqual(NODE_KINDS.filter.rows.slice(0, 3).map((r) => r.name), ['field', 'op', 'value']);
  assert.deepEqual(NODE_KINDS.condition.rows.map((r) => r.name), ['field', 'op', 'value']);
});

test('each fault is reported by name, and the check says no', () => {
  const nodes = good.nodes;
  const cases = [
    [{ nodes: [...nodes, { id: 'end', kind: 'output', x: 0, y: 0 }] }, 'two nodes are "end"'],
    [{ nodes: [...nodes, { id: 'odd', kind: 'teleport', x: 0, y: 0 }] }, 'the node "odd" is of the kind "teleport", which is not one'],
    [{ nodes: [...nodes, { id: 'odd', kind: 'scope', x: 0, y: 0 }] }, 'the node "odd" is of the kind "scope", which a workflow does not run'],
    [{ nodes: [...nodes, { id: 'more', kind: 'value', x: 0, y: 0, values: { colour: 'red' } }] }, 'the node "more" holds a value for "colour", a row its kind has not'],
    [{ nodes: [...nodes, { id: 'more', kind: 'filter', x: 0, y: 0, values: { op: 'equals' } }] }, 'the node "more" holds "equals" as its Condition, which is no operator'],
    [{ routes: [{ from: 'gone', to: 'filter' }] }, 'a route leaves "gone", which is no output socket'],
    [{ routes: [{ from: 'start', to: 'filter/matches' }] }, 'a route enters "filter/matches", which is no input socket'],
    [{ routes: [{ from: 'status/value', to: 'filter' }] }, 'the route "status/value" → "filter" joins a value to an object'],
    [{ routes: [{ from: 'start', to: 'filter' }, { from: 'start', to: 'filter' }] }, 'two routes enter "filter": an input takes one'],
    [{ nodes: [...nodes, { id: 'again', kind: 'filter', x: 0, y: 0 }], routes: [{ from: 'filter', to: 'again' }, { from: 'again', to: 'filter' }] }, 'its routes run in a loop'],
  ];
  for (const [change, said] of cases) {
    const { ok, heard } = check(with_(change));
    assert.equal(ok, false, said);
    assert.ok(heard.includes(`${said}.`), `${said} — heard: ${heard.join(' | ')}`);
  }
});

test('an app adds its own kind beside the library\'s', () => {
  const mail = { heading: 'Mail', icon: 'chat', input: 'object', rows: [{ name: 'to', label: 'To', control: 'text' }], model: 'sendMail', graphs: ['workflow'] };
  const kinds = { ...NODE_KINDS, mail };
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

test('a workflow DRAWS as its kinds say: each node at its place, its rows with its values, and its routes', () => {
  assert.deepEqual(graph.nodes.map((n) => [n.id, n.kind, n.heading, n.x, n.y]), [
    ['start', 'store', 'Store', 0, 0], ['status', 'value', 'Value', 0, 160], ['filter', 'filter', 'Filter', 360, 0], ['end', 'output', 'Output', 720, 0],
  ]);
  assert.deepEqual(graph.routes, good.routes);
  assert.deepEqual(node('filter').rows.map((r) => [r.name, r.value, !!r.editable]), [
    ['field', 'status', true], ['op', 'eq', true], ['value', undefined, true], ['matches', undefined, false],
  ]);
  // The field from the facts; its operators its type's, by their words.
  assert.deepEqual(node('filter').rows[0].choices, [{ value: 'status', label: 'Status' }, { value: 'seats', label: 'Seats' }]);
  assert.deepEqual(node('filter').rows[1].choices.map((c) => c.label), ['Equals', 'Does not equal', 'Contains', 'Does not contain', 'Starts with', 'Ends with']);
  assert.deepEqual(node('start').rows[0].choices, [{ value: 'customers', label: 'customers' }]);
  const numbered = workflowGraph(editWorkflow(good, { node: 'filter', row: 'field', value: 'seats' }), { fields });
  assert.ok(numbered.nodes.find((n) => n.id === 'filter').rows[1].choices.some((c) => c.label === 'Greater than'));
});

test('each edit is a pure function: a value typed as its row takes it, a place, a name, a route made or cut', () => {
  const before = structuredClone(good);
  const op = editWorkflow(good, { node: 'filter', row: 'op', value: 'ne' });
  assert.deepEqual(op.nodes[2].values, { field: 'status', op: 'ne' });
  assert.deepEqual(good, before, 'the one given is untouched');
  const moved = editWorkflow(good, { node: 'end', set: { x: 800, y: 40 } });
  assert.deepEqual([moved.nodes[3].x, moved.nodes[3].y], [800, 40]);
  const named = editWorkflow(editWorkflow(good, { node: 'end', set: { heading: 'Done' } }), { node: 'end', set: { heading: '' } });
  assert.equal(named.nodes[3].heading, undefined, 'an empty name gives back the kind\'s');
  // A route into an input takes the place of the one there; a cut takes it away.
  const rerouted = editWorkflow(good, { route: { from: 'start', to: 'end' } });
  assert.deepEqual(rerouted.routes.filter((r) => r.to === 'end'), [{ from: 'start', to: 'end' }]);
  assert.deepEqual(editWorkflow(good, { cut: 'filter/value' }).routes.map((r) => r.to), ['filter', 'end']);
  // A number row's value is typed: an app's kind with one.
  const kinds = { ...NODE_KINDS, top: { heading: 'Top', icon: 'flag', input: 'object', rows: [{ name: 'n', label: 'N', control: 'number' }], model: 'take', graphs: ['workflow'] } };
  const top = editWorkflow(with_({ nodes: [...good.nodes, { id: 'top', kind: 'top', x: 0, y: 0 }] }), { node: 'top', row: 'n', value: '12' }, kinds);
  assert.deepEqual(top.nodes[4].values, { n: 12 });
});

test('SAVE round-trips: definition → graph → edit → definition, checked, and the edit is in it', () => {
  // The reader picks "Does not equal" on the drawn Filter node.
  const drawn = workflowGraph(good, { fields });
  const filter = drawn.nodes.find((n) => n.id === 'filter');
  const row = filter.rows.find((r) => r.name === 'op');
  const saved = editWorkflow(good, { node: filter.id, row: row.name, value: 'ne' });
  assert.deepEqual(schemaCheck('workflow.v1.json')(saved), []);
  assert.deepEqual(check(saved), { ok: true, heard: [] });
  assert.equal(saved.nodes.find((n) => n.id === 'filter').values.op, 'ne');
  assert.equal(workflowGraph(saved, { fields }).nodes.find((n) => n.id === 'filter').rows[1].value, 'ne');
});
