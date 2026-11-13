/**
 * AN ENTITY SHELF IS ONE DOOR: the presets a file ships (read only) and the reader's own, of every
 * type, behind list / get / save / remove / duplicate / export / import / watch. A save is checked
 * by checkEntity; a remove is refused while another entity uses it, naming who; the reader's own are
 * ONE named part of the keeper, so every tab sees them and the server is sent them; a stored value of
 * the wrong shape is dropped. Its `library()` is every reusable entity as a Custom Node; the old `nodes` part is gone. Will, plan 746 E2. TRAP T-an-entity-is-an-envelope-and-a-type
 *
 *   node --test test/unit/an-entity-shelf-is-one-door.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { schemaCheck } from '../../scripts/lib/schema-check.mjs';

const core = new URL('../../dist/core/', import.meta.url);
const { PageKeeper, memoryTier, NODES_PAGE } = await import(new URL('browser/page-state.js', core));
const { readEntities } = await import(new URL('browser/entity-files.js', core));
const { makeShelf, joinEntities } = await import(new URL('data/entity-shelf.js', core));
const { definitionOf, nodeEntityOf, isEntity } = await import(new URL('data/entity.js', core));
const { deleteNode, keepNode } = await import(new URL('data/custom-nodes.js', core));
const { onReport } = await import(new URL('data/report.js', core));

const filter = (id, label = id, extra = {}) => ({
  v: 2, type: 'filter', id, label,
  graph: {
    nodes: [
      { id: 'start', kind: 'source', x: 0, y: 0, values: { store: 'customers' } },
      { id: 'status', kind: 'value', x: 0, y: 200, values: { value: 'active' } },
      { id: 'filter', kind: 'condition', x: 540, y: 0, values: { type: 'eq' } },
      { id: 'field', kind: 'field', x: 270, y: 0, values: { field: 'status' } },
    ],
    // The test's True into the Group Output: no node has a True socket (plan 944).
    connections: [{ from: 'start/rows', to: 'field' }, { from: 'field/field', to: 'filter' }, { from: 'status/value', to: 'filter/b' }, { from: 'filter/true', to: '#out/where' }],
  },
  settings: { source: 'customers' }, ...extra,
});
/** A filter whose graph places another entity. */
const placing = (id, kind) => filter(id, id, { graph: { nodes: [{ id: 'inner', kind, x: 0, y: 0 }], connections: [{ from: 'inner', to: '#out/where' }] } });
const HAS_ROLE = {
  v: 1, label: 'Has role', category: 'Logic',
  inputs: [{ name: 'users', label: 'Users', type: 'object' }],
  outputs: [{ name: 'allowed', label: 'Allowed', type: 'object' }],
  nodes: [{ id: 'has-role', kind: 'condition', x: 200, y: 0, values: { type: 'eq' } }, { id: 'role', kind: 'field', x: 0, y: 0, values: { field: 'role' } }],
  // An output made from the test's True property (plan 944).
  connections: [{ from: '#in/users', to: 'role' }, { from: 'role/field', to: 'has-role' }, { from: 'has-role/pass', to: '#out/allowed' }, { from: 'has-role/true', to: '#out' }],
};
const heard = async (run) => {
  const reports = [];
  const off = onReport((r) => reports.push(r));
  try { return { result: await run(), reports }; } finally { off(); }
};
const keeper = (local = memoryTier(), options = {}) => new PageKeeper({ tab: memoryTier(), local, ...options });
const ids = (shelf, type) => shelf.list(type).map((e) => e.id);

