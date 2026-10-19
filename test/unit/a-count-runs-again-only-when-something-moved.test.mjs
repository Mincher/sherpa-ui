/**
 * A chip's count runs again only when something it reads moved — the Query,
 * the rows, a saved filter — never for a sort, a page or a search. TODO 348 W1
 * TRAP T-a-chip-counts-its-own-results
 *
 *   node --test test/unit/a-count-runs-again-only-when-something-moved.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, DataSource, bindSource } from '../../dist/data.js';

const ROWS = [
  { id: 1, name: 'b', status: 'active' }, { id: 2, name: 'a', status: 'active' }, { id: 3, name: 'c', status: 'trial' },
];
const tick = () => new Promise((done) => setTimeout(done, 20));

async function setup() {
  const store = new ArrayStore(ROWS.map((r) => ({ ...r })), { key: 'id' });
  const source = new DataSource({ store, pageSize: 2 });
  source.declareValues('status', ['active', 'trial']);
  source.declareScope('data', { label: 'Records' });
  source.offer('data', ['status']);
  source.hold('data', ['status']);
  const drawn = [];
  const bar = Object.assign(new EventTarget(), {
    id: 'bar', setAttribute() {}, removeAttribute() {}, hasAttribute: () => false,
    drawScope() {}, drawReading() {}, drawResults: (results, scope) => drawn.push([scope, results]),
  });
  bindSource(source, bar, { steerOnly: true, scope: 'data' });
  source.answer('data', { status: { picked: ['active'] } });
  await source.load();
  await tick();
  return { store, source, drawn };
}

test('a sort, a page and a search count nothing again', async () => {
  const { source, drawn } = await setup();
  const before = drawn.length;
  assert.ok(before > 0);
  source.setSort('name');
  await tick();
  source.setPage(2);
  await tick();
  source.setSearch?.('a');
  await tick();
  assert.equal(drawn.length, before);
});

test('a change to the rows counts again, though the Query is the same', async () => {
  const { store, drawn } = await setup();
  const before = drawn.length;
  assert.deepEqual(drawn.at(-1), ['data', { status: 2 }]);
  await store.insert({ id: 4, name: 'd', status: 'active' });
  await tick();
  assert.ok(drawn.length > before);
  assert.deepEqual(drawn.at(-1), ['data', { status: 3 }]);
});

test('a saved filter whose readings change counts again', async () => {
  const { source, drawn } = await setup();
  source.declarePreset('trials', { status: { picked: ['trial'] } }, { label: 'Trials' });
  source.answer('data', { status: { picked: ['active'] } }, { trials: true });
  await tick();
  const was = drawn.at(-1)[1].trials;
  // The Query is the same — `trials` is on — but what the saved filter reads is not.
  source.declarePreset('trials', { status: { picked: ['active', 'trial'] } }, { label: 'Trials' });
  await tick();
  assert.notEqual(drawn.at(-1)[1].trials, was);
});
