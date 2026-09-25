/**
 * A TRANSFORM NEVER TOUCHES THE RAW DATA.
 *
 * Will's rule, 2026-09-25: "Transformed data and data properties, for grouping,
 * filtering, and sorting, shouldn't affect the raw data. Only data write or
 * saving type events should update the data."
 *
 * So a view is a NEW array of the SAME row objects, and only create/update/
 * remove may change what the store holds. The cheap mistakes this catches are
 * an in-place `.sort()` and a group key written onto a row.
 *
 *   node --test test/unit/raw-data-is-untouched.test.mjs
 *
 * TRAP T-one-query-builder-in-the-data-layer
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ArrayStore, DataSource,
  applyOptions, sortRows, filterRows, searchRows, groupRows,
} from '../../dist/data.js';

const RAW = () => [
  { id: 3, owner: 'Ravi', seats: 50, team: 'red' },
  { id: 1, owner: 'Dana', seats: 500, team: 'blue' },
  { id: 2, owner: 'Pia', seats: 5, team: 'red' },
];

const settle = () => new Promise((r) => setTimeout(r, 30));
/** Order AND content, so a re-order is as loud as an edit. */
const snap = (rows) => JSON.stringify(rows);

/* ── The pure functions ─────────────────────────────────────────────── */

test('every transform returns a NEW array and leaves the old one alone', () => {
  const rows = RAW();
  const before = snap(rows);

  const sorted = sortRows(rows, [{ field: 'seats', direction: 'desc' }]);
  const filtered = filterRows(rows, ['team', 'eq', 'red']);
  const found = searchRows(rows, 'dana');
  const grouped = groupRows(rows, 'team');
  const paged = applyOptions(rows, {
    search: 'a', filter: ['seats', 'gte', 5],
    sort: [{ field: 'owner', direction: 'asc' }], group: 'team', skip: 0, take: 2,
  });

  // The raw array is untouched — order included. An in-place sort fails here.
  assert.equal(snap(rows), before);
  // And each answer is its own array, not the same one handed back.
  for (const out of [sorted, filtered, found, paged.rows]) assert.notEqual(out, rows);
  assert.equal(grouped.length, 2);
});

test('a view holds the SAME row objects — no copy, and no added properties', () => {
  const rows = RAW();
  const sorted = sortRows(rows, [{ field: 'seats', direction: 'asc' }]);

  // Identity, not equality: a copy would double the memory and drift.
  assert.equal(sorted[0], rows[2]);
  // Grouping is the one most likely to stamp a key onto the row.
  groupRows(rows, 'team');
  assert.deepEqual(Object.keys(rows[0]), ['id', 'owner', 'seats', 'team']);
});

/* ── Through the source ─────────────────────────────────────────────── */

test('sorting, grouping, filtering and paging change no stored row', async () => {
  const rows = RAW();
  const src = new DataSource({ store: new ArrayStore(rows, { key: 'id' }) });
  await src.ready;
  src.declareValues('team', ['red', 'blue']);
  const before = snap(rows);

  src.setSort('seats', 'desc');
  src.setGroup('team');
  src.select('team', ['red']);
  src.setSearch('a');
  src.setPageSize(1);
  src.setPage(1);
  await settle();

  // The view moved...
  assert.ok(src.rows.length <= 2);
  // ...and the array the store was handed did not.
  assert.equal(snap(rows), before);
});

test('a WRITE is the one thing that does change it', async () => {
  const rows = RAW();
  const store = new ArrayStore(rows, { key: 'id' });
  const src = new DataSource({ store });
  await src.ready;
  src.setSort('seats', 'desc');
  await settle();

  await store.update(1, { owner: 'Dana M' });
  await src.load({ force: true });
  await settle();

  // Saving edits the data. Viewing never does — that is the whole rule.
  const dana = src.rows.find((r) => r.id === 1);
  assert.equal(dana.owner, 'Dana M');
});
