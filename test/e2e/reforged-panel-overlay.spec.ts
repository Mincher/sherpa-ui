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

test('with hover-open, the pointer on a tab shows its panel as a docked overlay and hides the tab; leaving the panel brings the tab back at once', async ({ page }) => {
  await stage(page, 'data-hover-open data-minimised');
  const shown = () => page.evaluate(() => {
    const sr = document.getElementById('p')!.shadowRoot!;
    return { panel: getComputedStyle(sr.querySelector('.root')!).display !== 'none', tab: getComputedStyle(sr.querySelector('.tab')!).display !== 'none' };
  });
  expect(await shown()).toEqual({ panel: false, tab: true });
  const tab = await page.evaluate(() => { const b = document.getElementById('p')!.shadowRoot!.querySelector('.tab-open')!.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
  await page.mouse.move(tab.x, tab.y);
  await expect.poll(shown).toEqual({ panel: true, tab: false });
  expect(await look(page)).toMatchObject({ shadow: true });
  // The room stays the view's: it is an overlay, not a fixed panel.
  expect(await area(page)).toBe(0);
  // The pointer in the panel keeps it open.
  const inside = await page.evaluate(() => { const b = document.getElementById('p')!.shadowRoot!.querySelector('.body')!.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
  await page.mouse.move(inside.x, inside.y);
  await page.waitForTimeout(500);
  expect((await shown()).panel).toBe(true);
  // Out of it: the tab, at once.
  await page.mouse.move(1300, 780);
  await expect.poll(shown, { timeout: 1000 }).toEqual({ panel: false, tab: true });
});

test('without hover-open, the pointer on a tab opens nothing', async ({ page }) => {
  await stage(page, 'data-minimised');
  const tab = await page.evaluate(() => { const b = document.getElementById('p')!.shadowRoot!.querySelector('.tab-open')!.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
  await page.mouse.move(tab.x, tab.y);
  await page.waitForTimeout(400);
  expect((await look(page)).display).toBe('none');
});

/** The four ways a panel is docked, each with what it is called and how to read it. */
const KINDS = [
  { name: 'fixed in the shell\'s area', slotted: false, attrs: 'data-fixed', flat: true },
  { name: 'an overlay on the window\'s edge', slotted: false, attrs: '', flat: false },
  { name: 'fixed in a canvas\'s area', slotted: true, attrs: '', flat: true },
  { name: 'an overlay on a canvas', slotted: true, attrs: 'data-overlay', flat: false },
] as const;

for (const kind of KINDS) {
  test(`${kind.name}: Pop swaps it, Float lifts it off, and Dock puts it back as it was`, async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 800 });
    await page.evaluate(async ({ slotted, attrs }) => {
      const root = document.getElementById('root')!;
      const panel = `<sherpa-overlay-panel id="p" ${slotted ? 'slot="panel"' : ''} data-heading="P" data-floatable data-poppable data-minimisable ${attrs}><p>body</p></sherpa-overlay-panel>`;
      root.innerHTML = slotted
        ? `<sherpa-layout-canvas id="cv" style="inline-size: 1000px; block-size: 600px">${panel}</sherpa-layout-canvas>`
        : `<sherpa-app-shell></sherpa-app-shell>${panel}`;
      const p = document.getElementById('p') as PanelEl;
      await p.rendered;
      await window.__settled();
      p.show();
      await window.__settled();
    }, { slotted: kind.slotted, attrs: kind.attrs });
    const read = () => page.evaluate(() => {
      const p = document.getElementById('p')!;
      const cs = getComputedStyle(p.shadowRoot!.querySelector('.root')!);
      return { flat: cs.boxShadow === 'none', floating: p.hasAttribute('data-floating'), fixedAttr: p.hasAttribute('data-fixed'), overlayAttr: p.hasAttribute('data-overlay') };
    });
    const before = await read();
    expect(before).toMatchObject({ flat: kind.flat, floating: false });

    // Float, and dock: the same state as before.
    await press(page, '.float');
    expect((await read()).floating).toBe(true);
    await press(page, '.float');
    expect(await read()).toEqual(before);

    // Pop: the other docked state; and float and dock from there returns to THAT one.
    await press(page, '.pop');
    const swapped = await read();
    expect(swapped.flat).toBe(!kind.flat);
    await press(page, '.float');
    expect((await read()).floating).toBe(true);
    await press(page, '.float');
    expect(await read()).toEqual(swapped);

    // And Pop again: back where it began.
    await press(page, '.pop');
    expect(await read()).toEqual(before);
  });
}

for (const kind of KINDS) {
  test(`${kind.name}: as a tab, hover shows it as a docked overlay for now; a press opens it as it was`, async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 800 });
    await page.evaluate(async ({ slotted, attrs }) => {
      const root = document.getElementById('root')!;
      const panel = `<sherpa-overlay-panel id="p" ${slotted ? 'slot="panel"' : ''} data-heading="P" data-floatable data-poppable data-minimisable data-hover-open ${attrs}><p>body</p></sherpa-overlay-panel>`;
      root.innerHTML = slotted
        ? `<sherpa-layout-canvas id="cv" style="inline-size: 1000px; block-size: 600px">${panel}</sherpa-layout-canvas>`
        : `<sherpa-app-shell></sherpa-app-shell>${panel}`;
      const p = document.getElementById('p') as PanelEl & { minimise(on: boolean): void };
      await p.rendered;
      await window.__settled();
      p.show();
      await window.__settled();
      p.minimise(true);
      await window.__settled();
    }, { slotted: kind.slotted, attrs: kind.attrs });
    const root = () => page.evaluate(() => { const cs = getComputedStyle(document.getElementById('p')!.shadowRoot!.querySelector('.root')!); return { shown: cs.display !== 'none', shadow: cs.boxShadow !== 'none' }; });
    expect((await root()).shown).toBe(false);
    const tab = await page.evaluate(() => { const b = document.getElementById('p')!.shadowRoot!.querySelector('.tab-open')!.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
    await page.mouse.move(tab.x, tab.y);
    await expect.poll(async () => (await root()).shown).toBe(true);
    // A docked OVERLAY, whatever it was docked as: over the view, with a shadow. A temporary state: the tab is still a tab.
    expect((await root()).shadow).toBe(true);
    expect(await page.evaluate(() => document.getElementById('p')!.hasAttribute('data-minimised'))).toBe(true);
    // The tab is hidden while it shows. Leaving the panel brings it back; a press on the tab then opens the panel as it was set:
    // fixed stays flat, an overlay stays an overlay.
    expect(await page.evaluate(() => getComputedStyle(document.getElementById('p')!.shadowRoot!.querySelector('.tab')!).display)).toBe('none');
    await page.mouse.move(520, 790);
    await expect.poll(async () => (await root()).shown).toBe(false);
    await page.mouse.move(tab.x, tab.y);
    await expect.poll(async () => (await root()).shown).toBe(true);
    // Keep it open: the Minimise button says so while it peeks.
    expect(await page.evaluate(() => document.getElementById('p')!.shadowRoot!.querySelector('.minimise')!.getAttribute('aria-label'))).toBe('Keep open');
    await press(page, '.minimise');
    expect(await page.evaluate(() => document.getElementById('p')!.hasAttribute('data-minimised'))).toBe(false);
    expect((await root()).shadow).toBe(!kind.flat);
  });
}
