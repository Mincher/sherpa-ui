/**
 * A CHIP COUNTS WITHIN THE FILTERS BEFORE IT — TODO 348. Will: *"they should
 * show the count of matches from the filtered subset. So scopes and preceding
 * filters will affect this."* The one order: saved filters, then fields, each set
 * together; OFF counts and narrows nothing (123); a saved filter counts only
 * while ON (166). TRAP T-a-chip-counts-within-the-filters-before-it
 *
 *   node --test test/unit/a-chip-counts-within-the-filters-before-it.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, bindSource, openSource } from '../../dist/data.js';

const ROWS = [
  { id: 1, region: 'EMEA', status: 'open', plan: 'pro', seats: 5 },
  { id: 2, region: 'EMEA', status: 'shut', plan: 'pro', seats: 9 },
  { id: 3, region: 'AMER', status: 'open', plan: 'free', seats: 5 },
  { id: 4, region: 'AMER', status: 'open', plan: 'pro', seats: 1 },
  { id: 5, region: 'APAC', status: 'open', plan: 'free', seats: 5 },
  { id: 6, region: 'APAC', status: 'shut', plan: 'free', seats: 2 },
];
const control = () => ({ populate() {}, setAttribute() {}, removeAttribute() {}, addEventListener() {}, removeEventListener() {} });

async function page({ data = ['status', 'plan'], sets, presets } = {}) {
  const source = await openSource({
    store: 'rows',
    fields: { region: { label: 'Region' }, status: { label: 'Status' }, plan: { label: 'Plan' }, seats: { label: 'Seats', type: 'number' } },
    scopes: {
      view: { label: 'View filters', holds: ['region'] },
      data: { label: 'Rows', holds: data, ...(sets ? { sets } : {}), ...(presets ? { presets: Object.keys(presets) } : {}) },
    },
    ...(presets ? { presets } : {}),
  }, new ArrayStore(ROWS, { key: 'id' }));
  // Bound, `data` is a COMPONENT's scope, under the View.
  bindSource(source, control(), { scope: 'data' });
  return source;
}
const query = (view, data, dataPresets) => ({ v: 1, scopes: {
  view: { holds: ['region'], readings: view },
  data: { holds: Object.keys(data), readings: data, ...(dataPresets ? { presets: dataPresets } : {}) },
} });

test('each chip counts within the filters before it; the last in force is the total', async () => {
  const source = await page();
  await source.setQuery(query({ region: { picked: ['EMEA', 'AMER'] } }, { status: { picked: ['open'] }, plan: { picked: ['pro'] } }));
  assert.deepEqual(await source.results('view'), { region: 4 });
  // Status within the View's four; Plan within those three open.
  assert.deepEqual(await source.results('data'), { status: 3, plan: 2 });
  assert.equal(source.debugState().total, 2);
});

test('the order decides: Plan before Status counts over the View alone', async () => {
  const source = await page({ data: ['plan', 'status'] });
  await source.setQuery(query({ region: { picked: ['EMEA', 'AMER'] } }, { plan: { picked: ['pro'] }, status: { picked: ['open'] } }));
  assert.deepEqual(await source.results('data'), { plan: 3, status: 2 });
});

test('OFF counts within the filters before it, and narrows nothing after it', async () => {
  const source = await page({ data: ['plan', 'status', 'seats'] });
  await source.setQuery(query({}, {
    plan: { picked: ['pro'] }, status: { picked: ['shut'], suspended: true }, seats: { picked: ['5'], range: false },
  }));
  // Status off: 1 of Plan's 3 would match; Seats counts over all 3.
  assert.deepEqual(await source.results('data'), { plan: 3, status: 1, seats: 1 });
});

test('a saved filter ON narrows what follows it; OFF it has no badge', async () => {
  const presets = { free: { label: 'Free', where: { plan: { eq: 'free' } } } };
  const source = await page({ data: ['status'], presets });
  await source.setQuery(query({}, { status: { picked: ['open'] } }, { free: true }));
  // Saved filters come first: Free over every row, then Status within it.
  assert.deepEqual(await source.results('data'), { free: 3, status: 2 });
  await source.setQuery(query({}, { status: { picked: ['open'] } }, { free: false }));
  assert.deepEqual(await source.results('data'), { status: 4 });
});

test('a set\'s fields count together, where its first stands', async () => {
  const sets = [{ id: 's', fields: ['plan', 'seats'] }];
  const source = await page({ data: ['plan', 'status', 'seats'], sets });
  await source.setQuery(query({}, {
    plan: { picked: ['pro'] }, status: { picked: ['open'] }, seats: { picked: ['5'], range: false },
  }));
  // Plan, then Seats (its set), then Status.
  assert.deepEqual(await source.results('data'), { plan: 3, seats: 1, status: 1 });
});

test('a part another component contributes narrows every chip (347)', async () => {
  const source = await page();
  await source.setQuery(query({ region: { picked: ['EMEA', 'APAC'] } }, { status: { picked: ['open'] } }));
  source.contribute('only-pro', ['plan', 'eq', 'pro']);
  await source.load();
  assert.deepEqual(await source.results('view'), { region: 2 });
  assert.deepEqual(await source.results('data'), { status: 1 });
});

test('each picked value counts within the filters before its field', async () => {
  const source = await page();
  await source.setQuery(query({ region: { picked: ['EMEA'] } }, { status: { picked: ['open'] }, plan: { picked: ['pro', 'free'] } }));
  const values = await source.valueResults('data');
  assert.deepEqual(values.status, { open: 1 });
  // Within EMEA's one open row.
  assert.deepEqual(values.plan, { pro: 1, free: 0 });
});