test('save, list, get: presets first and read only, the reader\'s own marked mine; a list carries no graph', async () => {
  const k = keeper();
  k.entityPresets = [filter('shipped', 'Shipped')];
  assert.equal(await k.entities.save(filter('mine', 'Mine')), true);
  assert.deepEqual(k.entities.list(), [
    { id: 'shipped', type: 'filter', label: 'Shipped', origin: 'preset' },
    { id: 'mine', type: 'filter', label: 'Mine', origin: 'mine' },
  ]);
  assert.deepEqual(ids(k.entities, 'node'), []);
  assert.equal(k.entities.get('mine').origin, 'mine');
  assert.equal(k.entities.get('shipped').origin, 'preset');
  assert.equal(k.entities.get('nope'), undefined);
  // What is kept has no origin: it is set on read.
  assert.equal('origin' in k.read(NODES_PAGE).entities.mine, false);
});

test('a preset is read only: it is not saved over, not removed, and a reader\'s clash is left out', async () => {
  const k = keeper();
  k.entityPresets = [filter('shipped', 'Shipped')];
  const { result, reports } = await heard(async () => [
    await k.entities.save(filter('shipped', 'Over it')), k.entities.remove('shipped'),
    await k.entities.save({ ...filter('shipped'), type: 'node', settings: { inputs: [], outputs: [] } }),
  ]);
  assert.deepEqual(result, [false, false, false]);
  assert.match(reports.map((r) => r.message).join('\n'), /"shipped" is a preset, which is read only: use "Copy to my entities"/);
  assert.equal(k.entities.get('shipped').label, 'Shipped');
  assert.equal(joinEntities([filter('a', 'Preset')], { a: filter('a', 'Smuggled'), b: filter('b') }).map((e) => `${e.id}:${e.origin}`).join(), 'a:preset,b:mine');
  // A preset's copy is the reader's: duplicate.
  assert.equal(await k.entities.duplicate('shipped', 'shipped-mine'), true);
  assert.deepEqual(k.entities.list().map((e) => [e.id, e.origin]), [['shipped', 'preset'], ['shipped-mine', 'mine']]);
  assert.equal(k.entities.get('shipped-mine').label, 'Shipped copy');
});

test('an id names ONE entity: another type may not take it; a fault in a save refuses it, in words', async () => {
  const k = keeper();
  await k.entities.save(filter('one'));
  const { result, reports } = await heard(async () => [
    await k.entities.save({ v: 2, type: 'node', id: 'one', label: 'Same id', graph: { nodes: [] }, settings: { inputs: [], outputs: [] } }),
    await k.entities.save({ ...filter('bad'), type: 'recipe' }),
    await k.entities.save(filter('also-bad', 'x', { settings: { colour: 'red' } })),
    await k.entities.save({ nope: true }),
  ]);
  assert.deepEqual(result, [false, false, false, false]);
  const said = reports.map((r) => r.message).join('\n');
  assert.match(said, /"one" is already a filter/);
  assert.match(said, /type "recipe", which this app does not have/);
  assert.match(said, /the setting "colour"/);
  assert.match(said, /not an entity/);
  assert.deepEqual(ids(k.entities), ['one']);
});

test('remove is refused while another entity uses it, naming who; then it goes, and the user\'s own only', async () => {
  const k = keeper();
  await k.entities.save(filter('recent', 'Recent'));
  assert.equal(await k.entities.save(placing('outer-a', 'filter:recent')), true);
  assert.deepEqual(k.entities.get('outer-a').uses, [{ type: 'filter', id: 'recent' }], 'uses is kept from the graph');
  await k.entities.save(placing('outer-b', 'filter:recent'));
  const { result, reports } = await heard(async () => k.entities.remove('recent'));
  assert.equal(result, false);
  assert.match(reports[0].message, /"Recent" is used by "outer-a" and "outer-b", so it stays/);
  assert.ok(k.entities.get('recent'));
  assert.equal(k.entities.remove('outer-a'), true);
  assert.equal(k.entities.remove('outer-b'), true);
  assert.equal(k.entities.remove('recent'), true);
  assert.equal(k.entities.remove('recent'), false, 'gone is gone');
  assert.deepEqual(ids(k.entities), []);
  // A save that places what is not there is refused; one that holds itself in a loop too.
  assert.equal((await heard(() => k.entities.save(placing('lost', 'filter:ghost')))).result, false);
  await k.entities.save(filter('b', 'B'));
  await k.entities.save(placing('a', 'filter:b'));
  assert.equal((await heard(() => k.entities.save(placing('b', 'filter:a')))).result, false);
});

