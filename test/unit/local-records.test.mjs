/**
 * LOCAL RECORDS SEED THEMSELVES: IndexedDB where the browser has it, memory
 * where not, seeded once per seed version. Node has no IndexedDB, so this is
 * the fallback; Sherpa Demos' reforged-records-persist.spec.ts drives the real one.
 * TODO 191 · TRAP T-local-records-seed-themselves
 *
 *   node --test test/unit/local-records.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ArrayStore, IdbStore, localRecords } from '../../dist/data.js';

test('with no IndexedDB, a seeded store is memory, holding its seed, and ready at once', async () => {
  assert.equal(IdbStore.available, false);
  const seed = [{ email: 'a@x.io', name: 'A' }, { email: 'b@x.io', name: 'B' }];
  const { store, ready } = localRecords({ name: 'people', key: 'email', seed, seedVersion: 3 });
  await ready;
  assert.ok(store instanceof ArrayStore);
  assert.equal(await store.totalCount(), 2);
  // Its own copy: a write to the store leaves the seed alone.
  await store.insert({ email: 'c@x.io', name: 'C' });
  assert.equal(seed.length, 2);
});
