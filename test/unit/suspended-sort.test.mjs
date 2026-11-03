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

const core = new URL('../../dist/core/data/', import.meta.url);
const { ArrayStore } = await import(new URL('stores.js', core));
const { DataSource } = await import(new URL('data-source.js', core));

const rows = [{ id: 1, n: 'c' }, { id: 2, n: 'a' }, { id: 3, n: 'b' }];
const make = () => new DataSource({ store: new ArrayStore(rows), autoLoad: false });

const settle = () => new Promise((r) => setTimeout(r, 10));

test('setSort(null) SUSPENDS: the query loses its sort, the column survives', async () => {
  const s = make();
  s.query.ask({ sort: 'n', direction: 'desc' });
  await settle();
  assert.deepEqual(s.state.sort, [{ field: 'n', direction: 'desc' }]);
  assert.equal(s.state.sortSuspended, undefined, 'nothing remembered while live');

  s.query.ask({ sort: null });
  await settle();
  assert.deepEqual(s.state.sort, [], 'the QUERY has no sort — the store orders nothing');
  assert.deepEqual(s.state.sortSuspended, { field: 'n', direction: 'desc' },
    'and the column is remembered, so a control can still show it');
  assert.deepEqual(s.rows.map((r) => r.n), ['c', 'a', 'b'], 'store order, unsorted');
});

test('a SECOND suspend does not overwrite the memory with nothing', async () => {
  const s = make();
  s.query.ask({ sort: 'n', direction: 'asc' });
  await settle();
  s.query.ask({ sort: null });
  await settle();
  s.query.ask({ sort: null });
  await settle();
  assert.deepEqual(s.state.sortSuspended, { field: 'n', direction: 'asc' },
    'the remembered column survives a repeated suspend');
});

/** Resume: a sort asked again by the column it keeps, in its direction. */
const resume = (s, scope) => {
  const { field, direction } = s.state.sortSuspended;
  s.query.ask({ ...(scope ? { scope } : {}), sort: field, direction });
};

test('a sort asked again by the column it keeps comes back, and the memory is spent', async () => {
  const s = make();
  s.query.ask({ sort: 'n', direction: 'desc' });
  await settle();
  s.query.ask({ sort: null });
  await settle();
  resume(s);
  await settle();
  assert.deepEqual(s.state.sort, [{ field: 'n', direction: 'desc' }],
    'resumed in the direction it was left in');
  assert.equal(s.state.sortSuspended, undefined, 'and the memory is spent');
  assert.deepEqual(s.rows.map((r) => r.n), ['c', 'b', 'a']);
});

test('clearSort FORGETS — the gesture that is not a suspend', async () => {
  const s = make();
  s.query.ask({ sort: 'n', direction: 'asc' });
  await settle();
  s.query.ask({ sort: null, clear: true });
  await settle();
  assert.deepEqual(s.state.sort, []);
  assert.equal(s.state.sortSuspended, undefined,
    'nothing is remembered, so there is nothing to resume');
});

test('a new sort replaces a suspended one rather than shadowing it', async () => {
  const s = make();
  s.query.ask({ sort: 'n', direction: 'desc' });
  await settle();
  s.query.ask({ sort: null });
  await settle();
  s.query.ask({ sort: 'id', direction: 'asc' });
  await settle();
  assert.deepEqual(s.state.sort, [{ field: 'id', direction: 'asc' }]);
  assert.equal(s.state.sortSuspended, undefined,
    'the old memory is dropped — resuming would otherwise jump to a column ' +
      'the reader had moved on from');
});

test('the Query carries the memory, so a saved view restores mid-suspend', async () => {
  const s = make();
  await s.query.setQuery({ v: 1, scopes: { view: { sort: [], sortSuspended: { field: 'n', direction: 'desc' } } } });
  await settle();
  assert.deepEqual(s.state.sortSuspended, { field: 'n', direction: 'desc' });
  resume(s);
  await settle();
  assert.deepEqual(s.rows.map((r) => r.n), ['c', 'b', 'a']);

  // And a Query that names none CLEARS it.
  s.query.ask({ sort: null });
  await settle();
  await s.query.setQuery({ v: 1, scopes: { view: { sort: [] } } });
  await settle();
  assert.equal(s.state.sortSuspended, undefined);
});
