import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for Sherpa-UI component tests.
 *
 * Strategy: E2E-style. Specs navigate to the static harness (test/reforged/harness.html)
 * served from the project root, which loads the compiled reforged bundle
 * (dist/index.js) + the token CSS. Specs then inject/drive components and assert
 * via page.evaluate + Playwright expect. This exercises real Custom Elements + Shadow DOM in
 * real browsers — the right fit for a zero-dependency web-component library, and it scales
 * cross-browser (chromium/firefox/webkit).
 *
 * The webServer builds the reforged tree, then serves the repo root on :4173.
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

  /* TWO servers. The harness needs the repo served statically; the
     view-definition specs drive the real example APP, which is an Express
     server on :4200 with its own routing.

     `reforged-view-chips.spec.ts` navigates to `http://localhost:4200/#/dashboard`
     and its five tests failed with ERR_CONNECTION_REFUSED unless someone had
     run `npm run serve:examples` in another terminal first — a hidden
     requirement nothing stated, so a clean `npm test` reported five failures
     that were nothing to do with the code. */
  webServer: [
    {
      command: 'npm run build && npx --yes serve . --listen 4173 --no-clipboard',
      url: 'http://localhost:4173/test/reforged/harness.html',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'npm run serve:examples',
      url: 'http://localhost:4200/',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
