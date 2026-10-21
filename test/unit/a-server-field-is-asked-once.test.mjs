/**
 * A SERVER FIELD IS ASKED ONCE PER ANSWER — 345 phase 6. A field marked
 * `fetch: 'server'` is answered by the store: its Apply asks once for the keys
 * it matches, and the source filters what it holds by them. Off and on again
 * ask nothing; a new answer asks again.
 * TRAP T-a-server-field-is-asked-once-per-answer
 *
 *   node --test test/unit/a-server-field-is-asked-once.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, DataSource, spoofRemote } from '../../dist/data.js';

const ROWS = Array.from({ length: 10 }, (_, i) => ({ id: i + 1, seats: (i + 1) * 10 }));
const settle = () => new Promise((r) => setTimeout(r, 10));

test('Apply asks the store once for the keys; off and on ask nothing; a new answer asks again', async () => {
  const inner = new ArrayStore(ROWS, { key: 'id' });
  const asked = [];
  const load = inner.load.bind(inner);
  inner.load = (o) => { asked.push(o?.filter ?? null); return load(o); };
  const source = new DataSource({ store: spoofRemote(inner, { delay: 0 }) });
  source.declareField('seats', { type: 'number', fetch: 'server' });
  assert.equal(source.filterDef('seats').commit, true, 'its menus have Apply');
  await source.load();
  const before = asked.length;
  source.query.hold('data', ['seats']);
  source.query.setReading('data', 'seats', { mode: 'advanced', conditions: [{ op: 'gt', text: '70' }] });
  source.query.commit({ field: 'seats' });
  await settle();
  await source.load();
  assert.deepEqual(asked.slice(before), [['seats', 'gt', 70]], 'one ask, for its own clause');
  assert.deepEqual(source.rows.map((r) => r.id), [8, 9, 10]);
  source.query.suspend('data', 'seats', true);
  source.query.commit({ field: 'seats' });
  await settle();
  source.query.suspend('data', 'seats', false);
  source.query.commit({ field: 'seats' });
  await settle();
  await source.load();
  assert.equal(asked.length, before + 1, 'off and on again: no ask');
  assert.deepEqual(source.rows.map((r) => r.id), [8, 9, 10]);
  source.query.setReading('data', 'seats', { mode: 'advanced', conditions: [{ op: 'gt', text: '90' }] });
  source.query.commit({ field: 'seats' });
  await settle();
  await source.load();
  assert.equal(asked.length, before + 2, 'a new answer asks again');
  assert.deepEqual(source.rows.map((r) => r.id), [10]);
});
