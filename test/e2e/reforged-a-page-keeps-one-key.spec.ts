import { test, expect } from './harness';

/**
 * ONE KEY — TODO 321, Will A. An outlet opens a page under its Context's name,
 * so the page's document — its saved Views too — is kept where the outlet reads
 * it, whatever the definition's id says. A reader's saved filters are Filters on
 * the app-wide shelf, under no page (plan 960 U4.4c). TRAP T-one-page-one-document
 */
test('a page opened with a key keeps its saved View under that key, never its definition id; its saved filters are the shelf\'s', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    const { ArrayStore } = await import('/dist/index.js');
    for (const store of [localStorage, sessionStorage]) {
      for (const key of Object.keys(store)) if (key.includes('page-id') || key.includes('context-name')) store.removeItem(key);
    }
    const provider = document.createElement('sherpa-provider');
    provider.settings.set('saveAnyScope', true);
    document.getElementById('root').replaceChildren(provider);
    const rows = [{ id: 1, plan: 'Pro' }, { id: 2, plan: 'Free' }];
    const source = await provider.open({
      v: 1, id: 'page-id',
      source: { store: 'plans', fields: { plan: { label: 'Plan' } }, scopes: { view: { label: 'View', holds: ['plan'] } } },
    }, { key: 'context-name', stores: { plans: new ArrayStore(rows, { key: 'id' }) }, views: {} });
    await provider.saveView('Mine');
    source.query.ask({ scope: 'view', field: 'plan', reading: { picked: ['Pro'] }, commit: true });
    const saved = await provider.saveFilters('Some');
    const keys = [...Object.keys(localStorage), ...Object.keys(sessionStorage)];
    const kept = JSON.parse(localStorage.getItem('sherpa:page:context-name') ?? '{}');
    return {
      underKey: keys.filter((k) => k.endsWith(':context-name')).sort(),
      named: { v: kept.v, views: Object.keys(kept.views ?? {}), filters: 'filters' in kept },
      underId: keys.filter((k) => k.endsWith(':page-id')),
      saved, shelf: Object.keys(JSON.parse(localStorage.getItem('sherpa:page:#app') ?? '{}').entities ?? {}),
    };
  })()`) as { underKey: string[]; named: unknown; underId: string[]; saved: string[]; shelf: string[] };
  expect(r.underKey).toEqual(['sherpa:page:context-name', 'sherpa:page:context-name']);
  expect(r.named).toEqual({ v: 3, views: ['mine'], filters: false });
  expect(r.underId).toEqual([]);
  expect(r.saved).toEqual(['some']);
  expect(r.shelf).toEqual(['some']);
});

/* A READER'S OWN WORK is not dropped with the old shape: their saved Views as v2
   kept them are read once into the page's document, a broken entry left out, and
   the old key goes. 695 U3, decision B. */
test('a reader\'s saved Views of the last shape are read once into the page\'s document', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    const { ArrayStore } = await import('/dist/index.js');
    for (const store of [localStorage, sessionStorage]) for (const key of Object.keys(store)) if (key.startsWith('sherpa:')) store.removeItem(key);
    localStorage.setItem('sherpa:views:old-page', JSON.stringify({ mine: { label: 'Mine', query: { v: 1, scopes: { view: {} } } }, broken: { label: 4 } }));
    const provider = document.createElement('sherpa-provider');
    document.getElementById('root').replaceChildren(provider);
    await provider.open({
      v: 1, id: 'old-page', source: { store: 'plans', fields: { plan: { label: 'Plan' } }, scopes: { view: { label: 'View', holds: ['plan'] } } },
    }, { stores: { plans: new ArrayStore([{ id: 1, plan: 'Pro' }], { key: 'id' }) }, views: { all: { label: 'All', query: { v: 1, scopes: { view: {} } } } } });
    const kept = JSON.parse(localStorage.getItem('sherpa:page:old-page') ?? '{}');
    return { views: Object.keys(kept.views ?? {}), old: localStorage.getItem('sherpa:views:old-page') };
  })()`) as Record<string, unknown>;
  expect(r).toEqual({ views: ['mine'], old: null });
});
