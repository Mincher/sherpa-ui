import { test, expect } from '@playwright/test';

/**
 * Token layer proof — the Figma-projected token layer (Primitives → Core →
 * Style (Sherpa)) resolving in the light DOM and inheriting into shadow roots,
 * plus mode handling owned by the layer (not components). Names follow the
 * consolidated Figma taxonomy; values are the Figma-resolved ones.
 */

const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(() => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true);
});

test('semantic tokens resolve through Core → Primitives in the light DOM', async ({ page }) => {
  const v = await page.evaluate(() => {
    const probe = document.createElement('div');
    document.body.appendChild(probe);
    // resolve a semantic colour by painting it — computed value follows the alias chain
    // Strong action colour resolves through the Saturated look tier (--_status-surface).
    probe.setAttribute('data-look', 'saturated');
    probe.style.background = 'var(--_status-surface)';
    const accent = getComputedStyle(probe).backgroundColor;
    const space = getComputedStyle(document.documentElement).getPropertyValue('--sherpa-display-space-base').trim();
    probe.remove();
    return { space, accent };
  });
  expect(v.space).toBe('16px'); // --sherpa-display-space-base = 16px
  expect(v.accent).toBe('rgb(59, 76, 205)'); // #3b4ccd — the Saturated look strong accent
});

test('tokens inherit into a shadow root (button uses the real accent, not a fallback)', async ({ page }) => {
  const bg = await page.evaluate(async () => {
    const el = document.createElement('sherpa-button') as HTMLElement & { rendered?: Promise<void> };
    el.textContent = 'Save';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.setAttribute('data-variant', 'primary');
    await el.rendered;
    return getComputedStyle(el.shadowRoot!.querySelector('.trigger')!).backgroundColor;
  });
  expect(bg).toBe('rgb(59, 76, 205)'); // #3b4ccd — primary routes through the Saturated look
});

test('the layer owns mode: data-mode="dark" re-points semantic tokens; components are mode-agnostic', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const probe = document.createElement('div');
    document.body.appendChild(probe);
    probe.style.background = 'var(--sherpa-theme-app-base)';
    const read = () => getComputedStyle(probe).backgroundColor;
    const light = read();
    document.documentElement.setAttribute('data-mode', 'dark');
    const dark = read();
    document.documentElement.removeAttribute('data-mode');
    probe.remove();
    return { light, dark };
  });
  expect(r.light).toBe('rgb(255, 255, 255)'); // #ffffff — light app surface
  expect(r.dark).toBe('rgb(12, 11, 17)'); // #0c0b11 — dark app surface (re-pointed)
  expect(r.light).not.toBe(r.dark);
});