test('duplicate takes a new id; export and import are JSON with a $schema and round-trip; a taken id gets a free one', async () => {
  const k = keeper();
  await k.entities.save(filter('one', 'One'));
  assert.equal(await k.entities.duplicate('one', 'two'), true);
  assert.equal(k.entities.get('two').label, 'One copy');
  assert.equal((await heard(() => k.entities.duplicate('one', 'two'))).result, true, 'a copy over an own one is a save');
  assert.equal((await heard(() => k.entities.duplicate('ghost', 'x'))).result, false);

  const text = k.entities.export('one');
  const json = JSON.parse(text);
  assert.equal(json.$schema, 'https://sherpa-ui.dev/schemas/entity.v2.json');
  assert.equal('origin' in json, false);
  assert.deepEqual(schemaCheck('entity.v2.json')(json), []);
  assert.equal(k.entities.export('ghost'), undefined);
  // Out, away, back in: the same entity.
  const before = k.entities.get('one');
  k.entities.remove('one');
  assert.equal(await k.entities.import(text), 'one');
  assert.deepEqual(k.entities.get('one'), before);
  // A clash is offered a free id; a bad file says so and keeps nothing.
  assert.equal(await k.entities.import(text), 'one-copy');
  assert.equal(await k.entities.import(text), 'one-copy-2');
  const { result, reports } = await heard(async () => [await k.entities.import('{ not json'), await k.entities.import('{"v":1}'), await k.entities.import(JSON.stringify({ ...json, type: 'recipe', id: 'zz' }))]);
  assert.deepEqual(result, [undefined, undefined, undefined]);
  assert.match(reports.map((r) => r.message).join('\n'), /not JSON[\s\S]*not an entity[\s\S]*"recipe"/);
  assert.equal(k.entities.get('zz'), undefined);
});

test('the keeper keeps it app-wide: a second tab sees it, so does a reload; and it is the local tier\'s, never the tab\'s', async () => {
  const local = memoryTier();
  const first = keeper(local);
  await first.entities.save(filter('mine', 'Mine'));
  assert.equal(keeper(local).entities.get('mine').label, 'Mine', 'another tab: the same local tier');
  assert.equal(keeper(local).read(NODES_PAGE).entities.mine.label, 'Mine', 'a reload');
  assert.deepEqual(Object.keys(first.read(NODES_PAGE)).sort(), ['entities', 'v']);
  const tab = memoryTier();
  const own = new PageKeeper({ tab, local: memoryTier() });
  await own.entities.save(filter('x'));
  assert.equal(tab.read('sherpa:page:#app'), undefined);
});

test('a watcher is told at once, and stops on the signal', async () => {
  const k = keeper();
  const seen = [];
  const stop = new AbortController();
  k.entities.watch((list) => seen.push(list.map((e) => e.id)), stop.signal);
  await k.entities.save(filter('one'));
  k.entities.remove('one');
  stop.abort();
  await k.entities.save(filter('two'));
  assert.deepEqual(seen, [['one'], []]);
});

test('the persist guard drops a stored entity of the wrong shape, and a preset smuggled in as the reader\'s', () => {
  const local = memoryTier();
  local.write('sherpa:page:#app', { v: 3, entities: {
    ok: filter('ok'), wrong: { label: 'No graph' }, later: { ...filter('later'), v: 3 }, sneaky: { ...filter('sneaky'), origin: 'preset' }, 'Bad Id': { ...filter('x'), id: 'Bad Id' },
  } });
  assert.deepEqual(Object.keys(keeper(local).read(NODES_PAGE).entities), ['ok']);
});

