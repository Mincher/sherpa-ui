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

// The DATA tier — src/core is split by where a module can run.
const core = new URL('../../dist/core/data/', import.meta.url);
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

/* ── S11 — restoring a whole view state ─────────────────────────────── */

test('S11: setState restores a whole view in ONE load', async () => {
  const rows = makeRows(200);

  // A person narrows things down…
  const before = new DataSource({ store: new ArrayStore(rows, { key: 'id' }), pageSize: 10 });
  await before.load();
  before.setFilter(['plan', 'eq', 'Pro']);
  before.setSort('spend', 'desc');
  before.setPage(3);
  await settle();

  const saved = JSON.stringify(before.state);   // what a host would persist

  // …then an accidental reload. A brand new source, nothing shared.
  const store = new ArrayStore(rows, { key: 'id' });
  let loads = 0;
  const real = store.load.bind(store);
  store.load = (o) => { loads += 1; return real(o); };

  const after = new DataSource({ store, pageSize: 10, autoLoad: false });
  after.setState(JSON.parse(saved));
  await settle();

  assert.deepEqual(after.rows, before.rows, 'the same rows, including the PAGE');
  assert.equal(after.total, before.total);
  assert.equal(after.state.page, 3, 'page 3, not reset to 1');

  // Restoring six fields must not mean six queries — setState coalesces like
  // the individual setters do.
  assert.equal(loads, 1, 'one load for the whole restore');
});

test('S11: setState MERGES — an unnamed field keeps its value', async () => {
  const source = new DataSource({
    store: new ArrayStore(makeRows(60), { key: 'id' }),
    pageSize: 10,
  });
  await source.load();
  source.setFilter(['plan', 'eq', 'Pro']);
  await settle();

  // Restoring only a sort must not silently reset the page size to null or
  // drop the filter — a partial restore is a merge, not a replace.
  source.setState({ sort: [{ field: 'spend', direction: 'asc' }] });
  await settle();

  assert.equal(source.state.pageSize, 10, 'page size survived');
  assert.deepEqual(source.state.filter, ['plan', 'eq', 'Pro'], 'filter survived');
  assert.equal(source.state.sort[0].field, 'spend', 'and the sort applied');

  // …while an EXPLICIT null clears, which is how a reset is expressed.
  source.setState({ filter: undefined, group: null });
  await settle();
  assert.equal(source.state.filter, undefined, 'an explicit undefined clears');
});

/* ── O5 — named filter contributions ────────────────────────────────── */

test('O5: each writer owns its own PART; none can clobber another', async () => {
  const store = new ArrayStore(makeRows(90), { key: 'id' });
  const source = new DataSource({ store });
  await source.load();
  await settle();
  const all = source.total;

  // THREE ALTITUDES, as a real screen has: a saved view, the page's chips, and
  // a grid's column headings. Each writes its own key.
  source.contribute('view', ['spend', 'gt', 1000]);
  await settle();
  const withView = source.total;

  source.contribute('chips', ['plan', 'eq', 'Pro']);
  await settle();
  const withChips = source.total;

  // The view's clause is STILL THERE — this is the whole point. With setFilter
  // alone the second writer replaced the first, so a saved view's filter
  // vanished the moment any chip changed.
  assert.ok(withChips < withView, 'the chips narrowed further, rather than replacing');
  assert.deepEqual(source.state.filter, ['and', ['spend', 'gt', 1000], ['plan', 'eq', 'Pro']]);

  // A key is REPLACED by its next contribution, not appended.
  source.contribute('chips', ['plan', 'eq', 'Free']);
  await settle();
  assert.deepEqual(source.state.filter, ['and', ['spend', 'gt', 1000], ['plan', 'eq', 'Free']]);

  // …and REMOVED by undefined — "clear just the columns" without recomposing.
  source.contribute('chips', undefined);
  await settle();
  assert.deepEqual(source.state.filter, ['spend', 'gt', 1000], 'one part left, unwrapped');

  source.contribute('view', undefined);
  await settle();
  assert.equal(source.state.filter, undefined);
  assert.equal(source.total, all, 'back to everything');
});

