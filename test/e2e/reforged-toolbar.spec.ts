import { test, expect } from '@playwright/test';

/** sherpa-toolbar — leading / trailing slot regions collapse when empty (data-has-*). */

const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(() => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true);
});

test('lays out leading / trailing slot regions', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-toolbar') as HTMLElement & { rendered?: Promise<void> };
    el.innerHTML = '<span slot="leading">L</span>';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    return {
      bar: !!el.shadowRoot?.querySelector('.bar'),
      hasLeading: el.hasAttribute('data-has-leading'),
      hasTrailing: el.hasAttribute('data-has-trailing'),
    };
  });
  expect(r.bar).toBe(true);
  expect(r.hasLeading).toBe(true);
  expect(r.hasTrailing).toBe(false); // empty trailing collapses
});
