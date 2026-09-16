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

/* ── F1 / F2 — skipping work that would change nothing ──────────────── */

test('F1: a load asking the SAME question twice is skipped', async () => {
  const store = new ArrayStore(makeRows(), { key: 'id' });
  let storeLoads = 0;
  const real = store.load.bind(store);
  store.load = (o) => { storeLoads += 1; return real(o); };

  const source = new DataSource({ store });
  await source.load();
  assert.equal(storeLoads, 1, 'the first load reads the store');

  // Twenty writes of the SAME filter. A chip re-emitting its state, a view
  // re-applying what it already applied, an attribute syncing back — all
  // arrive here, and all are free to ignore.
  for (let i = 0; i < 20; i += 1) source.setFilter(['plan', 'eq', 'Pro']);
  await settle();
  assert.equal(storeLoads, 2, 'only the FIRST of the twenty reached the store');

  // A genuine change still reads.
  source.setFilter(['plan', 'eq', 'Free']);
  await settle();
  assert.equal(storeLoads, 3);
});

test('F1: a MUTATION is never skipped, though the ViewState is identical', async () => {
  const store = new ArrayStore(makeRows(10), { key: 'id' });
  const source = new DataSource({ store });
  await source.load();
  assert.equal(source.total, 10);

  // The trap this guard could have caused: an insert leaves the ViewState
  // untouched and changes the answer. The store's change listener forces.
  await store.insert({ id: 999, name: 'new', plan: 'Pro', spend: 1 });
  await settle();
  assert.equal(source.total, 11, 'the insert reached the source');

  await store.remove(999);
  await settle();
  assert.equal(source.total, 10, 'and so did the remove');
});

test('F2: a component is not re-populated with rows it already holds', async () => {
  const source = new DataSource({ store: new ArrayStore(makeRows(50), { key: 'id' }) });

  let populates = 0;
  const headless = {
    populate: () => { populates += 1; },
    setAttribute() {}, removeAttribute() {},
    addEventListener() {}, removeEventListener() {},
  };
  source.bind(headless);
  await source.load();
  await settle();

  const afterFirst = populates;
  assert.ok(afterFirst > 0, 'the first load populates');

  // Same filter, twenty times. Even if F1 let a load through, the rows array
  // would be the same reference and the push is skipped.
  for (let i = 0; i < 20; i += 1) source.setFilter(['plan', 'eq', 'Pro']);
  await settle();
  const afterIdentical = populates;

  source.setFilter(['plan', 'eq', 'Free']);
  await settle();
  assert.ok(populates > afterIdentical, 'a REAL change still populates');
});

test('F2: a component bound AFTER a load still gets the rows', async () => {
  const source = new DataSource({ store: new ArrayStore(makeRows(5), { key: 'id' }) });
  await source.load();
  await settle();

  // The guard is per-component, so one that has never been pushed to has no
  // `lastRows` and must not be skipped — otherwise a late-bound component
  // would sit empty until the next filter change.
  const payloads = [];
  source.bind({
    populate: (d) => payloads.push(d),
    setAttribute() {}, removeAttribute() {},
    addEventListener() {}, removeEventListener() {},
  });
  await settle();

  assert.equal(payloads.length, 1, 'bound late, populated immediately');
  assert.equal(payloads[0].length, 5);
});

test('F3: writes in one tick coalesce; separate ticks do not', async () => {
  const store = new ArrayStore(makeRows(), { key: 'id' });
  let storeLoads = 0;
  const real = store.load.bind(store);
  store.load = (o) => { storeLoads += 1; return real(o); };

  const source = new DataSource({ store, autoLoad: false });
  await source.load();
  const afterFirst = storeLoads;

  // ONE TICK — a view setting three things in one handler. It used to ask the
  // store three times and throw two answers away.
  source.setFilter(['plan', 'eq', 'Pro']);
  source.setSort('spend', 'desc');
  source.setPageSize(10);
  await settle();
  assert.equal(storeLoads - afterFirst, 1, 'three setters, one load');

  // …and every setter's value made it into that one load.
  assert.equal(source.rows.length, 10, 'page size applied');
  assert.equal(source.total, 333, 'filter applied');
  assert.equal(source.rows[0].spend, 9953, 'sort applied');

  // SEPARATE TICKS are NOT merged. A microtask waits for the current
  // synchronous run and no longer — merging across ticks would be a debounce,
  // which is a policy about how fast people type and belongs to the caller.
  const beforeTyping = storeLoads;
  for (const term of ['n1', 'n12', 'n123']) {
    source.setFilter(['name', 'contains', term]);
    await settle();
  }
  assert.equal(storeLoads - beforeTyping, 3, 'one load per tick, as asked');
});

