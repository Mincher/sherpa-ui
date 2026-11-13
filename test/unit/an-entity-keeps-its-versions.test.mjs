/**
 * AN ENTITY KEEPS ITS VERSIONS (Will, plan 972: "Save is a draft", D1 A; "the use you edit through takes it at once", D2 A).
 * Its graph, name and settings are its working draft; a Save writes the draft only. Publish makes the next NUMBER, kept
 * with its definition, and only then do its uses see it. A Roll back publishes an earlier version as the next number. A
 * save may only add versions at the front; a new id's first save publishes version 1; a copy starts at 1.
 *
 *   node --test test/unit/an-entity-keeps-its-versions.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const core = new URL('../../dist/core/', import.meta.url);
const { PageKeeper, memoryTier } = await import(new URL('browser/page-state.js', core));
const V = await import(new URL('data/entity-versions.js', core));
const lib = await import(new URL('data/node-library.js', core));
const { onReport } = await import(new URL('data/report.js', core));

const keeper = () => new PageKeeper({ tab: memoryTier(), local: memoryTier() });
/** A Filter whose test reads one status: `value` is that status. */
const filter = (id, label, value) => ({
  v: 3, type: 'filter', id, label,
  graph: {
    nodes: [
      { id: 'start', kind: 'source', x: 0, y: 0, values: { store: 'customers' } },
      { id: 'status', kind: 'value', x: 0, y: 200, values: { value } },
      { id: 'filter', kind: 'condition', x: 540, y: 0, values: { type: 'eq' } },
      { id: 'field', kind: 'field', x: 270, y: 0, values: { field: 'status' } },
    ],
    connections: [{ from: 'start/rows', to: 'field' }, { from: 'field/field', to: 'filter' }, { from: 'status/value', to: 'filter/b' }, { from: 'filter/true', to: '#out/where' }],
  },
  settings: { source: 'customers' },
});
const valueIn = (e) => e.graph.nodes.find((n) => n.id === 'status').values.value;
const NOW = new Date('2026-11-13T09:00:00Z');

test('a first save publishes version 1; a save after is a draft, kept, that the library and its uses do not see', async () => {
  const k = keeper();
  assert.equal(await k.entities.save(filter('trials', 'Trials', 'trial')), true);
  const first = k.entities.get('trials');
  assert.deepEqual(first.versions.map((v) => [v.number, v.definition.label]), [[1, 'Trials']]);
  assert.equal(V.draftChanged(first), false);
  // A save writes the draft: the versions stay, and the library still offers version 1's content.
  await k.entities.save(filter('trials', 'Trials, renamed', 'lead'));
  const drafted = k.entities.get('trials');
  assert.equal(valueIn(drafted), 'lead');
  assert.deepEqual(drafted.versions.map((v) => v.number), [1]);
  assert.equal(V.draftChanged(drafted), true);
  const library = k.entities.library();
  assert.equal(library.nodes['filter:trials'].version, 1);
  assert.equal(library.nodes['filter:trials'].label, 'Trials');
  assert.equal(library.nodes['filter:trials'].nodes.find((n) => n.id === 'status').values.value, 'trial');
});

test('Publish makes the next number from the draft; nothing changed, it is refused in words; a preset is read only', async () => {
  const k = keeper();
  k.entityPresets = [{ ...filter('shipped', 'Shipped', 'active'), versions: [] }];
  await k.entities.save(filter('trials', 'Trials', 'trial'));
  assert.deepEqual(await V.publish(k.entities, 'trials'), { refused: 'Nothing to publish: "Trials" is as version 1 says.' });
  await k.entities.save(filter('trials', 'Trials', 'lead'));
  assert.deepEqual(await V.publish(k.entities, 'trials', { by: 'will', note: 'Leads too', now: NOW }), { number: 2 });
  const two = k.entities.get('trials');
  assert.deepEqual(two.versions.map((v) => [v.number, v.by, v.note, v.at, valueIn(v.definition)]),
    [[2, 'will', 'Leads too', NOW.toISOString(), 'lead'], [1, undefined, undefined, two.versions[1].at, 'trial']]);
  assert.equal(V.draftChanged(two), false);
  assert.equal(k.entities.library().nodes['filter:trials'].version, 2);
  assert.match((await V.publish(k.entities, 'shipped')).refused, /preset, which is read only/);
  assert.match((await V.publish(k.entities, 'nope')).refused, /"nope" is not there/);
});

