/**
 * A CHANGE WALKS AGAIN ONLY FOR WHAT IT MOVED — 345 phase 3. A store change
 * that moves no field the walk reads, and not the rows, leaves every count and
 * grey as it was: nothing is counted or drawn again. A store with no History, a
 * store that may miss a writer, or a change sent by hand moves everything.
 * TRAP T-a-change-redoes-only-what-reads-it
 *
 *   node --test test/unit/a-change-walks-again-only-for-what-it-moved.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, DataSource, bindSource, spoofRemote, VIEW } from '../../dist/data.js';

const ROWS = [
  { id: 1, region: 'EMEA', customer: 'Contoso', lastSeen: '2025-01-01' },
  { id: 2, region: 'EMEA', customer: 'Tailspin', lastSeen: '2025-01-02' },
  { id: 3, region: 'AMER', customer: 'Contoso', lastSeen: '2025-01-03' },
  { id: 4, region: 'APAC', customer: 'Litware', lastSeen: '2025-01-04' },
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Bar extends EventTarget {
  constructor(readings) { super(); this.held = readings; this.counted = 0; this.last = null; }
  get readings() { return this.held; }
  get heldFields() { return ['region', 'customer']; }
  drawResults(r) { this.counted++; this.last = r; }
  drawScope() {} drawPresent() {} setAttribute() {} removeAttribute() {} toggleAttribute() {} populate() {}
  report() { this.dispatchEvent(new CustomEvent('quick-filter-change', { detail: { readings: this.readings, holds: this.heldFields } })); }
}

/** A source over `store`, its View bar answering Region = EMEA, settled. */
async function page(store, options = {}) {
  const source = new DataSource({ store, limitOptions: true, ...options });
  source.declareValues('region', ['EMEA', 'AMER', 'APAC']);
  source.declareValues('customer', ['Contoso', 'Tailspin', 'Litware']);
  const bar = new Bar({ region: { picked: ['EMEA'] } });
  bindSource(source, bar, { steerOnly: true, scope: VIEW });
  bar.report();
  await source.load();
  await sleep(30);
  const seen = { present: 0, counted: () => bar.counted };
  source.addEventListener('present', () => seen.present++);
  bar.counted = 0;
  return { source, bar, seen };
}

test('an update to a field no count reads counts and draws nothing again', async () => {
  const store = new ArrayStore(ROWS, { key: 'id' });
  const { source, bar, seen } = await page(store);
  await store.update(1, { lastSeen: '2030-01-01' });
  await sleep(30);
  assert.equal(bar.counted, 0);
  assert.equal(seen.present, 0);
  // The rows are read again: the page shows the saved row.
  assert.equal(source.rows.find((r) => r.id === 1)?.lastSeen, '2030-01-01');
});

test('an update to a field the walk reads counts again, and counts right', async () => {
  const store = new ArrayStore(ROWS, { key: 'id' });
  const { bar } = await page(store);
  await store.update(3, { region: 'EMEA' });
  await sleep(30);
  assert.ok(bar.counted > 0);
  assert.equal(bar.last.region, 3);
});

test('a store that may miss a writer, or with no History, walks again on every change', async () => {
  // Held, through a spoof that says it may miss a writer.
  const inner = new ArrayStore(ROWS, { key: 'id' });
  const held = await page(spoofRemote(inner, { delay: 0, announcesAll: false }));
  await inner.update(1, { lastSeen: '2030-01-01' });
  await sleep(40);
  assert.ok(held.bar.counted > 0, 'a store that may miss a writer');
  // A store with no History at all.
  const plain = new ArrayStore(ROWS, { key: 'id' });
  const bare = Object.assign(new EventTarget(), {
    key: 'id', load: (o) => plain.load(o), totalCount: (o) => plain.totalCount(o), scan: () => plain.scan(),
    byKey: (k) => plain.byKey(k), insert: (v) => plain.insert(v), update: (k, v) => plain.update(k, v), remove: (k) => plain.remove(k),
  });
  plain.addEventListener('change', (e) => bare.dispatchEvent(new CustomEvent('change', { detail: e.detail })));
  const none = await page(bare);
  await plain.update(1, { lastSeen: '2030-01-01' });
  await sleep(30);
  assert.ok(none.bar.counted > 0, 'a store with no History');
});

test('a change sent by hand is not in the History, so it walks again', async () => {
  const store = new ArrayStore(ROWS, { key: 'id' });
  const { bar } = await page(store);
  store.dispatchEvent(new CustomEvent('change', { detail: { type: 'update', key: 1, fields: ['lastSeen'] } }));
  await sleep(30);
  assert.ok(bar.counted > 0);
});

test('over a remote store not held, an unread field asks no count and no distinct', async () => {
  const inner = new ArrayStore(ROWS, { key: 'id' });
  const asks = { counts: 0, distinct: 0 };
  const total = inner.totalCount.bind(inner);
  const distinct = inner.distinct.bind(inner);
  inner.totalCount = (o) => { asks.counts++; return total(o); };
  inner.distinct = (...a) => { asks.distinct++; return distinct(...a); };
  const { bar } = await page(spoofRemote(inner, { delay: 0 }), { holdRows: 0 });
  await sleep(30);
  asks.counts = 0;
  asks.distinct = 0;
  await inner.update(1, { lastSeen: '2030-01-01' });
  await sleep(40);
  assert.deepEqual(asks, { counts: 0, distinct: 0 });
  assert.equal(bar.counted, 0);
  // A field it reads asks again.
  await inner.update(3, { region: 'EMEA' });
  await sleep(40);
  assert.ok(asks.counts + asks.distinct > 0);
});

test('a walk that failed is asked again on any change, even one it does not read', async () => {
  const inner = new ArrayStore(ROWS, { key: 'id' });
  let failing = false;
  let asks = 0;
  const total = inner.totalCount.bind(inner);
  inner.totalCount = (o) => { asks++; return total(o); };
  const { source } = await page(spoofRemote(inner, { delay: 0, fail: () => (failing ? 1 : 0) }), { holdRows: 0 });
  // The walk fails, and is kept for its key.
  failing = true;
  source.setPage(1);
  await source.load({ force: true }).catch(() => {});
  await sleep(40);
  failing = false;
  asks = 0;
  await inner.update(1, { lastSeen: '2030-01-01' });
  await sleep(40);
  assert.ok(asks > 0, 'the failed walk was not asked again');
});
