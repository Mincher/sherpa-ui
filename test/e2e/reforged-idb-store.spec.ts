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
 */

/** A fresh database per test, so one test's records cannot be another's. */
let seq = 0;
const freshDb = (): string => `sherpa-test-${Date.now()}-${++seq}`;

test('records survive a full CRUD round trip, and a reload', async ({ page }) => {
  const r = await page.evaluate(async (database) => {
    const { IdbStore } = await import('/dist/index.js');
    const store = new IdbStore({ name: 'customers', key: 'id', database });

    const inserted = await store.insert({ id: 1, name: 'Ada', tier: 'Gold' });
    await store.insert({ id: 2, name: 'Grace', tier: 'Silver' });

    const updated = await store.update(1, { tier: 'Platinum' });
    const afterUpdate = await store.byKey(1);

    await store.remove(2);
    const gone = await store.byKey(2);
    const left = await store.load();

    // A SECOND store over the same database is what a reload looks like — the
    // records must be there without anything re-seeding them.
    store.close();
    const reopened = new IdbStore({ name: 'customers', key: 'id', database });
    const afterReload = await reopened.load();
    reopened.close();

    return {
      inserted,
      // MERGE, not replace — `name` survives an update that only named `tier`.
      updated,
      afterUpdate,
      gone,
      total: left.total,
      afterReload: afterReload.rows,
    };
  }, freshDb());

  expect(r.inserted).toEqual({ id: 1, name: 'Ada', tier: 'Gold' });
  expect(r.updated).toEqual({ id: 1, name: 'Ada', tier: 'Platinum' });
  expect(r.afterUpdate).toEqual({ id: 1, name: 'Ada', tier: 'Platinum' });
  expect(r.gone).toBeUndefined();
  expect(r.total).toBe(1);
  // THE POINT OF THE WHOLE STORE: the record outlived the connection.
  expect(r.afterReload).toEqual([{ id: 1, name: 'Ada', tier: 'Platinum' }]);
});

test('an INDEX narrows the read without changing the answer', async ({ page }) => {
  // TRAP T-idb-index-narrows-it-never-answers-it — the same rows come back
  // whether or not a field is indexed. That is what makes an index safe to add.
  const r = await page.evaluate(async (database) => {
    const { IdbStore } = await import('/dist/index.js');
    const rows = Array.from({ length: 60 }, (_, i) => ({
      id: i + 1,
      tier: ['Gold', 'Silver', 'Bronze'][i % 3],
      spend: i * 10,
    }));

    const indexed = new IdbStore({ name: 'a', key: 'id', database, indexes: ['tier', 'spend'] });
    const plain = new IdbStore({ name: 'b', key: 'id', database: `${database}-plain` });
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

    indexed.close();
    plain.close();
    return { eq, range, and, or, contains };
  }, freshDb());

  // Every shape agrees with the unindexed store. If an index ever changed an
  // answer, this is where it would show.
  expect(r.eq.indexed).toEqual(r.eq.plain);
  expect(r.range.indexed).toEqual(r.range.plain);
  expect(r.and.indexed).toEqual(r.and.plain);
  expect(r.or.indexed).toEqual(r.or.plain);
  expect(r.contains.indexed).toEqual(r.contains.plain);

  // …and the answers are the RIGHT ones, not merely equal to each other.
  expect(r.eq.total).toBe(20);
  expect(r.range.indexed).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]);
  expect(r.contains.total).toBe(20); // 'Gold' contains 'ol'; Silver and Bronze do not
});

test('putAll is ONE transaction and ONE change event', async ({ page }) => {
  // TRAP T-idb-bulk-is-one-transaction — 2,000 rows through insert() is 2,000
  // transactions and 2,000 events, and a bound DataSource would reload 2,000
  // times.
  const r = await page.evaluate(async (database) => {
    const { IdbStore } = await import('/dist/index.js');
    const store = new IdbStore({ name: 'bulk', key: 'id', database });

    let events = 0;
    store.addEventListener('change', () => { events += 1; });

    const rows = Array.from({ length: 2000 }, (_, i) => ({ id: i + 1, n: i }));
    const written = await store.putAll(rows);
    const loaded = await store.load();

    // REPLACE clears first — a row the server deleted must not survive locally.
    await store.putAll([{ id: 1, n: 0 }], { replace: true });
    const afterReplace = await store.load();

    store.close();
    return { written, total: loaded.total, events, afterReplace: afterReplace.total };
  }, freshDb());

  expect(r.written).toBe(2000);
  expect(r.total).toBe(2000);
  expect(r.events).toBe(2); // one per putAll, not one per row
  expect(r.afterReplace).toBe(1);
});

