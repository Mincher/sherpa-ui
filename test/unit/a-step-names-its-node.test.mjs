/**
 * A STEP NAMES ITS NODE — plan 695 N2. One way to say a step ran: a span on the
 * one trace stream whose `detail.node` is the graph id it lights, with its state,
 * time and rows. The Query graph's node ↔ step map lights its nodes from the
 * spans as they are, and from the walk's own counts. Nobody listens: nothing.
 * TRAP T-a-step-names-its-node
 *
 *   node --test test/unit/a-step-names-its-node.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ArrayStore, DataSource, QUERY_NODE, TRACE_CHANNEL, onTrace, queryGraph, queryStepNode, readingsOf, traceQuerySteps, traceStep, tracing } from '../../dist/data.js';
import { walkedNodes } from '../../dist/core/data/query-graph.js';

const tick = () => new Promise((done) => setTimeout(done, 20));

test('nobody listens: a step makes nothing, says nothing to another context, and returns null', async (t) => {
  const other = new BroadcastChannel(TRACE_CHANNEL);
  other.unref?.();
  t.after(() => other.close());
  const got = [];
  other.onmessage = (e) => { if (e.data?.span) got.push(e.data.span); };
  assert.equal(tracing(), false);
  assert.equal(traceStep('filter', { graph: 'flow' }), null);
  assert.equal(traceStep('filter', { graph: 'flow', state: 'done', ms: 3, rows: 2 }), null);
  // A load's own steps, said under it: nothing either.
  traceQuerySteps({ v: 1, scopes: { view: { holds: ['region'], readings: {} } } }, { walk: { results: { view: { region: 4 } } } }, { host: 'page', trace: 'a'.repeat(32), id: 'b'.repeat(16) });
  await tick();
  assert.deepEqual(got, []);
});

test('a step begun says its node and graph, then ends done, failed or skipped with its time and rows — all in its trace', async (t) => {
  const spans = [];
  t.after(onTrace((span) => spans.push(span)));
  const step = traceStep('filter', { graph: 'active-customers' });
  step.end('done', { rows: 3 });
  const [begun, ended] = spans;
  assert.deepEqual([begun.step, begun.detail, begun.ms], ['step', { node: 'filter', graph: 'active-customers', state: 'start' }, undefined]);
  assert.deepEqual([ended.id, ended.detail, typeof ended.ms], [begun.id, { node: 'filter', graph: 'active-customers', state: 'done', rows: 3 }, 'number']);
  // Under it, another node's step joins its trace; one already run is said once.
  const failed = traceStep('count', { parent: step });
  failed.end('failed', { error: 'no rows' });
  traceStep('output', { parent: step, state: 'skipped' });
  const under = spans.slice(2);
  assert.deepEqual(under.map((s) => [s.detail.node, s.detail.state, s.trace === begun.trace, s.parent === begun.id]),
    [['count', 'start', true, true], ['count', 'failed', true, true], ['output', 'skipped', true, true]]);
  assert.equal(under.at(-1).ms, 0, 'said once, ended');
  assert.equal(spans.filter((s) => s.detail.node === 'output').length, 1);
});

test('the node ↔ step map: S3\'s spans light the Source and the Store, a named step its own node; the walk names each node it counted', () => {
  assert.deepEqual(['load', 'request', 'answer', 'hold', 'recheck', 'send', 'other'].map((step) => queryStepNode({ step })),
    ['source', 'store', 'store', 'store', 'store', 'store', undefined]);
  assert.equal(queryStepNode({ step: 'load', detail: { node: 'when-view-status' } }), 'when-view-status');
  assert.deepEqual(walkedNodes('view', { '': 9, region: 4, 'preset:mine': 2 }), [
    { node: 'when-view-region', rows: 4, field: 'region' }, { node: 'preset-view-mine', rows: 2 },
  ]);
  // …by the ids the graph is drawn by.
  const graph = queryGraph(
    { v: 1, scopes: { view: { holds: ['region'], readings: readingsOf({ region: { in: ['EMEA'] } }), sort: [{ field: 'region', direction: 'asc' }] } } },
    { v: 1, id: 'records', source: { store: 'customers', scopes: { view: { presets: [{ id: 'mine', label: 'Mine', where: { region: { in: ['EMEA'] } } }] } } } },
  );
  const ids = graph.nodes.map((n) => n.id);
  for (const id of [QUERY_NODE.store, QUERY_NODE.source, QUERY_NODE.scope('view'), QUERY_NODE.condition('view', 'region'), QUERY_NODE.preset('view', 'mine'), QUERY_NODE.arrange('view')]) {
    assert.ok(ids.includes(id), `${id} is drawn`);
  }
});

test('a load\'s steps, from the walk\'s own counts: each scope and condition under the load, an off one skipped, the arrange with the rows', async (t) => {
  const spans = [];
  t.after(onTrace((span) => spans.push(span)));
  const rows = [{ id: 1, region: 'EMEA', plan: 'Pro' }, { id: 2, region: 'APAC', plan: 'Pro' }, { id: 3, region: 'EMEA', plan: 'Free' }];
  const source = new DataSource({ store: new ArrayStore(rows, { key: 'id' }) });
  await source.query.ask([
    { scope: 'view', hold: ['region', 'plan'] },
    { scope: 'view', field: 'region', reading: { picked: ['EMEA'] } },
    { scope: 'view', field: 'plan', reading: { picked: ['Free'], suspended: true } },
    { scope: 'view', sort: 'id', direction: 'desc' },
  ]);
  await source.load();
  const load = spans.findLast((s) => s.step === 'load' && s.ms !== undefined);
  const applied = source.query.applied;
  const results = { view: await source.results('view') };
  spans.length = 0;
  traceQuerySteps(applied, { walk: { results }, total: load.detail.total }, load);
  const said = spans.map((s) => [s.detail.node, s.detail.state, s.detail.rows, s.trace === load.trace, s.parent === load.id]);
  assert.deepEqual(said, [
    ['scope-view', 'done', undefined, true, true],
    ['when-view-region', 'done', 2, true, true],
    ['when-view-plan', 'skipped', 1, true, true],
    ['arrange-view', 'done', 2, true, true],
  ]);
  source.close();
});
