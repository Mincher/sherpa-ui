/**
 * A CHECK BEHIND IS ASKED ONCE — plan 695 H2. A tab shown, a feed's word, a gap,
 * a push and a Refresh each ask a store to read its set again: one check runs at
 * a time per store; an ask before its read is sent joins it, and an ask after waits
 * for one more. A check settles as its read ends — even one a change overtook,
 * which lands on nothing.
 * TRAP T-a-request-picks-its-stores
 *
 *   node --test test/unit/a-check-behind-is-asked-once.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ArrayStore, HeldStore, createDataHandler, defineStores, fakeRemote, openRequestStore, wrapStore } from '../../dist/data.js';

/** A remote store that counts its whole reads, each `delay` ms. */
function remote(delay = 20) {
  const inner = new ArrayStore([{ id: 1, owner: 'Ada' }, { id: 2, owner: 'Bo' }], { key: 'id' });
  const source = fakeRemote(inner, { delay });
  let reads = 0;
  const counted = wrapStore(source, { load: (o) => { reads++; return source.load(o); } });
  return { inner, counted, reads: () => reads };
}

/** Settles in time, or says it hung. */
const within = (promise, ms = 2000) => Promise.race([promise.then(() => 'settled'), new Promise((done) => setTimeout(() => done('hung'), ms))]);

test('two checks at once read the set behind once, and both settle', async () => {
  const { counted, reads } = remote();
  const held = new HeldStore(counted);
  await held.load();
  const before = reads();
  const a = held.recheck();
  const b = held.recheck();
  assert.equal(a, b, 'the second joins the first');
  await Promise.all([a, b]);
  assert.equal(reads() - before, 1);
  // Once it has ended, a new ask checks again.
  await held.recheck();
  assert.equal(reads() - before, 2);
});

test('an ask while the read is out waits for one more check, which every later ask joins', async () => {
  const { counted, reads } = remote(40);
  const held = new HeldStore(counted);
  await held.load();
  const before = reads();
  const first = held.recheck();
  // The read is out: what this ask heard may be newer than it.
  await new Promise((done) => setTimeout(done, 10));
  const second = held.recheck();
  const third = held.recheck();
  assert.notEqual(first, second);
  assert.equal(second, third);
  await Promise.all([first, second, third]);
  assert.equal(reads() - before, 2);
});

test('a page\'s sources, asking in one moment, ask their worker once', async () => {
  const { counted } = remote();
  const held = new HeldStore(counted);
  const handle = createDataHandler({ stores: defineStores(() => ({ people: held })) });
  let asked = 0;
  const send = (request) => {
    if (new URL(request.url).searchParams.has('recheck')) asked++;
    return handle(request);
  };
  const store = await openRequestStore({ name: 'people', send });
  await store.load();
  await Promise.all([store.recheck(), store.recheck(), store.recheck()]);
  assert.equal(asked, 1);
});

test('a check settles when a change lands during its whole read', async () => {
  const { counted, reads } = remote(40);
  const held = new HeldStore(counted);
  await held.load();
  const before = reads();
  const check = held.recheck();
  // A change the set cannot place, while the read is out: the read lands on nothing.
  await new Promise((done) => setTimeout(done, 10));
  counted.dispatchEvent(new CustomEvent('change'));
  assert.equal(await within(check), 'settled');
  assert.equal(reads() - before, 1);
  // The set is due: the next read reads it again.
  await held.load();
  assert.equal(reads() - before, 2);
});
