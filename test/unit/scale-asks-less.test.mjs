/**
 * SCALE: ASK LESS — TODO 615. Will's target is 100k rows in the browser. What a set
 * too big costs, what a page turn costs, and what a store is asked to send.
 *
 *   node --test test/unit/scale-asks-less.test.mjs
 *
 * TRAP T-a-page-turn-is-a-slice
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, DataSource, RestStore, applyOptions, fakeRemote, onReport } from '../../dist/data.js';
import { presentUnder, walkStepwise } from '../../dist/core/data/source-counts.js';

const settle = () => new Promise((r) => setTimeout(r, 30));

/** A server of `n` rows that says its total, and what it was asked for. */
function server(n) {
  const rows = Array.from({ length: n }, (_, i) => ({ id: i + 1, plan: i % 2 ? 'Pro' : 'Free' }));
  const sent = [];
  const fetch = async (url) => {
    const q = new URL(String(url)).searchParams;
    const skip = Number(q.get('skip') ?? 0);
    const take = q.has('take') ? Number(q.get('take')) : n;
    const out = rows.slice(skip, skip + take);
    sent.push(out.length);
    return new Response(JSON.stringify({ rows: out, total: n }), { headers: { 'content-type': 'application/json' } });
  };
  return { sent, fetch };
}
async function withFetch(fetch, run) {
  const real = globalThis.fetch;
  globalThis.fetch = fetch;
  try { return await run(); } finally { globalThis.fetch = real; }
}

test('a remote set of 60,000 is held by default: the browser\'s target is 100k (Will, D3)', async () => {
  const said = [];
  const off = onReport((r) => said.push(r.code));
  const rows = Array.from({ length: 60_000 }, (_, i) => ({ id: i + 1, plan: 'Pro' }));
  const source = new DataSource({ store: fakeRemote(new ArrayStore(rows, { key: 'id' }), { delay: 0 }) });
  await source.load();
  await settle();
  off();
  assert.deepEqual(said.filter((c) => c === 'held-set-refused'), []);
});

test('a set too big, from a store that says its total, is never sent whole', async () => {
  const { sent, fetch } = server(500);
  await withFetch(fetch, async () => {
    const off = onReport(() => {});
    const source = new DataSource({ store: new RestStore({ url: 'https://example.test/rows', rowsPath: 'rows', totalPath: 'total', key: 'id' }), holdRows: 100, pageSize: 10 });
    await source.load();
    await settle();
    off();
  });
  assert.ok(Math.max(...sent) <= 100, `the largest answer was ${Math.max(...sent)} rows`);
  assert.ok(sent.every((n) => n !== 101), `asked for the whole set: ${sent}`);
});

test('a count from a store that says its total asks one row', async () => {
  const { sent, fetch } = server(500);
  const total = await withFetch(fetch, () => new RestStore({ url: 'https://example.test/rows', rowsPath: 'rows', totalPath: 'total', key: 'id' }).totalCount());
  assert.equal(total, 500);
  assert.deepEqual(sent, [1]);
});

test('a count from a store with no total sends only keys', async () => {
  const asked = [];
  const store = new ArrayStore([{ id: 1, plan: 'Pro' }, { id: 2, plan: 'Free' }], { key: 'id' });
  const load = store.load.bind(store);
  store.load = (o) => { asked.push(o); return load(o); };
  Object.defineProperty(store, 'totalCount', { value: Object.getPrototypeOf(Object.getPrototypeOf(store)).totalCount });
  assert.equal(await store.totalCount({ filter: ['plan', 'eq', 'Pro'], take: 1, sort: [{ field: 'id' }] }), 1);
  assert.deepEqual(asked, [{ filter: ['plan', 'eq', 'Pro'], fields: ['id'] }]);
});

test('a walk asks one question once', async () => {
  const asked = [];
  const reads = {
    load: async () => ({ rows: [], total: 0 }),
    totalCount: async (o) => { asked.push(JSON.stringify(o.filter)); return 0; },
  };
  const clause = ['plan', 'eq', 'Pro'];
  const step = { field: 'plan', clause, on: true, counts: true, each: [['Pro', clause]] };
  await walkStepwise(reads, { now: new Date(), scopes: [{ scope: 'data', after: null, steps: [step], taps: [] }] });
  assert.ok(asked.length > 0);
  assert.equal(new Set(asked).size, asked.length, asked.join(' '));
});

