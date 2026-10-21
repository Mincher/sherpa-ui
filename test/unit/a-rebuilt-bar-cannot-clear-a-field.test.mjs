/**
 * A REBUILT BAR CANNOT CLEAR A FIELD — 366 step 21. A bound bar's event with
 * no request asks nothing: a bar that reports while its menus are still empty
 * cannot wipe the answers it shows. The whole-answer path cleared every field
 * the report did not name.
 * TRAP T-one-query-one-owner
 *
 *   node --test test/unit/a-rebuilt-bar-cannot-clear-a-field.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, DataSource, bindSource } from '../../dist/data.js';

const ROWS = [{ id: 1, plan: 'Pro' }, { id: 2, plan: 'Free' }];

/** A bar bound to a scope: it only sends. */
class Bar extends EventTarget {
  drawScope() {}
  setAttribute() {}
  removeAttribute() {}
  toggleAttribute() {}
  populate() {}
}

test('an event with no request leaves every answer as it was', () => {
  const source = new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }) });
  source.query.hold('data', ['plan']);
  source.query.setReading('data', 'plan', { picked: ['Pro'] });
  const bar = new Bar();
  bindSource(source, bar, { steerOnly: true, scope: 'data' });
  // What a rebuilt bar said before its menus stamped: nothing in any chip.
  bar.dispatchEvent(new CustomEvent('quick-filter-change', {
    detail: { scope: 'bar', readings: {}, holds: ['plan'], values: {}, active: [] },
  }));
  assert.deepEqual(source.query.reading('data', 'plan')?.picked, ['Pro']);
});
