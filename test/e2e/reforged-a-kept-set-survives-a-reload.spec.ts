import { test, expect } from './harness';

/**
 * A REMOTE STORE'S SET IS KEPT ON THE DEVICE — TODO 345 phase 4.7, Will's D2 B
 * and W2 A: a reload shows the last rows at once — offline too — and the first
 * page that uses the store reads them again behind them.
 * TRAP T-a-kept-set-is-checked-each-session
 */
const SESSION = (opts: { rows: number; down?: boolean; version?: number; name: string }) => `(async () => {
  const { ArrayStore, DataSource, spoofRemote, keepCache, rowKey } = await import('/dist/index.js');
  const rows = Array.from({ length: ${opts.rows} }, (_, i) => ({ id: i + 1, name: 'n' + i }));
  const store = spoofRemote(new ArrayStore(rows, { key: 'id' }), { delay: 50, fail: ${opts.down ? 1 : 0}, announcesAll: false });
  const keep = keepCache(store, { name: ${JSON.stringify(opts.name)}, version: ${opts.version ?? 1} });
  await keep.ready;
  const source = new DataSource({ store });
  const seen = [];
  source.addEventListener('change', (e) => seen.push([e.detail.total, !!e.detail.stale]));
  await source.load();
  const first = { total: source.total, stale: seen[0]?.[1] ?? null, key: source.rows[0] ? rowKey(source.rows[0]) : null, reach: source.reach };
  // Long enough for a check behind, and for a write once quiet.
  await new Promise((d) => setTimeout(d, 3200));
  return { first, last: seen.at(-1), reach: source.reach };
})()`;

test('a reload while the store is down shows the kept rows, stale, keyed as before', async ({ page }) => {
  const name = 'kept-down-' + Date.now();
  const one = await page.evaluate(SESSION({ rows: 6, name }));
  expect(one.first).toMatchObject({ total: 6, stale: false });
  await page.reload();
  const two = await page.evaluate(SESSION({ rows: 9, down: true, name }));
  // At once: the kept rows, unconfirmed, keyed as before…
  expect(two.first).toMatchObject({ total: 6, stale: true, key: '1' });
  // …and once the check behind has failed, the page says it cannot reach the store.
  expect(two.last).toEqual([6, true]);
  expect(two.reach).toBe('unreached');
});

test("a reload online shows the kept rows at once, then the store's, and keeps those", async ({ page }) => {
  const name = 'kept-up-' + Date.now();
  await page.evaluate(SESSION({ rows: 6, name }));
  await page.reload();
  const two = await page.evaluate(SESSION({ rows: 7, name }));
  expect(two.first).toMatchObject({ total: 6, stale: true });
  expect(two.last).toEqual([7, false]);
  await page.reload();
  const three = await page.evaluate(SESSION({ rows: 8, down: true, name }));
  // What the second session confirmed is what the third starts from.
  expect(three.first).toMatchObject({ total: 7, stale: true });
});

test('another version, or clearKept(), starts from nothing', async ({ page }) => {
  const name = 'kept-gone-' + Date.now();
  await page.evaluate(SESSION({ rows: 6, name }));
  await page.reload();
  const bumped = await page.evaluate(SESSION({ rows: 6, version: 2, name }));
  expect(bumped.first).toMatchObject({ total: 6, stale: false });
  await page.evaluate(`(async () => { const { clearKept } = await import('/dist/index.js'); await clearKept(); })()`);
  await page.reload();
  const cleared = await page.evaluate(SESSION({ rows: 6, down: true, version: 2, name }));
  expect(cleared.first).toMatchObject({ total: 0, reach: 'down' });
});

test('with no IndexedDB, the set is held in memory only — and nothing breaks', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(globalThis, 'indexedDB', { get() { throw new Error('blocked'); } }); });
  await page.reload();
  const r = await page.evaluate(`(async () => {
    const { ArrayStore, DataSource, spoofRemote, keepCache, onReport } = await import('/dist/index.js');
    const codes = [];
    onReport((x) => codes.push(x.code));
    const store = spoofRemote(new ArrayStore([{ id: 1 }, { id: 2 }], { key: 'id' }), { delay: 0 });
    await keepCache(store, { name: 'no-idb' }).ready;
    const source = new DataSource({ store });
    await source.load();
    return { total: source.total, codes };
  })()`);
  expect(r).toEqual({ total: 2, codes: ['cache-keep-unavailable'] });
});

test('a sign-out keeps nothing more under the old name, though the store is read again', async ({ page }) => {
  const name = 'kept-signout-' + Date.now();
  await page.evaluate(`(async () => {
    const { ArrayStore, DataSource, spoofRemote, keepCache, clearKept } = await import('/dist/index.js');
    const store = spoofRemote(new ArrayStore([{ id: 1 }, { id: 2 }], { key: 'id' }), { delay: 0, announcesAll: false });
    await keepCache(store, { name: ${JSON.stringify(name)} }).ready;
    const source = new DataSource({ store });
    await source.load();
    await clearKept();
    // The next user's first read: it must not be written under the old name.
    await source.load({ force: true });
    await new Promise((d) => setTimeout(d, 3200));
  })()`);
  await page.reload();
  const after = await page.evaluate(SESSION({ rows: 2, down: true, name }));
  expect(after.first).toMatchObject({ total: 0, reach: 'down' });
});

test('a save made while the store cannot be read leaves the kept copy for the next reload', async ({ page }) => {
  const name = 'kept-save-' + Date.now();
  await page.evaluate(SESSION({ rows: 6, name }));
  await page.reload();
  await page.evaluate(`(async () => {
    const { ArrayStore, DataSource, spoofRemote, keepCache } = await import('/dist/index.js');
    const inner = new ArrayStore(Array.from({ length: 6 }, (_, i) => ({ id: i + 1, name: 'n' + i })), { key: 'id' });
    // Reads fail; a save still goes through.
    const store = spoofRemote(inner, { delay: 0, fail: 1, announcesAll: false });
    await keepCache(store, { name: ${JSON.stringify(name)} }).ready;
    const source = new DataSource({ store });
    await source.load();
    await new Promise((d) => setTimeout(d, 100));
    await inner.update(2, { name: 'saved' });
    await new Promise((d) => setTimeout(d, 3200));
  })()`);
  await page.reload();
  const after = await page.evaluate(SESSION({ rows: 6, down: true, name }));
  expect(after.first).toMatchObject({ total: 6, stale: true });
});