/* ── V7 / V8 — a schema on the way IN ───────────────────────────────── */

/**
 * One backend's shape, mapped to ours. A hand-written Standard Schema, so no
 * library is involved — it renames, coerces, defaults and rejects.
 */
const CustomerSchema = {
  '~standard': {
    version: 1,
    vendor: 'acme-crm',
    validate(input) {
      const issues = [];
      const id = Number(input?.cust_id);
      if (!Number.isInteger(id)) issues.push({ message: 'cust_id must be an integer', path: ['cust_id'] });
      const name = typeof input?.customer_name === 'string' ? input.customer_name.trim() : '';
      if (!name) issues.push({ message: 'customer_name is required', path: ['customer_name'] });
      const spend = input?.total_spend == null ? 0 : Number(input.total_spend);
      if (!Number.isFinite(spend)) issues.push({ message: 'total_spend is not a number', path: ['total_spend'] });
      if (issues.length) return { issues };
      return { value: { id, name, spend, plan: input?.plan_tier ?? 'free' } };
    },
  },
};

/** What a backend actually sends: snake_case, stringly-typed, two bad rows. */
const rawCustomers = () => [
  { cust_id: '1', customer_name: ' Ada ', total_spend: '900.50', plan_tier: 'pro' },
  { cust_id: 2, customer_name: 'Bob', total_spend: '40' },
  { cust_id: 3, customer_name: 'Cy', total_spend: null, plan_tier: 'enterprise' },
  { cust_id: 4, customer_name: '', total_spend: '10' },
  { cust_id: 'x', customer_name: 'Dee', total_spend: 'oops' },
];

test('V7: a schema maps rows on the way IN — rename, coerce, default', async () => {
  const store = new ArrayStore(rawCustomers(), { key: 'cust_id', schema: CustomerSchema });
  const source = new DataSource({ store });
  await source.load();
  await settle();

  assert.deepEqual(source.rows, [
    { id: 1, name: 'Ada', spend: 900.5, plan: 'pro' },       // renamed, trimmed, coerced
    { id: 2, name: 'Bob', spend: 40, plan: 'free' },          // plan DEFAULTED
    { id: 3, name: 'Cy', spend: 0, plan: 'enterprise' },      // null spend defaulted
  ]);

  // The coercion is the point: a real number sorts numerically, where "100"
  // would sort below "9" as text.
  assert.equal(typeof source.rows[0].spend, 'number');
  source.setSort('spend', 'desc');
  await settle();
  assert.deepEqual(source.rows.map((r) => r.spend), [900.5, 40, 0]);
});

test('V8: bad rows are DROPPED and REPORTED, never thrown', async () => {
  const store = new ArrayStore(rawCustomers(), { key: 'cust_id', schema: CustomerSchema });
  const source = new DataSource({ store });

  // A read must NOT throw the way a write does — one bad row in a thousand
  // would empty a grid.
  await source.load();
  await settle();

  const result = source.result;
  assert.equal(source.rows.length, 3, 'the good rows arrived');
  assert.equal(result.dropped, 2, 'the bad ones were counted');
  // The TOTAL drops with them, or a pager offers a page that renders empty.
  assert.equal(result.total, 3);

  // A silent drop would be worse than a bad row — a schema quietly rejecting
  // 40% of a response looks like a backend outage.
  assert.ok(result.issues?.length, 'and WHY they were refused');
  assert.ok(
    result.issues.some((i) => i.message.includes('customer_name')),
    'the issue names the field',
  );
});

test('V8: no schema means no check — nothing changes', async () => {
  const store = new ArrayStore([{ id: 1, name: '' }, { id: 2 }], { key: 'id' });
  const source = new DataSource({ store });
  await source.load();
  await settle();

  assert.equal(source.rows.length, 2, 'every row survives');
  assert.equal(source.result.dropped, undefined, 'and `dropped` is ABSENT, not zero');
});

test('V7: a WRITE still throws — the read path did not change it', async () => {
  const store = new ArrayStore([], { key: 'id', schema: CustomerSchema });

  // A write hands over ONE row the caller can fix, so telling them is the only
  // useful answer. That asymmetry with reads is deliberate.
  await assert.rejects(
    () => store.insert({ cust_id: 'x', customer_name: '', total_spend: 'no' }),
    (e) => e.name === 'ValidationError' && e.issues.length > 0,
  );

  // …and a good write stores the schema's PARSED value, not the input.
  const saved = await store.insert({ cust_id: 7, customer_name: '  Eve  ', total_spend: '12' });
  assert.deepEqual(saved, { id: 7, name: 'Eve', spend: 12, plan: 'free' });
});
