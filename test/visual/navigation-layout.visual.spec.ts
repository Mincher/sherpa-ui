// @ts-nocheck
/**
 * Visual Regression Tests: Navigation & Layout Components
 *
 * Tests nav, toolbar, product-bar, layout components, and utility components.
 */

import { test, expect } from '@playwright/test';

// ─── sherpa-nav ───────────────────────────────────────────────

test.describe('sherpa-nav', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/sherpa-nav.html');
    await page.waitForLoadState('networkidle');
  });

  test('nav collapsed', async ({ page }) => {
    const nav = page.locator('sherpa-nav').first();
    await expect(nav).toHaveScreenshot('nav-collapsed.png');
  });

  test('nav expanded on hover', async ({ page }) => {
    const nav = page.locator('sherpa-nav').first();
    await nav.hover();
    await page.waitForTimeout(300); // Expansion animation
    await expect(nav).toHaveScreenshot('nav-expanded.png');
  });

  test('nav pinned', async ({ page }) => {
    const nav = page.locator('sherpa-nav').first();
    await nav.evaluate(el => el.setAttribute('data-pinned', ''));
    await page.waitForTimeout(300);
    await expect(nav).toHaveScreenshot('nav-pinned.png');
  });

  test('nav with search active', async ({ page }) => {
    const nav = page.locator('sherpa-nav').first();
    const searchBtn = nav.locator('[data-action="search"]').first();
    await searchBtn.click();
    await page.waitForTimeout(200);
    await expect(nav).toHaveScreenshot('nav-search-active.png');
  });

  test('nav with nested items', async ({ page }) => {
    const nav = page.locator('sherpa-nav').first();
    await nav.hover();
    await page.waitForTimeout(200);
    const groupHeader = nav.locator('sherpa-nav-group-header').first();
    await groupHeader.click();
    await page.waitForTimeout(200);
    await expect(nav).toHaveScreenshot('nav-nested-open.png');
  });
});

// ─── sherpa-product-bar ───────────────────────────────────────

test.describe('sherpa-product-bar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/sherpa-product-bar.html');
  });

  test('basic product bar', async ({ page }) => {
    const bar = page.locator('sherpa-product-bar').first();
    await expect(bar).toHaveScreenshot('product-bar-basic.png');
  });

  test('with logo', async ({ page }) => {
    const bar = page.locator('sherpa-product-bar[data-logo]').first();
    await expect(bar).toHaveScreenshot('product-bar-logo.png');
  });

  test('with actions', async ({ page }) => {
    const bar = page.locator('sherpa-product-bar').nth(2);
    await expect(bar).toHaveScreenshot('product-bar-actions.png');
  });

  test('with user menu', async ({ page }) => {
    const bar = page.locator('sherpa-product-bar').nth(3);
    await expect(bar).toHaveScreenshot('product-bar-user.png');
  });
});

// ─── sherpa-toolbar ───────────────────────────────────────────

test.describe('sherpa-toolbar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/sherpa-toolbar.html');
  });

  test('basic toolbar', async ({ page }) => {
    const toolbar = page.locator('sherpa-toolbar').first();
    await expect(toolbar).toHaveScreenshot('toolbar-basic.png');
  });

  test('with button groups', async ({ page }) => {
    const toolbar = page.locator('sherpa-toolbar').nth(1);
    await expect(toolbar).toHaveScreenshot('toolbar-groups.png');
  });

  test('with dividers', async ({ page }) => {
    const toolbar = page.locator('sherpa-toolbar').nth(2);
    await expect(toolbar).toHaveScreenshot('toolbar-dividers.png');
  });

  test('vertical toolbar', async ({ page }) => {
    const toolbar = page.locator('sherpa-toolbar[data-orientation="vertical"]').first();
    await expect(toolbar).toHaveScreenshot('toolbar-vertical.png');
  });
});

// ─── sherpa-filter-bar ────────────────────────────────────────

