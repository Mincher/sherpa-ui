import { test, expect } from './harness';

/**
 * IdbStore — the real local store, in a real browser.
 *
 * The headless test proves it REPORTS its absence in Node. This proves it works
 * where it exists: a CRUD round trip, an index that narrows without changing
 * the answer, a bulk write in one transaction, and the cap.
 *
 * TRAP T-idb-is-the-only-real-local-store
 * TRAP T-idb-index-narrows-it-never-answers-it
 * TRAP T-idb-bulk-is-one-transaction
 * TRAP T-a-held-set-takes-a-change-in-place
 * TRAP T-a-store-keeps-its-history
 */

test('records survive a full CRUD round trip, and a reload', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { IdbStore } = await import('/dist/index.js');
    const store = new IdbStore({ name: 'customers', key: 'id' });

    const inserted = await store.insert({ id: 1, name: 'Ada', tier: 'Gold' });
    await store.insert({ id: 2, name: 'Grace', tier: 'Silver' });

    const updated = await store.update(1, { tier: 'Platinum' });
    const afterUpdate = await store.byKey(1);

    await store.remove(2);
    const gone = await store.byKey(2);
    const left = await store.load();

    // A SECOND store of the same name reads the same rows, with nothing re-seeding
    // them; Demos' records-persist spec proves a real reload.
    const reopened = new IdbStore({ name: 'customers', key: 'id' });
    const afterReload = await reopened.load();

    return {
      inserted,
      // MERGE, not replace — `name` survives an update that only named `tier`.
      updated,
      afterUpdate,
      gone,
      total: left.total,
      afterReload: afterReload.rows,
    };
  });

  expect(r.inserted).toEqual({ id: 1, name: 'Ada', tier: 'Gold' });
  expect(r.updated).toEqual({ id: 1, name: 'Ada', tier: 'Platinum' });
  expect(r.afterUpdate).toEqual({ id: 1, name: 'Ada', tier: 'Platinum' });
  expect(r.gone).toBeUndefined();
  expect(r.total).toBe(1);
  // THE POINT OF THE WHOLE STORE: the record outlived the object that wrote it.
  expect(r.afterReload).toEqual([{ id: 1, name: 'Ada', tier: 'Platinum' }]);
});

/* 345 phase 3: an update names the fields whose values moved, and the History keeps them. */
test('an update announces only the fields that moved', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { IdbStore } = await import('/dist/index.js');
    const store = new IdbStore({ name: 'customers', key: 'id' });
    await store.insert({ id: 1, name: 'Ada', tier: 'Gold', seats: 10 });
    const heard: unknown[] = [];
    store.addEventListener('change', (e) => heard.push((e as CustomEvent<{ fields?: string[] }>).detail.fields));
    const at = store.history!.seq;
    // A form sends every field back; one moved.
    await store.update(1, { id: 1, name: 'Ada', tier: 'Platinum', seats: 10 });
    const since = store.history!.since(at);
    return { heard, since };
  });
  expect(r.heard).toEqual([['tier']]);
  expect(r.since).toEqual({ rows: false, fields: ['tier'] });
});

