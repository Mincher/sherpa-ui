/**
 * A PLACE IS NO EDIT — Will, TODO 1001: "Node position edits, unfurls, swimlane toggles don't count as edits requiring a
 * save. They apply and save automatically." Plan 1001a (D1 A): where a graph is drawn is said once, in graph-layout.ts,
 * and is no part of a version. A version's hash leaves it out, and is made again with today's function, so no hash kept
 * before goes stale; a roll back takes what the version DID and leaves each node where it is. A node's stage is no place
 * (D2 A): it changes the run.
 *
 *   node --test test/unit/a-place-is-no-edit.test.mjs
 *
 * TRAP T-a-place-is-no-edit
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const core = new URL('../../dist/core/', import.meta.url);
const { PageKeeper, memoryTier } = await import(new URL('browser/page-state.js', core));
const V = await import(new URL('data/entity-versions.js', core));
const { isGraphPlaces, placesOf, withPlaces, withoutPlaces } = await import(new URL('data/graph-layout.js', core));

const keeper = () => new PageKeeper({ tab: memoryTier(), local: memoryTier() });
/** A Filter whose test reads one status: `value` is that status; `dx` moves every node right. */
const filter = (value, dx = 0) => ({
  v: 3, type: 'filter', id: 'trials', label: 'Trials',
  graph: {
    nodes: [
      { id: 'start', kind: 'source', x: 0 + dx, y: 0, values: { store: 'customers' } },
      { id: 'status', kind: 'value', x: 0 + dx, y: 200, values: { value } },
      { id: 'filter', kind: 'condition', x: 540 + dx, y: 0, values: { type: 'eq' } },
      { id: 'field', kind: 'field', x: 270 + dx, y: 0, values: { field: 'status' } },
    ],
    connections: [{ from: 'start/rows', to: 'field' }, { from: 'field/field', to: 'filter' }, { from: 'status/value', to: 'filter/b' }, { from: 'filter/pass', to: '#out/where' }],
  },
  settings: { source: 'customers' },
});
const at = (graph, id) => graph.nodes.find((n) => n.id === id);
/** A staged graph with every kind of place: ties, bends, a node's size, stage widths, swimlanes, the unfurl mark. */
const STAGED = {
  nodes: [{ id: 'a', kind: 'value', x: 0, y: 0, stage: 's1' }, { id: 'b', kind: 'value', x: 400, y: 0, stage: 's2', size: { w: 1.5, h: 1 } }],
  connections: [{ from: 'a/value', to: 'b', via: [{ x: 200, y: 40 }] }],
  ties: [{ id: 't', x: 300, y: 20, connections: [{ from: 'a/value', to: 'b' }] }],
  stages: [{ id: 's1', label: 'One', x: -40 }, { id: 's2', label: 'Two', x: 360, w: 320 }],
  lanes: [{ id: 'l', label: 'Data', families: ['data'] }], beforeLanes: { a: { x: 0, y: 0 }, b: { x: 400, y: 0 } }, unfurl: true,
};

test('where a graph is drawn is said once: read, taken away and put back; a part they do not name keeps its own', () => {
  const places = placesOf(STAGED);
  assert.deepEqual(withPlaces(STAGED, places), STAGED, 'read and put back, it is the same graph');
  const bare = withoutPlaces(STAGED);
  // A tie is layout, whole: made or cut, it saves itself and is no change to publish (Will, 2026-11-15).
  assert.deepEqual(Object.keys(bare).sort(), ['connections', 'nodes', 'stages']);
  assert.deepEqual(places.ties, STAGED.ties, 'each tie whole: its place and the connections it funnels');
  assert.deepEqual(bare.nodes, [{ id: 'a', kind: 'value', stage: 's1' }, { id: 'b', kind: 'value', stage: 's2' }], 'a node keeps its stage');
  assert.deepEqual([bare.connections, bare.stages], [[{ from: 'a/value', to: 'b' }], [{ id: 's1', label: 'One' }, { id: 's2', label: 'Two' }]]);
  // Another graph's places: each part they name takes its own; no bends, no width and no lanes are theirs too.
  const plain = { nodes: [{ id: 'a', kind: 'value', x: 9, y: 9 }, { id: 'c', kind: 'value', x: 7, y: 7 }], connections: [{ from: 'a/value', to: 'b' }], stages: [{ id: 's2', label: 'Two', x: 0 }] };
  const put = withPlaces(STAGED, placesOf(plain));
  assert.deepEqual([at(put, 'a'), at(put, 'b')], [{ id: 'a', kind: 'value', x: 9, y: 9, stage: 's1' }, STAGED.nodes[1]]);
  assert.deepEqual([put.connections, put.stages, 'lanes' in put, 'beforeLanes' in put, 'unfurl' in put, 'ties' in put], [[{ from: 'a/value', to: 'b' }], [STAGED.stages[0], { id: 's2', label: 'Two', x: 0 }], false, false, false, false]);
  // A tie keeps only the connections the graph still has; with none, it goes. Places that name no ties leave the graph's own.
  assert.deepEqual(withPlaces({ ...STAGED, connections: [] }, places).ties, undefined);
  const { ties: _t, ...untied } = places;
  assert.deepEqual(withPlaces(STAGED, untied).ties, STAGED.ties);
  // A place set of the old shape (a tie's place alone) is dropped, never drawn.
  assert.equal(isGraphPlaces({ ...places, ties: { t: { x: 1, y: 2 } } }), false);
  assert.equal(isGraphPlaces(JSON.parse(JSON.stringify(places))), true);
});