test.describe('sherpa-filter-bar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/sherpa-filter-bar.html');
  });

  test('basic filter bar', async ({ page }) => {
    const filterBar = page.locator('sherpa-filter-bar').first();
    await expect(filterBar).toHaveScreenshot('filter-bar-basic.png');
  });

  test('with active filters', async ({ page }) => {
    const filterBar = page.locator('sherpa-filter-bar').first();
    await filterBar.locator('sherpa-tag').first().click();
    await expect(filterBar).toHaveScreenshot('filter-bar-active.png');
  });

  test('with search', async ({ page }) => {
    const filterBar = page.locator('sherpa-filter-bar').nth(1);
    await expect(filterBar).toHaveScreenshot('filter-bar-search.png');
  });
});

// ─── sherpa-section-header ────────────────────────────────────

test.describe('sherpa-section-header', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/sherpa-section-header.html');
  });

  test('basic section header', async ({ page }) => {
    const header = page.locator('sherpa-section-header').first();
    await expect(header).toHaveScreenshot('section-header-basic.png');
  });

  test('with description', async ({ page }) => {
    const header = page.locator('sherpa-section-header[data-description]').first();
    await expect(header).toHaveScreenshot('section-header-description.png');
  });

  test('with actions', async ({ page }) => {
    const header = page.locator('sherpa-section-header').nth(2);
    await expect(header).toHaveScreenshot('section-header-actions.png');
  });

  test('with breadcrumbs', async ({ page }) => {
    const header = page.locator('sherpa-section-header').nth(3);
    await expect(header).toHaveScreenshot('section-header-breadcrumbs.png');
  });
});

// ─── sherpa-layout-grid ───────────────────────────────────────

test.describe('sherpa-layout-grid', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/sherpa-layout-grid.html');
  });

  test('2-column grid', async ({ page }) => {
    const grid = page.locator('sherpa-layout-grid[data-columns="2"]').first();
    await expect(grid).toHaveScreenshot('layout-grid-2col.png');
  });

  test('3-column grid', async ({ page }) => {
    const grid = page.locator('sherpa-layout-grid[data-columns="3"]').first();
    await expect(grid).toHaveScreenshot('layout-grid-3col.png');
  });

  test('4-column grid', async ({ page }) => {
    const grid = page.locator('sherpa-layout-grid[data-columns="4"]').first();
    await expect(grid).toHaveScreenshot('layout-grid-4col.png');
  });

  test('with gaps', async ({ page }) => {
    const grid = page.locator('sherpa-layout-grid[data-gap="lg"]').first();
    await expect(grid).toHaveScreenshot('layout-grid-gaps.png');
  });

  test('responsive grid', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 600 });
    const grid = page.locator('sherpa-layout-grid').first();
    await expect(grid).toHaveScreenshot('layout-grid-responsive.png');
  });
});

// ─── sherpa-layout-view ───────────────────────────────────────

test.describe('sherpa-layout-view', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/sherpa-layout-view.html');
  });

  test('app shell layout', async ({ page }) => {
    const view = page.locator('sherpa-layout-view').first();
    await expect(view).toHaveScreenshot('layout-view-app-shell.png', { fullPage: true });
  });

  test('with sidebar', async ({ page }) => {
    const view = page.locator('sherpa-layout-view[data-sidebar]').first();
    await expect(view).toHaveScreenshot('layout-view-sidebar.png', { fullPage: true });
  });

  test('with header and footer', async ({ page }) => {
    const view = page.locator('sherpa-layout-view').nth(2);
    await expect(view).toHaveScreenshot('layout-view-full.png', { fullPage: true });
  });
});

// ─── sherpa-code-block ────────────────────────────────────────

