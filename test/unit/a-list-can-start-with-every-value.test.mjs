/**
 * A LIST CAN START WITH EVERY VALUE — Will, TODO 489 (B). `start: 'all'` opens
 * a View list on ALL: every value ticked, whichever come — on, no filter, and its
 * face says All. All asks a server field's store for nothing.
 *
 *   node --test test/unit/a-list-can-start-with-every-value.test.mjs
 *
 * TRAP T-a-fetching-list-opens-on-its-first-value · TRAP T-all-is-an-answer
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, openSource } from '../../dist/data.js';
import { fieldState } from '../../dist/core/data/filter-state.js';
import { readingsOf, whereOf } from '../../dist/core/data/where.js';
import { filterFace } from '../../dist/core/data/filter-face.js';

const ROWS = [
  { id: 1, region: 'EMEA', status: 'open' }, { id: 2, region: 'AMER', status: 'shut' },
  { id: 3, region: 'APAC', status: 'open' },
];

test('start all ticks every value and filters nothing; the default starts on the first', async () => {
  const store = new ArrayStore(ROWS, { key: 'id' });
  const loads = [];
  const load = store.load.bind(store);
  store.load = (options = {}) => { loads.push(options); return load(options); };
  const source = await openSource({
    store: 'rows',
    fields: { region: { label: 'Region', start: 'all', fetch: 'server' }, status: { label: 'Status' } },
    scopes: { view: { label: 'View', holds: ['region', 'status'] } },
  }, store);
  await source.load();
  const readings = source.query.applied.scopes.view.readings;
  assert.deepEqual(readings.region, { picked: [], all: true });
  assert.deepEqual(readings.status, { picked: ['open'] });
  // Region narrows nothing; Status, its first value, does.
  const { selections } = source.debugState();
  assert.equal(selections.region.fieldState, 'off');
  assert.equal(selections.status.fieldState, 'active');
  // No read filters by Region: every value ticked is no question for its store.
  assert.ok(loads.every((o) => !JSON.stringify(o.filter ?? null).includes('region')));
});

test('all ticks every value, filters nothing, says All, and keeps through the plain form', () => {
  const facts = { field: 'region', label: 'Region', values: ['EMEA', 'AMER'] };
  const all = fieldState(facts, { picked: [], all: true });
  assert.deepEqual(all.values.map((v) => v.state), ['picked', 'picked']);
  assert.equal(all.answer, undefined);
  assert.equal(filterFace(all).value, 'All');
  // A list ticked by hand says its values, every one or one.
  assert.equal(filterFace(fieldState(facts, { picked: ['EMEA', 'AMER'] })).value, 'EMEA…');
  assert.equal(filterFace(fieldState(facts, { picked: ['EMEA'] })).value, 'EMEA');
  // The plain form says what filters: all says nothing; a definition may still write it.
  assert.deepEqual(whereOf({ region: { picked: [], all: true } }, () => ({ values: facts.values })), {});
  assert.deepEqual(readingsOf({ region: { all: true } }), { region: { picked: [], all: true } });
});
