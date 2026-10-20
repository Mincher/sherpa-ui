/**
 * A STORE KEEPS ITS HISTORY — 345 phase 3. Each change is numbered from ground
 * zero; an update names the fields whose values moved; an insert, a remove or a
 * changed key moves the rows; a change with no key, or an update that names no
 * field, moves everything. Every wrapper hands on the same History.
 * TRAP T-a-store-keeps-its-history
 *
 *   node --test test/unit/a-store-keeps-its-history.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ArrayStore, EventStore, JsonStore, LocalStore, RestStore, StoreHistory, changedFields, spoofRemote,
} from '../../dist/data.js';
import { cacheOf } from '../../dist/core/data/store-cache.js';

class MemoryStorage {
  #map = new Map();
  getItem(k) { return this.#map.has(k) ? this.#map.get(k) : null; }
  setItem(k, v) { this.#map.set(k, String(v)); }
  removeItem(k) { this.#map.delete(k); }
  clear() { this.#map.clear(); }
}
globalThis.localStorage ??= new MemoryStorage();

const rows = () => [
  { id: 1, name: 'Ada', tier: 'gold', seats: 10, customer: { name: 'Acme' } },
  { id: 2, name: 'Bo', tier: 'silver', seats: 20, customer: { name: 'Zeta' } },
];

test('ground zero: a new store has changed nothing', () => {
  const store = new ArrayStore(rows(), { key: 'id' });
  assert.equal(store.history.seq, 0);
  assert.equal(store.history.changedSince(0, 'all'), false);
  assert.deepEqual(store.history.since(0), { rows: false, fields: [] });
});

test('an update names only the values that moved — a form that sends every field moves one', async () => {
  const store = new ArrayStore(rows(), { key: 'id' });
  const heard = [];
  store.addEventListener('change', (e) => heard.push(e.detail.fields));
  const { customer: _own, ...row } = await store.byKey(1);
  await store.update(1, { ...row, tier: 'platinum' });
  assert.deepEqual(heard, [['tier']]);
  const at = store.history.seq;
  assert.equal(store.history.changedSince(0, ['tier']), true);
  assert.equal(store.history.changedSince(0, ['seats', 'name']), false);
  // The same value again changes nothing — and an object with the same content is the same.
  await store.update(1, { tier: 'platinum', customer: { name: 'Acme' } });
  assert.deepEqual(heard.at(-1), []);
  assert.equal(store.history.changedSince(at, ['tier', 'customer']), false);
});

test('an insert, a remove or a changed key moves the rows; setRows moves everything', async () => {
  const store = new ArrayStore(rows(), { key: 'id' });
  const h = store.history;
  await store.insert({ id: 3, name: 'Cy' });
  assert.deepEqual(h.since(0), { rows: true, fields: [] });
  let at = h.seq;
  await store.remove(3);
  assert.equal(h.changedSince(at, ['tier']), true, 'the rows count for every field');
  at = h.seq;
  await store.update(2, { id: 9 });
  assert.equal(h.since(at).rows, true);
  at = h.seq;
  store.setRows(rows());
  assert.deepEqual(h.since(at), { rows: true, fields: 'all' });
});

test('a dot path follows its top field, and a value changed in place is a change', async () => {
  const store = new ArrayStore(rows(), { key: 'id' });
  const at = store.history.seq;
  const row = await store.byKey(2);
  // The nested object is the store's own: changed in place, then sent back. Sent
  // back unchanged it counts too — the two cannot be told apart.
  row.customer.name = 'Acme';
  await store.update(2, { customer: row.customer });
  assert.equal(store.history.changedSince(at, ['customer.name']), true);
  // A number turned into the string it reads as is a change too.
  assert.deepEqual(changedFields({ seats: 10 }, { seats: '10' }), ['seats']);
});

test('a RestStore update with no old row names no field, so it moves everything', async (t) => {
  const was = globalThis.fetch;
  t.after(() => { globalThis.fetch = was; });
  globalThis.fetch = async () => new Response(null, { status: 204 });
  const store = new RestStore({ url: 'http://test/api', key: 'id' });
  await store.update(2, { tier: 'gold' });
  assert.deepEqual(store.history.since(0), { rows: true, fields: 'all' });
});

test('every wrapper hands on the same History', async (t) => {
  const inner = new ArrayStore(rows(), { key: 'id' });
  assert.equal(spoofRemote(inner, { delay: 0 }).history, inner.history);
  const live = new EventStore({ url: 'http://test/live', into: inner });
  assert.equal(live.history, inner.history);
  assert.equal(live.announcesAll, true);
  // A held set passes the store's own change on.
  const remote = spoofRemote(inner, { delay: 0 });
  const cache = cacheOf(remote);
  const heard = [];
  cache.addEventListener('change', (e) => heard.push(e.detail.change?.fields));
  await inner.update(1, { seats: 11 });
  assert.deepEqual(heard, [['seats']]);
  // A JsonStore and a LocalStore name their fields too.
  const was = globalThis.fetch;
  t.after(() => { globalThis.fetch = was; });
  globalThis.fetch = async () => new Response(JSON.stringify(rows()), { headers: { 'content-type': 'application/json' } });
  const json = new JsonStore({ url: 'http://test/rows.json', key: 'id' });
  await json.load();
  // The fetch itself landed as a whole set: everything moved.
  assert.deepEqual(json.history.since(0), { rows: true, fields: 'all' });
  const fetched = json.history.seq;
  await json.update(1, { tier: 'bronze' });
  assert.deepEqual(json.history.since(fetched), { rows: false, fields: ['tier'] });
  const local = new LocalStore({ name: 'history-test', key: 'id' });
  await local.insert({ id: 1, tier: 'gold' });
  const at = local.history.seq;
  await local.update(1, { tier: 'silver' });
  assert.deepEqual(local.history.since(at), { rows: false, fields: ['tier'] });
});

test('a History is its own: two stores keep two clocks', () => {
  const a = new StoreHistory();
  a.record({ type: 'update', key: 1, fields: ['tier'] }, 'id');
  assert.equal(a.seq, 1);
  assert.equal(new StoreHistory().seq, 0);
});
