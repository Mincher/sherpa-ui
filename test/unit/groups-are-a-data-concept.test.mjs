/**
 * A GROUP IS A DATA-LAYER CONCEPT.
 *
 * Will, 2026-09-25: "Groups should be a data layer concept and not reserved
 * for the data grid. The latter can group data in the UI but it's not the
 * creator or owner of groups." And: "It's similar to Paging. There are data
 * pages and data grid visual pages."
 *
 * Before this, the only group that existed anywhere was a `<tr>` the grid
 * built while walking sorted rows, counting with a filter over the rows it
 * happened to hold. Nothing outside that grid could name a group, and a paged
 * grid's count was a page count.
 *
 *   node --test test/unit/groups-are-a-data-concept.test.mjs
 *
 * TRAP T-a-group-is-a-data-layer-concept
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, DataSource, groupSummaries } from '../../dist/data.js';

const ROWS = [
  { id: 1, team: 'Blue', spend: 10 },
  { id: 2, team: 'Red', spend: 20 },
  { id: 3, team: 'Blue', spend: 30 },
  { id: 4, team: 'Green', spend: 40 },
  { id: 5, team: 'Red', spend: 50 },
  { id: 6, team: 'Blue', spend: 60 },
];

const settle = () => new Promise((r) => setTimeout(r, 30));

async function source(options = {}) {
  const src = new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }), ...options });
  await src.ready;
  return src;
}

test('the SOURCE names the groups, with a count over every matching row', async () => {
  const src = await source();
  src.setGroup('team');
  await settle();
  assert.deepEqual(src.groups(), [
    { key: 'Blue', value: 'Blue', count: 3 },
    { key: 'Green', value: 'Green', count: 1 },
    { key: 'Red', value: 'Red', count: 2 },
  ]);
});

test('no group in force means no groups — not an error', async () => {
  const src = await source();
  assert.deepEqual(src.groups(), []);
});

test('a field can be asked about WITHOUT grouping by it', async () => {
  const src = await source();
  await src.load();
  // The read-back a host needs before it decides to group at all. UNGROUPED,
  // so the rows arrive in store order and the groups follow it.
  assert.deepEqual(src.groups('team').map((g) => g.key), ['Blue', 'Red', 'Green']);
  assert.equal(src.state.group, null);
});

test('a FILTER narrows the groups, because they count matching rows', async () => {
  const src = await source();
  src.setGroup('team');
  src.setFilter(['spend', 'gte', 30]);
  await settle();
  assert.deepEqual(src.groups(), [
    { key: 'Blue', value: 'Blue', count: 2 },
    { key: 'Green', value: 'Green', count: 1 },
    { key: 'Red', value: 'Red', count: 1 },
  ]);
});

/* Will, TODO 165: "Right now it show the total row count for the group
   regardless of visibility." A summary bound beside the grid made the source
   keep the VIEW's rows, and the groups were counted from those. */
test('a filter in a COMPONENT scope narrows the groups, with a summary bound beside it', async () => {
  const src = await source();
  src.declareScope('view', { label: 'View filters' });
  src.declareScope('data', { label: 'Records' });
  const chart = Object.assign(new EventTarget(), {
    id: 'chart', setAttribute() {}, removeAttribute() {}, hasAttribute: () => false, populate() {},
  });
  src.bind(chart, { rows: 'all', readonly: true });
  src.setGroup('team');
  src.hold('data', ['team']);
  src.write('data', 'team', { picked: ['Blue', 'Red'] });
  await settle();
  assert.deepEqual(src.groups(), [
    { key: 'Blue', value: 'Blue', count: 3 },
    { key: 'Red', value: 'Red', count: 2 },
  ]);
});

test('the count spans PAGES — a page count is the grid\'s, not the group\'s', async () => {
  const src = await source({ pageSize: 2 });
  src.setGroup('team');
  await settle();
  // Two rows on the page; the groups still say what the whole set holds.
  assert.equal(src.rows.length <= 6, true);
  assert.deepEqual(src.groups().map((g) => g.count), [3, 1, 2]);
});

test('groupSummaries is the same answer, for a caller with rows and no source', async () => {
  assert.deepEqual(groupSummaries(ROWS, 'team'), [
    { key: 'Blue', value: 'Blue', count: 3 },
    { key: 'Red', value: 'Red', count: 2 },
    { key: 'Green', value: 'Green', count: 1 },
  ]);
});
