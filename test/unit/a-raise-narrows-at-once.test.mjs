/**
 * A RAISE NARROWS AT ONCE — 366 step 7. A hold or a move that changes where an
 * answer lives recompiles there and then: a field raised to the View narrows
 * every component at once, with no bar's report to wake it. And a Query
 * restored before a field's values are known compiles again once they are.
 * TRAP T-up-is-open-down-is-closed
 *
 *   node --test test/unit/a-raise-narrows-at-once.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, DataSource, bindSource, VIEW } from '../../dist/data.js';

const ROWS = [
  { id: 1, plan: 'Pro', seats: 5 }, { id: 2, plan: 'Free', seats: 50 }, { id: 3, plan: 'Pro', seats: 500 },
];
const settle = () => new Promise((r) => setTimeout(r, 30));

test('a field raised to the View narrows a chart over every row at once', async () => {
  const source = new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }) });
  source.declareValues('plan', ['Free', 'Pro']);
  source.query.offer('data', ['plan']);
  const drawn = [];
  const chart = { id: 'chart', populate: (rows) => drawn.push(rows.map((r) => r.id)),
    setAttribute() {}, removeAttribute() {}, addEventListener() {}, removeEventListener() {} };
  const grid = { id: 'grid', populate() {}, setAttribute() {}, removeAttribute() {}, addEventListener() {}, removeEventListener() {} };
  bindSource(source, grid, { scope: 'data' });
  bindSource(source, chart, { readonly: true, rows: 'all' });
  source.query.hold('data', ['plan']);
  source.query.setReading('view', 'plan', { picked: ['Pro'] });
  await source.load();
  await settle();
  // The grid's own answer: the chart over the View sees every row.
  assert.deepEqual(drawn.at(-1), [1, 2, 3]);
  // RAISED: the View holds it now, and narrows the chart too.
  source.query.move('plan', 'data', VIEW);
  await source.load();
  await settle();
  assert.deepEqual(drawn.at(-1), [1, 3]);
});

test('a Query restored before a field\'s values are known compiles again once they are', async () => {
  const source = new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }) });
  await source.query.setQuery({ v: 1, scopes: { view: { holds: ['plan'], readings: { plan: { picked: ['Free', 'Pro'] } } } } });
  // Its values unknown, two picks are a filter.
  assert.deepEqual(source.state.filter, ['plan', 'in', ['Free', 'Pro']]);
  await source.declareFromRows(['plan']);
  // Read from the rows: Free and Pro are EVERY value, so it filters nothing. TRAP T-everything-on-is-no-filter
  assert.equal(source.state.filter, undefined);
});
