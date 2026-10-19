/**
 * A remote source's held set takes a keyed store change in place, exactly as
 * a whole read would hold it: a save costs no whole read. Anything it is not
 * certain of is read again. TRAP T-a-held-set-takes-a-change-in-place
 *
 *   node --test test/unit/a-held-set-takes-a-change-in-place.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, DataSource, RestStore, rowKey, spoofRemote } from '../../dist/data.js';

const ROWS = [{ id: 1, tier: 'gold', owner: 'Ann' }, { id: 2, tier: 'silver', owner: 'Bob' }, { id: 3, tier: 'gold', owner: 'Cy' }];
const tick = () => new Promise((done) => setTimeout(done, 20));

/** A source over a remote store, held, and the inner store's loads counted. */
async function held(options = {}) {
  const inner = new ArrayStore(ROWS.map((r) => ({ ...r })), { key: 'id', ...options });
  const load = inner.load.bind(inner);
  const seen = { loads: 0 };
  inner.load = (o) => { seen.loads++; return load(o); };
  const store = spoofRemote(inner, { delay: 0 });
  const source = new DataSource({ store });
  await source.load();
  seen.loads = 0;
  return { inner, store, source, seen };
}

const ids = (source) => source.rows.map((r) => r.id);
const say = (store, detail) => store.dispatchEvent(new CustomEvent('change', { detail }));

test('an insert, an update and a remove read nothing again', async () => {
  const { store, source, seen } = await held();
  await store.insert({ id: 4, tier: 'bronze', owner: 'Di' });
  await tick();
  await store.update(2, { tier: 'gold' });
  await tick();
  await store.remove(1);
  await tick();
  assert.equal(seen.loads, 0);
  assert.deepEqual(ids(source), [2, 3, 4]);
  assert.equal(source.rows.find((r) => r.id === 2).tier, 'gold');
});

test('a held row goes by its own key, as a whole read keys it', async () => {
  const { store, source, seen } = await held();
  say(store, { type: 'insert', key: 4, row: { id: 4, tier: 'bronze', owner: 'Di' } });
  await tick();
  await store.update(1, { id: 10 });
  await tick();
  assert.equal(seen.loads, 0);
  assert.deepEqual(ids(source), [10, 2, 3, 4]);
  assert.deepEqual(source.rows.map((r) => rowKey(r)), ['10', '2', '3', '4']);
});

test("an update's row is the whole row: a field it leaves out is gone", async () => {
  const { store, source, seen } = await held();
  say(store, { type: 'update', key: 2, row: { id: 2, tier: 'gold' } });
  await tick();
  assert.equal(seen.loads, 0);
  assert.deepEqual(source.rows.find((r) => r.id === 2), { id: 2, tier: 'gold' });
});

test('a row without its key — an envelope, a fragment — is read again', async () => {
  const { store, seen } = await held();
  say(store, { type: 'update', key: 2, row: { tier: 'gold' } });
  await tick();
  assert.equal(seen.loads, 1);
});

test('the rows a cap trims with an insert leave the held set too', async () => {
  const { store, source, seen } = await held({ maxRows: 3 });
  await store.insert({ id: 4, tier: 'bronze', owner: 'Di' });
  await tick();
  assert.equal(seen.loads, 0);
  assert.deepEqual(ids(source), [2, 3, 4]);
});

test("a new row goes where the store's whole read puts it — or, unsaid, is read again", async () => {
  const keyed = await held();
  keyed.store.rowOrder = 'key';
  say(keyed.store, { type: 'insert', key: 0, row: { id: 0, tier: 'gold', owner: 'Al' } });
  await tick();
  assert.deepEqual([keyed.seen.loads, ...ids(keyed.source)], [0, 0, 1, 2, 3]);
  say(keyed.store, { type: 'update', key: 0, row: { id: 5, tier: 'gold', owner: 'Al' } });
  await tick();
  assert.deepEqual([keyed.seen.loads, ...ids(keyed.source)], [0, 1, 2, 3, 5]);

  const unsaid = await held();
  unsaid.store.rowOrder = undefined;
  say(unsaid.store, { type: 'insert', key: 0, row: { id: 0, tier: 'gold', owner: 'Al' } });
  await tick();
  assert.equal(unsaid.seen.loads, 1);
});

test('a change it cannot place is read again: no key, or a row it does not hold', async () => {
  const { store, source, seen } = await held();
  say(store, { type: 'update' });
  await tick();
  assert.equal(seen.loads, 1);
  say(store, { type: 'remove', key: 99 });
  await tick();
  assert.equal(seen.loads, 2);
  assert.deepEqual(ids(source), [1, 2, 3]);
});

test('a key another row already has is read again', async () => {
  const { store, seen } = await held();
  say(store, { type: 'update', key: 1, row: { id: 2 } });
  await tick();
  assert.equal(seen.loads, 1);
});

test('a RestStore with no reply announces no row, so the set is read again', async (t) => {
  const was = globalThis.fetch;
  t.after(() => { globalThis.fetch = was; });
  let gets = 0;
  globalThis.fetch = async (url, init = {}) => {
    if ((init.method ?? 'GET') === 'GET') {
      gets++;
      return new Response(JSON.stringify({ data: ROWS, total: ROWS.length }), { headers: { 'content-type': 'application/json' } });
    }
    return new Response(null, { status: 204 });
  };
  const store = new RestStore({ url: 'http://test/api', key: 'id', rowsPath: 'data', totalPath: 'total', rowOrder: 'insertion' });
  const changes = [];
  store.addEventListener('change', (e) => changes.push(e.detail));
  const source = new DataSource({ store });
  await source.load();
  gets = 0;
  await store.update(2, { tier: 'gold' });
  await tick();
  assert.deepEqual(changes, [{ type: 'update', key: 2 }]);
  assert.equal(gets, 1);
});
