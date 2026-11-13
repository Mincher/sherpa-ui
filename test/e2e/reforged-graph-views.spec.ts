import { test, expect, type Page } from './fixture';

/**
 * A GRAPH IS A VIEW OF A TYPE: a Context whose `chrome.filters` is "views" has its row drawn by the
 * outlet — the View chip alone, and on a graph View the graph chip to its right, its rows the type's
 * presets, the reader's own, then New graph…. A pick goes to the URL (`?graph=`), the Context is told
 * (`graph-change`), and a reload or Back opens the same. The header's Save and its menu say "graph",
 * Save is off on a preset, and each is a request a Context may take over. Will, plan 746 E3, E4.
 * TRAP T-a-graph-is-a-view-of-a-type
 */
const BAR = 'sherpa-app-header sherpa-quick-filter-toolbar[data-type="view"]';

/** The harness, its outlet started; the reader's own Filter kept first, when asked. */
async function start(page: Page, url = '/test/reforged/graph-views.html', mine = true): Promise<void> {
  await page.goto(url);
  await page.waitForFunction(() => (window as unknown as { __ready?: boolean }).__ready === true);
  await page.evaluate(`(async () => {
    const { SessionStore } = await import('/dist/index.js');
    const outlet = document.querySelector('sherpa-outlet');
    const { keeper } = document.querySelector('sherpa-provider');
    if (${mine} && !keeper.entities.get('mine')) await keeper.entities.save({ v: 3, type: 'filter', id: 'mine', label: 'Mine', graph: { nodes: [], connections: [] } });
    const base = new URL('/test/reforged/graph-views/app.json', location.href);
    await outlet.start({ app: await (await fetch(base)).json(), base, session: new SessionStore({}), stores: () => ({}) });
  })()`);
  await page.waitForFunction(() => !!(window as unknown as { __graphs?: unknown }).__graphs);
}

/** Pick a row in one of the row's chips, by pointer: its caret, then its words. */
async function pick(page: Page, chip: string, row: string): Promise<void> {
  await page.locator(`${BAR} .chip[data-id="${chip}"] .caret`).click();
  await page.locator(`${BAR} .chip[data-id="${chip}"] sherpa-menu .menu-row`).filter({ hasText: row }).first().click();
}

/** What the row shows: each chip's id and rect, the bar's actions, the rows of the graph chip, the open graph. */
const row = (page: Page) => page.evaluate(() => {
  const bar = document.querySelector('sherpa-app-header sherpa-quick-filter-toolbar[data-type="view"]')!;
  const chips = [...bar.shadowRoot!.querySelectorAll<HTMLElement>('.chip')].filter((c) => c.getBoundingClientRect().width > 0);
  const rect = (el: Element) => { const r = el.getBoundingClientRect(); return { left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top) }; };
  const menu = bar.shadowRoot!.querySelector('.chip[data-id="graph"] sherpa-menu');
  return {
    chips: chips.map((c) => ({ id: c.dataset['id'], ...rect(c) })),
    noActions: bar.hasAttribute('data-no-actions'),
    rows: [...(menu?.querySelectorAll<HTMLElement>('.menu-section, .menu-row') ?? [])]
      .map((n) => `${n.textContent!.replace(/\s+/g, ' ').trim()}${n.dataset['note'] ? ` (${n.dataset['note']})` : ''}`),
    // The parameters in a fixed order: a URL keeps the order it was given.
    url: [...new URLSearchParams(location.search)].sort().map(([k, v]) => `${k}=${v}`).join('&'),
    graph: (document.querySelector('sherpa-outlet') as unknown as { graph: unknown }).graph,
    told: (window as unknown as { __graphs: { told: unknown[] } }).__graphs.told,
  };
});

