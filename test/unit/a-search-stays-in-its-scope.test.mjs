/**
 * A SEARCH STAYS IN ITS SCOPE — Will, TODO 519: the grid's search narrows the
 * grid, never the charts and metrics beside it. A summary is under the View
 * alone, so the rows it is given are not searched — whether the grid's page is
 * a window of the rows or all of them.
 *
 *   node --test test/unit/a-search-stays-in-its-scope.test.mjs
 *
 * TRAP T-only-the-view-trickles-down
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, DataSource, bindSource } from '../../dist/data.js';

const ROWS = [
  { id: 1, plan: 'Pro', name: 'Ada' }, { id: 2, plan: 'Free', name: 'Bo' },
  { id: 3, plan: 'Pro', name: 'Cy' }, { id: 4, plan: 'Team', name: 'Dee' },
];

/** A control the binder fills: it keeps what it was last given. */
const control = () => Object.assign(new EventTarget(), {
  given: null, setAttribute() {}, removeAttribute() {}, hasAttribute: () => false,
  populate(p) { this.given = p; }, drawScope() {},
});
const ids = (payload) => (Array.isArray(payload) ? payload : payload?.rows ?? []).map((r) => r.id).sort();

for (const pageSize of [2, undefined]) {
  test(`a search in the grid's scope narrows the grid, and a summary keeps every row (page size ${pageSize ?? 'none'})`, async () => {
    const source = new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }), ...(pageSize ? { pageSize } : {}) });
    source.declareField('plan', { label: 'Plan' });
    for (const scope of ['view', 'data', 'chart']) source.query.offer(scope, ['plan']);
    const grid = control();
    bindSource(source, grid, { scope: 'data' });
    const chart = control();
    bindSource(source, chart, { scope: 'chart', rows: 'all', readonly: true });
    await source.load();
    assert.deepEqual(ids(chart.given), [1, 2, 3, 4]);

    source.query.setSearch('Ada', 'data');
    await source.load();
    assert.deepEqual(ids(grid.given), [1]);
    assert.deepEqual(ids(chart.given), [1, 2, 3, 4]);
  });
}

test('a search held at the View narrows a summary too', async () => {
  const source = new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }) });
  source.declareField('plan', { label: 'Plan' });
  for (const scope of ['view', 'data', 'chart']) source.query.offer(scope, ['plan']);
  bindSource(source, control(), { scope: 'data' });
  const chart = control();
  bindSource(source, chart, { scope: 'chart', rows: 'all', readonly: true });
  source.query.setSearch('Ada', 'view');
  await source.load();
  assert.deepEqual(ids(chart.given), [1]);
});
