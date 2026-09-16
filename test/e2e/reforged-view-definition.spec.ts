import { test, expect } from '@playwright/test';

/**
 * VIEW DEFINITIONS — a whole configured screen, as data.
 *
 * A preset shipped with the app, a saved view a user made, a deep link, an
 * agent's request over MCP, and a reproducible bug report are all the SAME
 * object. That is the point of one shape rather than a storage key per concern.
 *
 * It only works because of parity: a definition can set exactly what a
 * component exposes, so every setter the P-steps added is what makes another
 * piece of a view savable.
 */

const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(() => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true);
});

test('renderElement applies `state` through the component OWN API, after its data', async ({ page }) => {
  // `props` sets attributes and `data` sets the populate payload. Neither can
  // express what a component exposes as a METHOD — which is most of what a
  // saved view needs.
  const r = await page.evaluate(async () => {
    const { renderElement } = await import('/dist/index.js');
    const el = renderElement({
      type: 'sherpa-data-grid',
      props: { 'data-column-filters': true, 'data-selectable': true },
      data: {
        key: 'email',
        columns: [{ field: 'name', header: 'Name' }],
        rows: [
          { email: 'a@x', name: 'Marcus' },
          { email: 'b@x', name: 'Omar' },
          { email: 'c@x', name: 'Zoe' },
        ],
      },
      state: {
        setColumnFilter: ['name', ['name', 'contains', 'ar']],   // METHOD, 2 args
        select: [['a@x']],                                        // METHOD, 1 array arg
        notAMethod: 'ignored',                                    // unknown → skipped
      },
    }) as HTMLElement & {
      rendered?: Promise<void>;
      columnClause(f: string): unknown[] | null;
      selectedKeys: string[];
    };
    document.getElementById('root')!.replaceChildren(el);
    await el.rendered;
    // State is applied after `rendered`, because a grid cannot filter a column
    // it does not have yet.
    await new Promise((res) => setTimeout(res, 150));
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const sr = el.shadowRoot!;
    return {
      clause: el.columnClause('name'),
      lit: (sr.querySelector('.head-cell[data-field="name"]') as HTMLElement).dataset['status'] ?? null,
      typed: sr.querySelector<HTMLInputElement>('.head-filter-value')?.value,
      marks: sr.querySelectorAll('.cell mark.match').length,
      keys: el.selectedKeys,
    };
  });

  expect(r.clause).toEqual(['name', 'contains', 'ar']);
  expect(r.lit).toBe('active');
  expect(r.typed).toBe('ar');          // the CONTROL agrees, not just the rows
  expect(r.marks).toBe(2);             // "Marcus" and "Omar"
  expect(r.keys).toEqual(['a@x']);
});

