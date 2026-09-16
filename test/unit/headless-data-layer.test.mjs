/**
 * THE DATA LAYER RUNS WITH NO DOM.
 *
 * Every query operation and every mutation, in plain Node — no browser, no
 * jsdom, no shim. This is what lets a SERVER answer a query identically to the
 * browser (it imports the same `applyOptions`), and what lets an agent or an
 * HTTP API drive a Sherpa app headless.
 *
 * It works today by happy accident: `store.ts` and `validate.ts` were written
 * DOM-free for other reasons, and `DataSource extends EventTarget` because that
 * saved writing a subscriber list. One `document.querySelector` in any of them
 * would break it SILENTLY — no browser test would notice, because a browser has
 * a document.
 *
 * So this file turns the accident into a contract.
 *
 *   node --test test/unit/headless-data-layer.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

const core = new URL('../../dist/core/', import.meta.url);
const { ArrayStore } = await import(new URL('stores.js', core));
const { DataSource } = await import(new URL('data-source.js', core));
const { applyOptions, filterRows, sortRows, filterFields } = await import(new URL('store.js', core));
const { validate } = await import(new URL('validate.js', core));

/** The rows every test below shares. */
const makeRows = (n = 500) =>
  Array.from({ length: n }, (_, i) => ({
    id: i,
    name: `n${i % 97}`,
    plan: i % 3 ? 'Pro' : 'Free',
    spend: (i * 37) % 10000,
  }));

test('there is genuinely no DOM here', () => {
  // If this ever fails, the test is running somewhere with a document and
  // proves nothing — which would be worse than not having it.
  assert.equal(typeof document, 'undefined', 'a document exists — this test is not headless');
  assert.equal(typeof window, 'undefined', 'a window exists — this test is not headless');
});

test('the pure query functions run headless', () => {
  const rows = makeRows();

  // These three are what a SERVER imports to answer a query the same way the
  // browser would. Same module, so the two cannot drift.
  assert.equal(filterRows(rows, ['plan', 'eq', 'Free']).length, 167);
  assert.equal(sortRows(rows, [{ field: 'spend', direction: 'desc' }])[0].spend, 9990);

  const paged = applyOptions(rows, { filter: ['plan', 'eq', 'Pro'], take: 5 });
  assert.equal(paged.rows.length, 5, 'take limits the page');
  assert.equal(paged.total, 333, 'total counts MATCHES, not the page');

  // The filter tree flattens the same way too — a grid uses this to light the
  // columns a filter is narrowing.
  assert.deepEqual(filterFields(['and', ['plan', 'eq', 'Pro'], ['spend', 'gt', 10]]), ['plan', 'spend']);
});

test('a Store and a DataSource run headless — query and mutate', async () => {
  const store = new ArrayStore(makeRows(), { key: 'id' });
  const source = new DataSource({ store, pageSize: 25 });

  await source.load();
  assert.equal(source.rows.length, 25, 'paged');
  assert.equal(source.total, 500);

  source.setFilter(['plan', 'eq', 'Pro']);
  await settle();
  assert.equal(source.total, 333, 'filtered');

  source.setSort('spend', 'desc');
  await settle();
  assert.equal(source.rows[0].spend, 9953, 'sorted, within the filter');

  // A MUTATION. The store's change event reaches the source with no DOM in the
  // path — DataSource extends EventTarget, which Node ships natively.
  await store.insert({ id: 9999, name: 'new', plan: 'Pro', spend: 99999 });
  await settle();
  assert.equal(source.total, 334, 'the insert reached the source');

  await store.remove(9999);
  await settle();
  assert.equal(source.total, 333, 'and so did the remove');
});

test('bind() works headless — a plain object stands in for a component', async () => {
  const source = new DataSource({ store: new ArrayStore([{ id: 1 }, { id: 2 }], { key: 'id' }) });

  // bind() needs only populate() and the attribute setters. No element, no DOM
  // — which is what lets an agent or an HTTP handler stand where a grid stands.
  const payloads = [];
  const headless = {
    populate: (d) => payloads.push(d),
    setAttribute() {}, removeAttribute() {},
    addEventListener() {}, removeEventListener() {},
  };

  const off = source.bind(headless);
  await source.load();
  await settle();

  assert.ok(payloads.length > 0, 'populate was called');
  assert.equal(payloads.at(-1).length, 2, 'with the rows');

  off();
  assert.equal(source.boundElements.length, 0, 'and unbind releases it');
});

test('validation runs headless, and a schema maps an external shape', async () => {
  // The adapter pattern for an external source: rename, coerce, reject. A
  // hand-written Standard Schema, so no library is involved.
  const Schema = {
    '~standard': {
      version: 1,
      vendor: 'test',
      validate(input) {
        const name = typeof input?.customer_name === 'string' ? input.customer_name.trim() : '';
        const spend = Number(input?.total_spend);
        if (!name) return { issues: [{ message: 'name required' }] };
        if (!Number.isFinite(spend)) return { issues: [{ message: 'spend not a number' }] };
        return { value: { name, spend } };
      },
    },
  };

  const good = await validate(Schema, { customer_name: ' Ada ', total_spend: '900.50' });
  assert.equal(good.issues, undefined);
  assert.deepEqual(good.value, { name: 'Ada', spend: 900.5 }, 'renamed and coerced');
  assert.equal(typeof good.value.spend, 'number', 'a REAL number, so sorting is numeric');

  const bad = await validate(Schema, { customer_name: '', total_spend: 'x' });
  assert.ok(bad.issues?.length, 'a bad row reports issues rather than throwing');
});

/** Let the source's async load settle. */
function settle() {
  return new Promise((resolve) => setTimeout(resolve, 20));
}
