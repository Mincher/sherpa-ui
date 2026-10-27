/**
 * A SAVED FILTER IS A QUERY — 366 S3. A saved set is a query definition that
 * LOADS into the field chips (S1, S2). A preset's conditions are in its fields'
 * answers now (Will, TODO 510 A), so a stored `presets` is a key a scope does not
 * have: left out, and said ONCE, as any other (Will, D4: no shim for old data).
 * TRAP T-saved-filters-are-every-scope · TRAP T-a-preset-is-its-own-part
 *
 *   node --test test/unit/a-saved-filter-is-a-query.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, DataSource, onReport } from '../../dist/data.js';

test('a key a scope does not have — an old `presets` too — goes, reported once', async () => {
  const source = new DataSource({ store: new ArrayStore([{ id: 1, plan: 'Pro' }], { key: 'id' }) });
  const seen = [];
  const undo = onReport((r) => seen.push(r.code));
  try {
    await source.query.setQuery({ v: 1, scopes: { data: { holds: ['plan'], readings: {}, presets: { x: true }, stray: 1 } } });
  } finally {
    undo();
  }
  assert.equal('presets' in (source.query.applied.scopes.data ?? {}), false);
  assert.equal('stray' in (source.query.applied.scopes.data ?? {}), false);
  assert.deepEqual(seen, ['unknown-scope-key']);
});
