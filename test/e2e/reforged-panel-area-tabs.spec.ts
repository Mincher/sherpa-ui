import { test, expect } from './harness';
import type { Page } from '@playwright/test';

/**
 * A panel area holds two panels, stacked top and bottom and both shown; it writes a mode on both (minimising one
 * minimises the area's), and floating one floats only it, the other taking the whole area; docking it back
 * stacks them again. TRAP T-an-area-holds-two-panels-stacked
 */
type PanelEl = HTMLElement & { rendered?: Promise<void>; show(): void };

async function stage(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    const shell = document.createElement('sherpa-app-shell');
    shell.style.blockSize = '900px';
    const panels = ['one', 'two'].map((id) => {
      const p = document.createElement('sherpa-overlay-panel') as PanelEl;
      p.id = id;
      p.setAttribute('data-heading', id.toUpperCase());
      p.setAttribute('data-minimisable', '');
      p.setAttribute('data-floatable', '');
      p.innerHTML = `<p>${id}</p>`;
      shell.append(p);
      return p;
    });
    root.replaceChildren(shell);
    for (const p of panels) { await p.rendered; await window.__settled(); p.show(); await window.__settled(); }
  });
}

/** What the area draws: each panel's card, its mode, and the area's width. */
const area = (page: Page) => page.evaluate(() => {
  const layout = document.querySelector('sherpa-app-shell')!.shadowRoot!.querySelector('sherpa-layout-panels')!;
  const sr = layout.shadowRoot!;
  const cards = Object.fromEntries(['one', 'two'].map((id) => {
    const p = document.getElementById(id)!;
    const r = p.shadowRoot!.querySelector('.root')!.getBoundingClientRect();
    return [id, { mode: p.getAttribute('data-mode'), slot: p.slot, shown: getComputedStyle(p.shadowRoot!.querySelector('.root')!).display !== 'none', y: Math.round(r.y), h: Math.round(r.height) }];
  }));
  return { cards, width: Math.round(sr.querySelector('.area-end')!.getBoundingClientRect().width), tabRow: !!sr.querySelector('.tabs-end') };
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

test('two panels share the area stacked, both shown, no tab row; a mode asked of one is written on both', async ({ page }) => {
  await stage(page);
  const a = await area(page);
  expect(a.tabRow).toBe(false);
  expect(a.cards['one']).toMatchObject({ mode: null, slot: 'panel-end', shown: true });
  expect(a.cards['two']).toMatchObject({ mode: null, slot: 'panel-end', shown: true });
  expect(a.cards['two']!.y).toBeGreaterThan(a.cards['one']!.y + a.cards['one']!.h - 1);
  expect(a.cards['one']!.h).toBe(a.cards['two']!.h);
  expect(a.width).toBeGreaterThanOrEqual(400);
});

test('minimising one minimises the area\'s; opening one opens them both', async ({ page }) => {
  await stage(page);
  await click(page, '.minimise', 'two');
  let a = await area(page);
  expect(a.width).toBe(40);
  expect([a.cards['one']!.mode, a.cards['two']!.mode]).toEqual(['tab', 'tab']);
  // The panel's own API (the keys do this) asks the area, which opens them both, as they were.
  await page.evaluate(() => (document.getElementById('one') as HTMLElement & { minimise(on: boolean): void }).minimise(false));
  await page.evaluate(() => window.__settled());
  a = await area(page);
  expect([a.cards['one']!.mode, a.cards['two']!.mode]).toEqual(['fixed', 'fixed']);
  expect(a.width).toBeGreaterThanOrEqual(400);
});

test('floating one floats only it; the other takes the area; docking puts it back, stacked', async ({ page }) => {
  await stage(page);
  const before = await area(page);
  await click(page, '.float', 'two');
  let a = await area(page);
  expect(a.cards['two']).toMatchObject({ mode: 'floating', slot: 'panel-float' });
  expect(a.cards['one']).toMatchObject({ slot: 'panel-end', shown: true });
  expect(a.cards['one']!.h).toBeGreaterThan(before.cards['one']!.h);
  expect(a.width).toBeGreaterThanOrEqual(400);
  await click(page, '.float', 'two');
  a = await area(page);
  expect(a.cards['two']).toMatchObject({ mode: 'fixed', slot: 'panel-end' });
  expect(a.cards['one']!.h).toBe(a.cards['two']!.h);
});
