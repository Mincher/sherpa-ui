/**
 * AN AXIS OFFERS WHAT THE APP SAYS — Will, TODO 660. Each axis's chip — Primary,
 * Secondary, Group — offers only the fields its app makes `available`, less those
 * it makes `unavailable`, in a chart and in a grid. Records' charts: a Name, an
 * Email, a Customer or a Site each names one thing, so no Secondary or Group offers
 * them; the Primary is the page's, and keeps them.
 *
 *   node --test test/unit/an-axis-offers-what-the-app-says.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, QueryContext, bindSource, openSource } from '../../dist/data.js';

const ROWS = [
  { id: 1, name: 'Ann', customer: 'Acme', status: 'active', plan: 'Pro', seats: 3 },
  { id: 2, name: 'Bo', customer: 'Bolt', status: 'trial', plan: 'Free', seats: 1 },
];
const ENTITIES = ['name', 'customer'];

/** A control the binder can steer: events in, nothing drawn. */
const control = () => Object.assign(new EventTarget(), {
  setAttribute() {}, removeAttribute() {}, hasAttribute: () => false, populate() {}, drawScope() {},
});

async function page(scopes = {}) {
  const source = await openSource({
    store: 'people',
    fields: { name: { label: 'Name' }, customer: { label: 'Customer' }, status: { label: 'Status' }, plan: { label: 'Plan' }, seats: { label: 'Seats', type: 'number' } },
    scopes: { data: { offers: 'all' }, ...scopes },
    axes: { chart: { secondary: { unavailable: ENTITIES }, group: { unavailable: ENTITIES } } },
  }, new ArrayStore(ROWS, { key: 'id' }));
  bindSource(source, control(), { scope: 'data' });
  // A chart's slot: every row, and it stacks by a Secondary.
  bindSource(source, control(), { scope: 'by-status', rows: 'all', readonly: true, shows: { primary: 'customer' }, stacks: true });
  await source.load();
  return source;
}

const fields = (cols) => cols?.map((c) => c.field);

test('a chart\'s Secondary and Group skip what the app makes unavailable; its Primary keeps them', async () => {
  const slot = (await page()).describe('by-status');
  assert.deepEqual(fields(slot.chartFields), ['name', 'customer', 'status', 'plan']);
  assert.deepEqual(fields(slot.secondaryFields), ['status', 'plan']);
  assert.deepEqual(fields(slot.group), ['status', 'plan']);
  assert.equal(slot.primaryField, 'customer');
});

test('a chart\'s offers leave a grid alone, and a scope\'s own win an axis over the page\'s', async () => {
  const source = await page({ data: { offers: 'all', axes: { grid: { group: { available: ['status', 'seats'] } } } } });
  const grid = source.describe('data');
  // Available narrows, never adds: Seats is a number.
  assert.deepEqual(fields(grid.group), ['status']);
  assert.deepEqual(fields(grid.secondaryFields), ['name', 'customer', 'status', 'plan']);
});

test('axesOf: the page\'s, its view\'s, the scope\'s, then the scope\'s view\'s — the last to name an axis wins it', () => {
  const query = new QueryContext();
  query.declareAxes({ group: { unavailable: ['a'] }, secondary: { unavailable: ['a'] }, chart: { secondary: { unavailable: ['b'] } } });
  query.declareAxes({ chart: { group: { available: ['c'] } } }, 'by-status');
  assert.deepEqual(query.axesOf('by-status', 'chart'), { group: { available: ['c'] }, secondary: { unavailable: ['b'] } });
  assert.deepEqual(query.axesOf('by-status', 'grid'), { group: { unavailable: ['a'] }, secondary: { unavailable: ['a'] } });
  assert.deepEqual(query.axesOf('other', 'chart'), { group: { unavailable: ['a'] }, secondary: { unavailable: ['b'] } });
});
