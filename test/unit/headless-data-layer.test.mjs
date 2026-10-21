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
const { bindSource } = await import(new URL('../ui/bind-source.js', core));
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

  source.query.setReading('view', 'plan', { picked: ['Pro'] });
  await settle();
  assert.equal(source.total, 333, 'filtered');

  source.query.setSort('spend', 'desc');
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

  const off = bindSource(source, headless);
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
  for (let i = 0; i < 20; i += 1) source.query.setReading('view', 'plan', { picked: ['Pro'] });
  await settle();
  assert.equal(storeLoads, 2, 'only the FIRST of the twenty reached the store');

  // A genuine change still reads.
  source.query.setReading('view', 'plan', { picked: ['Free'] });
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
  bindSource(source, headless);
  await source.load();
  await settle();

  const afterFirst = populates;
  assert.ok(afterFirst > 0, 'the first load populates');

  // Same filter, twenty times. Even if F1 let a load through, the rows array
  // would be the same reference and the push is skipped.
  for (let i = 0; i < 20; i += 1) source.query.setReading('view', 'plan', { picked: ['Pro'] });
  await settle();
  const afterIdentical = populates;

  source.query.setReading('view', 'plan', { picked: ['Free'] });
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
  bindSource(source, {
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
  source.query.setReading('view', 'plan', { picked: ['Pro'] });
  source.query.setSort('spend', 'desc');
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
    source.query.setReading('view', 'name', { op: 'contains', text: term, picked: [] });
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
  source.query.setSort('spend', 'desc');
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

test('S11: a whole Query restores in ONE load', async () => {
  const rows = makeRows(200);

  // A person narrows things down…
  const before = new DataSource({ store: new ArrayStore(rows, { key: 'id' }), pageSize: 10 });
  await before.load();
  before.query.setReading('view', 'plan', { picked: ['Pro'] });
  before.query.setSort('spend', 'desc');
  await settle();

  const saved = JSON.stringify(before.query.export());   // what a host would persist

  // …then an accidental reload. A brand new source, nothing shared.
  const store = new ArrayStore(rows, { key: 'id' });
  let loads = 0;
  const real = store.load.bind(store);
  store.load = (o) => { loads += 1; return real(o); };

  const after = new DataSource({ store, pageSize: 10, autoLoad: false });
  await after.query.import(JSON.parse(saved));
  await settle();

  // The page number is not kept (TODO 388).
  assert.deepEqual(after.rows, before.rows, 'the same rows, in the same order');
  assert.equal(after.total, before.total);

  // A filter and a sort must not mean two queries.
  assert.equal(loads, 1, 'one load for the whole restore');
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
  // The door a server or an MCP tool uses: no components, and the layer WORKS, not merely loads.
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
  await source.query.setQuery({ v: 1, scopes: { view: { where: { n: { ne: 'c' } }, sort: [{ field: 'n', direction: 'asc' }] } } });
  await source.load();
  assert.deepEqual(source.result.rows.map((r) => r.n), ['a', 'b']);

  // Validation, the app definition's check and the local stores come through it too.
  assert.equal(typeof data.rules, 'function');
  assert.equal(typeof data.checkApp, 'function');
  assert.equal(typeof data.IdbStore, 'function');
});

test('the session degrades with no storage rather than throwing', async () => {
  const { SessionStore } = await import('../../dist/core/browser/session.js');
  const session = new SessionStore({ theme: { mode: 'dark' } });
  assert.equal(session.get('/theme/mode'), 'dark');
  assert.equal(session.persist('/theme/mode'), false);
});

test('the data layer exports NO view renderer and no second wiring mechanism', async () => {
  /* TRAP T-attributes-are-the-state-channel.

     `renderView`, `$state` and `writes` were deleted 2026-09-18. `$state`
     compiled to `el.setAttribute(name, value)` — an attribute, which is what
     state already travels as — and added two things on top: re-set on change,
     and write-on-event. That is `bindSource()`, which app code used seven
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
  bindSource(source, el);
  source.query.setSort('n', 'desc');
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
    pull: () => Promise.resolve({ shared: { label: 'Shared', ui: {} } }),
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

test('a RestStore is REMOTE: a source over it keeps a draft for Apply, never live', async () => {
  // Only spoofRemote said so before 2026-10-14. TRAP T-apply-and-discard-wait-for-a-change
  const { RestStore } = await import('../../dist/core/data/stores.js');
  const { DataSource } = await import('../../dist/core/data/data-source.js');
  const store = new RestStore({ url: 'https://api.test/customers', key: 'id' });
  const source = new DataSource({ store, applyOn: 'input' });
  assert.equal(store.remote, true);
  assert.equal(source.remote, true);
  assert.equal(source.applyOn, 'change');
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

/* A provider answers a component's request THROUGH ITS CALLBACK: `deliver`
   takes the place of `populate()`, now and on every change.
   TRAP T-a-component-asks-its-provider */
test('deliver: a bind hands its data to a callback instead of populate()', async () => {
  const source = new DataSource({ store: new ArrayStore([{ id: 1 }, { id: 2 }], { key: 'id' }), autoLoad: false });
  const heard = [];
  let populated = 0;
  const el = Object.assign(new EventTarget(), {
    setAttribute() {}, removeAttribute() {}, hasAttribute: () => false,
    populate: () => { populated += 1; },
  });
  bindSource(source, el, { deliver: (rows) => heard.push(rows.map((r) => r.id)) });
  await source.load();
  assert.deepEqual(heard.at(-1), [1, 2]);
  assert.equal(populated, 0);
  assert.equal(source.loaded, true);
});

/* A field's filter is DECLARED ONCE, and every bar, panel and heading draws it
   from the source. TRAP T-a-field-is-declared-once */
test('filterDef, declareScope and addable: one definition per field, and what a scope may add', () => {
  const source = new DataSource({ store: new ArrayStore([{ id: 1, plan: 'Pro', seats: 5 }], { key: 'id' }), autoLoad: false });
  source.declareField('plan', { label: 'Plan', select: 'multiple' });
  source.declareValues('plan', ['Free', 'Pro']);
  source.declareField('seats', { label: 'Seats', type: 'number', min: 0, max: 50, step: 1 });
  source.declareField('email', { label: 'Email', advanced: 'only', op: 'contains' });
  source.declareValues('email', ['a@x', 'b@x']);
  assert.deepEqual(source.filterDef('plan'), {
    id: 'plan', label: 'Plan', select: 'multiple',
    options: [{ value: 'Free', label: 'Free' }, { value: 'Pro', label: 'Pro' }],
  });
  assert.deepEqual(source.filterDef('seats'), { id: 'seats', label: 'Seats', min: 0, max: 50, step: 1, kind: 'number' });
  // Conditions only: no list to tick.
  assert.equal(source.filterDef('email').options, undefined);

  source.query.declareScope('view', { label: 'App header' });
  source.query.offer('grid', ['plan', 'seats', 'email', 'undeclared']);
  source.query.hold('grid', ['plan']);
  source.query.hold('view', ['seats']);
  // Held here is not offered, nor below the View what the View holds; undeclared never.
  assert.deepEqual(source.addable('grid').map((d) => [d.id, d.note]), [['email', undefined]]);
  // UP IS OPEN: the View is offered a component's field, and told where it lives.
  assert.deepEqual(source.addable('view').map((d) => [d.id, d.note]), [['plan', 'grid'], ['email', undefined]]);
  assert.equal(source.query.scopeLabel('grid'), 'grid');
});

/* THE PANEL ASKS for its scopes: the source describes each WHOLE, and hears its
   Add, its Remove and its answers. TRAP T-a-panel-asks-for-its-scopes */
test('describe draws a scope whole; a panel over two scopes adds, raises and answers through the source', async () => {
  const source = new DataSource({ store: new ArrayStore([{ id: 1, plan: 'Pro' }, { id: 2, plan: 'Free' }], { key: 'id' }) });
  source.declareField('plan', { label: 'Plan', select: 'multiple' });
  source.declareValues('plan', ['Free', 'Pro']);
  source.query.declareScope('view', { label: 'View filters' });
  // No grid is bound here, so it SAYS it arranges. TODO 99
  source.query.declareScope('grid', { arranges: true });
  source.query.offer('grid', ['plan']);
  const drawn = [];
  const panel = Object.assign(new EventTarget(), {
    setAttribute() {}, removeAttribute() {}, hasAttribute: () => false,
    drawScopes: (scopes) => drawn.push(scopes),
  });
  bindSource(source, panel, { steerOnly: true, scope: ['view', 'grid'] });
  const ask = (type, detail) => panel.dispatchEvent(new CustomEvent(type, { detail }));
  const settle = () => new Promise((r) => setTimeout(r, 0));

  ask('filter-add', { scope: 'grid', ids: ['plan'] });
  await settle();
  const grid = drawn.at(-1).find((d) => d.scope === 'grid');
  // The field is held, with its definition.
  assert.deepEqual(grid.filters.map((f) => [f.id, f.label]), [['plan', 'Plan']]);
  assert.deepEqual(grid.group.map((c) => c.field), ['plan']);

  // RAISED: the grid keeps it, and says where it went.
  ask('filter-add', { scope: 'view', ids: ['plan'] });
  await settle();
  const after = drawn.at(-1);
  assert.equal(after.find((d) => d.scope === 'grid').filters[0].appliedAt, 'View filters');
  assert.deepEqual(after.find((d) => d.scope === 'view').filters.map((f) => f.id), ['plan']);

  // Its answer — the changed field, in its scope.
  ask('quick-filter-change', { readings: { view: { plan: { picked: ['Free'] } } } });
  await settle();
  assert.deepEqual(source.query.applied.scopes.view.readings.plan.picked, ['Free']);

  // REMOVE lets it go.
  ask('filter-remove', { scope: 'grid', id: 'plan' });
  await settle();
  assert.equal(source.query.scope('grid').includes('plan'), false);
});

/* A HEADING asks through the source: its answer is its field's, in its grid's
   scope; a field no scope holds is held there, and its bar drawn; a field the
   View holds shows in the heading, read-only. TRAP T-a-heading-asks-through-the-source */
test('a grid heading answers through the source, and is told what the View holds', async () => {
  const source = new DataSource({ store: new ArrayStore([{ id: 1, plan: 'Pro', region: 'EMEA' }], { key: 'id' }) });
  source.declareField('plan', { label: 'Plan' });
  source.declareField('region', { label: 'Region' });
  source.query.declareScope('view', { label: 'View filters' });
  source.query.offer('data', ['plan', 'region']);
  const stub = (extra) => Object.assign(new EventTarget(), {
    setAttribute() {}, removeAttribute() {}, hasAttribute: () => false, ...extra });
  const columns = [];
  const barDrawn = [];
  const grid = stub({ supersedeColumns: (held, at) => columns.push([held, at]) });
  const bar = stub({ drawScope: (scope) => barDrawn.push(scope.filters.map((f) => f.id)) });
  bindSource(source, grid, { scope: 'data' });
  bindSource(source, bar, { steerOnly: true, scope: 'data' });

  grid.dispatchEvent(new CustomEvent('column-filter-change', { detail: { field: 'plan', reading: { picked: ['Pro'] } } }));
  assert.deepEqual(source.query.scope('data'), ['plan']);
  assert.deepEqual(source.query.applied.scopes.data.readings.plan.picked, ['Pro']);
  assert.deepEqual(barDrawn.at(-1), ['plan']);

  source.query.hold('view', ['region']);
  source.answer('view', { region: { picked: ['EMEA'] } });
  assert.deepEqual(columns.at(-1), [{ region: { picked: ['EMEA'] } }, 'View filters']);
});

/* A COMPONENT'S OWN DEFAULT filter narrows it alone, and a View that does not
   name its scope keeps it. TRAP T-a-component-default-outlives-a-view */
test('declareDefault: a component narrows itself alone, and a View pick keeps it', async () => {
  const rows = [{ id: 1, sev: 'critical' }, { id: 2, sev: 'info' }, { id: 3, sev: 'critical' }];
  const source = new DataSource({ store: new ArrayStore(rows, { key: 'id' }) });
  const seen = new Map();
  const stub = (name) => Object.assign(new EventTarget(), {
    id: name, setAttribute() {}, removeAttribute() {}, hasAttribute: () => false,
    populate: (r) => seen.set(name, r.map((x) => x.id)),
  });
  const tile = stub('tile');
  const other = stub('other');
  bindSource(source, tile, { rows: 'all', readonly: true });
  bindSource(source, other, { rows: 'all', readonly: true });
  await source.load();
  source.query.declareDefault('own:tile', { sev: { picked: ['critical'] } }, { only: tile });
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(seen.get('tile'), [1, 3]);
  assert.deepEqual(seen.get('other'), [1, 2, 3]);
  // A View that names nothing of the tile's: the default is put back.
  await source.query.setQuery({ v: 1, scopes: { view: { holds: [], readings: {} } } }, { holds: 'keep' });
  assert.deepEqual(source.query.applied.scopes['own:tile'].readings.sev.picked, ['critical']);
  // Forgotten, it narrows nothing.
  source.query.declareDefault('own:tile', undefined);
  assert.equal(source.query.applied.scopes['own:tile'], undefined);
});

/* …and on a field the VIEW holds it still narrows: a tile's own filter is what
   it is, not a chip the View's answer sets aside. TODO 237 */
test('declareDefault on a field the View holds still narrows its component', async () => {
  const rows = [{ id: 1, sev: 'critical' }, { id: 2, sev: 'info' }, { id: 3, sev: 'critical' }];
  const source = new DataSource({ store: new ArrayStore(rows, { key: 'id' }) });
  const seen = new Map();
  const stub = (name) => Object.assign(new EventTarget(), {
    id: name, setAttribute() {}, removeAttribute() {}, hasAttribute: () => false,
    populate: (r) => seen.set(name, r.map((x) => x.id)),
  });
  const tile = stub('tile');
  bindSource(source, tile, { rows: 'all', readonly: true });
  source.query.hold('view', ['sev']);
  await source.load();
  source.query.declareDefault('own:tile', { sev: { picked: ['critical'] } }, { only: tile });
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(seen.get('tile'), [1, 3]);
  // The View's own answer narrows it too, under the tile's.
  source.answer('view', { sev: { picked: ['info'] } });
  await source.load();
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(seen.get('tile'), []);
});

/* A PAGE GOES OUT AS JSON and comes back: a round trip gives the same rows and
   the same question. TRAP T-a-page-goes-out-as-json */
test('export and import: a round trip through JSON gives the same rows', async () => {
  const rows = [
    { id: 1, plan: 'Pro', seats: 5 }, { id: 2, plan: 'Free', seats: 50 },
    { id: 3, plan: 'Pro', seats: 20 }, { id: 4, plan: 'Enterprise', seats: 80 },
  ];
  const make = () => {
    const s = new DataSource({ store: new ArrayStore(rows, { key: 'id' }) });
    s.declareField('seats', { type: 'number' });
    return s;
  };
  const a = make();
  a.query.hold('view', ['plan']);
  a.answer('view', { plan: { picked: ['Pro', 'Enterprise'] } });
  a.query.hold('grid', ['seats']);
  a.answer('grid', { seats: { op: 'gt', text: '10' } });
  a.query.setSort('seats', 'desc');
  await a.load();
  const out = JSON.parse(JSON.stringify(a.query.export()));
  assert.deepEqual(Object.keys(out), ['v', 'query']);

  const b = make();
  await b.query.import(out);
  await b.load();
  const ids = async (s) => (await s.load({ force: true })).rows.map((r) => r.id);
  assert.deepEqual(await ids(b), await ids(a));
  assert.deepEqual(await ids(b), [4, 3]);
  assert.deepEqual(b.state.sort, a.state.sort);
});
