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

/**
 * `viewOptions` + `onViewPicked` — a saved-view LIBRARY, wired once.
 *
 * Both example pages wrote the same four things by hand: chip options derived
 * from the view set, a listener reading `detail.values.view[0]`, an apply, and
 * a warn when a stale definition could not be fully restored. Four small pieces
 * of one idea, copied — and a third copy is where a vocabulary starts to drift.
 */
test('a view library derives its own chip options', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { viewOptions } = await import('/dist/index.js');
    const VIEWS = {
      all: { label: 'All customers', snapshot: { v: 1 } },
      risk: { label: 'At risk', snapshot: { v: 1 } },
    };
    return {
      // Defaults to the FIRST view: a set with nothing selected leaves the chip
      // blank and a reader looking at data no view claims.
      def: viewOptions(VIEWS),
      named: viewOptions(VIEWS, 'risk'),
    };
  });

  expect(r.def).toEqual([
    { value: 'all', label: 'All customers', selected: true },
    { value: 'risk', label: 'At risk', selected: false },
  ]);
  expect(r.named[1]!.selected).toBe(true);
  expect(r.named[0]!.selected).toBe(false);
});

test('onViewPicked applies the picked view, and only on a view pick', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { onViewPicked } = await import('/dist/index.js');

    const states: unknown[] = [];
    const source = { setState: (s: unknown) => states.push(s) };
    const el = document.createElement('sherpa-quick-filter') as HTMLElement & { values?: unknown };
    document.getElementById('root')!.replaceChildren(el);

    const VIEWS = {
      risk: {
        label: 'At risk',
        snapshot: {
          v: 1,
          source: { filter: ['health', 'lt', 60] },
          elements: { chip: { values: ['a', 'b'] } },
        },
      },
    };

    const afters: unknown[] = [];
    const gaps: unknown[] = [];
    const host = document.getElementById('root')!;
    const off = onViewPicked(host, VIEWS, { source, elements: { chip: el } }, {
      after: (pick) => afters.push(pick.id),
      onIncomplete: (pick) => gaps.push(pick.report),
    });

    const fire = (detail: unknown) => host.dispatchEvent(
      new CustomEvent('quick-filter-change', { detail, bubbles: true }),
    );

    // A change naming NO view — the other chips on a view bar fire this too.
    fire({ values: { region: ['emea'] } });
    const afterOther = { states: states.length, afters: afters.length };

    // A view that is not in the library. A saved link outlives a deleted view.
    fire({ values: { view: ['gone'] } });
    const afterUnknown = { states: states.length, afters: afters.length };

    fire({ values: { view: ['risk'] } });
    const afterPick = { states: [...states], afters: [...afters] };

    // UNSUBSCRIBES, like bind() — a view leaving the DOM stops listening.
    off();
    fire({ values: { view: ['risk'] } });
    const afterOff = { states: states.length };

    return { afterOther, afterUnknown, afterPick, afterOff, gaps };
  });

  // Silence unless a VIEW was named, and named one that exists.
  expect(r.afterOther).toEqual({ states: 0, afters: 0 });
  expect(r.afterUnknown).toEqual({ states: 0, afters: 0 });

  // The query goes first, so rows are on their way before anything reads them.
  expect(r.afterPick.states).toEqual([{ filter: ['health', 'lt', 60] }]);
  expect(r.afterPick.afters).toEqual(['risk']);

  // The element got its state through its own API, so nothing was skipped.
  expect(r.gaps).toEqual([]);

  expect(r.afterOff.states).toBe(1);
});

test('onViewPicked REPORTS a stale definition instead of throwing', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { onViewPicked } = await import('/dist/index.js');
    const host = document.getElementById('root')!;
    const el = document.createElement('sherpa-quick-filter');
    host.replaceChildren(el);

    const gaps: { missing: string[]; skipped: Record<string, string[]> }[] = [];
    onViewPicked(host, {
      old: {
        label: 'Made last year',
        snapshot: {
          v: 1,
          // A component that has since been renamed, and a method that is gone.
          elements: { chip: { noSuchMethod: [1] }, vanished: { values: ['x'] } },
        },
      },
    }, { elements: { chip: el } }, {
      onIncomplete: (p) => gaps.push({
        missing: p.report.missingElements, skipped: p.report.skipped,
      }),
    });

    host.dispatchEvent(new CustomEvent('quick-filter-change', {
      detail: { values: { view: ['old'] } }, bubbles: true,
    }));
    return gaps;
  });

  // A saved view outlives its code. Both gaps are named, nothing thrown, and
  // whatever COULD be applied still was.
  expect(r).toEqual([{ missing: ['vanished'], skipped: { chip: ['noSuchMethod'] } }]);
});

