import { test, expect } from './harness';

/**
 * A TIERED FIELD IN THE GRID — TODO 369. The Customer heading's menu is the
 * tree of Customers and their Sites; Site has no heading filter of its own;
 * a Site cell's chip picks that cell's PATH on Customer, and a second press
 * takes it off. TRAP T-a-parent-pick-is-the-parent
 */
const LONDON = '{customer:Northwind,site:London}';
const FILTERS = {
  customer: {
    id: 'customer', label: 'Customer', child: 'site', select: 'multiple',
    options: [
      { value: 'Contoso', label: 'Contoso' },
      { value: '{customer:Contoso,site:London}', label: 'London', parent: 'Contoso' },
      { value: 'Northwind', label: 'Northwind' },
      { value: '{customer:Northwind,site:Leeds}', label: 'Leeds', parent: 'Northwind' },
      { value: LONDON, label: 'London', parent: 'Northwind' },
    ],
  },
};

test.beforeEach(async ({ page }) => {
  await page.evaluate(async (filters) => {
    const el = document.createElement('sherpa-data-grid') as HTMLElement & { rendered?: Promise<void>; populate(d: unknown): void };
    el.setAttribute('data-column-filters', '');
    document.getElementById('root')!.replaceChildren(el);
    await el.rendered;
    el.populate({
      columns: [{ field: 'customer', header: 'Customer' }, { field: 'site', header: 'Site' }],
      rows: [{ customer: 'Northwind', site: 'Leeds' }, { customer: 'Northwind', site: 'London' }, { customer: 'Contoso', site: 'London' }],
      filters,
    });
    await window.__settled();
    const w = window as unknown as { heard: unknown[] };
    w.heard = [];
    el.addEventListener('column-filter-change', (e) => {
      const { field, reading, clause } = (e as CustomEvent).detail;
      w.heard.push({ field, reading, clause });
    });
  }, FILTERS);
});

test('the Customer heading opens the tree; Site has no heading filter', async ({ page }) => {
  const r = await page.evaluate(() => {
    const sr = document.querySelector('sherpa-data-grid')!.shadowRoot!;
    const menu = sr.querySelector('.head-cell[data-field="customer"] sherpa-menu');
    return {
      twisties: menu ? [...menu.querySelectorAll<HTMLElement>('.menu-row-twisty')].map((t) => t.dataset['value']) : null,
      site: !!sr.querySelector('.head-cell[data-field="site"] sherpa-menu'),
    };
  });
  expect(r.twisties).toEqual(['Contoso', 'Northwind']);
  expect(r.site).toBe(false);
});

test('a Site cell chip picks its path on Customer, and a second press lets it go: none (TODO 489)', async ({ page }) => {
  const cell = page.locator('sherpa-data-grid .row >> nth=1').locator('td.cell[data-field="site"]');
  await cell.hover();
  const chip = cell.locator('.cell-filter');
  await expect(chip.locator('.caret')).toHaveAttribute('aria-label', 'Filter Customer: London');
  await chip.locator('.caret').click();
  const heard = () => page.evaluate(() => (window as unknown as { heard: unknown[] }).heard);
  // The path, and its clause over both fields.
  await expect.poll(heard).toEqual([{
    field: 'customer', reading: { picked: [{ customer: 'Northwind', site: 'London' }], mode: 'simple' },
    clause: ['and', ['customer', 'eq', 'Northwind'], ['site', 'eq', 'London']],
  }]);
  await expect(cell.locator('.cell-filter')).toHaveAttribute('data-current', '');
  await cell.hover();
  await cell.locator('.cell-filter .caret').click();
  await expect.poll(async () => ((await heard()).at(-1) as { reading: unknown }).reading).toEqual({ picked: [], mode: 'simple', none: true });
});

test('a Site cell chip is inactive while the View holds Customer, and refuses', async ({ page }) => {
  await page.evaluate(() => (document.querySelector('sherpa-data-grid') as HTMLElement & {
    supersedeColumns(r: Record<string, unknown>, at?: string): void }).supersedeColumns({ customer: { picked: ['Contoso'] } }, 'View filters'));
  const cell = page.locator('sherpa-data-grid .row >> nth=1').locator('td.cell[data-field="site"]');
  await cell.hover();
  const chip = cell.locator('.cell-filter');
  await expect(chip).toHaveAttribute('data-superseded', '');
  await chip.evaluate((c) => c.shadowRoot!.querySelector<HTMLElement>('.caret')!.click());
  expect(await page.evaluate(() => (window as unknown as { heard: unknown[] }).heard)).toEqual([]);
});
