import { test, expect } from './harness';

/**
 * A PRESET FILTER IS A PRESET OF ITS STORE — Will, TODO 776 (plan 776). The provider opens a page and
 * reads the keeper's Preset Filters over the page's store: each is a boolean chip on the bar of the
 * scope that holds its fields, after the page's own presets — the app's, then the reader's; one of
 * another store is not. A press asks the Query ONCE, and gives the rows its condition says. A Preset
 * Filter the reader saves while the page is open joins the bar; one that says no condition is said
 * in words and left off. Real pointer. TRAP T-a-preset-filter-is-a-preset-of-its-store
 */
const SETUP = `
  const { ArrayStore } = await import('/dist/index.js');
  const { onReport } = await import('/dist/data.js');
  const root = document.getElementById('root');
  const provider = document.createElement('sherpa-provider');
  provider.innerHTML = '<sherpa-quick-filter-toolbar data-scope="data"></sherpa-quick-filter-toolbar>';
  root.replaceChildren(provider);
  const bar = provider.querySelector('sherpa-quick-filter-toolbar');
  const rows = [
    { id: 1, status: 'active', plan: 'Pro' }, { id: 2, status: 'active', plan: 'Free' },
    { id: 3, status: 'trial', plan: 'Pro' }, { id: 4, status: 'churned', plan: 'Pro' },
  ];
  const filter = (id, label, field, value, store = 'customers') => ({
    v: 1, type: 'preset-filter', id, label, settings: { source: store },
    graph: { nodes: [{ id: 'c', kind: 'condition', x: 0, y: 0, values: { field, op: 'eq', value } }], routes: [{ from: 'c', to: '#out/where' }] },
  });
  window.said = [];
  onReport((r) => window.said.push(r.message));
  provider.keeper.entityPresets = [filter('active', 'Active', 'status', 'active'), filter('orders', 'Big orders', 'total', 'big', 'orders'),
    { ...filter('blank', 'Blank', 'status', 'x'), graph: { nodes: [], routes: [] } }];
  const page = { v: 1, id: 'customers', source: { store: 'customers', fields: { status: { label: 'Status' }, plan: { label: 'Plan' } },
    scopes: { data: { label: 'Rows', holds: ['status', 'plan'], presets: [{ id: 'pro', label: 'Pro', where: { plan: { eq: 'Pro' } } }] } } } };
  const settle = async () => { await window.__settled?.(); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); };
  const source = await provider.open(page, { stores: { customers: new ArrayStore(rows, { key: 'id' }) }, views: {} });
  await source.load();
  await settle();
  window.source = source;
  window.filter = filter;
  window.provider = provider;
`;
type W = { source: { debugState(): { total: number }; query: { ask(r: unknown): unknown } }; asked: unknown[]; said: string[];
  provider: { keeper: { entities: { save(e: unknown): Promise<boolean> } } }; filter(id: string, label: string, field: string, value: string): unknown };

test.beforeEach(async ({ page }) => {
  await page.evaluate(() => {
    for (const store of [localStorage, sessionStorage]) for (const key of Object.keys(store)) if (key.startsWith('sherpa:')) store.removeItem(key);
  });
  await page.evaluate(`(async () => { ${SETUP} })()`);
});

const chips = (page: import('@playwright/test').Page) => page.evaluate(() => [...document.querySelector('sherpa-quick-filter-toolbar')!.shadowRoot!
  .querySelectorAll<HTMLElement>('.chips > .chip[data-preset]')].map((c) => `${c.dataset['id']} ${c.getAttribute('data-label')}`));
const total = (page: import('@playwright/test').Page) => page.evaluate(() => (window as unknown as W).source.debugState().total);

test('the bar lists the page store\'s Preset Filters after its own presets; one of another store, and one that says no condition, are not', async ({ page }) => {
  expect(await chips(page)).toEqual(['preset:pro Pro', 'preset:preset-filter:active Active']);
  const said = await page.evaluate(() => (window as unknown as W).said);
  expect(said).toEqual(['sherpa-provider: the Preset Filter "Blank" sends no condition to its Where, so it is no preset of this page.']);
});

test('a press asks the Query once, and gives the rows its condition says; again, every row', async ({ page }) => {
  expect(await total(page)).toBe(4);
  await page.evaluate(() => {
    const w = window as unknown as W;
    const query = w.source.query;
    const ask = query.ask.bind(query);
    w.asked = [];
    query.ask = (r: unknown) => { w.asked.push(r); return ask(r); };
  });
  const chip = page.locator('sherpa-quick-filter-toolbar').locator('.chips > .chip[data-id="preset:preset-filter:active"]');
  await chip.locator('.body').click();
  await expect.poll(() => total(page)).toBe(2);
  await expect(chip).toHaveAttribute('data-current', '');
  expect(await page.evaluate(() => (window as unknown as W).asked)).toEqual([{ scope: 'data', preset: 'preset-filter:active', on: true, commit: true }]);
  await chip.locator('.body').click();
  await expect.poll(() => total(page)).toBe(4);
  await expect(chip).not.toHaveAttribute('data-current', '');
});

test('a Preset Filter the reader saves while the page is open joins the bar, after the app\'s', async ({ page }) => {
  await page.evaluate(async () => {
    const w = window as unknown as W;
    await w.provider.keeper.entities.save(w.filter('trials', 'Trials', 'status', 'trial'));
  });
  await expect.poll(() => chips(page)).toEqual(['preset:pro Pro', 'preset:preset-filter:active Active', 'preset:preset-filter:trials Trials']);
  await page.locator('sherpa-quick-filter-toolbar').locator('.chips > .chip[data-id="preset:preset-filter:trials"] .body').click();
  await expect.poll(() => total(page)).toBe(1);
});