/** An entity as it was kept before plan 934: a v1, its graph's links its `routes`. */
const keptBefore = (e) => {
  const { connections, ...graph } = e.graph;
  return { ...e, v: 1, graph: { ...graph, routes: connections } };
};

test('an entity kept before plan 934, a v1, is not read: a file reports it and keeps the rest, the store drops it, an import refuses it (plan 960 D4: delete, never convert)', async () => {
  const was = keptBefore(filter('before'));
  assert.equal(isEntity(was), false);
  const said = [];
  const off = onReport((r) => said.push(r.message));
  try {
    // A file of entities: an old one in a v3 is left out, in words; an old file is none.
    assert.deepEqual(Object.keys(readEntities({ v: 3, entities: { before: was, now: filter('now') } }).entities), ['now']);
    assert.deepEqual(readEntities({ v: 1, entities: { now: filter('now') } }).entities, {});
    assert.deepEqual(readEntities({ v: 2, entities: { now: filter('now') } }).entities, {}, 'an old file is no file: D4, delete never convert');
    assert.ok(said.some((m) => m.includes('"before"')) && said.some((m) => m.includes('a v3 with its entities by id')), said.join(' | '));
  } finally {
    off();
  }
  // The reader's own, as the store keeps them.
  const local = memoryTier();
  local.write('sherpa:page:#app', { v: 3, entities: { before: was, now: filter('now') } });
  assert.deepEqual(ids(keeper(local).entities), ['now']);
  // An import.
  assert.equal(await keeper(memoryTier()).entities.import(JSON.stringify({ ...was, id: 'imported' })), undefined);
});

test('the old `nodes` is not read; a Custom Node is an entity of the type `node`', async () => {
  const local = memoryTier();
  local.write('sherpa:page:#app', { v: 3, nodes: { old: HAS_ROLE }, entities: { 'has-role': nodeEntityOf('has-role', HAS_ROLE) } });
  const k = keeper(local);
  assert.deepEqual(ids(k.entities, 'node'), ['has-role'], 'the old `nodes` adds none');
  assert.deepEqual(definitionOf(k.entities.get('has-role')), HAS_ROLE);
  // Its library is the same set, as Custom Nodes; the doors keep and forget one (plan 942).
  assert.deepEqual(Object.keys(k.entities.library().nodes), ['has-role']);
  assert.deepEqual(await keepNode(k.entities, 'another', { ...HAS_ROLE, label: 'Another' }), { id: 'another' });
  assert.deepEqual(ids(k.entities, 'node'), ['has-role', 'another']);
  // Every entity is a node it offers, by its use's kind (plan 746 E5); one id names one entity, of any type.
  await k.entities.save(filter('f'));
  assert.deepEqual(Object.keys(k.entities.library().nodes), ['has-role', 'another', 'filter:f']);
  assert.deepEqual(deleteNode(k.entities, 'another'), { id: 'another' });
  assert.deepEqual(deleteNode(k.entities, 'f'), { id: 'f' });
  assert.deepEqual(Object.keys(k.entities.library().nodes), ['has-role']);
});

test('the keeper pushes the reader\'s entities to the server and takes them back, under the local ones; a server\'s `nodes` is not read', async () => {
  const pushes = [];
  const remote = {
    pull: async (page) => (page === NODES_PAGE ? { entities: { far: filter('far', 'Far'), mine: filter('mine', 'Server\'s'), junk: { label: 3 } }, nodes: { 'has-role': HAS_ROLE } } : {}),
    push: async (page, named) => void pushes.push({ page, named }),
  };
  const k = keeper(memoryTier(), { remote, interval: 10 });
  await k.entities.save(filter('mine', 'Mine'));
  await k.flush();
  assert.equal(pushes.length, 1);
  assert.equal(pushes[0].page, NODES_PAGE);
  assert.deepEqual(Object.keys(pushes[0].named.entities), ['mine']);
  assert.equal('nodes' in pushes[0].named, false);
  const restored = await k.restore(NODES_PAGE);
  assert.deepEqual(Object.keys(restored.entities).sort(), ['far', 'mine']);
  assert.equal(restored.entities.mine.label, 'Mine', 'an unpushed local edit wins');
  assert.equal('nodes' in restored, false, 'a server\'s `nodes` is not read');
  assert.equal(k.entities.get('far').label, 'Far');
});

