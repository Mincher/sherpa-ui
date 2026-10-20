import { createRequire } from 'node:module';
import { test, expect, type Page } from './harness';

/**
 * A MENU DRAWS A TREE — TODO 369. Items with a `parent` are a tiered list: a
 * Customer, and its Sites as paths. The ticks are DATA: a parent box is on,
 * some or off; ticking every child leaves the parent at some (Will, Q1 A);
 * unticking one child of a picked parent picks the others. Sites open IN PLACE
 * (Q5), drawn the first time their customer opens.
 * TRAP T-a-tree-menu-keeps-its-ticks-as-data
 */
const path = (customer: string, site: string) => `{customer:${customer},site:${site}}`;

async function mount(page: Page, picked: string[] = [], select = 'multiple') {
  await page.evaluate(async ({ picked, select, P }) => {
    const menu = document.createElement('sherpa-menu') as HTMLElement & {
      rendered: Promise<void>; show(t?: HTMLElement): void; items(i: unknown[]): void;
    };
    menu.id = 'm';
    menu.setAttribute('data-select', select);
    menu.setAttribute('data-search', '');
    const anchor = document.createElement('button');
    anchor.textContent = 'Customer';
    document.getElementById('root')!.replaceChildren(anchor, menu);
    await menu.rendered;
    const items = [
      { value: 'Northwind' },
      { value: P.nl, label: 'Leeds', parent: 'Northwind' },
      { value: P.nn, label: 'London', parent: 'Northwind' },
      { value: 'Contoso' },
      { value: P.cl, label: 'London', parent: 'Contoso' },
      { value: 'Tailspin' },
    ];
    menu.items(items.map((i) => ({ ...i, selected: picked.includes(i.value) })));
    menu.show(anchor);
    await window.__settled();
  }, { picked, select, P: { nl: path('Northwind', 'Leeds'), nn: path('Northwind', 'London'), cl: path('Contoso', 'London') } });
}

/** Each drawn row: its value, its box, and whether it shows. */
async function rows(page: Page) {
  return page.evaluate(() => [...document.getElementById('m')!.querySelectorAll<HTMLElement>('.menu-row:not(.qf-all)')].map((row) => {
    const box = row.querySelector('input')!;
    return {
      value: box.value,
      box: box.indeterminate ? 'some' : box.checked ? 'on' : 'off',
      shown: getComputedStyle(row).display !== 'none',
    };
  }));
}
const values = (page: Page) => page.evaluate(() => (document.getElementById('m') as HTMLElement & { values: string[] }).values);
const box = (page: Page, value: string) => page.locator(`#m input[value="${value}"]`);
const twisty = (page: Page, value: string) => page.locator(`#m .menu-row-twisty[data-value="${value}"]`);

test('a shut customer draws no sites; its box says some when one is picked', async ({ page }) => {
  await mount(page, [path('Northwind', 'London')]);
  expect(await rows(page)).toEqual([
    { value: 'Northwind', box: 'some', shown: true },
    { value: 'Contoso', box: 'off', shown: true },
    { value: 'Tailspin', box: 'off', shown: true },
  ]);
  expect(await values(page)).toEqual([path('Northwind', 'London')]);
});

test('the twisty opens a customer in place, and never ticks it', async ({ page }) => {
  await mount(page);
  await twisty(page, 'Northwind').click();
  await page.evaluate(() => window.__settled());
  expect((await rows(page)).map((r) => [r.value, r.shown])).toEqual([
    ['Northwind', true], [path('Northwind', 'Leeds'), true], [path('Northwind', 'London'), true],
    ['Contoso', true], ['Tailspin', true],
  ]);
  expect(await values(page)).toEqual([]);
  await twisty(page, 'Northwind').click();
  expect((await rows(page)).filter((r) => r.shown).map((r) => r.value)).toEqual(['Northwind', 'Contoso', 'Tailspin']);
});

test('ticks: a parent whole; one child off a picked parent picks the others; every child is still some', async ({ page }) => {
  await mount(page);
  await twisty(page, 'Northwind').click();
  await box(page, 'Northwind').check();
  expect(await values(page)).toEqual(['Northwind']);
  expect((await rows(page)).slice(0, 3).map((r) => r.box)).toEqual(['on', 'on', 'on']);

  await box(page, path('Northwind', 'Leeds')).uncheck();
  expect(await values(page)).toEqual([path('Northwind', 'London')]);
  expect((await rows(page)).slice(0, 3).map((r) => r.box)).toEqual(['some', 'off', 'on']);

  await box(page, path('Northwind', 'Leeds')).check();
  expect(await values(page)).toEqual([path('Northwind', 'Leeds'), path('Northwind', 'London')]);
  expect((await rows(page))[0]!.box).toBe('some');

  // The parent's box from some: the parent, whole.
  await box(page, 'Northwind').click();
  expect(await values(page)).toEqual(['Northwind']);
});

