import { test, expect, type Page } from '@playwright/test';

/**
 * REAL-TIME DATA THROUGH THE DATA LAYER — TODO 14. The server pushes new
 * alerts over Server-Sent Events; an EventStore feeds them INTO the
 * Dashboard's alert store, and each tile follows: its value, and its
 * sparkline with it — 13's fix, a tile's value and its series are one.
 * Runs against a SECOND examples server (:4201) from this checkout, so a new
 * route never waits on a restart of :4200.
 * TRAP T-a-live-feed-goes-into-the-store
 */
const tile = (page: Page) => page.evaluate(() => {
  const metric = document.querySelector('#m-endpoints') as HTMLElement & { value?: number };
  // The sparkline hands CSS its numbers as --_v0…--_v7 on its own style.
  const spark = metric.shadowRoot!.querySelector<HTMLElement>('sherpa-sparkline');
  const line = spark ? [...Array(8).keys()].map((i) => spark.style.getPropertyValue(`--_v${i}`)).join(',') : '';
  return { value: metric.value ?? 0, line };
});

test('live alerts pushed by the server move a tile\'s value and its sparkline together', async ({ page }) => {
  await page.goto('http://localhost:4201/?context=dashboard&live=1&every=200');
  await page.waitForFunction(() => ((document.querySelector('#m-endpoints') as HTMLElement & { value?: number })?.value ?? 0) > 0);
  const first = await tile(page);
  await expect.poll(async () => (await tile(page)).value, { timeout: 15000 }).toBeGreaterThan(first.value);
  const later = await tile(page);
  // The 1,284 seeded, and any alert pushed before the first read — under load one lands first.
  expect(first.value).toBeGreaterThanOrEqual(1284);
  expect(first.line).not.toBe('');
  expect(later.line).not.toBe(first.line);
});

test('without ?live nothing is pushed', async ({ page }) => {
  await page.goto('http://localhost:4201/?context=dashboard&live=0');
  await page.waitForFunction(() => ((document.querySelector('#m-endpoints') as HTMLElement & { value?: number })?.value ?? 0) > 0);
  const first = await tile(page);
  await page.waitForTimeout(1200);
  expect((await tile(page)).value).toBe(first.value);
});
