import { test, expect, parkThePointer, type Page } from './fixture';
import { gotoHarness } from './harness';

/**
 * ONE PAGE, ONE DOCUMENT, across two tabs — Will, 2026-10-20: "The only way to
 * share filter configurations across tabs, windows, or sessions is if they are
 * saved by the user." The reader's own Views and saved filters cross; the kept
 * Query and what was left on a View are the tab's. A saved filter is a Filter on
 * the app-wide shelf, a preset of its store's pages, never a chip's answer (605,
 * plan 960 U4.4c). State first: a reload's first load already asks the kept Query.
 * TRAP T-only-a-named-part-crosses-tabs · TRAP T-one-page-one-document
 */
const OPEN = `
  const { ArrayStore, PageKeeper } = await import('/dist/index.js');
  const settle = async () => { await window.__settled(); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); };
  const rows = [
    { id: 1, plan: 'Pro', tier: 'gold' }, { id: 2, plan: 'Free', tier: 'gold' }, { id: 3, plan: 'Pro', tier: 'silver' },
  ];
  // Each load the store is asked, and whether it named a filter.
  const loads = [];
  const store = new ArrayStore(rows, { key: 'id' });
  const load = store.load.bind(store);
  store.load = (options) => { loads.push(!!options?.filter); return load(options); };
  const provider = document.createElement('sherpa-provider');
  provider.keeper = new PageKeeper({ eachView: () => true });
  provider.settings.set('saveAnyScope', true);
  document.getElementById('root').replaceChildren(provider);
  const source = await provider.open({
    v: 1, id: 'plans',
    source: {
      store: 'plans', fields: { plan: { label: 'Plan' }, tier: { label: 'Tier', start: 'all' } },
      scopes: { view: { label: 'View', holds: ['tier'] }, data: { label: 'Rows', holds: ['plan'] } },
    },
  }, { stores: { plans: store }, views: {
    all: { label: 'All', query: { v: 1, scopes: { view: {} } } },
    gold: { label: 'Gold', query: { v: 1, scopes: { view: { where: { tier: { eq: 'gold' } } } } } },
  } });
  await source.load();
  await settle();
  const plan = () => source.query.applied.scopes.data?.readings.plan ?? null;
`;

const open = async (page: Page, then: string): Promise<Record<string, unknown>> =>
  page.evaluate(`(async () => { ${OPEN} ${then} })()`) as Promise<Record<string, unknown>>;

test('only what the reader names crosses tabs; the rest is the tab\'s, and comes back first on a reload', async ({ context }) => {
  const first = parkThePointer(await context.newPage());
  await gotoHarness(first);
  await first.evaluate(() => {
    for (const store of [localStorage, sessionStorage]) for (const key of Object.keys(store)) if (key.startsWith('sherpa:')) store.removeItem(key);
  });
  const a = await open(first, `
    source.query.ask({ scope: 'data', field: 'plan', reading: { picked: ['Pro'] } });
    await source.load();
    await settle();
    // The data scope's alone: the View's Tier reads All, an answer too.
    provider.settings.set('saveAnyScope', false);
    const ids = await provider.saveFilters('Pro rows', 'data');
    await provider.saveView('Mine', { stay: true });
    await source.load();
    await settle();
    const tab = JSON.parse(sessionStorage.getItem('sherpa:page:plans') ?? '{}');
    const shared = JSON.parse(localStorage.getItem('sherpa:page:plans') ?? '{}');
    const app = JSON.parse(localStorage.getItem('sherpa:page:#app') ?? '{}');
    return { ids, tab: Object.keys(tab).sort(), shared: Object.keys(shared).sort(), shelf: Object.keys(app.entities ?? {}),
      total: source.debugState().total };
  `);
  expect(a['ids']).toEqual(['pro-rows']);
  // The tab's own: the View and its Query. The shared: the named parts, the page's Views and the app's shelf.
  expect(a['tab']).toEqual(['query', 'v', 'view']);
  expect(a['shared']).toEqual(['v', 'views']);
  expect(a['shelf']).toEqual(['pro-rows']);
  expect(a['total']).toBe(2);

  // ANOTHER TAB: the same localStorage, its own sessionStorage.
  const second = parkThePointer(await context.newPage());
  await gotoHarness(second);
  const b = await open(second, `
    const before = { plan: plan(), total: source.debugState().total, presets: source.query.presets('data').map((p) => p.id),
      views: Object.keys(provider.keeper.read('plans').views ?? {}) };
    // Its Filter, pressed: a preset of the reader's, on — the reader's own answer stays empty.
    source.query.ask({ scope: 'data', preset: 'filter:pro-rows', on: true, commit: true });
    await source.load();
    await settle();
    const reading = plan();
    return { before, presets: Object.keys(reading?.byPreset ?? {}), own: reading?.picked ?? [], total: source.debugState().total };
  `);
  expect(b['before']).toEqual({ plan: null, total: 3, presets: ['filter:pro-rows'], views: ['mine'] });
  expect(b['presets']).toEqual(['filter:pro-rows']);
  expect(b['own']).toEqual([]);
  expect(b['total']).toBe(2);

  // A RELOAD of the first tab: its state, before the first rows.
  await first.reload();
  await first.waitForFunction(() => window.__reforgedReady === true);
  const again = await open(first, `
    return { first: loads[0], picked: plan()?.picked ?? [], total: source.debugState().total, presets: source.query.presets('data').map((p) => p.id) };
  `);
  expect(again).toEqual({ first: true, picked: ['Pro'], total: 2, presets: ['filter:pro-rows'] });
});
