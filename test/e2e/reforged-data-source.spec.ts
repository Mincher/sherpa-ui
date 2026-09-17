import { test, expect } from '@playwright/test';

/**
 * The data layer — Store, DataSource, and binding many components to one source.
 *
 * These run in the BROWSER harness rather than node:test, and deliberately: the
 * modules are DOM-free, but the binding half is not, and Node 24 has no Temporal
 * for the date work that follows. One place for the whole layer beats a split
 * where half the rules are proven against a different runtime.
 */

const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(() => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true);
});

/**
 * The eight demo rows every test below shares.
 *
 * Passed into page.evaluate as an argument rather than built in the browser, so
 * one list drives every assertion and a change here cannot make two tests
 * disagree about what the data is.
 */
const ROWS = [
  { id: 1, name: 'Ada', plan: 'Pro', region: 'EMEA', seats: 10 },
  { id: 2, name: 'Grace', plan: 'Free', region: 'AMER', seats: 2 },
  { id: 3, name: 'Alan', plan: 'Enterprise', region: 'EMEA', seats: 90 },
  { id: 4, name: 'Katherine', plan: 'Pro', region: 'APAC', seats: 25 },
  { id: 5, name: 'item 10', plan: 'Free', region: 'EMEA', seats: 1 },
  { id: 6, name: 'item 2', plan: 'Free', region: 'AMER', seats: 3 },
  { id: 7, name: 'Zoe', plan: 'Pro', region: 'APAC', seats: 7 },
  // A null value, to prove blanks sort last in BOTH directions.
  { id: 8, name: 'Bob', plan: 'Enterprise', region: 'EMEA', seats: null },
];

/* ── The store's own rules ────────────────────────────────────────────────── */

test('sort: numbers compare numerically, text naturally, nulls sort LAST either way', async ({ page }) => {
  const got = await page.evaluate(async (data) => {
    const { ArrayStore } = await import('/dist/index.js');
    const store = new ArrayStore(data);
    const asc = await store.load({ sort: [{ field: 'seats', direction: 'asc' }] });
    const desc = await store.load({ sort: [{ field: 'seats', direction: 'desc' }] });
    const natural = await store.load({ sort: [{ field: 'name', direction: 'asc' }] });
    return {
      asc: asc.rows.map((r) => r['seats']),
      desc: desc.rows.map((r) => r['seats']),
      // "item 2" must precede "item 10" — the bug that made the grid and the
      // toolbar disagree was one compare passing { numeric: true } and one not.
      natural: natural.rows.map((r) => r['name']).filter((n) => String(n).startsWith('item')),
    };
  }, ROWS);

  expect(got.asc).toEqual([1, 2, 3, 7, 10, 25, 90, null]);
  // Reversing must NOT march the blank to the top: "no value" is not a big value.
  expect(got.desc).toEqual([90, 25, 10, 7, 3, 2, 1, null]);
  expect(got.natural).toEqual(['item 2', 'item 10']);
});

test('filter: eq is case-insensitive, in/between/contains behave', async ({ page }) => {
  const got = await page.evaluate(async (data) => {
    const { ArrayStore } = await import('/dist/index.js');
    const store = new ArrayStore(data);
    const names = (r: { rows: Record<string, unknown>[] }) => r.rows.map((x) => x['name']);
    return {
      // A chip's value is lower-case; the record's is "Pro". Strict equality
      // would filter everything away, silently.
      eq: names(await store.load({ filter: ['plan', 'eq', 'pro'] })),
      in: names(await store.load({ filter: ['region', 'in', ['EMEA', 'APAC']] })).length,
      between: names(await store.load({ filter: ['seats', 'between', [5, 30]] })),
      // Backwards range is still a range.
      backwards: names(await store.load({ filter: ['seats', 'between', [30, 5]] })),
      contains: names(await store.load({ filter: ['name', 'contains', 'ITEM'] })),
      and: names(await store.load({
        filter: ['and', ['plan', 'eq', 'Pro'], ['region', 'eq', 'EMEA']],
      })),
    };
  }, ROWS);

  expect(got.eq).toEqual(['Ada', 'Katherine', 'Zoe']);
  expect(got.in).toBe(6);
  expect(got.between).toEqual(['Ada', 'Katherine', 'Zoe']);
  expect(got.backwards).toEqual(['Ada', 'Katherine', 'Zoe']);
  expect(got.contains).toEqual(['item 10', 'item 2']);
  expect(got.and).toEqual(['Ada']);
});

