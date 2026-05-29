/**
 * Visual Regression Tests: Overlays & Feedback Components
 *
 * Tests dialogs, menus, popovers, tooltips, messages, toasts, and callouts.
 */

import { test, expect } from '@playwright/test';

// ─── sherpa-dialog ────────────────────────────────────────────

test.describe('sherpa-dialog', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/sherpa-dialog.html');
  });

  test('dialog (closed)', async ({ page }) => {
    const dialog = page.locator('sherpa-dialog').first();
    await expect(dialog).toHaveScreenshot('dialog-closed.png');
  });

  test('dialog (open)', async ({ page }) => {
    const dialog = page.locator('sherpa-dialog').first();
    await dialog.evaluate(el => el.setAttribute('data-open', ''));
    await page.waitForTimeout(300); // Animation
    await expect(page).toHaveScreenshot('dialog-open.png', { fullPage: true });
  });

  test('small dialog', async ({ page }) => {
    const dialog = page.locator('sherpa-dialog[data-size="sm"]').first();
    await dialog.evaluate(el => el.setAttribute('data-open', ''));
    await page.waitForTimeout(300);
    await expect(page).toHaveScreenshot('dialog-small.png', { fullPage: true });
  });

  test('large dialog', async ({ page }) => {
    const dialog = page.locator('sherpa-dialog[data-size="lg"]').first();
    await dialog.evaluate(el => el.setAttribute('data-open', ''));
    await page.waitForTimeout(300);
    await expect(page).toHaveScreenshot('dialog-large.png', { fullPage: true });
  });

  test('with backdrop', async ({ page }) => {
    const dialog = page.locator('sherpa-dialog[data-backdrop]').first();
    await dialog.evaluate(el => el.setAttribute('data-open', ''));
    await page.waitForTimeout(300);
    await expect(page).toHaveScreenshot('dialog-backdrop.png', { fullPage: true });
  });
});

// ─── sherpa-menu ──────────────────────────────────────────────

test.describe('sherpa-menu', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/sherpa-menu.html');
  });

  test('menu (closed)', async ({ page }) => {
    const menu = page.locator('sherpa-menu').first();
    await expect(menu).toHaveScreenshot('menu-closed.png');
  });

  test('menu (open)', async ({ page }) => {
    const trigger = page.locator('[data-trigger-for]').first();
    await trigger.click();
    await page.waitForTimeout(200);
    await expect(page.locator('body')).toHaveScreenshot('menu-open.png');
  });

  test('with icons', async ({ page }) => {
    const trigger = page.locator('[data-trigger-for]').nth(1);
    await trigger.click();
    await page.waitForTimeout(200);
    await expect(page.locator('body')).toHaveScreenshot('menu-icons.png');
  });

  test('with dividers', async ({ page }) => {
    const trigger = page.locator('[data-trigger-for]').nth(2);
    await trigger.click();
    await page.waitForTimeout(200);
    await expect(page.locator('body')).toHaveScreenshot('menu-dividers.png');
  });

  test('with disabled items', async ({ page }) => {
    const trigger = page.locator('[data-trigger-for]').nth(3);
    await trigger.click();
    await page.waitForTimeout(200);
    await expect(page.locator('body')).toHaveScreenshot('menu-disabled.png');
  });
});

// ─── sherpa-popover ───────────────────────────────────────────

test.describe('sherpa-popover', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/sherpa-popover.html');
  });

  test('popover (closed)', async ({ page }) => {
    const popover = page.locator('sherpa-popover').first();
    await expect(popover).toHaveScreenshot('popover-closed.png');
  });

  test('popover top', async ({ page }) => {
    const trigger = page.locator('[data-trigger-for]').first();
    await trigger.click();
    await page.waitForTimeout(200);
    await expect(page.locator('body')).toHaveScreenshot('popover-top.png');
  });

  test('popover right', async ({ page }) => {
    const trigger = page.locator('[data-trigger-for]').nth(1);
    await trigger.click();
    await page.waitForTimeout(200);
    await expect(page.locator('body')).toHaveScreenshot('popover-right.png');
  });

  test('popover bottom', async ({ page }) => {
    const trigger = page.locator('[data-trigger-for]').nth(2);
    await trigger.click();
    await page.waitForTimeout(200);
    await expect(page.locator('body')).toHaveScreenshot('popover-bottom.png');
  });

  test('popover left', async ({ page }) => {
    const trigger = page.locator('[data-trigger-for]').nth(3);
    await trigger.click();
    await page.waitForTimeout(200);
    await expect(page.locator('body')).toHaveScreenshot('popover-left.png');
  });
});

// ─── sherpa-tooltip ───────────────────────────────────────────

test.describe('sherpa-tooltip', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/sherpa-tooltip.html');
  });

  test('tooltip on hover', async ({ page }) => {
    const trigger = page.locator('[data-tooltip]').first();
    await trigger.hover();
    await page.waitForTimeout(200);
    await expect(page.locator('body')).toHaveScreenshot('tooltip-hover.png');
  });

  test('tooltip positions', async ({ page }) => {
    const triggers = page.locator('[data-tooltip]');
    await triggers.nth(0).hover();
    await page.waitForTimeout(100);
    await expect(page.locator('body')).toHaveScreenshot('tooltip-top.png');
  });
});

// ─── sherpa-message ───────────────────────────────────────────

