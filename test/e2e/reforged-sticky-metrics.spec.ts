import { test, expect, type Page } from '@playwright/test';

/**
 * EXPERIMENT, TODO 143: the first row's metrics, scrolled past the top of the
 * content area, gather into a small sticky header — and go back when the
 * reader scrolls up. Off unless Settings › Experiments turns it on.
 */
const APP = 'http://localhost:4200/?context=dashboard';

async function open(page: Page, on: boolean): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 600 });
  await page.goto(APP);
  await page.evaluate((v) => localStorage.setItem('sherpa:session:/experiments/stickyMetrics', JSON.stringify(v)), on);
  await page.reload();
  await page.waitForFunction(() =>
    (document.querySelector('#m-endpoints')?.getAttribute('data-value') ?? '') !== '');
}

/** Scroll the content area, as a reader does. */
const scroll = (page: Page, y: number): Promise<void> => page.evaluate((top) => {
  document.querySelector('sherpa-app-shell')!.shadowRoot!.querySelector('.context-frame')!.scrollTo({ top });
}, y);

const look = (page: Page) => page.evaluate(() => {
  const root = document.querySelector('#context-root')!;
  const frame = document.querySelector('sherpa-app-shell')!.shadowRoot!.querySelector('.context-frame')!;
  const copies = [...root.querySelectorAll<HTMLElement>('[data-sticky-metrics] sherpa-metric')];
  const first = copies[0];
  return {
    stuck: root.hasAttribute('data-metrics-stuck'),
    copies: copies.map((c) => `${c.dataset['label']} ${c.dataset['value']}`),
    originals: ['m-endpoints', 'm-alerts', 'm-uptime', 'm-patch'].map((id) => {
      const m = document.getElementById(id)!;
      return `${m.dataset['label']} ${m.dataset['value']}`;
    }),
    // At the top of the content area, and half the tile's value size.
    atTop: first ? Math.abs(first.getBoundingClientRect().top - frame.getBoundingClientRect().top) < 1 : null,
    size: first ? getComputedStyle(first.shadowRoot!.querySelector('.value')!).fontSize : null,
    hidden: getComputedStyle(document.getElementById('m-endpoints')!).visibility,
  };
});

test('scrolled past, the first row of metrics becomes a small sticky header; scrolled back, it goes', async ({ page }) => {
  await open(page, true);
  expect((await look(page)).stuck).toBe(false);

  await scroll(page, 300);
  await expect.poll(async () => (await look(page)).stuck).toBe(true);
  const r = await look(page);
  expect(r.copies).toEqual(r.originals);
  expect(r).toMatchObject({ atTop: true, size: '12px', hidden: 'hidden' });

  await scroll(page, 0);
  await expect.poll(async () => (await look(page)).stuck).toBe(false);
  expect(await look(page)).toMatchObject({ copies: [], hidden: 'visible' });
});

test('off, nothing gathers', async ({ page }) => {
  await open(page, false);
  await scroll(page, 300);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => !!document.querySelector('[data-sticky-metrics]'))).toBe(false);
});