test('paging: total counts the MATCHES, not the page', async ({ page }) => {
  const got = await page.evaluate(async (data) => {
    const { ArrayStore } = await import('/dist/index.js');
    const store = new ArrayStore(data);
    const page1 = await store.load({ take: 3, sort: [{ field: 'id' }] });
    const page2 = await store.load({ skip: 3, take: 3, sort: [{ field: 'id' }] });
    const filtered = await store.load({ filter: ['region', 'eq', 'EMEA'], take: 2 });
    return {
      page1: page1.rows.map((r) => r['id']),
      page2: page2.rows.map((r) => r['id']),
      total: page1.total,
      filteredIds: filtered.rows.length,
      filteredTotal: filtered.total,
    };
  }, ROWS);

  expect(got.page1).toEqual([1, 2, 3]);
  expect(got.page2).toEqual([4, 5, 6]);
  expect(got.total).toBe(8);
  // A pager needs the MATCH count to work out how many pages there are.
  expect(got.filteredIds).toBe(2);
  expect(got.filteredTotal).toBe(4);
});

test('store: rows are COPIED in and out — mutating one cannot rewrite the record', async ({ page }) => {
  const got = await page.evaluate(async (data) => {
    const { ArrayStore } = await import('/dist/index.js');
    const store = new ArrayStore(data);
    const loaded = await store.load();
    // A consumer mutating what it was handed must not silently edit the store.
    loaded.rows[0]!['name'] = 'MUTATED';
    const again = await store.load();
    // …and the source array must not be reachable either.
    data[1]!['name'] = 'ALSO MUTATED';
    const third = await store.load();
    return { first: again.rows[0]!['name'], second: third.rows[1]!['name'] };
  }, ROWS);

  expect(got.first).toBe('Ada');
  expect(got.second).toBe('Grace');
});

test('store: CRUD announces a change, and update MERGES rather than replacing', async ({ page }) => {
  const got = await page.evaluate(async (data) => {
    const { ArrayStore } = await import('/dist/index.js');
    const store = new ArrayStore(data);
    const events: string[] = [];
    store.addEventListener('change', (e) => events.push((e as CustomEvent).detail.type));

    await store.insert({ id: 9, name: 'New', plan: 'Pro', region: 'EMEA', seats: 5 });
    // ONE field sent — the rest of the record must survive.
    const updated = await store.update(9, { seats: 6 });
    await store.remove(9);
    const missing = await store.byKey(9);
    // A key arrives as a string from an attribute far more often than not.
    const byStringKey = await store.byKey('1');

    return {
      events,
      updatedName: updated['name'],
      updatedSeats: updated['seats'],
      missing: missing === undefined,
      byStringKey: byStringKey?.['name'],
    };
  }, ROWS);

  expect(got.events).toEqual(['insert', 'update', 'remove']);
  expect(got.updatedName).toBe('New');
  expect(got.updatedSeats).toBe(6);
  expect(got.missing).toBe(true);
  expect(got.byStringKey).toBe('Ada');
});

/* ── The DataSource ───────────────────────────────────────────────────────── */

test('source: one sort value, two controls — the grid and the toolbar cannot disagree', async ({ page }) => {
  // THE point of the layer. Both fire `sort-change` with the same detail shape,
  // so either one steering the source moves BOTH.
  const got = await page.evaluate(async (data) => {
    const { ArrayStore, DataSource } = await import('/dist/index.js');
    const root = document.getElementById('root')!;
    root.innerHTML = '';

    const grid = document.createElement('sherpa-data-grid') as HTMLElement & { rendered?: Promise<void> };
    const toolbar = document.createElement('sherpa-quick-filter-toolbar') as HTMLElement & { rendered?: Promise<void> };
    root.append(grid, toolbar);
    await grid.rendered;
    await toolbar.rendered;

    const source = new DataSource({ store: new ArrayStore(data) });
    source.bind(grid);
    source.bind(toolbar);
    await source.load();

    // The TOOLBAR steers…
    toolbar.dispatchEvent(
      new CustomEvent('sort-change', { detail: { field: 'seats', direction: 'desc' }, bubbles: true, composed: true }),
    );
    await new Promise((r) => setTimeout(r, 30));
    const afterToolbar = {
      gridField: grid.getAttribute('data-sort-field'),
      gridDirection: grid.getAttribute('data-sort-direction'),
      state: source.state.sort,
    };

    // …and the GRID steers, and the toolbar follows.
    grid.dispatchEvent(
      new CustomEvent('sort-change', { detail: { field: 'name', direction: 'asc' }, bubbles: true, composed: true }),
    );
    await new Promise((r) => setTimeout(r, 30));
    const afterGrid = {
      toolbarField: toolbar.getAttribute('data-sort-field'),
      toolbarDirection: toolbar.getAttribute('data-sort-direction'),
      state: source.state.sort,
    };

    return { afterToolbar, afterGrid };
  }, ROWS);

  // The toolbar's chip moved the GRID's header attributes — which is what draws
  // its sort arrow, in CSS, with no JS branch.
  expect(got.afterToolbar.gridField).toBe('seats');
  expect(got.afterToolbar.gridDirection).toBe('desc');
  expect(got.afterToolbar.state).toEqual([{ field: 'seats', direction: 'desc' }]);

  expect(got.afterGrid.toolbarField).toBe('name');
  expect(got.afterGrid.toolbarDirection).toBe('asc');
  expect(got.afterGrid.state).toEqual([{ field: 'name', direction: 'asc' }]);
});

