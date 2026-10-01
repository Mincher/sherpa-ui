/**
 * A SUMMARY BINDS TO ALL THE ROWS, NOT THE PAGE.
 *
 * A chart counting 25 of 100 is quietly wrong, and looks right. `rows: 'all'`
 * hands the adapter every row matching the filter; the default stays the page
 * a grid draws.
 *
 *   node --test test/unit/summary-scope.test.mjs
 *
 * TRAP T-a-summary-binds-to-all-the-rows
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
const { DataSource, ArrayStore, onReport } = await import(new URL('../../dist/data.js', import.meta.url));

const ROWS = Array.from({ length: 100 }, (_, i) => ({ id: i, band: i < 60 ? 'a' : 'b' }));

/**
 * The smallest element `#push` will accept: it writes state attributes and
 * adds listeners before it ever calls populate().
 */
const el = (name) => {
  const attrs = new Map();
  return {
    name,
    got: [],
    populate(v) { this.got.push(v); },
    setAttribute(k, v) { attrs.set(k, String(v)); },
    removeAttribute(k) { attrs.delete(k); },
    hasAttribute(k) { return attrs.has(k); },
    getAttribute(k) { return attrs.get(k) ?? null; },
    addEventListener() {},
    removeEventListener() {},
  };
};

test('scope all sees every filtered row; the default sees one page', async () => {
  const s = new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }), pageSize: 25 });
  const page = el('page'); const all = el('all');
  s.bind(page, { readonly: true, as: (r) => r.length });
  s.bind(all,  { readonly: true, rows: 'all', as: (r) => r.length });
  await s.load({ force: true });
  assert.equal(page.got.at(-1), 25, 'a paged bind draws its window');
  assert.equal(all.got.at(-1), 100, 'a summary counts everything');
});

test('a filter narrows BOTH, and the summary still ignores the page', async () => {
  const s = new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }), pageSize: 25 });
  const all = el('all');
  s.bind(all, { readonly: true, rows: 'all', as: (r) => r.length });
  await s.load({ force: true });
  assert.equal(all.got.at(-1), 100);
  s.setState({ filter: ['band', 'eq', 'a'] });
  await s.load({ force: true });
  assert.equal(all.got.at(-1), 60, '60 match, not the 25 on screen');
});

test('a summary bound AFTER the first load is not blank', async () => {
  const s = new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }), pageSize: 25 });
  await s.load({ force: true });
  const all = el('late');
  s.bind(all, { readonly: true, rows: 'all', as: (r) => r.length });
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(all.got.at(-1), 100, 'the late bind triggered the unpaged fetch');
});

test('a view with NO summary never asks the store for the unpaged set', async () => {
  const asked = [];
  const store = new ArrayStore(ROWS, { key: 'id' });
  const inner = store.load.bind(store);
  store.load = (o = {}) => { asked.push(o); return inner(o); };

  const s = new DataSource({ store, pageSize: 25 });
  s.bind(el('page'), { readonly: true });
  await s.load({ force: true });

  // Every ask carried the page window. An unpaged one would be the cost this
  // feature must not impose on a view that never wanted it.
  assert.ok(asked.length > 0);
  for (const o of asked) {
    assert.equal(o.take, 25, `asked without a window: ${JSON.stringify(o)}`);
  }
});

test("`scope: 'all'` is a filter scope's name, so bind() says to use `rows: 'all'`", async () => {
  const heard = [];
  const stop = onReport((issue) => heard.push(issue.code));
  const s = new DataSource({ store: new ArrayStore(ROWS, { key: 'id' }), pageSize: 25 });
  s.bind(el('wrong'), { readonly: true, scope: 'all', as: (r) => r.length });
  s.bind(el('right'), { readonly: true, rows: 'all', as: (r) => r.length });
  stop();
  assert.deepEqual(heard, ['scope-all']);
});
