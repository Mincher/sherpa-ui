/**
 * A REMOTE STORE IS READ THROUGH A HELD STORE — plan 695 S4. One rule, `heldOf`: a
 * source over a remote store reads it through a HeldStore it makes — a worker's
 * store already holds, and a page that holds no rows asks the store. The source
 * holds nothing itself, and its HeldStore goes with it.
 * TRAP T-a-remote-store-is-read-through-a-held-store
 *
 *   node --test test/unit/a-remote-store-is-read-through-a-held-store.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ArrayStore, DataSource, HeldStore, fakeRemote, heldOf } from '../../dist/data.js';
import { cacheOf } from '../../dist/core/data/store-cache.js';

const ROWS = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, team: i % 3 ? 'core' : 'ops' }));
const tick = (ms = 0) => new Promise((done) => setTimeout(done, ms));

/** A remote store, its whole reads counted. */
function remote() {
  const inner = new ArrayStore(ROWS.map((r) => ({ ...r })), { key: 'id' });
  const store = fakeRemote(inner, { delay: 0 });
  const reads = { whole: 0 };
  const load = store.load.bind(store);
  store.load = (o = {}) => {
    if (!o.filter && o.skip === undefined) reads.whole++;
    return load(o);
  };
  return { inner, store, reads };
}

test('the one rule: a remote store gets a HeldStore; a local one, one that holds, or no rows held, none', () => {
  const { store } = remote();
  assert.ok(heldOf(store) instanceof HeldStore);
  assert.equal(heldOf(new ArrayStore(ROWS, { key: 'id' })), null, 'a local store is read as it is');
  assert.equal(heldOf(new HeldStore(store)), null, 'a store that holds is read as it is');
  assert.equal(heldOf(store, { cap: 0 }), null, 'a page that holds no rows asks the store');
});

test('a source over a remote store answers from the HeldStore it reads through: one whole read for every question', async () => {
  const { store, reads } = remote();
  const source = new DataSource({ store, pageSize: 5 });
  await source.load();
  source.query.ask({ page: 2 });
  await source.load();
  assert.equal(source.debugState().held.rows, 12);
  assert.equal(source.debugState().plan, 'held');
  assert.equal(reads.whole, 1);
  assert.equal(source.store, store, 'its store is the one it was given: a write goes there');
});

test('a write to the store reaches the source through its held set', async () => {
  const { store } = remote();
  const source = new DataSource({ store });
  await source.load();
  await store.update(1, { team: 'core' });
  await tick(5);
  assert.equal(source.rows.find((r) => r.id === 1).team, 'core');
});

test('its HeldStore goes with it: closed, it hears nothing, and the shared set stays for the next page', async () => {
  const { store, reads } = remote();
  const one = new DataSource({ store });
  await one.load();
  one.close();
  let asked = 0;
  one.addEventListener('loading', () => asked++);
  await store.update(2, { team: 'ops' });
  await tick(5);
  assert.equal(asked, 0, 'a closed source asks nothing');
  const two = new DataSource({ store });
  await two.load();
  assert.equal(reads.whole, 1, 'the next page reads no whole set again');
  assert.equal(cacheOf(store).set.size, 12);
});

test('a source over a store that holds its own set makes none, and walks that set in place', async () => {
  const { store } = remote();
  const held = new HeldStore(store);
  const source = new DataSource({ store: held });
  await source.load();
  assert.equal(source.debugState().held, undefined, 'no set of its own');
  assert.equal(typeof held.scan, 'function', 'its set is read in place');
});