test('source: one filter fans out to every bound component', async ({ page }) => {
  // The dashboard case — one change, N visualisations re-populated, no per
  // component wiring.
  const got = await page.evaluate(async (data) => {
    const { ArrayStore, DataSource } = await import('/dist/index.js');
    const root = document.getElementById('root')!;
    root.innerHTML = '';

    const counts: number[][] = [[], [], []];
    const made = [0, 1, 2].map((i) => {
      const el = document.createElement('div') as HTMLElement & { populate?: (d: unknown) => void };
      el.populate = (d: unknown) => counts[i]!.push((d as unknown[]).length);
      root.appendChild(el);
      return el;
    });

    const source = new DataSource({ store: new ArrayStore(data) });
    for (const el of made) source.bind(el);
    await source.load();
    const afterLoad = counts.map((c) => c.at(-1));

    source.setFilter(['region', 'eq', 'EMEA']);
    await new Promise((r) => setTimeout(r, 30));
    const afterFilter = counts.map((c) => c.at(-1));

    return { afterLoad, afterFilter };
  }, ROWS);

  expect(got.afterLoad).toEqual([8, 8, 8]);
  // All three, from ONE setFilter call.
  expect(got.afterFilter).toEqual([4, 4, 4]);
});

test('source: a readonly bind receives data but never steers', async ({ page }) => {
  const got = await page.evaluate(async (data) => {
    const { ArrayStore, DataSource } = await import('/dist/index.js');
    const root = document.getElementById('root')!;
    root.innerHTML = '';

    let populated = 0;
    const chart = document.createElement('div') as HTMLElement & { populate?: (d: unknown) => void };
    chart.populate = () => { populated++; };
    root.appendChild(chart);

    const source = new DataSource({ store: new ArrayStore(data) });
    source.bind(chart, { readonly: true });
    await source.load();

    // A readonly component's event must be IGNORED — a chart beside a steering
    // grid should re-draw on a filter change, but clicking it must not re-sort.
    chart.dispatchEvent(
      new CustomEvent('sort-change', { detail: { field: 'seats', direction: 'desc' }, bubbles: true, composed: true }),
    );
    await new Promise((r) => setTimeout(r, 30));
    const sortAfterEvent = source.state.sort;

    // …but it still receives data when the source changes.
    const before = populated;
    source.setFilter(['region', 'eq', 'EMEA']);
    await new Promise((r) => setTimeout(r, 30));
    return { sortAfterEvent, received: populated > before };
  }, ROWS);

  expect(got.sortAfterEvent).toEqual([]);
  expect(got.received).toBe(true);
});

test('source: a narrowing change returns to page 1 rather than stranding the user', async ({ page }) => {
  const got = await page.evaluate(async (data) => {
    const { ArrayStore, DataSource } = await import('/dist/index.js');
    const source = new DataSource({ store: new ArrayStore(data), pageSize: 3, sort: [{ field: 'id' }] });
    await source.load();

    source.setPage(3);
    await new Promise((r) => setTimeout(r, 20));
    const onPage3 = { page: source.state.page, ids: source.rows.map((r) => r['id']), pages: source.totalPages };

    // Filtering to 4 rows leaves only 2 pages — page 3 no longer exists.
    source.setFilter(['region', 'eq', 'EMEA']);
    await new Promise((r) => setTimeout(r, 30));
    const afterFilter = { page: source.state.page, count: source.rows.length, pages: source.totalPages };

    return { onPage3, afterFilter };
  }, ROWS);

  expect(got.onPage3).toEqual({ page: 3, ids: [7, 8], pages: 3 });
  // Back to page 1 with rows on it, NOT page 3 of a 2-page list.
  expect(got.afterFilter).toEqual({ page: 1, count: 3, pages: 2 });
});

test('source: a pager binds to the same source and gets its totals', async ({ page }) => {
  const got = await page.evaluate(async (data) => {
    const { ArrayStore, DataSource } = await import('/dist/index.js');
    const root = document.getElementById('root')!;
    root.innerHTML = '';
    const pager = document.createElement('sherpa-pagination') as HTMLElement & {
      rendered?: Promise<void>; page: number; totalPages: number;
    };
    root.appendChild(pager);
    await pager.rendered;

    const source = new DataSource({ store: new ArrayStore(data), pageSize: 3 });
    source.bind(pager);
    await source.load();
    const initial = { page: pager.page, totalPages: pager.totalPages };

    // The PAGER steers the source through its own page-change event.
    pager.dispatchEvent(new CustomEvent('page-change', { detail: { page: 2 }, bubbles: true, composed: true }));
    await new Promise((r) => setTimeout(r, 30));

    return { initial, sourcePage: source.state.page, pagerPage: pager.page };
  }, ROWS);

  expect(got.initial).toEqual({ page: 1, totalPages: 3 });
  expect(got.sourcePage).toBe(2);
  expect(got.pagerPage).toBe(2);
});

