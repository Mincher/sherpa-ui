/**
 * A GROUP FOLLOWS ITS OWN SORT — TODO 523 (S1). Grouping sorts the group field
 * first; sorted BY that field too, the groups go that way — the rule the grid
 * drew, now the store's, so the rows, `groups()` and the grid agree.
 *
 *   node --test test/unit/a-group-follows-its-own-sort.test.mjs
 *
 * TRAP T-pipeline-order-and-no-grouping
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, DataSource, bindSource } from '../../dist/data.js';

const ROWS = [{ id: 1, p: 'B', n: 2 }, { id: 2, p: 'A', n: 9 }, { id: 3, p: 'C', n: 1 }, { id: 4, p: 'A', n: 3 }];
const store = () => new ArrayStore(ROWS.map((r) => ({ ...r })), { key: 'id' });

test('sorted by the grouped field, the groups go that way', async () => {
  const { rows } = await store().load({ group: 'p', sort: [{ field: 'p', direction: 'desc' }] });
  assert.deepEqual(rows.map((r) => r.p), ['C', 'B', 'A', 'A']);
});

test('sorted by another field, the groups stay A to Z and sort inside', async () => {
  const { rows } = await store().load({ group: 'p', sort: [{ field: 'n', direction: 'desc' }] });
  assert.deepEqual(rows.map((r) => r.id), [2, 4, 1, 3]);
});

test('the source\'s groups follow the same order', async () => {
  const source = new DataSource({ store: store() });
  bindSource(source, Object.assign(new EventTarget(), { setAttribute() {}, removeAttribute() {}, hasAttribute: () => false, populate() {} }), { scope: 'data' });
  source.query.setGroup('p', 'data');
  source.query.setSort('p', 'desc', 'data');
  await source.load();
  assert.deepEqual(source.groups().map((g) => g.key), ['C', 'B', 'A']);
});
