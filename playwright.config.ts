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
  /* ONE RETRY EVERYWHERE, not only in CI.
     A retry is a NET, not a fix, and the fix went in first: the harness used to
     fetch Font Awesome from cdnjs on every one of 553 page loads, eight browser
     contexts at a time, and the suite failed a random 1-18 tests per run on
     `page.goto` timeouts. Serving that file from node_modules took the suite
     from 1.3-5.5 minutes and always-some-failures to ~27 seconds and 559/559,
     six runs out of seven. See TRAP T-harness-serves-font-awesome-locally.

     This retry covers the seventh. It is deliberately 1, not 3: a test that
     needs three goes is telling you something, and this must not become the
     place that muffles it. */
  retries: 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',

  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
    // Force light mode so colour assertions are deterministic regardless of OS theme.
    colorScheme: 'light',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    /* Cross-browser on demand: `npx playwright test --project=firefox`.
       Not in the default run — it triples the wall clock for a suite whose
       assertions are engine-agnostic. The ONE place an engine difference is
       load-bearing is `reforged-css-functions.spec.ts`, which asserts the
       RESULT rather than the mechanism, so it passes either way.
       TRAP T-a-css-function-needs-its-longhand-first */
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],

  /* The harness needs the repo served statically. The example APP and its
     tests live in ../Sherpa Demos, with their own server (TODO 37). */
  webServer: {
    command: 'npm run build && npx --yes serve . --listen 4173 --no-clipboard',
    url: 'http://localhost:4173/test/reforged/harness.html',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