test('Select all ticks every customer; Clear takes every tick', async ({ page }) => {
  await mount(page, [path('Contoso', 'London')]);
  await page.locator('#m .qf-all input').check();
  expect(await values(page)).toEqual(['Northwind', 'Contoso', 'Tailspin']);
  await page.locator('#m .qf-all input').uncheck();
  expect(await values(page)).toEqual([]);
});

test('ArrowRight opens a customer, ArrowLeft shuts it — from a site, its customer takes the focus', async ({ page }) => {
  await mount(page);
  await box(page, 'Northwind').focus();
  await page.keyboard.press('ArrowRight');
  await expect(box(page, path('Northwind', 'Leeds'))).toBeVisible();
  await expect(box(page, 'Northwind')).toHaveAttribute('aria-expanded', 'true');
  await box(page, path('Northwind', 'Leeds')).focus();
  await page.keyboard.press('ArrowLeft');
  await expect(box(page, path('Northwind', 'Leeds'))).toBeHidden();
  await expect(box(page, 'Northwind')).toBeFocused();
  await expect(box(page, 'Northwind')).toHaveAttribute('aria-expanded', 'false');
});

test('a search finds a site in the data, its customer held open; cleared, it shuts again', async ({ page }) => {
  await mount(page);
  await page.locator('#m .search input').fill('leeds');
  await page.evaluate(() => window.__settled());
  expect((await rows(page)).filter((r) => r.shown).map((r) => r.value)).toEqual(['Northwind', path('Northwind', 'Leeds')]);
  await page.locator('#m .search input').fill('');
  await page.evaluate(() => window.__settled());
  expect((await rows(page)).filter((r) => r.shown).map((r) => r.value)).toEqual(['Northwind', 'Contoso', 'Tailspin']);
});

test('the open customers are kept across new items', async ({ page }) => {
  await mount(page);
  await twisty(page, 'Contoso').click();
  await page.evaluate(() => {
    const menu = document.getElementById('m') as HTMLElement & { items(i: unknown[]): void };
    menu.items([{ value: 'Contoso' }, { value: '{customer:Contoso,site:London}', label: 'London', parent: 'Contoso' }]);
  });
  await expect(box(page, path('Contoso', 'London'))).toBeVisible();
});

test('a site the filters before rule out is greyed, as a customer is', async ({ page }) => {
  await mount(page);
  await twisty(page, 'Northwind').click();
  await page.evaluate((keep) => { (document.getElementById('m') as HTMLElement & { present: string[] }).present = keep; },
    ['Northwind', path('Northwind', 'London'), 'Contoso', path('Contoso', 'London')]);
  await expect(box(page, path('Northwind', 'Leeds'))).toBeDisabled();
  await expect(box(page, path('Northwind', 'London'))).toBeEnabled();
  await expect(box(page, 'Tailspin')).toBeDisabled();
});

test('a site says its customer; a customer says open or shut and which rows it opens', async ({ page }) => {
  await mount(page);
  await twisty(page, 'Northwind').click();
  const said = await page.evaluate(() => {
    const m = document.getElementById('m')!;
    const nw = m.querySelector<HTMLInputElement>('input[value="Northwind"]')!;
    const leeds = m.querySelector<HTMLInputElement>('input[value="{customer:Northwind,site:Leeds}"]')!;
    return {
      controls: nw.getAttribute('aria-controls')!.split(' ').map((id) => document.getElementById(id)?.querySelector('input')?.value),
      describedBy: document.getElementById(leeds.getAttribute('aria-describedby')!)?.textContent,
      leaf: m.querySelector<HTMLInputElement>('input[value="Tailspin"]')!.hasAttribute('aria-expanded'),
    };
  });
  expect(said).toEqual({
    controls: [path('Northwind', 'Leeds'), path('Northwind', 'London')], describedBy: 'Northwind', leaf: false,
  });
});

test('single select: a site is a radio, one pick in the whole tree', async ({ page }) => {
  await mount(page, ['Contoso'], 'single');
  await twisty(page, 'Northwind').click();
  await box(page, path('Northwind', 'Leeds')).check();
  expect(await values(page)).toEqual([path('Northwind', 'Leeds')]);
  expect((await rows(page)).map((r) => r.box)).toEqual(['off', 'on', 'off', 'off', 'off']);
});

test('an open tree passes axe, WCAG 2.1 AA: its twisty is hidden from it, its boxes say the tree', async ({ page }) => {
  await mount(page, [path('Northwind', 'London')]);
  await twisty(page, 'Northwind').click();
  await page.addScriptTag({ path: createRequire(import.meta.url).resolve('axe-core/axe.min.js') });
  const found = await page.evaluate(async () => {
    const r = await (window as unknown as { axe: { run(n: Element, o: object): Promise<{ violations: { id: string }[] }> } }).axe
      .run(document.getElementById('root')!, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }, resultTypes: ['violations'] });
    return r.violations.map((v) => v.id);
  });
  expect(found).toEqual([]);
});
