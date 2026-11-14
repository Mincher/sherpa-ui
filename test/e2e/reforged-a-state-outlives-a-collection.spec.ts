import { test, expect, type Page } from './harness';

/**
 * A STATE OUTLIVES A COLLECTION — WebKit collected an element's `internals.states` when nothing held it and handed back a
 * new, empty set, while the element still matched the old `:state()`s; `toggleState`, writing only a change, then never
 * cleared one. A panel opened from its tab kept `:state(minimised)`, its body `display: none` (sherpa-demos-67,
 * 2026-11-14), and a grid filled from no rows kept `:state(empty)`, "No rows to display" over its 12 rows (TODO 948).
 * SherpaElement holds the set. Every engine: a page of garbage between the first state and the change.
 * TRAP T-webkit-drops-an-unheld-state-set
 */
const garbage = (page: Page) => page.evaluate(async () => {
  for (let round = 0; round < 20; round++) {
    let junk: unknown[] | null = [];
    for (let k = 0; k < 200000; k++) junk.push({ k, s: `x${k}` });
    junk = null;
    await new Promise((done) => setTimeout(done, 10));
  }
});

test('a panel opened from its tab after a collection is no tab: no :state(minimised), its body shown', async ({ page }) => {
  await page.evaluate(async () => {
    document.getElementById('root')!.innerHTML = '<sherpa-overlay-panel id="p" data-heading="Inspector" data-mode="tab" open><p>Body</p></sherpa-overlay-panel>';
    await customElements.whenDefined('sherpa-overlay-panel');
    await window.__settled();
  });
  const panel = page.locator('#p');
  expect(await panel.evaluate((p) => p.matches(':state(minimised)'))).toBe(true);
  await garbage(page);
  await panel.evaluate(async (p) => { p.setAttribute('data-mode', 'overlay'); await window.__settled(); });
  expect(await panel.evaluate((p) => [p.matches(':state(minimised)'), getComputedStyle(p.shadowRoot!.querySelector('.root')!).display])).toEqual([false, 'flex']);
});

test('a grid opened on no rows, then filled after a collection, is not empty: its rows shown (TODO 948)', async ({ page }) => {
  await page.evaluate(async () => {
    const { ArrayStore, DataSource } = await import('/dist/index.js');
    const provider = document.createElement('sherpa-provider') as HTMLElement & { provide(o: unknown): void };
    document.getElementById('root')!.replaceChildren(provider);
    provider.innerHTML = '<sherpa-data-grid id="g" data-scope="data"></sherpa-data-grid>';
    const grid = provider.querySelector('sherpa-data-grid') as HTMLElement & { columns: unknown[]; key: string };
    grid.columns = [{ field: 'name', header: 'Name' }];
    grid.key = 'id';
    const store = new ArrayStore([], { key: 'id' });
    const source = new DataSource({ store });
    provider.provide({ sources: { rows: source } });
    await source.load();
    await window.__settled();
    (window as never as { fill: () => Promise<void> }).fill = async () => {
      for (let n = 0; n < 12; n++) store.setRows(Array.from({ length: 12 }, (_, i) => ({ id: i + 1, name: `Row ${i + 1} ${n}` })));
      await source.load();
      await window.__settled();
    };
  });
  const grid = page.locator('#g');
  expect(await grid.evaluate((g) => g.matches(':state(empty)'))).toBe(true);
  await garbage(page);
  await page.evaluate(() => (window as never as { fill: () => Promise<void> }).fill());
  expect(await grid.evaluate((g) => [g.matches(':state(empty)'), g.shadowRoot!.querySelectorAll('.row').length,
    getComputedStyle(g.shadowRoot!.querySelector('.empty')!).display])).toEqual([false, 12, 'none']);
});