test('an INDEX narrows the read without changing the answer', async ({ page }) => {
  // TRAP T-idb-index-narrows-it-never-answers-it — the same rows come back
  // whether or not a field is indexed. That is what makes an index safe to add.
  const r = await page.evaluate(async () => {
    const { IdbStore } = await import('/dist/index.js');
    const rows = Array.from({ length: 60 }, (_, i) => ({
      id: i + 1,
      tier: ['Gold', 'Silver', 'Bronze'][i % 3],
      spend: i * 10,
    }));

    const indexed = new IdbStore({ name: 'a', key: 'id', indexes: ['tier', 'spend'] });
    const plain = new IdbStore({ name: 'b', key: 'id' });
    await indexed.putAll(rows);
    await plain.putAll(rows);

    const same = async (options: Record<string, unknown>) => {
      const one = await indexed.load(options);
      const two = await plain.load(options);
      return {
        indexed: one.rows.map((row: Record<string, unknown>) => row['id']),
        plain: two.rows.map((row: Record<string, unknown>) => row['id']),
        total: one.total,
      };
    };

    const eq = await same({ filter: ['tier', 'eq', 'Gold'] });
    const range = await same({ filter: ['spend', 'between', [100, 200]] });
    // An AND narrows by one arm; the other still runs in applyOptions.
    const and = await same({ filter: ['and', ['tier', 'eq', 'Gold'], ['spend', 'gt', 300]] });
    // An OR cannot narrow at all — it must read everything and still be right.
    const or = await same({ filter: ['or', ['tier', 'eq', 'Gold'], ['spend', 'lt', 20]] });
    // A STRING operator is not expressible as a range, so it reads everything.
    const contains = await same({ filter: ['tier', 'contains', 'ol'] });
    /* THE CASE THAT BROKE IT. applyOptions lower-cases both sides, an
       IndexedDB index is byte-exact, so `IDBKeyRange.only('gold')` skipped
       every 'Gold' row. The seek ANSWERED the query instead of narrowing it.
       Every earlier case here matched exactly, which is why it went unseen. */
    const lower = await same({ filter: ['tier', 'eq', 'gold'] });
    const lowerRange = await same({ filter: ['tier', 'between', ['bronze', 'gold']] });

    return { eq, range, and, or, contains, lower, lowerRange };
  });

  // Every shape agrees with the unindexed store. If an index ever changed an
  // answer, this is where it would show.
  expect(r.eq.indexed).toEqual(r.eq.plain);
  expect(r.range.indexed).toEqual(r.range.plain);
  expect(r.and.indexed).toEqual(r.and.plain);
  expect(r.or.indexed).toEqual(r.or.plain);
  expect(r.contains.indexed).toEqual(r.contains.plain);
  expect(r.lower.indexed).toEqual(r.lower.plain);
  expect(r.lowerRange.indexed).toEqual(r.lowerRange.plain);

  // …and the answers are the RIGHT ones, not merely equal to each other.
  expect(r.eq.total).toBe(20);
  expect(r.range.indexed).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]);
  expect(r.contains.total).toBe(20); // 'Gold' contains 'ol'; Silver and Bronze do not
  // 20 Gold rows, found by a lower-case ask. This read 0 before the fix.
  expect(r.lower.total).toBe(20);
});

test('putAll is ONE transaction and ONE change event', async ({ page }) => {
  // TRAP T-idb-bulk-is-one-transaction — 2,000 rows through insert() is 2,000
  // transactions and 2,000 events, and a bound DataSource would reload 2,000
  // times.
  const r = await page.evaluate(async () => {
    const { IdbStore } = await import('/dist/index.js');
    const store = new IdbStore({ name: 'bulk', key: 'id' });

    let events = 0;
    store.addEventListener('change', () => { events += 1; });

    const rows = Array.from({ length: 2000 }, (_, i) => ({ id: i + 1, n: i }));
    const written = await store.putAll(rows);
    const loaded = await store.load();

    // REPLACE clears first — a row the server deleted must not survive locally.
    await store.putAll([{ id: 1, n: 0 }], { replace: true });
    const afterReplace = await store.load();

    return { written, total: loaded.total, events, afterReplace: afterReplace.total };
  });

  expect(r.written).toBe(2000);
  expect(r.total).toBe(2000);
  expect(r.events).toBe(2); // one per putAll, not one per row
  expect(r.afterReplace).toBe(1);
});

test('a schema refuses a bad write and DROPS a bad read', async ({ page }) => {
  // The same split every store in this layer makes: a WRITE throws (someone is
  // adding it on purpose), a READ drops (one bad row must not empty a grid).
  const r = await page.evaluate(async () => {
    const { IdbStore, rules, required } = await import('/dist/index.js');
    const schema = rules({ name: required() });
    const store = new IdbStore({ name: 'checked', key: 'id', schema });

    let threw = '';
    try {
      await store.insert({ id: 1, name: '' });
    } catch (error) {
      threw = (error as Error).name;
    }

    // A bad row written WITHOUT the schema, then read back WITH it.
    const raw = new IdbStore({ name: 'checked', key: 'id' });
    await raw.putAll([{ id: 2, name: 'ok' }, { id: 3, name: '' }]);
    const read = await store.load();

    return { threw, rows: read.rows.length, total: read.total, dropped: read.dropped };
  });

  expect(r.threw).toBe('ValidationError');
  expect(r.rows).toBe(1);
  // TRAP T-dropped-rows-must-be-countable — the total drops with the rows.
  expect(r.total).toBe(1);
  expect(r.dropped).toBe(1);
});

/* Will, TODO 160: "Row count was set to 25. Not all data grid pages had 25
   rows." A database that has lived a while holds rows an older schema let in.
   Each one the page held was dropped AFTER the page was cut.
   TRAP T-a-refused-row-never-shortens-a-page */