test('a "views" Context\'s row is the View chip and, on a graph View, the graph chip to its right: the presets, the reader\'s own, then New graph…', async ({ page }) => {
  await start(page, '/test/reforged/graph-views.html?view=filters');
  const r = await row(page);
  expect(r.chips.map((c) => c.id)).toEqual(['view', 'graph']);
  // To the RIGHT of the View chip, on its line.
  expect(r.chips[1]!.left).toBeGreaterThanOrEqual(r.chips[0]!.right);
  expect(r.chips[1]!.top).toBe(r.chips[0]!.top);
  expect(r.noActions).toBe(true);
  expect(r.rows).toEqual(['Presets', 'Shipped (Read only)', 'My graphs', 'Mine', 'New graph…']);
  expect(r.graph).toEqual({ view: 'filters', type: 'filter', id: 'shipped', origin: 'preset' });
  expect(await page.evaluate(() => (window as unknown as { __graphs: { start: unknown } }).__graphs.start)).toEqual(r.graph);
  // A View with no graph has no graph chip.
  await pick(page, 'view', 'Notes');
  await expect.poll(async () => (await row(page)).chips.map((c) => c.id)).toEqual(['view']);
  expect((await row(page)).graph).toBe(null);
});

test('a graph picked by pointer opens: the URL carries it, the Context is told, and a reload and Back open it again', async ({ page }) => {
  await start(page, '/test/reforged/graph-views.html?view=filters');
  await pick(page, 'graph', 'Mine');
  await expect.poll(async () => (await row(page)).told).toEqual(['mine']);
  const picked = await row(page);
  expect([picked.graph, picked.url]).toEqual([{ view: 'filters', type: 'filter', id: 'mine', origin: 'mine' }, 'context=graphs&graph=mine&view=filters']);
  // A pick REPLACES, as a View pick does: Back from another Context, as a nav row opens it, comes back to it.
  await page.evaluate(() => (document.querySelector('sherpa-router') as unknown as { go(r: object): Promise<void> }).go({ context: 'plain', view: null, graph: null }));
  await expect.poll(async () => (await row(page)).url).toBe('context=plain');
  await page.goBack();
  await expect.poll(async () => (await row(page)).graph).toEqual({ view: 'filters', type: 'filter', id: 'mine', origin: 'mine' });
  expect((await row(page)).url).toBe('context=graphs&graph=mine&view=filters');
  // Another View opens on its type's first — here, none yet — and the URL drops the graph.
  await pick(page, 'view', 'Custom Nodes');
  await expect.poll(async () => (await row(page)).graph).toEqual({ view: 'nodes', type: 'node', id: null });
  expect((await row(page)).url).toBe('context=graphs&view=nodes');
  await pick(page, 'view', 'Filters');
  await pick(page, 'graph', 'Mine');
  // A reload opens the same View and graph.
  await page.reload();
  await start(page, page.url(), false);
  expect((await row(page)).graph).toEqual({ view: 'filters', type: 'filter', id: 'mine', origin: 'mine' });
});

test('New graph… makes an empty one of the type and opens it; an app that takes the ask over makes it itself', async ({ page }) => {
  await start(page, '/test/reforged/graph-views.html?view=filters');
  await pick(page, 'graph', 'New graph…');
  await expect.poll(async () => (await row(page)).graph).toMatchObject({ id: 'new-filter', origin: 'mine' });
  expect((await row(page)).rows).toEqual(['Presets', 'Shipped (Read only)', 'My graphs', 'Mine', 'New Filter', 'New graph…']);
  const kept = await page.evaluate(() => (document.querySelector('sherpa-provider') as unknown as { keeper: { entities: { get(id: string): unknown } } }).keeper.entities.get('new-filter'));
  expect(kept).toMatchObject({ type: 'filter', label: 'New Filter', graph: { nodes: [], connections: [] } });
  // Taken over: nothing is made, and the chip shows the open one still.
  await page.evaluate(() => document.querySelector('sherpa-outlet')!.addEventListener('graph-new', (e) => e.preventDefault()));
  await pick(page, 'graph', 'New graph…');
  await expect.poll(() => page.evaluate((bar) => (document.querySelector(bar) as unknown as { values: Record<string, string[]> }).values['graph'], BAR)).toEqual(['new-filter']);
  const after = await row(page);
  expect([after.graph, after.rows.length]).toEqual([{ view: 'filters', type: 'filter', id: 'new-filter', origin: 'mine' }, 6]);
});

test('another Context gives the bar its actions back, and an outlet opening one says there is no graph', async ({ page }) => {
  await start(page, '/test/reforged/graph-views.html?view=filters');
  await page.evaluate(() => (document.querySelector('sherpa-router') as unknown as { go(r: object): Promise<void> }).go({ context: 'plain' }));
  await expect.poll(async () => (await row(page)).noActions).toBe(false);
  expect((await row(page)).graph).toBe(null);
});

