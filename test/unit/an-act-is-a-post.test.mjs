/**
 * AN ACT IS A POST — plan 695 H5. What changes a host's state — a check behind
 * (`?recheck`, of a store or of every store) and the newer rows taken in (`?take`) —
 * is asked by `POST`, so no cache or prefetch ever acts. A `GET` of one is refused,
 * and acts on nothing. TRAP T-an-act-is-a-post
 *
 *   node --test test/unit/an-act-is-a-post.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ArrayStore, DATA_BASE, HeldStore, createDataHandler, defineStores, fakeRemote, openRequestStore } from '../../dist/data.js';

/** A held remote store whose checks and takes are counted. */
function app() {
  const inner = new ArrayStore([{ id: 1, owner: 'Ada' }], { key: 'id' });
  const held = new HeldStore(fakeRemote(inner, { delay: 0 }));
  const count = { recheck: 0, take: 0 };
  for (const door of ['recheck', 'take']) {
    const real = held[door].bind(held);
    held[door] = (...args) => { count[door]++; return real(...args); };
  }
  const handle = createDataHandler({ stores: defineStores(() => ({ people: held })) });
  const ask = (method, tail) => handle(new Request(`http://app${DATA_BASE}${tail}`, { method }));
  return { held, count, handle, ask };
}

test('a check behind and a take are each a POST: of a store, and of every store', async () => {
  const { held, count, ask } = app();
  await held.load();
  assert.equal((await ask('POST', 'people?recheck')).status, 204);
  assert.equal((await ask('POST', '?recheck')).status, 204);
  assert.equal(count.recheck, 2);
  const took = await ask('POST', 'people?take');
  assert.equal(took.status, 200);
  assert.deepEqual(await took.json(), { took: false });
  assert.equal(count.take, 1);
});

test('a GET of an act is refused, says POST, and acts on nothing', async () => {
  const { held, count, ask } = app();
  await held.load();
  for (const tail of ['people?recheck', '?recheck', 'people?take']) {
    const response = await ask('GET', tail);
    assert.equal(response.status, 405, tail);
    assert.equal(response.headers.get('Allow'), 'POST');
  }
  assert.deepEqual(count, { recheck: 0, take: 0 });
});

test('a row has no act, and a take is a store\'s', async () => {
  const { ask } = app();
  assert.equal((await ask('POST', 'people/1?recheck')).status, 404);
  assert.equal((await ask('POST', '?take')).status, 404);
});

test('a request store asks each act by POST', async () => {
  const { handle } = app();
  const sent = [];
  const store = await openRequestStore({ name: 'people', send: (request) => { sent.push(`${request.method} ${new URL(request.url).search}`); return handle(request); } });
  await store.load();
  sent.length = 0;
  await store.recheck();
  await store.take();
  assert.deepEqual(sent, ['POST ?recheck', 'POST ?take']);
});
