import { test, expect } from '@playwright/test';

/**
 * A PINNED RAIL SURVIVES A VIEW SWAP AND A RELOAD.
 *
 * The rail REPORTS its mode; the app decides whether the pin is remembered.
 * The router used to write `nav.state = 'collapsed'` on every load, which
 * un-pinned the rail the moment you opened another view.
 *
 * TRAP T-session-store-is-the-third-tier — where the remembered value lives
 */
const APP = 'http://localhost:4200/?view=dashboard';

/** The rail's own mode, read from the attribute the state setter writes. */
const navState = (page: import('@playwright/test').Page): Promise<string | null> =>
  page.evaluate(() =>
    document.querySelector('sherpa-nav')?.getAttribute('data-nav-state') ?? null);

/** Click the rail's pin button, through the shadow DOM. */
async function clickPin(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(() => {
    const nav = document.querySelector('sherpa-nav');
    (nav?.shadowRoot?.querySelector('.pin') as HTMLElement)?.click();
  });
}

test.beforeEach(async ({ page }) => {
  // A previous run's stored pin must not decide this one.
  await page.goto(APP);
  await page.evaluate(() => localStorage.removeItem('sherpa:session:/nav/pinned'));
  await page.reload();
  await page.waitForFunction(() => !!document.querySelector('sherpa-nav')?.shadowRoot);
});

test('a pinned rail stays pinned when the view changes', async ({ page }) => {
  await clickPin(page);
  expect(await navState(page)).toBe('pinned');

  // Navigate with the ROUTER — the same path a nav row click takes.
  await page.evaluate(() => {
    history.pushState({ view: 'records' }, '', '?view=records');
    dispatchEvent(new PopStateEvent('popstate'));
  });
  await page.waitForFunction(() =>
    !!document.querySelector('#view-root sherpa-data-grid'), undefined, { timeout: 15000 });

  expect(await navState(page)).toBe('pinned');
});

test('a pinned rail is still pinned after a FULL reload', async ({ page }) => {
  await clickPin(page);
  expect(await navState(page)).toBe('pinned');

  await page.reload();
  await page.waitForFunction(() => !!document.querySelector('sherpa-nav')?.shadowRoot);

  expect(await navState(page)).toBe('pinned');
});

test('un-pinning is remembered too — a reload does not bring the pin back', async ({ page }) => {
  await clickPin(page);
  await clickPin(page);
  expect(await navState(page)).toBe('collapsed');

  await page.reload();
  await page.waitForFunction(() => !!document.querySelector('sherpa-nav')?.shadowRoot);

  expect(await navState(page)).not.toBe('pinned');
});