test('source: a store change reloads every bound component', async ({ page }) => {
  const got = await page.evaluate(async (data) => {
    const { ArrayStore, DataSource } = await import('/dist/index.js');
    const root = document.getElementById('root')!;
    root.innerHTML = '';
    const seen: number[] = [];
    const el = document.createElement('div') as HTMLElement & { populate?: (d: unknown) => void };
    el.populate = (d: unknown) => seen.push((d as unknown[]).length);
    root.appendChild(el);

    const store = new ArrayStore(data);
    const source = new DataSource({ store });
    source.bind(el);
    await source.load();

    // An insert on the STORE must reach a component bound to the SOURCE.
    await store.insert({ id: 9, name: 'New', plan: 'Pro', region: 'EMEA', seats: 5 });
    await new Promise((r) => setTimeout(r, 40));
    return { last: seen.at(-1) };
  }, ROWS);

  expect(got.last).toBe(9);
});

test('source: unbind stops both halves', async ({ page }) => {
  const got = await page.evaluate(async (data) => {
    const { ArrayStore, DataSource } = await import('/dist/index.js');
    const root = document.getElementById('root')!;
    root.innerHTML = '';
    let populated = 0;
    const el = document.createElement('div') as HTMLElement & { populate?: (d: unknown) => void };
    el.populate = () => { populated++; };
    root.appendChild(el);

    const source = new DataSource({ store: new ArrayStore(data) });
    const off = source.bind(el);
    await source.load();
    off();

    const before = populated;
    source.setFilter(['region', 'eq', 'EMEA']);
    await new Promise((r) => setTimeout(r, 30));
    // …and its events no longer steer.
    el.dispatchEvent(
      new CustomEvent('sort-change', { detail: { field: 'seats', direction: 'desc' }, bubbles: true, composed: true }),
    );
    await new Promise((r) => setTimeout(r, 20));

    return { stillPopulated: populated > before, sort: source.state.sort, bound: source.boundElements.length };
  }, ROWS);

  expect(got.stillPopulated).toBe(false);
  expect(got.sort).toEqual([]);
  expect(got.bound).toBe(0);
});

test('source: quick-filter chips become a real filter — OR within a chip, AND across', async ({ page }) => {
  const got = await page.evaluate(async (data) => {
    const { ArrayStore, DataSource } = await import('/dist/index.js');
    const root = document.getElementById('root')!;
    root.innerHTML = '';
    const el = document.createElement('div') as HTMLElement & { populate?: (d: unknown) => void };
    root.appendChild(el);

    const source = new DataSource({ store: new ArrayStore(data) });
    source.bind(el);
    await source.load();

    // One chip, two values: OR.
    el.dispatchEvent(new CustomEvent('quick-filter-change', {
      detail: { active: [], values: { plan: ['Pro', 'Enterprise'] } }, bubbles: true, composed: true,
    }));
    await new Promise((r) => setTimeout(r, 30));
    const oneChip = source.rows.length;

    // Two chips: AND between them.
    el.dispatchEvent(new CustomEvent('quick-filter-change', {
      detail: { active: [], values: { plan: ['Pro'], region: ['EMEA'] } }, bubbles: true, composed: true,
    }));
    await new Promise((r) => setTimeout(r, 30));
    const twoChips = source.rows.map((r) => r['name']);

    // Cleared: back to everything.
    el.dispatchEvent(new CustomEvent('quick-filter-change', {
      detail: { active: [], values: {} }, bubbles: true, composed: true,
    }));
    await new Promise((r) => setTimeout(r, 30));
    const cleared = source.rows.length;

    return { oneChip, twoChips, cleared };
  }, ROWS);

  expect(got.oneChip).toBe(5);
  expect(got.twoChips).toEqual(['Ada']);
  expect(got.cleared).toBe(8);
});

