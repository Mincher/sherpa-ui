/**
 * A RESET IS OFFERED FOR ITS OWN SCOPES — TODO 518 (U15). `answered(scopes)`
 * says whether a Reset over those scopes would clear anything: a filter or an
 * arrangement IN them, never one elsewhere.
 *
 *   node --test test/unit/a-reset-is-offered-for-its-own-scopes.test.mjs
 *
 * TRAP T-reset-to-default-is-the-views-own
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, DataSource, VIEW, bindSource } from '../../dist/data.js';

const control = () => Object.assign(new EventTarget(), { setAttribute() {}, removeAttribute() {}, hasAttribute: () => false, populate() {} });

async function page() {
  const source = new DataSource({ store: new ArrayStore([{ id: 1, plan: 'Pro', tier: 'Gold' }, { id: 2, plan: 'Free', tier: 'Bronze' }], { key: 'id' }) });
  source.declareField('plan', { label: 'Plan' });
  source.declareField('tier', { label: 'Tier' });
  bindSource(source, control(), { scope: 'data' });
  source.query.hold(VIEW, ['plan']);
  source.query.hold('data', ['tier']);
  await source.load();
  return source;
}

test('a filter answers its own scope, and a list of scopes holding it', async () => {
  const source = await page();
  source.query.setReading(VIEW, 'plan', { picked: ['Pro'] });
  await source.load();
  assert.equal(source.answered(), true);
  assert.equal(source.answered(VIEW), true);
  assert.equal(source.answered('data'), false);
  assert.equal(source.answered(['data']), false);
  assert.equal(source.answered([VIEW, 'data']), true);
});

test('a sort is its own scope\'s to reset, never another\'s', async () => {
  const source = await page();
  source.query.setSort('tier', 'asc', 'data');
  await source.load();
  assert.equal(source.answered('data'), true);
  assert.equal(source.answered(VIEW), false);
  assert.equal(source.answered(), true);
});
