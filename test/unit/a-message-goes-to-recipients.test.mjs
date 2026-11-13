/**
 * A MESSAGE GOES TO RECIPIENTS (plan 960 U4.9; Will, 2026-11-13: "The 'To' input in a Notification node should take in rows
 * containing data on the recipients"): a Notification's To takes ROWS, not text. The library names no recipient type: an
 * app's type says it is one (`recipient: true`); rows into To from another type's store warn, naming the app's.
 *
 *   node --test test/unit/a-message-goes-to-recipients.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nodeKinds, recipientTypes, registerEntityType, workflowFaults, workflowGraph } from '../../dist/data.js';

const fieldsOf = { user: { name: { label: 'Name' }, email: { label: 'Email' } }, devices: { name: { label: 'Name' } } };
/** A Source of `store` into a Notification's To. */
const flow = (store) => ({
  v: 3, id: 'w',
  nodes: [
    { id: 's', kind: 'source', x: 0, y: 0, values: { store } },
    { id: 'n', kind: 'notify', x: 400, y: 0, type: 'notification', values: { type: 'notification', title: 'Hi', message: 'Hello' } },
  ],
  connections: [{ from: 's/rows', to: 'n/to' }],
});
const toWarnings = (store) => (workflowGraph(flow(store), { fieldsOf }).nodes.find((n) => n.id === 'n').warnings ?? []).filter((w) => w.row === 'to');

test('To takes rows: a Source joined to it is sound', () => {
  const to = nodeKinds().notify.types.notification.rows.find((r) => r.name === 'to');
  assert.deepEqual({ input: to.input, needs: to.needs, recipients: to.recipients, control: to.control }, { input: 'object', needs: 'rows', recipients: true, control: undefined });
  assert.deepEqual(workflowFaults(flow('user'), nodeKinds(), { fieldsOf }), []);
});

test('rows of a type that is no recipient warn, naming the app\'s recipients; a recipient\'s do not; none named, none warn', () => {
  assert.deepEqual(recipientTypes(), [], 'the library names none');
  assert.deepEqual(toWarnings('devices'), [], 'with no recipient type, To is open');
  const back = [
    registerEntityType({ v: 1, id: 'user', label: 'User', recipient: true, key: 'name', fields: { name: { label: 'Name' } } }),
    registerEntityType({ v: 1, id: 'group', label: 'Group', recipient: true, key: 'name', fields: { name: { label: 'Name' } } }),
  ];
  try {
    assert.deepEqual(recipientTypes().map((t) => t.id).sort(), ['group', 'user']);
    assert.deepEqual(toWarnings('user'), []);
    assert.deepEqual(toWarnings('devices').map((w) => w.words), ['To takes rows of a User or Group: these come from "devices"']);
  } finally {
    for (const undo of back) undo?.();
  }
});

test('a To once typed, with nothing joined, is said unused, never kept quietly', () => {
  const old = { v: 3, id: 'w', nodes: [{ id: 'n', kind: 'notify', x: 0, y: 0, values: { type: 'notification', to: 'Service desk', title: 'Hi' } }], connections: [] };
  const warnings = workflowGraph(old).nodes[0].warnings ?? [];
  assert.ok(warnings.some((w) => w.row === 'to' && w.words === 'To takes a connection: "Service desk" is not used'), JSON.stringify(warnings));
});
