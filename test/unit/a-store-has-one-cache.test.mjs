/**
 * A remote store has ONE held set, shared by every page over it: one whole
 * read, each change taken once, and the set kept when a page closes.
 * TRAP T-a-store-has-one-cache
 *
 *   node --test test/unit/a-store-has-one-cache.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, DataSource, spoofRemote } from '../../dist/data.js';

const ROWS = Array.from({ length: 6 }, (_, i) => ({ id: i + 1, tier: i % 2 ? 'gold' : 'silver' }));
const tick = () => new Promise((done) => setTimeout(done, 20));

/** A remote store over a counted ArrayStore: `whole` counts the whole reads. */
function remote(options = {}) {
  const inner = new ArrayStore(ROWS.map((r) => ({ ...r })), { key: 'id' });
  const load = inner.load.bind(inner);
  const seen = { loads: 0, whole: 0 };
  inner.load = (o = {}) => { seen.loads++; if (o.take > ROWS.length + 50) seen.whole++; return load(o); };
  return { inner, store: spoofRemote(inner, { delay: 0, ...options }), seen };
}

const open = async (store, holdRows) => {
  const source = new DataSource({ store, ...(holdRows ? { holdRows } : {}) });
  await source.load();
  return source;
};

test('two pages over one store make ONE whole read', async () => {
  const { store, seen } = remote();
  const [a, b] = await Promise.all([open(store), open(store)]);
  assert.equal(seen.whole, 1);
  assert.equal(seen.loads, 1);
  assert.deepEqual([a.total, b.total], [6, 6]);
});

test('a change it cannot take is read again ONCE for every open page', async () => {
  const { store, seen } = remote();
  const [a, b] = await Promise.all([open(store), open(store)]);
  seen.loads = 0;
  store.dispatchEvent(new CustomEvent('change', { detail: { type: 'update' } }));
  await tick();
  assert.equal(seen.loads, 1);
  assert.deepEqual([a.total, b.total], [6, 6]);
});

test('a keyed insert is taken once, and every page shows it', async () => {
  const { store, seen } = remote();
  const [a, b] = await Promise.all([open(store), open(store)]);
  seen.loads = 0;
  await store.insert({ id: 7, tier: 'gold' });
  await tick();
  assert.equal(seen.loads, 0);
  assert.deepEqual([a.total, b.total], [7, 7]);
});

test('a page opened again asks nothing, and sees a change made while none was open', async () => {
  const { store, seen } = remote();
  const first = await open(store);
  first.close();
  await store.insert({ id: 7, tier: 'gold' });
  seen.loads = 0;
  const again = await open(store);
  assert.equal(seen.loads, 0);
  assert.equal(again.total, 7);
});

test('a store that may miss a writer is read again before a page trusts the set', async () => {
  const { store, seen } = remote({ announcesAll: false });
  (await open(store)).close();
  seen.whole = 0;
  await open(store);
  assert.equal(seen.whole, 1);
});

test('a closed page\'s Refresh leaves the shared set as it is', async () => {
  const { store, seen } = remote();
  const gone = await open(store);
  const kept = await open(store);
  gone.close();
  seen.loads = 0;
  seen.whole = 0;
  await gone.load({ force: true });
  await kept.load({ force: false });
  assert.equal(kept.total, 6);
  // The closed page asked the store itself; the open one asked nothing.
  assert.equal(seen.whole, 0);
});

test('a page with a smaller cap asks the store, and the set stays for the others', async () => {
  const { store, seen } = remote();
  const big = await open(store);
  seen.loads = 0;
  const small = await open(store, 3);
  assert.ok(seen.loads > 0);
  assert.equal(seen.whole, 1);
  assert.deepEqual([small.total, big.total], [6, 6]);
  seen.loads = 0;
  await big.load({ force: false });
  assert.equal(seen.loads, 0);
});

test('what a chip counts moves with the shared set', async () => {
  const { store } = remote();
  const source = new DataSource({ store });
  source.declareValues('tier', ['gold', 'silver']);
  source.declareScope('data', { label: 'Records' });
  source.offer('data', ['tier']);
  source.hold('data', ['tier']);
  source.answer('data', { tier: { picked: ['gold'] } });
  source.commit?.();
  await source.load();
  assert.deepEqual(await source.results('data'), { tier: 3 });
  await store.insert({ id: 7, tier: 'gold' });
  await tick();
  assert.deepEqual(await source.results('data'), { tier: 4 });
});