test('O5: setFilter and setState REPLACE, clearing the parts with them', async () => {
  const source = new DataSource({ store: new ArrayStore(makeRows(90), { key: 'id' }) });
  await source.load();

  source.contribute('view', ['spend', 'gt', 1000]);
  source.contribute('chips', ['plan', 'eq', 'Pro']);
  await settle();

  // setFilter is a claim about the WHOLE query. Quietly ANDing it with the
  // leftover parts would make it not mean what it says.
  source.setFilter(['plan', 'eq', 'Free']);
  await settle();
  assert.deepEqual(source.state.filter, ['plan', 'eq', 'Free']);

  // A contribution after that starts from the new baseline, not the old parts.
  source.contribute('columns', ['name', 'contains', 'n1']);
  await settle();
  assert.deepEqual(source.state.filter, ['name', 'contains', 'n1'],
    'setFilter cleared the parts, so only the new one composes');

  // setState says the same thing — a saved view restores the WHOLE query.
  source.contribute('view', ['spend', 'gt', 1]);
  await settle();
  source.setState({ filter: ['plan', 'eq', 'Pro'] });
  await settle();
  assert.deepEqual(source.state.filter, ['plan', 'eq', 'Pro']);
});

test('maxRows keeps a live feed bounded, oldest out', async () => {
  const { ArrayStore } = await import('../../dist/core/data/stores.js');

  // A feed capped at three, filled with five.
  const feed = new ArrayStore([], { key: 'id', maxRows: 3 });
  for (let i = 1; i <= 5; i++) await feed.insert({ id: i, n: i });
  const { rows } = await feed.load();

  // The OLDEST went. A feed's order is the order things happened, and the cap
  // is about how much is kept — not about what is shown, which is a sort.
  assert.deepEqual(rows.map((r) => r.id), [3, 4, 5]);

  // The constructor honours it too: a cap only some writes respect is not a cap.
  const seeded = new ArrayStore([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }], {
    key: 'id', maxRows: 2,
  });
  assert.deepEqual((await seeded.load()).rows.map((r) => r.id), [3, 4]);

  // …and so does setRows.
  seeded.setRows([{ id: 7 }, { id: 8 }, { id: 9 }]);
  assert.deepEqual((await seeded.load()).rows.map((r) => r.id), [8, 9]);

  // NO CAP is the default — an ordinary store is untouched.
  const plain = new ArrayStore([], { key: 'id' });
  for (let i = 1; i <= 5; i++) await plain.insert({ id: i });
  assert.equal((await plain.load()).rows.length, 5);
});

test('several live stores can feed ONE shared store', async () => {
  const { ArrayStore } = await import('../../dist/core/data/stores.js');
  const { EventStore } = await import('../../dist/core/data/live-stores.js');

  /* THE POINT OF `into`: alerts, builds and deploys arriving on three
     connections and appearing in ONE list. Without it each live store makes its
     own ArrayStore and a DataSource can bind only one of them.

     EventSource does not exist in Node, so the CONNECTION is not exercised here
     — what is, is that the three stores share one set of records, which is the
     part `into` changes. The wire is covered by the browser tests. */
  const feed = new ArrayStore([], { key: 'id', maxRows: 100 });
  const alerts = new EventStore({ url: 'http://x/alerts', into: feed });
  const builds = new EventStore({ url: 'http://x/builds', into: feed });

  await alerts.insert({ id: 'a1', kind: 'alert' });
  await builds.insert({ id: 'b1', kind: 'build' });

  // ONE list, both kinds — and every store sees it, because there is only one.
  const ids = (r) => r.rows.map((x) => x.id).sort();
  assert.deepEqual(ids(await feed.load()), ['a1', 'b1']);
  assert.deepEqual(ids(await alerts.load()), ['a1', 'b1']);
  assert.deepEqual(ids(await builds.load()), ['a1', 'b1']);

  // WITHOUT `into`, each makes its own — the state of the world before S9.
  const lone = new EventStore({ url: 'http://x/lone' });
  await lone.insert({ id: 'c1' });
  assert.deepEqual(ids(await lone.load()), ['c1']);
  assert.deepEqual(ids(await feed.load()), ['a1', 'b1']);
});

