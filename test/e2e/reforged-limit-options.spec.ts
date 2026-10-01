import { test, expect, type Page } from '@playwright/test';

/**
 * WHAT THE OTHER FILTERS RULE OUT IS GREYED — Will, TODO 174 (110's B) and
 * 176. On the Dashboard, Adventure Works works in EMEA, AMER and APAC only, so
 * with "Limit filter options" on and Customer = Adventure Works, LATAM is
 * greyed and refused, and says why. A value already picked stays ticked.
 * TRAP T-a-ruled-out-value-is-greyed
 */
const APP = 'http://localhost:4200/?context=dashboard';

async function open(page: Page, limit: boolean): Promise<void> {
  await page.setViewportSize({ width: 1600, height: 1000 });
  // Before the app reads its session — a reload after the fact hung WebKit now and then.
  await page.addInitScript((on) => localStorage.setItem('sherpa:session:/filters/limit', JSON.stringify(on)), limit);
  await page.goto(APP);
  await page.waitForFunction(() => !!document.querySelector('#bar')?.shadowRoot?.querySelector('.bar'));
}

/** Set the header's View chips, as a reader's picks report. */
const pick = (page: Page, values: Record<string, string[]>): Promise<void> => page.evaluate((v) => {
  const header = document.querySelector('sherpa-app-shell sherpa-app-header') as HTMLElement & { values: Record<string, string[]> };
  header.values = v;
  (document.querySelector('sherpa-app-shell > sherpa-app-header sherpa-quick-filter-toolbar') as HTMLElement & { report(): void }).report();
}, values);

/** The header Region menu's rows: each value, and whether it is greyed, refused, ticked. */
const regionRows = (page: Page) => page.evaluate(() => {
  const bar = document.querySelector('sherpa-app-shell > sherpa-app-header sherpa-quick-filter-toolbar')!;
  const menu = bar.shadowRoot!.querySelector('.chip[data-id="region"] sherpa-menu')!;
  return Object.fromEntries([...menu.querySelectorAll<HTMLElement>('.menu-row')].map((row) => {
    const box = row.querySelector('input')!;
    return [box.value, {
      greyed: row.hasAttribute('data-unavailable'), refused: box.disabled, ticked: box.checked,
      says: box.getAttribute('aria-description'),
    }];
  }));
});

test('with "Limit filter options" on, a Customer pick greys the Regions it rules out, and says why', async ({ page }) => {
  await open(page, true);
  await pick(page, { customer: ['Adventure Works'], region: [] });
  await expect.poll(async () => (await regionRows(page))['LATAM']?.greyed).toBe(true);
  const rows = await regionRows(page);
  expect(rows['LATAM']).toEqual({ greyed: true, refused: true, ticked: false, says: 'No matches with your other filters.' });
  for (const region of ['EMEA', 'AMER', 'APAC']) expect(rows[region]).toMatchObject({ greyed: false, refused: false });

  // A pick it would rule out STAYS: ticked, and free to untick.
  await pick(page, { customer: [], region: ['LATAM'] });
  await pick(page, { customer: ['Adventure Works'], region: ['LATAM'] });
  await expect.poll(async () => (await regionRows(page))['LATAM']?.ticked).toBe(true);
  expect((await regionRows(page))['LATAM']).toMatchObject({ greyed: false, refused: false });
});

test('in the filter panel, a ruled-out value chip is greyed, refused, and its tooltip says why', async ({ page }) => {
  await open(page, true);
  await page.evaluate(() => {
    (document.querySelector('sherpa-provider') as HTMLElement & { filterMode: string }).filterMode = 'panel';
  });
  await pick(page, { customer: ['Adventure Works'], region: [] });
  const chip = () => page.evaluate(() => {
    const c = (document.querySelector('#filter-panel') as HTMLElement).shadowRoot!
      .querySelector<HTMLElement>('.scope[data-scope="view"] .field[data-field="region"] .value[data-value="LATAM"]');
    return c ? { greyed: c.hasAttribute('data-unavailable'), on: c.hasAttribute('data-current'),
      tip: c.shadowRoot!.querySelector<HTMLElement>('.count-wrap')?.dataset['text'] ?? '' } : null;
  });
  await expect.poll(async () => (await chip())?.greyed).toBe(true);
  expect(await chip()).toEqual({ greyed: true, on: false, tip: 'No matches with your other filters.' });
  // Pressed, it does nothing.
  await page.evaluate(() => (document.querySelector('#filter-panel') as HTMLElement).shadowRoot!
    .querySelector('.scope[data-scope="view"] .field[data-field="region"] .value[data-value="LATAM"]')!
    .shadowRoot!.querySelector<HTMLElement>('.body')!.click());
  await page.waitForTimeout(300);
  expect((await chip())?.on).toBe(false);
});

test('off — the default — nothing is greyed', async ({ page }) => {
  await open(page, false);
  await pick(page, { customer: ['Adventure Works'], region: [] });
  await page.waitForTimeout(600);
  expect((await regionRows(page))['LATAM']).toMatchObject({ greyed: false, refused: false });
});
