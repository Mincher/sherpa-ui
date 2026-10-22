/**
 * THE SAME PICKS IN ANY ORDER ARE THE SAME ANSWER — TODO 414. A panel and a
 * bar's tree list one field's picks in their own order, a path as an object or
 * as its key. Re-sent so, a waiting pick that was applied must not read as
 * changed.
 *
 *   node --test test/unit/the-same-picks-in-any-order-are-the-same-answer.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, DataSource } from '../../dist/data.js';
import { sameReading } from '../../dist/core/data/query.js';

const NW = { customer: 'Northwind', site: 'Leeds' };

test('order and a path written as its key do not make a change', () => {
  assert.equal(sameReading({ picked: ['Northwind', NW, 'Contoso'] }, { picked: ['Contoso', '{customer:Northwind,site:Leeds}', 'Northwind'] }), true);
  assert.equal(sameReading({ picked: ['Northwind'] }, { picked: ['Contoso'] }), false);
});

test('an applied pick re-sent in another order is not pending', async () => {
  const source = new DataSource({ store: new ArrayStore([{ id: 1, customer: 'Northwind', site: 'Leeds' }], { key: 'id' }) });
  source.query.hold('view', ['customer']);
  source.query.wait('view');
  source.query.setReading('view', 'customer', { picked: ['Northwind', NW, 'Contoso'] });
  source.query.commit();
  source.query.setReading('view', 'customer', { picked: ['Contoso', NW, 'Northwind'] });
  assert.equal(source.query.pending('customer'), false);
  assert.equal(source.query.dirty(), false);
});