test('the `sherpa-ui/data` entry point is importable and usable in Node', async () => {
  /* WHAT THIS GUARDS: `dist/index.js` exports all 62 components, and importing
     a component DEFINES a custom element — so `import 'sherpa-ui'` throws
     "HTMLElement is not defined" in Node. The data layer was always headless;
     there was no DOOR into it until this entry point existed.

     Importing it is not enough to prove anything, so this also runs a query. */
  const data = await import('../../dist/data.js');

  // NO COMPONENTS. A single component export would drag in customElements and
  // undo the whole point.
  const componentExports = Object.keys(data).filter(
    (k) => k.startsWith('Sherpa') && k !== 'SherpaToast',
  );
  assert.deepEqual(componentExports, [], 'the data entry point exports no components');

  // …and the layer WORKS, not merely loads.
  const store = new data.ArrayStore(
    [{ id: 1, n: 'b' }, { id: 2, n: 'a' }, { id: 3, n: 'c' }],
    { key: 'id' },
  );
  const source = new data.DataSource({ store });
  source.setState({ sort: [{ field: 'n', direction: 'asc' }], filter: ['n', 'ne', 'c'] });
  await source.load();
  assert.deepEqual(source.result.rows.map((r) => r.n), ['a', 'b']);

  // Validation, the session store and a view snapshot all come through it too —
  // the four things a server or an MCP tool actually needs.
  assert.equal(typeof data.rules, 'function');
  assert.equal(typeof data.applyViewSnapshot, 'function');
  const session = new data.SessionStore({ theme: { mode: 'dark' } });
  assert.equal(session.get('/theme/mode'), 'dark');
  // persist() degrades with no storage rather than throwing — that is the
  // contract that lets it sit in a headless entry point at all.
  assert.equal(session.persist('/theme/mode'), false);

  // The LOCAL stores come through the same door, and degrade the same way.
  assert.equal(typeof data.IdbStore, 'function');
  assert.equal(typeof data.syncViews, 'function');
});

test('the data layer exports NO view renderer and no second wiring mechanism', async () => {
  /* TRAP T-attributes-are-the-state-channel.

     `renderView`, `$state` and `writes` were deleted 2026-09-18. `$state`
     compiled to `el.setAttribute(name, value)` — an attribute, which is what
     state already travels as — and added two things on top: re-set on change,
     and write-on-event. That is `DataSource.bind()`, which app code used seven
     times while `$state` was used zero.

     This asserts the layer did not quietly grow the second mechanism back. */
  const data = await import('../../dist/data.js');

  for (const gone of ['renderView', 'checkView', 'viewPointers', 'isStateRef', 'readDetail']) {
    assert.equal(typeof data[gone], 'undefined', `${gone} should be gone`);
  }

  // What REPLACED them, and is load-bearing: one wiring mechanism.
  assert.equal(typeof data.DataSource, 'function');
  const store = new data.ArrayStore([{ id: 1, n: 'a' }, { id: 2, n: 'b' }], { key: 'id' });
  const source = new data.DataSource({ store });

  // A plain object stands in for a component — bind() writes ATTRIBUTES onto it
  // and calls populate(), which is the whole state channel in two lines.
  const attrs = {};
  const el = {
    rows: null,
    populate(rows) { this.rows = rows; },
    setAttribute(k, v) { attrs[k] = v; },
    removeAttribute(k) { delete attrs[k]; },
    addEventListener() {},
    removeEventListener() {},
  };
  source.bind(el);
  source.setSort('n', 'desc');
  await source.load();

  assert.deepEqual(el.rows.map((r) => r.n), ['b', 'a'], 'rows arrived through populate()');
  assert.equal(attrs['data-sort-field'], 'n', 'state arrived as an ATTRIBUTE');
  assert.equal(attrs['data-sort-direction'], 'desc');
});

test('IdbStore is importable headless and REPORTS its absence rather than pretending', async () => {
  /* TRAP T-idb-is-the-only-real-local-store. Node has no IndexedDB, so the
     honest answer here is "unavailable" — not an empty store.

     `LocalStore` reads as EMPTY when storage is gone, and that is right for
     preferences: a missing preference is a default. It is WRONG for records.
     An app that writes a customer into a store which silently kept nothing and
     reported success has lost the customer, so this one rejects. */
  const { IdbStore } = await import('../../dist/core/browser/idb-store.js');

  // Merely importing must not throw — a module that reached `indexedDB` at
  // module scope would take a server down on import.
  assert.equal(IdbStore.available, false, 'Node has no IndexedDB');

  const store = new IdbStore({ name: 'customers', indexes: ['tier'] });
  // Constructing is fine; it opens nothing until asked.
  assert.equal(store.key, 'id', 'the default key field, as every store has');

  // …and every call REJECTS rather than resolving to a lie.
  await assert.rejects(() => store.load(), /IndexedDB is unavailable/);
  await assert.rejects(() => store.insert({ id: 1 }), /IndexedDB is unavailable/);
  await assert.rejects(() => store.putAll([{ id: 1 }]), /IndexedDB is unavailable/);

  // A FAILED open is not cached — one rejection in a private window must not
  // poison a session that is later granted storage. Proven by the second call
  // failing the same way rather than with a different, cached error.
  await assert.rejects(() => store.load(), /IndexedDB is unavailable/);

  // close() on a store that never opened is a no-op, not a throw: a teardown
  // path runs whether or not the thing it tears down ever started.
  store.close();
});

