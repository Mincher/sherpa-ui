/**
 * A SUSPENDED SORT HAS ONE OWNER.
 *
 * `sort` is the QUERY — empty while suspended, because the store must not order
 * anything. `sortSuspended` is the UI half: the column a control still shows,
 * so one more click resumes it without a trip to a menu.
 *
 * Both live on the SOURCE, because the source owns every bound element's
 * `data-*` — a component that kept its suspended column in `data-sort-field`
 * had it wiped by the very next push.
 * TRAP T-a-suspended-sort-is-one-owners-job.
 *
 *   node --test test/unit/suspended-sort.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

const core = new URL('../../dist/core/', import.meta.url);
const { ArrayStore } = await import(new URL('stores.js', core));
const { DataSource } = await import(new URL('data-source.js', core));

const rows = [{ id: 1, n: 'c' }, { id: 2, n: 'a' }, { id: 3, n: 'b' }];
const make = () => new DataSource({ store: new ArrayStore(rows), autoLoad: false });

const settle = () => new Promise((r) => setTimeout(r, 10));

test('setSort(null) SUSPENDS: the query loses its sort, the column survives', async () => {
  const s = make();
  s.setSort('n', 'desc');
  await settle();
  assert.deepEqual(s.state.sort, [{ field: 'n', direction: 'desc' }]);
  assert.equal(s.state.sortSuspended, undefined, 'nothing remembered while live');

  s.setSort(null);
  await settle();
  assert.deepEqual(s.state.sort, [], 'the QUERY has no sort — the store orders nothing');
  assert.deepEqual(s.state.sortSuspended, { field: 'n', direction: 'desc' },
    'and the column is remembered, so a control can still show it');
  assert.deepEqual(s.rows.map((r) => r.n), ['c', 'a', 'b'], 'store order, unsorted');
});

test('a SECOND suspend does not overwrite the memory with nothing', async () => {
  const s = make();
  s.setSort('n', 'asc');
  await settle();
  s.setSort(null);
  await settle();
  s.setSort(null);
  await settle();
  assert.deepEqual(s.state.sortSuspended, { field: 'n', direction: 'asc' },
    'the remembered column survives a repeated suspend');
});

test('resumeSort brings it back, and is a no-op with nothing to resume', async () => {
  const s = make();
  // Nothing to resume yet — a caller may offer it without checking first.
  s.resumeSort();
  await settle();
  assert.deepEqual(s.state.sort, []);

  s.setSort('n', 'desc');
  await settle();
  s.setSort(null);
  await settle();
  s.resumeSort();
  await settle();
  assert.deepEqual(s.state.sort, [{ field: 'n', direction: 'desc' }],
    'resumed in the direction it was left in');
  assert.equal(s.state.sortSuspended, undefined, 'and the memory is spent');
  assert.deepEqual(s.rows.map((r) => r.n), ['c', 'b', 'a']);
});

test('clearSort FORGETS — the gesture that is not a suspend', async () => {
  const s = make();
  s.setSort('n', 'asc');
  await settle();
  s.clearSort();
  await settle();
  assert.deepEqual(s.state.sort, []);
  assert.equal(s.state.sortSuspended, undefined,
    'nothing is remembered, so there is nothing to resume');
});

test('a new sort replaces a suspended one rather than shadowing it', async () => {
  const s = make();
  s.setSort('n', 'desc');
  await settle();
  s.setSort(null);
  await settle();
  s.setSort('id', 'asc');
  await settle();
  assert.deepEqual(s.state.sort, [{ field: 'id', direction: 'asc' }]);
  assert.equal(s.state.sortSuspended, undefined,
    'the old memory is dropped — resuming would otherwise jump to a column ' +
      'the reader had moved on from');
});

test('setState carries the memory, so a saved view restores mid-suspend', async () => {
  const s = make();
  s.setState({ sort: [], sortSuspended: { field: 'n', direction: 'desc' } });
  await settle();
  assert.deepEqual(s.state.sortSuspended, { field: 'n', direction: 'desc' });
  s.resumeSort();
  await settle();
  assert.deepEqual(s.rows.map((r) => r.n), ['c', 'b', 'a']);

  // And an explicit undefined CLEARS it.
  s.setSort(null);
  await settle();
  s.setState({ sortSuspended: undefined });
  await settle();
  assert.equal(s.state.sortSuspended, undefined);
});
