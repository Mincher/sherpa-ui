/**
 * ONE FEED FOR EVERY TAB — plan 652 S8. The tab that holds a Web Lock opens the
 * live feed and passes each message to the others; when it stops, another takes
 * the lock and opens it. A live store says each wire message, and applies one
 * another tab heard without passing it on. ONE election (`oneTab`) leads both a
 * shared feed and the news feed, each under its own name.
 * TRAP T-one-feed-for-every-tab
 *
 *   node --test test/unit/one-feed-for-every-tab.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ArrayStore, EventStore, shareFeed } from '../../dist/data.js';
import { followUpdates } from '../../dist/app.js';

const tick = () => new Promise((done) => setTimeout(done, 20));

/** A Web Lock manager as a browser's: one holder per name, the rest wait in turn. */
function locks() {
  const held = new Map();
  return {
    request(name, { signal }, run) {
      return new Promise((resolve, reject) => {
        const turn = async () => {
          held.set(name, true);
          try { resolve(await run()); } catch (e) { reject(e); }
          held.delete(name);
          queue.get(name)?.shift()?.();
        };
        const queue = this.queue ??= new Map();
        if (!held.has(name)) return void turn();
        const waiting = queue.get(name) ?? [];
        queue.set(name, waiting);
        waiting.push(turn);
        signal?.addEventListener('abort', () => {
          const i = waiting.indexOf(turn);
          if (i >= 0) waiting.splice(i, 1);
          reject(new DOMException('aborted', 'AbortError'));
        });
      });
    },
  };
}

/** A tab's feed: an EventStore whose wire is a function the test calls. */
function tabFeed() {
  const store = new ArrayStore([], { key: 'id' });
  const feed = new EventStore({ url: 'http://test/live', into: store });
  let open = 0;
  feed.connect = () => { open++; };
  feed.disconnect = () => {};
  return { store, feed, wire: (raw) => feed.receive(raw), opened: () => open };
}

test('a live store says each wire message; one another tab heard is applied, and not passed on', async () => {
  const { store, feed, wire } = tabFeed();
  const said = [];
  feed.addEventListener('message', (e) => said.push(e.detail));
  wire({ type: 'insert', row: { id: 1 } });
  feed.hear({ type: 'insert', row: { id: 2 } });
  await tick();
  assert.equal(said.length, 1);
  assert.equal((await store.load()).total, 2);
});

test('two tabs: one opens the feed, and both get every message; it moves when that tab stops', async (t) => {
  const was = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { value: { locks: locks() }, configurable: true });
  t.after(() => { if (was) Object.defineProperty(globalThis, 'navigator', was); });
  const one = tabFeed();
  const two = tabFeed();
  const stopOne = shareFeed(one.feed, 'alerts');
  const stopTwo = shareFeed(two.feed, 'alerts');
  await tick();
  assert.equal(one.opened() + two.opened(), 1, 'one connection for both');
  assert.equal(one.opened(), 1);
  one.wire({ type: 'insert', row: { id: 1 } });
  await tick();
  assert.equal((await two.store.load()).total, 1, 'the other tab has it too');
  stopOne();
  await tick();
  assert.equal(two.opened(), 1, 'the feed moved to the tab left');
  two.wire({ type: 'insert', row: { id: 2 } });
  await tick();
  assert.equal((await two.store.load()).total, 2);
  stopTwo();
});

test('with no Web Locks, a tab opens its own feed, as before', (t) => {
  const was = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true });
  t.after(() => { if (was) Object.defineProperty(globalThis, 'navigator', was); });
  const { feed, opened } = tabFeed();
  const stop = shareFeed(feed, 'alerts');
  t.after(stop);
  assert.equal(opened(), 1);
});

/** A browser's EventSource, opened by nothing: each one made is kept. */
function eventSources() {
  const made = [];
  class FakeSource extends EventTarget {
    static CLOSED = 2;
    readyState = 0;
    constructor(url) { super(); this.url = url; made.push(this); }
    close() { this.readyState = 2; }
  }
  return { made, FakeSource };
}

test('the news feed leads under its own name: a feed shared as "updates" leads too, in the same tab', async (t) => {
  const was = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { value: { locks: locks() }, configurable: true });
  const { made, FakeSource } = eventSources();
  globalThis.EventSource = FakeSource;
  t.after(() => { delete globalThis.EventSource; if (was) Object.defineProperty(globalThis, 'navigator', was); });
  t.after(followUpdates());
  const shared = tabFeed();
  t.after(shareFeed(shared.feed, 'updates'));
  await tick();
  assert.equal(made.filter((s) => s.url === '/sherpa/updates').length, 1, 'the news feed is followed');
  assert.equal(shared.opened(), 1, 'and the shared feed opened: two names, two elections');
});

test('two tabs follow the news feed once; it moves when that tab stops', async (t) => {
  const was = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { value: { locks: locks() }, configurable: true });
  const { made, FakeSource } = eventSources();
  globalThis.EventSource = FakeSource;
  t.after(() => { delete globalThis.EventSource; if (was) Object.defineProperty(globalThis, 'navigator', was); });
  const stopOne = followUpdates();
  const stopTwo = followUpdates();
  t.after(() => { stopOne(); stopTwo(); });
  await tick();
  assert.equal(made.length, 1, 'one connection for both');
  stopOne();
  await tick();
  assert.deepEqual(made.map((s) => s.readyState), [2, 0], 'the first shut; the second tab opened its own');
  stopTwo();
  assert.equal(made[1].readyState, 2);
});
