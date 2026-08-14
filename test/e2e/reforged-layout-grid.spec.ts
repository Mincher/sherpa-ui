import { test, expect } from '@playwright/test';

/** sherpa-layout-grid — data-cols drives the grid columns; children span via data-col-span. */

const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(() => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true);
});

test('data-cols sets the number of grid columns', async ({ page }) => {
  const cols = await page.evaluate(async () => {
    const el = document.createElement('sherpa-layout-grid') as HTMLElement & { rendered?: Promise<void> };
    el.setAttribute('data-cols', '4');
    el.innerHTML = '<div>a</div><div>b</div><div>c</div><div>d</div>';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const grid = el.shadowRoot!.querySelector('.grid')!;
    return getComputedStyle(grid).gridTemplateColumns.split(' ').length;
  });
  expect(cols).toBe(4);
});

test('banner slot spans above and collapses when empty', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const withBanner = document.createElement('sherpa-layout-grid') as HTMLElement & { rendered?: Promise<void> };
    withBanner.innerHTML = '<div slot="banner">B</div><div>tile</div>';
    document.getElementById('root')!.appendChild(withBanner);
    await withBanner.rendered;
    await new Promise((res) => setTimeout(res, 0));

    const bare = document.createElement('sherpa-layout-grid') as HTMLElement & { rendered?: Promise<void> };
    bare.innerHTML = '<div>tile</div>';
    document.getElementById('root')!.appendChild(bare);
    await bare.rendered;
    await new Promise((res) => setTimeout(res, 0));

    const vis = (el: HTMLElement) => getComputedStyle(el.shadowRoot!.querySelector('.banner')!).display !== 'none';
    return { withBanner: vis(withBanner), bare: vis(bare) };
  });
  expect(r.withBanner).toBe(true);
  expect(r.bare).toBe(false);
});
