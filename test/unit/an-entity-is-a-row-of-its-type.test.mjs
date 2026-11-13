/**
 * AN ENTITY IS A ROW OF ITS TYPE — Will, plan 960 U3: a graph type's entities read through the Store door, so a grid
 * lists Coworkers as it lists Devices. Each is a row at once, kept in step with the shelf; a write goes back through the
 * shelf; a field its graph holds is never written. A type's seed entities are put on the shelf as the reader's own, once
 * per seed, a reader's change left as it is (sherpa-demos-67's points 4 and 5).
 *
 *   node --test test/unit/an-entity-is-a-row-of-its-type.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { entityStore, makeShelf, onReport, publish, registerEntityType, seedEntities, versionsOf } from '../../dist/data.js';
const { START } = await import('../../dist/core/data/node-start.js');

const TEAMMATE = {
  v: 1, id: 'teammate', label: 'Teammate', category: 'Teammates',
  fields: {
    status: { label: 'Status', values: ['active', 'paused'] },
    every: { label: 'Runs', from: 'when/every' },
    minutes: { type: 'number', label: 'Minutes saved', min: 0 },
  },
  graph: { runs: true, reusable: false },
};
const mate = (id, label, settings = { status: 'active', minutes: 30 }, every = 'week') => ({
  v: 3, type: 'teammate', id, label,
  graph: { nodes: [{ id: 'when', kind: 'trigger', x: 0, y: 0, values: { type: 'schedule', every, at: '02:00' } }], connections: [{ from: 'when', to: START }] },
  settings,
});
/** A shelf over memory: the reader's own kept here, each keep heard, as the keeper's part is. */
const shelfOf = () => {
  let mine = {};
  const ears = new Set();
  return makeShelf({
    presets: () => [], mine: () => mine,
    keep: (next) => { mine = next; for (const ear of ears) ear(); },
    heard: (ear, signal) => { ears.add(ear); signal?.addEventListener('abort', () => ears.delete(ear)); },
  });
};
const settle = () => new Promise((done) => setTimeout(done, 80));
const quiet = () => onReport(() => {});

test('each entity of the type is a row at once; a save on the shelf is a row soon after, taken as one', async () => {
  const off = registerEntityType(TEAMMATE);
  const stop = quiet();
  try {
    const shelf = shelfOf();
    assert.equal(await shelf.save(mate('ana', 'Ana')), true);
    const store = entityStore(shelf, TEAMMATE, { row: (entity, row) => ({ ...row, runs: entity.id.length }) });
    assert.deepEqual((await store.load({})).rows, [{ id: 'ana', label: 'Ana', description: '', tags: [], version: 1, changed: false, status: 'active', every: 'week', minutes: 30, runs: 3 }]);
    assert.equal(store.domains.minutes.label, 'Minutes saved', 'a page over it knows each field\'s words');
    let changes = 0;
    store.addEventListener('change', () => changes++);
    for (const id of ['bo', 'cy', 'di']) await shelf.save(mate(id, id.toUpperCase()));
    await settle();
    assert.deepEqual((await store.load({})).rows.map((r) => r.id), ['ana', 'bo', 'cy', 'di']);
    assert.equal(changes, 1, 'three saves, one reload (TODO 948)');
  } finally {
    stop();
    off();
  }
});

test('a write goes back through the shelf; a field its graph holds, a status or none is never written; no row is inserted', async () => {
  const off = registerEntityType(TEAMMATE);
  const stop = quiet();
  try {
    const shelf = shelfOf();
    await shelf.save(mate('ana', 'Ana'));
    const store = entityStore(shelf, TEAMMATE);
    const row = await store.update('ana', { status: 'paused', label: 'Ana B' });
    assert.equal(row.status, 'paused');
    assert.equal(shelf.get('ana').settings.status, 'paused');
    assert.equal(shelf.get('ana').label, 'Ana B');
    await assert.rejects(store.update('ana', { every: 'day' }), /every is read from its graph, so it is never written/);
    await assert.rejects(store.update('ana', { minutes: -1 }), /at least 0/);
    await assert.rejects(store.update('ana', { colour: 'red' }), /colour is no field a Teammate keeps/);
    await assert.rejects(store.update('nobody', { status: 'active' }), /There is no Teammate "nobody"/);
    await assert.rejects(store.insert({ id: 'new', label: 'New' }), /A Teammate is made in its editor, not as a row/);
    await store.remove('ana');
    assert.equal(shelf.get('ana'), undefined);
    assert.equal((await store.load({})).total, 0);
  } finally {
    stop();
    off();
  }
});

