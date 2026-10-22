/**
 * THE SWITCH SUSPENDS THE ARRANGEMENT — Will, TODO 398: a bar's filter Switch
 * turns its scope's grouping and sorting off and on with its filters, each kept.
 * TRAP T-the-filter-switch-keeps-what-it-turned-off
 *
 *   node --test test/unit/the-switch-suspends-the-arrangement.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, DataSource } from '../../dist/data.js';

const ROWS = [{ id: 1, name: 'Cy', plan: 'Pro' }, { id: 2, name: 'Ada', plan: 'Free' }, { id: 3, name: 'Bo', plan: 'Pro' }];
const settle = () => new Promise((r) => setTimeout(r, 0));

test('switching a scope off lifts its sort and group, and on puts them back', async () => {
  const src = new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }) });
  src.query.declareScope('data', { label: 'Data', arranges: true });
  src.query.hold('data', ['plan']);
  src.query.setSort('name', 'asc', 'data');
  src.query.setGroup('plan', 'data');
  await settle();
  await src.load();
  const names = () => src.rows.map((r) => r.name);
  assert.deepEqual(names(), ['Ada', 'Bo', 'Cy']);
  assert.equal(src.state.group, 'plan');
  src.query.suspend('data', null, true);
  await settle();
  await src.load();
  assert.deepEqual(names(), ['Cy', 'Ada', 'Bo'], 'the store order: no sort');
  assert.equal(src.state.group ?? null, null, 'no group');
  src.query.suspend('data', null, false);
  await settle();
  await src.load();
  assert.deepEqual(names(), ['Ada', 'Bo', 'Cy']);
  assert.equal(src.state.group, 'plan');
});