/**
 * A PRESET CAN BRING ITS OWN CONTENT AND LAYOUT.
 *
 * Will, 2026-09-16: *each preset view option shows the same content just with a
 * different data source. Content can be different across presets. Doesn't need
 * to be the same charts, data viz etc. The layout can also be unique.*
 *
 * A preset is not always one screen with different rows. "Capacity planning"
 * may want a storage table where "Fleet overview" wants metric tiles — different
 * components, in a different arrangement, not the same components re-populated.
 *
 * `SavedView.content` is a `ViewDefinition`, the shape `renderView` already
 * builds, because "a screen described as data" is a problem this repo solved
 * once. The snapshot still applies AFTER, so a view can build its own grid and
 * arrive with a column already filtered.
 */
test('a preset builds its OWN components and layout, then configures them', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { onViewPicked } = await import('/dist/index.js');
    const host = document.getElementById('root')!;
    const into = document.createElement('div');
    host.replaceChildren(into);

    const states: unknown[] = [];
    const source = { setState: (s: unknown) => states.push(s) };

    const VIEWS = {
      tiles: {
        label: 'Fleet overview',
        content: {
          root: 'layout',
          elements: {
            layout: { type: 'sherpa-container', children: ['a', 'b'] },
            a: { type: 'sherpa-metric', props: { id: 'a', 'data-span': '3' } },
            b: { type: 'sherpa-metric', props: { id: 'b', 'data-span': '3' } },
          },
        },
        snapshot: { v: 1, source: { filter: undefined } },
      },
      table: {
        label: 'Capacity planning',
        // DIFFERENT components, DIFFERENT arrangement — not the same screen.
        content: {
          root: 'layout',
          elements: {
            layout: { type: 'sherpa-container', children: ['grid'] },
            grid: {
              type: 'sherpa-data-grid',
              props: { id: 'grid', 'data-span': '12' },
              data: {
                columns: [{ field: 'name', label: 'Name' }, { field: 'gb', label: 'GB' }],
                rows: [{ name: 'alpha', gb: 90 }, { name: 'beta', gb: 40 }],
              },
              // …and it arrives CONFIGURED, through the grid's own API.
              state: { setColumnFilter: ['name', ['name', 'contains', 'al']] },
            },
          },
        },
        snapshot: { v: 1, source: { filter: ['gb', 'gt', 70] } },
      },
    };

    const picks: unknown[] = [];
    onViewPicked(host, VIEWS, { source }, { into, after: (p) => picks.push(p.id) });

    const fire = (v: string) => host.dispatchEvent(new CustomEvent('quick-filter-change', {
      detail: { values: { view: [v] } }, bubbles: true,
    }));
    const shape = () => ({
      tags: [...into.querySelectorAll('*')].map((e) => e.tagName.toLowerCase()),
    });

    fire('tiles');
    await new Promise((res) => setTimeout(res, 50));
    const first = shape();

    fire('table');
    await new Promise((res) => setTimeout(res, 300));
    const second = shape();
    const grid = into.querySelector('sherpa-data-grid') as HTMLElement & {
      columnClause(f: string): unknown;
    };

    return { first, second, states, picks, clause: grid?.columnClause('name') ?? null };
  });

  // VIEW ONE: two metric tiles in a container.
  expect(r.first.tags).toEqual(['sherpa-container', 'sherpa-metric', 'sherpa-metric']);

  // VIEW TWO: a different component, and the old one is GONE. A view that left
  // its predecessor's tiles on screen would be two views at once.
  expect(r.second.tags).toEqual(['sherpa-container', 'sherpa-data-grid']);

  // The query moved too, so content and data are one definition.
  expect(r.states).toEqual([{ filter: undefined }, { filter: ['gb', 'gt', 70] }]);
  expect(r.picks).toEqual(['tiles', 'table']);

  // AND the built grid arrived CONFIGURED — `state` reaches a method on an
  // element that did not exist when the listener was wired.
  expect(r.clause).toEqual(['name', 'contains', 'al']);
});

