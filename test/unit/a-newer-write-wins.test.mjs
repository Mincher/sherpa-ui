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
  ArrayStore, HeldStore, NOTICE_CHANNEL, RestStore, createDataHandler, failureOf, fakeRemote, memoryOutbox, openRequestStore,
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

/** A request store over a handler over a server that can go down: a worker's
 *  source, or a page's store over its worker. */
async function overTheWire() {
  const inner = new ArrayStore([{ id: 1, owner: 'Ada' }, { id: 2, owner: 'Bo' }], { key: 'id' });
  const net = { down: false };
  const handle = createDataHandler({ stores: { people: fakeRemote(inner, { delay: 0 }) } });
  const sent = [];
  const send = async (request) => {
    if (net.down) throw new TypeError('fetch failed');
    sent.push(request);
    return handle(request);
  };
  const store = await openRequestStore({ name: 'people', send });
  return { inner, net, store, sent };
}

test('a request store sends a write\'s time as If-Unmodified-Since, and the handler hands it to its store', async () => {
  const asked = [];
  const people = new ArrayStore([{ id: 1, owner: 'Ada' }], { key: 'id' });
  const update = people.update.bind(people);
  const remove = people.remove.bind(people);
  people.update = (key, values, options) => (asked.push(options), update(key, values));
  people.remove = (key, options) => (asked.push(options), remove(key));
  const handle = createDataHandler({ stores: { people } });
  const headers = [];
  const store = await openRequestStore({ name: 'people', send: (request) => (headers.push(request.headers.get('If-Unmodified-Since')), handle(request)) });
  const at = Date.UTC(2026, 10, 2, 12, 0, 0, 500);
  await store.update(1, { owner: 'Cy' }, { unmodifiedSince: at });
  await store.update(1, { owner: 'Dee' });
  await store.remove(1, { unmodifiedSince: at });
  assert.deepEqual(headers.slice(1), ['Mon, 02 Nov 2026 12:00:00 GMT', null, 'Mon, 02 Nov 2026 12:00:00 GMT']);
  // An HTTP date has whole seconds: the store refuses from the next one, as HTTP does.
  assert.deepEqual(asked, [{ unmodifiedSince: Date.UTC(2026, 10, 2, 12, 0, 0, 999) }, {}, { unmodifiedSince: Date.UTC(2026, 10, 2, 12, 0, 0, 999) }]);
});

test('over the wire, a write sent after a newer change is refused: 412, a conflict', async () => {
  const { inner, store } = await overTheWire();
  const made = Date.now() - 2000;
  await inner.update(1, { owner: 'Dee' });
  const refused = await store.update(1, { owner: 'Cy' }, { unmodifiedSince: made }).catch((error) => error);
  assert.equal(refused.status, 412);
  assert.equal(failureOf(refused).kind, 'conflict');
  assert.equal((await inner.byKey(1)).owner, 'Dee', 'the newer write stays');
  await assert.rejects(store.remove(1, { unmodifiedSince: made }), (error) => failureOf(error).kind === 'conflict');
  assert.ok(await inner.byKey(1), 'and the row with it');
});

test('a held store over a request store: its write made offline loses to a newer change on the server, and is said lost', async () => {
  const { inner, net, store, sent } = await overTheWire();
  const held = new HeldStore(store, { outbox: memoryOutbox() });
  await owners(held);
  net.down = true;
  await held.update(1, { owner: 'Cy' });
  await new Promise((done) => setTimeout(done, 1100));
  await inner.update(1, { owner: 'Dee' });
  net.down = false;
  const lost = [];
  held.addEventListener('lost', (e) => lost.push(e.detail));
  await held.send();
  assert.ok(sent.find((r) => r.method === 'PATCH')?.headers.get('If-Unmodified-Since'), 'the write went with its time');
  assert.deepEqual(lost.map((l) => [l.key, l.why]), [[1, 'conflict']]);
  assert.equal((await inner.byKey(1)).owner, 'Dee');
});

test('a held store passes a write\'s time on, and keeps it with a write that waits', async () => {
  const asked = [];
  const net = { down: false };
  const source = Object.assign(new EventTarget(), {
    key: 'id', remote: true, reportsTotal: true,
    load: async () => ({ rows: [{ id: 1, owner: 'Ada' }], total: 1 }), totalCount: async () => 1, byKey: async () => undefined, insert: async (v) => v,
    update: async (key, values, options) => { if (net.down) throw new TypeError('fetch failed'); asked.push(options); return { id: key, ...values }; },
    remove: async (key, options) => { if (net.down) throw new TypeError('fetch failed'); asked.push(options); },
  });
  const outbox = memoryOutbox();
  const held = new HeldStore(source, { outbox });
  await held.update(1, { owner: 'Cy' }, { unmodifiedSince: 1000 });
  await held.remove(1, { unmodifiedSince: 2000 });
  assert.deepEqual(asked, [{ unmodifiedSince: 1000 }, { unmodifiedSince: 2000 }]);
  net.down = true;
  await held.update(1, { owner: 'Dee' }, { unmodifiedSince: 3000 });
  assert.deepEqual((await outbox.read()).map((e) => e.since), [3000], 'it waits with the time it was made');
  net.down = false;
  await held.send();
  assert.deepEqual(asked.at(-1), { unmodifiedSince: 3000 });
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
