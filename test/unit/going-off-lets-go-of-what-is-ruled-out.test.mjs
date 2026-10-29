/**
 * GOING OFF LETS GO OF WHAT IS RULED OUT — Will, TODOs 465 and 523 F3 (A): a
 * pick the filters before it rule out could never come back on (TODO 462), so
 * an answer switched off drops it, and one with none left clears. The data
 * layer decides, so a chip, the scope's Switch and the Filters menu agree.
 *
 *   node --test test/unit/going-off-lets-go-of-what-is-ruled-out.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, DataSource, VIEW } from '../../dist/data.js';

const ROWS = [{ id: 1, status: 'active', owner: 'Ann' }, { id: 2, status: 'active', owner: 'Ben' }, { id: 3, status: 'churned', owner: 'Cat' }];

/** Churned, then an owner it rules out, walked: Ann has no churned row. */
async function page() {
  const source = new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }), limitOptions: true });
  source.declareValues('status', ['active', 'churned']);
  source.declareValues('owner', ['Ann', 'Ben', 'Cat']);
  source.query.hold(VIEW, ['status', 'owner']);
  source.query.setReading(VIEW, 'status', { picked: ['churned'] });
  source.query.setReading(VIEW, 'owner', { picked: ['Ann'] });
  await source.load();
  await source.results(VIEW);
  const readings = () => source.query.applied.scopes[VIEW]?.readings ?? {};
  return { source, readings };
}

test('one answer turned off lets go of its ruled-out picks: none left, it clears', async () => {
  const { source, readings } = await page();
  // On, every pick ruled out: it stays in force, and matches nothing.
  assert.deepEqual(readings().owner, { picked: ['Ann'] });
  source.query.suspend(VIEW, 'owner', true);
  assert.equal(readings().owner, undefined);
  assert.deepEqual(readings().status, { picked: ['churned'] });
});

test('the scope\'s Switch lets go of them too; on again, what stood comes back', async () => {
  const { source, readings } = await page();
  source.query.suspend(VIEW, null, true);
  assert.equal(readings().owner, undefined);
  source.query.suspend(VIEW, null, false);
  assert.deepEqual(readings().status, { picked: ['churned'] });
  assert.equal(readings().owner, undefined);
});
