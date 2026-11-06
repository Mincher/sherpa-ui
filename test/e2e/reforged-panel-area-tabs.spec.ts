import { test, expect } from './harness';
import type { Page } from '@playwright/test';

/**
 * A panel area with two panels open draws a tab each down its inner edge; a tab swaps to its panel;
 * minimising one minimises the area's; floating one floats only it; docking it puts it back as the
 * active tab. TRAP T-an-area-with-two-panels-is-tabbed
 */
type PanelEl = HTMLElement & { rendered?: Promise<void>; show(): void };

async function stage(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    const shell = document.createElement('sherpa-app-shell');
    const panels = ['one', 'two'].map((id) => {
      const p = document.createElement('sherpa-overlay-panel') as PanelEl;
      p.id = id;
      p.setAttribute('data-heading', id.toUpperCase());
      p.setAttribute('data-fixed', '');
      p.setAttribute('data-minimisable', '');
      p.setAttribute('data-floatable', '');
      p.innerHTML = `<p>${id}</p>`;
      return p;
    });
    root.replaceChildren(shell, ...panels);
    for (const p of panels) { await p.rendered; await window.__settled(); p.show(); await window.__settled(); }
  });
}

const area = (page: Page) => page.evaluate(() => {
  const layout = document.querySelector('sherpa-app-shell')!.shadowRoot!.querySelector('sherpa-layout-panels')!;
  const sr = layout.shadowRoot!;
  // The row shows only while two are open.
  const row = sr.querySelector('.tabs-end')!;
  const tabs = getComputedStyle(row).display === 'none' ? [] : [...row.querySelectorAll('.tab')].map((t) => ({ label: t.textContent, on: t.hasAttribute('data-current') }));
  const drawn = ['one', 'two'].filter((id) => {
    const p = document.getElementById(id)!;
    return p.slot === 'panel-end' && p.hasAttribute('data-current') && getComputedStyle(p).display !== 'none';
  });
  return { tabs, drawn, width: Math.round(sr.querySelector('.area-end')!.getBoundingClientRect().width) };
});
const rectOf = (page: Page, sel: string, id?: string) => page.evaluate(([s, i]) => {
  const root = i ? document.getElementById(i)!.shadowRoot! : document.querySelector('sherpa-app-shell')!.shadowRoot!.querySelector('sherpa-layout-panels')!.shadowRoot!;
  const r = root.querySelector(s!)!.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
}, [sel, id ?? '']);
const click = async (page: Page, sel: string, id?: string): Promise<void> => {
  const p = await rectOf(page, sel, id);
  await page.mouse.click(p.x, p.y);
  await page.evaluate(() => window.__settled());
};

test('two docked panels share the area, a tab each; a tab swaps to its panel; the last docked is in front', async ({ page }) => {
  await stage(page);
  const a = await area(page);
  expect(a.tabs).toEqual([{ label: 'ONE', on: false }, { label: 'TWO', on: true }]);
  expect(a.drawn).toEqual(['two']);
  expect(a.width).toBeGreaterThan(400);
  await click(page, '.tabs-end .tab:first-child');
  expect((await area(page)).drawn).toEqual(['one']);
});

test('minimising one minimises the area\'s; a tab restores its own panel', async ({ page }) => {
  await stage(page);
  await click(page, '.minimise', 'two');
  const a = await area(page);
  expect(a.width).toBe(0);
  expect(await page.evaluate(() => ['one', 'two'].map((id) => document.getElementById(id)!.hasAttribute('data-minimised')))).toEqual([true, true]);
  await click(page, '.tab', 'one');
  expect((await area(page)).drawn).toEqual(['one']);
  expect(await page.evaluate(() => document.getElementById('two')!.hasAttribute('data-minimised'))).toBe(true);
});

test('floating one floats only it; docking puts it back as the active tab', async ({ page }) => {
  await stage(page);
  await click(page, '.float', 'two');
  let a = await area(page);
  expect(a.tabs).toEqual([]);
  expect(a.drawn).toEqual(['one']);
  expect(a.width).toBeGreaterThan(400);
  expect(await page.evaluate(() => document.getElementById('two')!.slot)).toBe('');
  await click(page, '.float', 'two');
  a = await area(page);
  expect(a.tabs).toEqual([{ label: 'ONE', on: false }, { label: 'TWO', on: true }]);
  expect(a.drawn).toEqual(['two']);
});

test('in tab mode the edge facing the canvas is a thin line you can see: the Style border, drawn over the tab row', async ({ page }) => {
  await stage(page);
  await page.evaluate(() => { document.body.style.background = 'rgb(255, 0, 255)'; });
  const edge = await page.evaluate(() => {
    const layout = document.querySelector('sherpa-app-shell')!.shadowRoot!.querySelector('sherpa-layout-panels')!;
    const area = layout.shadowRoot!.querySelector('.area-end')!;
    const cs = getComputedStyle(area, '::after');
    return { x: Math.round(area.getBoundingClientRect().x), y: Math.round(area.getBoundingClientRect().y), width: cs.borderInlineStartWidth, colour: cs.borderInlineStartColor, style: cs.borderInlineStartStyle };
  });
  expect(edge).toMatchObject({ width: '1px', colour: 'rgb(179, 179, 195)', style: 'solid' });
  // Drawn: the pixel on the edge is the line's grey, not the panel's white.
  const shot = await page.screenshot({ clip: { x: edge.x, y: edge.y + 8, width: 1, height: 1 } });
  const px = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d')!;
    c.drawImage(img, 0, 0);
    return [...c.getImageData(0, 0, 1, 1).data].slice(0, 3);
  }, shot.toString('base64'));
  expect(Math.max(...px)).toBeLessThan(215);
});
