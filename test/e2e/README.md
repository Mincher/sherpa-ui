# Sherpa-UI Component Tests (Playwright)

Real-browser tests for the web-component library. Because every component is a
Custom Element with Shadow DOM, tests run **in a real browser** (Playwright)
against the compiled output — not in a simulated DOM.

## Running

```bash
npm test              # build + serve + run the whole suite (chromium)
npm run test:headed   # watch it run in a real browser window
npm run test:ui       # Playwright's interactive UI mode
npm run test:report   # open the last HTML report
```

`npm test` runs `playwright test`, which (via `playwright.config.ts`'s
`webServer`) builds TS, copies assets, and serves the repo root on
`http://localhost:4173`, then drives the specs.

Cross-browser: firefox/webkit projects are commented in `playwright.config.ts`
(browsers are already installed) — uncomment to run `--project=firefox` etc.

## How it works

- **`harness.html`** — a page that loads `/dist/components/index.js` (registers
  every component) + the token CSS + FontAwesome, and sets `window.__sherpaReady`
  once elements register.
- **`support.ts`** — helpers:
  - `openHarness(page)` — navigate + wait for ready (use in `beforeEach`).
  - `mount(page, html, waitForTag?)` — inject markup into `#root` and await the
    named element's `rendered` promise.
  - `clearRoot(page)` — reset between tests (use in `afterEach`).

Assertions run inside `page.evaluate(() => {...})` — query `el.shadowRoot`,
click internal `part`/class selectors, dispatch events, call public methods,
return plain data, then check with Playwright `expect`.

## Coverage

- **`smoke.spec.ts`** — the floor: every one of the 74 components registers,
  instantiates, and renders a non-empty shadow root without throwing.
- **Behavioral specs** — real interactions/events per family:
  - `controls.spec.ts` · `inputs.spec.ts` · `feedback-nav.spec.ts` ·
    `containers.spec.ts` · `charts.spec.ts` · `node-graph.spec.ts` ·
    `data-widgets.spec.ts`
  - Plus per-component: `sherpa-tree`, `sherpa-app-header`,
    `sherpa-quick-filter`, `sherpa-proposal-preview`.

**143 tests** currently green.

## Adding a spec

1. Read the component's `.ts` (JSDoc `@attr`/`@fires`/`@method`) and `.html`
   (shadow structure, `part=`/class selectors) — assert its **real** API, don't
   guess selectors or event names.
2. Copy the shape of `sherpa-tree.spec.ts`:
   ```ts
   import { test, expect } from '@playwright/test';
   import { openHarness, mount, clearRoot } from './support';

   test.beforeEach(async ({ page }) => openHarness(page));
   test.afterEach(async ({ page }) => clearRoot(page));

   test('does the thing', async ({ page }) => {
     await mount(page, `<sherpa-x data-foo="bar"></sherpa-x>`, 'sherpa-x');
     const r = await page.evaluate(() => {
       const el = document.querySelector('sherpa-x')!;
       // ...drive + read shadow DOM...
       return { /* plain data */ };
     });
     expect(r.something).toBe(true);
   });
   ```
3. For async render/slot detection or menus, a small `await new Promise(r => setTimeout(r, 150))` after `mount` is the house idiom.
4. Run `npx playwright test <file> --project=chromium` and iterate to green.

## Note on the legacy `test/**/*.test.ts` files

Older files (button, input-text, calendar, integration, utilities) are
WTR/mocha/chai-style and **not run** by Playwright (`testMatch` is `*.spec.ts`).
`@web/test-runner` was never installed. Port them to `.spec.ts` when touched, or
install WTR via `npm run test:legacy:wtr` if that style is preferred for units.