test('a version\'s hash leaves out every place, never what the graph does: a node\'s stage, a value, a connection', () => {
  const hash = (graph) => V.hashOfDefinition({ label: 'X', graph });
  const moved = {
    ...STAGED, nodes: STAGED.nodes.map((n) => ({ ...n, x: n.x + 80, size: { w: 2, h: 2 } })), connections: [{ from: 'a/value', to: 'b' }],
    ties: [{ ...STAGED.ties[0], x: 0 }], stages: STAGED.stages.map((st) => ({ id: st.id, label: st.label, x: st.x + 80 })),
  };
  const { lanes: _l, beforeLanes: _b, unfurl: _u, ...noLanes } = STAGED;
  const { ties: _ties, ...untied } = STAGED;
  assert.deepEqual([hash(moved), hash(noLanes), hash(untied)], [hash(STAGED), hash(STAGED), hash(STAGED)], 'a move, a bend, a size, a stage width, Swimlanes off, a tie cut');
  const staged = { ...STAGED, nodes: [STAGED.nodes[0], { ...STAGED.nodes[1], stage: 's1' }] };
  const valued = { ...STAGED, nodes: [{ ...STAGED.nodes[0], values: { value: 1 } }, STAGED.nodes[1]] };
  const joined = { ...STAGED, connections: [] };
  for (const [graph, what] of [[staged, 'a node in another stage'], [valued, 'a value'], [joined, 'a connection gone']]) assert.notEqual(hash(graph), hash(STAGED), what);
  assert.notEqual(V.hashOfDefinition({ label: 'Y', graph: STAGED }), hash(STAGED), 'its words');
});

test('a move alone is kept, and is no change to publish; what the graph does still is', async () => {
  const k = keeper();
  await k.entities.save(filter('trial'));
  const moved = filter('trial', 300);
  moved.graph.nodes = moved.graph.nodes.map((n) => (n.id === 'filter' ? { ...n, size: { w: 1.5, h: 1 } } : n));
  moved.graph.connections = moved.graph.connections.map((c, i) => (i ? c : { ...c, via: [{ x: 150, y: 40 }] }));
  assert.equal(await k.entities.save(moved), true);
  const kept = k.entities.get('trials');
  assert.deepEqual([at(kept.graph, 'start').x, at(kept.graph, 'filter').size, V.draftChanged(kept)], [300, { w: 1.5, h: 1 }, false]);
  assert.deepEqual(await V.publish(k.entities, 'trials'), { refused: 'Nothing to publish: "Trials" is as version 1 says.' });
  // The library and a use draw it where the draft is: a place is the entity's, the last kept.
  assert.equal(at(k.entities.library().nodes['filter:trials'], 'start').x, 300);
  await k.entities.save(filter('lead', 300));
  assert.equal(V.draftChanged(k.entities.get('trials')), true);
});

test('a hash a version kept before never flags a draft: draftChanged makes it again with today\'s function', async () => {
  const k = keeper();
  await k.entities.save(filter('trial'));
  const kept = k.entities.get('trials');
  const stale = { ...kept, versions: [{ ...kept.versions[0], hash: 'kept-by-an-older-hash' }] };
  assert.equal(V.draftChanged(stale), false);
  assert.equal(V.draftChanged({ ...stale, graph: filter('lead').graph }), true);
});

test('a roll back takes what the version did, and leaves each node where it is now (D1 A)', async () => {
  const k = keeper();
  await k.entities.save(filter('trial'));
  await k.entities.save(filter('lead', 300));
  assert.deepEqual(await V.publish(k.entities, 'trials'), { number: 2 });
  assert.deepEqual(await V.rollBack(k.entities, 'trials', 1), { number: 3 });
  const back = k.entities.get('trials');
  assert.deepEqual([at(back.graph, 'status').values.value, at(back.graph, 'start').x, at(back.graph, 'filter').x], ['trial', 300, 840]);
  assert.equal(V.draftChanged(back), false);
});
