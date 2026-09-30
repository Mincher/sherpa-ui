/**
 * A ROW THE SCHEMA REFUSES NEVER SHORTENS A PAGE — TODO 160.
 *
 * Will, 2026-09-30: "All customers. Row count was set to 25. Not all data grid
 * pages had 25 rows." The store cut the page FIRST and checked its rows
 * after, so each refused row left its page one short — and the total, which
 * "drops with the rows", changed from page to page.
 *
 * TRAP T-a-refused-row-never-shortens-a-page
 *
 *   node --test test/unit/refused-row-page.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const core = new URL('../../dist/core/data/', import.meta.url);
const { ArrayStore } = await import(new URL('stores.js', core));
const { DataSource } = await import(new URL('data-source.js', core));
const { rules, required } = await import(new URL('validate.js', core));

/** Thirty rows; three of them have no name, scattered over the first two pages. */
const BAD = new Set([3, 8, 15]);
const rows = () => Array.from({ length: 30 }, (_, i) => ({ id: i + 1, name: BAD.has(i + 1) ? '' : `Row ${i + 1}` }));
const store = () => new ArrayStore(rows(), { key: 'id', schema: rules({ name: required() }) });

test('every page holds the page size, and the total is the same on each', async () => {
  const s = store();
  const pages = [];
  for (const skip of [0, 10, 20]) pages.push(await s.load({ skip, take: 10 }));
  // 27 rows the schema accepts: 10, 10 and the 7 that are left.
  assert.deepEqual(pages.map((p) => p.rows.length), [10, 10, 7]);
  assert.deepEqual(pages.map((p) => p.total), [27, 27, 27]);
  // Counted over the WHOLE set, and said on every page.
  assert.deepEqual(pages.map((p) => p.dropped), [3, 3, 3]);
  // No row is lost between two pages, and none is shown twice.
  const ids = pages.flatMap((p) => p.rows.map((r) => r.id));
  assert.equal(new Set(ids).size, 27);
  assert.ok(ids.every((id) => !BAD.has(id)));
  assert.equal(await s.totalCount(), 27);
});

test('a DataSource pages it the same: full pages, and three of them', async () => {
  const source = new DataSource({ store: store(), pageSize: 10 });
  await source.load();
  assert.equal(source.rows.length, 10);
  assert.equal(source.totalPages, 3);
  source.setPage(2);
  await new Promise((r) => setTimeout(r, 0));
  await source.load();
  assert.equal(source.rows.length, 10);
});

test('a filter and a sort work on the accepted rows, then the page is cut', async () => {
  const s = store();
  const page = await s.load({ sort: [{ field: 'id', direction: 'desc' }], filter: ['id', 'lte', 20], take: 5 });
  assert.deepEqual(page.rows.map((r) => r.id), [20, 19, 18, 17, 16]);
  assert.equal(page.total, 17);
});
