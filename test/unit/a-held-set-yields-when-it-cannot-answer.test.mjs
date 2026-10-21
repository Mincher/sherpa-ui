/**
 * A held set — or a copy kept on the device — answers only while it may: one
 * too big now, refused, or signed out yields to the store, and a page is never
 * held up for a check it can make behind the rows.
 * TRAP T-a-read-is-planned · TRAP T-a-kept-set-is-checked-each-session
 *
 *   node --test test/unit/a-held-set-yields-when-it-cannot-answer.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, DataSource, HttpError, spoofRemote } from '../../dist/data.js';
import { cacheOf } from '../../dist/core/data/store-cache.js';

const tick = (ms = 20) => new Promise((done) => setTimeout(done, ms));
const rowsOf = (n) => Array.from({ length: n }, (_, i) => ({ id: i + 1, tier: i % 2 ? 'gold' : 'silver' }));

/** A store as a server is: another client may change it, and it says nothing. */
function server(rows, { delay = 0, fail = () => null } = {}) {
  const seen = { takes: [] };
  const store = Object.assign(new EventTarget(), {
    key: 'id', remote: true, reportsTotal: true, announcesAll: false,
    load: async (o = {}) => {
      seen.takes.push(o.take);
      await tick(delay);
      const error = fail();
      if (error) throw error;
      return { rows: rows.slice(0, o.take ?? rows.length).map((r) => ({ ...r })), total: rows.length };
    },
    totalCount: async () => rows.length,
    distinct: async () => { seen.distinct = (seen.distinct ?? 0) + 1; return []; },
    byKey: async () => undefined, insert: async () => ({}), update: async () => ({}), remove: async () => {},
  });
  return { store, seen };
}

/** A keep port on no device: its copy lands when told, and what it is asked is counted. */
function port(copy, after = 0) {
  const asked = { writes: 0, written: [], forgets: 0 };
  return {
    asked,
    read: () => (after === Infinity ? new Promise(() => {}) : tick(after).then(() => copy)),
    write: (take) => { asked.writes++; const set = take(); if (set) asked.written.push(set.rows.length); },
    forget: async () => { asked.forgets++; },
  };
}

test('a set now too big for its cap stops answering: the page asks the store, and so does the next', async () => {
  const rows = rowsOf(5);
  const { store, seen } = server(rows);
  const first = new DataSource({ store, holdRows: 10 });
  await first.load();
  first.close();
  rows.push(...rowsOf(20).slice(5));
  const page = new DataSource({ store, holdRows: 10 });
  const changes = [];
  page.addEventListener('change', (e) => changes.push({ total: e.detail.total, stale: !!e.detail.stale }));
  await page.load();
  await tick(60);
  assert.deepEqual(changes[0], { total: 5, stale: true });
  assert.deepEqual(changes.at(-1), { total: 20, stale: false });
  page.close();
  seen.takes.length = 0;
  const again = new DataSource({ store, holdRows: 10 });
  await again.load();
  await tick(40);
  assert.equal(again.total, 20);
  // No whole read is sent again at the cap it was refused at.
  assert.ok(!seen.takes.includes(11), `takes: ${seen.takes}`);
});

test('a kept copy that lands while a page waits for it is shown, and checked behind', async () => {
  const { store, seen } = server(rowsOf(3), { delay: 300 });
  const keep = port({ rows: rowsOf(3) }, 100);
  cacheOf(store).keep(keep);
  const page = new DataSource({ store });
  const changes = [];
  page.addEventListener('change', (e) => changes.push({ total: e.detail.total, stale: !!e.detail.stale }));
  const started = Date.now();
  await page.load();
  // From the copy, long before the server could answer.
  assert.ok(Date.now() - started < 280, `took ${Date.now() - started} ms`);
  assert.deepEqual(changes[0], { total: 3, stale: true });
  assert.equal(page.debugState().plan, 'held-stale');
  await tick(400);
  assert.equal(seen.takes.length, 1);
  assert.deepEqual(changes.at(-1), { total: 3, stale: false });
});

test('a kept copy that lands after a refusal is never shown', async () => {
  const { store } = server(rowsOf(3), { fail: () => new HttpError(401, 'signed out') });
  const keep = port({ rows: [{ id: 99, tier: 'secret' }] }, 1200);
  cacheOf(store).keep(keep);
  const page = new DataSource({ store });
  const changes = [];
  const errors = [];
  page.addEventListener('change', (e) => changes.push(e.detail.rows.map((r) => r.id)));
  page.addEventListener('error', (e) => errors.push(e.detail.failure?.kind));
  await page.load();
  await tick(1300);
  page.query.setSort('tier');
  await page.load();
  assert.ok(!changes.some((ids) => ids.includes(99)), `shown: ${JSON.stringify(changes)}`);
  assert.equal(errors.at(-1), 'refused');
  assert.equal(page.reach, 'ok');
});

test('an unconfirmed copy that takes a change leaves the device copy as it is', async () => {
  const net = { down: true };
  const inner = new ArrayStore(rowsOf(3), { key: 'id' });
  const store = spoofRemote(inner, { delay: 0, fail: () => (net.down ? 1 : 0) });
  const keep = port({ rows: rowsOf(3) });
  cacheOf(store).keep(keep);
  const page = new DataSource({ store });
  await page.load();
  await tick(40);
  assert.equal(page.reach, 'unreached');
  // A save that still goes through: taken into the copy, which is not confirmed.
  await inner.update(2, { tier: 'gold' });
  await tick(20);
  // No write is asked: the keep's last confirmed copy is left as it is.
  assert.equal(keep.asked.writes, 0);
  assert.equal(keep.asked.forgets, 0);
});

test('reopened after a failed Refresh, a page shows its rows at once and checks behind', async () => {
  const net = { down: false };
  const { store, seen } = server(rowsOf(4), { delay: 200, fail: () => (net.down ? new TypeError('offline') : null) });
  const first = new DataSource({ store });
  await first.load();
  net.down = true;
  await first.load({ force: true });
  assert.equal(first.reach, 'unreached');
  first.close();
  seen.takes.length = 0;
  const page = new DataSource({ store });
  const changes = [];
  page.addEventListener('change', (e) => changes.push({ total: e.detail.total, stale: !!e.detail.stale }));
  const started = Date.now();
  await page.load();
  assert.ok(Date.now() - started < 150, `took ${Date.now() - started} ms`);
  assert.deepEqual(changes[0], { total: 4, stale: true });
  await tick(300);
  assert.equal(seen.takes.length, 1);
});

test('a kept copy that never comes holds up only the first page', async () => {
  const { store } = server(rowsOf(2));
  cacheOf(store).keep(port(null, Infinity));
  const page = new DataSource({ store });
  await page.load();
  const started = Date.now();
  await page.load({ force: true });
  assert.ok(Date.now() - started < 500, `Refresh took ${Date.now() - started} ms`);
});

test('a sign-out drops the set and keeps nothing more under the old name', async () => {
  const { store } = server(rowsOf(3));
  const keep = port(null);
  const cache = cacheOf(store);
  cache.keep(keep);
  const page = new DataSource({ store });
  await page.load();
  assert.equal(keep.asked.writes, 1);
  cache.drop({ forget: true });
  assert.equal(keep.asked.forgets, 1);
  await page.load({ force: true });
  assert.equal(page.total, 3);
  assert.equal(keep.asked.writes, 1);
});
