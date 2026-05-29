# Visual Regression Testing

Automated visual regression testing for Sherpa UI components using Playwright.

## Overview

Visual regression tests capture screenshots of components across different browsers, themes, viewports, and states, then compare them to baseline images to detect unintended visual changes.

**Coverage:** 100+ tests across 60+ components  
**Browsers:** Chromium, Firefox, WebKit (Safari)  
**Themes:** Light, Dark, High Contrast  
**Viewports:** Desktop (1280×720), Tablet (iPad Pro), Mobile (iPhone 13)  
**Densities:** Compact, Base, Comfortable

---

## Quick Start

### Run Visual Tests

```bash
# Run all visual tests
npm run test:visual

# Run in UI mode (interactive)
npm run test:visual:ui

# View last test report
npm run test:visual:report

# Run specific test file
npx playwright test test/visual/form-inputs.visual.spec.js

# Run specific browser only
npx playwright test --project=chromium-light-base
```

### Update Baselines

When you intentionally change component styles:

```bash
# Update all baseline screenshots
npm run test:visual:update

# Update specific test file
UPDATE_SNAPSHOTS=true npx playwright test test/visual/components.visual.spec.js

# Update specific browser
UPDATE_SNAPSHOTS=true npx playwright test --project=firefox-light-base
```

---

## Test Structure

Tests are organized by component category:

```
test/visual/
├── components.visual.spec.js           # Button, input-text, container (basic examples)
├── form-inputs.visual.spec.js          # All form inputs (15 components)
├── data-display.visual.spec.js         # Containers, data grids, lists, metrics
├── charts.visual.spec.js               # Line, bar, donut, gauge, sparkline, legend
├── overlays-feedback.visual.spec.js    # Dialogs, menus, popovers, messages, toasts
├── navigation-layout.visual.spec.js    # Nav, toolbar, layout, code-block, scheduler
└── __screenshots__/                    # Baseline screenshots (auto-generated)
    └── {test-file}/
        └── {test-name}-{browser}.png
```

---

## Test Projects

Visual tests run across 7 browser/theme/viewport configurations:

| Project | Browser | Theme | Viewport | Color Scheme |
|---------|---------|-------|----------|--------------|
| `chromium-light-base` | Chrome | Default | 1280×720 | Light |
| `chromium-dark-base` | Chrome | Default | 1280×720 | Dark |
| `firefox-light-base` | Firefox | Default | 1280×720 | Light |
| `webkit-light-base` | Safari | Default | 1280×720 | Light |
| `mobile-iphone` | Chrome | Default | 390×844 | Light |
| `tablet-ipad` | Chrome | Default | 1024×1366 | Light |
| `chromium-high-contrast` | Chrome | Default | 1280×720 | Dark + Forced Colors |

---

## Writing Visual Tests

### Basic Pattern

```javascript
import { test, expect } from '@playwright/test';

test.describe('sherpa-button', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/demo/sherpa-button.html');
  });

  test('button variants', async ({ page }) => {
    const container = page.locator('.row').first();
    await expect(container).toHaveScreenshot('button-variants.png');
  });
});
```

### Testing Component States

```javascript
test('disabled state', async ({ page }) => {
  const button = page.locator('sherpa-button').first();
  await button.evaluate(el => el.setAttribute('data-disabled', ''));
  await expect(button).toHaveScreenshot('button-disabled.png');
});
```

### Testing Interactive States

```javascript
test('dialog open', async ({ page }) => {
  const dialog = page.locator('sherpa-dialog').first();
  await dialog.evaluate(el => el.setAttribute('data-open', ''));
  await page.waitForTimeout(300); // Wait for animation
  await expect(page).toHaveScreenshot('dialog-open.png', { fullPage: true });
});
```

### Testing Themes

```javascript
async function setAppearance(page, { theme = 'apex-2-purple', mode = 'light', density = 'base' }) {
  await page.evaluate(({ theme, mode, density }) => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.density = density;
    document.documentElement.style.colorScheme = mode;
  }, { theme, mode, density });
  await page.waitForTimeout(100); // CSS apply delay
}

test('apex-2-purple dark mode', async ({ page }) => {
  await page.goto('/demo/sherpa-button.html');
  await setAppearance(page, { theme: 'apex-2-purple', mode: 'dark' });
  await expect(page).toHaveScreenshot('theme-apex-purple-dark.png', { fullPage: true });
});
```

### Testing Responsive Layouts

```javascript
test('dashboard mobile', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/patterns/layouts/dashboard-grid.html');
  await expect(page).toHaveScreenshot('dashboard-mobile.png', { fullPage: true });
});
```

---

## Configuration

### Screenshot Tolerance

Visual tests allow minor pixel differences to account for font rendering, anti-aliasing, and GPU differences:

```javascript
// playwright.config.js
expect: {
  toMatchSnapshot: {
    maxDiffPixels: 100,  // Allow up to 100 pixels to differ
    threshold: 0.2,      // 20% per-pixel threshold
  },
}
```

### Web Server

Tests automatically start a local web server:

