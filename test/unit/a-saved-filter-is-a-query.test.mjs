/**
 * A SAVED FILTER IS A QUERY — 366 S3. The Query names no saved filter: a set
 * is a query definition that LOADS into the field chips (S1, S2). A stored
 * Query, View or set that still names `presets` keeps nothing of it, and says
 * so ONCE (Will, D4: no shim for old stored data).
 * TRAP T-saved-filters-are-every-scope
 *
 *   node --test test/unit/a-saved-filter-is-a-query.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, DataSource, onReport } from '../../dist/data.js';

test('a Query that names presets keeps no presets key, and reports it once', async () => {
  const source = new DataSource({ store: new ArrayStore([{ id: 1, plan: 'Pro' }], { key: 'id' }) });
  const seen = [];
  const undo = onReport((r) => seen.push(r.code));
  try {
    await source.query.setQuery({ v: 1, scopes: { data: { holds: ['plan'], readings: {}, presets: { x: true } } } });
  } finally {
    undo();
  }
  assert.equal('presets' in (source.query.applied.scopes.data ?? {}), false);
  assert.deepEqual(seen, ['unknown-scope-key']);
});
