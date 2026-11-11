/**
 * A MOVE RELOADS THE CHARTS — Will, TODO 912: Status moved from the Records
 * grid to the View did not narrow the charts beside it, though the Query said
 * it should. The View waits for Apply there, and a move keeps the grid's filter
 * the same, so the source took it for a draft edit and loaded nothing. A chart
 * reads the View's filter: that moved, so it loads.
 *
 *   node --test test/unit/a-move-reloads-the-charts.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, DataSource, bindSource } from '../../dist/data.js';

const ROWS = [
  { id: 1, status: 'active', region: 'EU' }, { id: 2, status: 'trial', region: 'EU' },
  { id: 3, status: 'active', region: 'US' }, { id: 4, status: 'churned', region: 'US' },
];

/** Long enough for a load the change would start. */
const tick = () => new Promise((r) => setTimeout(r, 20));

async function open() {
  const source = new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }), pageSize: 100 });
  source.declareValues('status', ['active', 'trial', 'churned']);
  source.declareValues('region', ['EU', 'US']);
  source.query.declareScope('view', { label: 'View' });
  source.query.declareScope('data', { label: 'Records' });
  source.query.offer('data', ['status', 'region']);
  source.query.ask({ scope: 'view', hold: ['region'] });
  source.query.ask({ scope: 'data', hold: ['status'] });
  // As Records: the View waits for Apply.
  source.query.wait('view');
  const seen = new Map();
  const stub = (name, more = {}) => Object.assign(new EventTarget(), {
    id: name, setAttribute() {}, removeAttribute() {}, hasAttribute: () => false,
    populate: (rows) => seen.set(name, rows.map((r) => r.id)), ...more,
  });
  const bar = stub('qft', { drawScope() {}, drawReading() {} });
  bindSource(source, stub('grid'), { scope: 'data' });
  bindSource(source, stub('chart'), { rows: 'all', readonly: true });
  bindSource(source, bar, { steerOnly: true, scope: 'data' });
  await source.load();
  const move = (scope, from) => bar.dispatchEvent(new CustomEvent('filter-add', { detail: { scope, ids: ['status'], from } }));
  return { source, seen, move };
}

test('moved up to a waiting View, a grid filter narrows the chart; moved back down, it lets it go', async () => {
  const { source, seen, move } = await open();
  source.query.ask({ scope: 'data', field: 'status', reading: { picked: ['active'] } });
  await tick();
  assert.deepEqual(seen.get('grid'), [1, 3]);
  assert.deepEqual(seen.get('chart'), [1, 2, 3, 4], 'the grid\'s own filter is not the chart\'s');

  move('view', 'data');
  await tick();
  assert.deepEqual(source.query.applied.scopes.view?.readings.status?.picked, ['active']);
  assert.deepEqual(seen.get('chart'), [1, 3], 'the View holds it now: the chart narrows');
  assert.deepEqual(seen.get('grid'), [1, 3]);

  move('data', 'view');
  await tick();
  assert.equal(source.query.scope('view').includes('status'), false);
  assert.deepEqual(seen.get('chart'), [1, 2, 3, 4], 'back in the grid: the chart is free of it');
  assert.deepEqual(seen.get('grid'), [1, 3]);
});

test('a View pick that waits for Apply still loads nothing', async () => {
  const { source, seen } = await open();
  source.query.ask({ scope: 'view', field: 'region', reading: { picked: ['EU'] } });
  await tick();
  assert.equal(source.query.pending('region'), true);
  assert.deepEqual(seen.get('chart'), [1, 2, 3, 4]);
  source.query.ask({ scope: 'view', commit: true });
  await tick();
  assert.deepEqual(seen.get('chart'), [1, 2]);
});
