/**
 * EVERY TAB HEARS A CHANGE — plan 652 S6. The worker says each store's change on
 * one BroadcastChannel; each tab's RequestStore says it to its page, its own
 * writes among them, once — until its owner closes it. A worker scope is faked
 * here: Node has none. TRAP T-every-tab-hears-a-change
 *
 *   node --test test/unit/every-tab-hears-a-change.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ArrayStore, DataSource, openRequestStore } from '../../dist/data.js';
import { serveData } from '../../dist/worker.js';

const ORIGIN = 'https://app.test';

/** A worker scope that answers through its fetch listeners: what a tab's fetch reaches. */
function workerScope() {
  const scope = Object.assign(new EventTarget(), { location: { origin: ORIGIN }, clients: { claim: async () => {} }, skipWaiting: async () => {} });
  const send = (request) => {
    let answered = null;
    scope.dispatchEvent(Object.assign(new Event('fetch'), { request, respondWith: (r) => { answered = Promise.resolve(r); }, waitUntil() {} }));
    return answered ?? Promise.resolve(null);
  };
  return { scope, send };
}

const settle = () => new Promise((done) => setTimeout(done, 30));

test('a write in one tab is heard in the other, and once in its own', async (t) => {
  const { scope, send } = workerScope();
  serveData(scope, { stores: { people: new ArrayStore([{ id: 1 }, { id: 2 }], { key: 'id' }) } });
  const one = await openRequestStore({ name: 'people', send, origin: ORIGIN });
  const two = await openRequestStore({ name: 'people', send, origin: ORIGIN });
  t.after(() => { one.close(); two.close(); });
  const tabTwo = new DataSource({ store: two });
  await tabTwo.load();
  assert.equal(tabTwo.debugState().total, 2);
  const heardOne = [];
  one.addEventListener('change', (e) => heardOne.push(e.detail.type));
  await one.insert({ id: 3 });
  await settle();
  assert.deepEqual(heardOne, ['insert'], 'its own write, said once — by the worker');
  await settle();
  assert.equal(tabTwo.debugState().total, 3, 'the other tab asked again');
});

test('a closed store hears no other tab: its channel is shut, and it says its own writes again', async () => {
  const { scope, send } = workerScope();
  serveData(scope, { stores: { people: new ArrayStore([{ id: 1 }], { key: 'id' }) } });
  const one = await openRequestStore({ name: 'people', send, origin: ORIGIN });
  const two = await openRequestStore({ name: 'people', send, origin: ORIGIN });
  const heard = [];
  two.addEventListener('change', (e) => heard.push(e.detail.type));
  two.close();
  await one.insert({ id: 2 });
  await settle();
  assert.deepEqual(heard, [], 'another tab\'s write is not heard');
  await two.remove(2);
  assert.deepEqual(heard, ['remove'], 'its own write is said once, by itself');
  await settle();
  assert.deepEqual(heard, ['remove']);
  one.close();
});
