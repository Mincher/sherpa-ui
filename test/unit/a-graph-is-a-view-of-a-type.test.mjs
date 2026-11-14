/**
 * A GRAPH IS A VIEW OF A TYPE: a View may carry `graph: { type }`, and its canvas shows one entity of
 * that type, picked in the graph chip beside the View chip. The chip's rows come from the entity
 * shelf (the type's presets, then the reader's own, then New graph…); New graph makes an empty
 * entity, checked; the canvas edits the entity's graph as a workflow, with its Group Input and Output
 * where its type has sockets, and keeps its own nodes back. Save writes the open entity, refused on a
 * preset; Save graph as makes a named copy; Delete is refused, in words, while another entity uses
 * it. Will, plan 746 E3, E4.
 * TRAP T-a-graph-is-a-view-of-a-type
 *
 *   node --test test/unit/a-graph-is-a-view-of-a-type.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { schemaCheck } from '../../scripts/lib/schema-check.mjs';

const core = new URL('../../dist/core/', import.meta.url);
const { PageKeeper, memoryTier } = await import(new URL('browser/page-state.js', core));
const { NEW_GRAPH, PAGE_QUERY, graphOfWorkflow, graphRows, newGraph, openOf, pageRows, pageViewOf, pagesOf, saveGraph, saveGraphAs } = await import(new URL('data/graph-views.js', core));
const { entityTypes, registerEntityType } = await import(new URL('data/entity-types.js', core));
const { checkEntity, entityFaults, graphWorkflow } = await import(new URL('data/entity-check.js', core));
const { checkApp } = await import(new URL('data/app-definition.js', core));
const { onReport } = await import(new URL('data/report.js', core));

const filter = (id, label = id) => ({
  v: 3, type: 'filter', id, label,
  graph: {
    nodes: [
      { id: 'start', kind: 'source', x: 0, y: 0, values: { store: 'customers' } },
      { id: 'status', kind: 'condition', x: 540, y: 0, values: { type: 'eq', b: 'active' } },
      { id: 'field', kind: 'field', x: 270, y: 0, values: { field: 'status' } },
    ],
    // The test's Pass into the Group Output (plan 971 §9).
    connections: [{ from: 'start/rows', to: 'field' }, { from: 'field/field', to: 'status' }, { from: 'status/pass', to: '#out/where' }],
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
  assert.deepEqual(views({ filters: { label: 'Filters', graph: { type: 'filter' } }, all: { label: 'All' } }), []);
  assert.notDeepEqual(views({ bad: { label: 'Bad', graph: { type: 'Filter' } } }), []);
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
  const list = k.entities.list('filter');
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

test('a `query` graph View\'s graphs are the app\'s pages — every Context with a definition, in its order — one row each, none a copy, and no New graph… (TODO 822)', () => {
  assert.equal(PAGE_QUERY, 'query');
  const contexts = {
    home: { label: 'Home', template: 'h.html', definition: 'home.json' },
    editor: { label: 'Node Editor', template: 'e.html', views: 'v.json', chrome: { filters: 'views' } },
    records: { label: 'Records', template: 'r.html', definition: 'records.json' },
  };
  const pages = pagesOf(contexts);
  assert.deepEqual(pages, [{ id: 'home', label: 'Home' }, { id: 'records', label: 'Records' }]);
  assert.deepEqual(pageRows(pages, 'records'), [{ value: 'home', label: 'Home' }, { value: 'records', label: 'Records', selected: true }]);
  assert.equal(pageRows(pages, null).some((r) => r.value === NEW_GRAPH || r.selected), false);
  assert.deepEqual(pagesOf({}), []);
});

test("a page with Views is a section in the Page chip, a row per View under it, its presets read only (plan 960 U4.8b)", () => {
  const pages = [
    { id: 'home', label: 'Home' },
    { id: 'records', label: 'Records', views: [{ id: 'all', label: 'All', origin: 'preset' }, { id: 'mine', label: 'Mine', origin: 'mine' }] },
  ];
  assert.deepEqual(pageRows(pages, 'records/mine'), [
    { value: 'home', label: 'Home' },
    { value: 'records/all', label: 'All', section: 'Records', note: 'Read only' },
    { value: 'records/mine', label: 'Mine', section: 'Records', selected: true },
  ]);
  assert.deepEqual(pageViewOf('records/mine'), { page: 'records', view: 'mine' });
  assert.deepEqual(pageViewOf('records'), { page: 'records' });
});

test('New graph makes an empty entity of the type, checked and kept: its name or a numbered default, a free id, the type\'s own settings', async () => {
  const k = keeper();
  k.entityPresets = [filter('new-filter', 'Taken')];
  const types = entityTypes();
  const { result: first, said } = await heard(() => newGraph(k.entities, types['filter']));
  assert.deepEqual(said, []);
  // The id a preset holds is not taken over.
  assert.equal(first, 'new-filter-2');
  const made = k.entities.get(first);
  // Its first save publishes version 1 (plan 972).
  const { versions, ...envelope } = made;
  assert.deepEqual(envelope, { v: 3, type: 'filter', id: first, label: 'New Filter', graph: { nodes: [], connections: [] }, origin: 'mine' });
  assert.deepEqual(versions.map((v) => [v.number, v.definition.label]), [[1, 'New Filter']]);
  assert.equal(checkEntity(made), true);
  // A second default reads apart; a name of the reader's is theirs, with its description.
  const second = await newGraph(k.entities, types['filter']);
  assert.equal(k.entities.get(second).label, 'New Filter 2');
  const named = await newGraph(k.entities, types['filter'], { label: ' 2026 renewals ', description: ' Due this year ' });
  assert.equal(named, 'filter-2026-renewals');
  assert.deepEqual([k.entities.get(named).label, k.entities.get(named).description], ['2026 renewals', 'Due this year']);
  // A Custom Node starts with its type's sockets: none.
  const node = await newGraph(k.entities, types.node);
  assert.deepEqual(k.entities.get(node).settings, { inputs: [], outputs: [] });
  assert.deepEqual(k.entities.list('filter').map((e) => e.origin), ['preset', 'mine', 'mine', 'mine']);
});

test('an EMPTY graph is a new one: its outputs are asked for once it places a node', () => {
  const empty = { v: 3, type: 'filter', id: 'empty', label: 'Empty', graph: { nodes: [], connections: [] } };
  assert.deepEqual(entityFaults(empty), []);
  const placed = { ...empty, graph: { nodes: [{ id: 'start', kind: 'source', x: 0, y: 0 }], connections: [] } };
  assert.deepEqual(entityFaults(placed), ['the Filter "empty" sends nothing to its output "where": connect one to #out/where']);
});

test('the canvas edits an entity\'s graph as a workflow — its Group Input and Output where its type has sockets — and keeps its own nodes back', () => {
  const off = registerEntityType({ id: 'flow', label: 'Flow', graph: { runs: true } });
  try {
    const kinds = (e) => graphWorkflow(e).workflow.nodes.map((n) => n.id);
    assert.deepEqual(kinds(filter('pf')), ['start', 'status', 'field', '#out']);
    const node = {
      v: 3, type: 'node', id: 'has-role', label: 'Has role',
      graph: { nodes: [{ id: 'c', kind: 'condition', x: 0, y: 0 }], connections: [{ from: '#in/users', to: 'c' }, { from: 'c/pass', to: '#out/allowed' }] },
      settings: { inputs: [{ name: 'users', type: 'object' }], outputs: [{ name: 'allowed', type: 'object' }] },
    };
    assert.deepEqual(kinds(node), ['#in', 'c', '#out']);
    const flow = { v: 3, type: 'flow', id: 'onboard', label: 'Onboard', graph: { nodes: [{ id: 'start', kind: 'source', x: 0, y: 0 }], connections: [] } };
    assert.deepEqual(kinds(flow), ['start']);
    const { workflow, kinds: offered } = graphWorkflow(filter('pf', 'PF'));
    // Its id the entity's, so its tab draft is its own; its own kind not offered on its canvas.
    assert.deepEqual([workflow.id, workflow.label, 'filter:pf' in offered, '#group-output' in offered], ['pf', 'PF', false, true]);
    assert.deepEqual(graphOfWorkflow(workflow), filter('pf').graph);
    assert.deepEqual(graphOfWorkflow({ nodes: [], connections: undefined, ties: [] }), { nodes: [], connections: [] });
  } finally {
    off();
  }
});

test('Save writes the graph on the canvas to the reader\'s own entity, and is refused on a preset, which is read only', async () => {
  const k = keeper();
  k.entityPresets = [filter('shipped', 'Shipped')];
  await k.entities.save(filter('mine', 'Mine'));
  const edited = { ...filter('x').graph, nodes: filter('x').graph.nodes.map((n) => (n.id === 'status' ? { ...n, values: { ...n.values, b: 'trial' } } : n)) };
  assert.deepEqual(await heard(() => saveGraph(k.entities, 'mine', { graph: edited })), { result: true, said: [] });
  assert.equal(k.entities.get('mine').graph.nodes[1].values.b, 'trial');
  const { result, said } = await heard(() => saveGraph(k.entities, 'shipped', { graph: edited }));
  assert.equal(result, false);
  assert.match(said[0], /"shipped" is a preset, which is read only/);
  assert.equal(k.entities.get('shipped').graph.nodes[1].values.b, 'active');
  assert.equal(await saveGraph(k.entities, 'gone', { graph: edited }), false);
});

test('Save graph as makes a COPY — of a preset too: the reader\'s own, named, under a free id, with the canvas\'s graph — and the graph chip lists it', async () => {
  const k = keeper();
  k.entityPresets = [filter('shipped', 'Shipped')];
  const edited = { ...filter('x').graph, nodes: filter('x').graph.nodes.map((n) => ({ ...n, x: n.x + 40 })) };
  const id = await saveGraphAs(k.entities, 'shipped', { graph: edited }, { label: 'My shipped', description: ' Mine now ' });
  assert.equal(id, 'my-shipped');
  const copy = k.entities.get(id);
  assert.deepEqual([copy.origin, copy.label, copy.description, copy.graph.nodes[0].x], ['mine', 'My shipped', 'Mine now', 40]);
  assert.equal(k.entities.get('shipped').graph.nodes[0].x, 0);
  // The same name again: a free id, the reader's name kept.
  assert.equal(await saveGraphAs(k.entities, id, { graph: edited }, { label: 'My shipped' }), 'my-shipped-2');
  assert.equal(k.entities.get('my-shipped-2').description, undefined);
  assert.deepEqual(graphRows(k.entities.list('filter'), id).map((r) => [r.value, r.section, !!r.selected]), [
    ['shipped', 'Presets', false], ['my-shipped', 'My graphs', true], ['my-shipped-2', 'My graphs', false], [NEW_GRAPH, undefined, false],
  ]);
  assert.equal(await saveGraphAs(k.entities, 'shipped', { graph: edited }, { label: '  ' }), undefined);
  // A Clone keeps a description it is not told of, and the label it is (plan 972c).
  const { clone } = await import(new URL('../../dist/core/data/entity-versions.js', import.meta.url));
  await k.entities.save({ ...filter('described', 'Described'), description: 'Kept' });
  assert.deepEqual(await clone(k.entities, 'described', { id: 'described-copy' }), { id: 'described-copy' });
  assert.deepEqual([k.entities.get('described-copy').label, k.entities.get('described-copy').description], ['Described copy', 'Kept']);
});

test('Delete is refused in words while another entity uses it, and on a preset; once nothing uses it, it goes', async () => {
  const k = keeper();
  k.entityPresets = [filter('shipped', 'Shipped')];
  await k.entities.save(filter('inner', 'Inner'));
  await k.entities.save({ ...filter('outer', 'Outer'), graph: { nodes: [{ id: 'use', kind: 'filter:inner', x: 0, y: 0 }], connections: [{ from: 'use', to: '#out/where' }] } });
  assert.equal(k.entities.whyKept('inner'), '"Inner" is used by "Outer", so it stays: take it out of them first.');
  assert.equal(k.entities.whyKept('shipped'), '"shipped" is a preset, which is read only.');
  assert.equal(k.entities.whyKept('outer'), undefined);
  const { result, said } = await heard(() => k.entities.remove('inner'));
  assert.deepEqual([result, said], [false, ['remove: "Inner" is used by "Outer", so it stays: take it out of them first.']]);
  assert.equal(k.entities.remove('outer'), true);
  assert.equal(k.entities.whyKept('inner'), undefined);
  assert.equal(k.entities.remove('inner'), true);
  assert.deepEqual(k.entities.list('filter').map((e) => e.id), ['shipped']);
});
