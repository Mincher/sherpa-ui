/**
 * EVERY ROW NAME SAVES: a row a workflow can hold is named as the schema's socket pattern says, lower case and dashes, so
 * a connection into or out of it saves (TODO 917: `fileName`, `saveTo`, `messageId` did not). Every kind, every type.
 *
 *   node --test test/unit/every-row-name-saves.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { schemaCheck } from '../../scripts/lib/schema-check.mjs';

const core = new URL('../../dist/core/data/', import.meta.url);
const { NODE_KINDS } = await import(new URL('node-kinds.js', core));
const { workflowFaults } = await import(new URL('workflow.js', core));

const socket = schemaCheck('defs.v1.json#/$defs/socket');
const saves = (row) => socket(`n/${row}`).length === 0;
const saved = (graphs) => !graphs || graphs.includes('workflow');

/** Each row a workflow can hold, as `kind.list.type row`: the kind's own, and each type's in every list of types; a row
 *  of a Query alone (a Source's Page size, plan 1004 D3) is held by no workflow. */
const rowNames = () => Object.entries(NODE_KINDS).filter(([, kind]) => saved(kind.graphs)).flatMap(([k, kind]) => [
  ...(kind.rows ?? []).filter((r) => saved(r.graphs)).map((r) => [k, r.name]),
  ...Object.entries(kind).filter(([, v]) => v && typeof v === 'object' && !Array.isArray(v)).flatMap(([list, types]) =>
    Object.entries(types).filter(([, t]) => Array.isArray(t?.rows) && saved(t.graphs ?? kind.graphs))
      .flatMap(([t, type]) => type.rows.filter((r) => saved(r.graphs)).map((r) => [`${k}.${list}.${t}`, r.name]))),
]);

test('the schema takes a row of lower case and dashes, and no other', () => {
  assert.ok(saves('file-name') && !saves('fileName') && !saves('#filters'));
});

test('every row of every kind and type a workflow holds is lower case and dashes', () => {
  const names = rowNames();
  assert.ok(names.length > 100, `a walk of ${names.length} rows found too few`);
  assert.deepEqual(names.filter(([, name]) => !saves(name)).map((at) => at.join(' ')), []);
});

test('a connection out of Message ID into File name saves: no fault, and the schema takes it', () => {
  const flow = {
    v: 3, id: 'w',
    nodes: [
      { id: 's', kind: 'source', x: 0, y: 0, values: { store: 'users' } },
      { id: 'n', kind: 'notify', x: 400, y: 0, values: { type: 'notification' } },
      { id: 'f', kind: 'content', x: 800, y: 0, values: { type: 'file', format: 'pdf', 'save-to': 'Reports' } },
    ],
    connections: [{ from: 's/rows', to: 'n' }, { from: 'n/message-id', to: 'f/file-name' }],
  };
  assert.deepEqual(workflowFaults(flow), []);
  assert.deepEqual(schemaCheck('workflow.v3.json')(flow), []);
});
