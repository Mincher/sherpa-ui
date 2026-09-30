import { test, expect, type Page } from '@playwright/test';

/**
 * "SHOW FULL VIEW HIERARCHY" — Settings › Application › Navigation.
 *
 * On, every Context row lists its Views (presets, then saved ones) as child
 * rows. A View row is the View chip by another door: it picks THROUGH the chip,
 * so the chip, the URL and the lit row always name the same View.
 *
 * Runs against the EXAMPLES server (:4200).
 */
const APP = 'http://localhost:4200/';
const NAV = 'sherpa-app-shell > sherpa-nav';

const chip = (page: Page): Promise<string[] | null> => page.evaluate(() =>
  (document.querySelector('sherpa-app-shell > sherpa-app-header sherpa-quick-filter-toolbar') as
    (HTMLElement & { values?: Record<string, string[]> }) | null)?.values?.['view'] ?? null);

const current = (page: Page): Promise<string | undefined> => page.evaluate((nav) =>
  document.querySelector<HTMLElement>(nav)!.dataset['currentId'], NAV);

const search = (page: Page): string => new URL(page.url()).search;

/** The labels of one parent's child rows, in order. */
const childLabels = (page: Page, parent: string): Promise<string[]> => page.evaluate(([nav, p]) =>
  [...(document.querySelector(nav)?.shadowRoot
    ?.querySelectorAll(`.nav-row[data-parent="${p}"] sherpa-nav-item`) ?? [])]
    .map((i) => (i as HTMLElement).dataset['label'] ?? ''), [NAV, parent]);

/** A rail row by its label. Rows show only on an open rail, so hover it first. */
async function clickRow(page: Page, label: string): Promise<void> {
  await page.locator(NAV).hover({ position: { x: 20, y: 300 } });
  await page.locator(`${NAV} sherpa-nav-item[data-label="${label}"]`).click();
}

/** Start with the hierarchy on, as a reader who switched it on last visit. */
const withHierarchy = (page: Page): Promise<void> => page.addInitScript(() =>
  localStorage.setItem('sherpa:session:/nav/hierarchy', 'true'));

test('Application is one page: Notifications, Filtering, then the Navigation switch', async ({ page }) => {
  await page.goto(`${APP}?context=records&settings=application`);
  const sections = () => page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('#settings-root sherpa-section-header')].map((h) => h.dataset['heading']));
  await expect.poll(sections).toEqual(['Notifications', 'Filtering', 'Navigation']);
  expect(await page.evaluate(() =>
    (document.getElementById('notify-email') as HTMLElement & { checked: boolean }).checked)).toBe(true);
  await expect(page.locator('#nav-hierarchy')).toBeAttached();

  // A Settings Context has no Views, so the switch gives its row no children.
  await page.locator('#nav-hierarchy').click();
  await expect.poll(() => current(page)).toBe('settings-application');
  expect(await childLabels(page, 'settings-application')).toEqual([]);
});

test('the switch lists every Context\'s Views under its row, and takes them away again', async ({ page }) => {
  await page.goto(`${APP}?context=records&settings=application`);
  await expect(page.locator('#nav-hierarchy')).toBeAttached();
  await page.locator('#nav-hierarchy').click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('sherpa:session:/nav/hierarchy'))).toBe('true');

  await page.locator('#settings sherpa-app-header .back').click();
  await expect.poll(() => childLabels(page, 'context-records'))
    .toEqual(['All customers', 'My accounts', 'At risk', 'Renewals this quarter']);
  // Home opens the dashboard, so the dashboard's Views sit under it.
  expect(await childLabels(page, 'home')).toContain('Critical only');
  expect(await current(page)).toBe('context-records:all');

  // Remembered across a reload.
  await page.reload();
  await expect.poll(() => childLabels(page, 'context-records')).toHaveLength(4);

  await page.goto(`${APP}?context=records&settings=application`);
  await expect(page.locator('#nav-hierarchy')).toBeAttached();
  await page.locator('#nav-hierarchy').click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('sherpa:session:/nav/hierarchy'))).toBe('false');
  await page.locator('#settings sherpa-app-header .back').click();
  await expect.poll(() => current(page)).toBe('context-records');
  expect(await childLabels(page, 'context-records')).toEqual([]);
});

test('a View row picks through the View chip, and a chip pick lights its row', async ({ page }) => {
  await withHierarchy(page);
  await page.goto(`${APP}?context=records`);
  await expect.poll(() => chip(page)).toEqual(['all']);

  await clickRow(page, 'At risk');
  await expect.poll(() => chip(page)).toEqual(['risk']);
  expect(search(page)).toBe('?context=records&view=risk');
  expect(await current(page)).toBe('context-records:risk');
  // The row's own label never reaches the header — the header is the Context's.
  expect(await page.evaluate(() =>
    document.querySelector<HTMLElement>('sherpa-app-shell > sherpa-app-header')!.dataset['heading'])).toBe('Records');

  await page.evaluate(() => {
    const bar = document.querySelector('sherpa-app-shell > sherpa-app-header sherpa-quick-filter-toolbar') as
      HTMLElement & { setChipValues(id: string, v: string[]): void; report(): void };
    bar.setChipValues('view', ['mine']);
    bar.report();
  });
  await expect.poll(() => current(page)).toBe('context-records:mine');
  expect(search(page)).toBe('?context=records&view=mine');

  // The FIRST View is left out of the URL.
  await clickRow(page, 'All customers');
  await expect.poll(() => search(page)).toBe('?context=records');
});

test('a View row of another Context opens it on that View, and Back returns', async ({ page }) => {
  await withHierarchy(page);
  await page.goto(`${APP}?context=records`);
  await expect.poll(() => chip(page)).toEqual(['all']);

  await clickRow(page, 'Home');   // an Area now: it opens its Views, not the dashboard
  await clickRow(page, 'Critical only');
  await expect.poll(() => chip(page)).toEqual(['critical']);
  expect(search(page)).toBe('?context=dashboard&view=critical');
  expect(await current(page)).toBe('home:critical');

  await page.goBack();
  await expect.poll(() => chip(page)).toEqual(['all']);
  expect(search(page)).toBe('?context=records');
});

test('a URL with a View opens its Context on that View', async ({ page }) => {
  await page.goto(`${APP}?context=records&view=renewals`);
  await expect.poll(() => chip(page)).toEqual(['renewals']);
  // Hierarchy off: the Context's own row is the lit one.
  expect(await current(page)).toBe('context-records');
});
