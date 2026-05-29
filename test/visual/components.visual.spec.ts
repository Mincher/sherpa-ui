// @ts-nocheck
/**
 * Visual Regression Tests for Sherpa UI Components
 *
 * Tests components across themes, states, and variants to catch visual regressions.
 * Run with: npm run test:visual
 * Update baselines: npm run test:visual:update
 */

import { test, expect } from '@playwright/test';

// Helper to set theme/mode/density
async function setAppearance(page, { theme = 'apex-2-purple', mode = 'light', density = 'base' } = {}) {
  await page.evaluate(({ theme, mode, density }) => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.density = density;
    document.documentElement.style.colorScheme = mode;
  }, { theme, mode, density });

  // Wait for CSS to apply
  await page.waitForTimeout(100);
}

// Test suite: Buttons
test.describe('sherpa-button', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/components/sherpa-button');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500); // Wait for router + component rendering
  });

  test('button example', async ({ page }) => {
    const example = page.locator('.docs-example-preview').first();
    await expect(example).toHaveScreenshot('button-example.png');
  });
});

// Test suite: Sherpa Button (standalone demo)
test.describe('sherpa-button standalone', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/sherpa-button.html');
    await page.waitForLoadState('networkidle');
  });

  test('standalone demo', async ({ page }) => {
    await expect(page).toHaveScreenshot('button-standalone.png');
  });
});

// Test suite: Theme variations
test.describe('theme variations', () => {
  test('apex-2-purple light', async ({ page }) => {
    await page.goto('/demo/sherpa-button.html');
    await setAppearance(page, { theme: 'apex-2-purple', mode: 'light' });
    await expect(page).toHaveScreenshot('theme-apex-purple-light.png', { fullPage: true });
  });

  test('apex-2-purple dark', async ({ page }) => {
    await page.goto('/demo/sherpa-button.html');
    await setAppearance(page, { theme: 'apex-2-purple', mode: 'dark' });
    await expect(page).toHaveScreenshot('theme-apex-purple-dark.png', { fullPage: true });
  });

  test('classic light', async ({ page }) => {
    await page.goto('/demo/sherpa-button.html');
    await setAppearance(page, { theme: 'classic', mode: 'light' });
    await expect(page).toHaveScreenshot('theme-classic-light.png', { fullPage: true });
  });
});

// Test suite: Density variations
test.describe('density variations', () => {
  test('compact density', async ({ page }) => {
    await page.goto('/demo/sherpa-button.html');
    await setAppearance(page, { density: 'compact' });
    await expect(page.locator('.row').first()).toHaveScreenshot('density-compact.png');
  });

  test('comfortable density', async ({ page }) => {
    await page.goto('/demo/sherpa-button.html');
    await setAppearance(page, { density: 'comfortable' });
    await expect(page.locator('.row').first()).toHaveScreenshot('density-comfortable.png');
  });
});

// Test suite: Responsive layouts
test.describe('responsive layouts', () => {
  test('dashboard grid mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/patterns/layouts/dashboard-grid.html');
    await expect(page).toHaveScreenshot('dashboard-mobile.png', { fullPage: true });
  });

  test('dashboard grid tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/patterns/layouts/dashboard-grid.html');
    await expect(page).toHaveScreenshot('dashboard-tablet.png', { fullPage: true });
  });

  test('dashboard grid desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/patterns/layouts/dashboard-grid.html');
    await expect(page).toHaveScreenshot('dashboard-desktop.png', { fullPage: true });
  });
});
