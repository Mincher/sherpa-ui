/**
 * A PATH PICK FILTERS TWO FIELDS — TODO 369. A Customer pick is the customer:
 * every row of it, a row with no site too (Will, Q1 A). A Site pick is a PATH,
 * `{ customer, site }`, and filters as `customer is it AND site is one of`. The
 * parts are OR'd: one clause in `and`, `or`, `eq` and `in`, which a server
 * runs too. A site under a customer that is picked says nothing more. The
 * saved form keeps the pick list, and reads back as itself.
 *
 *   node --test test/unit/a-path-pick-filters-two-fields.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, openSource, filterRows, valueKey } from '../../dist/data.js';

const ROWS = [
  { id: 1, customer: 'Northwind', site: 'Leeds' },
  { id: 2, customer: 'Northwind', site: 'London' },
  { id: 3, customer: 'Contoso', site: 'London' },
  { id: 4, customer: 'Northwind', site: 'London' },
  { id: 5, customer: 'Contoso', site: null },
  { id: 6, customer: 'Tailspin', site: 'Paris' },
];
const FIELDS = { customer: { label: 'Customer', child: 'site' }, site: { label: 'Site' } };
const at = (customer, site) => ({ customer, site });
const settle = () => new Promise((r) => setTimeout(r, 30));

async function source() {
  const src = await openSource({ store: 'rows', fields: FIELDS, scopes: { data: { label: 'Rows', holds: ['customer'] } } },
    new ArrayStore(ROWS, { key: 'id' }));
  await src.load();
  return src;
}
const ids = (src) => src.rows.map((r) => r.id).sort((a, b) => a - b);

test('a customer, and a customer\'s sites, OR\'d: every row of the one, the sites of the other', async () => {
  const src = await source();
  src.select('customer', ['Contoso', valueKey(at('Northwind', 'London'))]);
  await settle();
  // Contoso's rows, its siteless one too; and Northwind's London rows only.
  assert.deepEqual(ids(src), [2, 3, 4, 5]);
  assert.deepEqual(src.selection('customer').rows, [{ op: 'eq', picked: ['Contoso', at('Northwind', 'London')] }]);
});

test('the clause is plain and/or/eq/in — a server runs the same', async () => {
  const { stateClause, fieldState } = await import('../../dist/data.js');
  const src = await source();
  src.select('customer', ['Contoso', valueKey(at('Northwind', 'London')), valueKey(at('Northwind', 'Leeds'))]);
  const c = stateClause(src.selection('customer'));
  assert.deepEqual(c, ['or', ['customer', 'eq', 'Contoso'], ['and', ['customer', 'eq', 'Northwind'], ['site', 'in', ['Leeds', 'London']]]]);
  assert.deepEqual(filterRows(ROWS, c).map((r) => r.id), [1, 2, 3, 4, 5]);
  // NOT those: its opposite, every other row.
  const not = stateClause(fieldState({ field: 'customer', values: src.selection('customer').values.map((v) => v.raw),
    child: 'site', parentOf: new Map(src.selection('customer').values.filter((v) => v.parent).map((v) => [v.value, v.parent])) },
  { mode: 'advanced', conditions: [{ op: 'ne', picked: ['Contoso', at('Northwind', 'London')] }] }));
  assert.deepEqual(filterRows(ROWS, not).map((r) => r.id), [1, 6]);
});

test('a site under a customer that is picked says nothing more', async () => {
  const src = await source();
  src.select('customer', ['Northwind', valueKey(at('Northwind', 'London'))]);
  await settle();
  assert.deepEqual(src.selection('customer').rows, [{ op: 'eq', picked: ['Northwind'] }]);
  // …and shows picked, under its picked customer.
  const london = src.selection('customer').values.find((v) => v.value === valueKey(at('Northwind', 'London')));
  assert.equal(london.state, 'picked');
  assert.equal(london.parent, 'Northwind');
});

test('every customer ticked is no filter; a site alone still is', async () => {
  const src = await source();
  src.select('customer', ['Contoso', 'Northwind', 'Tailspin']);
  await settle();
  assert.deepEqual(ids(src), [1, 2, 3, 4, 5, 6]);
  assert.equal(src.selection('customer').fieldState, 'off');
  src.select('customer', [valueKey(at('Tailspin', 'Paris'))]);
  await settle();
  assert.deepEqual(ids(src), [6]);
});

test('the saved form keeps the pick list, and reads back as itself', async () => {
  const src = await source();
  const picked = { picked: ['Contoso', at('Northwind', 'London')] };
  const where = src.whereOf({ customer: picked });
  assert.deepEqual(where, { customer: { in: ['Contoso', at('Northwind', 'London')] } });
  assert.deepEqual(src.readingsOf(where), { customer: picked });
  const not = src.whereOf({ customer: { op: 'ne', picked: ['Contoso', at('Northwind', 'London')] } });
  assert.deepEqual(not, { customer: { notin: ['Contoso', at('Northwind', 'London')] } });
});
