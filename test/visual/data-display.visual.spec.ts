// @ts-nocheck
/**
 * Visual Regression Tests: Data Display Components
 *
 * Tests containers, data grids, lists, metrics, and data visualization components.
 */

import { test, expect } from '@playwright/test';

// ─── sherpa-container ─────────────────────────────────────────

test.describe('sherpa-container', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/sherpa-container.html');
  });

  test('basic container', async ({ page }) => {
    const container = page.locator('sherpa-container').first();
    await expect(container).toHaveScreenshot('container-basic.png');
  });

  test('with header', async ({ page }) => {
    const container = page.locator('sherpa-container').nth(1);
    await expect(container).toHaveScreenshot('container-with-header.png');
  });

  test('with footer', async ({ page }) => {
    const container = page.locator('sherpa-container').nth(2);
    await expect(container).toHaveScreenshot('container-with-footer.png');
  });

  test('full structure', async ({ page }) => {
    const container = page.locator('sherpa-container').nth(3);
    await expect(container).toHaveScreenshot('container-full.png');
  });

  test('status variants', async ({ page }) => {
    await page.goto('/demo/sherpa-container.html#status');
    const container = page.locator('.row').first();
    await expect(container).toHaveScreenshot('container-status.png');
  });
});

// ─── sherpa-panel ─────────────────────────────────────────────

test.describe('sherpa-panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/sherpa-panel.html');
  });

  test('basic panel', async ({ page }) => {
    const panel = page.locator('sherpa-panel').first();
    await expect(panel).toHaveScreenshot('panel-basic.png');
  });

  test('collapsible panel', async ({ page }) => {
    const panel = page.locator('sherpa-panel[data-collapsible]').first();
    await expect(panel).toHaveScreenshot('panel-collapsible-open.png');
  });

  test('collapsed panel', async ({ page }) => {
    const panel = page.locator('sherpa-panel[data-collapsible]').first();
    await panel.evaluate(el => el.setAttribute('data-collapsed', ''));
    await page.waitForTimeout(300); // Animation
    await expect(panel).toHaveScreenshot('panel-collapsed.png');
  });
});

// ─── sherpa-accordion ─────────────────────────────────────────

test.describe('sherpa-accordion', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/sherpa-accordion.html');
  });

  test('accordion group', async ({ page }) => {
    const accordion = page.locator('sherpa-accordion').first();
    await expect(accordion).toHaveScreenshot('accordion-group.png');
  });

  test('with one section open', async ({ page }) => {
    const accordion = page.locator('sherpa-accordion').first();
    const section = accordion.locator('sherpa-accordion-section').first();
    await section.click();
    await page.waitForTimeout(300); // Animation
    await expect(accordion).toHaveScreenshot('accordion-one-open.png');
  });
});

// ─── sherpa-data-grid ─────────────────────────────────────────

test.describe('sherpa-data-grid', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/sherpa-data-grid.html');
  });

  test('basic data grid', async ({ page }) => {
    const grid = page.locator('sherpa-data-grid').first();
    await expect(grid).toHaveScreenshot('data-grid-basic.png');
  });

  test('with selection', async ({ page }) => {
    const grid = page.locator('sherpa-data-grid').first();
    await grid.locator('tr').nth(1).click();
    await expect(grid).toHaveScreenshot('data-grid-selected.png');
  });

  test('with sorting', async ({ page }) => {
    const grid = page.locator('sherpa-data-grid').first();
    await grid.locator('th').first().click();
    await expect(grid).toHaveScreenshot('data-grid-sorted.png');
  });

  test('empty state', async ({ page }) => {
    await page.goto('/demo/sherpa-data-grid.html#empty');
    const grid = page.locator('sherpa-data-grid').first();
    await expect(grid).toHaveScreenshot('data-grid-empty.png');
  });
});

// ─── sherpa-list ──────────────────────────────────────────────

test.describe('sherpa-list', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/sherpa-list.html');
  });

  test('basic list', async ({ page }) => {
    const list = page.locator('sherpa-list').first();
    await expect(list).toHaveScreenshot('list-basic.png');
  });

  test('with selection', async ({ page }) => {
    const list = page.locator('sherpa-list').first();
    await list.locator('sherpa-list-item').first().click();
    await expect(list).toHaveScreenshot('list-selected.png');
  });

  test('multi-select', async ({ page }) => {
    const list = page.locator('sherpa-list[data-multi-select]').first();
    await expect(list).toHaveScreenshot('list-multi-select.png');
  });
});

// ─── sherpa-metric ────────────────────────────────────────────

test.describe('sherpa-metric', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/sherpa-metric.html');
  });

  test('basic metric', async ({ page }) => {
    const metric = page.locator('sherpa-metric').first();
    await expect(metric).toHaveScreenshot('metric-basic.png');
  });

  test('with trend', async ({ page }) => {
    const metric = page.locator('sherpa-metric[data-trend]').first();
    await expect(metric).toHaveScreenshot('metric-trend.png');
  });

  test('status variants', async ({ page }) => {
    const container = page.locator('.row').first();
    await expect(container).toHaveScreenshot('metric-status.png');
  });

  test('sizes', async ({ page }) => {
    const container = page.locator('.row').nth(1);
    await expect(container).toHaveScreenshot('metric-sizes.png');
  });
});

// ─── sherpa-key-value-list ────────────────────────────────────

