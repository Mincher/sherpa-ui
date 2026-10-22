/**
 * A WAITING SCOPE HOLDS ITS PICKS — TODO 406. `query.wait('view')` makes the
 * View wait for Apply over a LOCAL store: a pick lands in the draft, the rows
 * stay, and `commit()` sends it. A scope that does not wait applies at once,
 * and Discard puts one field's last applied answer back.
 * TRAP T-apply-and-discard-wait-for-a-change
 *
 *   node --test test/unit/a-waiting-scope-holds-its-picks.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, DataSource } from '../../dist/data.js';

const ROWS = [
  { id: 1, region: 'EU', plan: 'Pro' },
  { id: 2, region: 'US', plan: 'Free' },
  { id: 3, region: 'EU', plan: 'Free' },
];

/** Long enough for a load the pick would start. */
const tick = () => new Promise((r) => setTimeout(r, 20));

async function open() {
  const source = new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }) });
  source.query.hold('view', ['region']);
  source.query.hold('data', ['plan']);
  source.query.wait('view');
  await source.load();
  return source;
}

test('a View pick waits for Apply; a data pick applies at once', async () => {
  const source = await open();
  assert.equal(source.query.waiting('view'), true);
  assert.equal(source.query.waiting('data'), false);

  source.query.setReading('view', 'region', { picked: ['EU'] });
  await tick();
  assert.equal(source.query.pending('region'), true, 'the View pick is pending');
  assert.equal(source.query.dirty('view'), true);
  assert.equal(source.total, 3, 'and the rows did not move');

  source.query.setReading('data', 'plan', { picked: ['Free'] });
  await tick();
  assert.equal(source.query.pending('plan'), false, 'a data pick is never pending');
  assert.deepEqual(source.query.applied.scopes.data?.readings.plan?.picked, ['Free']);

  source.query.commit({ scope: 'view' });
  await tick();
  assert.equal(source.query.pending('region'), false);
  assert.deepEqual(source.query.applied.scopes.view?.readings.region?.picked, ['EU']);
  assert.equal(source.total, 1, 'Apply loads: EU and Free');
});

test('Discard puts back one field\'s answer as last applied', async () => {
  const source = await open();
  source.query.setReading('view', 'region', { picked: ['EU'] });
  source.query.commit({ scope: 'view' });
  source.query.setReading('view', 'region', { picked: ['US'] });
  assert.equal(source.query.pending('region'), true);
  source.query.discard({ field: 'region' });
  assert.equal(source.query.pending('region'), false);
  assert.deepEqual(source.query.reading('view', 'region')?.picked, ['EU']);
});

test('no wait: a View pick applies at once, as before', async () => {
  const source = new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }) });
  source.query.hold('view', ['region']);
  source.query.setReading('view', 'region', { picked: ['EU'] });
  assert.equal(source.query.waiting(), false);
  assert.equal(source.query.pending('region'), false);
  assert.deepEqual(source.query.applied.scopes.view?.readings.region?.picked, ['EU']);
});
