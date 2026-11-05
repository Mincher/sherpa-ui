/**
 * A NODE SHOWS ITS FLOW AS JSON: what comes into a node and what leaves it, read from the graph's definition
 * (its routes and the values its rows hold), never from a run. A Condition says its `where` tree, a Store its
 * store. Will, TODO 745.
 *
 *   node --test test/unit/a-node-shows-its-flow-as-json.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const core = new URL('../../dist/core/data/', import.meta.url);
const { nodeFlow } = await import(new URL('node-flow.js', core));
const { workflowGraph } = await import(new URL('workflow.js', core));

const graph = () => workflowGraph({
  v: 2, id: 'flow',
  nodes: [
    { id: 'start', kind: 'store', x: 0, y: 0, values: { store: 'users' } },
    { id: 'val', kind: 'value', x: 0, y: 200, values: { value: 'active' } },
    { id: 'field', kind: 'field', x: 180, y: 0, values: { field: 'status' } },
    { id: 'cond', kind: 'condition', x: 360, y: 40, values: { type: 'eq' } },
    { id: 'end', kind: 'output', x: 720, y: 0 },
    { id: 'alone', kind: 'collection', x: 0, y: 400 },
  ],
  routes: [{ from: 'start/rows', to: 'field' }, { from: 'field/field', to: 'cond' }, { from: 'val/value', to: 'cond/b' }, { from: 'cond/rows', to: 'end' }],
}, { fields: { status: { label: 'Status' } } });

test('a Store gives its store and where its rows go', () => {
  const flow = nodeFlow(graph(), 'start');
  assert.deepEqual(flow.definition, { store: 'users' });
  const rows = flow.outgoing.find((o) => o.socket === 'Rows');
  assert.deepEqual(rows.to, ['Field']);
});

test('a Condition says its where tree — the Field on its header, its Operation, its Value B — and what is routed to it', () => {
  const flow = nodeFlow(graph(), 'cond');
  assert.deepEqual(flow.definition, { where: { field: 'status', op: 'eq', value: 'active' } });
  assert.deepEqual(flow.incoming.find((i) => i.socket === 'In').from, ['Field › Field']);
  assert.deepEqual(flow.incoming.find((i) => i.socket === 'Value B').from, ['Value › Value']);
  assert.deepEqual(flow.outgoing.find((o) => o.socket === 'Rows').to, ['Output']);
});

test('a Value carries its value', () => {
  const flow = nodeFlow(graph(), 'val');
  assert.equal(flow.outgoing.find((o) => o.socket === 'Value').carries, 'active');
});

test('a node with no routes has sockets and no one on them', () => {
  const flow = nodeFlow(graph(), 'alone');
  assert.deepEqual(flow.incoming.map((i) => i.from), [[], [], []].slice(0, flow.incoming.length));
  assert.ok(flow.outgoing.every((o) => o.to.length === 0));
});

test('an Output has an input and no output', () => {
  const flow = nodeFlow(graph(), 'end');
  assert.deepEqual(flow.incoming[0].from, ['Condition › Rows']);
  assert.deepEqual(flow.outgoing, []);
});

test('a planted fault: an unknown node id is refused in words', () => {
  assert.deepEqual(nodeFlow(graph(), 'nope'), { fault: 'the graph holds no node "nope"' });
});