test.describe('sherpa-key-value-list', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/sherpa-key-value-list.html');
  });

  test('basic key-value list', async ({ page }) => {
    const list = page.locator('sherpa-key-value-list').first();
    await expect(list).toHaveScreenshot('key-value-list-basic.png');
  });

  test('horizontal layout', async ({ page }) => {
    const list = page.locator('sherpa-key-value-list[data-layout="horizontal"]').first();
    await expect(list).toHaveScreenshot('key-value-list-horizontal.png');
  });
});

// ─── sherpa-pagination ────────────────────────────────────────

test.describe('sherpa-pagination', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/sherpa-pagination.html');
  });

  test('basic pagination', async ({ page }) => {
    const pagination = page.locator('sherpa-pagination').first();
    await expect(pagination).toHaveScreenshot('pagination-basic.png');
  });

  test('with many pages', async ({ page }) => {
    const pagination = page.locator('sherpa-pagination').first();
    await pagination.evaluate(el => {
      el.setAttribute('data-total-pages', '100');
      el.setAttribute('data-current-page', '50');
    });
    await expect(pagination).toHaveScreenshot('pagination-many-pages.png');
  });

  test('first page', async ({ page }) => {
    const pagination = page.locator('sherpa-pagination').first();
    await pagination.evaluate(el => el.setAttribute('data-current-page', '1'));
    await expect(pagination).toHaveScreenshot('pagination-first.png');
  });

  test('last page', async ({ page }) => {
    const pagination = page.locator('sherpa-pagination').first();
    await pagination.evaluate(el => {
      const total = el.getAttribute('data-total-pages');
      el.setAttribute('data-current-page', total);
    });
    await expect(pagination).toHaveScreenshot('pagination-last.png');
  });
});

// ─── sherpa-table-header ──────────────────────────────────────

test.describe('sherpa-table-header', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/sherpa-table-header.html');
  });

  test('basic header', async ({ page }) => {
    const header = page.locator('sherpa-table-header').first();
    await expect(header).toHaveScreenshot('table-header-basic.png');
  });

  test('sortable columns', async ({ page }) => {
    const header = page.locator('sherpa-table-header[data-sortable]').first();
    await expect(header).toHaveScreenshot('table-header-sortable.png');
  });

  test('sorted ascending', async ({ page }) => {
    const header = page.locator('sherpa-table-header').first();
    await header.evaluate(el => el.setAttribute('data-sort-direction', 'asc'));
    await expect(header).toHaveScreenshot('table-header-sorted-asc.png');
  });

  test('sorted descending', async ({ page }) => {
    const header = page.locator('sherpa-table-header').first();
    await header.evaluate(el => el.setAttribute('data-sort-direction', 'desc'));
    await expect(header).toHaveScreenshot('table-header-sorted-desc.png');
  });
});

// ─── sherpa-progress-bar ──────────────────────────────────────

test.describe('sherpa-progress-bar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/sherpa-progress-bar.html');
  });

  test('0% progress', async ({ page }) => {
    const progress = page.locator('sherpa-progress-bar').first();
    await progress.evaluate(el => el.value = 0);
    await expect(progress).toHaveScreenshot('progress-0.png');
  });

  test('50% progress', async ({ page }) => {
    const progress = page.locator('sherpa-progress-bar').first();
    await progress.evaluate(el => el.value = 50);
    await expect(progress).toHaveScreenshot('progress-50.png');
  });

  test('100% progress', async ({ page }) => {
    const progress = page.locator('sherpa-progress-bar').first();
    await progress.evaluate(el => el.value = 100);
    await expect(progress).toHaveScreenshot('progress-100.png');
  });

  test('status variants', async ({ page }) => {
    const container = page.locator('.row').first();
    await expect(container).toHaveScreenshot('progress-status.png');
  });

  test('indeterminate', async ({ page }) => {
    const progress = page.locator('sherpa-progress-bar[data-indeterminate]').first();
    await expect(progress).toHaveScreenshot('progress-indeterminate.png');
  });
});

// ─── sherpa-loader ────────────────────────────────────────────

test.describe('sherpa-loader', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/sherpa-loader.html');
  });

  test('spinner loader', async ({ page }) => {
    const loader = page.locator('sherpa-loader').first();
    await expect(loader).toHaveScreenshot('loader-spinner.png');
  });

  test('sizes', async ({ page }) => {
    const container = page.locator('.row').first();
    await expect(container).toHaveScreenshot('loader-sizes.png');
  });

  test('with label', async ({ page }) => {
    const loader = page.locator('sherpa-loader[data-label]').first();
    await expect(loader).toHaveScreenshot('loader-with-label.png');
  });
});

// ─── sherpa-empty-state ───────────────────────────────────────

test.describe('sherpa-empty-state', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/sherpa-empty-state.html');
  });

  test('basic empty state', async ({ page }) => {
    const empty = page.locator('sherpa-empty-state').first();
    await expect(empty).toHaveScreenshot('empty-state-basic.png');
  });

  test('with icon', async ({ page }) => {
    const empty = page.locator('sherpa-empty-state[data-icon]').first();
    await expect(empty).toHaveScreenshot('empty-state-icon.png');
  });

  test('with action button', async ({ page }) => {
    const empty = page.locator('sherpa-empty-state').nth(2);
    await expect(empty).toHaveScreenshot('empty-state-action.png');
  });
});
