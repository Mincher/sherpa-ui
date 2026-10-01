import { test, expect } from '@playwright/test';

/**
 * A COMPONENT IMPORTED ON ITS OWN draws as it does from the index: the shared
 * sheets are SherpaElement's own default, not something the index sets.
 * TODO 189, found by the 183 review.
 */
test('one component imported alone still adopts every shared sheet', async ({ page }) => {
  await page.goto('/test/reforged/single-import.html');
  const r = await page.evaluate(async () => {
    const b = document.getElementById('b') as HTMLElement & { rendered: Promise<void> };
    await customElements.whenDefined('sherpa-button');
    await b.rendered;
    return {
      sheets: b.shadowRoot!.adoptedStyleSheets.length,
      ring: getComputedStyle(b).getPropertyValue('--sherpa-focus-ring').trim() !== '',
    };
  });
  // Eight shared sheets, then the button's own.
  expect(r.sheets).toBeGreaterThanOrEqual(9);
  expect(r.ring).toBe(true);
});