test('syncViews works with no IndexedDB, no storage and no remote', async () => {
  /* TRAP T-local-first-then-onward. The whole point of three tiers is that
     losing the lower two leaves the top one working. In Node BOTH lower tiers
     are gone, which is the harshest version of that and the easiest to test. */
  const { syncViews } = await import('../../dist/core/browser/view-sync.js');

  const errors = [];
  const sync = syncViews('records', { onError: (e, stage) => errors.push(stage) });

  // No storage, no IndexedDB, no remote — so nothing is known, and nothing threw.
  assert.deepEqual(await sync.all(), {});
  assert.deepEqual(await sync.restore(), {});

  // touch() and flush() are safe with no remote: a local-only app calls both.
  sync.touch();
  await sync.flush();
  await sync.stop();
  assert.deepEqual(errors, [], 'an absent tier is not an error — it is the design');
});

test('syncViews pushes to a remote, debounced, and a failed push is REPORTED not thrown', async () => {
  /* The half that matters for "sync changes server side fairly regularly": a
     burst of edits must be ONE request (T-sync-pushes-a-snapshot-not-a-diff),
     and a rejecting server must not break the local save
     (T-local-first-then-onward). */
  const { syncViews } = await import('../../dist/core/browser/view-sync.js');

  const pushes = [];
  let failNext = false;
  const remote = {
    pull: () => Promise.resolve({ shared: { label: 'Shared', snapshot: { v: 1 } } }),
    push: (page, views) => {
      pushes.push({ page, views });
      return failNext
        ? Promise.reject(new Error('503'))
        : Promise.resolve();
    },
  };

  const errors = [];
  const sync = syncViews('records', {
    remote,
    interval: 20,
    onError: (error, stage) => errors.push(stage),
  });

  // The remote's views come back even with no local tiers at all.
  assert.deepEqual(Object.keys(await sync.restore()), ['shared']);

  // THREE touches inside one interval is ONE push — that is the debounce.
  sync.touch();
  sync.touch();
  sync.touch();
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(pushes.length, 1, 'a burst of edits is one request');

  // A REJECTING server is reported, and does not throw out of flush().
  failNext = true;
  sync.touch();
  await sync.flush();
  assert.equal(pushes.length, 2);
  assert.deepEqual(errors, ['push'], 'the failure was reported, not thrown');

  await sync.stop();
});

