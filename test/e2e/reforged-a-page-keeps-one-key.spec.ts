import { test, expect } from './harness';

/**
 * ONE KEY — TODO 321, Will A. An outlet opens a page under its Context's name,
 * so the page's document — its saved Views and filters too — is kept where the
 * outlet reads it, whatever the definition's id says. TRAP T-one-page-one-document
 */
test('a page opened with a key keeps its saved View and filters under that key, never its definition id', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    const { ArrayStore } = await import('/dist/index.js');
    for (const store of [localStorage, sessionStorage]) {
      for (const key of Object.keys(store)) if (key.includes('page-id') || key.includes('context-name')) store.removeItem(key);
    }
    const provider = document.createElement('sherpa-provider');
    provider.settings.set('saveAnyScope', true);
    document.getElementById('root').replaceChildren(provider);
    const rows = [{ id: 1, plan: 'Pro' }, { id: 2, plan: 'Free' }];
    await provider.open({
      v: 1, id: 'page-id',
      source: { store: 'plans', fields: { plan: { label: 'Plan' } }, scopes: { view: { label: 'View', holds: ['plan'] } } },
    }, { key: 'context-name', stores: { plans: new ArrayStore(rows, { key: 'id' }) }, views: {} });
    await provider.saveView('Mine');
    provider.saveFilters('Some');
    const keys = [...Object.keys(localStorage), ...Object.keys(sessionStorage)];
    const kept = JSON.parse(localStorage.getItem('sherpa:page:context-name') ?? '{}');
    return {
      underKey: keys.filter((k) => k.endsWith(':context-name')).sort(),
      named: { v: kept.v, views: Object.keys(kept.views ?? {}), filters: Object.keys(kept.filters ?? {}) },
      underId: keys.filter((k) => k.endsWith(':page-id')),
    };
  })()`) as { underKey: string[]; named: unknown; underId: string[] };
  expect(r.underKey).toEqual(['sherpa:page:context-name', 'sherpa:page:context-name']);
  expect(r.named).toEqual({ v: 3, views: ['mine'], filters: ['some'] });
  expect(r.underId).toEqual([]);
});
