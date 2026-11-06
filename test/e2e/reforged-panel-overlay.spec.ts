import { test, expect } from './harness';
import type { Page } from '@playwright/test';

/**
 * A panel is FIXED (flat, in its area's room) or an OVERLAY docked on the content (over the view, with a shadow and
 * rounding): Pop toggles them in every panel, and a tab may open its panel as an overlay while the pointer is on it.
 * TRAP T-a-panel-peeks-from-its-tab
 */
type PanelEl = HTMLElement & { rendered?: Promise<void>; show(): void };

async function stage(page: Page, attrs = ''): Promise<void> {
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.evaluate(async (a) => {
    const root = document.getElementById('root')!;
    root.innerHTML = `<sherpa-layout-canvas id="cv" style="inline-size: 1000px; block-size: 600px">
      <sherpa-overlay-panel id="p" slot="panel" data-heading="Nodes" data-minimisable data-poppable ${a}><p>body</p></sherpa-overlay-panel>
    </sherpa-layout-canvas>`;
    const panel = document.getElementById('p') as PanelEl;
    await panel.rendered;
    await window.__settled();
    panel.show();
    await window.__settled();
  }, attrs);
}
/** The width the content has: all of the layout's, but what a fixed panel takes. */
const area = (page: Page) => page.evaluate(() => 1000 - Math.round(document.getElementById('cv')!.shadowRoot!.querySelector('sherpa-layout-panels')!.shadowRoot!.querySelector('.content')!.getBoundingClientRect().width));
const look = (page: Page) => page.evaluate(() => {
  const cs = getComputedStyle(document.getElementById('p')!.shadowRoot!.querySelector('.root')!);
  return { shadow: cs.boxShadow !== 'none', radius: cs.borderTopLeftRadius !== '0px' || cs.borderTopRightRadius !== '0px', display: cs.display };
});
const press = async (page: Page, sel: string): Promise<void> => {
  const r = await page.evaluate((s) => { const b = document.getElementById('p')!.shadowRoot!.querySelector(s)!.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; }, sel);
  await page.mouse.click(r.x, r.y);
  await page.evaluate(() => window.__settled());
};

test('fixed is flat and takes its area\'s room; Pop makes it an overlay over the view, with a shadow, and gives the room back', async ({ page }) => {
  await stage(page);
  expect(await area(page)).toBeGreaterThan(200);
  expect(await look(page)).toMatchObject({ shadow: false, radius: false });
  await press(page, '.pop');
  expect(await area(page)).toBe(0);
  expect(await look(page)).toMatchObject({ shadow: true, radius: true, display: 'flex' });
  expect(await page.evaluate(() => document.getElementById('p')!.hasAttribute('data-overlay'))).toBe(true);
  // Pop again: fixed, flat, its room back.
  await press(page, '.pop');
  expect(await area(page)).toBeGreaterThan(200);
  expect(await look(page)).toMatchObject({ shadow: false, radius: false });
});

test('the Pop button says what it will do: Pop out from fixed, Pop in from an overlay', async ({ page }) => {
  await stage(page);
  const label = () => page.evaluate(() => document.getElementById('p')!.shadowRoot!.querySelector('.pop')!.getAttribute('aria-label'));
  expect(await label()).toBe('Pop out');
  await press(page, '.pop');
  expect(await label()).toBe('Pop in');
});

test('with hover-open, the pointer on a tab opens its panel as a docked overlay, and leaving shuts it to the tab', async ({ page }) => {
  await stage(page, 'data-hover-open data-minimised');
  const shown = () => page.evaluate(() => getComputedStyle(document.getElementById('p')!.shadowRoot!.querySelector('.root')!).display !== 'none');
  expect(await shown()).toBe(false);
  const tab = await page.evaluate(() => { const b = document.getElementById('p')!.shadowRoot!.querySelector('.tab-open')!.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
  await page.mouse.move(tab.x, tab.y);
  await expect.poll(shown).toBe(true);
  expect(await look(page)).toMatchObject({ shadow: true });
  // The room stays the view's: it is an overlay, not a fixed panel.
  expect(await area(page)).toBe(0);
  await page.mouse.move(1300, 700);
  await expect.poll(shown).toBe(false);
});

test('without hover-open, the pointer on a tab opens nothing', async ({ page }) => {
  await stage(page, 'data-minimised');
  const tab = await page.evaluate(() => { const b = document.getElementById('p')!.shadowRoot!.querySelector('.tab-open')!.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
  await page.mouse.move(tab.x, tab.y);
  await page.waitForTimeout(400);
  expect((await look(page)).display).toBe('none');
});
