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

import { entityStore, makeShelf, onReport, registerEntityType, seedEntities } from '../../dist/data.js';
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
    assert.deepEqual((await store.load({})).rows, [{ id: 'ana', label: 'Ana', description: '', tags: [], status: 'active', every: 'week', minutes: 30, runs: 3 }]);
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
