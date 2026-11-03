/**
 * A PUSH IS A CHECK BEHIND — plan 652 S8. A push from the app's server names a
 * store that changed: the worker reads its held set again behind, so newer rows
 * wait and the banner's notice is said (S6c); a store not held says the notice
 * itself. A notification shows where it may, and its press opens its url.
 * TRAP T-a-push-is-a-check-behind
 *
 *   node --test test/unit/a-push-is-a-check-behind.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ArrayStore, HeldStore, NOTICE_CHANNEL, fakeRemote } from '../../dist/data.js';
import { serveData } from '../../dist/worker.js';

const settle = () => new Promise((done) => setTimeout(done, 30));

/** A worker scope, its notifications and its tabs. */
function worker(stores) {
  const shown = [];
  const focused = [];
  const opened = [];
  const tabs = [];
  const scope = Object.assign(new EventTarget(), {
    location: { origin: 'http://test' },
    clients: {
      claim: async () => {},
      matchAll: async () => tabs.map((url) => ({ url, focus: async () => { focused.push(url); } })),
      openWindow: async (url) => { opened.push(url); },
    },
    skipWaiting: async () => {},
    registration: { showNotification: async (title, options) => { shown.push({ title, ...options }); } },
  });
  serveData(scope, { stores });
  const fire = (type, init) => {
    const waits = [];
    scope.dispatchEvent(Object.assign(new Event(type), init, { waitUntil: (p) => waits.push(p) }));
    return Promise.all(waits);
  };
  const push = (said) => fire('push', { data: { json: () => said } });
  return { scope, shown, focused, opened, tabs, push, fire };
}

/** The data notices said, as a page hears them. */
function hear() {
  const heard = [];
  const channel = new BroadcastChannel(NOTICE_CHANNEL);
  channel.unref?.();
  channel.onmessage = (e) => { if (e.data?.kind === 'data') heard.push(e.data); };
  return { heard, close: () => channel.close() };
}

test('a push naming a held store reads it again behind: its newer rows wait, and the notice is said', async () => {
  const inner = new ArrayStore([{ id: 1, owner: 'Ada' }], { key: 'id' });
  let missing = false;
  const held = new HeldStore(fakeRemote(inner, { delay: 0, missed: () => missing }));
  await held.load();
  const w = worker({ people: held });
  const ear = hear();
  missing = true;
  await inner.update(1, { owner: 'Cy' });
  missing = false;
  await w.push({ store: 'people' });
  await settle();
  assert.equal(ear.heard.length, 1, 'newer rows wait');
  assert.equal(ear.heard[0].store, 'people');
  assert.deepEqual((await held.load()).rows.map((r) => r.owner), ['Ada'], 'and no row moved');
  ear.close();
});

test('a push naming a store not held says the notice itself', async () => {
  const w = worker({ feed: new ArrayStore([], { key: 'id' }) });
  const ear = hear();
  await w.push({ store: 'feed' });
  await settle();
  assert.equal(ear.heard.length, 1);
  ear.close();
});

test('a notification shows; its press focuses the tab that shows its url, else opens it', async () => {
  const w = worker({});
  await w.push({ notification: { title: 'Customers changed', body: 'Ada is Cy now', url: '/?context=records' } });
  assert.deepEqual(w.shown, [{ title: 'Customers changed', body: 'Ada is Cy now', data: { url: '/?context=records' } }]);
  const press = (url) => w.fire('notificationclick', { notification: { close() {}, data: { url } } });
  await press('/?context=records');
  assert.deepEqual(w.opened, ['http://test/?context=records'], 'no tab open: it opens one');
  w.tabs.push('http://test/?context=dashboard');
  await press('/?context=records');
  assert.deepEqual([w.focused, w.opened.length], [[], 2], 'a tab on another page is left at its work: the url opens');
  w.tabs.push('http://test/?context=records');
  await press('/?context=records');
  assert.deepEqual([w.focused, w.opened.length], [['http://test/?context=records'], 2], 'the tab that shows it is focused');
  await press(undefined);
  assert.deepEqual(w.opened.at(-1), 'http://test/', 'no url: the app');
});

test('a push that is not JSON, or names nothing, does nothing', async () => {
  const w = worker({});
  await w.fire('push', { data: { json: () => { throw new SyntaxError('not JSON'); } } });
  await w.push({});
  assert.deepEqual(w.shown, []);
});
