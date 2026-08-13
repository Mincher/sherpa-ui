import { test, expect } from '@playwright/test';

/**
 * sherpa-app-header on the reforged base — the top header bar. Proves the title
 * mirrors data-title, and the base class reflects slot presence to
 * data-has-{actions,search} so the regions appear/collapse.
 *
 * The component isn't registered by the harness index, so the spec imports the
 * compiled module to trigger its customElements.define().
 */

const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(
    () => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true,
  );
  await page.evaluate(async () => {
    await import('/dist-reforged/components/sherpa-app-header/sherpa-app-header.js');
    await customElements.whenDefined('sherpa-app-header');
  });
});

type WithRender = HTMLElement & { rendered?: Promise<void> };

test('data-title writes the heading text', async ({ page }) => {
  const title = await page.evaluate(async () => {
    const el = document.createElement('sherpa-app-header') as WithRender;
    el.setAttribute('data-title', 'Dashboards');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    return el.shadowRoot!.querySelector('.title')!.textContent;
  });
  expect(title).toBe('Dashboards');
});

test('actions slot reflects data-has-actions and shows the region', async ({ page }) => {
  const r = await page.evaluate(async () => {
    // Bare — no actions.
    const bare = document.createElement('sherpa-app-header') as WithRender;
    bare.setAttribute('data-title', 'X');
    document.getElementById('root')!.appendChild(bare);
    await bare.rendered;
    await new Promise((res) => setTimeout(res, 0));

    // With actions slotted.
    const full = document.createElement('sherpa-app-header') as WithRender;
    full.setAttribute('data-title', 'Y');
    full.innerHTML = '<button slot="actions">Save</button>';
    document.getElementById('root')!.appendChild(full);
    await full.rendered;
    await new Promise((res) => setTimeout(res, 0));

    const vis = (el: HTMLElement, sel: string) =>
      getComputedStyle(el.shadowRoot!.querySelector(sel)!).display !== 'none';

    return {
      bareAttr: bare.hasAttribute('data-has-actions'),
      bareVisible: vis(bare, '.actions'),
      fullAttr: full.hasAttribute('data-has-actions'),
      fullVisible: vis(full, '.actions'),
    };
  });
  expect(r.bareAttr).toBe(false);
  expect(r.bareVisible).toBe(false);
  expect(r.fullAttr).toBe(true);
  expect(r.fullVisible).toBe(true);
});

test('search slot reflects data-has-search', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-app-header') as WithRender;
    el.innerHTML = '<input slot="search" placeholder="Search" />';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    await new Promise((res) => setTimeout(res, 0));
    return { attr: el.hasAttribute('data-has-search') };
  });
  expect(r.attr).toBe(true);
});