```javascript
webServer: {
  command: 'npx http-server . -p 8080 -s',
  port: 8080,
  reuseExistingServer: !process.env.CI, // Reuse in dev, fresh in CI
}
```

---

## CI Integration

### GitHub Actions Workflow

Create `.github/workflows/visual-tests.yml`:

```yaml
name: Visual Regression Tests

on:
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install Playwright browsers
        run: npx playwright install --with-deps
      
      - name: Run visual tests
        run: npm run test:visual
      
      - name: Upload test report
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: visual-test-report
          path: test/visual/report/
          retention-days: 30
      
      - name: Upload failed screenshots
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: visual-test-failures
          path: test/visual/__screenshots__/**/*-actual.png
          retention-days: 7
```

---

## Best Practices

### ✅ Do

- **Wait for animations**: Use `page.waitForTimeout()` after triggering animations
- **Wait for async content**: Use `page.waitForLoadState('networkidle')` for charts/data
- **Test real states**: Evaluate actual component properties, not just CSS classes
- **Use semantic selectors**: Prefer `page.locator('sherpa-button')` over `.btn`
- **Test containers**: Capture groups of components to show spacing/alignment
- **Full page for layouts**: Use `{ fullPage: true }` for page-level screenshots

### ❌ Don't

- **Don't test animations mid-frame**: Always wait for completion
- **Don't use exact pixel matching**: Allow tolerance for font/GPU differences
- **Don't screenshot entire pages**: Test specific components or regions
- **Don't ignore flakiness**: Investigate unstable tests, don't just retry
- **Don't commit -actual/-diff files**: Only commit baseline screenshots

---

## Troubleshooting

### Tests are flaky

**Cause:** Animations, async content, font loading  
**Fix:** Add explicit waits:

```javascript
await page.waitForLoadState('networkidle');
await page.waitForTimeout(500); // Wait for chart rendering
```

### Baseline doesn't match locally

**Cause:** Different OS, GPU, or font rendering  
**Fix:** Baselines are captured in CI (Linux). Run tests in Docker for local baseline generation:

```bash
docker run --rm -v $(pwd):/work -w /work mcr.microsoft.com/playwright:latest npm run test:visual:update
```

### Many components changed

**Cause:** Intentional design token change  
**Fix:** Batch update all baselines:

```bash
npm run test:visual:update
git add test/visual/__screenshots__/
git commit -m "Update visual baselines: new token values"
```

### Screenshot storage too large

**Cause:** Too many test projects or full-page screenshots  
**Fix:**
- Reduce test projects (focus on chromium-light-base + chromium-dark-base)
- Use component-level screenshots instead of full-page
- Add screenshots to `.gitattributes` for LFS

---

## Coverage by Component

### ✅ Fully Tested (60+ components)

- **Form Inputs:** sherpa-input-text, sherpa-input-number, sherpa-input-date, sherpa-input-date-range, sherpa-input-time, sherpa-input-password, sherpa-input-search, sherpa-select, sherpa-checkbox, sherpa-radio, sherpa-switch, sherpa-slider, sherpa-tag
- **Buttons:** sherpa-button (variants, sizes, icons, states, status)
- **Containers:** sherpa-container, sherpa-panel, sherpa-accordion
- **Data Display:** sherpa-data-grid, sherpa-list, sherpa-metric, sherpa-key-value-list, sherpa-pagination, sherpa-table-header, sherpa-progress-bar, sherpa-loader, sherpa-empty-state
- **Charts:** sherpa-line-chart, sherpa-barchart, sherpa-donut-chart, sherpa-gauge-chart, sherpa-sparkline, sherpa-chart-legend
- **Overlays:** sherpa-dialog, sherpa-menu, sherpa-popover, sherpa-tooltip
- **Feedback:** sherpa-message, sherpa-toast, sherpa-callout
- **Navigation:** sherpa-nav, sherpa-product-bar, sherpa-toolbar, sherpa-filter-bar, sherpa-section-header, sherpa-tabs, sherpa-stepper
- **Layout:** sherpa-layout-grid, sherpa-layout-view
- **Utilities:** sherpa-code-block, sherpa-icon, sherpa-chat-message, sherpa-prompt-composer, sherpa-scheduler

### ⏳ Remaining (10+ components)

- **Node Graph:** sherpa-node-canvas, sherpa-node, sherpa-node-header, sherpa-node-row, sherpa-node-socket
- **File Upload:** sherpa-file-upload
- **Date/Time:** sherpa-date-time-picker (new component)
- **Advanced Charts:** (if any additional chart types exist)

---

## Performance

**Test Execution Time:**
- Single project: ~2-3 minutes (100+ tests)
- All 7 projects: ~15-20 minutes
- In CI (parallel): ~5-7 minutes

**Screenshot Storage:**
- ~5-10 MB per test file
- ~50-100 MB total (all baselines)

---

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Playwright Visual Comparisons](https://playwright.dev/docs/test-snapshots)
- [Sherpa UI Testing Guide](../../TESTING.md)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)

---

**Last Updated:** 2026-05-28  
**Playwright Version:** 1.51.0  
**Node Version:** 18+
