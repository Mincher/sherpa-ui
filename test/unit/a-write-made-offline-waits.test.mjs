/**
 * A WRITE MADE OFFLINE WAITS — plan 652 S7a. A write a HeldStore cannot send, its
 * source offline, waits in its outbox and shows at once; it is sent in order, once,
 * when the source is reached. One the source refuses is dropped, and said.
 * TRAP T-a-write-made-offline-waits
 *
 *   node --test test/unit/a-write-made-offline-waits.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ArrayStore, HeldStore, fakeRemote, memoryOutbox } from '../../dist/data.js';

/** A server, a network that can go down, and its writes counted. */
function server() {
  const inner = new ArrayStore([{ id: 1, owner: 'Ada' }, { id: 2, owner: 'Bo' }], { key: 'id' });
  const net = { down: false };
  const writes = { count: 0 };
  for (const name of ['insert', 'update', 'remove']) {
    const own = inner[name].bind(inner);
    inner[name] = (...args) => { writes.count++; return own(...args); };
  }
  const source = fakeRemote(inner, { delay: 0, fail: () => (net.down ? 1 : 0) });
  return { inner, net, writes, source };
}

const owners = async (store) => (await store.load()).rows.map((r) => r.owner);

test('offline, a write waits and shows at once; reached again, it is sent once', async () => {
  const { inner, net, writes, source } = server();
  const held = new HeldStore(source, { outbox: memoryOutbox() });
  await owners(held);
  net.down = true;
  let queued = 0;
  held.addEventListener('queued', () => { queued++; });
  const saved = await held.update(1, { owner: 'Cy' });
  assert.equal(saved.owner, 'Cy');
  assert.equal(queued, 1);
  assert.equal(held.pending, 1);
  assert.deepEqual(await owners(held), ['Cy', 'Bo'], 'it shows at once');
  assert.equal(writes.count, 0, 'nothing reached the server');
  net.down = false;
  await held.recheck();
  assert.equal(held.pending, 0);
  assert.equal(writes.count, 1, 'sent once');
  assert.equal((await inner.byKey(1)).owner, 'Cy');
  await held.recheck();
  assert.equal(writes.count, 1, 'and never again');
});

test('writes are sent in the order made: an insert, then its update, then a remove', async () => {
  const { inner, net, source } = server();
  const held = new HeldStore(source, { outbox: memoryOutbox() });
  await owners(held);
  net.down = true;
  await held.insert({ id: 3, owner: 'Dee' });
  await held.update(3, { owner: 'Eve' });
  await held.remove(2);
  assert.deepEqual(await owners(held), ['Ada', 'Eve']);
  net.down = false;
  assert.equal(await held.send(), true);
  assert.deepEqual((await inner.load()).rows.map((r) => r.owner), ['Ada', 'Eve']);
});

test('two senders over one outbox send it once', async () => {
  const { net, writes, source } = server();
  const outbox = memoryOutbox();
  const one = new HeldStore(source, { outbox });
  await owners(one);
  net.down = true;
  await one.update(1, { owner: 'Cy' });
  net.down = false;
  const two = new HeldStore(source, { outbox });
  await Promise.all([one.send(), two.send()]);
  assert.equal(writes.count, 1);
});

test('a write made offline outlives its worker: the next one lays it over the set, and sends it', async () => {
  const { inner, net, source } = server();
  const outbox = memoryOutbox();
  const first = new HeldStore(source, { outbox });
  await owners(first);
  net.down = true;
  await first.update(2, { owner: 'Flo' });
  net.down = false;
  const next = new HeldStore(source, { outbox });
  assert.deepEqual(await owners(next), ['Ada', 'Flo'], 'shown before it is sent');
  assert.equal(next.pending, 1);
  await next.send();
  assert.equal((await inner.byKey(2)).owner, 'Flo');
});

test('a write the source refuses when sent is dropped, said, and no longer shown', async () => {
  const { inner, net, source } = server();
  const held = new HeldStore(source, { outbox: memoryOutbox() });
  await owners(held);
  net.down = true;
  await held.update(2, { owner: 'Gus' });
  // Meanwhile, on the server, that row went.
  await inner.remove(2);
  net.down = false;
  const lost = [];
  held.addEventListener('lost', (e) => lost.push(e.detail.key));
  assert.equal(await held.send(), true);
  assert.deepEqual(lost, [2]);
  await new Promise((done) => held.addEventListener('change', done, { once: true }));
  assert.deepEqual(await owners(held), ['Ada'], 'the set is read again, and shown at once');
});

test('with no outbox, or a failure that is not offline, a write fails as before', async () => {
  const { net, source } = server();
  const plain = new HeldStore(source);
  await owners(plain);
  net.down = true;
  await assert.rejects(plain.update(1, { owner: 'Cy' }), TypeError);
  net.down = false;
  const held = new HeldStore(source, { outbox: memoryOutbox() });
  await owners(held);
  await assert.rejects(held.update(99, { owner: 'Cy' }), /no row/);
  assert.equal(held.pending, 0);
});
