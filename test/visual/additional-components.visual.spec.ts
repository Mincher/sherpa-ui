// @ts-nocheck
/**
 * Visual Regression Tests: Additional Components
 *
 * Tests for file upload, date-time-picker, and other specialized components.
 */

import { test, expect } from '@playwright/test';

// Test suite: File Upload
test.describe('sherpa-file-upload', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/components/sherpa-file-upload');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
  });

  test('file upload empty', async ({ page }) => {
    const upload = page.locator('sherpa-file-upload').first();
    await expect(upload).toHaveScreenshot('file-upload-empty.png');
  });

  test('file upload drag active', async ({ page }) => {
    const upload = page.locator('sherpa-file-upload').first();
    await upload.evaluate(el => el.setAttribute('data-drag-active', ''));
    await expect(upload).toHaveScreenshot('file-upload-drag-active.png');
  });

  test('file upload with files', async ({ page }) => {
    const example = page.locator('.docs-example-preview').nth(1);
    await expect(example).toHaveScreenshot('file-upload-with-files.png');
  });
});

// Test suite: Date Time Picker
test.describe('sherpa-date-time-picker', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/components/sherpa-date-time-picker');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
  });

  test('date-time picker closed', async ({ page }) => {
    const picker = page.locator('sherpa-date-time-picker').first();
    await expect(picker).toHaveScreenshot('date-time-picker-closed.png');
  });

  test('date-time picker open', async ({ page }) => {
    const picker = page.locator('sherpa-date-time-picker').first();
    await picker.click();
    await page.waitForTimeout(300); // Calendar animation
    await expect(page.locator('body')).toHaveScreenshot('date-time-picker-open.png');
  });

  test('date-time picker with value', async ({ page }) => {
    const picker = page.locator('sherpa-date-time-picker').first();
    await picker.evaluate(el => el.value = '2024-05-28T14:30');
    await expect(picker).toHaveScreenshot('date-time-picker-value.png');
  });
});

// Test suite: Breadcrumbs
test.describe('sherpa-breadcrumbs', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/components/sherpa-breadcrumbs');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
  });

  test('breadcrumbs', async ({ page }) => {
    const breadcrumbs = page.locator('sherpa-breadcrumbs').first();
    await expect(breadcrumbs).toHaveScreenshot('breadcrumbs.png');
  });

  test('breadcrumbs with icons', async ({ page }) => {
    const example = page.locator('.docs-example-preview').nth(1);
    await expect(example).toHaveScreenshot('breadcrumbs-icons.png');
  });

  test('breadcrumbs collapsed', async ({ page }) => {
    const example = page.locator('.docs-example-preview').nth(2);
    await expect(example).toHaveScreenshot('breadcrumbs-collapsed.png');
  });
});

// Test suite: Calendar
test.describe('sherpa-calendar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/sherpa-calendar.html');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
  });

  test('calendar current month', async ({ page }) => {
    const calendar = page.locator('sherpa-calendar').first();
    await expect(calendar).toHaveScreenshot('calendar-month.png');
  });

  test('calendar with selected date', async ({ page }) => {
    const calendar = page.locator('sherpa-calendar').first();
    await calendar.evaluate(el => el.value = '2024-05-15');
    await expect(calendar).toHaveScreenshot('calendar-selected.png');
  });
});

// Test suite: Additional Form Components
test.describe('additional form components', () => {
  test('sherpa-input-password', async ({ page }) => {
    await page.goto('/#/components/sherpa-input-password');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    const input = page.locator('sherpa-input-password').first();
    await expect(input).toHaveScreenshot('input-password.png');
  });

  test('sherpa-input-number', async ({ page }) => {
    await page.goto('/#/components/sherpa-input-number');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    const input = page.locator('sherpa-input-number').first();
    await expect(input).toHaveScreenshot('input-number.png');
  });

  test('sherpa-checkbox', async ({ page }) => {
    await page.goto('/#/components/sherpa-checkbox');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    const example = page.locator('.docs-example-preview').first();
    await expect(example).toHaveScreenshot('checkbox-group.png');
  });

  test('sherpa-radio', async ({ page }) => {
    await page.goto('/#/components/sherpa-radio');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    const example = page.locator('.docs-example-preview').first();
    await expect(example).toHaveScreenshot('radio-group.png');
  });
});

// Test suite: Layout Components
test.describe('layout components', () => {
  test('sherpa-layout-grid', async ({ page }) => {
    await page.goto('/#/components/sherpa-layout-grid');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    const example = page.locator('.docs-example-preview').first();
    await expect(example).toHaveScreenshot('layout-grid.png');
  });

  test('sherpa-layout-view', async ({ page }) => {
    await page.goto('/#/components/sherpa-layout-view');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    const example = page.locator('.docs-example-preview').first();
    await expect(example).toHaveScreenshot('layout-view.png');
  });
});

// Test suite: Communication Components
test.describe('communication components', () => {
  test('sherpa-chat-message', async ({ page }) => {
    await page.goto('/#/components/sherpa-chat-message');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    const example = page.locator('.docs-example-preview').first();
    await expect(example).toHaveScreenshot('chat-message.png');
  });

  test('sherpa-prompt-composer', async ({ page }) => {
    await page.goto('/#/components/sherpa-prompt-composer');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    const composer = page.locator('sherpa-prompt-composer').first();
    await expect(composer).toHaveScreenshot('prompt-composer.png');
  });
});
