/**
 * A SIGN-OUT REACHES THE WORKER — plan 695 H1, bug 10. `clearKept()` in a page
 * asks the app's worker too, and settles once it is done: the worker forgets its
 * held set, the rows it shows, the writes that wait and its kept notices, so
 * nothing of the last reader is shown, sent or said again.
 * TRAP T-a-kept-set-is-checked-each-session
 *
 *   node --test test/unit/a-sign-out-reaches-the-worker.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ArrayStore, HeldStore, NOTICE_CHANNEL, clearKept, fakeRemote, memoryOutbox } from '../../dist/data.js';
import { cacheOf } from '../../dist/core/data/store-cache.js';
import { serveData } from '../../dist/worker.js';

const later = (ms = 5) => new Promise((done) => setTimeout(done, ms));
const owners = async (store) => (await store.load()).rows.map((r) => r.owner);

/** A worker scope running `serveData`, and a page whose worker it is. */
function pageAndWorker(t, stores) {
  const scope = Object.assign(new EventTarget(), {
    location: { origin: 'http://test' }, clients: { claim: async () => {} }, skipWaiting: async () => {},
  });
  serveData(scope, { stores });
  const message = (data, ports = []) => {
    const waits = [];
    scope.dispatchEvent(Object.assign(new Event('message'), { data, ports, waitUntil: (p) => waits.push(p) }));
    return Promise.all(waits);
  };
  const was = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', {
    value: { serviceWorker: { controller: { postMessage: (data, ports) => void message(data, ports) } } }, configurable: true,
  });
  t.after(() => { if (was) Object.defineProperty(globalThis, 'navigator', was); });
  return { message };
}

test('a sign-out forgets the worker\'s held set, the rows it shows, the writes that wait and the kept notices', async (t) => {
  const inner = new ArrayStore([{ id: 1, owner: 'Ada' }, { id: 2, owner: 'Bo' }], { key: 'id' });
  const net = { down: false, missing: false };
  const source = fakeRemote(inner, { delay: 0, fail: () => (net.down ? 1 : 0), missed: () => net.missing });
  const outbox = memoryOutbox();
  const held = new HeldStore(source, { outbox });
  const { message } = pageAndWorker(t, { people: held });
  const heard = [];
  const channel = new BroadcastChannel(NOTICE_CHANNEL);
  channel.unref?.();
  channel.onmessage = (e) => { if (e.data?.kind === 'lost') heard.push(e.data); };
  t.after(() => channel.close());
  await owners(held);
  // A write made offline loses to a newer one: a kept notice.
  net.down = true;
  await held.update(1, { owner: 'Cy' });
  await later();
  await inner.update(1, { owner: 'Dee' });
  net.down = false;
  await held.send();
  await later(30);
  assert.equal(heard.length, 1, 'a lost write is kept, and said');
  // Newer rows wait behind the ones shown.
  net.missing = true;
  await inner.update(1, { owner: 'Fay' });
  net.missing = false;
  await held.recheck();
  assert.deepEqual(await owners(held), ['Dee', 'Bo'], 'the rows shown are the old ones');
  // A write made offline waits.
  net.down = true;
  await held.update(2, { owner: 'Eve' });
  assert.equal(held.pending, 1);

  const began = Date.now();
  await clearKept();
  assert.ok(Date.now() - began < 1000, 'it settles once the worker says it is done');
  assert.equal(held.pending, 0, 'no write waits');
  assert.deepEqual(await outbox.read(), [], 'none on the device either');
  net.down = false;
  assert.deepEqual(await owners(held), ['Fay', 'Bo'], 'the rows are read again: none shown from before, none laid over');
  assert.equal(await held.send(), true);
  assert.equal((await inner.byKey(2)).owner, 'Bo', 'the write that waited is never sent');
  await message({ sherpa: 'notices' });
  await later(30);
  assert.equal(heard.length, 1, 'no kept notice is said again');
});

test('after a sign-out the worker keeps the next reader\'s set: its keep, made once in its script, goes on — plan 695 S4', async (t) => {
  const inner = new ArrayStore([{ id: 1, owner: 'Ada' }, { id: 2, owner: 'Bo' }], { key: 'id' });
  const source = fakeRemote(inner, { delay: 0 });
  // The worker's keep, as `keepCache` in its script makes it: each set it is asked to write, and each forget.
  const kept = [];
  cacheOf(source).keep({
    read: async () => null,
    write: (take) => { const set = take(); if (set) kept.push(set.rows.map((r) => r.owner)); },
    forget: async () => { kept.push('forgotten'); },
  });
  const held = new HeldStore(source);
  pageAndWorker(t, { people: held });
  assert.deepEqual(await owners(held), ['Ada', 'Bo']);
  assert.deepEqual(kept, [['Ada', 'Bo']]);
  await clearKept();
  assert.equal(kept.at(-1), 'forgotten', 'the last reader\'s copy goes');
  await inner.update(1, { owner: 'Cy' });
  assert.deepEqual(await owners(held), ['Cy', 'Bo'], 'the next reader reads the set again');
  assert.deepEqual(kept.at(-1), ['Cy', 'Bo'], 'and it is kept, with no restart');
});

test('a page with no worker forgets its own, and settles at once', async (t) => {
  const was = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true });
  t.after(() => { if (was) Object.defineProperty(globalThis, 'navigator', was); });
  const began = Date.now();
  await clearKept();
  assert.ok(Date.now() - began < 100);
});
