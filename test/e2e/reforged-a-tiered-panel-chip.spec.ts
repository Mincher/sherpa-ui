import { test, expect, type Page } from './harness';

/**
 * A TIERED FIELD IN THE PANEL — TODO 369. Each Customer is a chip; a press
 * turns it on or off and keeps its picked Sites (Will, Q2); its caret opens a
 * menu of its Sites, built when asked and gone when shut. A Site pick filters
 * that Site alone, and the chip reads ON.
 * TRAP T-a-parent-pick-is-the-parent
 */
const ROWS = [
  { id: 1, customer: 'Northwind', site: 'Leeds' },
  { id: 2, customer: 'Northwind', site: 'London' },
  { id: 3, customer: 'Contoso', site: 'London' },
  { id: 4, customer: 'Contoso', site: null },
  { id: 5, customer: 'Tailspin', site: 'Paris' },
];
const LONDON = '{customer:Northwind,site:London}';

async function mount(page: Page) {
  await page.evaluate(async (rows) => {
    const { ArrayStore, openSource, bindSource } = await import('/dist/index.js') as unknown as {
      ArrayStore: new (r: unknown[], o: object) => unknown;
      openSource(d: object, s: unknown): Promise<{ load(): Promise<void> }>;
      bindSource(s: unknown, el: Element, o: object): void;
    };
    const src = await openSource({
      store: 'rows', fields: { customer: { label: 'Customer', child: 'site' }, site: { label: 'Site' } },
      scopes: { view: { label: 'View', holds: ['customer'] } },
    }, new ArrayStore(rows, { key: 'id' }));
    const panel = await window.__mount<HTMLElement & { show(): void }>('sherpa-filter-panel', [], { style: 'inline-size: 400px' });
    panel.id = 'panel';
    panel.show();
    bindSource(src, panel, { steerOnly: true, scope: ['view'] });
    await src.load();
    (window as unknown as { __src: unknown }).__src = src;
    await window.__settled();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }, ROWS);
}

type Step = ['body' | 'caret', string] | ['tick', string] | ['apply'];

/** Act on the Customer chips, then read the rows, the chips and the answer. */
async function act(page: Page, steps: Step[]) {
  return page.evaluate(async (steps) => {
    const sr = document.getElementById('panel')!.shadowRoot!;
    const chip = (v: string) => sr.querySelector<HTMLElement>(`.field[data-field="customer"] .value[data-value="${v}"]`)!;
    const kids = () => sr.querySelector<HTMLElement & { shadowRoot: ShadowRoot }>('sherpa-menu[data-kids]');
    const settle = async () => {
      await window.__settled();
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    };
    for (const [what, value] of steps) {
      if (what === 'body' || what === 'caret') chip(value!).shadowRoot!.querySelector<HTMLElement>(`.${what}`)!.click();
      if (what === 'tick') {
        const box = kids()!.querySelector<HTMLInputElement>(`input[value="${CSS.escape(value!)}"]`)!;
        box.click();
      }
      if (what === 'apply') kids()!.shadowRoot.querySelector<HTMLElement>('.apply')!.shadowRoot!.querySelector('button')!.click();
      await settle();
    }
    const src = (window as unknown as { __src: {
      rows: { id: number }[]; query: { reading(s: string, f: string): { picked?: unknown[]; off?: unknown[] } | undefined };
    } }).__src;
    return {
      rows: src.rows.map((r) => r.id).sort((a, b) => a - b),
      on: [...sr.querySelectorAll<HTMLElement>('.field[data-field="customer"] .value[data-current]')].map((c) => c.dataset['value']),
      // Its sites — not its Select all.
      menu: kids() ? [...kids()!.querySelectorAll<HTMLInputElement>('input')].map((i) => i.value).filter((v) => v !== 'on') : null,
      reading: src.query.reading('view', 'customer') ?? null,
    };
  }, steps);
}

test('a press on a customer with nothing picked picks it whole, and opens no menu', async ({ page }) => {
  await mount(page);
  const r = await act(page, [['body', 'Northwind']]);
  expect(r.rows).toEqual([1, 2]);
  expect(r.on).toEqual(['Northwind']);
  expect(r.menu).toBeNull();
  expect(r.reading?.picked).toEqual(['Northwind']);
});

test('its caret opens its sites; a site picked filters that site, and the chip reads on', async ({ page }) => {
  await mount(page);
  const open = await act(page, [['caret', 'Northwind']]);
  expect(open.menu).toEqual(['{customer:Northwind,site:Leeds}', LONDON]);
  const r = await act(page, [['tick', LONDON], ['apply']]);
  expect(r.rows).toEqual([2]);
  expect(r.on).toEqual(['Northwind']);
  // A site, not the whole customer.
  expect(r.reading?.picked).toEqual([{ customer: 'Northwind', site: 'London' }]);
  // Applied, its menu shuts and goes.
  expect(r.menu).toBeNull();
});

test('a press turns a customer off and keeps its sites; the next brings them back', async ({ page }) => {
  await mount(page);
  await act(page, [['caret', 'Northwind'], ['tick', LONDON], ['apply']]);
  const off = await act(page, [['body', 'Northwind']]);
  expect(off.rows).toEqual([1, 2, 3, 4, 5]);
  expect(off.on).toEqual([]);
  expect(off.reading?.off).toEqual([{ customer: 'Northwind', site: 'London' }]);
  const on = await act(page, [['body', 'Northwind']]);
  expect(on.rows).toEqual([2]);
  expect(on.on).toEqual(['Northwind']);
});

test('a pick made through the Filters menu keeps the sites already picked', async ({ page }) => {
  await mount(page);
  await act(page, [['caret', 'Northwind'], ['tick', LONDON], ['apply']]);
  const r = await page.evaluate(async () => {
    const sr = document.getElementById('panel')!.shadowRoot!;
    const settle = async () => {
      await window.__settled();
      await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
    };
    // A SHUT scope's filters are doors in the Filters menu.
    (sr.querySelector('.scope[data-scope="view"]') as HTMLElement & { open: boolean }).open = false;
    await settle();
    const btn = sr.querySelector<HTMLElement>('.filters-btn')!;
    const menu = btn.querySelector('sherpa-menu') as HTMLElement & { show(t: Element): void; shadowRoot: ShadowRoot };
    menu.show(btn);
    await settle();
    // Drill into Customer: its rows are the tree, ticked from the picks.
    menu.querySelector<HTMLElement>('.menu-row[data-value="view:customer"] .menu-row-drill')!.click();
    await settle();
    await new Promise((res) => setTimeout(res, 50));
    menu.querySelector<HTMLInputElement>('input[value="Contoso"]')!.click();
    await settle();
    menu.shadowRoot.querySelector<HTMLElement>('.apply')!.shadowRoot!.querySelector('button')!.click();
    await settle();
    const src = (window as unknown as { __src: { rows: { id: number }[]; query: { reading(s: string, f: string): { picked?: unknown[] } | undefined } } }).__src;
    return {
      rows: src.rows.map((x) => x.id).sort((a, b) => a - b),
      picked: src.query.reading('view', 'customer')?.picked ?? null,
    };
  });
  expect(r.rows).toEqual([2, 3, 4]);
  expect(r.picked).toEqual(expect.arrayContaining(['Contoso', { customer: 'Northwind', site: 'London' }]));
  expect(r.picked).toHaveLength(2);
});
