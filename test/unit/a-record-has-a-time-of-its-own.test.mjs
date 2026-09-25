/**
 * EVERY RECORD SAYS WHEN IT IS FROM, the way it says who it is.
 *
 * Will, 2026-09-25: the view's "Created date" chip "should just be a generic
 * Date filter to filter all view data by a specific date or date range. This
 * means that every data record needs a generic timestamp."
 *
 * The chip used to work only because one dataset had a column called
 * `created`. These tests point the SAME filter at a dataset that calls its
 * time something else, and at one with no time at all.
 *
 *   node --test test/unit/a-record-has-a-time-of-its-own.test.mjs
 *
 * TRAP T-a-record-has-a-time-of-its-own
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, DataSource } from '../../dist/data.js';

const settle = () => new Promise((r) => setTimeout(r, 30));

const ORDERS = [
  { id: 1, placedOn: '2026-01-05' },
  { id: 2, placedOn: '2026-03-05' },
  { id: 3, placedOn: '2026-06-05' },
];

test('a store names its TIME beside its key', () => {
  const store = new ArrayStore(ORDERS, { key: 'id', time: 'placedOn' });
  assert.equal(store.key, 'id');
  assert.equal(store.time, 'placedOn');
});

test('NO DEFAULT — a store with no time has none, rather than a guess', () => {
  const store = new ArrayStore(ORDERS, { key: 'id' });
  // Not 'created'. A guess would be a Date filter over a column that is not there.
  assert.equal(store.time, undefined);
});

test('the source declares the time a DATE, so nothing downstream has to', async () => {
  const src = new DataSource({ store: new ArrayStore(ORDERS, { key: 'id', time: 'placedOn' }) });
  await src.ready;
  assert.equal(src.timeField, 'placedOn');
  assert.equal(src.fieldFacts('placedOn').type, 'date');
});

test('a Date filter over timeField works on a dataset that never says `created`', async () => {
  const src = new DataSource({ store: new ArrayStore(ORDERS, { key: 'id', time: 'placedOn' }) });
  await src.ready;
  // Two picks on a DATE are a range — the field type decides the clause.
  src.select(src.timeField, ['2026-02-01', '2026-04-01']);
  await settle();
  assert.deepEqual(src.rows.map((r) => r.id), [2]);
});

test('debugState says which field a Date filter narrows — or null', async () => {
  const timed = new DataSource({ store: new ArrayStore(ORDERS, { key: 'id', time: 'placedOn' }) });
  const untimed = new DataSource({ store: new ArrayStore(ORDERS, { key: 'id' }) });
  await Promise.all([timed.ready, untimed.ready]);
  assert.equal(timed.debugState().time, 'placedOn');
  // `null`, not missing: it EXPLAINS a Date filter that narrows nothing.
  assert.equal(untimed.debugState().time, null);
});
