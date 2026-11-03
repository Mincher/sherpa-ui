/**
 * A STORE SAYS WHAT IT CAN DO, ONCE — plan 695 S4. One typed `capabilities`, said
 * by each store and carried whole over the wire; every wrapper is `wrapStore()`,
 * which forwards what it does not say — facts, optional reads, events — so none
 * drops one by hand. A wrapper that cannot keep one says so, by name.
 * TRAP T-a-store-says-what-it-can-do-once
 *
 *   node --test test/unit/a-store-says-what-it-can-do-once.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ArrayStore, HeldStore, RestStore, createDataHandler, fakeRemote, memoryOutbox, openRequestStore, statusFields, wrapStore, defineStores,
} from '../../dist/data.js';

const ROWS = [{ id: 1, seats: 4 }, { id: 2, seats: 40 }];
const HEALTH = { health: { type: 'status', values: [{ value: 'big', when: [{ seats: { gte: 10 } }] }, { value: 'small' }] } };

test('each store says its capabilities: no flag of its own beside them', () => {
  const array = new ArrayStore(ROWS, { key: 'id' });
  assert.deepEqual(array.capabilities, { reportsTotal: true, projects: true, sampled: false, rowOrder: 'insertion', announcesAll: true });
  const rest = new RestStore({ url: 'http://test/api', key: 'id', totalPath: 'total', rowOrder: 'key' });
  assert.deepEqual(rest.capabilities, { reportsTotal: true, projects: true, sampled: false, remote: true, totalFirst: true, rowOrder: 'key' });
  for (const name of ['remote', 'holds', 'projects', 'reportsTotal', 'totalFirst', 'sampled', 'rowOrder', 'announcesAll']) {
    assert.equal(name in array, false, `no ${name} beside the capabilities`);
  }
});

test('a held store says what its source can do, and that it holds', () => {
  const source = fakeRemote(new ArrayStore(ROWS, { key: 'id' }), { delay: 0 });
  const held = new HeldStore(source);
  assert.deepEqual(held.capabilities, { ...source.capabilities, holds: true });
});

test('over the wire, a store\'s capabilities arrive whole', async () => {
  const source = new RestStore({ url: 'http://test/api', key: 'id', totalPath: 'total' });
  const held = new HeldStore(source);
  const store = await openRequestStore({ name: 'people', send: createDataHandler({ stores: defineStores(() => ({ people: held })) }) });
  assert.deepEqual(store.capabilities, held.capabilities);
  assert.equal(typeof store.recheck, 'function', 'a store that holds rechecks');
  assert.equal(typeof store.take, 'function', 'and takes');
});

test('fakeRemote keeps what its store can do, and says it is remote', () => {
  const source = new RestStore({ url: 'http://test/api', key: 'id', totalPath: 'total' });
  const fake = fakeRemote(source, { delay: 0, announcesAll: false });
  assert.deepEqual(fake.capabilities, { ...source.capabilities, remote: true, announcesAll: false });
  assert.equal(fake.capabilities.totalFirst, true, 'a count that costs one row is kept');
});

test('a status wrapper keeps its store\'s holding: capabilities, state and the holder\'s doors', async () => {
  const held = new HeldStore(fakeRemote(new ArrayStore(ROWS, { key: 'id' }), { delay: 0 }), { outbox: memoryOutbox() });
  const status = statusFields(held, HEALTH);
  assert.equal(status.capabilities.holds, true);
  assert.equal(status.stale, null);
  for (const door of ['recheck', 'take', 'send', 'forget']) assert.equal(typeof status[door], 'function', door);
  assert.deepEqual((await status.load()).rows.map((r) => r.health), ['small', 'big']);
  // What a status field moves, it says it has none of: rows in place, and a History that never names it.
  assert.equal(status.scan, undefined);
  assert.equal(status.history, undefined);
});

test('wrapStore forwards what it does not say, and relays every store event', async () => {
  const inner = new HeldStore(fakeRemote(new ArrayStore(ROWS, { key: 'id' }), { delay: 0 }));
  const wrapped = wrapStore(inner, { distinct: undefined });
  assert.equal(wrapped.key, 'id');
  assert.equal(wrapped.capabilities, inner.capabilities);
  assert.equal(wrapped.distinct, undefined, 'said none, it has none');
  assert.equal((await wrapped.load()).total, 2);
  const heard = [];
  for (const type of ['change', 'waiting', 'queued', 'lost']) wrapped.addEventListener(type, (e) => heard.push([type, e.detail]));
  for (const type of ['waiting', 'queued', 'lost']) inner.dispatchEvent(new CustomEvent(type, { detail: { n: 1 } }));
  await inner.update(1, { seats: 5 });
  assert.deepEqual(heard.map(([type]) => type), ['waiting', 'queued', 'lost', 'change']);
});

test('a member set on a wrapper later is its own', async () => {
  const wrapped = wrapStore(new ArrayStore(ROWS, { key: 'id' }));
  wrapped.capabilities = { ...wrapped.capabilities, rowOrder: 'key' };
  wrapped.totalCount = async () => 99;
  assert.equal(wrapped.capabilities.rowOrder, 'key');
  assert.equal(await wrapped.totalCount(), 99);
});
