/**
 * Every spec's `test` and `expect`: Playwright's, with a page that parks the
 * pointer off the page after each `goto`. TRAP T-chromium-pointer-starts-on-the-page
 *
 * Map:
 * - `parkThePointer` — make a page's `goto` park the pointer; for a page the fixture did not make
 * - `test` — Playwright's `test`, whose `page` parks the pointer
 */
import { test as base, type Page } from '@playwright/test';

export * from '@playwright/test';

export function parkThePointer(page: Page): Page {
  const goto = page.goto.bind(page);
  page.goto = async (...args: Parameters<Page['goto']>) => {
    const response = await goto(...args);
    await page.mouse.move(-1, -1);
    return response;
  };
  return page;
}

export const test = base.extend({
  page: async ({ page }, use) => { await use(parkThePointer(page)); },
});
