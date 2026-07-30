import { test, expect } from '@playwright/test';
import { openHarness } from './support';

/**
 * Library-wide smoke test: every sherpa-* component must
 *   1. be registered as a custom element,
 *   2. instantiate + attach a shadow root without throwing,
 *   3. render a non-empty shadow root (or be a known no-shadow case).
 *
 * This is the coverage floor — it catches broken templates / import errors /
 * lifecycle throws across the whole library. Behavioural specs live per-component.
 */

// Every component tag in the library.
const TAGS = [
  'sherpa-accordion', 'sherpa-app-header', 'sherpa-app-shell', 'sherpa-barchart',
  'sherpa-breadcrumbs', 'sherpa-button', 'sherpa-calendar', 'sherpa-callout',
  'sherpa-chart-legend', 'sherpa-chat-message', 'sherpa-code-block', 'sherpa-container-footer',
  'sherpa-container-group', 'sherpa-container-header', 'sherpa-container-overlay', 'sherpa-container',
  'sherpa-data-grid', 'sherpa-dialog', 'sherpa-donut-chart', 'sherpa-empty-state',
  'sherpa-file-upload', 'sherpa-gauge-chart', 'sherpa-input-date-range', 'sherpa-input-date',
  'sherpa-input-number', 'sherpa-input-password', 'sherpa-input-search', 'sherpa-input-select',
  'sherpa-input-tag', 'sherpa-input-text', 'sherpa-input-time', 'sherpa-key-value-list',
  'sherpa-layout-grid', 'sherpa-line-chart', 'sherpa-list-item', 'sherpa-list',
  'sherpa-loader', 'sherpa-message', 'sherpa-metric', 'sherpa-nav-item',
  'sherpa-nav-section', 'sherpa-nav', 'sherpa-node-canvas', 'sherpa-node-row',
  'sherpa-node-socket', 'sherpa-node', 'sherpa-overlay-item', 'sherpa-pagination',
  'sherpa-panel', 'sherpa-product-bar-v2', 'sherpa-product-bar', 'sherpa-progress-bar',
  'sherpa-progress-step-tracker', 'sherpa-prompt-composer', 'sherpa-proposal-op',
  'sherpa-proposal-preview', 'sherpa-quick-filter-toolbar', 'sherpa-quick-filter',
  'sherpa-scheduler', 'sherpa-section-header', 'sherpa-select-checkbox', 'sherpa-select-group',
  'sherpa-select-radio', 'sherpa-slider', 'sherpa-sparkline', 'sherpa-switch',
  'sherpa-tabs', 'sherpa-tag', 'sherpa-toast', 'sherpa-toolbar', 'sherpa-tooltip',
  'sherpa-transfer-list', 'sherpa-tree', 'sherpa-view-header',
];

test.beforeEach(async ({ page }) => openHarness(page));

test('all components are registered as custom elements', async ({ page }) => {
  const unregistered = await page.evaluate(
    (tags) => tags.filter((t) => !customElements.get(t)),
    TAGS,
  );
  expect(unregistered, `unregistered: ${unregistered.join(', ')}`).toEqual([]);
});

for (const tag of TAGS) {
  test(`${tag} instantiates + renders a shadow root without throwing`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    const result = await page.evaluate(async (t) => {
      const root = document.getElementById('root')!;
      root.innerHTML = '';
      const el = document.createElement(t) as HTMLElement & { rendered?: Promise<void> };
      root.appendChild(el);
      await customElements.whenDefined(t);
      // Give the base class a couple of frames to fetch template + render.
      await el.rendered?.catch(() => {});
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      return {
        hasShadow: !!el.shadowRoot,
        shadowChildCount: el.shadowRoot ? el.shadowRoot.childElementCount : 0,
      };
    }, tag);

    expect(errors, `${tag} threw: ${errors.join(' | ')}`).toEqual([]);
    expect(result.hasShadow, `${tag} has no shadow root`).toBe(true);
    // Every component renders at least one element into its shadow root.
    expect(result.shadowChildCount, `${tag} shadow root is empty`).toBeGreaterThan(0);
  });
}
