/**
 * NONE IS AN ANSWER — Will, TODO 403. Where a list's picks fetch, nothing ticked
 * while on — Select All off — answers NO rows, not every row. The reading says
 * so on purpose, `{ picked: [], none: true }`; switched off it asks for all, as
 * any chip does. A typed, date or range answer has no none. TRAP T-none-is-an-answer
 *
 *   node --test test/unit/none-is-an-answer.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, DataSource, readingClause, readingsOf, whereOf } from '../../dist/data.js';
import { readingAnswered, sameReading } from '../../dist/core/data/query.js';

const LIST = { field: 'customer', values: ['Contoso', 'Northwind'] };
const ROWS = [{ id: 1, customer: 'Contoso' }, { id: 2, customer: 'Northwind' }, { id: 3, customer: 'Contoso' }];

test('none is a clause of no rows; nothing ticked without it is no filter', () => {
  assert.deepEqual(readingClause(LIST, { picked: [], none: true }), ['customer', 'in', []]);
  assert.equal(readingClause(LIST, { picked: [] }), undefined);
  // Off, it filters nothing — the reading is kept.
  assert.equal(readingClause(LIST, { picked: [], none: true, suspended: true }), undefined);
});

test('a pick outranks none, and a date or a typed answer has none', () => {
  assert.deepEqual(readingClause(LIST, { picked: ['Contoso'], none: true }), ['customer', 'eq', 'Contoso']);
  assert.equal(readingClause({ field: 'created', type: 'date' }, { picked: [], none: true }), undefined);
  assert.equal(readingClause(LIST, { op: 'contains', text: '', none: true }), undefined);
});

test('none is answered, and is not the same answer as nothing', () => {
  assert.equal(readingAnswered({ picked: [], none: true }), true);
  assert.equal(readingAnswered({ picked: [] }), false);
  assert.equal(sameReading({ picked: [], none: true }, { picked: [] }), false);
});

test('written plainly it is `in: []`, and reads back as none', () => {
  const where = whereOf({ customer: { picked: [], none: true } });
  assert.deepEqual(where, { customer: { in: [] } });
  assert.deepEqual(readingsOf(where), { customer: { picked: [], none: true } });
  assert.deepEqual(readingsOf({ customer: { in: [], off: true } }), { customer: { picked: [], none: true, suspended: true } });
});

test('a source answers none with no rows, and off with every row', async () => {
  const source = new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }) });
  await source.declareFromRows(['customer']);
  source.query.hold('view', ['customer']);
  source.query.setReading('view', 'customer', { picked: [], none: true });
  await source.load();
  assert.equal(source.debugState().total, 0);
  source.query.setReading('view', 'customer', { picked: [], none: true, suspended: true });
  await source.load();
  assert.equal(source.debugState().total, 3);
});
