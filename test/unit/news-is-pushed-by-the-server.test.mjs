/**
 * NEWS IS PUSHED BY THE SERVER — plan 687 U2. The app server's feed says THAT
 * something is new, as Server-Sent Events; a follower that reconnects hears what it
 * missed, and one from before the server started again hears all it keeps.
 * TRAP T-news-is-pushed-by-the-server
 *
 *   node --test test/unit/news-is-pushed-by-the-server.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { updatesFeed } from '../../dist/data.js';

/** Follow the feed: read its events, then stop. */
function follow(feed, lastId) {
  const response = feed.answer(new Request('http://app/sherpa/updates', lastId ? { headers: { 'Last-Event-ID': lastId } } : {}));
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  return {
    type: response.headers.get('Content-Type'),
    /** The events so far: each `{ id, data }`. */
    async events() {
      for (;;) {
        const read = await Promise.race([reader.read(), new Promise((res) => setTimeout(() => res(null), 20))]);
        if (!read || read.done) break;
        text += decoder.decode(read.value);
      }
      return text.split('\n\n').filter((block) => block.includes('data: ')).map((block) => ({
        id: /^id: (.+)$/m.exec(block)?.[1],
        data: JSON.parse(/^data: (.+)$/m.exec(block)[1]),
      }));
    },
    stop: () => reader.cancel(),
  };
}

test('a follower hears each notice as an event, never the data', async () => {
  const feed = updatesFeed();
  const page = follow(feed);
  assert.equal(page.type, 'text/event-stream');
  feed.say({ kind: 'data', store: 'customers' });
  feed.say({ kind: 'app', build: 'b42' });
  assert.deepEqual((await page.events()).map((e) => e.data), [{ kind: 'data', store: 'customers' }, { kind: 'app', build: 'b42' }]);
  await page.stop();
});

test('a follower that reconnects hears only what it missed', async () => {
  const feed = updatesFeed();
  const first = follow(feed);
  feed.say({ kind: 'data', store: 'a' });
  const [seen] = await first.events();
  await first.stop();
  feed.say({ kind: 'data', store: 'b' });
  const again = follow(feed, seen.id);
  assert.deepEqual((await again.events()).map((e) => e.data.store), ['b']);
  await again.stop();
  // A new follower, with no id, hears only what comes next.
  const fresh = follow(feed);
  assert.deepEqual(await fresh.events(), []);
  await fresh.stop();
});

test('a follower from before the server started again hears all it keeps', async () => {
  const feed = updatesFeed({ keep: 2 });
  for (const store of ['a', 'b', 'c']) feed.say({ kind: 'data', store });
  const page = follow(feed, 'oldboot-7');
  assert.deepEqual((await page.events()).map((e) => e.data.store), ['b', 'c']);
  await page.stop();
});

test('a follower that stopped is no longer said to', async () => {
  const feed = updatesFeed();
  const page = follow(feed);
  await page.stop();
  assert.doesNotThrow(() => feed.say({ kind: 'app' }));
});
