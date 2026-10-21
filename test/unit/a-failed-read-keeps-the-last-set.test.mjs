/**
 * A whole read that fails because the store cannot be REACHED keeps the last
 * set: shown, marked stale, and the page says so (`reach`). A REFUSAL drops it.
 * TRAP T-a-failed-read-keeps-the-last-set
 *
 *   node --test test/unit/a-failed-read-keeps-the-last-set.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, DataSource, HttpError, spoofRemote } from '../../dist/data.js';

const ROWS = Array.from({ length: 6 }, (_, i) => ({ id: i + 1, tier: i % 2 ? 'gold' : 'silver' }));
const tick = (ms = 20) => new Promise((done) => setTimeout(done, ms));

/** A remote store that fails while `down`, its inner loads counted. */
function flaky() {
  const net = { down: false };
  const inner = new ArrayStore(ROWS.map((r) => ({ ...r })), { key: 'id' });
  const load = inner.load.bind(inner);
  const seen = { loads: 0 };
  inner.load = (o) => { seen.loads++; return load(o); };
  const store = spoofRemote(inner, { delay: 0, fail: () => (net.down ? 1 : 0) });
  return { net, inner, store, seen };
}

async function watched(store) {
  const source = new DataSource({ store });
  const heard = { changes: [], errors: [] };
  source.addEventListener('change', (e) => heard.changes.push({ total: e.detail.total, stale: !!e.detail.stale }));
  source.addEventListener('error', (e) => heard.errors.push(e.detail.failure?.kind));
  await source.load();
  return { source, heard };
}

test('down, a Refresh keeps the rows — stale, no error — and the page says it cannot reach the store', async () => {
  const { net, store } = flaky();
  const { source, heard } = await watched(store);
  net.down = true;
  await source.load({ force: true });
  await tick();
  assert.deepEqual(heard.changes.at(-1), { total: 6, stale: true });
  assert.deepEqual(heard.errors, []);
  assert.equal(source.reach, 'unreached');
  assert.equal(source.failure?.kind, 'offline');
});

test('while stale, a toggle asks nothing, and a change the set can place costs no load', async () => {
  const { net, inner, store, seen } = flaky();
  const { source } = await watched(store);
  net.down = true;
  await source.load({ force: true });
  await tick();
  seen.loads = 0;
  source.query.setSort('tier');
  await source.load();
  await inner.insert({ id: 7, tier: 'gold' });
  await tick();
  assert.equal(seen.loads, 0);
  assert.equal(source.total, 7);
  assert.equal(source.reach, 'unreached');
});

test('up again, recheck() confirms the rows and the reach is ok', async () => {
  const { net, store } = flaky();
  const { source, heard } = await watched(store);
  net.down = true;
  await source.load({ force: true });
  await tick();
  net.down = false;
  source.recheck();
  await tick();
  assert.deepEqual(heard.changes.at(-1), { total: 6, stale: false });
  assert.equal(source.reach, 'ok');
});

test('down from the open: nothing to show — an error with its kind, and the page is down', async () => {
  const { net, store } = flaky();
  net.down = true;
  const { source, heard } = await watched(store);
  assert.deepEqual(heard.errors.at(-1), 'offline');
  assert.equal(source.reach, 'down');
  net.down = false;
  source.recheck();
  await tick();
  assert.equal(source.reach, 'ok');
  assert.equal(source.total, 6);
});

test('a refusal drops the set: an error, and the store was reached', async () => {
  const rows = ROWS.map((r) => ({ ...r }));
  const net = { refuse: false };
  const store = Object.assign(new EventTarget(), {
    key: 'id', remote: true, reportsTotal: true, announcesAll: true,
    load: async (o = {}) => {
      if (net.refuse) throw new HttpError(401, 'Unauthorized', '/api');
      return { rows: rows.slice(0, o.take ?? rows.length).map((r) => ({ ...r })), total: rows.length };
    },
    totalCount: async () => rows.length,
    byKey: async () => undefined, insert: async () => ({}), update: async () => ({}), remove: async () => {},
  });
  const { source, heard } = await watched(store);
  net.refuse = true;
  await source.load({ force: true });
  await tick();
  assert.equal(heard.errors.at(-1), 'refused');
  assert.equal(source.reach, 'ok');
  assert.equal(source.debugState().held.rows, null);
});
