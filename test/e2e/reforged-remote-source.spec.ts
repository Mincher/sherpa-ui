import { test, expect } from '@playwright/test';

/**
 * APPLY IS FOR A REMOTE FETCH. Will, 2026-09-27: over a local store every pick
 * applies at once; over a remote one (`?remote` spoofs it) a multi-select menu
 * waits for Apply, and the rows move only once it is pressed.
 * TRAP T-apply-and-discard-wait-for-a-change · TRAP T-commit-follows-select-mode
 */
const QFT = '#context-root sherpa-quick-filter-toolbar';

const read = (page: import('@playwright/test').Page) => page.evaluate((q) => {
  const bar = document.querySelector(q)!;
  return {
    total: (window as unknown as { sherpa?: { source?: { debugState(): { total: number } } } })
      .sherpa?.source?.debugState().total,
    apply: bar.shadowRoot!.querySelector('.chip[data-id="status"] sherpa-menu')!.hasAttribute('data-commit'),
  };
}, QFT);

const tickFirstStatus = async (page: import('@playwright/test').Page): Promise<void> => {
  const chip = page.locator(QFT).locator('.chips > .chip[data-id="status"]');
  await chip.locator('.caret').click();
  const first = await page.evaluate((q) => document.querySelector(q)!.shadowRoot!
    .querySelector<HTMLInputElement>('.chip[data-id="status"] label.menu-row:not(.qf-all) input')!.value, QFT);
  await chip.locator('sherpa-menu').locator(`label:has(input[value="${first}"])`).click();
};

const loaded = (page: import('@playwright/test').Page) => page.waitForFunction(() =>
  (window as unknown as { sherpa?: { source?: { debugState(): { loaded: boolean } } } })
    .sherpa?.source?.debugState().loaded, null, { timeout: 20_000 });

test('locally a tick applies at once — there is no Apply', async ({ page }) => {
  await page.goto('http://localhost:4200/?context=records');
  await loaded(page);
  expect((await read(page)).apply).toBe(false);
  await tickFirstStatus(page);
  await expect.poll(async () => (await read(page)).total).toBeLessThan(100);
});

test('remotely a tick waits for Apply, and the rows move only then', async ({ page }) => {
  await page.goto('http://localhost:4200/?context=records&remote');
  await loaded(page);
  expect(await read(page)).toEqual({ total: 100, apply: true });
  await tickFirstStatus(page);
  // The draft waits: the rows have not moved.
  await page.waitForTimeout(1200);
  expect((await read(page)).total).toBe(100);
  await page.locator(QFT).locator('.chips > .chip[data-id="status"] sherpa-menu').locator('.apply').click();
  await expect.poll(async () => (await read(page)).total, { timeout: 5000 }).toBeLessThan(100);
});
