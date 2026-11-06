import { test, expect } from './harness';
import type { Page } from '@playwright/test';

/**
 * A minimised panel is a TAB on the edge of its area, turned on its side: docked, in a shell's
 * area, or floating. Pressed, it opens as it was. A change while it is a tab turns it active,
 * with a "!". TRAP T-a-minimised-panel-is-a-tab
 */

type PanelEl = HTMLElement & { rendered?: Promise<void>; show(): void; notify(): void };

async function stage(page: Page, opts: { shell?: boolean; floating?: boolean } = {}): Promise<void> {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.evaluate(async ({ shell, floating }) => {
    const root = document.getElementById('root')!;
    const panel = document.createElement('sherpa-overlay-panel') as PanelEl;
    panel.id = 'tabbed';
    panel.setAttribute('data-heading', 'Details');
    panel.setAttribute('data-minimisable', '');
    panel.setAttribute('data-floatable', '');
    panel.innerHTML = '<p>body</p>';
    if (shell) {
      panel.setAttribute('data-fixed', '');
      root.replaceChildren(document.createElement('sherpa-app-shell'), panel);
    } else root.replaceChildren(panel);
    if (floating) panel.setAttribute('data-floating', '');
    await panel.rendered;
    await window.__settled();
    panel.show();
    await window.__settled();
  }, opts);
}

const part = (page: Page, sel: string) => page.evaluate((s) => {
  const el = document.getElementById('tabbed')!.shadowRoot!.querySelector(s)!;
  const r = el.getBoundingClientRect();
  return { shown: getComputedStyle(el).display !== 'none', x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
}, sel);
const press = async (page: Page, sel: string): Promise<void> => {
  const r = await part(page, sel);
  await page.mouse.click(r.x + r.w / 2, r.y + r.h / 2);
  await page.evaluate(() => window.__settled());
};
const area = (page: Page) => page.evaluate(() =>
  Math.round(document.querySelector('sherpa-app-shell')!.shadowRoot!.querySelector('sherpa-layout-panels')!.shadowRoot!.querySelector('.area-end')!.getBoundingClientRect().width));

test('Minimise turns the panel into a tall tab on the right edge; the tab opens it again', async ({ page }) => {
  await stage(page);
  const open = await part(page, '.root');
  expect(open.shown).toBe(true);
  await press(page, '.minimise');
  expect((await part(page, '.root')).shown).toBe(false);
  const tab = await part(page, '.tab');
  expect(tab.shown).toBe(true);
  expect(tab.h).toBeGreaterThan(tab.w);
  expect(tab.x + tab.w).toBe(1600);
  await press(page, '.tab');
  expect(await part(page, '.root')).toEqual(open);
});

test('in a shell area the tab gives the area its room back; opened, the panel docks as it was', async ({ page }) => {
  await stage(page, { shell: true });
  expect(await area(page)).toBeGreaterThan(400);
  await press(page, '.minimise');
  expect(await area(page)).toBe(0);
  expect((await part(page, '.tab')).shown).toBe(true);
  await press(page, '.tab');
  expect(await area(page)).toBeGreaterThan(400);
});

test('floating, it keeps its box through a minimise', async ({ page }) => {
  await stage(page, { floating: true });
  const before = await part(page, '.root');
  await press(page, '.minimise');
  expect((await part(page, '.tab')).shown).toBe(true);
  await press(page, '.tab');
  expect(await part(page, '.root')).toEqual(before);
});

test('a new title while it is a tab makes it active with a "!"; opening clears it', async ({ page }) => {
  await stage(page);
  await press(page, '.minimise');
  expect((await part(page, '.tab-mark')).shown).toBe(false);
  await page.evaluate(() => document.getElementById('tabbed')!.setAttribute('data-heading', 'Other'));
  await page.evaluate(() => window.__settled());
  expect((await part(page, '.tab-mark')).shown).toBe(true);
  expect(await page.evaluate(() => document.getElementById('tabbed')!.hasAttribute('data-updated'))).toBe(true);
  await press(page, '.tab');
  expect(await page.evaluate(() => document.getElementById('tabbed')!.hasAttribute('data-updated'))).toBe(false);
});

test('shut and shown again, a minimised panel comes back as a tab: its state is kept', async ({ page }) => {
  await stage(page);
  await press(page, '.minimise');
  await page.evaluate(() => (document.getElementById('tabbed') as PanelEl & { hide(): void }).hide());
  expect((await part(page, '.tab')).shown).toBe(false);
  await page.evaluate(() => (document.getElementById('tabbed') as PanelEl).show());
  await page.evaluate(() => window.__settled());
  expect((await part(page, '.tab')).shown).toBe(true);
  expect((await part(page, '.root')).shown).toBe(false);
});
