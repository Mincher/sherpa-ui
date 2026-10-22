/**
 * NONE CLEARS A SORT — TODO 407. A Sort chip's None reports `clear`, and the
 * binding forgets the sort: nothing is kept to resume, as a suspend keeps it.
 *
 *   node --test test/unit/none-clears-a-sort.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, DataSource, bindSource } from '../../dist/data.js';

class Bar extends EventTarget {
  drawScope() {}
  setAttribute() {}
  removeAttribute() {}
  toggleAttribute() {}
  populate() {}
}

test('a sort-change with clear forgets the sort; without it, the sort is suspended', () => {
  const source = new DataSource({ store: new ArrayStore([{ id: 1, name: 'A' }], { key: 'id' }) });
  const bar = new Bar();
  bindSource(source, bar, { steerOnly: true, scope: 'data' });
  const send = (detail) => bar.dispatchEvent(new CustomEvent('sort-change', { detail }));
  send({ field: 'name', direction: 'desc' });
  send({ field: null, direction: 'asc' });
  assert.deepEqual(source.debugState().query.scopes.data?.sortSuspended, { field: 'name', direction: 'desc' }, 'off keeps it');
  send({ field: 'name', direction: 'asc' });
  send({ field: null, direction: 'asc', clear: true });
  const scopes = source.debugState().query.scopes;
  assert.equal(Object.values(scopes).some((s) => s.sort?.length || s.sortSuspended), false, 'None forgets it');
});
