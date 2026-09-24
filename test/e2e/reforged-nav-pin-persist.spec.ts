import { test, expect } from '@playwright/test';

/**
 * A PINNED RAIL SURVIVES A VIEW SWAP AND A RELOAD.
 *
 * The rail REPORTS its mode; the app decides whether the pin is remembered.
 * The router used to write `nav.state = 'collapsed'` on every load, which
 * un-pinned the rail the moment you opened another Context.
 *
 * TRAP T-session-store-is-the-third-tier — where the remembered value lives
 */
const APP = 'http://localhost:4200/?context=dashboard';

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

/**
 * Wait for the rail to be USABLE, not merely present.
 *
 * A shadowRoot exists before the template lands in it. Firefox reliably shows a
 * rail with an empty root and no `data-nav-state`, where Chromium has both by
 * the same tick — so waiting on the root alone read a null state and clicked a
 * `.pin` that was not there yet. Traced in Firefox: at t=0 no `.pin` and no
 * state; by t=40ms both. TRAP T-a-shadow-root-precedes-its-template
 */
const railReady = (page: import('@playwright/test').Page): Promise<unknown> =>
  page.waitForFunction(() => {
    const nav = document.querySelector('sherpa-nav');
    return !!nav?.shadowRoot?.querySelector('.pin') && !!nav.getAttribute('data-nav-state');
  });

test.beforeEach(async ({ page }) => {
  // A previous run's stored pin must not decide this one.
  await page.goto(APP);
  await page.evaluate(() => localStorage.removeItem('sherpa:session:/nav/pinned'));
  await page.reload();
  await railReady(page);
});

test('a pinned rail stays pinned when the Context changes', async ({ page }) => {
  await clickPin(page);
  expect(await navState(page)).toBe('pinned');

  // Navigate with the ROUTER — the same path a nav row click takes.
  await page.evaluate(() => {
    history.pushState({ context: 'records' }, '', '?context=records');
    dispatchEvent(new PopStateEvent('popstate'));
  });
  await page.waitForFunction(() =>
    !!document.querySelector('#context-root sherpa-data-grid'), undefined, { timeout: 15000 });

  expect(await navState(page)).toBe('pinned');
});

test('a pinned rail is still pinned after a FULL reload', async ({ page }) => {
  await clickPin(page);
  expect(await navState(page)).toBe('pinned');

  await page.reload();
  await railReady(page);

  expect(await navState(page)).toBe('pinned');
});

test('un-pinning is remembered too — a reload does not bring the pin back', async ({ page }) => {
  await clickPin(page);
  await clickPin(page);
  expect(await navState(page)).toBe('collapsed');

  await page.reload();
  await railReady(page);

  expect(await navState(page)).not.toBe('pinned');
});