test('renderView hands back the elements it built, by id', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { renderView } = await import('/dist/index.js');
    const view = renderView({
      root: 'layout',
      elements: {
        layout: { type: 'sherpa-container', children: ['tag'] },
        tag: { type: 'sherpa-tag', props: { 'data-label': 'live' } },
      },
    });
    return {
      ids: Object.keys(view.elements).sort(),
      // The registry is the view's OWN addressing scheme; without it the ids
      // were write-only and a snapshot could not name what a view had built.
      isSameNode: view.elements['layout'] === view.el,
      tagLabel: (view.elements['tag'] as HTMLElement).dataset['label'],
    };
  });

  expect(r.ids).toEqual(['layout', 'tag']);
  expect(r.isSameNode).toBe(true);
  expect(r.tagLabel).toBe('live');
});

/**
 * SAVING a view — the other half of applying one.
 *
 * A page that can APPLY a saved view but not MAKE one is half a feature, and
 * both example pages had a Save button wired to `console.log` — a control that
 * promises something and does nothing.
 *
 * `saveViewAs` captures what is on screen through the same API a definition
 * writes it through, so what is saved is exactly what can be restored.
 */
test('saveViewAs stores a named view, and the id is derived from the label', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { saveViewAs, loadSavedViews, deleteSavedView } = await import('/dist/index.js');
    localStorage.removeItem('sherpa:views:probe');

    const el = document.createElement('sherpa-quick-filter') as HTMLElement & { values?: unknown };
    document.getElementById('root')!.replaceChildren(el);
    const source = { state: { filter: ['region', 'eq', 'EMEA'], page: 1 } };

    const first = saveViewAs('probe', 'Q3 capacity', { source, elements: { chip: el } },
      { chip: ['values'] });

    // The SAME label again is an UPDATE, not a second row. A random id would
    // leave a reader with two "Q3 capacity" entries and no way to tell them
    // apart in the chip.
    source.state = { filter: ['region', 'eq', 'APAC'], page: 2 };
    const second = saveViewAs('probe', 'Q3 capacity', { source, elements: { chip: el } },
      { chip: ['values'] });

    // Whitespace is not a different view either.
    saveViewAs('probe', '  Q3 capacity  ', { source }, {});
    const trimmed = Object.keys(loadSavedViews('probe'));

    const reloaded = loadSavedViews('probe');
    const afterDelete = deleteSavedView('probe', 'q3-capacity');
    return {
      ids: Object.keys(first),
      label: first['q3-capacity']?.label,
      firstFilter: first['q3-capacity']?.snapshot.source?.filter,
      secondFilter: second['q3-capacity']?.snapshot.source?.filter,
      count: Object.keys(second).length,
      trimmed,
      // It SURVIVES the call — read back from storage, not from the return.
      reloadedFilter: reloaded['q3-capacity']?.snapshot.source?.filter,
      afterDelete: Object.keys(afterDelete),
    };
  });

  expect(r.ids).toEqual(['q3-capacity']);
  expect(r.label).toBe('Q3 capacity');
  expect(r.firstFilter).toEqual(['region', 'eq', 'EMEA']);

  // Saved twice under one name = one view, updated.
  expect(r.secondFilter).toEqual(['region', 'eq', 'APAC']);
  expect(r.count).toBe(1);
  expect(r.trimmed).toEqual(['q3-capacity']);

  expect(r.reloadedFilter).toEqual(['region', 'eq', 'APAC']);
  expect(r.afterDelete).toEqual([]);
});

