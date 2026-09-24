import { test, expect, type Page } from '@playwright/test';

/**
 * SETTINGS IS AN OVERLAY ON THE CONTEXT, SO LEAVING IT PUTS YOU BACK.
 *
 * The Context under it is never reloaded: its View, its rows and its DOM are
 * the ones you left. The URL carries both (`?context=records&settings=profile`),
 * and every way out — the settings button, the back arrow, ESC, browser Back —
 * goes through it.
 *
 * Runs against the EXAMPLES server (:4200).
 */
const APP = 'http://localhost:4200/?context=records';

const gridRows = (page: Page): Promise<number> => page.evaluate(() =>
  document.querySelector('#context-root sherpa-data-grid')!.shadowRoot!
    .querySelectorAll('.row, [role="row"]').length);

/** Open Records, pick the "At risk" View, and mark the grid to prove it survives. */
async function recordsAtRisk(page: Page): Promise<number> {
  await page.goto(APP);
  await page.waitForFunction(() =>
    !!document.querySelector('#context-root sherpa-data-grid')?.shadowRoot?.querySelector('.row, [role="row"]'));
  const all = await gridRows(page);
  await page.evaluate(() => document.querySelector('sherpa-app-shell > sherpa-app-header')!
    .dispatchEvent(new CustomEvent('quick-filter-change', {
      bubbles: true, composed: true, detail: { values: { view: ['risk'] } },
    })));
  await expect.poll(() => gridRows(page)).toBeLessThan(all);
  await page.evaluate(() => {
    document.querySelector<HTMLElement>('#context-root sherpa-data-grid')!.dataset['probe'] = 'kept';
  });
  return gridRows(page);
}

/** The settings button shows only on an open rail, so hover it first — as a person would. */
async function clickSettings(page: Page): Promise<void> {
  await page.locator('sherpa-app-shell > sherpa-nav').hover({ position: { x: 20, y: 300 } });
  await page.locator('sherpa-app-shell > sherpa-nav .settings').click();
}

const settingsOpen = (page: Page): Promise<boolean> =>
  page.evaluate(() => (document.getElementById('settings') as HTMLElement & { open: boolean }).open);

const ways: Array<[string, (page: Page) => Promise<void>]> = [
  ['the settings button', (page) => clickSettings(page)],
  ['the back arrow', (page) => page.locator('#settings sherpa-app-header .back').click()],
  ['ESC', (page) => page.keyboard.press('Escape')],
  ['browser Back', async (page) => { await page.goBack(); }],
];

for (const [name, leave] of ways) {
  test(`leaving Settings by ${name} restores the Context and its View`, async ({ page }) => {
    const risk = await recordsAtRisk(page);

    await clickSettings(page);
    await expect.poll(() => settingsOpen(page)).toBe(true);
    expect(new URL(page.url()).search).toBe('?context=records&settings=profile');

    await leave(page);
    await expect.poll(() => settingsOpen(page)).toBe(false);
    // ESC closes the dialog first; its QUEUED `close` then writes the URL.
    await expect.poll(() => new URL(page.url()).search).toBe('?context=records');

    const after = await page.evaluate(() => ({
      probe: document.querySelector<HTMLElement>('#context-root sherpa-data-grid')?.dataset['probe'],
      current: document.querySelector<HTMLElement>('sherpa-app-shell > sherpa-nav')!.dataset['currentId'],
      heading: document.querySelector<HTMLElement>('sherpa-app-shell > sherpa-app-header')!.dataset['heading'],
    }));
    expect(after.probe).toBe('kept');              // the same element: never reloaded
    expect(await gridRows(page)).toBe(risk);       // the View it was on
    expect(after.current).toBe('context-records');
    expect(after.heading).toBe('Records');
  });
}

test('a URL with settings opens the overlay on top of its Context', async ({ page }) => {
  await page.goto('http://localhost:4200/?context=records&settings=appearance');
  await expect.poll(() => settingsOpen(page)).toBe(true);
  const r = await page.evaluate(() => ({
    rail: document.querySelector<HTMLElement>('sherpa-app-shell > sherpa-nav')!.dataset['navState'],
    main: document.querySelector<HTMLElement>('sherpa-app-shell > sherpa-app-header')!.dataset['heading'],
    settings: document.querySelector<HTMLElement>('#settings sherpa-app-header')!.dataset['heading'],
  }));
  expect(r.rail).toBe('settings');
  expect(r.settings).toBe('Appearance');
  // The main header is the Context's, not the Settings row the rail shows.
  expect(r.main).toBe('Records');
});

test('a Settings View swaps the container, and its state comes from the snapshot', async ({ page }) => {
  await page.goto('http://localhost:4200/?context=dashboard&settings=profile');
  await expect.poll(() => settingsOpen(page)).toBe(true);
  const heading = () => page.evaluate(() =>
    document.querySelector<HTMLElement>('#view-region sherpa-container-header')?.dataset['heading']);
  await expect.poll(heading).toBe('Details');

  await page.evaluate(() => document.querySelector('#settings sherpa-app-header')!
    .dispatchEvent(new CustomEvent('quick-filter-change', {
      bubbles: true, composed: true, detail: { values: { view: ['notifications'] } },
    })));
  await expect.poll(heading).toBe('Notifications');
  // `checked` is dropped from View markup, so the snapshot sets it.
  expect(await page.evaluate(() =>
    (document.getElementById('notify-email') as HTMLElement & { checked: boolean }).checked)).toBe(true);
});
