import { test, expect } from '@playwright/test';

/** sherpa-toolbar — start/center/end slot regions collapse when empty (data-has-*). */

const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(() => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true);
});

test('lays out start / center / end slot regions', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-toolbar') as HTMLElement & { rendered?: Promise<void> };
    el.innerHTML = '<span slot="start">S</span><span slot="end">E</span>';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    await new Promise((res) => setTimeout(res, 0));
    return {
      bar: !!el.shadowRoot?.querySelector('.bar'),
      hasStart: el.hasAttribute('data-has-start'),
      hasEnd: el.hasAttribute('data-has-end'),
      hasCenter: el.hasAttribute('data-has-center'),
    };
  });
  expect(r.bar).toBe(true);
  expect(r.hasStart).toBe(true);
  expect(r.hasEnd).toBe(true);
  expect(r.hasCenter).toBe(false); // empty center collapses
});