test('source: a slow earlier load never overwrites a newer one', async ({ page }) => {
  // Filter chips can be clicked faster than a request returns. Without a ticket
  // the first (slow) response would land last and show the wrong rows.
  const got = await page.evaluate(async () => {
    const { DataSource } = await import('/dist/index.js');
    const all = [{ id: 1, tag: 'a' }, { id: 2, tag: 'b' }];

    // A store whose FIRST load is slow and second is fast.
    let call = 0;
    const store = Object.assign(new EventTarget(), {
      key: 'id',
      async load(options: { filter?: unknown }) {
        call++;
        const delay = call === 1 ? 120 : 10;
        await new Promise((r) => setTimeout(r, delay));
        const tag = (options.filter as unknown[] | undefined)?.[2];
        const rows = tag ? all.filter((r) => r.tag === tag) : all;
        return { rows, total: rows.length };
      },
      byKey: async () => undefined,
      insert: async (v: unknown) => v,
      update: async (_k: unknown, v: unknown) => v,
      remove: async () => {},
      totalCount: async () => all.length,
    });

    const source = new DataSource({ store: store as never, autoLoad: false });

    // SEPARATE TICKS, deliberately. Two writes in one tick are COALESCED into a
    // single load (see the coalescing test below), which would mean only one
    // request ever reached the store — and then there would be no race to test.
    // A person clicking two chips produces two ticks, which is this.
    source.setFilter(['tag', 'eq', 'a']);   // slow
    await new Promise((r) => setTimeout(r, 0));
    source.setFilter(['tag', 'eq', 'b']);   // fast — must win
    await new Promise((r) => setTimeout(r, 250));
    return { rows: source.rows.map((r) => r['tag']), calls: call };
  });

  expect(got.calls).toBe(2);
  // The LAST filter asked for is what shows, not the one that answered last.
  expect(got.rows).toEqual(['b']);
});

test('source: writes in ONE tick coalesce into a single load', async ({ page }) => {
  // A view that sets a filter, a sort and a page size in one handler asked the
  // store three times and threw two answers away. A microtask — not a timer —
  // so a keystroke still queries on its own tick, and a debounce stays the
  // caller's policy rather than this layer's.
  const got = await page.evaluate(async () => {
    const { ArrayStore, DataSource } = await import('/dist/index.js');
    const rows = Array.from({ length: 50 }, (_, i) => ({ id: i, plan: i % 3 ? 'Pro' : 'Free' }));
    const store = new ArrayStore(rows, { key: 'id' });

    let calls = 0;
    const real = store.load.bind(store);
    (store as unknown as { load: unknown }).load = (o: unknown) => {
      calls += 1;
      return real(o as never);
    };

    const source = new DataSource({ store, autoLoad: false });
    await source.load();
    const afterFirst = calls;

    // THREE setters, one tick.
    source.setFilter(['plan', 'eq', 'Pro']);
    source.setSort('id', 'desc');
    source.setPageSize(10);
    await new Promise((r) => setTimeout(r, 60));

    return {
      coalesced: calls - afterFirst,
      // …and the LAST word of each setter is what was asked for.
      rows: source.rows.length,
      total: source.total,
      firstId: source.rows[0]?.['id'],
    };
  });

  expect(got.coalesced).toBe(1);        // not 3
  expect(got.rows).toBe(10);            // the page size applied
  expect(got.total).toBe(33);           // the filter applied
  expect(got.firstId).toBe(49);         // the sort applied
});

test('source: a failed load is a STATE, not a throw', async ({ page }) => {
  const got = await page.evaluate(async () => {
    const { DataSource } = await import('/dist/index.js');
    const store = Object.assign(new EventTarget(), {
      key: 'id',
      load: async () => { throw new Error('network down'); },
      byKey: async () => undefined,
      insert: async (v: unknown) => v,
      update: async (_k: unknown, v: unknown) => v,
      remove: async () => {},
      totalCount: async () => 0,
    });

    const source = new DataSource({ store: store as never, autoLoad: false });
    let errored = '';
    let loadingFlips = 0;
    source.addEventListener('error', (e) => { errored = String((e as CustomEvent).detail.error.message); });
    source.addEventListener('loading', () => { loadingFlips++; });

    // Must RESOLVE — a filter change that fails must not take down its caller.
    await source.load();
    return { errored, loadingFlips, rows: source.rows.length };
  });

  expect(got.errored).toBe('network down');
  // Loading goes on and comes back off, so a container's overlay cannot stick.
  expect(got.loadingFlips).toBe(2);
  expect(got.rows).toBe(0);
});

/**
 * steerOnly — the component's events reach the source, but no rows come back.
 *
 * The quick-filter toolbar's case: its populate() means "here are your CHIPS",
 * not "here are your rows", so a plain bind overwrote the bar with records and
 * it came back holding only Group and Sort. Without this it had to be
 * hand-wired with a listener per event — the tangle the layer exists to remove.
 */