test('a file of presets: each is checked alone, the bad reported in checkEntity\'s words and the rest load; the key is the id', async () => {
  const { result, reports } = await heard(() => readEntities({
    v: 3, entities: {
      // Before the one it places: tried again once that one is in.
      after: placing('after', 'filter:before'),
      before: { ...filter('before'), $schema: 'x' },
      'no-name': { ...filter('no-name'), label: '' },
      'wrong-key': filter('other'),
      recipe: { ...filter('recipe'), type: 'recipe' },
      unreached: { ...filter('unreached'), graph: { nodes: filter('x').graph.nodes, connections: [] } },
    },
  }));
  assert.deepEqual(Object.keys(result.entities).sort(), ['after', 'before']);
  assert.equal('$schema' in result.entities.before, false);
  const said = reports.map((r) => r.message).join('\n');
  assert.match(said, /"no-name" is left out/);
  assert.match(said, /key is "wrong-key", but its id is "other"/);
  assert.match(said, /"recipe", which this app does not have/);
  assert.match(said, /sends nothing to its output "where"/);
  assert.ok(reports.every((r) => r.code === 'entity'));
  assert.deepEqual(schemaCheck('entities.v3.json')({ v: 3, entities: { before: filter('before') } }), []);
  const none = await heard(() => readEntities([1]));
  assert.deepEqual(none.result, { v: 3, entities: {} });
  assert.equal(none.reports.length, 1);
});

test('a shelf needs only a port: no keeper, no browser', async () => {
  let mine = {};
  const heardBy = new Set();
  const shelf = makeShelf({ presets: () => [], mine: () => mine, keep: (next) => { mine = next; heardBy.forEach((h) => h()); }, heard: (h) => void heardBy.add(h) });
  assert.equal(await shelf.save(filter('one')), true);
  assert.deepEqual(ids(shelf), ['one']);
  let told = 0;
  shelf.watch(() => told++);
  shelf.remove('one');
  assert.equal(told, 1);
});

test('a save keeps the FINAL graph: what a node holds for its other types stays behind (Will, 2026-11-05)', async () => {
  const { NODE_KINDS } = await import(new URL('data/node-kinds.js', core));
  const row = (name) => ({ name, label: name.toUpperCase(), control: 'text', input: 'value' });
  const pair = {
    heading: 'Pair', icon: 'function', typeLabel: 'Operation', rows: [], model: 'x', graphs: ['workflow'], category: 'Variables', output: 'value',
    types: { one: { label: 'One', rows: [row('a')] }, two: { label: 'Two', rows: [row('b')] } },
  };
  let mine = {};
  const shelf = makeShelf({ presets: () => [], mine: () => mine, keep: (next) => { mine = next; }, heard: () => {} }, () => ({ kinds: { ...NODE_KINDS, pair } }));
  const base = filter('kept', 'Kept');
  const entity = { ...base, graph: {
    nodes: [...base.graph.nodes, { id: 'p', kind: 'pair', x: 0, y: 400, values: { type: 'two', a: 'held', b: 'live' } }],
    connections: [...base.graph.connections, { from: 'status/value', to: 'p/a' }, { from: 'status/value', to: 'p/b' }],
  } };
  const { result, reports } = await heard(() => shelf.save(entity));
  assert.deepEqual([result, reports], [true, []]);
  const kept = mine['kept'].graph;
  assert.deepEqual(kept.nodes.find((n) => n.id === 'p').values, { type: 'two', b: 'live' });
  assert.deepEqual(kept.connections.filter((r) => r.to.startsWith('p/')), [{ from: 'status/value', to: 'p/b' }]);
});
