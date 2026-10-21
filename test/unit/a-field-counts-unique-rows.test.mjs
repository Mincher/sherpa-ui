/**
 * A FIELD'S COUNT IS ITS UNIQUE ROWS — TODO 173. The header counts the rows
 * ANY of its values match, once each: one count of the whole answer, never a
 * sum of the values' own counts.
 *
 *   node --test test/unit/a-field-counts-unique-rows.test.mjs
 *
 * TRAP T-a-chip-counts-within-the-filters-before-it
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, DataSource, bindSource, VIEW } from '../../dist/data.js';

const ROWS = [
  { id: 1, region: 'EMEA', owner: 'Dana' },
  { id: 2, region: 'EMEA', owner: 'Ann' },
  { id: 3, region: 'APAC', owner: 'Bo' },
  { id: 4, region: 'Americas', owner: 'Cy' },
];

/** A View bar that holds the readings it is given. */
class Bar extends EventTarget {
  constructor(readings) { super(); this.held = readings; }
  get readings() { return this.held; }
  get heldFields() { return Object.keys(this.held); }
  drawScope() {}
  setAttribute() {}
  removeAttribute() {}
  toggleAttribute() {}
  populate() {}
  // Its holds, then each held field's answer as one request — its Apply. 366 step 21
  report() {
    this.dispatchEvent(new CustomEvent('filter-add', { detail: { holds: this.heldFields } }));
    const request = this.heldFields.map((field) => ({ field, reading: this.readings[field] ?? null, commit: true }));
    this.dispatchEvent(new CustomEvent('quick-filter-change', { detail: { request } }));
  }
}

async function counts(readings) {
  const source = new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }) });
  const bar = new Bar(readings);
  bindSource(source, bar, { steerOnly: true, scope: VIEW });
  bar.report();
  await source.load();
  return { field: await source.results(VIEW), values: await source.valueResults(VIEW) };
}

test('two picked values: each counts its own rows, and the header the rows of both', async () => {
  const r = await counts({ region: { picked: ['EMEA', 'APAC'] } });
  assert.deepEqual(r.values, { region: { EMEA: 2, APAC: 1 } });
  // A row holds ONE region, so here the rows of both are the sum.
  assert.deepEqual(r.field, { region: 3 });
});

test('two conditions that match the SAME rows: the header counts each row once', async () => {
  // "Dana" and "Ann" hold both an a and an n: 2 rows, though each row matches 2.
  const r = await counts({ owner: { conditions: [
    { op: 'contains', text: 'a' },
    { op: 'contains', text: 'n', join: 'or' },
  ] } });
  assert.deepEqual(r.field, { owner: 2 });
});
