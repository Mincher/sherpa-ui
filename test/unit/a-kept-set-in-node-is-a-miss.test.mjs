/**
 * keepCache() in Node, or anywhere with no IndexedDB: nothing is kept, it says
 * so once, and the store works as before. TRAP T-a-kept-set-is-checked-each-session
 *
 *   node --test test/unit/a-kept-set-in-node-is-a-miss.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, DataSource, clearKept, keepCache, onReport, spoofRemote } from '../../dist/data.js';

test('no IndexedDB: a miss, said once, and the page answers as before', async () => {
  const codes = [];
  const undo = onReport((r) => codes.push(r.code));
  const store = spoofRemote(new ArrayStore([{ id: 1 }, { id: 2 }], { key: 'id' }), { delay: 0 });
  await keepCache(store, { name: 'node' }).ready;
  await keepCache(store, { name: 'node-again' }).ready;
  const source = new DataSource({ store });
  await source.load();
  await clearKept();
  undo();
  assert.equal(source.total, 2);
  assert.deepEqual(codes, ['cache-keep-unavailable']);
});

test('a store that is never held keeps nothing, and says why', async () => {
  const codes = [];
  const undo = onReport((r) => codes.push(r.code));
  await keepCache(new ArrayStore([{ id: 1 }], { key: 'id' }), { name: 'local' }).ready;
  undo();
  assert.deepEqual(codes, ['cache-keep-never-held']);
});
