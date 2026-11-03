/**
 * A FIELD THAT CANNOT FETCH SAYS SO — TODO 411. When a field's own read fails —
 * its values — the source tells every control over its scope, as `data-failed`,
 * a field list; the next read that succeeds takes it off. No rows is not a
 * failure.
 *
 *   node --test test/unit/a-field-that-cannot-fetch-says-so.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, DataSource, bindSource, fakeRemote } from '../../dist/data.js';

const ROWS = [{ id: 1, region: 'EU' }, { id: 2, region: 'US' }];

/** A bar bound to a scope: it records the attributes it is given. */
class Bar extends EventTarget {
  attrs = {};
  setAttribute(name, value) { this.attrs[name] = value; }
  removeAttribute(name) { delete this.attrs[name]; }
  toggleAttribute() {}
  drawScope() {}
  populate() {}
}

test('a failed values read marks its field; the next good one clears it', async () => {
  let down = true;
  const store = fakeRemote(new ArrayStore(ROWS, { key: 'id' }), { delay: 0, fail: () => (down ? 1 : 0) });
  const source = new DataSource({ store, autoLoad: false });
  source.query.ask({ scope: 'data', hold: ['region'] });
  const bar = new Bar();
  bindSource(source, bar, { steerOnly: true, scope: 'data' });
  await source.declareFromRows(['region']);
  assert.equal(bar.attrs['data-failed'], 'region', 'its read failed');
  down = false;
  await source.declareFromRows(['region']);
  assert.equal(bar.attrs['data-failed'], undefined, 'and read again');
});

test('a field whose values read, but match nothing, is not failed', async () => {
  const source = new DataSource({ store: new ArrayStore([], { key: 'id' }) });
  source.query.ask({ scope: 'data', hold: ['region'] });
  const bar = new Bar();
  bindSource(source, bar, { steerOnly: true, scope: 'data' });
  await source.declareFromRows(['region']);
  assert.equal(bar.attrs['data-failed'], undefined);
});