test('a schema refuses a bad write and DROPS a bad read', async ({ page }) => {
  // The same split every store in this layer makes: a WRITE throws (someone is
  // adding it on purpose), a READ drops (one bad row must not empty a grid).
  const r = await page.evaluate(async (database) => {
    const { IdbStore, rules, required } = await import('/dist/index.js');
    const schema = rules({ name: required() });
    const store = new IdbStore({ name: 'checked', key: 'id', database, schema });

    let threw = '';
    try {
      await store.insert({ id: 1, name: '' });
    } catch (error) {
      threw = (error as Error).name;
    }

    // A bad row written WITHOUT the schema, then read back WITH it.
    const raw = new IdbStore({ name: 'checked', key: 'id', database });
    await raw.putAll([{ id: 2, name: 'ok' }, { id: 3, name: '' }]);
    const read = await store.load();

    store.close();
    raw.close();
    return { threw, rows: read.rows.length, total: read.total, dropped: read.dropped };
  }, freshDb());

  expect(r.threw).toBe('ValidationError');
  expect(r.rows).toBe(1);
  // TRAP T-dropped-rows-must-be-countable — the total drops with the rows.
  expect(r.total).toBe(1);
  expect(r.dropped).toBe(1);
});

test('a DataSource binds to an IdbStore exactly as it binds to any other', async ({ page }) => {
  // The whole reason the Store interface exists: a view moves from an array to
  // IndexedDB without touching a component.
  const r = await page.evaluate(async (database) => {
    const { IdbStore, DataSource } = await import('/dist/index.js');
    const store = new IdbStore({ name: 'bound', key: 'id', database, indexes: ['tier'] });
    await store.putAll(
      Array.from({ length: 30 }, (_, i) => ({
        id: i + 1,
        tier: ['Gold', 'Silver', 'Bronze'][i % 3],
      })),
    );

    const source = new DataSource({ store, pageSize: 10 });
    await source.load();
    const firstPage = { rows: source.rows.length, total: source.total, pages: source.totalPages };

    source.setFilter(['tier', 'eq', 'Gold']);
    await source.load();
    const filtered = { rows: source.rows.length, total: source.total };

    // A store MUTATION reloads every bound component — the `change` event.
    await store.insert({ id: 99, tier: 'Gold' });
    await new Promise((resolve) => setTimeout(resolve, 50));
    const afterInsert = source.total;

    store.close();
    return { firstPage, filtered, afterInsert };
  }, freshDb());

  expect(r.firstPage).toEqual({ rows: 10, total: 30, pages: 3 });
  expect(r.filtered).toEqual({ rows: 10, total: 10 });
  expect(r.afterInsert).toBe(11);
});

test('maxRows keeps a local cache bounded, oldest out', async ({ page }) => {
  const r = await page.evaluate(async (database) => {
    const { IdbStore } = await import('/dist/index.js');
    // An ASCENDING key, which is what makes "oldest" honest here — the doc says
    // to pair maxRows with one.
    const store = new IdbStore({ name: 'capped', key: 'id', database, maxRows: 5 });
    await store.putAll(Array.from({ length: 12 }, (_, i) => ({ id: i + 1 })));
    const after = await store.load();

    await store.insert({ id: 99 });
    const afterInsert = await store.load();

    store.close();
    return {
      kept: after.rows.map((row: Record<string, unknown>) => row['id']),
      afterInsert: afterInsert.rows.map((row: Record<string, unknown>) => row['id']),
    };
  }, freshDb());

  expect(r.kept).toEqual([8, 9, 10, 11, 12]);
  // A single insert holds the cap too, not just a bulk write.
  expect(r.afterInsert).toEqual([9, 10, 11, 12, 99]);
});

test('syncViews keeps saved views in IndexedDB and pushes them onward', async ({ page }) => {
  // TRAP T-local-first-then-onward — the three tiers, and LOCAL WINNING on a
  // clash. This is the one that matters: a view edited here and not yet pushed
  // must not be replaced by the server's older copy.
  const r = await page.evaluate(async (database) => {
    const { syncViews, saveViewAs } = await import('/dist/index.js');

    sessionStorage.clear();
    localStorage.clear();

    const pushes: unknown[] = [];
    const remote = {
      pull: () => Promise.resolve({
        // The server has an OLD copy of a view the user has since renamed…
        mine: { label: 'Server copy', snapshot: { v: 1 } },
        // …and one this device has never seen.
        theirs: { label: 'From another device', snapshot: { v: 1 } },
      }),
      push: (_page: string, views: unknown) => {
        pushes.push(views);
        return Promise.resolve();
      },
    };

    // A LOCAL view, in Web Storage — the fast tier persistView restores from.
    saveViewAs('records', 'Mine', {}, {});

    const sync = syncViews('records', { remote, interval: 20, database });
    const restored = await sync.restore();

    sync.touch();
    await sync.flush();
    await sync.stop();

    // A FRESH sync over the same database, with NO Web Storage — which is what
    // a different browser profile, or cleared site data, looks like. The
    // IndexedDB tier must still answer.
    sessionStorage.clear();
    localStorage.clear();
    const second = syncViews('records', { database });
    const fromIdbOnly = await second.all();
    await second.stop();

    return {
      restored: Object.keys(restored).sort(),
      // LOCAL WON: the label is this device's, not the server's.
      label: (restored as Record<string, { label: string }>)['mine']?.label,
      pushed: pushes.length,
      fromIdbOnly: Object.keys(fromIdbOnly).sort(),
    };
  }, freshDb());

  // Both tiers merged: the server's view AND this device's.
  expect(r.restored).toEqual(['mine', 'theirs']);
  expect(r.label).toBe('Mine');
  expect(r.pushed).toBe(1);
  // The durable tier held them after Web Storage was wiped.
  expect(r.fromIdbOnly).toEqual(['mine', 'theirs']);
});
