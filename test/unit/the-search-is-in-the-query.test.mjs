/**
 * THE SEARCH IS IN THE QUERY — 366 step 9. A search is a scope's, in the
 * Query, beside the arrangement: saved, restored and shared with it.
 * TRAP T-group-and-sort-are-component-scope
 *
 *   node --test test/unit/the-search-is-in-the-query.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, DataSource } from '../../dist/data.js';

const ROWS = [{ id: 1, name: 'Ada' }, { id: 2, name: 'Bo' }, { id: 3, name: 'Adam' }];
const make = () => new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }) });

test('setSearch lands in the Query, beside the sort', () => {
  const source = make();
  source.setSort('name', 'asc', 'data');
  source.setSearch('ad');
  assert.equal(source.query.applied.scopes.data.search, 'ad');
  assert.equal(source.state.search, 'ad');
});

test('a restored Query\'s search loads the searched rows', async () => {
  const source = make();
  await source.setQuery({ v: 1, scopes: { data: { holds: [], readings: {}, search: 'ad' } } });
  await source.load();
  assert.equal(source.state.search, 'ad');
  assert.deepEqual(source.rows.map((r) => r.id), [1, 3]);
});

test('a View that names no search keeps it; one that names it sets it', async () => {
  const source = make();
  source.setSearch('ad');
  await source.setQuery({ v: 1, scopes: { view: { holds: [] } } }, { holds: 'keep' });
  assert.equal(source.state.search, 'ad');
  await source.setQuery({ v: 1, scopes: { view: { search: '' } } }, { holds: 'keep' });
  assert.equal(source.state.search, '');
});
