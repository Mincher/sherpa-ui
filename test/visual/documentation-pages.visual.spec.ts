// @ts-nocheck
/**
 * Visual Regression Tests: Documentation Pages
 *
 * Tests component documentation pages as they appear in the docs system.
 * This ensures the entire documentation experience remains visually consistent.
 */

import { test, expect } from '@playwright/test';

// Helper to wait for router navigation
async function navigateToComponent(page, componentTag) {
  await page.goto(`/#/components/${componentTag}`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500); // Router + component rendering
}

// Helper to wait for category page
async function navigateToCategory(page, categoryId) {
  await page.goto(`/#/category/${categoryId}`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(300);
}

// ─── Home Page ────────────────────────────────────────────────

test.describe('documentation home', () => {
  test('home page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    const outlet = page.locator('#docs-outlet');
    await expect(outlet).toHaveScreenshot('docs-home.png');
  });
});

// ─── Category Pages ───────────────────────────────────────────

test.describe('category pages', () => {
  const categories = [
    'buttons-and-controls',
    'form-inputs',
    'containers',
    'data-display',
    'charts-and-visualization',
    'overlays',
    'feedback',
    'navigation',
    'layout'
  ];

  for (const category of categories) {
    test(`category: ${category}`, async ({ page }) => {
      await navigateToCategory(page, category);
      const outlet = page.locator('#docs-outlet');
      await expect(outlet).toHaveScreenshot(`category-${category}.png`);
    });
  }
});

// ─── Core Component Pages ─────────────────────────────────────

test.describe('component pages', () => {

  // Buttons & Controls
  test('sherpa-button', async ({ page }) => {
    await navigateToComponent(page, 'sherpa-button');
    const outlet = page.locator('#docs-outlet');
    await expect(outlet).toHaveScreenshot('component-sherpa-button.png');
  });

  test('sherpa-switch', async ({ page }) => {
    await navigateToComponent(page, 'sherpa-switch');
    const outlet = page.locator('#docs-outlet');
    await expect(outlet).toHaveScreenshot('component-sherpa-switch.png');
  });

  // Form Inputs
  test('sherpa-input-text', async ({ page }) => {
    await navigateToComponent(page, 'sherpa-input-text');
    const outlet = page.locator('#docs-outlet');
    await expect(outlet).toHaveScreenshot('component-sherpa-input-text.png');
  });

  test('sherpa-input-date', async ({ page }) => {
    await navigateToComponent(page, 'sherpa-input-date');
    const outlet = page.locator('#docs-outlet');
    await expect(outlet).toHaveScreenshot('component-sherpa-input-date.png');
  });

  test('sherpa-select', async ({ page }) => {
    await navigateToComponent(page, 'sherpa-select');
    const outlet = page.locator('#docs-outlet');
    await expect(outlet).toHaveScreenshot('component-sherpa-select.png');
  });

  // Containers
  test('sherpa-container', async ({ page }) => {
    await navigateToComponent(page, 'sherpa-container');
    const outlet = page.locator('#docs-outlet');
    await expect(outlet).toHaveScreenshot('component-sherpa-container.png');
  });

  test('sherpa-accordion', async ({ page }) => {
    await navigateToComponent(page, 'sherpa-accordion');
    const outlet = page.locator('#docs-outlet');
    await expect(outlet).toHaveScreenshot('component-sherpa-accordion.png');
  });

  // Data Display
  test('sherpa-data-grid', async ({ page }) => {
    await navigateToComponent(page, 'sherpa-data-grid');
    const outlet = page.locator('#docs-outlet');
    await expect(outlet).toHaveScreenshot('component-sherpa-data-grid.png');
  });

  test('sherpa-metric', async ({ page }) => {
    await navigateToComponent(page, 'sherpa-metric');
    const outlet = page.locator('#docs-outlet');
    await expect(outlet).toHaveScreenshot('component-sherpa-metric.png');
  });

  // Charts
  test('sherpa-line-chart', async ({ page }) => {
    await navigateToComponent(page, 'sherpa-line-chart');
    await page.waitForTimeout(1000); // Chart rendering
    const outlet = page.locator('#docs-outlet');
    await expect(outlet).toHaveScreenshot('component-sherpa-line-chart.png');
  });

  test('sherpa-barchart', async ({ page }) => {
    await navigateToComponent(page, 'sherpa-barchart');
    await page.waitForTimeout(1000); // Chart rendering
    const outlet = page.locator('#docs-outlet');
    await expect(outlet).toHaveScreenshot('component-sherpa-barchart.png');
  });

  // Navigation
  test('sherpa-nav', async ({ page }) => {
    await navigateToComponent(page, 'sherpa-nav');
    const outlet = page.locator('#docs-outlet');
    await expect(outlet).toHaveScreenshot('component-sherpa-nav.png');
  });

  test('sherpa-toolbar', async ({ page }) => {
    await navigateToComponent(page, 'sherpa-toolbar');
    const outlet = page.locator('#docs-outlet');
    await expect(outlet).toHaveScreenshot('component-sherpa-toolbar.png');
  });
});

// ─── Interactive Playground ───────────────────────────────────

test.describe('interactive playground', () => {
  test('playground customize button', async ({ page }) => {
    await navigateToComponent(page, 'sherpa-button');

    // Find first example and click customize
    const customizeBtn = page.locator('.docs-try-btn').first();
    await customizeBtn.click();
    await page.waitForTimeout(300); // Playground expansion

    const playground = page.locator('.docs-playground').first();
    await expect(playground).toHaveScreenshot('playground-expanded.png');
  });

  test('playground with controls', async ({ page }) => {
    await navigateToComponent(page, 'sherpa-button');

    const customizeBtn = page.locator('.docs-try-btn').first();
    await customizeBtn.click();
    await page.waitForTimeout(300);

    // Interact with a control
    const variantSelect = page.locator('.docs-playground select[data-attr="data-variant"]').first();
    await variantSelect.selectOption('secondary');
    await page.waitForTimeout(200);

    const playground = page.locator('.docs-playground').first();
    await expect(playground).toHaveScreenshot('playground-variant-changed.png');
  });
});

// ─── Theme Switching ──────────────────────────────────────────

test.describe('theme variations', () => {
  test('dark mode', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Switch to dark mode
    const modeSelect = page.locator('#mode-select');
    await modeSelect.evaluate(el => el.value = 'dark');
    await modeSelect.dispatchEvent('change');
    await page.waitForTimeout(300);

    await navigateToComponent(page, 'sherpa-button');
    const outlet = page.locator('#docs-outlet');
    await expect(outlet).toHaveScreenshot('component-sherpa-button-dark.png');
  });

  test('compact density', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Switch to compact density
    const densitySelect = page.locator('#density-select');
    await densitySelect.evaluate(el => el.value = 'compact');
    await densitySelect.dispatchEvent('change');
    await page.waitForTimeout(300);

    await navigateToComponent(page, 'sherpa-button');
    const outlet = page.locator('#docs-outlet');
    await expect(outlet).toHaveScreenshot('component-sherpa-button-compact.png');
  });
});
