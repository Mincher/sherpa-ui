/**
 * A bar's report says which saved filters are ON. Their readings are the
 * SOURCE's library: a report never rewrites one, and only teaches the source a
 * saved filter it has never heard of. TRAP T-one-query-one-owner
 *
 *   node --test test/unit/a-bar-report-never-rewrites-a-saved-filter.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, DataSource } from '../../dist/data.js';

const ROWS = [{ id: 1, tier: 'gold' }, { id: 2, tier: 'silver' }, { id: 3, tier: 'gold' }];

test('a report turns a saved filter on, and leaves its readings as the source declared them', async () => {
  const source = new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }) });
  source.declareField('tier', { label: 'Tier' });
  source.declareScope('data', { label: 'Rows' });
  source.declarePreset('gold', { tier: { picked: ['gold'] } }, { label: 'Gold' });
  // A stale echo: the bar's copy says silver.
  source.answerScope('data', { readings: {}, presets: { gold: { on: true, readings: { tier: { picked: ['silver'] } } } } });
  await source.load();
  assert.deepEqual(source.export().presets, { gold: { label: 'Gold', readings: { tier: { picked: ['gold'] } } } });
  assert.equal(source.debugState().total, 2);
});

test('a saved filter the source has never heard of is learned from the report', async () => {
  const source = new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }) });
  source.declareField('tier', { label: 'Tier' });
  source.declareScope('data', { label: 'Rows' });
  source.answerScope('data', { readings: {}, presets: { mine: { on: true, readings: { tier: { picked: ['silver'] } } } } });
  await source.load();
  assert.deepEqual(source.export().presets, { mine: { readings: { tier: { picked: ['silver'] } } } });
  assert.equal(source.debugState().total, 1);
});
