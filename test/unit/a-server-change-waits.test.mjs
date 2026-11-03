/**
 * A SERVER CHANGE WAITS — plan 652 S6c, Will: newer rows the source gives behind
 * the ones shown WAIT, so no page moves under its reader; the worker says so, and
 * Refresh data takes them in. A write made through the app shows at once.
 * TRAP T-a-server-change-waits
 *
 *   node --test test/unit/a-server-change-waits.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ArrayStore, DataSource, HeldStore, createDataHandler, fakeRemote, openRequestStore, defineStores } from '../../dist/data.js';

/** A worker's held store over a remote source, and a writer the store does not hear. */
function worker(options = {}) {
  const inner = new ArrayStore([{ id: 1, owner: 'Ada' }, { id: 2, owner: 'Bo' }], { key: 'id' });
  let missing = false;
  const source = fakeRemote(inner, { delay: 0, missed: () => missing });
  const held = new HeldStore(source, options);
  // Another client's write, on the server: the app hears nothing of it.
  const elsewhere = async (key, values) => { missing = true; await inner.update(key, values); missing = false; };
  return { held, source, elsewhere };
}

const owners = async (store) => (await store.load()).rows.map((r) => r.owner);

test('newer rows read behind wait, and say so; taken, they show', async () => {
  const { held, elsewhere } = worker();
  assert.deepEqual(await owners(held), ['Ada', 'Bo']);
  const said = [];
  held.addEventListener('waiting', (e) => said.push(e.detail.rows));
  await elsewhere(1, { owner: 'Cy' });
  await held.recheck();
  assert.deepEqual(said, [2], 'it says newer rows wait');
  assert.deepEqual(await owners(held), ['Ada', 'Bo'], 'the rows shown stay');
  assert.equal(await held.take(), true);
  assert.deepEqual(await owners(held), ['Cy', 'Bo']);
  assert.equal(await held.take(), false, 'nothing waits now');
});

test('each check that finds them waiting says so: a tab opened since hears it too', async () => {
  const { held, elsewhere } = worker();
  await owners(held);
  let said = 0;
  held.addEventListener('waiting', () => { said++; });
  await elsewhere(1, { owner: 'Cy' });
  await held.recheck();
  await held.recheck();
  assert.equal(said, 2);
  assert.deepEqual(await owners(held), ['Ada', 'Bo']);
});

test('the same rows read again are no news', async () => {
  const { held } = worker();
  await owners(held);
  let said = 0;
  held.addEventListener('waiting', () => { said++; });
  await held.recheck();
  assert.equal(said, 0);
});

test('a store that does not wait takes them at once: a live board', async () => {
  const { held, elsewhere } = worker({ waits: false });
  await owners(held);
  await elsewhere(1, { owner: 'Cy' });
  await held.recheck();
  assert.deepEqual(await owners(held), ['Cy', 'Bo']);
});

test('a write through the app shows at once, while newer rows wait', async () => {
  const { held, elsewhere } = worker();
  await owners(held);
  await elsewhere(1, { owner: 'Cy' });
  await held.recheck();
  await held.update(2, { owner: 'Dee' });
  assert.deepEqual(await owners(held), ['Ada', 'Dee']);
});

test('a page over it: Refresh data takes the waiting rows in', async () => {
  const { held, elsewhere } = worker();
  const store = await openRequestStore({ name: 'people', send: createDataHandler({ stores: defineStores(() => ({ people: held })) }) });
  const source = new DataSource({ store });
  await source.load();
  await elsewhere(1, { owner: 'Cy' });
  await held.recheck();
  await source.load();
  assert.deepEqual(source.rows.map((r) => r.owner), ['Ada', 'Bo'], 'no row moved under the reader');
  await source.load({ force: true });
  assert.deepEqual(source.rows.map((r) => r.owner), ['Cy', 'Bo']);
});
