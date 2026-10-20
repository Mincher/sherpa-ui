/**
 * A closed source no longer hears its store: a change reloads only the sources
 * still open. TRAP T-a-closed-source-hears-nothing
 *
 *   node --test test/unit/a-closed-source-hears-nothing.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, DataSource } from '../../dist/data.js';

const ROWS = [{ id: 1, tier: 'gold' }, { id: 2, tier: 'silver' }];
const tick = () => new Promise((done) => setTimeout(done, 20));

/** Count the asks a source starts — a change asks without the public `load()`. */
function counted(source) {
  const seen = { loads: 0 };
  source.addEventListener('loading', (e) => { if (e.detail.loading) seen.loads++; });
  return seen;
}

test('a change reloads only the source still open', async () => {
  const store = new ArrayStore(ROWS, { key: 'id' });
  const gone = new DataSource({ store });
  const open = new DataSource({ store });
  await Promise.all([gone.load(), open.load()]);
  gone.close();
  const a = counted(gone);
  const b = counted(open);
  await store.insert({ id: 3, tier: 'gold' });
  await tick();
  assert.deepEqual([a.loads, b.loads], [0, 1]);
  assert.equal(open.total, 3);
});

test('a closed source can still be asked', async () => {
  const store = new ArrayStore(ROWS, { key: 'id' });
  const source = new DataSource({ store });
  await source.load();
  source.close();
  await store.insert({ id: 3, tier: 'gold' });
  await source.load({ force: true });
  assert.equal(source.total, 3);
});