test('a whole view round-trips: capture it, restore it into a FRESH one', async ({ page }) => {
  // The test that matters. Two sources, two grids, nothing shared but a JSON
  // snapshot — which is exactly what a saved view is.
  const r = await page.evaluate(async () => {
    const { ArrayStore, DataSource, captureView, applyViewSnapshot } = await import('/dist/index.js');
    const settle = () => (window as unknown as { __settled: () => Promise<void> }).__settled();
    const rows = Array.from({ length: 60 }, (_, i) => ({
      email: `e${i}@x`, name: `n${i % 9}`, plan: i % 3 ? 'Pro' : 'Free', spend: (i * 7) % 400,
    }));
    const columns = [
      { field: 'name', header: 'Name' },
      { field: 'spend', header: 'Spend', type: 'number' },
    ];

    const build = async () => {
      const grid = document.createElement('sherpa-data-grid') as HTMLElement & {
        rendered?: Promise<void>;
        setColumnFilter(f: string, c: unknown[] | null): void;
        columnClause(f: string): unknown[] | null;
        select(k: readonly string[]): void;
        selectedKeys: string[];
      };
      grid.setAttribute('data-column-filters', '');
      grid.setAttribute('data-selectable', '');
      document.getElementById('root')!.replaceChildren(grid);
      await grid.rendered;
      const source = new DataSource({ store: new ArrayStore(rows, { key: 'email' }), pageSize: 10 });
      source.bind(grid, { as: (r2: unknown[]) => ({ key: 'email', columns, rows: r2 }) });
      return { grid, source };
    };

    // A reader configures a view…
    const one = await build();
    await one.source.load();
    one.source.setFilter(['plan', 'eq', 'Pro']);
    one.source.setSort('spend', 'desc');
    await settle();
    one.grid.setColumnFilter('name', ['name', 'contains', 'n1']);
    one.grid.select(one.source.rows.slice(0, 2).map((x) => x['email'] as string));
    await settle();

    // …and SAVES it. What to read is named, because only the caller knows which
    // properties are view state and which are incidental.
    const snapshot = captureView(
      { source: one.source, elements: { grid: one.grid } },
      { grid: ['selectedKeys'] },
    ) as { v: 1; source?: unknown; elements?: Record<string, Record<string, unknown>> };

    // Two of the grid's values need their SETTER form, because reading them
    // takes an argument.
    snapshot.elements = snapshot.elements ?? {};
    snapshot.elements['grid'] = {
      setColumnFilter: ['name', one.grid.columnClause('name')],
      select: [one.grid.selectedKeys],
    };

    const before = {
      rows: one.source.rows.map((x) => x['email']),
      total: one.source.total,
      clause: one.grid.columnClause('name'),
      keys: one.grid.selectedKeys,
    };

    // A FRESH view — new source, new grid, nothing shared but the JSON.
    const two = await build();
    const report = applyViewSnapshot(
      JSON.parse(JSON.stringify(snapshot)),
      { source: two.source, elements: { grid: two.grid } },
    );
    await new Promise((res) => setTimeout(res, 150));
    await settle();

    return {
      before,
      after: {
        rows: two.source.rows.map((x) => x['email']),
        total: two.source.total,
        clause: two.grid.columnClause('name'),
        keys: two.grid.selectedKeys,
      },
      report,
      bytes: JSON.stringify(snapshot).length,
    };
  });

  // The whole view came back: the query, the column filter AND the selection.
  expect(r.after).toEqual(r.before);
  expect(r.report.missingElements).toEqual([]);
  expect(r.report.skipped).toEqual({});
  // Small enough for a URL or a database row.
  expect(r.bytes).toBeLessThan(600);
});

test('one method, MANY calls — a state block is a map, so calls nest', async ({ page }) => {
  // `setColumnFilter` has to run once per filtered column, and a state block is
  // a map — one method, one key. Inventing `setColumnFilter:name` would be a
  // second vocabulary nothing else understands, so the calls nest instead.
  const r = await page.evaluate(async () => {
    const { renderElement } = await import('/dist/index.js');
    const el = renderElement({
      type: 'sherpa-data-grid',
      props: { 'data-column-filters': true },
      data: {
        columns: [{ field: 'name', header: 'Name' }, { field: 'plan', header: 'Plan' }],
        rows: [{ name: 'Marcus', plan: 'Pro' }, { name: 'Omar', plan: 'Free' }],
      },
      state: {
        // TWO calls — every entry is itself an array, and there is more than one.
        setColumnFilter: [
          ['name', ['name', 'contains', 'ar']],
          ['plan', ['plan', 'contains', 'Pro']],
        ],
      },
    }) as HTMLElement & { rendered?: Promise<void>; columnClause(f: string): unknown[] | null };
    document.getElementById('root')!.replaceChildren(el);
    await el.rendered;
    await new Promise((res) => setTimeout(res, 150));
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    // …and ONE call whose single argument is an array stays one call, which is
    // what keeps the common case unambiguous.
    const single = renderElement({
      type: 'sherpa-data-grid',
      props: { 'data-selectable': true },
      data: { key: 'id', columns: [{ field: 'n', header: 'N' }], rows: [{ id: 'a', n: 1 }, { id: 'b', n: 2 }] },
      state: { select: [['a']] },
    }) as HTMLElement & { rendered?: Promise<void>; selectedKeys: string[] };
    document.body.appendChild(single);
    await single.rendered;
    await new Promise((res) => setTimeout(res, 150));

    return {
      name: el.columnClause('name'),
      plan: el.columnClause('plan'),
      selected: single.selectedKeys,
    };
  });

  expect(r.name).toEqual(['name', 'contains', 'ar']);
  expect(r.plan).toEqual(['plan', 'contains', 'Pro']);
  expect(r.selected).toEqual(['a']);
});