/** The header's View actions: Save's state, the menu's words, and whether Delete shows. */
const actions = (page: Page) => page.evaluate(() => {
  const header = document.querySelector('sherpa-app-header')!;
  const save = header.shadowRoot!.querySelector('.save')!;
  const more = header.shadowRoot!.querySelector('.view-more')!;
  const rows = [...header.shadowRoot!.querySelectorAll<HTMLElement>('.view-menu button')];
  return {
    save: save.hasAttribute('disabled'), tip: save.getAttribute('data-description'), more: more.getAttribute('aria-label'),
    rows: rows.filter((b) => getComputedStyle(b).display !== 'none').map((b) => b.textContent!.trim()),
  };
});

test('on a graph View the header says Save graph as and Delete graph; Save is off on a preset; each is a request a Context may take over', async ({ page }) => {
  await start(page, '/test/reforged/graph-views.html?view=filters');
  const preset = await actions(page);
  expect(preset).toEqual({ save: true, tip: 'A preset is read only: Save as makes a copy of your own.', more: 'Save graph options', rows: ['Save graph as'] });
  await pick(page, 'graph', 'Mine');
  await expect.poll(async () => (await actions(page)).save).toBe(false);
  expect(await actions(page)).toEqual({ save: false, tip: null, more: 'Save graph options', rows: ['Save graph as', 'Delete graph'] });
  // A request: the Context prevents it, and the page's own handler sees it prevented.
  const heard = await page.evaluate(async () => {
    const header = document.querySelector('sherpa-app-header')!;
    const seen: string[] = [];
    header.addEventListener('view-save', (e) => e.preventDefault(), { once: true });
    document.addEventListener('view-save', (e) => seen.push(`save:${e.defaultPrevented}`), { once: true });
    document.addEventListener('view-save-as', (e) => seen.push(`as:${e.cancelable}`), { once: true });
    header.shadowRoot!.querySelector('.save')!.shadowRoot!.querySelector('button')!.click();
    (header.shadowRoot!.querySelector('.view-menu')! as HTMLElement).dispatchEvent(new CustomEvent('menu-select', { detail: { value: 'save-as' } }));
    return seen;
  });
  expect(heard).toEqual(['save:true', 'as:true']);
  // Another View that is no graph: the View's own words again.
  await pick(page, 'view', 'Notes');
  await expect.poll(async () => (await actions(page)).more).toBe('Save view options');
  expect((await actions(page)).rows).toEqual(['Save view as']);
});

/** The harness on a page with data — its store's twelve items — the outlet started there. */
async function startOnPage(page: Page, context: string): Promise<void> {
  await page.goto(`/test/reforged/graph-views.html?context=${context}`);
  await page.waitForFunction(() => (window as unknown as { __ready?: boolean }).__ready === true);
  await page.evaluate(`(async () => {
    const { SessionStore, ArrayStore } = await import('/dist/index.js');
    const outlet = document.querySelector('sherpa-outlet');
    const items = new ArrayStore([...Array(12)].map((_, i) => ({ id: 'i' + i, name: 'Item ' + i, status: i % 3 ? 'open' : 'shut', n: i })), { key: 'id' });
    const base = new URL('/test/reforged/graph-views/app.json', location.href);
    await outlet.start({ app: await (await fetch(base)).json(), base, session: new SessionStore({}), stores: () => ({ items }) });
  })()`);
  await page.waitForFunction((c) => (window as unknown as { __page?: { id: string } }).__page?.id === c, context);
}

type PageWin = {
  __page: { id: string; source: Src } | null;
  __graphs: { page: { id: string; label: string; href: string; stores: string[]; definition: { id: string }; components: unknown[]; markup: DocumentFragment; source: Src } | null; pages: (string | null)[] };
};
type Src = { load(): Promise<unknown>; debugState(): { total: number }; query: { ask(r: unknown): Promise<void>; draft: { scopes: Record<string, { readings: Record<string, { picked?: string[] }> }> } } };