test('source: steerOnly sends events but never pushes rows', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { ArrayStore, DataSource } = (await import('/dist/index.js')) as unknown as {
      ArrayStore: new (rows: unknown[]) => never;
      DataSource: new (o: unknown) => {
        load(): Promise<void>;
        bind(el: unknown, o?: unknown): void;
        state: { sort: { field: string }[] };
        rows: unknown[];
      };
    };

    const rows = [{ name: 'B', seats: 2 }, { name: 'A', seats: 9 }];
    const source = new DataSource({ store: new ArrayStore(rows) });

    // Two consumers: one ordinary, one steer-only.
    const fed: unknown[] = [];
    const grid = document.createElement('div') as HTMLElement & { populate(d: unknown): void };
    grid.populate = (d) => fed.push(d);

    const steererFed: unknown[] = [];
    const toolbar = document.createElement('div') as HTMLElement & { populate(d: unknown): void };
    toolbar.populate = (d) => steererFed.push(d);

    document.getElementById('root')!.replaceChildren(grid, toolbar);
    source.bind(grid);
    source.bind(toolbar, { steerOnly: true });
    await source.load();

    // The steer-only component STEERS.
    toolbar.dispatchEvent(
      new CustomEvent('sort-change', { bubbles: true, detail: { field: 'seats', direction: 'asc' } }),
    );
    await new Promise((res) => setTimeout(res, 50));

    return {
      // …and the source acted on it.
      sortField: source.state.sort[0]?.field,
      gridFed: fed.length > 0,
      // The state attributes still reach it, which is what keeps its Sort chip
      // and the grid's header arrow two views of ONE value.
      toolbarSortAttr: toolbar.getAttribute('data-sort-field'),
      // But it was never handed rows.
      toolbarFed: steererFed.length,
    };
  });

  expect(r.sortField).toBe('seats');
  expect(r.gridFed).toBe(true);
  expect(r.toolbarSortAttr).toBe('seats');
  expect(r.toolbarFed).toBe(0);
});

/**
 * A filter set ABOVE the grid has to reach the grid's headers.
 *
 * The grid cannot see a quick-filter toolbar's chips, and the source hands it
 * only the rows that survived — so on its own it has no way to know WHICH
 * column shrank the table. It just got smaller, with nothing to say why. The
 * source writes the narrowed field names onto `data-filter-fields`, and the
 * grid lights those columns with the Style `active` mode.
 */
test('a toolbar filter lights the matching COLUMN HEADERS in a bound grid', async ({ page }) => {
  const r = await page.evaluate(async (data) => {
    const { ArrayStore, DataSource } = await import('/dist/index.js');
    const root = document.getElementById('root')!;
    root.innerHTML = '';

    const grid = document.createElement('sherpa-data-grid') as HTMLElement & {
      rendered?: Promise<void>;
      populate(d: unknown): void;
    };
    root.appendChild(grid);
    await grid.rendered;

    // The grid's populate() takes { columns, rows }, so the bind carries an
    // adapter — otherwise a bare row array would wipe the columns.
    const columns = [
      { field: 'name', header: 'Name' },
      { field: 'plan', header: 'Plan' },
      { field: 'region', header: 'Region' },
      { field: 'seats', header: 'Seats', type: 'number' },
    ];
    const source = new DataSource({ store: new ArrayStore(data) });
    source.bind(grid, { as: (rows: unknown[]) => ({ columns, rows }) });
    await source.load();
    const settle = () => (window as unknown as { __settled: () => Promise<void> }).__settled();
    await settle();

    const sr = grid.shadowRoot!;
    const lit = (): (string | undefined)[] =>
      Array.from(sr.querySelectorAll<HTMLElement>('.head-cell'))
        .filter((th) => th.dataset['status'] === 'active')
        .map((th) => th.dataset['field']);
    const chips = async (values: Record<string, string[]>): Promise<void> => {
      grid.dispatchEvent(new CustomEvent('quick-filter-change', {
        detail: { active: [], values }, bubbles: true, composed: true,
      }));
      await new Promise((res) => setTimeout(res, 30));
      await settle();
    };

    const clean = lit();

    // ONE chip.
    await chips({ plan: ['Pro'] });
    const onePlan = { lit: lit(), attr: grid.getAttribute('data-filter-fields'), rows: source.rows.length };

    // TWO chips — the filter is an AND tree, so BOTH fields must light.
    await chips({ plan: ['Pro'], region: ['EMEA'] });
    const twoChips = { lit: lit(), attr: grid.getAttribute('data-filter-fields') };

    // A SORT on a third column stacks with them rather than replacing them.
    grid.dispatchEvent(new CustomEvent('sort-change', {
      detail: { field: 'seats', direction: 'desc' }, bubbles: true, composed: true,
    }));
    await new Promise((res) => setTimeout(res, 30));
    await settle();
    const withSort = lit();

    // Clearing the chips leaves the sort's own column lit and nothing else.
    await chips({});
    const cleared = { lit: lit(), attr: grid.getAttribute('data-filter-fields') };

    return { clean, onePlan, twoChips, withSort, cleared };
  }, ROWS);

  // Nothing filtered, nothing sorted: no column is active.
  expect(r.clean).toEqual([]);

  // One chip lights exactly its own column — and the filter really ran.
  expect(r.onePlan.lit).toEqual(['plan']);
  expect(r.onePlan.attr).toBe('plan');
  expect(r.onePlan.rows).toBe(3);

  // An AND of two clauses lights both fields.
  expect(r.twoChips.lit.sort()).toEqual(['plan', 'region']);
  expect(r.twoChips.attr!.split(' ').sort()).toEqual(['plan', 'region']);

  // A sort is the same kind of state, so it stacks: three columns active.
  expect(r.withSort.sort()).toEqual(['plan', 'region', 'seats']);

  // Clearing the chips drops the attribute entirely; the sort holds on alone.
  expect(r.cleared.lit).toEqual(['seats']);
  expect(r.cleared.attr).toBe(null);
});

