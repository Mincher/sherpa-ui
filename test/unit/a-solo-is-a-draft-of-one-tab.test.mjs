/**
 * A SOLO IS A DRAFT OF ONE TAB — Will, TODO 690. Soloing a filter switches every
 * other answer in force in its scope off, its value whole; ending it switches back
 * on only what it switched off. It is never exported, so no View or draft saves it.
 * TRAP T-a-solo-is-a-draft-of-one-tab
 *
 *   node --test test/unit/a-solo-is-a-draft-of-one-tab.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, DataSource, VIEW, onReport } from '../../dist/data.js';

onReport(() => {});
const ROWS = [
  { id: 1, region: 'EU', plan: 'Pro', owner: 'Ada', seats: 5 },
  { id: 2, region: 'US', plan: 'Free', owner: 'Bo', seats: 50 },
  { id: 3, region: 'EU', plan: 'Free', owner: 'Cy', seats: 90 },
];
const settle = () => new Promise((r) => setTimeout(r, 30));

async function page() {
  const source = new DataSource({ store: new ArrayStore(ROWS.map((r) => ({ ...r })), { key: 'id' }) });
  for (const f of ['region', 'plan', 'owner']) source.declareValues(f, [...new Set(ROWS.map((r) => r[f]))]);
  source.query.ask({ scope: VIEW, hold: ['region'] });
  source.query.ask({ scope: 'data', hold: ['plan', 'owner'] });
  source.query.ask({ scope: VIEW, field: 'region', reading: { picked: ['EU'] } });
  source.query.ask({ scope: 'data', field: 'plan', reading: { picked: ['Free'] } });
  source.query.ask({ scope: 'data', field: 'owner', reading: { picked: ['Bo'] } });
  await source.load({ force: true });
  await settle();
  return source;
}
const off = (source, scope, field) => !!source.query.reading(scope, field)?.suspended;

test('a solo switches the others in its scope off, each value whole, and leaves other scopes alone', async () => {
  const source = await page();
  assert.deepEqual(source.rows.map((r) => r.id), [], 'EU, Free and Bo: none');
  source.query.ask({ scope: 'data', solo: 'plan' });
  assert.deepEqual(source.query.soloed, { scope: 'data', field: 'plan' });
  assert.equal(off(source, 'data', 'owner'), true);
  assert.deepEqual(source.query.reading('data', 'owner').picked, ['Bo'], 'its value is whole');
  assert.equal(off(source, 'data', 'plan'), false);
  assert.equal(off(source, VIEW, 'region'), false, 'another scope is not touched');
  await source.load();
  await settle();
  assert.deepEqual(source.rows.map((r) => r.id), [3], 'EU and Free alone');
});

test('across every scope, a solo switches the View\'s answers off too', async () => {
  const source = await page();
  source.query.ask({ scope: 'data', solo: 'plan', across: true });
  assert.equal(off(source, VIEW, 'region'), true);
  assert.equal(off(source, 'data', 'owner'), true);
});

test('ending it switches back on only what it switched off', async () => {
  const source = await page();
  source.query.ask({ scope: 'data', field: 'owner', suspended: true });
  source.query.ask({ scope: VIEW, solo: 'region', across: true });
  assert.equal(off(source, 'data', 'plan'), true);
  source.query.ask({ unsolo: true });
  assert.equal(source.query.soloed, null);
  assert.equal(off(source, 'data', 'plan'), false, 'the solo turned it off: back on');
  assert.equal(off(source, 'data', 'owner'), true, 'the reader turned it off: stays off');
});

test('a solo is never exported: a View saved meanwhile has every filter on', async () => {
  const source = await page();
  source.query.ask({ scope: 'data', solo: 'plan', across: true });
  const { query } = source.query.export();
  assert.equal(query.scopes.data.readings.owner.suspended, undefined);
  assert.equal(query.scopes[VIEW].readings.region.suspended, undefined);
  assert.equal(off(source, 'data', 'owner'), true, 'the page still has it off');
});

test('a View put in ends the solo', async () => {
  const source = await page();
  const saved = source.query.export();
  source.query.ask({ scope: 'data', solo: 'plan' });
  await source.query.import(saved);
  assert.equal(source.query.soloed, null);
  assert.equal(off(source, 'data', 'owner'), false);
});
