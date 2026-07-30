import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for Sherpa-UI component tests.
 *
 * Strategy: E2E-style. Specs navigate to a static harness page (test/e2e/harness.html)
 * served from the project root, which loads the compiled components (dist/components/index.js)
 * + the token CSS. Specs then inject/drive components and assert via page.evaluate + Playwright
 * expect. This exercises real Custom Elements + Shadow DOM in real browsers — the right fit for
 * a zero-dependency web-component library, and it scales cross-browser (chromium/firefox/webkit).
 *
 * The webServer builds TS + copies assets, then serves the repo root on :4173.
 */
export default defineConfig({
  testDir: './test/e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',

  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
    // Force light mode so colour assertions are deterministic regardless of OS theme.
    colorScheme: 'light',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // firefox / webkit available for cross-browser runs when needed:
    // { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    // { name: 'webkit',  use: { ...devices['Desktop Safari'] } },
  ],

  webServer: {
    command: 'npm run build:ts && npm run assets:copy && npx --yes serve . --listen 4173 --no-clipboard',
    url: 'http://localhost:4173/test/e2e/harness.html',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