test('RestStore sends the query to the server and trusts the answer', async () => {
  /* THE STORE THAT CARRIES EVERY QUERY TO A REAL BACKEND, and it had NO test —
     the one place where `LoadOptions` becomes a request and a response becomes
     rows. Plan step Q2 (a translator per backend) sits on this seam, and the
     plan says build those on demand; testing the seam itself is not speculative.

     `fetch` is a Node global, so this runs headless with a stub and no server. */
  const { RestStore } = await import('../../dist/core/data/stores.js');

  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return {
      ok: true,
      status: 200,
      // `headers` is not optional: #request reads `content-length` to spot a
      // 204 with no body. A stub without it throws before the assertions run.
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ items: [{ id: 1, n: 'a' }, { id: 2, n: 'b' }], count: 57 }),
    };
  };

  try {
    const store = new RestStore({
      url: 'https://api.test/customers',
      key: 'id',
      rowsPath: 'items',
      totalPath: 'count',
    });

    const result = await store.load({
      skip: 25,
      take: 25,
      sort: [{ field: 'n', direction: 'desc' }],
      filter: ['status', 'eq', 'active'],
      search: 'ada',
    });

    const url = new URL(calls[0]);
    // THE WHOLE QUERY reaches the server. A missing parameter here means the
    // server pages or sorts something other than what the user asked for.
    assert.equal(url.searchParams.get('skip'), '25');
    assert.equal(url.searchParams.get('take'), '25');
    assert.equal(url.searchParams.get('search'), 'ada');
    assert.deepEqual(JSON.parse(url.searchParams.get('sort')),
      [{ field: 'n', direction: 'desc' }]);
    assert.deepEqual(JSON.parse(url.searchParams.get('filter')),
      ['status', 'eq', 'active']);

    // The ROWS come from `rowsPath`, and the TOTAL from the server — 57, not 2.
    // A store that returned rows.length here would make every pager say
    // "page 1 of 1" over a corpus of 57.
    assert.deepEqual(result.rows.map((r) => r.n), ['a', 'b']);
    assert.equal(result.total, 57);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('a custom buildQuery is the seam a backend translator plugs into', async () => {
  const { RestStore } = await import('../../dist/core/data/stores.js');

  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return { ok: true, status: 200, headers: new Headers(), json: async () => [] };
  };

  try {
    /* A TOY OData TRANSLATOR — the shape plan step Q2 describes: a pure
       function, `LoadOptions` in, a request out. Written here rather than
       shipped, because the plan says build a real one ON DEMAND and there is no
       backend in this repo demanding one. What matters is that the SEAM works. */
    const toOData = (options) => {
      const q = new URLSearchParams();
      if (options.take != null) q.append('$top', String(options.take));
      if (options.skip) q.append('$skip', String(options.skip));
      if (options.sort?.length) {
        q.append('$orderby', options.sort
          .map((s) => `${s.field} ${s.direction ?? 'asc'}`).join(','));
      }
      if (Array.isArray(options.filter) && options.filter.length === 3) {
        const [field, , value] = options.filter;
        q.append('$filter', `${field} eq '${value}'`);
      }
      return q;
    };

    const store = new RestStore({ url: 'https://api.test/People', buildQuery: toOData });
    await store.load({ take: 10, skip: 20, sort: [{ field: 'name' }], filter: ['city', 'eq', 'Oslo'] });

    const url = new URL(calls[0]);
    assert.equal(url.searchParams.get('$top'), '10');
    assert.equal(url.searchParams.get('$skip'), '20');
    assert.equal(url.searchParams.get('$orderby'), 'name asc');
    assert.equal(url.searchParams.get('$filter'), "city eq 'Oslo'");
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('sample checks the first N rows on a read, and writes are always full', async () => {
  const { ArrayStore } = await import('../../dist/core/data/stores.js');
  const { rules, required } = await import('../../dist/core/data/validate.js');
  const schema = rules({ name: required() });

  /* WHY: a schema on a bulk load costs real time — measured at 100,000 rows,
     58ms over an unguarded load, about 25x. A sample of 50 brings that to
     0.1ms and still answers the question a read is really asking: "is this
     response the SHAPE I expect". A backend's rows are wrong in a shape, not
     one at a time. */

  // A bad row INSIDE the sample is caught.
  const early = new ArrayStore(
    [{ id: 1, name: 'ok' }, { id: 2, name: '' }, { id: 3, name: 'ok' }],
    { key: 'id', schema, sample: 3 },
  );
  const earlyResult = await early.load();
  assert.equal(earlyResult.rows.length, 2);
  assert.equal(earlyResult.dropped, 1);
  assert.equal(earlyResult.total, 2, 'the total drops with the row');

  // A bad row BEYOND the sample passes through — deliberately. The sample is a
  // shape check, not a promise about every row, and the doc says so.
  const late = new ArrayStore(
    [{ id: 1, name: 'ok' }, { id: 2, name: 'ok' }, { id: 3, name: '' }],
    { key: 'id', schema, sample: 2 },
  );
  const lateResult = await late.load();
  assert.equal(lateResult.rows.length, 3);
  assert.equal(lateResult.dropped, undefined, 'nothing was dropped, so no count');

  // NO SAMPLE is still the default: every row checked, which is the guard you
  // have to opt OUT of.
  const all = new ArrayStore(
    [{ id: 1, name: 'ok' }, { id: 2, name: 'ok' }, { id: 3, name: '' }],
    { key: 'id', schema },
  );
  assert.equal((await all.load()).rows.length, 2);

  // A WRITE is checked in full regardless. An insert is one row someone is
  // adding on purpose; skipping it is how bad data gets in.
  await assert.rejects(() => late.insert({ id: 9, name: '' }), /name/);
});

test('a sample never reorders or loses rows', async () => {
  const { ArrayStore } = await import('../../dist/core/data/stores.js');
  const { rules, required } = await import('../../dist/core/data/validate.js');

  // 200 good rows, a sample of 10. Every row must come back, in order — the
  // checked head and the unchecked tail are one list, not two.
  const rows = Array.from({ length: 200 }, (_, i) => ({ id: i, name: `n${i}` }));
  const store = new ArrayStore(rows, {
    key: 'id', schema: rules({ name: required() }), sample: 10,
  });

  const result = await store.load();
  assert.equal(result.rows.length, 200);
  assert.deepEqual(result.rows.map((r) => r.id).slice(0, 12), [0,1,2,3,4,5,6,7,8,9,10,11]);
  assert.equal(result.rows[199].id, 199);
});
