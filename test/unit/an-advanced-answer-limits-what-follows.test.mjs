/**
 * AN ADVANCED ANSWER LIMITS WHAT FOLLOWS — TODO 386. Will: "Advanced filter
 * conditions potentially aren't limiting other filter fields and values in the
 * query chain." They do: a field answered by condition rows is one of the
 * filters BEFORE every field after it — the rows, each later field's values,
 * and its count — held or on the step-by-step walk alike. A guard.
 * TRAP T-one-walk-counts-and-limits-in-order
 *
 *   node --test test/unit/an-advanced-answer-limits-what-follows.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, DataSource, bindSource, spoofRemote, VIEW } from '../../dist/data.js';

const ROWS = [
  { id: 1, region: 'EMEA', customer: 'Contoso', seats: 5 },
  { id: 2, region: 'EMEA', customer: 'Tailspin', seats: 50 },
  { id: 3, region: 'AMER', customer: 'Contoso', seats: 8 },
  { id: 4, region: 'APAC', customer: 'Litware', seats: 80 },
  { id: 5, region: 'LATAM', customer: 'Fabrikam', seats: 2 },
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** A View bar holding region then customer, answering region as it is told. */
class Bar extends EventTarget {
  constructor(region) { super(); this.held = { region }; this.present = null; this.results = null; }
  get readings() { return this.held; }
  get presets() { return {}; }
  get heldFields() { return ['region', 'customer']; }
  drawResults(r) { this.results = r; }
  drawPresent(p) { this.present = p; }
  drawScope() {} setAttribute() {} removeAttribute() {} toggleAttribute() {} populate() {}
  report() { this.dispatchEvent(new CustomEvent('quick-filter-change', { detail: { readings: this.readings, presets: {}, holds: this.heldFields } })); }
}

async function page(store, region, options = {}) {
  const source = new DataSource({ store, limitOptions: true, ...options });
  source.declareValues('region', ['EMEA', 'AMER', 'APAC', 'LATAM']);
  source.declareValues('customer', ['Contoso', 'Tailspin', 'Litware', 'Fabrikam']);
  const bar = new Bar(region);
  bindSource(source, bar, { steerOnly: true, scope: VIEW });
  bar.report();
  await source.load();
  await sleep(40);
  return { source, bar, ids: () => source.rows.map((r) => r.id) };
}

const ADVANCED = {
  'contains EM': { mode: 'advanced', conditions: [{ op: 'contains', text: 'EM' }] },
  'eq EMEA or eq AMER': { mode: 'advanced', conditions: [{ op: 'eq', picked: ['EMEA'] }, { op: 'eq', join: 'or', picked: ['AMER'] }] },
  'ne EMEA': { mode: 'advanced', conditions: [{ op: 'ne', picked: ['EMEA'] }] },
};
const WANT = {
  'contains EM': { ids: [1, 2], customer: ['Contoso', 'Tailspin'], count: 2 },
  'eq EMEA or eq AMER': { ids: [1, 2, 3], customer: ['Contoso', 'Tailspin'], count: 3 },
  'ne EMEA': { ids: [3, 4, 5], customer: ['Contoso', 'Litware', 'Fabrikam'], count: 3 },
};

for (const [name, reading] of Object.entries(ADVANCED)) {
  test(`held: region ${name} narrows the rows, what Customer offers, and wears its own count`, async () => {
    const { bar, ids } = await page(new ArrayStore(ROWS, { key: 'id' }), reading);
    assert.deepEqual(ids(), WANT[name].ids);
    assert.deepEqual([...(bar.present?.customer ?? [])].sort(), [...WANT[name].customer].sort());
    assert.equal(bar.results?.region, WANT[name].count);
  });

  test(`step by step (remote, not held): region ${name} narrows what Customer offers`, async () => {
    const store = spoofRemote(new ArrayStore(ROWS, { key: 'id' }), { delay: 0 });
    const { bar } = await page(store, reading, { holdRows: 0 });
    assert.deepEqual([...(bar.present?.customer ?? [])].sort(), [...WANT[name].customer].sort());
  });
}