test('a use follows the published number: a draft is unseen; published, every use but one that already holds it says Update available', async () => {
  const k = keeper();
  await k.entities.save(filter('trials', 'Trials', 'trial'));
  const at1 = k.entities.library();
  const flow = { v: 3, id: 'flow', nodes: [lib.useOf(at1, 'filter:trials', { id: 'one', x: 0, y: 0 }), lib.useOf(at1, 'filter:trials', { id: 'two', x: 0, y: 200 })], connections: [] };
  assert.deepEqual(flow.nodes.map((n) => n.version), [1, 1]);
  await k.entities.save(filter('trials', 'Trials', 'lead'));
  assert.deepEqual(lib.staleUses(flow, k.entities.library()), []);
  // The use edited through holds the draft already (D2 A): as the editor leaves it, it records what it shows.
  const drafted = { ...flow, nodes: flow.nodes.map((n) => (n.id === 'one' ? { ...n, was: { ...n.was, nodes: k.entities.get('trials').graph.nodes } } : n)) };
  await V.publish(k.entities, 'trials');
  const at2 = k.entities.library();
  assert.deepEqual(lib.staleUses(drafted, at2), ['two']);
  assert.deepEqual(lib.staleUses(lib.updateAll(drafted, 'filter:trials', at2), at2), []);
  assert.equal(lib.updateInstance(drafted, 'two', at2).nodes.find((n) => n.id === 'two').version, 2);
});

test('Roll back publishes an earlier version as the next number, and puts it in the draft: nothing is lost', async () => {
  const k = keeper();
  await k.entities.save(filter('trials', 'Trials', 'trial'));
  await k.entities.save(filter('trials', 'Leads', 'lead'));
  await V.publish(k.entities, 'trials');
  assert.deepEqual(await V.rollBack(k.entities, 'trials', 1, { now: NOW }), { number: 3 });
  const three = k.entities.get('trials');
  assert.deepEqual(three.versions.map((v) => [v.number, v.definition.label, v.note]), [[3, 'Trials', 'Roll back to version 1'], [2, 'Leads', undefined], [1, 'Trials', undefined]]);
  assert.deepEqual([three.label, valueIn(three)], ['Trials', 'trial']);
  assert.equal(V.draftChanged(three), false);
  assert.equal(k.entities.library().nodes['filter:trials'].version, 3);
  assert.deepEqual(await V.rollBack(k.entities, 'trials', 9), { refused: '"Trials" has no version 9.' });
});

test('a save may only ADD versions at the front: one that edits or drops a version is refused in words; a copy starts at 1', async () => {
  const k = keeper();
  await k.entities.save(filter('trials', 'Trials', 'trial'));
  const said = [];
  const off = onReport((r) => said.push(r.message));
  try {
    const had = k.entities.get('trials');
    const { versions: _v, ...bare } = had;
    assert.equal(await k.entities.save(bare), true, 'none given keeps the stored ones');
    assert.equal(await k.entities.save({ ...had, versions: [{ ...had.versions[0], hash: 'edited' }] }), false);
    assert.match(said.join(' '), /must keep the ones it has \(1\) and only add newer ones in front/);
  } finally {
    off();
  }
  assert.deepEqual(k.entities.get('trials').versions.map((v) => v.number), [1]);
  await k.entities.save(filter('trials', 'Leads', 'lead'));
  await V.publish(k.entities, 'trials');
  assert.equal(await k.entities.duplicate('trials', 'trials-copy'), true);
  assert.deepEqual(k.entities.get('trials-copy').versions.map((v) => [v.number, v.definition.label]), [[1, 'Leads copy']]);
});
