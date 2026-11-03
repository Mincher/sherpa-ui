/**
 * A WORKER HOLDS THE SET — plan 652 S5b, D8. A HeldStore holds its remote source's
 * whole set itself and answers every reader from it: two tabs over one worker
 * read the source once, and neither holds a copy of its own. They stay remote;
 * when the source cannot be reached they show the last set and say so, and a
 * Retry reads it again.
 * TRAP T-a-worker-holds-the-set
 *
 *   node --test test/unit/a-worker-holds-the-set.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ArrayStore, DataSource, HeldStore, createDataHandler, fakeRemote, openRequestStore, defineStores,
} from '../../dist/data.js';

const ROWS = Array.from({ length: 30 }, (_, i) => ({ id: i + 1, team: i % 3 ? 'core' : 'ops' }));

/** One worker over a remote source, and the source's whole reads counted. */
function worker() {
  let failing = false;
  const source = fakeRemote(new ArrayStore(ROWS.map((r) => ({ ...r })), { key: 'id' }), { delay: 0, fail: () => (failing ? 1 : 0) });
  const reads = { whole: 0 };
  const load = source.load.bind(source);
  source.load = (options = {}) => {
    if (!options.filter && options.skip === undefined) reads.whole++;
    return load(options);
  };
  const held = new HeldStore(source);
  const handle = createDataHandler({ stores: defineStores(() => ({ people: held })) });
  return { reads, held, handle, fail: (on) => { failing = on; } };
}

/** A tab: its own source over the worker's store. */
async function tab(handle) {
  const store = await openRequestStore({ name: 'people', send: handle });
  const source = new DataSource({ store, pageSize: 10 });
  await source.load();
  return { store, source };
}

test('the worker\'s store holds, and says so: a reader over it stays remote and holds none', async () => {
  const { handle } = worker();
  const { store, source } = await tab(handle);
  assert.equal(store.capabilities.holds, true);
  assert.equal(store.capabilities.remote, true);
  assert.equal(source.debugState().held, undefined, 'no copy in the page');
  assert.equal(source.debugState().total, 30);
});

test('two tabs read the source ONCE', async () => {
  const { handle, reads } = worker();
  const one = await tab(handle);
  const two = await tab(handle);
  await two.source.goToPage?.(2);
  assert.equal(one.source.debugState().total, 30);
  assert.equal(two.source.debugState().total, 30);
  assert.equal(reads.whole, 1, 'one whole read for both');
});

test('the source unreached: the last set answers, the reader says unreached; Retry reads it again', async () => {
  const w = worker();
  const { source } = await tab(w.handle);
  assert.equal(source.reach, 'ok');
  w.fail(true);
  await w.held.recheck();
  await source.load({ force: true });
  assert.equal(source.reach, 'unreached');
  assert.equal(source.failure?.kind, 'offline');
  assert.equal(source.debugState().total, 30, 'the last set still shows');
  w.fail(false);
  source.recheck();
  await new Promise((done) => setTimeout(done, 50));
  assert.equal(source.reach, 'ok');
});

test('a Refresh in a tab reads the source again, in the worker, before it answers', async () => {
  const { handle, reads } = worker();
  const { source } = await tab(handle);
  assert.equal(reads.whole, 1);
  await source.load({ force: true });
  assert.equal(reads.whole, 2, 'read again for the Refresh');
  await source.load();
  assert.equal(reads.whole, 2, 'and not again for a plain load');
});

test('a read that names its fields gets those and the key, not the whole held row — plan 652 S9', async () => {
  const { handle } = worker();
  const { store } = await tab(handle);
  // Asked for its key alone: the held row's `team` stays in the worker.
  const { rows } = await store.load({ fields: ['id'] });
  assert.deepEqual(Object.keys(rows[0]), ['id']);
});
