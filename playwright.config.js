/**
 * Playwright Configuration for Visual Regression Testing
 *
 * Tests all Sherpa UI components across:
 * - Multiple browsers (Chromium, Firefox, WebKit)
 * - Multiple themes (light/dark/high-contrast)
 * - Multiple densities (compact/base/comfortable)
 * - Multiple viewports (mobile/tablet/desktop)
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './test/visual',

  // Folder for screenshots
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}{-projectName}{-snapshotSuffix}{ext}',

  // Update snapshots: npm run test:visual:update
  updateSnapshots: process.env.UPDATE_SNAPSHOTS === 'true' ? 'all' : 'none',

  // Expect assertions
  expect: {
    // Tolerance for pixel differences (0 = exact match)
    toMatchSnapshot: {
      maxDiffPixels: 100, // Allow up to 100 pixels different (anti-aliasing, fonts)
      threshold: 0.2,     // 20% threshold per pixel
    },
  },

  // Test configuration
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'test/visual/report', open: 'never' }],
  ],

  use: {
    // Base URL for tests
    baseURL: 'http://localhost:8080',

    // Screenshot options
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',

    // Viewport (overridden by projects)
    viewport: { width: 1280, height: 720 },
  },

  // Web server
  webServer: {
    command: 'npx http-server . -p 8080 -s',
    port: 8080,
    reuseExistingServer: !process.env.CI,
  },

  // Test projects (browsers × themes × densities × viewports)
  projects: [
    // ─── Desktop: Chromium ────────────────────────────────
    {
      name: 'chromium-light-base',
      use: {
        ...devices['Desktop Chrome'],
        colorScheme: 'light',
      },
    },
    {
      name: 'chromium-dark-base',
      use: {
        ...devices['Desktop Chrome'],
        colorScheme: 'dark',
      },
    },

    // ─── Desktop: Firefox ─────────────────────────────────
    {
      name: 'firefox-light-base',
      use: {
        ...devices['Desktop Firefox'],
        colorScheme: 'light',
      },
    },

    // ─── Desktop: WebKit (Safari) ─────────────────────────
    {
      name: 'webkit-light-base',
      use: {
        ...devices['Desktop Safari'],
        colorScheme: 'light',
      },
    },

    // ─── Mobile: iPhone ───────────────────────────────────
    {
      name: 'mobile-iphone',
      use: {
        ...devices['iPhone 13'],
        colorScheme: 'light',
      },
    },

    // ─── Tablet: iPad ─────────────────────────────────────
    {
      name: 'tablet-ipad',
      use: {
        ...devices['iPad Pro'],
        colorScheme: 'light',
      },
    },

    // ─── High Contrast Mode ───────────────────────────────
    {
      name: 'chromium-high-contrast',
      use: {
        ...devices['Desktop Chrome'],
        colorScheme: 'dark',
        forcedColors: 'active', // Windows High Contrast Mode
      },
    },
  ],
});
