/**
 * Visual Regression Tests: Node Graph Components
 *
 * Tests the node canvas and related components for visual regressions.
 */

import { test, expect } from '@playwright/test';

// Test suite: Node Canvas
test.describe('sherpa-node-canvas', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/components/sherpa-node-canvas');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
  });

  test('node canvas example', async ({ page }) => {
    const example = page.locator('.docs-example-preview').first();
    await expect(example).toHaveScreenshot('node-canvas-example.png');
  });

  test('node canvas with connections', async ({ page }) => {
    const example = page.locator('.docs-example-preview').nth(1);
    await expect(example).toHaveScreenshot('node-canvas-connections.png');
  });
});

// Test suite: Sherpa Node
test.describe('sherpa-node', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/components/sherpa-node');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
  });

  test('basic node', async ({ page }) => {
    const node = page.locator('sherpa-node').first();
    await expect(node).toHaveScreenshot('node-basic.png');
  });

  test('node selected', async ({ page }) => {
    const node = page.locator('sherpa-node').first();
    await node.evaluate(el => el.setAttribute('data-selected', ''));
    await expect(node).toHaveScreenshot('node-selected.png');
  });

  test('node with sockets', async ({ page }) => {
    const example = page.locator('.docs-example-preview').nth(1);
    await expect(example).toHaveScreenshot('node-with-sockets.png');
  });
});

// Test suite: Node Header
test.describe('sherpa-node-header', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/components/sherpa-node-header');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
  });

  test('node header', async ({ page }) => {
    const header = page.locator('sherpa-node-header').first();
    await expect(header).toHaveScreenshot('node-header.png');
  });

  test('node header with icon', async ({ page }) => {
    const header = page.locator('sherpa-node-header[data-icon]').first();
    await expect(header).toHaveScreenshot('node-header-icon.png');
  });
});

// Test suite: Node Row
test.describe('sherpa-node-row', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/components/sherpa-node-row');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
  });

  test('node row', async ({ page }) => {
    const row = page.locator('sherpa-node-row').first();
    await expect(row).toHaveScreenshot('node-row.png');
  });

  test('node row with sockets', async ({ page }) => {
    const example = page.locator('.docs-example-preview').nth(1);
    await expect(example).toHaveScreenshot('node-row-sockets.png');
  });
});

// Test suite: Node Socket
test.describe('sherpa-node-socket', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/components/sherpa-node-socket');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
  });

  test('input socket', async ({ page }) => {
    const socket = page.locator('sherpa-node-socket[data-type="input"]').first();
    await expect(socket).toHaveScreenshot('node-socket-input.png');
  });

  test('output socket', async ({ page }) => {
    const socket = page.locator('sherpa-node-socket[data-type="output"]').first();
    await expect(socket).toHaveScreenshot('node-socket-output.png');
  });

  test('socket connected', async ({ page }) => {
    const socket = page.locator('sherpa-node-socket').first();
    await socket.evaluate(el => el.setAttribute('data-connected', ''));
    await expect(socket).toHaveScreenshot('node-socket-connected.png');
  });
});