test('rows the schema refuses never shorten a page', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { IdbStore, rules, required } = await import('/dist/index.js');
    // Written WITHOUT the schema, as an older build wrote them: three have no name.
    const raw = new IdbStore({ name: 'aged', key: 'id' });
    const bad = new Set([3, 8, 15]);
    await raw.putAll(Array.from({ length: 30 }, (_, i) => ({ id: i + 1, name: bad.has(i + 1) ? '' : `Row ${i + 1}` })));
    const store = new IdbStore({ name: 'aged', key: 'id', schema: rules({ name: required() }) });
    const pages = [];
    for (const skip of [0, 10, 20]) pages.push(await store.load({ skip, take: 10 }));
    return pages.map((p) => ({ rows: p.rows.length, total: p.total, dropped: p.dropped }));
  });

  expect(r).toEqual([
    { rows: 10, total: 27, dropped: 3 },
    { rows: 10, total: 27, dropped: 3 },
    { rows: 7, total: 27, dropped: 3 },
  ]);
});

test('a DataSource binds to an IdbStore exactly as it binds to any other', async ({ page }) => {
  // The whole reason the Store interface exists: a view moves from an array to
  // IndexedDB without touching a component.
  const r = await page.evaluate(async () => {
    const { IdbStore, DataSource } = await import('/dist/index.js');
    const store = new IdbStore({ name: 'bound', key: 'id', indexes: ['tier'] });
    await store.putAll(
      Array.from({ length: 30 }, (_, i) => ({
        id: i + 1,
        tier: ['Gold', 'Silver', 'Bronze'][i % 3],
      })),
    );

    const source = new DataSource({ store, pageSize: 10 });
    await source.load();
    const firstPage = { rows: source.rows.length, total: source.total, pages: source.totalPages };

    source.query.ask({ scope: 'view', field: 'tier', reading: { picked: ['Gold'] } });
    await source.load();
    const filtered = { rows: source.rows.length, total: source.total };

    // A store MUTATION reloads every bound component — the `change` event.
    await store.insert({ id: 99, tier: 'Gold' });
    await new Promise((resolve) => setTimeout(resolve, 50));
    const afterInsert = source.total;

    return { firstPage, filtered, afterInsert };
  });

  expect(r.firstPage).toEqual({ rows: 10, total: 30, pages: 3 });
  expect(r.filtered).toEqual({ rows: 10, total: 10 });
  expect(r.afterInsert).toBe(11);
});

test('maxRows keeps a local cache bounded, oldest out', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { IdbStore } = await import('/dist/index.js');
    // An ASCENDING key, which is what makes "oldest" honest here — the doc says
    // to pair maxRows with one.
    const store = new IdbStore({ name: 'capped', key: 'id', maxRows: 5 });
    await store.putAll(Array.from({ length: 12 }, (_, i) => ({ id: i + 1 })));
    const after = await store.load();

    let trimmed: unknown;
    store.addEventListener('change', (e: Event) => { trimmed = (e as CustomEvent).detail.trimmed; });
    await store.insert({ id: 99 });
    const afterInsert = await store.load();

    return {
      kept: after.rows.map((row: Record<string, unknown>) => row['id']),
      afterInsert: afterInsert.rows.map((row: Record<string, unknown>) => row['id']),
      trimmed,
    };
  });

  expect(r.kept).toEqual([8, 9, 10, 11, 12]);
  // A single insert holds the cap too, not just a bulk write.
  expect(r.afterInsert).toEqual([9, 10, 11, 12, 99]);
  // …and says which rows the cap took, so a held set drops them too.
  expect(r.trimmed).toEqual([8]);
});

