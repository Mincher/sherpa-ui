import { test, expect } from './harness';

/**
 * SELECT ALL IS EVERY VALUE PICKED, NOT NO FILTER — Will, 2026-11-13: "When select all is chosen the badge isn't shown
 * with the match count for all values" and "Select All should mean that all values are selected. It's semantically
 * different from no filter applied." A chip on All filters by "has a value": a row with no value does not pass, and its
 * badge counts what it lets through, as a picked chip's does.
 * TRAP T-all-is-an-answer · TRAP T-a-chip-counts-within-the-filters-before-it
 */
test('a chip on All shows the rows it lets through, and a row with no value is not among them', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { ArrayStore } = await import('/dist/index.js');
    const root = document.getElementById('root')!;
    const provider = document.createElement('sherpa-provider') as HTMLElement & {
      open(def: unknown, options: unknown): Promise<{ debugState(): { total: number } } | undefined>;
    };
    provider.innerHTML = '<sherpa-quick-filter-toolbar id="bar" data-scope="view"></sherpa-quick-filter-toolbar>'
      + '<sherpa-data-grid id="grid"></sherpa-data-grid>';
    root.replaceChildren(provider);
    const rows = [
      { id: 1, tier: 'gold' }, { id: 2, tier: 'gold' }, { id: 3, tier: 'silver' }, { id: 4, tier: 'bronze' },
      // No tier: no filter lets these through; every tier picked does not.
      { id: 5, tier: '' }, { id: 6 },
    ];
    const source = await provider.open({
      v: 1, id: 'tiers',
      source: { store: 'tiers', fields: { tier: { label: 'Tier', start: 'all' } }, scopes: { view: { label: 'View', holds: ['tier'] } } },
    }, { key: 'tiers', stores: { tiers: new ArrayStore(rows, { key: 'id' }) }, views: { main: { label: 'Main' } }, view: 'main' });
    await window.__settled();
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    return source!.debugState().total;
  });
  expect(r).toBe(4);
  // Its badge is its count, once the walk has counted: what it lets through, as a picked chip's.
  const chip = () => page.evaluate(() => {
    const c = document.querySelector('#bar')!.shadowRoot!.querySelector<HTMLElement>('.chips > .chip[data-id="tier"]')!;
    return { badge: c.dataset['count'] ?? null, on: c.hasAttribute('data-current') };
  });
  await expect.poll(chip).toEqual({ badge: '4', on: true });
});