test('an empty label saves nothing, and unreadable storage yields no views', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { saveViewAs, loadSavedViews } = await import('/dist/index.js');
    localStorage.removeItem('sherpa:views:probe2');

    // A reader who cancels the naming prompt has not saved anything.
    const blank = saveViewAs('probe2', '   ', { source: { state: {} } }, {});

    // A stored value this code no longer understands is not a crash. A saved
    // view outlives the code that wrote it, and a hand-edited one is a string.
    localStorage.setItem('sherpa:views:probe3', 'not json at all');
    const broken = loadSavedViews('probe3');
    localStorage.setItem('sherpa:views:probe4', '"a plain string"');
    const wrongShape = loadSavedViews('probe4');

    return { blank: Object.keys(blank), broken, wrongShape };
  });

  expect(r.blank).toEqual([]);
  expect(r.broken).toEqual({});
  expect(r.wrongShape).toEqual({});
});

test('onViewPicked re-reads a library that GROWS when given a function', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { onViewPicked } = await import('/dist/index.js');
    const host = document.getElementById('root')!;
    host.replaceChildren();

    const states: unknown[] = [];
    const source = { setState: (s: unknown) => states.push(s) };

    // Starts with presets only — exactly what a page wires at init.
    const library: Record<string, { label: string; snapshot: unknown }> = {
      fleet: { label: 'Fleet', snapshot: { v: 1, source: { filter: undefined } } },
    };
    onViewPicked(host, () => library, { source });

    const fire = (v: string) => host.dispatchEvent(new CustomEvent('quick-filter-change', {
      detail: { values: { view: [v] } }, bubbles: true,
    }));

    fire('saved-later');
    const beforeSave = states.length;

    // The reader saves one AFTER the listener was wired.
    library['saved-later'] = {
      label: 'Saved later', snapshot: { v: 1, source: { filter: ['a', 'eq', 1] } },
    };
    fire('saved-later');

    return { beforeSave, states };
  });

  // Unknown before it was saved, resolvable after — the whole point of the
  // function form. A listener holding the object it was wired with could never
  // restore a view the reader made, which is what the dashboard's Save button
  // hit: it wired the presets and then could not find anything it had saved.
  expect(r.beforeSave).toBe(0);
  expect(r.states).toEqual([{ filter: ['a', 'eq', 1] }]);
});

/**
 * A MIXED set of views — most share the page's content, one brings its own.
 *
 * This is the real case, and the toy test above could not find what it broke.
 * A dashboard's views are usually the same charts over fewer rows; but
 * "Capacity planning" wants a table of the fullest devices and a distribution,
 * because none of a donut, a gauge or a line series says anything about which
 * machines are nearly full.
 *
 * The bug this guards: the FIRST view that brought content kept the screen for
 * good. Picking any other view moved the data while the old view's grid stayed
 * on display — the exact lie the whole feature exists to prevent.
 */