test.describe('sherpa-message', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/sherpa-message.html');
  });

  test('info message', async ({ page }) => {
    const message = page.locator('sherpa-message[data-status="info"]').first();
    await expect(message).toHaveScreenshot('message-info.png');
  });

  test('success message', async ({ page }) => {
    const message = page.locator('sherpa-message[data-status="success"]').first();
    await expect(message).toHaveScreenshot('message-success.png');
  });

  test('warning message', async ({ page }) => {
    const message = page.locator('sherpa-message[data-status="warning"]').first();
    await expect(message).toHaveScreenshot('message-warning.png');
  });

  test('error message', async ({ page }) => {
    const message = page.locator('sherpa-message[data-status="error"]').first();
    await expect(message).toHaveScreenshot('message-error.png');
  });

  test('with icon', async ({ page }) => {
    const message = page.locator('sherpa-message[data-icon]').first();
    await expect(message).toHaveScreenshot('message-icon.png');
  });

  test('with close button', async ({ page }) => {
    const message = page.locator('sherpa-message[data-closable]').first();
    await expect(message).toHaveScreenshot('message-closable.png');
  });

  test('with action', async ({ page }) => {
    const message = page.locator('sherpa-message').nth(6);
    await expect(message).toHaveScreenshot('message-action.png');
  });
});

// ─── sherpa-toast ─────────────────────────────────────────────

test.describe('sherpa-toast', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/sherpa-toast.html');
  });

  test('toast notification', async ({ page }) => {
    const button = page.locator('sherpa-button').first();
    await button.click();
    await page.waitForTimeout(300);
    await expect(page.locator('body')).toHaveScreenshot('toast-visible.png');
  });

  test('toast positions', async ({ page }) => {
    const container = page.locator('.toast-container').first();
    await expect(container).toHaveScreenshot('toast-positions.png');
  });

  test('toast stack', async ({ page }) => {
    const button = page.locator('sherpa-button').first();
    await button.click();
    await page.waitForTimeout(100);
    await button.click();
    await page.waitForTimeout(100);
    await button.click();
    await page.waitForTimeout(200);
    await expect(page.locator('body')).toHaveScreenshot('toast-stack.png');
  });
});

// ─── sherpa-callout ───────────────────────────────────────────

test.describe('sherpa-callout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/sherpa-callout.html');
  });

  test('info callout', async ({ page }) => {
    const callout = page.locator('sherpa-callout[data-status="info"]').first();
    await expect(callout).toHaveScreenshot('callout-info.png');
  });

  test('success callout', async ({ page }) => {
    const callout = page.locator('sherpa-callout[data-status="success"]').first();
    await expect(callout).toHaveScreenshot('callout-success.png');
  });

  test('warning callout', async ({ page }) => {
    const callout = page.locator('sherpa-callout[data-status="warning"]').first();
    await expect(callout).toHaveScreenshot('callout-warning.png');
  });

  test('error callout', async ({ page }) => {
    const callout = page.locator('sherpa-callout[data-status="error"]').first();
    await expect(callout).toHaveScreenshot('callout-error.png');
  });

  test('with title', async ({ page }) => {
    const callout = page.locator('sherpa-callout[data-title]').first();
    await expect(callout).toHaveScreenshot('callout-title.png');
  });

  test('with icon', async ({ page }) => {
    const callout = page.locator('sherpa-callout[data-icon]').first();
    await expect(callout).toHaveScreenshot('callout-icon.png');
  });
});

// ─── sherpa-tabs ──────────────────────────────────────────────

test.describe('sherpa-tabs', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/sherpa-tabs.html');
  });

  test('basic tabs', async ({ page }) => {
    const tabs = page.locator('sherpa-tabs').first();
    await expect(tabs).toHaveScreenshot('tabs-basic.png');
  });

  test('with second tab active', async ({ page }) => {
    const tabs = page.locator('sherpa-tabs').first();
    await tabs.locator('[role="tab"]').nth(1).click();
    await page.waitForTimeout(200);
    await expect(tabs).toHaveScreenshot('tabs-second-active.png');
  });

  test('vertical tabs', async ({ page }) => {
    const tabs = page.locator('sherpa-tabs[data-orientation="vertical"]').first();
    await expect(tabs).toHaveScreenshot('tabs-vertical.png');
  });

  test('with icons', async ({ page }) => {
    const tabs = page.locator('sherpa-tabs').nth(2);
    await expect(tabs).toHaveScreenshot('tabs-icons.png');
  });
});

// ─── sherpa-stepper ───────────────────────────────────────────

test.describe('sherpa-stepper', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/sherpa-stepper.html');
  });

  test('stepper step 1', async ({ page }) => {
    const stepper = page.locator('sherpa-stepper').first();
    await expect(stepper).toHaveScreenshot('stepper-step-1.png');
  });

  test('stepper step 2', async ({ page }) => {
    const stepper = page.locator('sherpa-stepper').first();
    await stepper.evaluate(el => el.setAttribute('data-current-step', '2'));
    await expect(stepper).toHaveScreenshot('stepper-step-2.png');
  });

  test('stepper completed', async ({ page }) => {
    const stepper = page.locator('sherpa-stepper').first();
    await stepper.evaluate(el => el.setAttribute('data-current-step', '4'));
    await expect(stepper).toHaveScreenshot('stepper-completed.png');
  });

  test('vertical stepper', async ({ page }) => {
    const stepper = page.locator('sherpa-stepper[data-orientation="vertical"]').first();
    await expect(stepper).toHaveScreenshot('stepper-vertical.png');
  });
});
