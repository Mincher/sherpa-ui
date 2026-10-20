import { test, expect, type Page } from './harness';

/**
 * A TIERED CHIP — TODO 369. A bar's Customer chip opens the tree of Customers
 * and their Sites; its face groups the picks by customer: a whole one by its
 * name, one with some sites as "Northwind: London, Leeds" (Will, Q3). The
 * tooltip says the same. A site pick filters its customer AND that site.
 * TRAP T-a-tree-menu-keeps-its-ticks-as-data
 */
const ROWS = [
  { id: 1, customer: 'Northwind', site: 'Leeds' },
  { id: 2, customer: 'Northwind', site: 'London' },
  { id: 3, customer: 'Contoso', site: 'London' },
  { id: 4, customer: 'Contoso', site: null },
  { id: 5, customer: 'Tailspin', site: 'Paris' },
];
const path = (customer: string, site: string) => `{customer:${customer},site:${site}}`;

async function mount(page: Page) {
  await page.evaluate(async (rows) => {
    const { ArrayStore, openSource, bindSource } = await import('/dist/index.js') as unknown as {
      ArrayStore: new (r: unknown[], o: object) => unknown;
      openSource(d: object, s: unknown): Promise<{ describe(s: string): unknown; load(): Promise<void> }>;
      bindSource(s: unknown, el: Element, o: object): void;
    };
    const src = await openSource({
      store: 'rows', fields: { customer: { label: 'Customer', child: 'site' }, site: { label: 'Site' } },
      scopes: { view: { label: 'View', holds: ['customer'] } },
    }, new ArrayStore(rows, { key: 'id' }));
    // As the provider fills a bar: its scope's filters, then bound.
    const bar = await window.__mount('sherpa-quick-filter-toolbar',
      (src.describe('view') as { filters: unknown[] }).filters, { style: 'inline-size: 1200px' });
    bar.id = 'bar';
    bindSource(src, bar, { steerOnly: true, scope: 'view' });
    await src.load();
    (window as unknown as { __src: unknown }).__src = src;
    await window.__settled();
  }, ROWS);
}

/** Open the chip's menu, tick or untick, open a customer — then read the face and the rows. */
async function act(page: Page, steps: Array<['tick' | 'untick' | 'open', string]>) {
  return page.evaluate(async (steps) => {
    const bar = document.getElementById('bar')!;
    const chip = bar.shadowRoot!.querySelector<HTMLElement & { valueLabel: string }>('.chip[data-id="customer"]')!;
    const menu = chip.querySelector('sherpa-menu') as HTMLElement & { show(t: Element): void; hide(): void; open: boolean };
    if (!menu.open) menu.show(chip);
    await window.__settled();
    for (const [what, value] of steps) {
      if (what === 'open') {
        menu.querySelector<HTMLElement>(`.menu-row-twisty[data-value="${value}"]`)!.shadowRoot!.querySelector('button')!.click();
      } else {
        const box = menu.querySelector<HTMLInputElement>(`input[value="${CSS.escape(value)}"]`)!;
        if (box.checked !== (what === 'tick') || box.indeterminate) box.click();
      }
      await window.__settled();
    }
    await new Promise((r) => setTimeout(r, 100));
    await window.__settled();
    const src = (window as unknown as { __src: { rows: { id: number }[] } }).__src;
    return {
      face: chip.valueLabel,
      tip: chip.shadowRoot!.querySelector<HTMLElement>('.count-wrap')!.dataset['text'] ?? '',
      rows: src.rows.map((r) => r.id).sort((a, b) => a - b),
    };
  }, steps);
}

test('a customer picked whole reads as its name, and filters every row of it', async ({ page }) => {
  await mount(page);
  const r = await act(page, [['tick', 'Contoso']]);
  expect(r.face).toBe('Contoso');
  expect(r.rows).toEqual([3, 4]);
});

test('a site picked reads under its customer, and filters that site alone', async ({ page }) => {
  await mount(page);
  const r = await act(page, [['open', 'Northwind'], ['tick', path('Northwind', 'London')]]);
  expect(r.face).toBe('Northwind: London');
  expect(r.rows).toEqual([2]);
});

test('both: "Contoso, Northwind: Leeds, London" — the tooltip says it whole', async ({ page }) => {
  await mount(page);
  const r = await act(page, [['tick', 'Contoso'], ['open', 'Northwind'],
    ['tick', path('Northwind', 'Leeds')], ['tick', path('Northwind', 'London')]]);
  expect(r.face).toBe('Contoso…');
  expect(r.tip).toContain('Contoso, Northwind: Leeds, London');
  expect(r.rows).toEqual([1, 2, 3, 4]);
});
