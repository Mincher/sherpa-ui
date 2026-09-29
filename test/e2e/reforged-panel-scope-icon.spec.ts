import { test, expect } from '@playwright/test';

/**
 * A PANEL SECTION SHOWS WHAT IT FILTERS — TODO 97. The View's section wears
 * `monitor`, the grid's `table-columns`, in the order caret, icon, label. The
 * kind comes from the bound component (`asks.shows`), never a tag name.
 * Runs against the EXAMPLES server (:4200).
 * TRAP T-a-scope-says-what-it-shows
 */
test('on Records, each panel section wears the icon for what it filters, after its caret', async ({ page }) => {
  await page.goto('http://localhost:4200/?context=records');
  await page.waitForFunction(() =>
    !!document.querySelector('#context-root sherpa-data-grid')?.shadowRoot?.querySelector('.row, [role="row"]'));
  await page.evaluate(() => {
    (document.querySelector('sherpa-provider') as HTMLElement & { filterMode: string }).filterMode = 'panel';
  });
  await expect.poll(() => page.evaluate(() => {
    const panel = document.querySelector('#filter-panel') as HTMLElement;
    return [...panel.shadowRoot!.querySelectorAll<HTMLElement>('sherpa-accordion.scope')].map((a) => {
      const sr = a.shadowRoot!;
      const x = (s: string): number => sr.querySelector(s)!.getBoundingClientRect().x;
      return {
        scope: a.dataset['scope'], icon: a.dataset['icon'] ?? null, drawn: !!sr.querySelector('.icon svg'),
        order: x('.chevron') < x('.icon') && x('.icon') < x('.heading'),
      };
    });
  })).toEqual([
    { scope: 'view', icon: 'monitor', drawn: true, order: true },
    { scope: 'data', icon: 'table-columns', drawn: true, order: true },
  ]);
});