test('a view WITHOUT content gets the page its own content back, still live', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { onViewPicked } = await import('/dist/index.js');
    const host = document.getElementById('root')!;

    // The page's OWN content, wired once — as a real page does at init.
    const into = document.createElement('div');
    const ownTag = document.createElement('sherpa-tag');
    ownTag.id = 'own';
    ownTag.dataset['label'] = 'page content';
    into.replaceChildren(ownTag);
    host.replaceChildren(into);

    const states: unknown[] = [];
    const source = { setState: (s: unknown) => states.push(s) };

    const VIEWS = {
      plain: { label: 'Plain', snapshot: { v: 1, source: { filter: undefined } } },
      own: {
        label: 'Brings its own',
        content: {
          root: 'wrap',
          elements: {
            wrap: { type: 'div', children: ['grid'] },
            grid: { type: 'sherpa-data-grid', props: { id: 'built' } },
          },
        },
        snapshot: { v: 1, source: { filter: ['a', 'eq', 1] } },
      },
      other: { label: 'Other', snapshot: { v: 1, source: { filter: ['b', 'eq', 2] } } },
    };

    onViewPicked(host, VIEWS, { source }, { into });
    const fire = (v: string) => host.dispatchEvent(new CustomEvent('quick-filter-change', {
      detail: { values: { view: [v] } }, bubbles: true,
    }));
    const shape = () => ({
      kids: [...into.children].map((c) => c.tagName.toLowerCase()),
      // IDENTITY, not just the tag: a restored node must be the SAME element
      // the page bound at init, or every bind is pointing at a corpse.
      sameNode: into.firstElementChild === ownTag,
    });

    const out: Record<string, unknown> = { start: shape() };
    fire('own');
    await new Promise((res) => setTimeout(res, 100));
    out['own'] = shape();

    fire('plain');
    await new Promise((res) => setTimeout(res, 100));
    out['plain'] = shape();

    // …and a THIRD view, to prove the restore is not a one-off.
    fire('own');
    await new Promise((res) => setTimeout(res, 100));
    fire('other');
    await new Promise((res) => setTimeout(res, 100));
    out['other'] = shape();

    return { out, states };
  });

  expect(r.out['start']).toEqual({ kids: ['sherpa-tag'], sameNode: true });

  // The view's own content REPLACES the page's.
  expect(r.out['own']).toEqual({ kids: ['div'], sameNode: false });

  // A view with no content of its own hands the page back what it had — and
  // hands back the SAME NODE, so the binds made at init still point at it.
  expect(r.out['plain']).toEqual({ kids: ['sherpa-tag'], sameNode: true });
  expect(r.out['other']).toEqual({ kids: ['sherpa-tag'], sameNode: true });

  // The query moved on every pick regardless of who owns the content.
  // Four picks — own, plain, own, other — in that order.
  expect(r.states).toEqual([
    { filter: ['a', 'eq', 1] },
    { filter: undefined },
    { filter: ['a', 'eq', 1] },
    { filter: ['b', 'eq', 2] },
  ]);
});

/**
 * A CHIP's event must never be read as the BAR's.
 *
 * `quick-filter-change` carries `values` in two shapes: a bare `string[]` from
 * a single chip (its own picks) and a `Record<id, string[]>` from the toolbar
 * (every chip's). One name, two meanings — and reading one as the other has
 * already shipped a bug: a view turned an organise chip's sort pick into a
 * filter and emptied the grid on every sort. The toolbar carries a
 * capture-phase listener purely to stop that event escaping.
 *
 * Every emit now says which shape it is, and this asserts the reader checks.
 * It used to be safe BY ACCIDENT — `['name']['view']` is undefined, so a chip's
 * array fell through the id test. Accidental safety stops working the moment a
 * shape changes slightly.
 */
test('onViewPicked ignores a chip-scoped event, by shape not by luck', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { onViewPicked } = await import('/dist/index.js');
    const host = document.getElementById('root')!;
    host.replaceChildren();

    const states: unknown[] = [];
    const source = { setState: (s: unknown) => states.push(s) };
    const VIEWS = { risk: { label: 'At risk', snapshot: { v: 1, source: { filter: ['h', 'lt', 60] } } } };
    onViewPicked(host, VIEWS, { source });

    const fire = (detail: unknown) => host.dispatchEvent(
      new CustomEvent('quick-filter-change', { detail, bubbles: true }),
    );

    /* A CHIP's event whose array WOULD read as a map. A bare `['risk']` is
       harmless — `['risk']['view']` is undefined — which is the accidental
       safety this marker replaces. So the test uses the case where the accident
       does NOT save you: an array is an object, and a `view` property on it
       survives every `values?.['view']` read.

       Without the scope check this applies the view. With it, nothing moves. */
    const sneaky: string[] & { view?: string[] } = ['risk'];
    sneaky.view = ['risk'];
    fire({ scope: 'chip', values: sneaky });
    const afterChip = states.length;

    // The same payload WITHOUT the marker still works — the marker is a
    // narrowing, not a new requirement, so an older emitter is not broken.
    fire({ values: { view: ['risk'] } });
    const afterUnmarked = states.length;

    // And the bar's own event.
    fire({ scope: 'bar', values: { view: ['risk'] } });
    return { afterChip, afterUnmarked, total: states.length };
  });

  expect(r.afterChip, 'a chip-scoped event moves nothing').toBe(0);
  expect(r.afterUnmarked, 'an unmarked event is still honoured').toBe(1);
  expect(r.total, 'and the bar-scoped one applies').toBe(2);
});
