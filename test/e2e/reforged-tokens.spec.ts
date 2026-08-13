import { test, expect } from '@playwright/test';

/**
 * Token layer proof — the hand-authored three-tier system (primitives → aliases →
 * themes) resolving in the light DOM and inheriting into shadow roots, plus mode
 * handling owned by themes (not components).
 */

const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(() => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true);
});

test('aliases resolve through primitives in the light DOM', async ({ page }) => {
  const v = await page.evaluate(() => {
    const s = getComputedStyle(document.documentElement);
    return {
      space: s.getPropertyValue('--sherpa-space-md').trim(),
      accent: s.getPropertyValue('--sherpa-surface-control-primary-default').trim(),
    };
  });
  expect(v.space).toBe('16px'); // --sherpa-space-md → --core-scale-200 → 16px
  expect(v.accent.replace(/\s/g, '')).toBe('#3c5edd'); // → --core-accent-500
});

test('tokens inherit into a shadow root (button uses the real accent, not a fallback)', async ({ page }) => {
  const bg = await page.evaluate(async () => {
    const el = document.createElement('sherpa-button') as HTMLElement & { rendered?: Promise<void> };
    el.textContent = 'Save';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    return getComputedStyle(el.shadowRoot!.querySelector('.trigger')!).backgroundColor;
  });
  expect(bg).toBe('rgb(60, 94, 221)'); // #3c5edd — the token value, proving inheritance
});

test('themes own mode: data-mode="dark" re-points aliases; components are mode-agnostic', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const read = () =>
      getComputedStyle(document.documentElement).getPropertyValue('--sherpa-surface-page-default').trim();
    const light = read();
    document.documentElement.setAttribute('data-mode', 'dark');
    const dark = read();
    document.documentElement.removeAttribute('data-mode');
    return { light, dark };
  });
  expect(r.light.replace(/\s/g, '')).toBe('#ffffff'); // light page surface
  expect(r.dark.replace(/\s/g, '')).toBe('#101014'); // dark page surface (re-pointed)
  expect(r.light).not.toBe(r.dark);
});
