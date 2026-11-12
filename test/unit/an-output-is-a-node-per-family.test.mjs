/**
 * AN OUTPUT IS A NODE PER FAMILY (Will, plan 917): Notification, Content, Response, Run result and Request, each a kind of
 * its types, in the Output category. A family of one type shows no Type row; its rows come first. A fixed list is a row's
 * own (`pick`); one pick with none picked says so. Request ships no type, so the panel lists it only once an app adds one.
 * An app adds its own types to a family (`registerNodeTypes`).
 *
 *   node --test test/unit/an-output-is-a-node-per-family.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const core = new URL('../../dist/core/data/', import.meta.url);
const { NODE_KINDS, addTypes, fixedChoices, kindOfNode, nodeKinds, paletteFor, paletteMatch, paletteOf, registerNodeTypes, rowChoices } = await import(new URL('node-kinds.js', core));
const { workflowFaults, workflowGraph } = await import(new URL('workflow.js', core));

const flow = (kind, values, extra = []) => ({
  v: 3, id: 'w',
  nodes: [{ id: 's', kind: 'source', x: 0, y: 0, values: { store: 'users' } }, { id: 'o', kind, x: 400, y: 0, ...(values ? { values } : {}) }, ...extra],
  connections: [{ from: 's/rows', to: 'o' }],
});
const node = (g, id) => g.nodes.find((n) => n.id === id);
const row = (n, name) => n.rows.find((r) => r.name === name);
const FAMILIES = ['notify', 'content', 'response', 'result', 'request'];

test('five families, each a kind of its types, in the Output category', () => {
  assert.deepEqual(FAMILIES.map((k) => [NODE_KINDS[k].heading, Object.keys(NODE_KINDS[k].types)]), [
    ['Notification', ['notification']], ['Content', ['view', 'file']], ['Response', ['toast', 'alert', 'api']], ['Run result', ['result']], ['Request', []],
  ]);
  for (const k of FAMILIES) assert.deepEqual([NODE_KINDS[k].category, NODE_KINDS[k].input], ['Output', 'any'], k);
  assert.equal(NODE_KINDS.output, undefined, 'one Output of many types is gone');
});

test('a family of one type has no Type row: a Run result is its Status and Summary, the flag', () => {
  const o = node(workflowGraph(flow('result')), 'o');
  assert.deepEqual(o.rows.map((r) => r.name), ['status', 'summary']);
  assert.deepEqual([o.heading, o.icon], ['Run result', 'flag']);
  assert.equal(row(o, 'summary').control, 'message');
  // Status is the row's own list, and with none picked it says so first.
  assert.deepEqual(row(o, 'status').choices.map((c) => c.label), ['Pick one', 'Succeeded', 'Skipped', 'Failed', 'Deferred']);
  assert.deepEqual(workflowFaults(flow('result')), []);
});

test('a family of several types has its Type row first; each type draws its own rows and icon; its properties connection on', () => {
  const n = node(workflowGraph(flow('notify', { channels: ['email'], priority: 'high' })), 'o');
  assert.equal(n.icon, 'notifications');
  assert.deepEqual(n.rows.map((r) => r.name), ['channels', 'to', 'title', 'message', 'attachments', 'url', 'priority', 'sent', 'delivered', 'message-id']);
  assert.deepEqual([row(n, 'channels').multiple, row(n, 'channels').input], [true, 'object']);
  assert.deepEqual([row(n, 'sent').property, row(n, 'sent').output], [true, 'boolean']);
  const file = flow('content', { type: 'file' }, [{ id: 'n', kind: 'content', x: 800, y: 0, values: { type: 'file' } }]);
  file.connections.push({ from: 'o/file', to: 'n/data' });
  assert.deepEqual(workflowFaults(file), []);
  const o = node(workflowGraph(file), 'o');
  assert.deepEqual([o.rows[0].name, row(o, 'type').choices.map((c) => c.label)], ['type', ['On a view', 'Generated file']]);
  assert.equal(row(o, 'file').output, 'object');
});

test('a pick row holds one of its own choices; none picked is no fault', () => {
  assert.deepEqual(workflowFaults(flow('notify', { priority: 'normal' })), []);
  assert.deepEqual(workflowFaults(flow('notify', { priority: '' })), []);
  assert.match(workflowFaults(flow('notify', { priority: 'urgent' })).join(' '), /"urgent" as its Priority, which is none of its choices/);
  const priority = kindOfNode(NODE_KINDS, { kind: 'notify' }).rows.find((r) => r.name === 'priority');
  assert.deepEqual(fixedChoices(priority).map((c) => c.value), ['low', 'normal', 'high']);
  assert.equal(rowChoices({ ...priority, value: 'high' })[0].value, 'low', 'one picked: no Pick one');
  const channels = kindOfNode(NODE_KINDS, { kind: 'notify' }).rows.find((r) => r.name === 'channels');
  assert.equal(rowChoices(channels)[0].value, 'app', 'several: no Pick one');
});

test('a type change in a family keeps the rows the types share, and the values of the rest for the way back', () => {
  const values = { type: 'toast', message: 'Patched {customer.name}', tone: 'success' };
  assert.equal(row(node(workflowGraph(flow('response', values)), 'o'), 'message').value, 'Patched {customer.name}');
  const back = node(workflowGraph(flow('response', { ...values, type: 'alert' })), 'o');
  assert.equal(row(back, 'message').value, 'Patched {customer.name}');
  assert.equal(row(back, 'tone'), undefined);
  assert.deepEqual(workflowFaults(flow('response', { ...values, type: 'alert' })), [], 'the Toast\'s Tone is kept, not a fault');
});

test('the panel lists the families that have a type, no Notify; a search finds a family by a type', () => {
  const output = paletteOf(NODE_KINDS).find((g) => g.category === 'Output').items;
  assert.deepEqual(output.map((i) => i.id), ['notify', 'content', 'response', 'result']);
  // A line let go from an output: each family takes it, once. One into an input: a Run result sends nothing, so not it.
  assert.deepEqual(paletteFor(paletteOf(NODE_KINDS), 'value', 'out').filter((i) => FAMILIES.includes(i.id)).map((i) => i.id), ['notify', 'content', 'response', 'result']);
  assert.deepEqual(paletteFor(paletteOf(NODE_KINDS), 'value', 'in').filter((i) => FAMILIES.includes(i.id)).map((i) => i.id), ['notify', 'content', 'response']);
  assert.deepEqual(paletteMatch(NODE_KINDS.content, 'file'), { type: 'file' });
  assert.deepEqual(paletteMatch(NODE_KINDS.result, 'Run result'), {});
  const ticket = { label: 'Ticket', icon: 'ticket', rows: [{ name: 'summary', label: 'Summary', control: 'message', input: 'value' }] };
  const withTicket = addTypes(NODE_KINDS.request, { ticket });
  assert.deepEqual(Object.keys(withTicket.types), ['ticket']);
  assert.deepEqual(Object.keys(NODE_KINDS.request.types), [], 'the shipped family is left as it is');
  const t = node(workflowGraph(flow('request', { type: 'ticket' }), {}, { ...NODE_KINDS, request: withTicket }), 'o');
  assert.deepEqual([t.icon, t.rows.map((r) => r.name)], ['ticket', ['summary']]);
});

test('an app adds types to a family: every check and editor reads them; Request is listed then; a clash is refused; it takes them back', () => {
  const ticket = { label: 'Ticket', icon: 'ticket', rows: [{ name: 'summary', label: 'Summary', control: 'message', input: 'value' }] };
  const artefact = { label: 'AI chat artefact', icon: 'AI', rows: [] };
  const kept = flow('request', { type: 'ticket' });
  assert.match(workflowFaults(kept).join(' '), /"ticket" as its Type, which is none of its choices/, 'not yet registered');
  const backs = [registerNodeTypes('request', { ticket }), registerNodeTypes('content', { artefact })];
  assert.ok(backs.every((b) => typeof b === 'function'));
  assert.deepEqual([Object.keys(nodeKinds().request.types), Object.keys(nodeKinds().content.types)], [['ticket'], ['view', 'file', 'artefact']]);
  assert.deepEqual(Object.keys(NODE_KINDS.request.types), [], 'the shipped registry is left as it is');
  assert.deepEqual(workflowFaults(kept), [], 'a check with no kinds given reads the registered');
  assert.deepEqual(paletteOf(nodeKinds()).find((g) => g.category === 'Output').items.map((i) => i.id), ['notify', 'content', 'response', 'result', 'request']);
  assert.equal(registerNodeTypes('content', { file: ticket }), undefined, 'a shipped type is not replaced');
  assert.equal(registerNodeTypes('source', { ticket }), undefined, 'no family');
  for (const back of backs) back();
  assert.deepEqual(Object.keys(nodeKinds().request.types), []);
  assert.equal(nodeKinds(), NODE_KINDS);
});
