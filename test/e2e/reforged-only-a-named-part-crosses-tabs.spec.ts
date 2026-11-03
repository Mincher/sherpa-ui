import { test, expect, parkThePointer, type Page } from './fixture';
import { gotoHarness } from './harness';

/**
 * ONE PAGE, ONE DOCUMENT, across two tabs — Will, 2026-10-20: "The only way to
 * share filter configurations across tabs, windows, or sessions is if they are
 * saved by the user." The reader's own Views and saved filters cross; the kept
 * Query, what was left on a View and a saved filter on a bar are the tab's. A
 * saved filter is a preset of the reader's, never a chip's answer (605). State
 * first: a reload's first load already asks the kept Query.
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
    const id = provider.saveFilters('Pro rows');
    provider.applyFilters(id);
    await provider.saveView('Mine', { stay: true });
    await source.load();
    await settle();
    const tab = JSON.parse(sessionStorage.getItem('sherpa:page:plans') ?? '{}');
    const shared = JSON.parse(localStorage.getItem('sherpa:page:plans') ?? '{}');
    return { id, tab: Object.keys(tab).sort(), shared: Object.keys(shared).sort(), total: source.debugState().total };
  `);
  expect(a['id']).toBe('pro-rows');
  // The tab's own: the View, its Query, the set on a bar. The shared: the named parts.
  expect(a['tab']).toEqual(['added', 'query', 'v', 'view']);
  expect(a['shared']).toEqual(['filters', 'v', 'views']);
  expect(a['total']).toBe(2);

  // ANOTHER TAB: the same localStorage, its own sessionStorage.
  const second = parkThePointer(await context.newPage());
  await gotoHarness(second);
  const b = await open(second, `
    const before = { plan: plan(), total: source.debugState().total, sets: provider.savedFilterSets,
      views: Object.keys(provider.keeper.read('plans').views ?? {}) };
    // Its saved filter, ticked: a preset of the reader's, on — the reader's own answer stays empty.
    provider.applyFilters('pro-rows');
    await source.load();
    await settle();
    const reading = plan();
    return { before, presets: Object.keys(reading?.byPreset ?? {}), own: reading?.picked ?? [], total: source.debugState().total };
  `);
  expect(b['before']).toEqual({
    plan: null, total: 3, sets: [{ id: 'pro-rows', label: 'Pro rows', added: false, own: true }], views: ['mine'],
  });
  expect(b['presets']).toEqual(['saved:pro-rows']);
  expect(b['own']).toEqual([]);
  expect(b['total']).toBe(2);

  // A RELOAD of the first tab: its state, before the first rows.
  await first.reload();
  await first.waitForFunction(() => window.__reforgedReady === true);
  const again = await open(first, `
    return { first: loads[0], picked: plan()?.picked ?? [], total: source.debugState().total, added: provider.savedFilterSets.map((s) => s.added) };
  `);
  expect(again).toEqual({ first: true, picked: ['Pro'], total: 2, added: [true] });
});
