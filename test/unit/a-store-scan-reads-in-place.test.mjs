/**
 * `scan()` — every row a store's schema accepts, read IN PLACE: no row copied,
 * for a reader that only reads (the walk, TODOs 347–349). A remote store has
 * none: it is held, or asked. TRAP T-one-walk-counts-and-limits-in-order
 *
 *   node --test test/unit/a-store-scan-reads-in-place.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, EventStore, spoofRemote } from '../../dist/data.js';
import { HeldSet } from '../../dist/core/data/held-set.js';

const ROWS = [{ id: 1, name: 'a' }, { id: 2, name: 'b' }, { id: 3, name: '' }];
/** A schema that refuses a row with no name. */
const NAMED = {
  '~standard': {
    version: 1, vendor: 'test',
    validate: (row) => (row?.name ? { value: row } : { issues: [{ message: 'name is required', path: ['name'] }] }),
  },
};
const plain = (rows) => rows.map((r) => ({ ...r }));

test('an ArrayStore scans what load() gives, the refused rows left out — the same row objects each time', async () => {
  const store = new ArrayStore(ROWS, { key: 'id', schema: NAMED });
  const scanned = await store.scan();
  assert.deepEqual(plain(scanned), plain((await store.load({})).rows));
  assert.deepEqual(scanned.map((r) => r.id), [1, 2]);
  // In place: a second scan hands the same rows; a load hands copies.
  assert.equal((await store.scan())[0], scanned[0]);
  assert.notEqual((await store.load({})).rows[0], scanned[0]);
});

test('a held set scans its own rows, in place', async () => {
  const rows = plain(ROWS);
  const held = new HeldSet(rows);
  const scanned = await held.scan();
  assert.equal(scanned[1], held.rows[1]);
  assert.equal(scanned.length, 3);
});

test('a live store scans its inner rows', async () => {
  const store = new EventStore({ url: 'http://localhost/none', key: 'id', rows: plain(ROWS) });
  const scanned = await store.scan();
  assert.deepEqual(scanned.map((r) => r.id), [1, 2, 3]);
  assert.equal((await store.scan())[0], scanned[0]);
});

test('a remote store has no scan: it is held, or asked', () => {
  assert.equal(spoofRemote(new ArrayStore(plain(ROWS), { key: 'id' }), { delay: 0 }).scan, undefined);
});
