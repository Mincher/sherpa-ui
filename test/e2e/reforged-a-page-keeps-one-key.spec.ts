import { test, expect } from './harness';

/**
 * ONE KEY — TODO 321, Will A. An outlet opens a page under its Context's name,
 * so the page's saved Views and filters are kept where the outlet reads them,
 * whatever the definition's id says.
 */
test('a page opened with a key keeps its saved View and filters under that key, never its definition id', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    const { ArrayStore } = await import('/dist/index.js');
    for (const key of Object.keys(localStorage)) if (key.includes('page-id') || key.includes('context-name')) localStorage.removeItem(key);
    const provider = document.createElement('sherpa-provider');
    provider.saveAnyScope = true;
    document.getElementById('root').replaceChildren(provider);
    const rows = [{ id: 1, plan: 'Pro' }, { id: 2, plan: 'Free' }];
    await provider.open({
      v: 1, id: 'page-id',
      source: { store: 'plans', fields: { plan: { label: 'Plan' } }, scopes: { view: { label: 'View', holds: ['plan'] } } },
    }, { key: 'context-name', stores: { plans: new ArrayStore(rows, { key: 'id' }) }, views: {} });
    await provider.saveView('Mine');
    provider.saveFilters('Some');
    const keys = Object.keys(localStorage);
    return {
      underKey: keys.filter((k) => k.endsWith(':context-name')).map((k) => k.replace(/:context-name$/, '')).sort(),
      underId: keys.filter((k) => k.endsWith(':page-id')),
    };
  })()`) as { underKey: string[]; underId: string[] };
  expect(r.underKey).toEqual(['sherpa:filter-sets', 'sherpa:views']);
  expect(r.underId).toEqual([]);
});
