/**
 * A HELD SET READS THE PAGE'S FIELDS — 345 phase 8. A store's one cache reads
 * every field a page has asked for, and a column it lacks on its own, joined
 * to the rows it holds by key. Not the same rows, and the set is read again.
 * TRAP T-a-held-set-reads-the-pages-fields
 *
 *   node --test test/unit/a-held-set-reads-the-pages-fields.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore } from '../../dist/data.js';
import { cacheOf } from '../../dist/core/data/store-cache.js';
import { HeldSet } from '../../dist/core/data/held-set.js';

const ROWS = [
  { id: 1, name: 'Ada', plan: 'Pro', seats: 5 },
  { id: 2, name: 'Bob', plan: 'Free', seats: 9 },
];

/** An ArrayStore that records what each load asked for. */
function store() {
  const s = new ArrayStore(ROWS.map((r) => ({ ...r })), { key: 'id' });
  const asked = [];
  const load = s.load.bind(s);
  s.load = (o = {}) => { asked.push(o.fields ?? 'all'); return load(o); };
  return { s, asked };
}

test('two column reads join by key', () => {
  const set = new HeldSet([{ id: 2, plan: 'Free' }, { id: 1, plan: 'Pro' }], {}, ['plan']);
  assert.equal(set.covers(['seats']), false);
  assert.equal(set.join([{ id: 1, seats: 5 }, { id: 2, seats: 9 }], ['seats'], 'id'), true);
  assert.deepEqual(set.rows, [{ id: 2, plan: 'Free', seats: 9 }, { id: 1, plan: 'Pro', seats: 5 }]);
  assert.equal(set.covers(['plan', 'seats']), true);
  assert.equal(set.covers(null), false, 'every field is not two');
  // Not the same rows: nothing is taken.
  assert.equal(set.join([{ id: 1, name: 'Ada' }, { id: 3, name: 'Cy' }], ['name'], 'id'), false);
  assert.equal(set.covers(['name']), false);
});

test('a cache reads the fields asked, then a column it lacks, once', async () => {
  const { s, asked } = store();
  const cache = cacheOf(s);
  await cache.hold(100, ['plan']);
  assert.deepEqual(asked, [['plan']]);
  assert.deepEqual(cache.set.rows, [{ id: 1, plan: 'Pro' }, { id: 2, plan: 'Free' }]);
  await cache.hold(100, ['plan', 'seats']);
  assert.deepEqual(asked, [['plan'], ['seats']], 'the missing column alone');
  assert.deepEqual(cache.set.rows[1], { id: 2, plan: 'Free', seats: 9 });
  await cache.hold(100, ['seats']);
  assert.equal(asked.length, 2, 'held: no read');
  // A page that names no fields needs every one: the set is read whole.
  await cache.hold(100, null);
  assert.deepEqual(asked.at(-1), 'all');
  assert.deepEqual(cache.set.rows[0], ROWS[0]);
});

test('a column read that finds other rows reads the set again', async () => {
  const { s, asked } = store();
  const cache = cacheOf(s);
  await cache.hold(100, ['plan']);
  // A row the cache never heard of: written past it.
  s.load = ((load) => (o = {}) => load(o).then((r) => (o.fields?.includes('seats')
    ? { ...r, rows: [...r.rows, { id: 3, seats: 1 }], total: 3 } : r)))(s.load);
  await cache.hold(100, ['plan', 'seats']);
  assert.deepEqual(asked, [['plan'], ['seats'], ['plan', 'seats']]);
});
