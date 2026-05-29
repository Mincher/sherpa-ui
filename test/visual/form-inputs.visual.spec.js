/**
 * Visual Regression Tests: Form Input Components
 *
 * Tests all form input components across states and variants.
 */

import { test, expect } from '@playwright/test';

// ─── sherpa-input-number ──────────────────────────────────────

test.describe('sherpa-input-number', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/sherpa-input-number.html');
  });

  test('basic number input', async ({ page }) => {
    const input = page.locator('sherpa-input-number').first();
    await expect(input).toHaveScreenshot('input-number-basic.png');
  });

  test('with min/max/step', async ({ page }) => {
    const input = page.locator('sherpa-input-number[data-min]').first();
    await expect(input).toHaveScreenshot('input-number-constrained.png');
  });

  test('disabled state', async ({ page }) => {
    const input = page.locator('sherpa-input-number[data-disabled]').first();
    await expect(input).toHaveScreenshot('input-number-disabled.png');
  });
});

// ─── sherpa-input-date ────────────────────────────────────────

test.describe('sherpa-input-date', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/sherpa-input-date.html');
  });

  test('basic date input', async ({ page }) => {
    const input = page.locator('sherpa-input-date').first();
    await expect(input).toHaveScreenshot('input-date-basic.png');
  });

  test('with calendar open', async ({ page }) => {
    const input = page.locator('sherpa-input-date').first();
    await input.click();
    await page.waitForTimeout(200); // Calendar animation
    await expect(page.locator('body')).toHaveScreenshot('input-date-calendar-open.png');
  });

  test('error state', async ({ page }) => {
    const input = page.locator('sherpa-input-date[data-status="error"]').first();
    await expect(input).toHaveScreenshot('input-date-error.png');
  });
});

// ─── sherpa-input-date-range ──────────────────────────────────

test.describe('sherpa-input-date-range', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/sherpa-input-date-range.html');
  });

  test('basic date range', async ({ page }) => {
    const input = page.locator('sherpa-input-date-range').first();
    await expect(input).toHaveScreenshot('input-date-range-basic.png');
  });

  test('with both calendars open', async ({ page }) => {
    const input = page.locator('sherpa-input-date-range').first();
    await input.click();
    await page.waitForTimeout(200);
    await expect(page.locator('body')).toHaveScreenshot('input-date-range-calendars.png');
  });
});

// ─── sherpa-input-time ────────────────────────────────────────

test.describe('sherpa-input-time', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/sherpa-input-time.html');
  });

  test('basic time input', async ({ page }) => {
    const input = page.locator('sherpa-input-time').first();
    await expect(input).toHaveScreenshot('input-time-basic.png');
  });

  test('with value', async ({ page }) => {
    const input = page.locator('sherpa-input-time').first();
    await input.evaluate(el => el.value = '14:30');
    await expect(input).toHaveScreenshot('input-time-filled.png');
  });
});

// ─── sherpa-input-password ────────────────────────────────────

test.describe('sherpa-input-password', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/sherpa-input-password.html');
  });

  test('masked state', async ({ page }) => {
    const input = page.locator('sherpa-input-password').first();
    await input.evaluate(el => el.value = 'password123');
    await expect(input).toHaveScreenshot('input-password-masked.png');
  });

  test('revealed state', async ({ page }) => {
    const input = page.locator('sherpa-input-password').first();
    await input.evaluate(el => {
      el.value = 'password123';
      el.setAttribute('data-revealed', '');
    });
    await expect(input).toHaveScreenshot('input-password-revealed.png');
  });
});

// ─── sherpa-input-search ──────────────────────────────────────

test.describe('sherpa-input-search', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/sherpa-input-search.html');
  });

  test('empty state', async ({ page }) => {
    const input = page.locator('sherpa-input-search').first();
    await expect(input).toHaveScreenshot('input-search-empty.png');
  });

  test('with value and clear button', async ({ page }) => {
    const input = page.locator('sherpa-input-search').first();
    await input.evaluate(el => el.value = 'search query');
    await expect(input).toHaveScreenshot('input-search-filled.png');
  });
});

// ─── sherpa-select ────────────────────────────────────────────

