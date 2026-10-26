/**
 * A BAND IS A VALUE OF ITS FIELD — Will, TODO 477. A number that declares its
 * bands offers them as its values: a pick names a band and filters by its
 * range, several either; a row counts under its band; and a pick is saved, and
 * read back, by its name.
 *
 *   node --test test/unit/a-band-is-a-value-of-its-field.test.mjs
 *
 * TRAP T-a-band-is-a-value-of-its-field
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, bindSource, openSource } from '../../dist/data.js';
import { readingClause, rowsFromPicks } from '../../dist/core/data/filter-state.js';
import { matchesFilter } from '../../dist/core/data/store.js';

const HEALTH = [
  { to: 60, label: 'At risk', status: 'critical' },
  { to: 80, label: 'Watch', status: 'warning' },
  { to: 100, label: 'Healthy', status: 'success' },
];
const ROWS = [55, 60, 79, 80, 95].map((health, i) => ({ id: i + 1, health, plan: i % 2 ? 'pro' : 'free' }));
const FACTS = { field: 'health', type: 'number', values: HEALTH.map((b) => b.label), thresholds: HEALTH };
const control = () => ({ populate() {}, setAttribute() {}, removeAttribute() {}, addEventListener() {}, removeEventListener() {} });

async function page() {
  const source = await openSource({
    store: 'rows',
    fields: { health: { label: 'Health', type: 'number', advanced: true, thresholds: HEALTH }, plan: { label: 'Plan' } },
    scopes: { view: { label: 'View', holds: [] }, data: { label: 'Rows', holds: ['plan', 'health'] } },
  }, new ArrayStore(ROWS, { key: 'id' }));
  bindSource(source, control(), { scope: 'data' });
  return source;
}
const matching = (reading) => {
  const clause = readingClause(FACTS, reading);
  return ROWS.filter((r) => !clause || matchesFilter(r, clause)).map((r) => r.health);
};

test('its values are its bands, each offered in its status', async () => {
  const source = await page();
  assert.deepEqual(source.valuesFor('health'), ['At risk', 'Watch', 'Healthy']);
  const def = source.filterDef('health');
  assert.equal(def.kind, undefined);
  assert.deepEqual(def.thresholds, HEALTH);
  assert.deepEqual(def.options, [
    { value: 'At risk', label: 'At risk', swatch: 'critical' },
    { value: 'Watch', label: 'Watch', swatch: 'warning' },
    { value: 'Healthy', label: 'Healthy', swatch: 'success' },
  ]);
});

test('a band picked is its range; several are either; all are no filter; Not is the others', () => {
  assert.deepEqual(matching({ picked: ['At risk'] }), [55]);
  assert.deepEqual(matching({ picked: ['Watch'] }), [60, 79]);
  assert.deepEqual(matching({ picked: ['At risk', 'Healthy'] }), [55, 80, 95]);
  assert.equal(readingClause(FACTS, { picked: ['At risk', 'Watch', 'Healthy'] }), undefined);
  assert.deepEqual(matching({ picked: ['At risk'], op: 'ne' }), [60, 79, 80, 95]);
});

test('to Advanced, a band is its two ends, and the rows match what the picks did', () => {
  const rows = rowsFromPicks(undefined, { picked: ['At risk', 'Watch'] }, HEALTH);
  assert.deepEqual(rows, [
    { op: 'lt', text: '60' },
    { op: 'gte', text: '60', join: 'or' },
    { op: 'lt', text: '80', join: 'and' },
  ]);
  assert.deepEqual(matching({ conditions: rows, mode: 'advanced' }), [55, 60, 79]);
});

test('a row counts under its band', async () => {
  const source = await page();
  source.countEveryValue = true;
  await source.query.setQuery({ v: 1, scopes: { data: { holds: ['plan', 'health'], readings: { plan: { picked: ['free'] } } } } });
  const values = await source.valueResults('data');
  // Within the three free rows: 55, 79 and 95.
  assert.deepEqual(values.health, { 'At risk': 1, Watch: 1, Healthy: 1 });
});

test('a band pick is saved by its name, and read back as a pick', async () => {
  const source = await page();
  const where = source.whereOf({ health: { picked: ['At risk', 'Healthy'] } });
  assert.deepEqual(where, { health: { in: ['At risk', 'Healthy'] } });
  assert.deepEqual(source.readingsOf(where).health.picked, ['At risk', 'Healthy']);
  // A definition that names ONE band reads as its pick.
  assert.deepEqual(source.readingsOf({ health: { band: 'Watch' } }), { health: { picked: ['Watch'] } });
});
