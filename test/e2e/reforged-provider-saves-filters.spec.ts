import { test, expect } from './fixture';

/**
 * THE PROVIDER KEEPS A READER'S SAVED FILTERS, as it keeps saved Views: the app
 * names one, the provider stores it over the page's DATA and packs it into its
 * bar, and forgets one a bar deletes. TODO 191.
 * TRAP T-a-saved-filter-lives-with-its-data · TRAP T-save-packs-the-fields-into-one-chip
 */
test('saveFilter() keeps a filter over the data and packs it; a bar\'s delete forgets it', async ({ page }) => {
  await page.goto('/test/reforged/harness.html');
  await page.waitForFunction(() => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true);
  const r = await page.evaluate(`(async () => {
    const { ArrayStore } = await import('/dist/index.js');
    localStorage.removeItem('sherpa:filters:plans');
    const root = document.getElementById('root');
    const provider = document.createElement('sherpa-provider');
    provider.innerHTML = '<sherpa-quick-filter-toolbar data-scope="data" data-saveable></sherpa-quick-filter-toolbar>';
    root.replaceChildren(provider);
    const bar = provider.querySelector('sherpa-quick-filter-toolbar');
    const store = new ArrayStore([{ id: 1, plan: 'Pro' }, { id: 2, plan: 'Free' }, { id: 3, plan: 'Pro' }], { key: 'id' });
    const source = await provider.open({
      v: 1, id: 'plans',
      source: { store: 'plans', fields: { plan: { label: 'Plan' } }, scopes: { data: { label: 'Rows', holds: ['plan'] } } },
    }, { stores: { plans: store } });
    // The app names it; here, at once.
    provider.addEventListener('filter-save', (e) => provider.saveFilter('Pro only', e));
    bar.dispatchEvent(new CustomEvent('filter-save', {
      bubbles: true, composed: true, detail: { readings: { plan: { picked: ['Pro'] } } },
    }));
    await window.__settled?.();
    const stored = JSON.parse(localStorage.getItem('sherpa:filters:plans') ?? '{}');
    const on = source.query.applied.scopes.data?.presets?.['custom:pro-only'];
    const { total } = source.debugState();
    bar.deleteFilter('custom:pro-only');
    await window.__settled?.();
    return {
      stored, on, total,
      after: JSON.parse(localStorage.getItem('sherpa:filters:plans') ?? '{}'),
      declared: source.describe('data').filters.map((f) => f.id),
    };
  })()`) as Record<string, unknown>;
  expect(r['stored']).toEqual({ 'pro-only': { label: 'Pro only', where: { plan: { eq: 'Pro' } } } });
  expect(r['on']).toBe(true);
  expect(r['total']).toBe(2);
  expect(r['after']).toEqual({});
  expect(r['declared']).not.toContain('custom:pro-only');
});
