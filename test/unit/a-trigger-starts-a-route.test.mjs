/**
 * A TRIGGER STARTS A ROUTE — Will, plan 941 (D1 B, D2 B). A Trigger is a Start node, first in its own Triggers category:
 * nothing comes in, and what it heard leaves by its rows. Its type says what it listens for: a user action, a UI event, a Task's
 * schedule or status, an AI message, an API response; each maps to the runtime's kind. The app's catalog lists what can be
 * heard; none registered, a row is typed text. The server listens, not Sherpa: Simulate says what it would hear. Many
 * Triggers may start one graph.
 *
 *   node --test test/unit/a-trigger-starts-a-route.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { schemaCheck } from '../../scripts/lib/schema-check.mjs';

const core = new URL('../../dist/core/data/', import.meta.url);
const { NODE_KINDS, TRIGGER_RUNS, nodeKinds, paletteOf, rowChoices } = await import(new URL('node-kinds.js', core));
const { workflowFaults, workflowGraph } = await import(new URL('workflow.js', core));
const { isSource, isStart, routeRead, routesOf } = await import(new URL('node-routes.js', core));
const { lightOf, simulateGraph } = await import(new URL('node-simulate.js', core));
const { registerTriggerCatalog } = await import(new URL('ai-catalog.js', core));

const trigger = (id, values, x = 0) => ({ id, kind: 'trigger', x, y: 0, values });
const flow = (nodes, connections) => ({ v: 3, id: 'w', nodes: [...nodes, { id: 'o', kind: 'result', x: 600, y: 0 }], connections });
const node = (g, id) => g.nodes.find((n) => n.id === id);

test('six types, each a runtime kind; the panel lists Triggers first; a Query has none', () => {
  assert.deepEqual(Object.keys(NODE_KINDS.trigger.types), ['action', 'ui', 'schedule', 'status', 'message', 'api']);
  assert.deepEqual(Object.values(NODE_KINDS.trigger.types).map((t) => t.label), ['User action', 'UI event', 'Task schedule', 'Task status', 'AI message', 'API response']);
  assert.deepEqual(Object.keys(TRIGGER_RUNS), Object.keys(NODE_KINDS.trigger.types));
  assert.deepEqual(TRIGGER_RUNS, { action: 'on_demand', ui: 'event', schedule: 'scheduled', status: 'event', message: 'event', api: 'event' });
  const first = paletteOf(nodeKinds()).find((g) => g.items.length);
  assert.deepEqual([first.category, first.items.map((i) => i.id)], ['Triggers', ['trigger']]);
  assert.equal(paletteOf(nodeKinds(), 'query').some((g) => g.category === 'Triggers' && g.items.length), false);
});

test('a Start node: no input, and its header sends nothing; each type its own rows and properties', () => {
  const t = node(workflowGraph(flow([trigger('t', { type: 'status' })], [])), 't');
  assert.deepEqual([t.input, t.output, t.category, t.would], [undefined, undefined, 'Triggers', 'Would start when the task changes']);
  assert.deepEqual(t.rows.map((r) => [r.name, !!r.input, !!r.output]), [['type', false, false], ['task', false, true], ['status', false, true]]);
  assert.ok(isStart(t) && !isSource(t));
  const api = node(workflowGraph(flow([trigger('t', { type: 'api' })], [])), 't');
  assert.deepEqual(api.rows.map((r) => r.name), ['type', 'endpoint', 'code', 'response']);
});

test('a route starts at a Trigger: no Source needed; many Triggers start one graph, with no fault', () => {
  const second = { id: 'o2', kind: 'result', x: 600, y: 300 };
  const g = flow([trigger('a', { type: 'ui', event: 'saved' }), trigger('b', { type: 'action', label: 'Run' }), second], [{ from: 'a/at', to: 'o' }, { from: 'b/by', to: 'o2' }]);
  assert.deepEqual(workflowFaults(g), []);
  assert.deepEqual(schemaCheck('workflow.v3.json')(g), []);
  const drawn = workflowGraph(g);
  assert.deepEqual(routeRead(drawn), { ok: true, sources: [], unjoined: [] });
  assert.deepEqual(routesOf(drawn), [['a', 'o'], ['b', 'o2']]);
  const lone = workflowGraph(flow([trigger('a', { type: 'ui' })], []));
  assert.equal(routeRead(lone).why, 'Join a Source or a Trigger to an Output');
  assert.equal(routeRead(workflowGraph({ v: 3, id: 'w', nodes: [{ id: 'o', kind: 'result', x: 0, y: 0 }], connections: [] })).why, 'Add a Source or a Trigger first');
});

test('the catalog lists what can be heard; none registered, the row is typed text', () => {
  const task = () => node(workflowGraph(flow([trigger('t', { type: 'status' })], [])), 't').rows.find((r) => r.name === 'task');
  assert.equal(rowChoices(task()), undefined);
  const undo = registerTriggerCatalog({ tasks: { patch: { label: 'Patch run', help: 'The nightly patch' } } });
  try {
    assert.deepEqual(rowChoices(task()), [{ value: '', label: 'Pick one' }, { value: 'patch', label: 'Patch run', title: 'The nightly patch' }]);
  } finally {
    undo();
  }
  assert.equal(rowChoices(task()), undefined);
});

test('Simulate: a Trigger says what it would hear; a row it holds sends that, the rest a stand-in; what it feeds runs', () => {
  const g = workflowGraph(flow([trigger('t', { type: 'api', endpoint: '/patch' })], [{ from: 't/code', to: 'o' }, { from: 't/response', to: 'o/summary' }]));
  const ran = simulateGraph(g, {});
  assert.deepEqual(ran.faults, []);
  assert.equal(ran.nodes.t.would, 'Would start on the response');
  assert.deepEqual(Object.fromEntries(ran.nodes.t.outgoing.map((s) => [s.socket, s.value])), {
    't/endpoint': '/patch', 't/code': 0, 't/response': 'Response, simulated',
  });
  assert.match(lightOf(ran.nodes.t), /^Would start on the response/);
  assert.equal(ran.nodes.o.notTaken, undefined);
});
