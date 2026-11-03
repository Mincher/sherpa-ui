/**
 * A WORKFLOW IS ITS DEFINITION: one JSON document of nodes, their values and
 * the routes between their sockets, checked by its schema and by checkWorkflow,
 * which reports each fault and never throws. Will, TODO 78.
 * TRAP T-a-workflow-is-its-definition
 *
 *   node --test test/unit/a-workflow-is-its-definition.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { schemaCheck } from '../../scripts/lib/schema-check.mjs';

const core = new URL('../../dist/core/data/', import.meta.url);
const { NODE_KINDS, checkWorkflow, socketOf } = await import(new URL('workflow.js', core));
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

test('every kind the library ships has a header, and rows whose names are its own', () => {
  for (const [name, kind] of Object.entries(NODE_KINDS)) {
    assert.ok(kind.heading && kind.icon, name);
    const names = kind.rows.map((row) => row.name);
    assert.equal(new Set(names).size, names.length, name);
  }
  assert.deepEqual(Object.keys(NODE_KINDS), ['source', 'value', 'pick', 'filter', 'sort', 'group', 'count', 'output']);
});

test('each fault is reported by name, and the check says no', () => {
  const nodes = good.nodes;
  const cases = [
    [{ nodes: [...nodes, { id: 'end', kind: 'output', x: 0, y: 0 }] }, 'two nodes are "end"'],
    [{ nodes: [...nodes, { id: 'odd', kind: 'teleport', x: 0, y: 0 }] }, 'the node "odd" is of the kind "teleport", which is not one'],
    [{ nodes: [...nodes, { id: 'more', kind: 'value', x: 0, y: 0, values: { colour: 'red' } }] }, 'the node "more" holds a value for "colour", a row its kind has not'],
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
  const kinds = { ...NODE_KINDS, mail: { heading: 'Mail', icon: 'chat', input: 'object', rows: [{ name: 'to', label: 'To', field: 'text' }] } };
  const workflow = with_({ nodes: [...good.nodes, { id: 'send', kind: 'mail', x: 0, y: 0, values: { to: 'ops' } }], routes: [...good.routes, { from: 'filter', to: 'send' }] });
  // Without its kind, the node is not one — and so neither is its socket.
  assert.deepEqual(check(workflow), { ok: false, heard: [
    'the node "send" is of the kind "mail", which is not one.',
    'a route enters "send", which is no input socket.',
  ] });
  assert.deepEqual(check(workflow, kinds), { ok: true, heard: [] });
});