test('a `query` graph View shows a page\'s Query: the page\'s Open in Node Editor goes there, the page opened for its Query alone — its kept Query, no bar or element of its own — and Back takes an edit home (TODO 822)', async ({ page }) => {
  const said: string[] = [];
  page.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'error') said.push(m.text()); });
  await startOnPage(page, 'more');
  await page.evaluate(() => (window as unknown as PageWin).__page!.source.query.ask({ scope: 'data', field: 'status', reading: { picked: ['open'] } }));
  await expect.poll(() => page.evaluate(() => (window as unknown as PageWin).__page!.source.debugState().total)).toBe(8);
  // Its toolbar's Open in Node Editor: a request the outlet answers, to the app's `query` View.
  await page.evaluate(() => document.getElementById('bar')!.dispatchEvent(new CustomEvent('node-editor-open', { bubbles: true, composed: true, detail: {} })));
  await page.waitForFunction(() => (window as unknown as PageWin).__graphs?.page?.id === 'more');
  const r = await row(page);
  // A page with Views is a section, a row per View under it, opened on the View it was left on (plan 960 U4.8b).
  expect([r.url, r.graph, r.chips.map((c) => c.id), r.rows, r.noActions]).toEqual([
    'context=graphs&graph=more&view=pages', { view: 'pages', type: 'query', id: 'more/all', origin: 'preset' }, ['view', 'graph'],
    ['List', 'More', 'All items (Read only)', 'Open items (Read only)'], true,
  ]);
  // What the Context is handed: the page's definition, its source and kept Query, its components read from its markup off screen.
  const handed = await page.evaluate(async () => {
    const p = (window as unknown as PageWin).__graphs.page!;
    await p.source.load();
    const header = document.querySelector('sherpa-app-header')!;
    return {
      id: p.id, label: p.label, def: p.definition.id, stores: p.stores, components: p.components, href: new URL(p.href).search,
      reading: p.source.query.draft.scopes['data']?.readings['status']?.picked, total: p.source.debugState().total,
      offScreen: !!p.markup.getElementById('grid') && !document.getElementById('grid') && !document.getElementById('bar'),
      view: (p as unknown as { view?: string }).view,
      header: [header.hasAttribute('data-graph'), header.hasAttribute('data-readonly')],
    };
  });
  expect(handed).toEqual({
    id: 'more', label: 'More', def: 'more', stores: ['items'], components: [{ id: 'grid', label: 'The items', kind: 'grid', scope: 'data' }],
    href: '?context=more', reading: ['open'], total: 8, offScreen: true, view: 'all', header: [false, true],
  });
  // No bar or element is the page's here: nothing configured, so nothing missing is said.
  expect(said.filter((t) => /no #grid|provider-unknown/.test(t))).toEqual([]);
  // An edit to the page's Query here is the page's own: Back, it is on the page.
  await page.evaluate(() => (window as unknown as PageWin).__graphs.page!.source.query.ask({ scope: 'data', field: 'status', reading: { picked: ['shut'] } }));
  await expect.poll(() => page.evaluate(() => (window as unknown as PageWin).__graphs.page!.source.debugState().total)).toBe(4);
  await page.evaluate(() => { (window as unknown as PageWin).__page = null; });
  await page.goBack();
  await page.waitForFunction(() => (window as unknown as PageWin).__page?.id === 'more');
  expect((await row(page)).url).toBe('context=more');
  const home = await page.evaluate(async () => {
    const { source } = (window as unknown as PageWin).__page!;
    await source.load();
    return [source.query.draft.scopes['data']?.readings['status']?.picked, source.debugState().total];
  });
  expect(home).toEqual([['shut'], 4]);
});

test('the graph chip moves a `query` View between pages, each opened in turn; another View closes it; the first page is left out of the URL (TODO 822)', async ({ page }) => {
  await startOnPage(page, 'list');
  await page.evaluate(() => document.getElementById('bar')!.dispatchEvent(new CustomEvent('node-editor-open', { bubbles: true, composed: true, detail: {} })));
  await page.waitForFunction(() => (window as unknown as PageWin).__graphs?.page?.id === 'list');
  expect((await row(page)).url).toBe('context=graphs&view=pages');
  await pick(page, 'graph', 'All items');
  await page.waitForFunction(() => (window as unknown as PageWin).__graphs.page?.id === 'more');
  expect((await row(page)).url).toBe('context=graphs&graph=more/all&view=pages');
  await pick(page, 'view', 'Filters');
  await expect.poll(async () => (await row(page)).graph).toMatchObject({ view: 'filters', type: 'filter' });
  expect(await page.evaluate(() => (window as unknown as PageWin).__graphs.pages)).toEqual(['more', null]);
});

