/**
 * A BAR'S APPLY COMMITS ITS OWN FIELD — 366 step 18. On a remote store, a bar
 * that sends one field's request applies that field alone: an edit the panel
 * is still holding, unapplied, stays pending. The whole-answer path applied
 * everything. TRAP T-apply-and-discard-wait-for-a-change
 *
 *   node --test test/unit/a-bar-apply-commits-its-own-field.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, DataSource, bindSource, spoofRemote } from '../../dist/data.js';

const ROWS = [{ id: 1, plan: 'Pro', status: 'active' }, { id: 2, plan: 'Free', status: 'trial' }];

/** A bar bound to a scope: it only sends. */
class Bar extends EventTarget {
  drawScope() {}
  setAttribute() {}
  removeAttribute() {}
  toggleAttribute() {}
  populate() {}
}

test('a bar request for status applies status, and the panel\'s plan stays pending', () => {
  const source = new DataSource({ store: spoofRemote(new ArrayStore(ROWS, { key: 'id' }), { delay: 0 }) });
  source.query.hold('data', ['plan', 'status']);
  // The panel's edit, not yet applied.
  source.query.setReading('data', 'plan', { picked: ['Pro'] });
  assert.equal(source.query.pending('plan'), true);
  const bar = new Bar();
  bindSource(source, bar, { steerOnly: true, scope: 'data' });
  bar.dispatchEvent(new CustomEvent('quick-filter-change', {
    detail: { request: { field: 'status', reading: { picked: ['trial'] }, commit: true } },
  }));
  assert.deepEqual(source.query.applied.scopes.data?.readings.status?.picked, ['trial'], 'the bar applied its own field');
  assert.equal(source.query.pending('plan'), true, 'and left the panel\'s waiting');
});
