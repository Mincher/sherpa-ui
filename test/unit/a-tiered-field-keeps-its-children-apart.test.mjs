/**
 * A TIERED FIELD KEEPS ITS CHILDREN APART — TODO 369. A Customer's Sites are
 * kept per customer, apart from the customer list: the list (`valuesFor`, so a
 * chart, a legend, a band) never holds a site. The filter lists each customer,
 * then its sites in order, each naming its parent; the same site name under two
 * customers is two values. A long list is judged by its PARENTS.
 *
 *   node --test test/unit/a-tiered-field-keeps-its-children-apart.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, DataSource, openSource, valueKey } from '../../dist/data.js';
import { oneChipList } from '../../dist/core/ui/filter-kind.js';

const ROWS = [
  { id: 1, customer: 'Northwind', site: 'Leeds' },
  { id: 2, customer: 'Northwind', site: 'London' },
  { id: 3, customer: 'Contoso', site: 'London' },
  { id: 4, customer: 'Northwind', site: 'London' },
  { id: 5, customer: 'Contoso', site: null },
  { id: 6, customer: 'Tailspin' },
];
const FIELDS = { customer: { label: 'Customer', child: 'site' }, site: { label: 'Site' } };

async function source(fields = FIELDS) {
  return openSource({ store: 'rows', fields, scopes: { data: { label: 'Rows', holds: ['customer'] } } }, new ArrayStore(ROWS, { key: 'id' }));
}
const path = (customer, site) => valueKey({ customer, site });

test('each customer, then its sites in order, each naming its parent — the same site under two is two', async () => {
  const src = await source();
  const options = src.filterDef('customer').options.map(({ value, label, parent }) => [value, label, parent ?? null]);
  assert.deepEqual(options, [
    ['Contoso', 'Contoso', null],
    [path('Contoso', 'London'), 'London', 'Contoso'],
    ['Northwind', 'Northwind', null],
    [path('Northwind', 'Leeds'), 'Leeds', 'Northwind'],
    [path('Northwind', 'London'), 'London', 'Northwind'],
    ['Tailspin', 'Tailspin', null],
  ]);
});

test('the customer list holds no site, and a path key reads back as its object', async () => {
  const src = await source();
  assert.deepEqual(src.valuesFor('customer'), ['Contoso', 'Northwind', 'Tailspin']);
  assert.equal(src.valuesFor('customer').some((v) => typeof v === 'object'), false);
  src.select('customer', [path('Northwind', 'Leeds')]);
  // The reading holds the PATH, as the data holds values: an object.
  assert.deepEqual(src.reading('data', 'customer')?.picked, [{ customer: 'Northwind', site: 'Leeds' }]);
});

test('a parent with a declared domain still has its children', async () => {
  const src = new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }) });
  src.declareField('customer', { label: 'Customer', child: 'site' });
  src.declareField('site', { label: 'Site' });
  src.declareValues('customer', ['Northwind', 'Contoso']);
  await src.declareChildren('customer');
  const children = src.filterDef('customer').options.filter((o) => o.parent).map((o) => o.label);
  assert.deepEqual(children, ['Leeds', 'London', 'London']);
});

test('a long list is judged by its parents, not its children', () => {
  const parents = Array.from({ length: 10 }, (_, i) => ({ value: `c${i}`, label: `c${i}` }));
  const kids = parents.flatMap((p) => [1, 2].map((n) => ({ value: `${p.value}/${n}`, label: `${n}`, parent: p.value })));
  assert.equal(oneChipList({ id: 'customer', select: 'multiple', options: [...parents, ...kids] }), false);
  assert.equal(oneChipList({ id: 'customer', select: 'multiple', options: [...parents, ...parents.map((p) => ({ ...p, value: `${p.value}x` }))] }), true);
});

test('a field with no child has no tier', async () => {
  const src = await source({ customer: { label: 'Customer' }, site: { label: 'Site' } });
  assert.equal(src.filterDef('customer').options.some((o) => o.parent), false);
});
