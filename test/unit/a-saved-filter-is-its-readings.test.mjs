/**
 * A SAVED FILTER IS ITS READINGS — and a bound source applies it as one part.
 *
 * Will, 2026-09-25: presets "are actually compound conditional filters that
 * (potentially) use more than 1 field". A def carries its answer field by
 * field; the bar reports the ON ones in `savedReadings`; the source applies
 * each as a named part, and drops the part when the chip goes off.
 *
 *   node --test test/unit/a-saved-filter-is-its-readings.test.mjs
 *
 * TRAP T-a-saved-filter-is-its-readings
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, DataSource } from '../../dist/data.js';
import { kindOf } from '../../dist/core/ui/filter-kind.js';

/** A bar with nothing but what a source asks of it. */
class Bar extends EventTarget {
  saved = {};
  get readings() { return {}; }
  get savedReadings() { return this.saved; }
  setAttribute() {}
  removeAttribute() {}
  toggleAttribute() {}
  populate() {}
  report() { this.dispatchEvent(new CustomEvent('quick-filter-change', { detail: {} })); }
}

const ROWS = [
  { id: 1, health: 40, owner: 'Unassigned' },
  { id: 2, health: 80, owner: 'Dana' },
  { id: 3, health: 55, owner: 'Dana' },
];

test('a def that carries its readings is a custom kind', () => {
  assert.equal(kindOf({ id: 'at-risk', readings: { health: { op: 'lt', text: '60' } } }), 'custom');
  // A NAMED kind is still believed first.
  assert.equal(kindOf({ id: 'x', kind: 'boolean', readings: {} }), 'boolean');
});

test('each ON saved filter is one named part, over any fields; off drops it', async () => {
  const source = new DataSource({ store: new ArrayStore(ROWS) });
  source.declareField('health', { type: 'number' });
  const bar = new Bar();
  source.bind(bar, { steerOnly: true });

  bar.saved = {
    'at-risk': { health: { op: 'lt', text: '60' } },
    unowned: { owner: { op: 'eq', picked: ['Unassigned'] } },
  };
  bar.report();
  await source.load();
  // The number is CAST: the data layer compiles a reading with its field's type.
  assert.deepEqual(source.debugState().parts, {
    'saved:at-risk': ['health', 'lt', 60],
    'saved:unowned': ['owner', 'eq', 'Unassigned'],
  });
  assert.equal(source.debugState().total, 1);

  bar.saved = { 'at-risk': { health: { op: 'lt', text: '60' } } };
  bar.report();
  await source.load();
  assert.deepEqual(Object.keys(source.debugState().parts), ['saved:at-risk']);
  assert.equal(source.debugState().total, 2);

  bar.saved = {};
  bar.report();
  await source.load();
  assert.deepEqual(source.debugState().parts, {});
  assert.equal(source.debugState().total, 3);
});
