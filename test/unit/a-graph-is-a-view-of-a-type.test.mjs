/**
 * A GRAPH IS A VIEW OF A TYPE: a View may carry `graph: { type }`, and its canvas shows one entity of
 * that type, picked in the graph chip beside the View chip. The chip's rows come from the entity
 * shelf (the type's presets, then the reader's own, then New graph…); New graph makes an empty
 * entity, checked; the canvas edits the entity's graph as a workflow, with its Group Input and Output
 * where its type has sockets, and keeps its own nodes back. Will, plan 746 E3.
 * TRAP T-a-graph-is-a-view-of-a-type
 *
 *   node --test test/unit/a-graph-is-a-view-of-a-type.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { schemaCheck } from '../../scripts/lib/schema-check.mjs';

const core = new URL('../../dist/core/', import.meta.url);
const { PageKeeper, memoryTier } = await import(new URL('browser/page-state.js', core));
const { NEW_GRAPH, graphOfWorkflow, graphRows, newGraph, openOf } = await import(new URL('data/graph-views.js', core));
const { checkEntity, entityFaults, entityTypes, graphWorkflow, registerEntityType } = await import(new URL('data/entity-types.js', core));
const { checkApp } = await import(new URL('data/app-definition.js', core));
const { onReport } = await import(new URL('data/report.js', core));

const filter = (id, label = id) => ({
  v: 1, type: 'preset-filter', id, label,
  graph: {
    nodes: [
      { id: 'start', kind: 'store', x: 0, y: 0, values: { store: 'customers' } },
      { id: 'status', kind: 'condition', x: 360, y: 0, values: { field: 'status', op: 'eq', value: 'active' } },
    ],
    routes: [{ from: 'start/rows', to: 'status' }, { from: 'status', to: '#out/where' }],
  },
});
const heard = async (run) => {
  const said = [];
  const off = onReport((r) => said.push(r.message));
  try { return { result: await run(), said }; } finally { off(); }
};
const keeper = () => new PageKeeper({ tab: memoryTier(), local: memoryTier() });

test('a View\'s graph names a type: it validates, and a graph View holds no template or content', () => {
  const views = schemaCheck('views.v1.json');
  assert.deepEqual(views({ filters: { label: 'Preset Filters', graph: { type: 'preset-filter' } }, all: { label: 'All' } }), []);
  assert.notDeepEqual(views({ bad: { label: 'Bad', graph: { type: 'Preset Filter' } } }), []);
  assert.notDeepEqual(views({ bad: { label: 'Bad', graph: {} } }), []);
  assert.notDeepEqual(views({ bad: { label: 'Bad', graph: { type: 'node' }, template: 'a.html#a' } }), []);
  assert.notDeepEqual(views({ bad: { label: 'Bad', graph: { type: 'node' }, content: '<p></p>' } }), []);
});

test('chrome.filters "views" validates, and is for a Context with no definition', async () => {
  const app = (chrome, definition) => ({ v: 1, default: 'nodes', contexts: { nodes: { label: 'Nodes', template: 'n.html', ...(definition ? { definition } : {}), chrome } } });
  assert.deepEqual(schemaCheck('app.v1.json')(app({ filters: 'views' })), []);
  assert.notDeepEqual(schemaCheck('app.v1.json')(app({ filters: 'chips' })), []);
  assert.deepEqual(await heard(() => checkApp(app({ filters: 'views' }))), { result: true, said: [] });
  const { result, said } = await heard(() => checkApp(app({ filters: 'views' }, 'page.json')));
  assert.equal(result, false);
  assert.match(said[0], /has a definition, so its filter row is its page's/);
});

test('the graph chip\'s rows come from the shelf: the type\'s presets, read only, then the reader\'s own, then New graph…', async () => {
  const k = keeper();
  k.entityPresets = [filter('shipped', 'Shipped')];
  assert.equal(await k.entities.save(filter('mine', 'Mine')), true);
  const list = k.entities.list('preset-filter');
  assert.deepEqual(graphRows(list, 'mine'), [
    { value: 'shipped', label: 'Shipped', section: 'Presets', note: 'Read only' },
    { value: 'mine', label: 'Mine', section: 'My graphs', selected: true },
    { value: NEW_GRAPH, label: 'New graph…' },
  ]);
  // The words are the caller's.
  assert.equal(graphRows([], null, { presets: 'P', mine: 'M', readOnly: 'R', new: 'New…' }).at(-1).label, 'New…');
  // The one named, when it is of the list; else the first.
  assert.equal(openOf(list, 'mine').id, 'mine');
  assert.equal(openOf(list, 'gone').id, 'shipped');
  assert.equal(openOf(list, null).id, 'shipped');
  assert.equal(openOf([], 'mine'), undefined);
});

test('New graph makes an empty entity of the type, checked and kept: its name or a numbered default, a free id, the type\'s own settings', async () => {
  const k = keeper();
  k.entityPresets = [filter('new-preset-filter', 'Taken')];
  const types = entityTypes();
  const { result: first, said } = await heard(() => newGraph(k.entities, types['preset-filter']));
  assert.deepEqual(said, []);
  // The id a preset holds is not taken over.
  assert.equal(first, 'new-preset-filter-2');
  const made = k.entities.get(first);
  assert.deepEqual({ ...made }, { v: 1, type: 'preset-filter', id: first, label: 'New Preset Filter', graph: { nodes: [], routes: [] }, origin: 'mine' });
  assert.equal(checkEntity(made), true);
  // A second default reads apart; a name of the reader's is theirs, with its description.
  const second = await newGraph(k.entities, types['preset-filter']);
  assert.equal(k.entities.get(second).label, 'New Preset Filter 2');
  const named = await newGraph(k.entities, types['preset-filter'], { label: ' 2026 renewals ', description: ' Due this year ' });
  assert.equal(named, 'preset-filter-2026-renewals');
  assert.deepEqual([k.entities.get(named).label, k.entities.get(named).description], ['2026 renewals', 'Due this year']);
  // A Custom Node starts with its type's sockets: none.
  const node = await newGraph(k.entities, types.node);
  assert.deepEqual(k.entities.get(node).settings, { inputs: [], outputs: [] });
  assert.deepEqual(k.entities.list('preset-filter').map((e) => e.origin), ['preset', 'mine', 'mine', 'mine']);
});

test('an EMPTY graph is a new one: its outputs are asked for once it places a node', () => {
  const empty = { v: 1, type: 'preset-filter', id: 'empty', label: 'Empty', graph: { nodes: [], routes: [] } };
  assert.deepEqual(entityFaults(empty), []);
  const placed = { ...empty, graph: { nodes: [{ id: 'start', kind: 'store', x: 0, y: 0 }], routes: [] } };
  assert.deepEqual(entityFaults(placed), ['the Preset Filter "empty" sends nothing to its output "where": route one to #out/where']);
});

test('the canvas edits an entity\'s graph as a workflow — its Group Input and Output where its type has sockets — and keeps its own nodes back', () => {
  const off = registerEntityType({ id: 'flow', label: 'Flow', runs: true });
  try {
    const kinds = (e) => graphWorkflow(e).workflow.nodes.map((n) => n.id);
    assert.deepEqual(kinds(filter('pf')), ['start', 'status', '#out']);
    const node = {
      v: 1, type: 'node', id: 'has-role', label: 'Has role',
      graph: { nodes: [{ id: 'c', kind: 'condition', x: 0, y: 0 }], routes: [{ from: '#in/users', to: 'c' }, { from: 'c/rows', to: '#out/allowed' }] },
      settings: { inputs: [{ name: 'users', type: 'object' }], outputs: [{ name: 'allowed', type: 'object' }] },
    };
    assert.deepEqual(kinds(node), ['#in', 'c', '#out']);
    const flow = { v: 1, type: 'flow', id: 'onboard', label: 'Onboard', graph: { nodes: [{ id: 'start', kind: 'store', x: 0, y: 0 }], routes: [] } };
    assert.deepEqual(kinds(flow), ['start']);
    const { workflow, kinds: offered } = graphWorkflow(filter('pf', 'PF'));
    // Its id the entity's, so its tab draft is its own; its own kind not offered on its canvas.
    assert.deepEqual([workflow.id, workflow.label, 'preset-filter:pf' in offered, '#group-output' in offered], ['pf', 'PF', false, true]);
    assert.deepEqual(graphOfWorkflow(workflow), filter('pf').graph);
    assert.deepEqual(graphOfWorkflow({ nodes: [], routes: undefined, ties: [] }), { nodes: [], routes: [] });
  } finally {
    off();
  }
});
