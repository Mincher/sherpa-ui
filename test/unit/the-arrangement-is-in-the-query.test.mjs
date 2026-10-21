/**
 * THE ARRANGEMENT IS IN THE QUERY — 366 step 8. Sort, group and a suspended
 * sort are a scope's, in the Query, beside its filters: saved, restored and
 * shared with them. ONE scope arranges at a time. A View that names no
 * arrangement keeps the one on screen; one that names it sets it.
 * TRAP T-group-and-sort-are-component-scope
 *
 *   node --test test/unit/the-arrangement-is-in-the-query.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, DataSource } from '../../dist/data.js';

const ROWS = [{ id: 1, name: 'b', plan: 'Pro' }, { id: 2, name: 'a', plan: 'Free' }, { id: 3, name: 'c', plan: 'Pro' }];
const make = () => new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }) });
const scopes = (s) => s.query.applied.scopes;

test('setSort lands in the scope it names, in the Query', () => {
  const source = make();
  source.query.setSort('name', 'desc', 'data');
  assert.deepEqual(scopes(source).data.sort, [{ field: 'name', direction: 'desc' }]);
  assert.deepEqual(source.state.sort, [{ field: 'name', direction: 'desc' }]);
});

test('a filter edit after a sort, in a scope that holds nothing, keeps the sort', async () => {
  const source = make();
  source.query.setSort('name', 'asc', 'data');
  source.query.select('plan', ['Pro']);
  await source.load();
  assert.deepEqual(scopes(source).data.sort, [{ field: 'name', direction: 'asc' }]);
  assert.deepEqual(source.rows.map((r) => r.id), [1, 3]);
});

test('one scope arranges: grouping in another takes the arrangement there', () => {
  const source = make();
  source.query.setSort('name', 'asc', 'data');
  source.query.setGroup('plan', 'other');
  assert.equal(scopes(source).data?.sort, undefined);
  assert.equal(scopes(source).other.group, 'plan');
});

test('a suspended sort is in the Query, and comes back', () => {
  const source = make();
  source.query.setSort('name', 'desc', 'data');
  source.query.setSort(null);
  assert.deepEqual(scopes(source).data.sortSuspended, { field: 'name', direction: 'desc' });
  assert.deepEqual(scopes(source).data.sort, []);
  source.query.resumeSort();
  assert.deepEqual(scopes(source).data.sort, [{ field: 'name', direction: 'desc' }]);
  assert.equal(scopes(source).data.sortSuspended, undefined);
});

test('a View that names no arrangement keeps it; one that names it sets it', async () => {
  const source = make();
  source.query.setSort('name', 'asc', 'data');
  await source.query.setQuery({ v: 1, scopes: { view: { holds: ['plan'] } } }, { holds: 'keep' });
  assert.deepEqual(source.state.sort, [{ field: 'name', direction: 'asc' }]);
  await source.query.setQuery({ v: 1, scopes: { data: { sort: [], group: null } } }, { holds: 'keep' });
  assert.deepEqual(source.state.sort, []);
});
