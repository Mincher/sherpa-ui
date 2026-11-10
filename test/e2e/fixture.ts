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

declare global {
  interface Window {
    /** Set by the harness page once its font has loaded. */
    __reforgedReady?: boolean;
    /** Resolves once every Sherpa element on the page has drawn. */
    __settled(): Promise<void>;
  }
}

/** Every layout canvas the page makes asks to be drawn (`data-drawn`). Plan 852 */
function askToDraw(): void {
  const ask = (el: Element) => {
    for (const c of [el, ...el.querySelectorAll('sherpa-layout-canvas')]) if (c.localName === 'sherpa-layout-canvas') c.setAttribute('data-drawn', '');
  };
  new MutationObserver((records) => { for (const r of records) for (const n of r.addedNodes) if (n instanceof Element) ask(n); })
    .observe(document, { childList: true, subtree: true });
}

export const test = base.extend({
  page: async ({ page }, use, info) => {
    // Google Chrome is the one engine that draws HTML in a canvas, so there each layout canvas asks to.
    if (info.project.name === 'chrome') await page.addInitScript(askToDraw);
    await use(parkThePointer(page));
  },
});
