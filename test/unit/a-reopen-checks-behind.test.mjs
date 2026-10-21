/**
 * A page opened again over a store that may miss a writer shows the set it
 * holds AT ONCE, marked stale, and reads it again behind — once; the answer
 * that follows is not stale. TRAP T-a-read-is-planned
 *
 *   node --test test/unit/a-reopen-checks-behind.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, DataSource, spoofRemote } from '../../dist/data.js';

const ROWS = Array.from({ length: 6 }, (_, i) => ({ id: i + 1, tier: i % 2 ? 'gold' : 'silver' }));
const tick = (ms = 20) => new Promise((done) => setTimeout(done, ms));

function remote(delay) {
  const inner = new ArrayStore(ROWS.map((r) => ({ ...r })), { key: 'id' });
  const load = inner.load.bind(inner);
  const seen = { loads: 0 };
  inner.load = (o) => { seen.loads++; return load(o); };
  return { inner, store: spoofRemote(inner, { delay, announcesAll: false }), seen };
}

test('a reopened page shows its rows at once, stale, then confirmed by one read behind', async () => {
  const { store, seen } = remote(50);
  const first = new DataSource({ store });
  await first.load();
  first.close();
  seen.loads = 0;
  const page = new DataSource({ store });
  const changes = [];
  page.addEventListener('change', (e) => changes.push({ stale: !!e.detail.stale, total: e.detail.total, loads: seen.loads }));
  await page.load();
  // At once, from the set: stale, and nothing asked yet.
  assert.deepEqual(changes[0], { stale: true, total: 6, loads: 0 });
  await tick(150);
  assert.equal(seen.loads, 1);
  assert.deepEqual(changes.at(-1), { stale: false, total: 6, loads: 1 });
});

test('a toggle while stale asks nothing more', async () => {
  const { store, seen } = remote(50);
  (await (async () => { const s = new DataSource({ store }); await s.load(); return s; })()).close();
  seen.loads = 0;
  const page = new DataSource({ store });
  await page.load();
  page.query.setSort('tier');
  await page.load();
  page.query.setSort('id');
  await page.load();
  await tick(150);
  assert.equal(seen.loads, 1);
});

test('a row another client saved is in the answer after the check', async () => {
  // A store another client also writes: its rows change, and it says nothing.
  const rows = ROWS.map((r) => ({ ...r }));
  const store = Object.assign(new EventTarget(), {
    key: 'id', remote: true, reportsTotal: true, announcesAll: false,
    // As a server answers: a little later.
    load: async (o = {}) => {
      await tick(30);
      return { rows: rows.slice(0, o.take ?? rows.length).map((r) => ({ ...r })), total: rows.length };
    },
    totalCount: async () => rows.length,
    byKey: async () => undefined, insert: async () => ({}), update: async () => ({}), remove: async () => {},
  });
  const first = new DataSource({ store });
  await first.load();
  first.close();
  rows.push({ id: 7, tier: 'gold' });
  const page = new DataSource({ store });
  const totals = [];
  page.addEventListener('change', (e) => totals.push([e.detail.total, !!e.detail.stale]));
  await page.load();
  await tick(120);
  assert.deepEqual(totals[0], [6, true]);
  assert.deepEqual(totals.at(-1), [7, false]);
});
