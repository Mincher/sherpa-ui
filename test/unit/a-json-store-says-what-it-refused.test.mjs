/**
 * A JSON STORE SAYS WHAT IT REFUSED — its inner store has the same schema, so
 * each row is checked once, and a refused row is counted, not lost.
 *
 *   node --test test/unit/a-json-store-says-what-it-refused.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { JsonStore, required, rules } from '../../dist/data.js';

test('a JsonStore counts the rows its schema refused, and scans only the rest', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => [{ id: 1, name: 'Ada' }, { id: 2 }] });
  try {
    const store = new JsonStore({ url: 'https://x.test/rows.json', key: 'id', schema: rules({ name: required() }) });
    const { rows, dropped } = await store.load();
    assert.deepEqual(rows.map((r) => r.id), [1]);
    assert.equal(dropped, 1);
    assert.deepEqual((await store.scan()).map((r) => r.id), [1]);
  } finally {
    globalThis.fetch = realFetch;
  }
});
