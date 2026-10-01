import { test, expect, type Page } from '@playwright/test';

/**
 * EXPERIMENT, TODO 143 and 175: once the first row of metrics has scrolled
 * fully under the top of the content area, a small sticky row of them shows —
 * and goes when the reader scrolls back. CSS decides when: a scroll-state
 * query, so Chromium only. Off unless Settings › Experiments turns it on.
 */
const APP = 'http://localhost:4200/?context=dashboard';

async function open(page: Page, on: boolean): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 600 });
  await page.addInitScript((v) => localStorage.setItem('sherpa:session:/experiments/stickyMetrics', JSON.stringify(v)), on);
  await page.goto(APP);
  await page.waitForFunction(() =>
    (document.querySelector('#m-endpoints')?.getAttribute('data-value') ?? '') !== '');
}

/** Scroll the content area, as a reader does. */
const scroll = (page: Page, y: number): Promise<void> => page.evaluate((top) => {
  document.querySelector('sherpa-app-shell')!.shadowRoot!.querySelector('.context-frame')!.scrollTo({ top });
}, y);

/** Where the switch is: the grid's padding plus one row, as the tokens say. */
const under = (page: Page): Promise<number> => page.evaluate(() => {
  const css = getComputedStyle(document.documentElement);
  return parseFloat(css.getPropertyValue('--sherpa-layout-grid-padding'))
    + parseFloat(css.getPropertyValue('--sherpa-layout-grid-row-height'));
});

const look = (page: Page) => page.evaluate(() => {
  const root = document.querySelector('#context-root')!;
  const frame = document.querySelector('sherpa-app-shell')!.shadowRoot!.querySelector('.context-frame')!;
  const row = root.querySelector<HTMLElement>('[data-sticky-metrics] > .row');
  const copies = [...root.querySelectorAll<HTMLElement>('[data-sticky-metrics] sherpa-metric')];
  const first = copies[0];
  const tall = (el: Element) => Math.round(el.getBoundingClientRect().height);
  return {
    shown: !!row && getComputedStyle(row).display !== 'none',
    copies: copies.map((c) => `${c.dataset['label']} ${c.dataset['value']}`),
    originals: ['m-endpoints', 'm-alerts', 'm-uptime', 'm-patch'].map((id) => {
      const m = document.getElementById(id)!;
      return `${m.dataset['label']} ${m.dataset['value']}`;
    }),
    atTop: first ? Math.abs(first.getBoundingClientRect().top - frame.getBoundingClientRect().top) < 1 : null,
    size: first ? getComputedStyle(first.shadowRoot!.querySelector('.value')!).fontSize : null,
    spark: first ? getComputedStyle(first.shadowRoot!.querySelector('.spark')!).display : null,
    // Shorter than the tile it copies.
    shorter: first ? tall(first) < tall(document.getElementById('m-endpoints')!) : null,
  };
});

test('the first row of metrics becomes a small sticky row once it has scrolled under, and goes on the way back', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'scroll-state container queries are Chromium only');
  await open(page, true);
  const at = await under(page);
  expect((await look(page)).shown).toBe(false);

  // SLOWLY, a few px at a time: not stuck until the row is fully under.
  for (let y = 0; y <= at - 2; y += 6) await scroll(page, y);
  await scroll(page, at - 2);
  expect((await look(page)).shown).toBe(false);
  for (let y = at - 2; y <= at + 6; y += 2) await scroll(page, y);
  await expect.poll(async () => (await look(page)).shown).toBe(true);

  const r = await look(page);
  expect(r.copies).toEqual(r.originals);
  // At the top, a 14px value, its sparkline kept, and shorter than a tile.
  expect(r).toMatchObject({ atTop: true, size: '14px', spark: 'flex', shorter: true });

  await scroll(page, at - 2);
  await expect.poll(async () => (await look(page)).shown).toBe(false);
});

test('off, nothing gathers', async ({ page }) => {
  await open(page, false);
  await scroll(page, 300);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => !!document.querySelector('[data-sticky-metrics]'))).toBe(false);
});