test('source: a view state survives a page reload, per TAB', async ({ page }) => {
  // An accidental refresh threw away every filter, sort and page a person set.
  // persistViewState is a HELPER rather than a feature of DataSource, because
  // WHERE a view state is kept is the host's decision.
  const before = await page.evaluate(async () => {
    const { ArrayStore, DataSource, persistViewState } = await import('/dist/index.js');
    const rows = Array.from({ length: 200 }, (_, i) => ({
      id: i, plan: i % 3 ? 'Pro' : 'Free', spend: (i * 7) % 500,
    }));
    const source = new DataSource({ store: new ArrayStore(rows, { key: 'id' }), pageSize: 10 });
    persistViewState(source, 'spec');
    await source.load();

    source.setFilter(['plan', 'eq', 'Pro']);
    source.setSort('spend', 'desc');
    source.setPage(3);
    await new Promise((r) => setTimeout(r, 60));

    return {
      ids: source.rows.map((r) => r['id']),
      total: source.total,
      page: source.state.page,
      // sessionStorage, NOT localStorage — two tabs filtered differently is a
      // feature, and localStorage would make them fight.
      inSession: !!sessionStorage.getItem('sherpa:view:spec'),
      inLocal: !!localStorage.getItem('sherpa:view:spec'),
    };
  });

  // A REAL reload — same tab, fresh document, nothing carried in memory.
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true);

  const after = await page.evaluate(async () => {
    const { ArrayStore, DataSource, persistViewState, clearViewState } = await import('/dist/index.js');
    const rows = Array.from({ length: 200 }, (_, i) => ({
      id: i, plan: i % 3 ? 'Pro' : 'Free', spend: (i * 7) % 500,
    }));
    const source = new DataSource({ store: new ArrayStore(rows, { key: 'id' }), pageSize: 10 });
    persistViewState(source, 'spec');   // restores on the way in
    await new Promise((r) => setTimeout(r, 80));

    const restored = {
      ids: source.rows.map((r) => r['id']),
      total: source.total,
      page: source.state.page,
    };

    // …and a reset really forgets.
    clearViewState('spec');
    return { ...restored, cleared: !sessionStorage.getItem('sherpa:view:spec') };
  });

  expect(before.inSession).toBe(true);
  expect(before.inLocal).toBe(false);

  // The whole view came back — including the PAGE, which is the part a user
  // notices losing.
  expect(after.ids).toEqual(before.ids);
  expect(after.total).toBe(before.total);
  expect(after.page).toBe(3);

  expect(after.cleared).toBe(true);
});

/**
 * `signal` — the PLATFORM'S teardown token, not a list of our own.
 *
 * `addEventListener` already takes an AbortSignal, so a caller with several
 * bindings should have one thing to abort rather than a list of unbind
 * functions to remember.
 *
 * A list is a thing to forget, and that is not hypothetical: a second list
 * appeared on the dashboard when a view began building its own content, and
 * the teardown dropped only the first — so leaving the page left the source
 * pushing rows into a detached grid.
 */
test('one AbortController tears down every binding it was given', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { ArrayStore, DataSource } = await import('/dist/index.js');
    const source = new DataSource({
      store: new ArrayStore([{ id: 1, n: 'a' }, { id: 2, n: 'b' }], { key: 'id' }),
    });

    const make = (id: string) => {
      const el = document.createElement('sherpa-data-grid') as HTMLElement & {
        rendered?: Promise<void>;
      };
      el.id = id;
      document.getElementById('root')!.appendChild(el);
      return el;
    };
    document.getElementById('root')!.replaceChildren();
    const a = make('a');
    const b = make('b');
    const kept = make('kept');

    const ac = new AbortController();
    source.bind(a, { readonly: true, signal: ac.signal });
    source.bind(b, { readonly: true, signal: ac.signal });
    source.bind(kept, { readonly: true });          // no signal — survives
    await source.load();
    const before = source.boundElements.length;

    ac.abort();
    const after = source.boundElements.map((e) => (e as HTMLElement).id);

    // An ALREADY-ABORTED signal binds nothing — a caller who cancelled before
    // this ran should not end up with a live binding.
    const late = make('late');
    source.bind(late, { readonly: true, signal: ac.signal });

    return { before, after, afterLate: source.boundElements.map((e) => (e as HTMLElement).id) };
  });

  expect(r.before).toBe(3);
  // Both signalled bindings gone; the one bound without a signal untouched.
  expect(r.after).toEqual(['kept']);
  expect(r.afterLate).toEqual(['kept']);
});

