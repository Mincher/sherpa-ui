/**
 * A SAVED FILTER IS A QUERY — 366 S3. A saved set is a query definition that
 * LOADS into the field chips (S1, S2). A scope's `presets` are the app's own
 * named conditions again (Will, TODO 493 A), so a stored Query keeps them; any
 * other key a scope does not have is left out, and said ONCE (Will, D4: no shim
 * for old stored data).
 * TRAP T-saved-filters-are-every-scope · TRAP T-a-preset-is-its-own-part
 *
 *   node --test test/unit/a-saved-filter-is-a-query.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, DataSource, onReport } from '../../dist/data.js';

test('a Query keeps its presets; a key a scope does not have goes, reported once', async () => {
  const source = new DataSource({ store: new ArrayStore([{ id: 1, plan: 'Pro' }], { key: 'id' }) });
  const seen = [];
  const undo = onReport((r) => seen.push(r.code));
  try {
    await source.query.setQuery({ v: 1, scopes: { data: { holds: ['plan'], readings: {}, presets: { x: true }, stray: 1 } } });
  } finally {
    undo();
  }
  assert.deepEqual(source.query.applied.scopes.data?.presets, { x: true });
  assert.equal('stray' in (source.query.applied.scopes.data ?? {}), false);
  assert.deepEqual(seen, ['unknown-scope-key']);
});