test('a PRESET reconfigures a whole screen: query, arrangement and components', async ({ page }) => {
  // What the app header's View dropdown does. Each option is a ViewSnapshot,
  // not a label — the same object a user's saved view produces, a shared link
  // carries, and an agent sends over MCP.
  const r = await page.evaluate(async () => {
    const { ArrayStore, DataSource, applyViewSnapshot } = await import('/dist/index.js');
    const settle = () => (window as unknown as { __settled: () => Promise<void> }).__settled();

    const rows = Array.from({ length: 90 }, (_, i) => ({
      id: i, name: `n${i % 11}`, tier: ['Bronze', 'Silver', 'Gold'][i % 3],
      status: i % 7 ? 'active' : 'churned', health: (i * 13) % 100, spend: (i * 31) % 900,
    }));
    const columns = [
      { field: 'name', header: 'Name' },
      { field: 'tier', header: 'Tier' },
      { field: 'status', header: 'Status' },
      { field: 'health', header: 'Health', type: 'number' },
    ];

    const grid = document.createElement('sherpa-data-grid') as HTMLElement & {
      rendered?: Promise<void>;
      columnClause(f: string): unknown[] | null;
    };
    grid.setAttribute('data-column-filters', '');
    document.getElementById('root')!.replaceChildren(grid);
    await grid.rendered;

    const source = new DataSource({ store: new ArrayStore(rows, { key: 'id' }), pageSize: 25 });
    source.bind(grid, { as: (r2: unknown[]) => ({ key: 'id', columns, rows: r2 }) });
    await source.load();
    await settle();

    const read = () => ({
      total: source.total,
      group: source.state.group,
      sort: source.state.sort[0]?.field ?? null,
      statusClause: grid.columnClause('status'),
      groupRows: grid.shadowRoot!.querySelectorAll('.group-row').length,
    });

    const before = read();

    // "At risk" — a query AND a column filter, which is the case that proves a
    // definition reaches both halves.
    applyViewSnapshot({
      v: 1,
      source: { filter: ['health', 'lt', 40], sort: [{ field: 'health', direction: 'asc' }], group: null, page: 1 },
      elements: { grid: { setColumnFilter: ['status', ['status', 'ne', 'churned']] } },
    }, { source, elements: { grid } });
    await new Promise((res) => setTimeout(res, 150));
    await settle();
    const risk = read();

    // "Renewals" — GROUPED, which nothing else here exercises: a view can set
    // how rows are ARRANGED, not only which ones there are.
    applyViewSnapshot({
      v: 1,
      source: { filter: undefined, sort: [{ field: 'spend', direction: 'desc' }], group: 'tier', page: 1 },
      elements: { grid: { clearColumnFilter: [undefined] } },
    }, { source, elements: { grid } });
    await new Promise((res) => setTimeout(res, 150));
    await settle();
    const renewals = read();

    return { before, risk, renewals };
  });

  expect(r.before.group).toBe(null);
  expect(r.before.statusClause).toBe(null);

  // The QUERY narrowed, the sort moved, and the grid's own control is set.
  expect(r.risk.total).toBeLessThan(r.before.total);
  expect(r.risk.sort).toBe('health');
  expect(r.risk.statusClause).toEqual(['status', 'ne', 'churned']);

  // …and a different view rearranges rather than merely re-filtering.
  expect(r.renewals.group).toBe('tier');
  expect(r.renewals.groupRows).toBeGreaterThan(0);
  expect(r.renewals.sort).toBe('spend');
  // Its own definition cleared the previous view's column filter, rather than
  // inheriting it — a view says what it IS, not what to change.
  expect(r.renewals.statusClause).toBe(null);
});

test('a definition DEGRADES: a gone element and a gone method are reported, not thrown', async ({ page }) => {
  // A saved view outlives the code that made it. One stale key must not stop
  // the rest being restored — the same reason a bad ROW is dropped and counted.
  const r = await page.evaluate(async () => {
    const { applyViewSnapshot } = await import('/dist/index.js');
    const el = document.createElement('sherpa-data-grid') as HTMLElement & { rendered?: Promise<void> };
    document.getElementById('root')!.replaceChildren(el);
    await el.rendered;

    const report = applyViewSnapshot(
      {
        v: 1,
        elements: {
          grid: { select: [[]], methodThatVanished: 1 },
          panelRemovedLastYear: { anything: true },
        },
      },
      { elements: { grid: el } },
    );

    // An unrecognised VERSION is ignored whole rather than half-applied — a
    // definition applied in part leaves a screen nobody designed.
    const future = applyViewSnapshot(
      { v: 99 as 1, elements: { grid: { select: [['x']] } } },
      { elements: { grid: el } },
    );

    return { report, future };
  });

  expect(r.report.missingElements).toEqual(['panelRemovedLastYear']);
  expect(r.report.skipped).toEqual({ grid: ['methodThatVanished'] });
  // The future version did nothing at all, and said nothing was missing.
  expect(r.future).toEqual({ missingElements: [], skipped: {} });
});