test('the keeper keeps the reader\'s Views in IndexedDB and pushes them onward', async ({ page }) => {
  // TRAP T-local-first-then-onward — the three tiers, and LOCAL WINNING on a
  // clash. This is the one that matters: a view edited here and not yet pushed
  // must not be replaced by the server's older copy.
  const r = await page.evaluate(async () => {
    const { PageKeeper } = await import('/dist/index.js');

    sessionStorage.clear();
    localStorage.clear();

    const pushes: unknown[] = [];
    const remote = {
      pull: () => Promise.resolve({ views: {
        // The server has an OLD copy of a view the user has since renamed…
        mine: { label: 'Server copy', ui: {} },
        // …and one this device has never seen.
        theirs: { label: 'From another device', ui: {} },
      } }),
      push: (_page: string, named: unknown) => {
        pushes.push(named);
        return Promise.resolve();
      },
    };

    const keeper = new PageKeeper({ database: true, remote, interval: 20 });
    // A LOCAL view, in Web Storage — the fast tier a page reads first.
    keeper.write('records', { views: { mine: { label: 'Mine' } } });
    const restored = (await keeper.restore('records')).views ?? {};
    await keeper.flush();

    // A FRESH keeper over the same database, with NO Web Storage — which is what
    // a different browser profile, or cleared site data, looks like. The
    // IndexedDB tier must still answer.
    sessionStorage.clear();
    localStorage.clear();
    const fromIdbOnly = (await new PageKeeper({ database: true }).restore('records')).views ?? {};

    return {
      restored: Object.keys(restored).sort(),
      // LOCAL WON: the label is this device's, not the server's.
      label: restored['mine']?.label,
      pushed: pushes.length,
      fromIdbOnly: Object.keys(fromIdbOnly).sort(),
    };
  });

  // Both tiers merged: the server's view AND this device's.
  expect(r.restored).toEqual(['mine', 'theirs']);
  expect(r.label).toBe('Mine');
  expect(r.pushed).toBe(1);
  // The durable tier held them after Web Storage was wiped.
  expect(r.fromIdbOnly).toEqual(['mine', 'theirs']);
});

test('a view deleted here stays deleted: not merged back, not pushed, not in IndexedDB', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { PageKeeper } = await import('/dist/index.js');
    sessionStorage.clear();
    localStorage.clear();
    const pushes: { views?: Record<string, unknown> }[] = [];
    const remote = { pull: () => Promise.resolve({}), push: (_p: string, v: { views?: Record<string, unknown> }) => { pushes.push(v); return Promise.resolve(); } };
    const keeper = new PageKeeper({ database: true, remote, interval: 20 });
    keeper.write('records', { views: { keep: { label: 'Keep' }, gone: { label: 'Gone' } } });
    await keeper.flush();
    keeper.write('records', { views: { keep: { label: 'Keep' } } });
    await keeper.flush();
    const all = Object.keys(keeper.read('records').views ?? {}).sort();
    localStorage.clear();
    const fromIdbOnly = Object.keys((await new PageKeeper({ database: true }).restore('records')).views ?? {}).sort();
    return { all, pushed: Object.keys(pushes.at(-1)?.views ?? {}).sort(), fromIdbOnly };
  });
  expect(r).toEqual({ all: ['keep'], pushed: ['keep'], fromIdbOnly: ['keep'] });
});

/** ONE contract, every store: a changed key MOVES the row, and a key another
 *  row holds is refused. TRAP T-a-changed-key-moves-the-row */
test('every store: a changed key moves the row; a key another row holds is refused', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { IdbStore, ArrayStore, LocalStore, JsonStore } = await import('/dist/index.js');
    const run = async (store: {
      insert(r: unknown): Promise<unknown>; update(k: unknown, v: unknown): Promise<unknown>;
      load(): Promise<{ rows: { email: string }[] }>; byKey(k: unknown): Promise<unknown>;
    }) => {
      await store.insert({ email: 'ada@x', name: 'Ada' });
      await store.insert({ email: 'bo@x', name: 'Bo' });
      await store.update('ada@x', { email: 'ada@y' });
      let refused = false;
      try { await store.update('bo@x', { email: 'ada@y' }); } catch { refused = true; }
      const rows = (await store.load()).rows.map((row) => row.email).sort();
      return { rows, old: !!(await store.byKey('ada@x')), refused };
    };
    const idb = new IdbStore({ name: 'people', key: 'email' });
    localStorage.removeItem('contract-people');
    const out = {
      idb: await run(idb as never),
      array: await run(new ArrayStore([], { key: 'email' }) as never),
      local: await run(new LocalStore({ name: 'contract-people', key: 'email' }) as never),
      json: await run(new JsonStore({ url: 'data:application/json,[]', key: 'email' }) as never),
    };
    localStorage.removeItem('contract-people');
    return out;
  });
  // RestStore is not here: its server answers a changed key.
  const want = { rows: ['ada@y', 'bo@x'], old: false, refused: true };
  expect(r).toEqual({ idb: want, array: want, local: want, json: want });
});