test.describe('sherpa-select', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/sherpa-select.html');
  });

  test('basic select', async ({ page }) => {
    const select = page.locator('sherpa-select').first();
    await expect(select).toHaveScreenshot('select-basic.png');
  });

  test('with selected value', async ({ page }) => {
    const select = page.locator('sherpa-select').first();
    await select.evaluate(el => el.value = 'option2');
    await expect(select).toHaveScreenshot('select-selected.png');
  });

  test('disabled state', async ({ page }) => {
    const select = page.locator('sherpa-select[data-disabled]').first();
    await expect(select).toHaveScreenshot('select-disabled.png');
  });
});

// ─── sherpa-checkbox ──────────────────────────────────────────

test.describe('sherpa-checkbox', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/sherpa-checkbox.html');
  });

  test('unchecked state', async ({ page }) => {
    const checkbox = page.locator('sherpa-checkbox').first();
    await expect(checkbox).toHaveScreenshot('checkbox-unchecked.png');
  });

  test('checked state', async ({ page }) => {
    const checkbox = page.locator('sherpa-checkbox').first();
    await checkbox.evaluate(el => el.checked = true);
    await expect(checkbox).toHaveScreenshot('checkbox-checked.png');
  });

  test('indeterminate state', async ({ page }) => {
    const checkbox = page.locator('sherpa-checkbox').first();
    await checkbox.evaluate(el => el.indeterminate = true);
    await expect(checkbox).toHaveScreenshot('checkbox-indeterminate.png');
  });

  test('disabled state', async ({ page }) => {
    const checkbox = page.locator('sherpa-checkbox[data-disabled]').first();
    await expect(checkbox).toHaveScreenshot('checkbox-disabled.png');
  });
});

// ─── sherpa-radio ─────────────────────────────────────────────

test.describe('sherpa-radio', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/sherpa-radio.html');
  });

  test('radio group', async ({ page }) => {
    const group = page.locator('.radio-group').first();
    await expect(group).toHaveScreenshot('radio-group.png');
  });

  test('checked state', async ({ page }) => {
    const radio = page.locator('sherpa-radio').first();
    await radio.evaluate(el => el.checked = true);
    await expect(radio).toHaveScreenshot('radio-checked.png');
  });
});

// ─── sherpa-switch ────────────────────────────────────────────

test.describe('sherpa-switch', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/sherpa-switch.html');
  });

  test('off state', async ({ page }) => {
    const toggle = page.locator('sherpa-switch').first();
    await expect(toggle).toHaveScreenshot('switch-off.png');
  });

  test('on state', async ({ page }) => {
    const toggle = page.locator('sherpa-switch').first();
    await toggle.evaluate(el => el.checked = true);
    await expect(toggle).toHaveScreenshot('switch-on.png');
  });

  test('sizes', async ({ page }) => {
    const container = page.locator('.row').first();
    await expect(container).toHaveScreenshot('switch-sizes.png');
  });

  test('disabled state', async ({ page }) => {
    const toggle = page.locator('sherpa-switch[data-disabled]').first();
    await expect(toggle).toHaveScreenshot('switch-disabled.png');
  });
});

// ─── sherpa-slider ────────────────────────────────────────────

test.describe('sherpa-slider', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/sherpa-slider.html');
  });

  test('basic slider', async ({ page }) => {
    const slider = page.locator('sherpa-slider').first();
    await expect(slider).toHaveScreenshot('slider-basic.png');
  });

  test('with value', async ({ page }) => {
    const slider = page.locator('sherpa-slider').first();
    await slider.evaluate(el => el.value = 75);
    await expect(slider).toHaveScreenshot('slider-75.png');
  });

  test('disabled state', async ({ page }) => {
    const slider = page.locator('sherpa-slider[data-disabled]').first();
    await expect(slider).toHaveScreenshot('slider-disabled.png');
  });
});

// ─── sherpa-tag ───────────────────────────────────────────────

test.describe('sherpa-tag', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/sherpa-tag.html');
  });

  test('tag variants', async ({ page }) => {
    const container = page.locator('.row').first();
    await expect(container).toHaveScreenshot('tag-variants.png');
  });

  test('tag sizes', async ({ page }) => {
    const container = page.locator('.row').nth(1);
    await expect(container).toHaveScreenshot('tag-sizes.png');
  });

  test('removable tags', async ({ page }) => {
    const container = page.locator('.row').nth(2);
    await expect(container).toHaveScreenshot('tag-removable.png');
  });

  test('status colors', async ({ page }) => {
    const container = page.locator('.row').nth(3);
    await expect(container).toHaveScreenshot('tag-status.png');
  });
});
