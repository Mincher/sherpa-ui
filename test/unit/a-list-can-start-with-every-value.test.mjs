/**
 * A LIST CAN START WITH EVERY VALUE — Will, TODO 489 (B). `start: 'all'` opens
 * a View list on ALL: every value ticked, whichever come — on, and its face says
 * All. ALL IS EVERY VALUE PICKED, NOT NO FILTER (Will, 2026-11-13): it filters by
 * "has a value", so a row with no value does not pass.
 *
 *   node --test test/unit/a-list-can-start-with-every-value.test.mjs
 *
 * TRAP T-a-fetching-list-opens-on-its-first-value · TRAP T-all-is-an-answer
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, openSource } from '../../dist/data.js';
import { fieldState, stateClause } from '../../dist/core/data/filter-state.js';
import { readingsOf, whereOf } from '../../dist/core/data/where.js';
import { filterFace } from '../../dist/core/data/filter-face.js';

const ROWS = [
  { id: 1, region: 'EMEA', status: 'open' }, { id: 2, region: 'AMER', status: 'shut' },
  { id: 3, region: 'APAC', status: 'open' },
  // No region: no filter lets these through, every region picked does not.
  { id: 4, status: 'open' }, { id: 5, region: '', status: 'open' }, { id: 6, region: null, status: 'open' },
];

test('start all ticks every value and filters by "has a value"; the default starts on the first', async () => {
  const store = new ArrayStore(ROWS, { key: 'id' });
  const source = await openSource({
    store: 'rows',
    fields: { region: { label: 'Region', start: 'all', fetch: 'server' }, status: { label: 'Status' } },
    scopes: { view: { label: 'View', holds: ['region', 'status'] } },
  }, store);
  await source.load();
  const readings = source.query.applied.scopes.view.readings;
  assert.deepEqual(readings.region, { picked: [], all: true });
  assert.deepEqual(readings.status, { picked: ['open'] });
  // Region is on, every value of it; Status, its first value, too.
  const { selections } = source.debugState();
  assert.equal(selections.region.fieldState, 'active');
  assert.equal(selections.status.fieldState, 'active');
});

test('all ticks every value, filters by "has a value", says All, and keeps through the plain form as all', async () => {
  const facts = { field: 'region', label: 'Region', values: ['EMEA', 'AMER'] };
  const all = fieldState(facts, { picked: [], all: true });
  assert.deepEqual(all.values.map((v) => v.state), ['picked', 'picked']);
  assert.equal(all.fieldState, 'active');
  // Every region, any region: the three rows with none do not pass. One short clause, however many values.
  const { rows } = await new ArrayStore(ROWS, { key: 'id' }).load({ filter: stateClause(all) });
  assert.deepEqual(rows.map((r) => r.id), [1, 2, 3]);
  assert.equal(filterFace(all).value, 'All');
  // A list ticked by hand says its values, every one or one.
  assert.equal(filterFace(fieldState(facts, { picked: ['EMEA', 'AMER'] })).value, 'EMEA…');
  assert.equal(filterFace(fieldState(facts, { picked: ['EMEA'] })).value, 'EMEA');
  // The plain form keeps all as itself, never as its clause, so a View saved on it stays on it.
  assert.deepEqual(whereOf({ region: { picked: [], all: true } }, () => ({ values: facts.values })), { region: { all: true } });
  assert.deepEqual(whereOf({ region: { picked: [], all: true, suspended: true } }, () => ({ values: facts.values })), { region: { all: true, off: true } });
  assert.deepEqual(readingsOf({ region: { all: true } }), { region: { picked: [], all: true } });
});

test('a start filters the FIRST load: a first value, and All as "has a value" (TODO 403, 489)', async () => {
  const open = (region) => openSource({
    store: 'rows', fields: { region: { label: 'Region', ...region } }, scopes: { view: { label: 'View', holds: ['region'] } },
  }, new ArrayStore(ROWS, { key: 'id' }));
  // The first value: AMER, sorted, one row.
  const first = await open({});
  await first.load();
  assert.deepEqual(first.debugState().filter, ['region', 'eq', 'AMER']);
  assert.equal(first.debugState().total, 1);
  // All: the three rows with a region, not the three with none.
  const all = await open({ start: 'all' });
  await all.load();
  assert.deepEqual(all.debugState().filter, ['region', 'notin', [null, '']]);
  assert.equal(all.debugState().total, 3);
});
