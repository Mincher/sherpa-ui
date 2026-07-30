import { type Page, expect } from '@playwright/test';

/**
 * Shared spec helpers for the harness-page component tests.
 */

/** Navigate to the harness and wait until all components are registered. */
export async function openHarness(page: Page): Promise<void> {
  await page.goto('/test/e2e/harness.html');
  await page.waitForFunction(() => (window as unknown as { __sherpaReady?: boolean }).__sherpaReady === true, {
    timeout: 15_000,
  });
}

/**
 * Inject markup into #root and wait for the named custom element's first render.
 * Returns nothing — use page.evaluate for assertions against shadow DOM.
 */
export async function mount(page: Page, html: string, waitForTag?: string): Promise<void> {
  await page.evaluate((markup) => {
    const root = document.getElementById('root')!;
    root.innerHTML = markup;
  }, html);
  if (waitForTag) {
    await page.evaluate(async (tag) => {
      await customElements.whenDefined(tag);
      const el = document.querySelector(tag) as (HTMLElement & { rendered?: Promise<void> }) | null;
      if (el?.rendered) await el.rendered;
    }, waitForTag);
  }
}

/** Clear #root between tests. */
export async function clearRoot(page: Page): Promise<void> {
  await page.evaluate(() => { document.getElementById('root')!.innerHTML = ''; });
}

export { expect };
