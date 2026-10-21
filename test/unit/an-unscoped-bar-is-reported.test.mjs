/**
 * AN UNSCOPED BAR IS REPORTED — 366 step 5. Every bar answers a scope of the
 * Query; a filter report from a bar bound with no scope has nowhere to go, so
 * it is reported (`bar-without-scope`) and never applied.
 * TRAP T-a-filter-report-is-the-whole-answer
 *
 *   node --test test/unit/an-unscoped-bar-is-reported.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, DataSource, bindSource, onReport } from '../../dist/data.js';

test('an unscoped bar\'s filter report is reported, never applied', async () => {
  const source = new DataSource({ store: new ArrayStore([{ id: 1, plan: 'Pro' }, { id: 2, plan: 'Free' }], { key: 'id' }) });
  const bar = Object.assign(new EventTarget(), { setAttribute() {}, removeAttribute() {}, hasAttribute: () => false });
  bindSource(source, bar, { steerOnly: true });
  const seen = [];
  const undo = onReport((r) => seen.push(r.code));
  try {
    bar.dispatchEvent(new CustomEvent('quick-filter-change', { detail: { readings: { plan: { picked: ['Pro'] } } } }));
    await source.load();
  } finally {
    undo();
  }
  assert.deepEqual(seen, ['bar-without-scope']);
  assert.equal(source.debugState().total, 2);
});