test('a tally from a store that can project asks only its fields', async () => {
  const asked = [];
  const store = { projects: true, load: async (o) => { asked.push(o.fields); return { rows: [{ id: 1, plan: 'Pro' }], total: 1 }; } };
  assert.deepEqual(await presentUnder(store, ['plan'], undefined), { plan: ['Pro'] });
  assert.deepEqual(asked, [['plan']]);
});

test('a row is checked against its schema once, not on every read', async () => {
  let checks = 0;
  const schema = { '~standard': { version: 1, vendor: 'test', validate: (value) => { checks++; return { value }; } } };
  const store = new ArrayStore([{ id: 1 }, { id: 2 }, { id: 3 }], { key: 'id', schema, sampleSize: 0 });
  const first = await store.load({});
  const second = await store.load({ sort: [{ field: 'id', direction: 'desc' }] });
  assert.equal(first.rows.length, 3);
  assert.equal(second.rows[0].id, 3);
  const once = checks;
  await store.load({ take: 1 });
  assert.equal(checks, once);
  await store.update(2, { name: 'b' });
  checks = 0;
  await store.load({});
  assert.ok(checks <= 2, `${checks} checks after one row changed`);
});

test('every page of a store reads as applyOptions says, through a change', async () => {
  const rows = Array.from({ length: 50 }, (_, i) => ({ id: i + 1, n: (i * 7) % 11, plan: i % 3 ? 'Pro' : 'Free' }));
  const store = new ArrayStore(rows, { key: 'id' });
  const question = { filter: ['plan', 'eq', 'Pro'], sort: [{ field: 'n', direction: 'desc' }, { field: 'id', direction: 'asc' }] };
  const check = async (held) => {
    for (const [skip, take] of [[0, 10], [10, 10], [0, 10], [30, 5], [200, 5]]) {
      const got = await store.load({ ...question, skip, take });
      const want = applyOptions(held, { ...question, skip, take });
      assert.deepEqual(got.rows.map((r) => r.id), want.rows.map((r) => r.id), `skip ${skip}`);
      assert.equal(got.total, want.total);
    }
  };
  await check(rows);
  // Each change is seen on the next page turn.
  await store.update(1, { plan: 'Pro', n: 99 });
  const changed = rows.map((r) => (r.id === 1 ? { ...r, plan: 'Pro', n: 99 } : r));
  await check(changed);
  await store.remove(2);
  await check(changed.filter((r) => r.id !== 2));
  await store.insert({ id: 100, n: 50, plan: 'Pro' });
  await check([...changed.filter((r) => r.id !== 2), { id: 100, n: 50, plan: 'Pro' }]);
});

test('a page\'s rows are copies: a host\'s edit never reaches the kept order', async () => {
  const store = new ArrayStore([{ id: 1, n: 1 }, { id: 2, n: 2 }], { key: 'id' });
  const { rows } = await store.load({ take: 1, sort: [{ field: 'n', direction: 'desc' }] });
  rows[0].n = -1;
  rows.push({ id: 9 });
  const again = await store.load({ take: 2, sort: [{ field: 'n', direction: 'desc' }] });
  assert.deepEqual(again.rows.map((r) => [r.id, r.n]), [[2, 2], [1, 1]]);
});

test('finding a row by its key is the same, numeric or text, and after a key moves', async () => {
  const store = new ArrayStore([{ id: 7, n: 1 }, { id: '8', n: 2 }], { key: 'id' });
  assert.equal((await store.byKey('7')).n, 1);
  assert.equal((await store.byKey(8)).n, 2);
  await store.update(7, { id: 70 });
  assert.equal(await store.byKey(7), undefined);
  assert.equal((await store.byKey(70)).n, 1);
  await store.remove(70);
  assert.equal(await store.byKey(70), undefined);
  assert.equal((await store.byKey(8)).n, 2);
});
