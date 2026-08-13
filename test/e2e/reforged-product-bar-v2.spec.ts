import { test, expect } from '@playwright/test';

/**
 * sherpa-product-bar-v2 on the reforged base — the product branding bar. Proves
 * the brand name mirrors data-name, and the base class reflects slot presence to
 * data-has-{nav,actions} so those regions appear.
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
    await import('/dist-reforged/components/sherpa-product-bar-v2/sherpa-product-bar-v2.js');
    await customElements.whenDefined('sherpa-product-bar-v2');
  });
});

type WithRender = HTMLElement & { rendered?: Promise<void> };

test('data-name writes the brand label; role defaults to banner', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-product-bar-v2') as WithRender;
    el.setAttribute('data-name', 'Aileron');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    return {
      name: el.shadowRoot!.querySelector('.name')!.textContent,
      role: el.getAttribute('role'),
    };
  });
  expect(r.name).toBe('Aileron');
  expect(r.role).toBe('banner');
});

test('nav + actions slots reflect data-has-{nav,actions}', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-product-bar-v2') as WithRender;
    el.setAttribute('data-name', 'Aileron');
    el.innerHTML = '<a slot="nav" href="#">Home</a><button slot="actions">Ask</button>';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    await new Promise((res) => setTimeout(res, 0));

    const vis = (sel: string) =>
      getComputedStyle(el.shadowRoot!.querySelector(sel)!).display !== 'none';

    return {
      navAttr: el.hasAttribute('data-has-nav'),
      navVisible: vis('.nav'),
      actionsAttr: el.hasAttribute('data-has-actions'),
      actionsVisible: vis('.actions'),
    };
  });
  expect(r.navAttr).toBe(true);
  expect(r.navVisible).toBe(true);
  expect(r.actionsAttr).toBe(true);
  expect(r.actionsVisible).toBe(true);
});
