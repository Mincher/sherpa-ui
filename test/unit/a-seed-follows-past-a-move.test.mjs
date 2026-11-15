/**
 * A SEED FOLLOWS PAST A MOVE — TODO 1009. A place is no edit (Will, TODO 1001; plan 1001 D1 A), so a reader who only
 * moves a seeded graph's nodes (or opens it, and it unfurls) has not changed it: the seed's next move is still put
 * over the copy, at the copy's places. A seed whose only change is where its nodes sit has not moved. A reader's real
 * change still keeps the seed off.
 *
 *   node --test test/unit/a-seed-follows-past-a-move.test.mjs
 *
 * TRAP T-a-place-is-no-edit
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { makeShelf, onReport, registerEntityType, seedEntities } from '../../dist/data.js';
const { START } = await import('../../dist/core/data/node-start.js');

const TEAMMATE = { v: 1, id: 'teammate', label: 'Teammate', category: 'Teammates', fields: { status: { label: 'Status', values: ['active'] } }, graph: { runs: true, reusable: false } };
/** A seed: its Trigger runs every `every`, at `x`. */
const mate = (every = 'week', x = 0) => ({
  v: 3, type: 'teammate', id: 'ana', label: 'Ana', settings: { status: 'active' },
  graph: { nodes: [{ id: 'when', kind: 'trigger', x, y: 0, values: { type: 'schedule', every, at: '02:00' } }], connections: [{ from: 'when', to: START }] },
});
const shelfOf = () => {
  let mine = {};
  return makeShelf({ presets: () => [], mine: () => mine, keep: (next) => { mine = next; }, heard: () => {} });
};
const seeded = async (run) => {
  const off = registerEntityType(TEAMMATE);
  const stop = onReport(() => {});
  try {
    const shelf = shelfOf();
    let kept;
    await run(shelf, { get: () => kept, set: (next) => { kept = next; } });
  } finally {
    stop();
    off?.();
  }
};
const trigger = (entity) => entity.graph.nodes.find((n) => n.id === 'when');
/** The reader moves the Trigger: a place, saved onto the kept copy, as the canvas saves one (1001b). */
const move = (shelf, x) => shelf.save({ ...shelf.get('ana'), origin: undefined, graph: { ...shelf.get('ana').graph, nodes: shelf.get('ana').graph.nodes.map((n) => ({ ...n, x })) } });

test('a copy the reader only moved takes the seed\'s next move, and keeps where the reader put it', async () => seeded(async (shelf, marks) => {
  assert.deepEqual(await seedEntities(shelf, [mate()], marks), ['ana']);
  await move(shelf, 640);
  assert.deepEqual(await seedEntities(shelf, [mate('day')], marks), ['ana'], 'a move is no change of the reader\'s');
  assert.deepEqual([trigger(shelf.get('ana')).values.every, trigger(shelf.get('ana')).x], ['day', 640]);
}));

test('a seed whose only change is where its nodes sit has not moved: the copy stays as it is', async () => seeded(async (shelf, marks) => {
  await seedEntities(shelf, [mate()], marks);
  await move(shelf, 640);
  assert.deepEqual(await seedEntities(shelf, [mate('week', 300)], marks), []);
  assert.equal(trigger(shelf.get('ana')).x, 640);
}));

test('a reader\'s real change still keeps the seed off', async () => seeded(async (shelf, marks) => {
  await seedEntities(shelf, [mate()], marks);
  await shelf.save({ ...shelf.get('ana'), origin: undefined, label: 'Ana (mine)' });
  assert.deepEqual(await seedEntities(shelf, [mate('day')], marks), []);
  assert.equal(shelf.get('ana').label, 'Ana (mine)');
}));
