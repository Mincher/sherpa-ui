/**
 * A THRESHOLD IS A FACT OF THE FIELD — Will, TODO 150. A number's bands are
 * declared once, beside its min and max; a saved filter names one, and a
 * histogram cuts at them.
 *
 *   node --test test/unit/a-threshold-is-a-fact-of-the-field.test.mjs
 *
 * TRAP T-a-threshold-is-a-fact-of-the-field
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, DataSource, bandCondition, bandEdges } from '../../dist/data.js';
import { summarise } from '../../dist/core/data/aggregate.js';
import { onReport } from '../../dist/core/data/report.js';

const HEALTH = [
  { to: 60, label: 'At risk', status: 'critical' },
  { to: 80, label: 'Watch', status: 'warning' },
  { to: 100, label: 'Healthy', status: 'success' },
];

test('a band is half-open: the first has no floor, the last no top', () => {
  assert.deepEqual(bandCondition(HEALTH, 'At risk'), { lt: 60 });
  assert.deepEqual(bandCondition(HEALTH, 'Watch'), { gte: 60, lt: 80 });
  assert.deepEqual(bandCondition(HEALTH, 'Healthy'), { gte: 80 });
  assert.equal(bandCondition(HEALTH, 'Lost'), undefined);
  assert.deepEqual(bandEdges(HEALTH, 0), [0, 60, 80, 100]);
});

test('a saved filter names a band, and filters by what the field declares', async () => {
  const rows = [55, 60, 79, 80, 95].map((health, i) => ({ id: i + 1, health }));
  const source = new DataSource({ store: new ArrayStore(rows, { key: 'id' }) });
  source.declareField('health', { type: 'number', min: 0, max: 100, thresholds: HEALTH });
  source.select('health', [], source.readingsOf({ health: { band: 'Watch' } }).health);
  await source.load();
  assert.equal(source.debugState().total, 2);
  const heard = [];
  const undo = onReport((r) => heard.push(r.code));
  assert.deepEqual(source.readingsOf({ health: { band: 'Lost' } }), {});
  undo();
  assert.deepEqual(heard, ['unknown-band']);
});

test('a histogram cut at the bands is named by them', () => {
  const rows = [10, 59, 60, 85, 100].map((storage) => ({ storage }));
  const cut = summarise(rows, {
    shape: 'segments', segment: 'storage', bands: bandEdges(HEALTH, 0), bandLabels: HEALTH.map((t) => t.label),
  });
  assert.deepEqual(cut.map((d) => [d.label, d.value]), [['At risk', 2], ['Watch', 1], ['Healthy', 2]]);
});
