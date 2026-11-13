/**
 * A MESSAGE GOES TO RECIPIENTS (plan 960 U4.9; Will, 2026-11-13: "The 'To' input in a Notification node should take in rows
 * containing data on the recipients"): a Notification's To takes ROWS, not text. The library names no recipient type: an
 * app's type says it is one (`recipient: true`); rows into To from another type's store warn, naming the app's.
 *
 *   node --test test/unit/a-message-goes-to-recipients.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nodeKinds, queryGraph, recipientTypes, registerEntityType, rowPicks, simulateGraph, workflowFaults, workflowGraph } from '../../dist/data.js';

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

test('a Source picks some of its rows by title (Will: "Source picks rows"); none picked, every row; a page\'s Query offers no pick', () => {
  const group = { v: 1, id: 'group', label: 'Group', recipient: true, key: 'id', title: 'name', fields: { id: { label: 'Id' }, name: { label: 'Name' } } };
  const rows = [{ id: 'g1', name: 'Service desk' }, { id: 'g2', name: 'Account managers' }, { id: 'g3', name: 'Owners' }];
  assert.deepEqual(rowPicks(group, rows), [{ value: 'g1', label: 'Service desk' }, { value: 'g2', label: 'Account managers' }, { value: 'g3', label: 'Owners' }]);
  const back = registerEntityType(group);
  try {
    const flowOf = (picked) => ({
      v: 3, id: 'w',
      nodes: [
        { id: 's', kind: 'source', x: 0, y: 0, values: { store: 'group', ...(picked ? { picked } : {}) } },
        { id: 'n', kind: 'notify', x: 400, y: 0, values: { type: 'notification', title: 'Hi' } },
      ],
      connections: [{ from: 's/rows', to: 'n/to' }],
    });
    const facts = { fieldsOf: { group: group.fields }, storeRows: (store) => (store === 'group' ? rowPicks(group, rows) : []) };
    const pick = workflowGraph(flowOf(['g1']), facts).nodes.find((n) => n.id === 's').rows.find((r) => r.name === 'picked');
    assert.deepEqual({ label: pick.label, control: pick.control, multiple: pick.multiple, value: pick.value, choices: pick.choices.map((c) => c.label) },
      { label: 'Rows', control: 'rows', multiple: true, value: ['g1'], choices: ['Service desk', 'Account managers', 'Owners'] });
    assert.deepEqual(workflowFaults(flowOf(['g1']), nodeKinds(), facts), []);
    const sent = (picked) => simulateGraph(workflowGraph(flowOf(picked), facts), { group: rows }).nodes.n.incoming.find((s) => s.socket === 'n/to').rows;
    assert.deepEqual(sent(['g1']).map((r) => r.name), ['Service desk']);
    assert.deepEqual(sent(undefined).map((r) => r.name), ['Service desk', 'Account managers', 'Owners'], 'none picked: every row');
  } finally {
    back?.();
  }
  // A page's Query reads all its rows: its Source offers no Rows pick.
  const page = { v: 1, id: 'p', source: { store: 'group', fields: { name: { label: 'Name' } } } };
  const source = queryGraph({ v: 1, scopes: {} }, page).nodes.find((n) => n.id === 'source');
  assert.ok(!source.rows.some((r) => r.name === 'picked'));
});