/**
 * `into` — TWO SOURCES, one component, neither clobbering the other.
 *
 * A line chart showing "ours" and "market" from two backends needs no join:
 * the series sit side by side on a shared x-axis, and no row is merged with
 * another. What it needs is for each source to own ONE PART of the payload.
 *
 * Without it the second bind's `populate()` replaces the first's, which is the
 * same last-write-wins problem `ignore` patches on the event side.
 *
 * The merge lives on the ELEMENT because neither source can see the other —
 * the element is the only thing both can reach.
 */
test('two sources each own a named part of one payload', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { ArrayStore, DataSource } = await import('/dist/index.js');

    // A plain element that just records every payload it is handed.
    const seen: unknown[] = [];
    const el = document.createElement('div') as HTMLElement & { populate?: (d: unknown) => void };
    el.populate = (d: unknown) => seen.push(JSON.parse(JSON.stringify(d)));
    document.getElementById('root')!.replaceChildren(el);

    const ours = new DataSource({ store: new ArrayStore([{ id: 1, n: 10 }], { key: 'id' }) });
    const market = new DataSource({ store: new ArrayStore([{ id: 1, n: 99 }], { key: 'id' }) });

    ours.bind(el, { readonly: true, into: 'series.0', as: (rows) => rows.map((x) => x['n']) });
    market.bind(el, { readonly: true, into: 'series.1', as: (rows) => rows.map((x) => x['n']) });
    await ours.load();
    await market.load();

    // …and a NAMED part beside the indexed ones, to prove the path builds an
    // object where the segment is a name and an array where it is a number.
    const meta = new DataSource({ store: new ArrayStore([{ id: 1, n: 7 }], { key: 'id' }) });
    meta.bind(el, { readonly: true, into: 'totals.rows', as: (rows) => rows.length });
    await meta.load();

    return { last: seen[seen.length - 1], count: seen.length };
  });

  // BOTH series survive — the second source did not replace the first.
  expect(r.last).toEqual({ series: [[10], [99]], totals: { rows: 1 } });
  // Every push hands over the whole draft, so the component always sees a
  // complete payload rather than a fragment it has to merge itself.
  expect(r.count).toBeGreaterThanOrEqual(3);
});

test('WITHOUT into, the second source clobbers the first — the bug into fixes', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { ArrayStore, DataSource } = await import('/dist/index.js');
    const seen: unknown[] = [];
    const el = document.createElement('div') as HTMLElement & { populate?: (d: unknown) => void };
    el.populate = (d: unknown) => seen.push(JSON.parse(JSON.stringify(d)));
    document.getElementById('root')!.replaceChildren(el);

    const ours = new DataSource({ store: new ArrayStore([{ id: 1, n: 10 }], { key: 'id' }) });
    const market = new DataSource({ store: new ArrayStore([{ id: 1, n: 99 }], { key: 'id' }) });
    // The same two binds as the test above, MINUS `into`.
    const as = (rows: Record<string, unknown>[]) => ({ series: [rows.map((x) => x['n'])] });
    ours.bind(el, { readonly: true, as });
    market.bind(el, { readonly: true, as });
    await ours.load();
    await market.load();
    return seen[seen.length - 1];
  });

  // "Ours" is GONE. This is the state of the world before `into`, kept as a
  // test so the reason for the option cannot be forgotten — and so a future
  // change that quietly made plain binds merge would be caught too.
  expect(r).toEqual({ series: [[99]] });
});

test('a bind WITHOUT into still replaces the whole payload', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { ArrayStore, DataSource } = await import('/dist/index.js');
    const seen: unknown[] = [];
    const el = document.createElement('div') as HTMLElement & { populate?: (d: unknown) => void };
    el.populate = (d: unknown) => seen.push(d);
    document.getElementById('root')!.replaceChildren(el);

    const src = new DataSource({ store: new ArrayStore([{ id: 1, n: 5 }], { key: 'id' }) });
    src.bind(el, { readonly: true, as: (rows) => ({ rows: rows.length }) });
    await src.load();
    return seen[seen.length - 1];
  });

  // No draft, no wrapping — the ordinary path is untouched.
  expect(r).toEqual({ rows: 1 });
});