test.describe('sherpa-code-block', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/sherpa-code-block.html');
  });

  test('basic code block', async ({ page }) => {
    const code = page.locator('sherpa-code-block').first();
    await expect(code).toHaveScreenshot('code-block-basic.png');
  });

  test('with line numbers', async ({ page }) => {
    const code = page.locator('sherpa-code-block[data-line-numbers]').first();
    await expect(code).toHaveScreenshot('code-block-line-numbers.png');
  });

  test('with highlighted lines', async ({ page }) => {
    const code = page.locator('sherpa-code-block[data-highlight]').first();
    await expect(code).toHaveScreenshot('code-block-highlight.png');
  });

  test('with copy button', async ({ page }) => {
    const code = page.locator('sherpa-code-block[data-copyable]').first();
    await expect(code).toHaveScreenshot('code-block-copyable.png');
  });

  test('different languages', async ({ page }) => {
    const container = page.locator('.row').first();
    await expect(container).toHaveScreenshot('code-block-languages.png');
  });
});

// ─── sherpa-icon ──────────────────────────────────────────────

test.describe('sherpa-icon', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/sherpa-icon.html');
  });

  test('icon sizes', async ({ page }) => {
    const container = page.locator('.row').first();
    await expect(container).toHaveScreenshot('icon-sizes.png');
  });

  test('icon colors', async ({ page }) => {
    const container = page.locator('.row').nth(1);
    await expect(container).toHaveScreenshot('icon-colors.png');
  });

  test('icon variants', async ({ page }) => {
    const container = page.locator('.row').nth(2);
    await expect(container).toHaveScreenshot('icon-variants.png');
  });
});

// ─── sherpa-chat-message ──────────────────────────────────────

test.describe('sherpa-chat-message', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/sherpa-chat-message.html');
  });

  test('user message', async ({ page }) => {
    const message = page.locator('sherpa-chat-message[data-sender="user"]').first();
    await expect(message).toHaveScreenshot('chat-message-user.png');
  });

  test('assistant message', async ({ page }) => {
    const message = page.locator('sherpa-chat-message[data-sender="assistant"]').first();
    await expect(message).toHaveScreenshot('chat-message-assistant.png');
  });

  test('with avatar', async ({ page }) => {
    const message = page.locator('sherpa-chat-message[data-avatar]').first();
    await expect(message).toHaveScreenshot('chat-message-avatar.png');
  });

  test('with timestamp', async ({ page }) => {
    const message = page.locator('sherpa-chat-message[data-timestamp]').first();
    await expect(message).toHaveScreenshot('chat-message-timestamp.png');
  });
});

// ─── sherpa-prompt-composer ───────────────────────────────────

test.describe('sherpa-prompt-composer', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/sherpa-prompt-composer.html');
  });

  test('basic composer', async ({ page }) => {
    const composer = page.locator('sherpa-prompt-composer').first();
    await expect(composer).toHaveScreenshot('prompt-composer-basic.png');
  });

  test('with content', async ({ page }) => {
    const composer = page.locator('sherpa-prompt-composer').first();
    await composer.locator('textarea').fill('This is a sample prompt message');
    await expect(composer).toHaveScreenshot('prompt-composer-filled.png');
  });

  test('with attachments', async ({ page }) => {
    const composer = page.locator('sherpa-prompt-composer[data-attachments]').first();
    await expect(composer).toHaveScreenshot('prompt-composer-attachments.png');
  });
});

// ─── sherpa-scheduler ─────────────────────────────────────────

test.describe('sherpa-scheduler', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/sherpa-scheduler.html');
    await page.waitForLoadState('networkidle');
  });

  test('week view', async ({ page }) => {
    const scheduler = page.locator('sherpa-scheduler').first();
    await page.waitForTimeout(500);
    await expect(scheduler).toHaveScreenshot('scheduler-week.png');
  });

  test('day view', async ({ page }) => {
    const scheduler = page.locator('sherpa-scheduler[data-view="day"]').first();
    await page.waitForTimeout(500);
    await expect(scheduler).toHaveScreenshot('scheduler-day.png');
  });

  test('month view', async ({ page }) => {
    const scheduler = page.locator('sherpa-scheduler[data-view="month"]').first();
    await page.waitForTimeout(500);
    await expect(scheduler).toHaveScreenshot('scheduler-month.png');
  });
});
