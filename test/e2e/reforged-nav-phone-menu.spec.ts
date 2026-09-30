import { test, expect, type Page } from '@playwright/test';

/**
 * ON A PHONE THE NAV IS A MENU — TODO 17b. The rail and its inset go; the
 * header's menu button opens the nav over the whole screen, with no Pin,
 * Settings at the bottom and a Cancel that goes nowhere. An Area only opens;
 * a Context row goes, and the menu with it. Runs against the EXAMPLES server
 * (:4200). TRAP T-the-nav-is-a-menu-on-a-phone
 */
const look = (page: Page) => page.evaluate(() => {
  const header = document.querySelector('sherpa-app-shell > sherpa-app-header')!;
  const nav = document.querySelector('sherpa-nav') as HTMLElement;
  const frame = document.querySelector('sherpa-app-shell')!.shadowRoot!.querySelector<HTMLElement>('.frame')!;
  const shown = (el: Element | null) => !!el && getComputedStyle(el).display !== 'none';
  const b = nav.getBoundingClientRect();
  return {
    button: shown(header.shadowRoot!.querySelector('.nav-menu')),
    rail: getComputedStyle(nav).visibility,
    inset: getComputedStyle(frame).marginInlineStart,
    menu: nav.hasAttribute('data-menu'),
    fills: b.x === 0 && b.y === 0 && b.width === innerWidth && b.height === innerHeight,
    pin: !!nav.shadowRoot!.querySelector<HTMLElement>('.pin')?.checkVisibility(),
    foot: shown(nav.shadowRoot!.querySelector('.menu-foot')),
    url: location.search,
  };
});
const openMenu = (page: Page) => page.evaluate(() => document.querySelector('sherpa-app-shell > sherpa-app-header')!
  .shadowRoot!.querySelector<HTMLElement>('.nav-menu')!.shadowRoot!.querySelector<HTMLElement>('button')!.click());
const clickRow = (page: Page, id: string) => page.evaluate((i) => {
  const item = document.querySelector('sherpa-nav')!.shadowRoot!
    .querySelector<HTMLElement>(`.nav-row[data-id="${i}"] sherpa-nav-item`)!;
  // What a reader presses: the LINK where the row has one. The router hears a real link only.
  ((item.shadowRoot!.querySelector('a[href]') ?? item.shadowRoot!.querySelector('button')) as HTMLElement).click();
}, id);

test('on a phone the nav opens as a whole-screen menu; Cancel goes nowhere, a Context goes', async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 800 });
  await page.goto('http://localhost:4200/?context=records');
  await page.waitForFunction(() =>
    !!document.querySelector('#context-root sherpa-data-grid')?.shadowRoot?.querySelector('.row, [role="row"]'));

  const phone = await look(page);
  // Its glyph draws: an unknown icon name draws nothing, and no error.
  const glyph = await page.evaluate(() => {
    const btn = document.querySelector('sherpa-app-shell > sherpa-app-header')!.shadowRoot!.querySelector('.nav-menu')!;
    return btn.shadowRoot!.querySelector('.icon-start path')?.getBoundingClientRect().width ?? 0;
  });
  expect(glyph).toBeGreaterThan(0);
  await openMenu(page);
  await expect.poll(async () => (await look(page)).menu).toBe(true);
  const open = await look(page);
  // An AREA only opens: the menu stays.
  await clickRow(page, 'recent');
  const area = (await look(page)).menu;
  await page.evaluate(() => document.querySelector('sherpa-nav')!.shadowRoot!
    .querySelector<HTMLElement>('.menu-cancel')!.shadowRoot!.querySelector<HTMLElement>('button')!.click());
  const cancelled = await look(page);
  await openMenu(page);
  await clickRow(page, 'home');
  await expect.poll(async () => (await look(page)).url).toBe('?context=dashboard');
  const went = await look(page);

  expect(phone).toMatchObject({ button: true, rail: 'hidden', inset: '0px', menu: false });
  expect(open).toMatchObject({ menu: true, fills: true, pin: false, foot: true });
  expect(area).toBe(true);
  expect(cancelled).toMatchObject({ menu: false, url: '?context=records' });
  expect(went.menu).toBe(false);
});

test('wider than a phone, the rail stays and there is no menu button', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.goto('http://localhost:4200/?context=records');
  await page.waitForFunction(() =>
    !!document.querySelector('#context-root sherpa-data-grid')?.shadowRoot?.querySelector('.row, [role="row"]'));
  expect(await look(page)).toMatchObject({ button: false, rail: 'visible', menu: false });
});
