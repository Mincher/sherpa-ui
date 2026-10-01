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

  // A pick the LATER answer rules out is set aside: still ticked, greyed, free to untick (180).
  await pick(page, { customer: [], region: ['LATAM'] });
  await pick(page, { customer: ['Adventure Works'], region: ['LATAM'] });
  await expect.poll(async () => (await regionRows(page))['LATAM']?.greyed).toBe(true);
  expect((await regionRows(page))['LATAM']).toEqual({
    greyed: true, refused: false, ticked: true, says: 'Not applied: no matches with your other filters.' });
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

/**
 * A LATER ANSWER WINS — Will, TODO 180: "Customer A is selected but made
 * unviable by Region C being activated … possible if Customer B makes Region C
 * viable again." Contoso makes Latin America viable; picked, it sets Adventure
 * Works aside: still ticked, greyed, free to untick, and not in the rows.
 * TRAP T-a-later-answer-sets-an-earlier-pick-aside
 */
test('a later Region pick sets aside the Customer it rules out: ticked, greyed, and not applied', async ({ page }) => {
  await open(page, true);
  await pick(page, { customer: ['Adventure Works', 'Contoso'], region: [] });
  await expect.poll(async () => (await regionRows(page))['LATAM']?.greyed).toBe(false);
  await pick(page, { customer: ['Adventure Works', 'Contoso'], region: ['LATAM'] });

  const customerRows = () => page.evaluate(() => {
    const bar = document.querySelector('sherpa-app-shell > sherpa-app-header sherpa-quick-filter-toolbar')!;
    const menu = bar.shadowRoot!.querySelector('.chip[data-id="customer"] sherpa-menu')!;
    return Object.fromEntries([...menu.querySelectorAll<HTMLElement>('.menu-row')].map((row) => {
      const box = row.querySelector('input')!;
      return [box.value, { greyed: row.hasAttribute('data-unavailable'), refused: box.disabled, ticked: box.checked,
        says: box.getAttribute('aria-description') }];
    }));
  });
  await expect.poll(async () => (await customerRows(page))['Adventure Works']?.greyed).toBe(true);
  expect((await customerRows(page))['Adventure Works']).toEqual({
    greyed: true, refused: false, ticked: true, says: 'Not applied: no matches with your other filters.' });
  expect((await customerRows(page))['Contoso']).toMatchObject({ greyed: false, ticked: true });

  // The Alerts tile counts Contoso's Latin America alerts alone.
  const want = await page.evaluate(async () => {
    const { alerts } = await import('/contexts/dashboard-data.js');
    return (alerts() as Array<{ customer: string; region: string }>)
      .filter((a) => a.region === 'LATAM' && ['Adventure Works', 'Contoso'].includes(a.customer)).length;
  });
  await expect.poll(() => page.evaluate(() =>
    document.querySelector('#m-endpoints')!.getAttribute('data-value'))).toBe(want.toLocaleString());
});
