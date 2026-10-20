/**
 * A TIERED FIELD COUNTS AT BOTH TIERS — TODO 369. The walk tallies a Customer
 * and each row's Customer–Site path, so a site greys, counts and is set aside
 * as a customer is. A store asked step by step tallies one field at a time and
 * has no pairs: there a path is judged by its customer, so it is never set
 * aside unless its customer is. A row edit that moves only a site walks again.
 * TRAP T-one-walk-counts-and-limits-in-order
 *
 *   node --test test/unit/a-tiered-field-counts-at-both-tiers.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, openSource, valueKey, VIEW } from '../../dist/data.js';
import { walkInOrder, walkReads } from '../../dist/core/data/walk.js';
import { planWalk, walkStepwise } from '../../dist/core/data/source-counts.js';

const ROWS = [
  { id: 1, region: 'EMEA', customer: 'Northwind', site: 'Leeds' },
  { id: 2, region: 'EMEA', customer: 'Northwind', site: 'London' },
  { id: 3, region: 'EMEA', customer: 'Contoso', site: 'London' },
  { id: 4, region: 'AMER', customer: 'Northwind', site: 'Boston' },
  { id: 5, region: 'AMER', customer: 'Contoso', site: null },
  { id: 6, region: 'APAC', customer: 'Tailspin', site: 'Paris' },
];
const at = (customer, site) => ({ customer, site });
const key = (customer, site) => valueKey(at(customer, site));
const PATHS = [['Northwind', 'Boston'], ['Northwind', 'Leeds'], ['Northwind', 'London'], ['Contoso', 'London'], ['Tailspin', 'Paris']];
const PARENT_OF = new Map(PATHS.map(([c, s]) => [key(c, s), c]));
const LISTS = new Set(['region', 'customer']);

function facts(over = {}) {
  return {
    field: (f) => (f === 'customer' ? { child: 'site', parentOf: PARENT_OF } : {}),
    isList: (f) => LISTS.has(f),
    plainPicks: (_f, r) => (r.mode ?? 'simple') === 'simple' && !r.range && (r.op ?? 'eq') === 'eq',
    sets: () => [],
    fields: () => ['region', 'customer'],
    components: new Set(),
    fixed: new Set(),
    parts: [],
    narrowing: new Map(),
    limit: true,
    now: new Date('2026-10-20T12:00:00Z'),
    ...over,
  };
}
const view = (readings, holds = ['region', 'customer']) => ({ v: 1, scopes: { view: { holds, readings } } });
const sorted = (keys) => [...keys].sort();

test('a site greys under a region pick, as its customer does', () => {
  const w = walkInOrder(ROWS, planWalk(view({ region: { picked: ['EMEA'] } }), facts()));
  assert.deepEqual(sorted(w.present.view.customer),
    sorted(['Northwind', 'Contoso', key('Northwind', 'Leeds'), key('Northwind', 'London'), key('Contoso', 'London')]));
});

test('a path key is the key valueKey gives the pair, whichever name sorts first', () => {
  const rows = [{ id: 1, zone: 'North', area: 'Hills' }];
  const plan = planWalk(view({}, ['zone']), facts({
    field: (f) => (f === 'zone' ? { child: 'area', parentOf: new Map() } : {}),
    isList: (f) => f === 'zone', fields: () => ['zone'],
  }));
  assert.deepEqual(walkInOrder(rows, plan).present.view.zone, ['North', valueKey({ zone: 'North', area: 'Hills' })]);
});

test('a path pick counts its own rows', () => {
  const w = walkInOrder(ROWS, planWalk(view({ customer: { picked: ['Contoso', at('Northwind', 'London')] } }), facts()));
  assert.deepEqual(w.values.view.customer, { Contoso: 2, [key('Northwind', 'London')]: 1 });
  assert.equal(w.ends.view, 3);
});

test('a path its ruler rules out is set aside, as a customer is', () => {
  const q = view({ region: { picked: ['EMEA'] }, customer: { picked: [at('Northwind', 'Boston'), at('Northwind', 'Leeds')] } });
  const w = walkInOrder(ROWS, planWalk(q, facts()));
  assert.deepEqual(w.aside.view, { customer: [key('Northwind', 'Boston')] });
  assert.equal(w.ends.view, 1);
});

test('asked step by step, a path is judged by its customer: kept while its customer is there', async () => {
  const q = view({ region: { picked: ['EMEA'] }, customer: { picked: [at('Northwind', 'Boston'), at('Northwind', 'Leeds')] } });
  const w = await walkStepwise(new ArrayStore(ROWS, { key: 'id' }), planWalk(q, facts()));
  assert.deepEqual(w.aside.view, {});
  // Every path of a customer that is there: none greyed that its customer is not.
  assert.ok(w.present.view.customer.includes(key('Northwind', 'Boston')));
  assert.ok(!w.present.view.customer.includes(key('Tailspin', 'Paris')));
  assert.equal(w.ends.view, undefined);
});

test('a path pick at the top of a chain narrows what the field below offers', () => {
  const sets = () => [{ id: 'acct', mode: 'serial', fields: ['customer', 'region'] }];
  const w = walkInOrder(ROWS, planWalk(view({ customer: { picked: [at('Northwind', 'Boston')] } }, ['customer', 'region']), facts({ sets })));
  assert.deepEqual(w.offered.view.region, ['AMER']);
});

test('a chain below a region offers the sites the rows there hold', () => {
  const sets = () => [{ id: 'acct', mode: 'serial', fields: ['region', 'customer'] }];
  const w = walkInOrder(ROWS, planWalk(view({ region: { picked: ['AMER'] } }), facts({ sets })));
  assert.deepEqual(sorted(w.offered.view.customer), sorted(['Northwind', 'Contoso', key('Northwind', 'Boston')]));
});

test('the walk reads the child it tallies, so an edit to a site alone walks again', async () => {
  const plan = planWalk(view({ region: { picked: ['EMEA'] } }), facts());
  assert.ok(walkReads(plan).view.tallied.includes('site'));
  const store = new ArrayStore(ROWS.map((r) => ({ ...r })), { key: 'id' });
  const src = await openSource({
    store: 'rows', fields: { region: { label: 'Region' }, customer: { label: 'Customer', child: 'site' }, site: { label: 'Site' } },
    scopes: { view: { label: 'View', holds: ['region', 'customer'] } },
  }, store);
  src.limitOptions = true;
  await src.setQuery(view({ region: { picked: ['EMEA'] } }));
  assert.ok((await src.present(VIEW)).customer.includes(key('Northwind', 'Leeds')));
  await store.update(1, { ...ROWS[0], site: 'York' });
  const now = (await src.present(VIEW)).customer;
  assert.ok(now.includes(key('Northwind', 'York')));
  assert.ok(!now.includes(key('Northwind', 'Leeds')));
});