type Outlet = { savePageView(label?: string): Promise<string | undefined>; deletePageView(): Promise<boolean>; graph: { id: string; origin?: string } | null };

test('a page\'s View picked in the graph chip opens on it; Save view as makes the reader\'s own, Save writes over it, and it comes back on its page; Delete view opens its first (plan 960 U4.8b)', async ({ page }) => {
  await startOnPage(page, 'list');
  await page.evaluate(() => document.getElementById('bar')!.dispatchEvent(new CustomEvent('node-editor-open', { bubbles: true, composed: true, detail: {} })));
  await page.waitForFunction(() => (window as unknown as PageWin).__graphs?.page?.id === 'list');
  await pick(page, 'graph', 'Open items');
  await page.waitForFunction(() => (window as unknown as PageWin).__graphs.page?.id === 'more');
  const shown = () => page.evaluate(async () => {
    const p = (window as unknown as PageWin).__graphs.page!;
    await p.source.load();
    const header = document.querySelector('sherpa-app-header')!;
    return {
      view: (p as unknown as { view?: string }).view, reading: p.source.query.draft.scopes['data']?.readings['status']?.picked ?? null,
      graph: (document.querySelector('sherpa-outlet') as unknown as Outlet).graph,
      header: ['data-graph', 'data-readonly', 'data-custom-view'].filter((a) => header.hasAttribute(a)),
    };
  });
  // A preset View: its Query has the View on it, and it is read only.
  expect(await shown()).toEqual({ view: 'open', reading: ['open'], graph: { view: 'pages', type: 'query', id: 'more/open', origin: 'preset' }, header: ['data-readonly'] });
  const outlet = (fn: string, ...args: string[]) => page.evaluate(([f, a]) => (document.querySelector('sherpa-outlet') as unknown as Record<string, (...x: string[]) => Promise<unknown>>)[f as string]!(...(a as string[])), [fn, args] as const);
  // Saved over, a preset is refused.
  expect(await outlet('savePageView')).toBe(undefined);
  // Edited in the graph, as the graph asks the Query, then saved as the reader's own: the chip opens it.
  await page.evaluate(() => (window as unknown as PageWin).__graphs.page!.source.query.ask({ scope: 'data', field: 'status', reading: { picked: ['shut'] }, commit: true }));
  expect(await outlet('savePageView', 'Shut items')).toBe('shut-items');
  await expect.poll(async () => (await shown()).graph).toEqual({ view: 'pages', type: 'query', id: 'more/shut-items', origin: 'mine' });
  expect(await shown()).toMatchObject({ view: 'shut-items', reading: ['shut'], header: ['data-custom-view'] });
  expect((await row(page)).rows).toEqual(['List', 'More', 'All items (Read only)', 'Open items (Read only)', 'Shut items']);
  // Edited again and saved over: the same View.
  await page.evaluate(() => (window as unknown as PageWin).__graphs.page!.source.query.ask({ scope: 'data', field: 'status', reading: { picked: ['open', 'shut'] }, commit: true }));
  expect(await outlet('savePageView')).toBe('shut-items');
  // On its page, it comes back as saved.
  await page.evaluate(() => { (window as unknown as PageWin).__page = null; });
  await page.evaluate(() => (document.querySelector('sherpa-router') as unknown as { go(r: object): Promise<void> }).go({ context: 'more', view: 'shut-items', graph: null }));
  await page.waitForFunction(() => (window as unknown as PageWin).__page?.id === 'more');
  expect(await page.evaluate(async () => {
    const { source } = (window as unknown as PageWin).__page!;
    await source.load();
    return [source.query.draft.scopes['data']?.readings['status']?.picked, source.debugState().total];
  })).toEqual([['open', 'shut'], 12]);
  // Back in the graph, Delete view: the page opens on its first.
  await page.goBack();
  await expect.poll(async () => (await shown()).graph?.id).toBe('more/shut-items');
  expect(await outlet('deletePageView')).toBe(true);
  await expect.poll(async () => (await shown()).graph).toEqual({ view: 'pages', type: 'query', id: 'more/all', origin: 'preset' });
  expect((await row(page)).rows).toEqual(['List', 'More', 'All items (Read only)', 'Open items (Read only)']);
});
