/**
 * NOTHING TICKED FILTERS NOTHING — Will, TODO 550. "Select none shows all data"
 * is the only way: a list left empty leaves the field out of the query, and no
 * value is hidden. `in: []` reads as nothing picked; an old save's `none: true`
 * filters nothing either.
 *
 *   node --test test/unit/nothing-ticked-filters-nothing.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, DataSource, readingClause, readingsOf } from '../../dist/data.js';
import { readingAnswered } from '../../dist/core/data/query.js';

const LIST = { field: 'customer', values: ['Contoso', 'Northwind'] };
const ROWS = [{ id: 1, customer: 'Contoso' }, { id: 2, customer: 'Northwind' }, { id: 3, customer: 'Contoso' }];

test('nothing ticked is no clause, and no answer', () => {
  assert.equal(readingClause(LIST, { picked: [] }), undefined);
  assert.equal(readingAnswered({ picked: [] }), false);
});

test('`in: []` reads as nothing picked', () => {
  assert.deepEqual(readingsOf({ customer: { in: [] } }), { customer: { picked: [] } });
});

test('a source with nothing ticked — an old save\'s `none` too — answers every row', async () => {
  const source = new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }) });
  await source.declareFromRows(['customer']);
  source.query.ask({ scope: 'view', hold: ['customer'] });
  source.query.ask({ scope: 'view', field: 'customer', reading: { picked: [] } });
  await source.load();
  assert.equal(source.debugState().total, 3);
  source.query.ask({ scope: 'view', field: 'customer', reading: /** @type {never} */ ({ picked: [], none: true }) });
  await source.load();
  assert.equal(source.debugState().total, 3);
});
