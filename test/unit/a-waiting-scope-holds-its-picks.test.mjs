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
  source.query.ask({ scope: 'view', hold: ['region'] });
  source.query.ask({ scope: 'data', hold: ['plan'] });
  source.query.wait('view');
  await source.load();
  return source;
}

test('a View pick waits for Apply; a data pick applies at once', async () => {
  const source = await open();
  assert.equal(source.query.waiting('view'), true);
  assert.equal(source.query.waiting('data'), false);

  source.query.ask({ scope: 'view', field: 'region', reading: { picked: ['EU'] } });
  await tick();
  assert.equal(source.query.pending('region'), true, 'the View pick is pending');
  assert.equal(source.query.dirty('view'), true);
  assert.equal(source.total, 3, 'and the rows did not move');

  source.query.ask({ scope: 'data', field: 'plan', reading: { picked: ['Free'] } });
  await tick();
  assert.equal(source.query.pending('plan'), false, 'a data pick is never pending');
  assert.deepEqual(source.query.applied.scopes.data?.readings.plan?.picked, ['Free']);

  source.query.ask({ scope: 'view', commit: true });
  await tick();
  assert.equal(source.query.pending('region'), false);
  assert.deepEqual(source.query.applied.scopes.view?.readings.region?.picked, ['EU']);
  assert.equal(source.total, 1, 'Apply loads: EU and Free');
});

test('Discard puts back one field\'s answer as last applied', async () => {
  const source = await open();
  source.query.ask({ scope: 'view', field: 'region', reading: { picked: ['EU'] } });
  source.query.ask({ scope: 'view', commit: true });
  source.query.ask({ scope: 'view', field: 'region', reading: { picked: ['US'] } });
  assert.equal(source.query.pending('region'), true);
  source.query.ask({ field: 'region', discard: true });
  assert.equal(source.query.pending('region'), false);
  assert.deepEqual(source.query.reading('view', 'region')?.picked, ['EU']);
});

test('no wait: a View pick applies at once, as before', async () => {
  const source = new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }) });
  source.query.ask({ scope: 'view', hold: ['region'] });
  source.query.ask({ scope: 'view', field: 'region', reading: { picked: ['EU'] } });
  assert.equal(source.query.waiting(), false);
  assert.equal(source.query.pending('region'), false);
  assert.deepEqual(source.query.applied.scopes.view?.readings.region?.picked, ['EU']);
});
