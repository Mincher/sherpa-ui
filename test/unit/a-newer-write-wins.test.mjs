/**
 * A NEWER WRITE WINS — plan 652 S7b, Will's D3 and D9. A write made offline is
 * sent with its own time; where the row changed after it, the source refuses it
 * (412, `conflict`) and the newer write stays. The worker keeps the lost write as
 * a notice, said again to each page that asks, until one says it was seen.
 * TRAP T-a-newer-write-wins
 *
 *   node --test test/unit/a-newer-write-wins.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ArrayStore, HeldStore, NOTICE_CHANNEL, RestStore, failureOf, fakeRemote, memoryOutbox,
} from '../../dist/data.js';
import { serveData } from '../../dist/worker.js';

const later = () => new Promise((done) => setTimeout(done, 5));

/** A server, a network that can go down, and a worker's held store over it. */
function server() {
  const inner = new ArrayStore([{ id: 1, owner: 'Ada' }, { id: 2, owner: 'Bo' }], { key: 'id' });
  const net = { down: false };
  const source = fakeRemote(inner, { delay: 0, fail: () => (net.down ? 1 : 0) });
  const held = new HeldStore(source, { outbox: memoryOutbox() });
  return { inner, net, held };
}

const owners = async (store) => (await store.load()).rows.map((r) => r.owner);

test('a 409 or a 412 is a conflict: a newer write won', () => {
  assert.equal(failureOf({ status: 412 }).kind, 'conflict');
  assert.equal(failureOf({ status: 409 }).kind, 'conflict');
});

test('a row changed on the server AFTER a write made offline keeps the newer write; the lost one is said', async () => {
  const { inner, net, held } = server();
  await owners(held);
  net.down = true;
  await held.update(1, { owner: 'Cy' });
  await later();
  await inner.update(1, { owner: 'Dee' });
  net.down = false;
  const lost = [];
  held.addEventListener('lost', (e) => lost.push(e.detail));
  await held.send();
  assert.equal(lost.length, 1);
  assert.equal(lost[0].key, 1);
  assert.equal(lost[0].why, 'conflict');
  assert.equal((await inner.byKey(1)).owner, 'Dee', 'the newer write stays');
  await new Promise((done) => held.addEventListener('change', done, { once: true }));
  assert.deepEqual(await owners(held), ['Dee', 'Bo']);
});

test('a row changed BEFORE the write was made: the write made offline is the newer, and lands', async () => {
  const { inner, net, held } = server();
  await owners(held);
  await inner.update(1, { owner: 'Dee' });
  await later();
  net.down = true;
  await held.update(1, { owner: 'Cy' });
  net.down = false;
  assert.equal(await held.send(), true);
  assert.equal((await inner.byKey(1)).owner, 'Cy');
});

test('our own earlier write is no newer write: a send that stops midway still lands the rest', async () => {
  const { inner, net, held } = server();
  await owners(held);
  net.down = true;
  await held.insert({ id: 3, owner: 'Dee' });
  await held.update(3, { owner: 'Eve' });
  await later();
  net.down = false;
  // The network drops just after the insert lands.
  const insert = inner.insert.bind(inner);
  inner.insert = async (values) => { const row = await insert(values); net.down = true; return row; };
  assert.equal(await held.send(), false, 'the update still waits');
  await later();
  net.down = false;
  const lost = [];
  held.addEventListener('lost', (e) => lost.push(e.detail));
  assert.equal(await held.send(), true);
  assert.deepEqual(lost, []);
  assert.equal((await inner.byKey(3)).owner, 'Eve');
});

test('a remove made offline loses to a newer change, and the row stays', async () => {
  const { inner, net, held } = server();
  await owners(held);
  net.down = true;
  await held.remove(2);
  await later();
  await inner.update(2, { owner: 'Eve' });
  net.down = false;
  await held.send();
  assert.equal((await inner.byKey(2))?.owner, 'Eve');
});

test('a REST store sends the write\'s time as If-Unmodified-Since', async (t) => {
  const was = globalThis.fetch;
  t.after(() => { globalThis.fetch = was; });
  const sent = [];
  globalThis.fetch = async (url, init = {}) => {
    sent.push(init.headers ?? {});
    return new Response(JSON.stringify({ id: 1, owner: 'Cy' }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const store = new RestStore({ url: 'http://test/api', key: 'id' });
  const at = Date.UTC(2026, 10, 2, 12, 0, 0);
  await store.update(1, { owner: 'Cy' }, { unmodifiedSince: at });
  await store.remove(1, { unmodifiedSince: at });
  await store.update(1, { owner: 'Cy' });
  assert.equal(sent[0]['If-Unmodified-Since'], 'Mon, 02 Nov 2026 12:00:00 GMT');
  assert.equal(sent[1]['If-Unmodified-Since'], 'Mon, 02 Nov 2026 12:00:00 GMT');
  assert.equal(sent[2]['If-Unmodified-Since'], undefined, 'a write made now sends no condition');
});

test('the worker keeps a lost write as a notice: said again to a page that asks, until seen', async () => {
  const { inner, net, held } = server();
  const scope = Object.assign(new EventTarget(), {
    location: { origin: 'http://test' }, clients: { claim: async () => {} }, skipWaiting: async () => {},
  });
  serveData(scope, { stores: { people: held } });
  const heard = [];
  const channel = new BroadcastChannel(NOTICE_CHANNEL);
  channel.unref?.();
  channel.onmessage = (e) => { if (e.data?.kind === 'lost') heard.push(e.data); };
  await owners(held);
  net.down = true;
  await held.update(1, { owner: 'Cy' });
  await later();
  await inner.update(1, { owner: 'Dee' });
  net.down = false;
  await held.send();
  const settle = () => new Promise((done) => setTimeout(done, 30));
  await settle();
  assert.equal(heard.length, 1, 'said when lost');
  const [notice] = heard;
  assert.equal(notice.store, 'people');
  assert.equal(notice.key, 1);
  assert.equal(notice.why, 'conflict');
  const message = (data) => {
    const waits = [];
    scope.dispatchEvent(Object.assign(new Event('message'), { data, waitUntil: (p) => waits.push(p) }));
    return Promise.all(waits);
  };
  await message({ sherpa: 'notices' });
  await settle();
  assert.equal(heard.length, 2, 'said again to a page that asks');
  await message({ sherpa: 'seen', id: notice.id });
  await message({ sherpa: 'notices' });
  await settle();
  assert.equal(heard.length, 2, 'seen: kept no more');
  channel.close();
});
