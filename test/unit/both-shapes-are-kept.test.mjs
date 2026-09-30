/**
 * BOTH SHAPES ARE KEPT — TODO 132.
 *
 * Will, 2026-09-30: switching a number filter back to Simple "does not retain
 * any original simple values". A reading keeps the shape in force AND the
 * other one, as `kept`, and only the one in force filters.
 *
 *   node --test test/unit/both-shapes-are-kept.test.mjs
 *
 * TRAP T-both-shapes-are-kept
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, DataSource } from '../../dist/data.js';

const rows = [5, 10, 10, 20, 40, 80].map((seats, id) => ({ id, seats }));

async function seats() {
  const source = new DataSource({ store: new ArrayStore(rows) });
  source.declareField('seats', { label: 'Seats', type: 'number' });
  source.hold('data', ['seats']);
  await source.load();
  return source;
}

test('the kept shape is remembered, and filters nothing', async () => {
  const source = await seats();
  // A RANGE in force, with the one value typed before it kept.
  source.write('data', 'seats', { picked: ['20', '100'], range: true, kept: { picked: ['10'], op: 'eq' } });
  await source.load();
  assert.equal(source.total, 3);
  assert.deepEqual(source.reading('data', 'seats').kept, { picked: ['10'], op: 'eq' });

  // The OTHER way round: one value in force, the ends kept.
  source.write('data', 'seats', { picked: ['10'], op: 'eq', range: false, kept: { picked: ['20', '100'] } });
  await source.load();
  assert.equal(source.total, 2);
  assert.deepEqual(source.reading('data', 'seats').kept, { picked: ['20', '100'] });
});

test('a range with nothing moved still holds the value typed before', async () => {
  const source = await seats();
  source.write('data', 'seats', { picked: [], range: true, kept: { picked: ['10'], op: 'eq' } });
  await source.load();
  // No filter — and the reading is NOT dropped as an empty one is.
  assert.equal(source.total, 6);
  assert.deepEqual(source.reading('data', 'seats'), { picked: [], range: true, kept: { picked: ['10'], op: 'eq' } });
});

test('a reading with nothing in force and nothing kept is dropped, as before', async () => {
  const source = await seats();
  source.write('data', 'seats', { picked: [], range: true });
  assert.equal(source.reading('data', 'seats'), undefined);
});
