import { test, expect, type Page } from './harness';

/**
 * A DRILLED TREE — TODO 391. A tiered field folded off a bar is not drilled
 * into the Filters menu: its parents open their children from their own list,
 * so its own menu shows, at the Filters button, and a parent opens there.
 * TRAP T-a-conditions-only-menu-cannot-be-drilled
 */
const ROWS = [
  { id: 1, customer: 'Northwind', site: 'Leeds', region: 'EMEA', tier: 'gold' },
  { id: 2, customer: 'Northwind', site: 'London', region: 'EMEA', tier: 'gold' },
  { id: 3, customer: 'Contoso', site: 'London', region: 'AMER', tier: 'silver' },
  { id: 4, customer: 'Tailspin', site: 'Paris', region: 'APAC', tier: 'bronze' },
];

async function mount(page: Page) {
  await page.evaluate(async (rows) => {
    const { ArrayStore, openSource, bindSource } = await import('/dist/index.js') as unknown as {
      ArrayStore: new (r: unknown[], o: object) => unknown;
      openSource(d: object, s: unknown): Promise<{ describe(s: string): unknown; load(): Promise<void> }>;
      bindSource(s: unknown, el: Element, o: object): void;
    };
    const src = await openSource({
      store: 'rows',
      fields: {
        region: { label: 'Region' }, tier: { label: 'Tier' },
        customer: { label: 'Customer', child: 'site' }, site: { label: 'Site' },
      },
      scopes: { view: { label: 'View', holds: ['region', 'tier', 'customer'] } },
    }, new ArrayStore(rows, { key: 'id' }));
    // Too narrow for every chip: the last folds into the Filters menu.
    const bar = await window.__mount('sherpa-quick-filter-toolbar',
      (src.describe('view') as { filters: unknown[] }).filters, { style: 'inline-size: 260px' });
    bar.id = 'bar';
    bindSource(src, bar, { steerOnly: true, scope: 'view' });
    await src.load();
    await window.__settled();
  }, ROWS);
}

test('a folded tiered chip shows its own tree at the Filters button, and a parent opens there', async ({ page }) => {
  await mount(page);
  const out = await page.evaluate(async () => {
    const bar = document.getElementById('bar')!;
    const chip = bar.shadowRoot!.querySelector<HTMLElement>('.chip[data-id="customer"]')!;
    const folded = chip.hasAttribute('data-folded-away');
    const add = bar.shadowRoot!.querySelector<HTMLElement>('.add-btn')!;
    const filters = add.querySelector<HTMLElement & { show(t: Element): void; open: boolean }>('sherpa-menu')!;
    filters.show(add);
    await window.__settled();
    filters.dispatchEvent(new CustomEvent('menu-drill', { bubbles: true, composed: true, detail: { value: 'customer' } }));
    await window.__settled();
    const tree = chip.querySelector<HTMLElement & { open: boolean }>('sherpa-menu')!;
    const shown = { tree: tree.open, filters: filters.open, drilled: filters.hasAttribute('data-drill') };
    tree.querySelector<HTMLElement>('.menu-row-twisty[data-value="Northwind"]')!.shadowRoot!.querySelector('button')!.click();
    await window.__settled();
    const sites = [...tree.querySelectorAll<HTMLElement>('.menu-row[data-parent="Northwind"]')].map((r) => r.textContent?.trim());
    return { folded, ...shown, sites };
  });
  expect(out.folded).toBe(true);
  expect(out).toMatchObject({ tree: true, filters: false, drilled: false });
  expect(out.sites).toEqual(['Leeds', 'London']);
});
