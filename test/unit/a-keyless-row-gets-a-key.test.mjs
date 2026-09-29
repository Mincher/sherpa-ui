/**
 * A KEYLESS ROW GETS A KEY — TODO 103.
 *
 * Will, 2026-09-29: "If we get grid data without keys then the data layer
 * should give it keys … we need to make sure we don't pollute any data we are
 * ever sending out of the data layer." The key lives BESIDE the row.
 *
 *   node --test test/unit/a-keyless-row-gets-a-key.test.mjs
 *
 * TRAP T-a-made-up-key-never-leaves-the-data-layer
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, isMadeUpKey, isStaleKey, rowKey } from '../../dist/data.js';

const KEYLESS = [{ name: 'Ada', team: 'Blue' }, { name: 'Bob', team: 'Red' }];

test('a keyless row goes by one made-up key, the same on every load', async () => {
  const store = new ArrayStore(KEYLESS);
  const first = (await store.load()).rows.map(rowKey);
  const again = (await store.load()).rows.map(rowKey);
  assert.equal(first.length, 2);
  assert.ok(first.every(isMadeUpKey));
  assert.notEqual(first[0], first[1]);
  assert.deepEqual(again, first);
  // A sort hands out other copies, in another order: each keeps its key.
  const sorted = (await store.load({ sort: [{ field: 'name', direction: 'desc' }] })).rows;
  assert.equal(rowKey(sorted[0]), first[1]);
});

test('the key is never ON the row — not a field, not in JSON, not in a copy', async () => {
  const store = new ArrayStore(KEYLESS);
  const [row] = (await store.load()).rows;
  assert.deepEqual(Object.keys(row), ['name', 'team']);
  assert.equal(JSON.stringify(row), '{"name":"Ada","team":"Blue"}');
  assert.deepEqual(structuredClone(row), { name: 'Ada', team: 'Blue' });
  assert.deepEqual({ ...row }, { name: 'Ada', team: 'Blue' });
  // The caller's own objects are never touched either.
  assert.equal(rowKey(KEYLESS[0]), undefined);
});

test('a made-up key finds, updates and removes its row; an insert gets one', async () => {
  const store = new ArrayStore(KEYLESS);
  const key = rowKey((await store.load()).rows[1]);
  assert.equal((await store.byKey(key)).name, 'Bob');
  const updated = await store.update(key, { team: 'Green' });
  assert.deepEqual(updated, { name: 'Bob', team: 'Green' });
  assert.equal(rowKey(updated), key);
  const added = await store.insert({ name: 'Cy', team: 'Blue' });
  assert.ok(isMadeUpKey(rowKey(added)));
  await store.remove(key);
  assert.deepEqual((await store.load()).rows.map((r) => r.name), ['Ada', 'Cy']);
});

test('a row with its own key goes by it; an old made-up key is stale', async () => {
  const store = new ArrayStore([{ id: 7, name: 'Ada' }]);
  assert.equal(rowKey((await store.load()).rows[0]), '7');
  assert.equal(isMadeUpKey('7'), false);
  assert.equal(isStaleKey('sherpa:zzzzzz:1'), true);
  const ours = rowKey((await new ArrayStore(KEYLESS).load()).rows[0]);
  assert.equal(isStaleKey(ours), false);
});
