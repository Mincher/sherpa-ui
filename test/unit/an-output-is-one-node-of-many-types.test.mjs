/**
 * AN OUTPUT IS ONE NODE OF MANY TYPES: a family, its Type row first, its icon the type's. Run result is the default, so an
 * Output kept with no type opens as it was. A fixed list is a row's own (`pick`); one pick with none picked says so. A
 * Notify item in the panel places a Notification. The host app adds its own types (`addTypes`). Plan 891, steps 1 and 4.
 *
 *   node --test test/unit/an-output-is-one-node-of-many-types.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const core = new URL('../../dist/core/data/', import.meta.url);
const { NODE_KINDS, addTypes, fixedChoices, kindOfNode, paletteFor, paletteMatch, paletteOf, rowChoices } = await import(new URL('node-kinds.js', core));
const { workflowFaults, workflowGraph } = await import(new URL('workflow.js', core));

const flow = (values, extra = []) => ({
  v: 2, id: 'w',
  nodes: [{ id: 's', kind: 'source', x: 0, y: 0, values: { store: 'users' } }, { id: 'o', kind: 'output', x: 400, y: 0, ...(values ? { values } : {}) }, ...extra],
  routes: [{ from: 's/rows', to: 'o' }],
});
const node = (g, id) => g.nodes.find((n) => n.id === id);
const row = (n, name) => n.rows.find((r) => r.name === name);

test('an Output kept with no type is a Run result: its Type row, Status and Summary, the flag', () => {
  const o = node(workflowGraph(flow()), 'o');
  assert.deepEqual(o.rows.map((r) => r.name), ['type', 'status', 'summary']);
  assert.deepEqual([o.heading, o.icon, row(o, 'type').value], ['Output', 'flag', 'result']);
  assert.equal(row(o, 'summary').control, 'message');
  // Status is the row's own list, and with none picked it says so first.
  assert.deepEqual(row(o, 'status').choices.map((c) => c.label), ['Pick one', 'Succeeded', 'Skipped', 'Failed', 'Deferred']);
  assert.deepEqual(workflowFaults(flow()), []);
});

test('each type draws its own rows and icon; its properties are output rows, so it can route on', () => {
  const o = node(workflowGraph(flow({ type: 'notification', channels: ['email'], priority: 'high' })), 'o');
  assert.equal(o.icon, 'notifications');
  assert.deepEqual(o.rows.map((r) => r.name), ['type', 'channels', 'to', 'title', 'message', 'url', 'priority', 'sent', 'delivered', 'messageId']);
  assert.deepEqual([row(o, 'channels').multiple, row(o, 'channels').input], [true, 'object']);
  assert.deepEqual([row(o, 'sent').property, row(o, 'sent').output], [true, 'boolean']);
  // A File routes on into the next Output's Data.
  const file = flow({ type: 'file' }, [{ id: 'n', kind: 'output', x: 800, y: 0, values: { type: 'file' } }]);
  file.routes.push({ from: 'o/file', to: 'n/data' });
  assert.deepEqual(workflowFaults(file), []);
  assert.equal(node(workflowGraph(file), 'o').rows.find((r) => r.name === 'file').output, 'object');
});

test('a pick row holds one of its own choices; none picked is no fault', () => {
  assert.deepEqual(workflowFaults(flow({ type: 'notification', priority: 'normal' })), []);
  assert.deepEqual(workflowFaults(flow({ type: 'notification', priority: '' })), []);
  assert.match(workflowFaults(flow({ type: 'notification', priority: 'urgent' })).join(' '), /"urgent" as its Priority, which is none of its choices/);
  const priority = kindOfNode(NODE_KINDS, { kind: 'output', values: { type: 'notification' } }).rows.find((r) => r.name === 'priority');
  assert.deepEqual(fixedChoices(priority).map((c) => c.value), ['low', 'normal', 'high']);
  assert.equal(rowChoices({ ...priority, value: 'high' })[0].value, 'low', 'one picked: no Pick one');
  const channels = kindOfNode(NODE_KINDS, { kind: 'output', values: { type: 'notification' } }).rows.find((r) => r.name === 'channels');
  assert.equal(rowChoices(channels)[0].value, 'app', 'several: no Pick one');
});

test('a type change keeps the rows the types share, and the values of the rest for the way back', () => {
  const values = { type: 'toast', message: 'Patched {customer.name}', tone: 'success' };
  const o = node(workflowGraph(flow(values)), 'o');
  assert.equal(row(o, 'message').value, 'Patched {customer.name}');
  const back = node(workflowGraph(flow({ ...values, type: 'notification' })), 'o');
  assert.equal(row(back, 'message').value, 'Patched {customer.name}');
  assert.equal(row(back, 'tone'), undefined);
  assert.deepEqual(workflowFaults(flow({ ...values, type: 'notification' })), [], 'the Toast\'s Tone is kept, not a fault');
});

test('the panel lists Notify, which places a Notification, once; the host adds its own types', () => {
  const output = paletteOf(NODE_KINDS).find((g) => g.category === 'Output').items;
  assert.deepEqual(output.map((i) => [i.id, i.type, i.heading]), [['output', undefined, undefined], ['output', 'notification', 'Notify']]);
  assert.equal(paletteFor(paletteOf(NODE_KINDS), 'value', 'in').filter((i) => i.id === 'output').length, 1, 'a let-go socket offers the Output once');
  assert.deepEqual(paletteMatch(NODE_KINDS.output, 'notification'), { type: 'notification' });
  assert.deepEqual(paletteMatch(NODE_KINDS.output, 'Run result'), { type: 'result' });
  const ticket = { label: 'Ticket', group: 'Request', icon: 'ticket', rows: [{ name: 'summary', label: 'Summary', control: 'message', input: 'value' }] };
  const withTicket = addTypes(NODE_KINDS.output, { ticket });
  assert.deepEqual(Object.keys(withTicket.types).slice(-2), ['result', 'ticket']);
  assert.equal(NODE_KINDS.output.types.ticket, undefined, 'the shipped family is left as it is');
  const kinds = { ...NODE_KINDS, output: withTicket };
  const t = node(workflowGraph(flow({ type: 'ticket' }), {}, kinds), 'o');
  assert.deepEqual([t.icon, t.rows.map((r) => r.name)], ['ticket', ['type', 'summary']]);
});