test('a row says its newest published version and whether its draft changed since; neither is written', async () => {
  const off = registerEntityType(TEAMMATE);
  const stop = quiet();
  try {
    const shelf = shelfOf();
    await shelf.save(mate('ana', 'Ana'));
    const store = entityStore(shelf, TEAMMATE);
    const ana = async () => { const { version, changed } = (await store.load({})).rows[0]; return { version, changed }; };
    assert.deepEqual(await ana(), { version: 1, changed: false }, 'a first save publishes version 1');
    assert.deepEqual([store.domains.version, store.domains.changed], [{ label: 'Version', type: 'number' }, { label: 'Draft changed' }]);
    await store.update('ana', { status: 'paused' });
    assert.deepEqual(await ana(), { version: 1, changed: true }, 'a write is the draft\'s');
    assert.equal((await publish(shelf, 'ana')).number, 2);
    await settle();
    assert.deepEqual(await ana(), { version: 2, changed: false });
    await assert.rejects(store.update('ana', { version: 9 }), /version is worked out from its published versions, so it is never written: Publish makes one/);
    await assert.rejects(store.update('ana', { changed: false }), /changed is worked out/);
  } finally {
    stop();
    off();
  }
});

test('a seed that moves is published over the copy: as its next version, or its own versions where they extend the copy\'s', async () => {
  const off = registerEntityType(TEAMMATE);
  const said = [];
  const stop = onReport((r) => said.push(r.message));
  try {
    const shelf = shelfOf();
    let kept;
    const marks = { get: () => kept, set: (next) => { kept = next; } };
    await seedEntities(shelf, [mate('ana', 'Ana'), mate('bo', 'Bo')], marks);
    const v1 = versionsOf(shelf.get('bo'));
    assert.deepEqual(v1.map((v) => v.number), [1]);
    // No versions in the seed: its move is published as the copy's version 2, so its uses take it.
    await seedEntities(shelf, [mate('ana', 'Ana', undefined, 'day'), mate('bo', 'Bo')], marks);
    assert.deepEqual(versionsOf(shelf.get('ana')).map((v) => v.number), [2, 1]);
    assert.equal(versionsOf(shelf.get('ana'))[0].definition.graph.nodes[0].values.every, 'day');
    // Its own versions, extending the copy's: kept as the file says them.
    const v2 = { number: 2, at: '2026-11-13T00:00:00.000Z', hash: 'h2', definition: { label: 'Bo' } };
    await seedEntities(shelf, [mate('ana', 'Ana', undefined, 'day'), { ...mate('bo', 'Bo', undefined, 'day'), versions: [v2, ...v1] }], marks);
    assert.deepEqual(versionsOf(shelf.get('bo')).map((v) => v.hash), ['h2', v1[0].hash]);
    // Versions that drop the copy's: refused in words, and the copy stays.
    const put = await seedEntities(shelf, [mate('ana', 'Ana', undefined, 'day'), { ...mate('bo', 'Bo', undefined, 'month'), versions: [{ ...v2, number: 1 }] }], marks);
    assert.deepEqual(put, []);
    assert.equal(shelf.get('bo').graph.nodes[0].values.every, 'day');
    assert.match(said.join('\n'), /"bo"'s versions must keep the ones it has \(2, 1\)/);
  } finally {
    stop();
    off();
  }
});

test('a type\'s seed entities are the reader\'s own: put once, put again when the seed moves, a reader\'s change left', async () => {
  const off = registerEntityType(TEAMMATE);
  const stop = quiet();
  try {
    const shelf = shelfOf();
    let kept;
    const marks = { get: () => kept, set: (next) => { kept = next; } };
    const seeds = [mate('ana', 'Ana'), mate('bo', 'Bo')];
    assert.deepEqual(await seedEntities(shelf, seeds, marks), ['ana', 'bo']);
    assert.equal(shelf.get('ana').origin, 'mine');
    assert.deepEqual(await seedEntities(shelf, seeds, marks), [], 'the same seed is put once');
    // The reader changes Ana and removes Bo: the same seed leaves both as they are.
    await shelf.save({ ...shelf.get('ana'), origin: undefined, label: 'Ana (mine)' });
    shelf.remove('bo');
    assert.deepEqual(await seedEntities(shelf, seeds, marks), []);
    assert.equal(shelf.get('bo'), undefined, 'a seed the reader removed stays removed');
    // The seed moves: Ana's change is the reader's and stays; Bo comes back as the new seed.
    const moved = [mate('ana', 'Ana', undefined, 'day'), mate('bo', 'Bo', undefined, 'day')];
    assert.deepEqual(await seedEntities(shelf, moved, marks), ['bo']);
    assert.equal(shelf.get('ana').label, 'Ana (mine)');
    assert.equal(shelf.get('bo').graph.nodes[0].values.every, 'day');
  } finally {
    stop();
    off();
  }
});
