import { test, expect } from '@playwright/test';

/**
 * sherpa-panel on the reforged base — a persistent inline <section> card.
 * Proves the header/body/footer slots render (header appears from data-heading
 * as well as a slot), and that data-collapsed hides the body while keeping the
 * header.
 */

const HARNESS = '/test/reforged/harness.html';

type PanelEl = HTMLElement & { rendered?: Promise<void> };

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(
    () => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true,
  );
});

test('renders header (from data-heading) / body / footer regions', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-panel') as PanelEl;
    el.setAttribute('data-heading', 'Overview');
    el.innerHTML = '<p>body</p><div slot="footer">actions</div>';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    await new Promise((res) => setTimeout(res, 0));
    const vis = (sel: string) =>
      getComputedStyle(el.shadowRoot!.querySelector(sel)!).display !== 'none';
    return {
      root: el.shadowRoot!.querySelector('.root')!.tagName.toLowerCase(),
      heading: el.shadowRoot!.querySelector('.heading-text')!.textContent,
      headerVisible: vis('.header'),
      bodyVisible: vis('.body'),
      footerVisible: vis('.footer'),
    };
  });
  expect(r.root).toBe('section'); // semantic inline card
  expect(r.heading).toBe('Overview');
  expect(r.headerVisible).toBe(true);
  expect(r.bodyVisible).toBe(true);
  expect(r.footerVisible).toBe(true);
});

test('data-collapsed hides the body but keeps the header', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-panel') as PanelEl;
    el.setAttribute('data-heading', 'Overview');
    el.setAttribute('data-collapsed', '');
    el.innerHTML = '<p>body</p>';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const vis = (sel: string) =>
      getComputedStyle(el.shadowRoot!.querySelector(sel)!).display !== 'none';
    return { headerVisible: vis('.header'), bodyVisible: vis('.body') };
  });
  expect(r.headerVisible).toBe(true);
  expect(r.bodyVisible).toBe(false);
});
