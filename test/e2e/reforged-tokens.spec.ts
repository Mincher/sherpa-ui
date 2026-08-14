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
    probe.style.color = 'var(--sherpa-surface-interactive-primary-base)';
    const accent = getComputedStyle(probe).color;
    const space = getComputedStyle(document.documentElement).getPropertyValue('--sherpa-core-space-base').trim();
    probe.remove();
    return { space, accent };
  });
  expect(v.space).toBe('16px'); // --sherpa-core-space-base = 16px
  expect(v.accent).toBe('rgb(60, 94, 221)'); // #3c5edd — resolved through Core accent
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

test('the layer owns mode: data-mode="dark" re-points semantic tokens; components are mode-agnostic', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const probe = document.createElement('div');
    document.body.appendChild(probe);
    probe.style.background = 'var(--sherpa-app-primary)';
    const read = () => getComputedStyle(probe).backgroundColor;
    const light = read();
    document.documentElement.setAttribute('data-mode', 'dark');
    const dark = read();
    document.documentElement.removeAttribute('data-mode');
    probe.remove();
    return { light, dark };
  });
  expect(r.light).toBe('rgb(255, 255, 255)'); // #ffffff — light app surface
  expect(r.dark).toBe('rgb(24, 25, 26)'); // #18191a — dark app surface (re-pointed)
  expect(r.light).not.toBe(r.dark);
});
