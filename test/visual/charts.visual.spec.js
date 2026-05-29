/**
 * Visual Regression Tests: Chart & Visualization Components
 *
 * Tests line charts, bar charts, donut charts, gauges, sparklines, and legends.
 */

import { test, expect } from '@playwright/test';

// ─── sherpa-line-chart ────────────────────────────────────────

test.describe('sherpa-line-chart', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/sherpa-line-chart.html');
    await page.waitForLoadState('networkidle');
  });

  test('basic line chart', async ({ page }) => {
    const chart = page.locator('sherpa-line-chart').first();
    await page.waitForTimeout(500); // Chart rendering
    await expect(chart).toHaveScreenshot('line-chart-basic.png');
  });

  test('multi-line chart', async ({ page }) => {
    const chart = page.locator('sherpa-line-chart').nth(1);
    await page.waitForTimeout(500);
    await expect(chart).toHaveScreenshot('line-chart-multi.png');
  });

  test('with data points', async ({ page }) => {
    const chart = page.locator('sherpa-line-chart[data-show-points]').first();
    await page.waitForTimeout(500);
    await expect(chart).toHaveScreenshot('line-chart-points.png');
  });

  test('area chart', async ({ page }) => {
    const chart = page.locator('sherpa-line-chart[data-filled]').first();
    await page.waitForTimeout(500);
    await expect(chart).toHaveScreenshot('line-chart-area.png');
  });
});

// ─── sherpa-barchart ──────────────────────────────────────────

test.describe('sherpa-barchart', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/sherpa-barchart.html');
    await page.waitForLoadState('networkidle');
  });

  test('vertical bar chart', async ({ page }) => {
    const chart = page.locator('sherpa-barchart').first();
    await page.waitForTimeout(500);
    await expect(chart).toHaveScreenshot('barchart-vertical.png');
  });

  test('horizontal bar chart', async ({ page }) => {
    const chart = page.locator('sherpa-barchart[data-orientation="horizontal"]').first();
    await page.waitForTimeout(500);
    await expect(chart).toHaveScreenshot('barchart-horizontal.png');
  });

  test('grouped bars', async ({ page }) => {
    const chart = page.locator('sherpa-barchart[data-grouped]').first();
    await page.waitForTimeout(500);
    await expect(chart).toHaveScreenshot('barchart-grouped.png');
  });

  test('stacked bars', async ({ page }) => {
    const chart = page.locator('sherpa-barchart[data-stacked]').first();
    await page.waitForTimeout(500);
    await expect(chart).toHaveScreenshot('barchart-stacked.png');
  });
});

// ─── sherpa-donut-chart ───────────────────────────────────────

test.describe('sherpa-donut-chart', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/sherpa-donut-chart.html');
    await page.waitForLoadState('networkidle');
  });

  test('basic donut chart', async ({ page }) => {
    const chart = page.locator('sherpa-donut-chart').first();
    await page.waitForTimeout(500);
    await expect(chart).toHaveScreenshot('donut-chart-basic.png');
  });

  test('with center label', async ({ page }) => {
    const chart = page.locator('sherpa-donut-chart[data-center-label]').first();
    await page.waitForTimeout(500);
    await expect(chart).toHaveScreenshot('donut-chart-label.png');
  });

  test('small size', async ({ page }) => {
    const chart = page.locator('sherpa-donut-chart[data-size="sm"]').first();
    await page.waitForTimeout(500);
    await expect(chart).toHaveScreenshot('donut-chart-small.png');
  });

  test('large size', async ({ page }) => {
    const chart = page.locator('sherpa-donut-chart[data-size="lg"]').first();
    await page.waitForTimeout(500);
    await expect(chart).toHaveScreenshot('donut-chart-large.png');
  });
});

// ─── sherpa-gauge-chart ───────────────────────────────────────

test.describe('sherpa-gauge-chart', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/sherpa-gauge-chart.html');
    await page.waitForLoadState('networkidle');
  });

  test('basic gauge', async ({ page }) => {
    const gauge = page.locator('sherpa-gauge-chart').first();
    await page.waitForTimeout(500);
    await expect(gauge).toHaveScreenshot('gauge-basic.png');
  });

  test('at 0%', async ({ page }) => {
    const gauge = page.locator('sherpa-gauge-chart').first();
    await gauge.evaluate(el => el.value = 0);
    await page.waitForTimeout(300);
    await expect(gauge).toHaveScreenshot('gauge-0.png');
  });

  test('at 50%', async ({ page }) => {
    const gauge = page.locator('sherpa-gauge-chart').first();
    await gauge.evaluate(el => el.value = 50);
    await page.waitForTimeout(300);
    await expect(gauge).toHaveScreenshot('gauge-50.png');
  });

  test('at 100%', async ({ page }) => {
    const gauge = page.locator('sherpa-gauge-chart').first();
    await gauge.evaluate(el => el.value = 100);
    await page.waitForTimeout(300);
    await expect(gauge).toHaveScreenshot('gauge-100.png');
  });

  test('status colors', async ({ page }) => {
    const container = page.locator('.row').first();
    await page.waitForTimeout(500);
    await expect(container).toHaveScreenshot('gauge-status.png');
  });
});

// ─── sherpa-sparkline ─────────────────────────────────────────

test.describe('sherpa-sparkline', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/sherpa-sparkline.html');
    await page.waitForLoadState('networkidle');
  });

  test('basic sparkline', async ({ page }) => {
    const sparkline = page.locator('sherpa-sparkline').first();
    await page.waitForTimeout(300);
    await expect(sparkline).toHaveScreenshot('sparkline-basic.png');
  });

  test('positive trend', async ({ page }) => {
    const sparkline = page.locator('sherpa-sparkline[data-trend="up"]').first();
    await page.waitForTimeout(300);
    await expect(sparkline).toHaveScreenshot('sparkline-up.png');
  });

  test('negative trend', async ({ page }) => {
    const sparkline = page.locator('sherpa-sparkline[data-trend="down"]').first();
    await page.waitForTimeout(300);
    await expect(sparkline).toHaveScreenshot('sparkline-down.png');
  });

  test('filled sparkline', async ({ page }) => {
    const sparkline = page.locator('sherpa-sparkline[data-filled]').first();
    await page.waitForTimeout(300);
    await expect(sparkline).toHaveScreenshot('sparkline-filled.png');
  });
});

// ─── sherpa-chart-legend ──────────────────────────────────────

test.describe('sherpa-chart-legend', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/sherpa-chart-legend.html');
  });

  test('horizontal legend', async ({ page }) => {
    const legend = page.locator('sherpa-chart-legend').first();
    await expect(legend).toHaveScreenshot('legend-horizontal.png');
  });

  test('vertical legend', async ({ page }) => {
    const legend = page.locator('sherpa-chart-legend[data-orientation="vertical"]').first();
    await expect(legend).toHaveScreenshot('legend-vertical.png');
  });

  test('with toggle', async ({ page }) => {
    const legend = page.locator('sherpa-chart-legend[data-interactive]').first();
    await expect(legend).toHaveScreenshot('legend-interactive.png');
  });

  test('with one item disabled', async ({ page }) => {
    const legend = page.locator('sherpa-chart-legend').first();
    await legend.locator('.legend-item').first().click();
    await expect(legend).toHaveScreenshot('legend-item-disabled.png');
  });
});
