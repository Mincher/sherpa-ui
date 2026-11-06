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
/** The panel opens from its tab as it was set: what the keys do (a press on the tab shows it as an overlay: the next test). */
const openFromTab = async (page: Page): Promise<void> => {
  await page.evaluate(() => (document.getElementById('tabbed') as PanelEl & { minimise(on: boolean): void }).minimise(false));
  await page.evaluate(() => window.__settled());
};
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
  await openFromTab(page);
  expect(await part(page, '.root')).toEqual(open);
});

test('in a shell area the tab gives the area its room back; opened, the panel docks as it was', async ({ page }) => {
  await stage(page, { shell: true });
  expect(await area(page)).toBeGreaterThan(400);
  await press(page, '.minimise');
  expect(await area(page)).toBe(0);
  expect((await part(page, '.tab')).shown).toBe(true);
  await openFromTab(page);
  expect(await area(page)).toBeGreaterThan(400);
});

test('floating, it keeps its box through a minimise', async ({ page }) => {
  await stage(page, { floating: true });
  const before = await part(page, '.root');
  await press(page, '.minimise');
  expect((await part(page, '.tab')).shown).toBe(true);
  await openFromTab(page);
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
  await openFromTab(page);
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

test('the header\'s mode buttons are ONE group with the ends on its first and last shown; the close button has a border; the grip reserves no room', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const make = async (attrs: string[]): Promise<PanelEl> => {
      const el = document.createElement('sherpa-overlay-panel') as PanelEl;
      el.setAttribute('data-heading', 'Peek');
      for (const a of attrs) el.setAttribute(a, '');
      document.getElementById('root')!.replaceChildren(el);
      await el.rendered;
      el.show();
      await window.__settled();
      return el;
    };
    const rr = (el: PanelEl, part: string, side: string): string => getComputedStyle(el.shadowRoot!.querySelector(`.${part}`)!).getPropertyValue(`--sherpa-border-rounding-${side}`).trim();
    const docked = await make(['data-dismissible', 'data-minimisable', 'data-floatable', 'data-external']);
    const group = docked.shadowRoot!.querySelector('.modes')!;
    const titleX = (el: PanelEl): number => Math.round(el.shadowRoot!.querySelector('.header')!.shadowRoot!.querySelector('.title')!.getBoundingClientRect().x - el.shadowRoot!.querySelector('.root')!.getBoundingClientRect().x);
    const out = {
      oneGroup: group.localName === 'sherpa-group' && [...group.children].map((c) => c.className).join(' '),
      first: [rr(docked, 'minimise', 'top-left'), rr(docked, 'minimise', 'top-right')],
      last: [rr(docked, 'external', 'top-left'), rr(docked, 'external', 'top-right')],
      look: docked.shadowRoot!.querySelector('.header')!.shadowRoot!.querySelector('.close')!.getAttribute('data-look'),
      dockedX: titleX(docked),
      floatX: 0,
    };
    const floating = await make(['data-dismissible', 'data-minimisable', 'data-floatable', 'data-external', 'data-floating']);
    out.floatX = titleX(floating);
    return out;
  });
  expect(r.oneGroup).toBe('minimise float pop expand external');
  expect(r.first).toEqual(['4px', '0px']);
  expect(r.last).toEqual(['0px', '4px']);
  expect(r.look).toBe('default');
  // Hidden, the grip takes no room: the title is where it is docked.
  expect(r.floatX).toBe(r.dockedX);
});

test('floating, the grip nudges the title right while the pointer is on the header', async ({ page }) => {
  await stage(page, { floating: true });
  const titleX = () => page.evaluate(() => {
    const sr = document.getElementById('tabbed')!.shadowRoot!;
    return Math.round(sr.querySelector('.header')!.shadowRoot!.querySelector('.title')!.getBoundingClientRect().x - sr.querySelector('.root')!.getBoundingClientRect().x);
  });
  await page.mouse.move(1500, 880);
  const bare = await titleX();
  const bar = await part(page, '.header');
  await page.mouse.move(bar.x + bar.w - 120, bar.y + 4);
  expect(await titleX()).toBeGreaterThan(bare);
  await page.mouse.move(1500, 880);
  expect(await titleX()).toBe(bare);
});

test('opened, the focus is the container\'s, not the grip\'s; Tab goes on to the grip', async ({ page }) => {
  await stage(page, { floating: true });
  const where = () => page.evaluate(() => {
    const sr = document.getElementById('tabbed')!.shadowRoot!;
    return { root: sr.activeElement?.classList.contains('root') ?? false, grip: sr.activeElement?.classList.contains('grip') ?? false };
  });
  expect(await where()).toEqual({ root: true, grip: false });
  await page.keyboard.press('Tab');
  expect((await where()).grip).toBe(true);
});

test('a press on a tab shows its panel as a docked overlay, hover or none; a press outside, or Escape, shuts it to the tab; the docking button docks it', async ({ page }) => {
  await stage(page, { shell: true });
  await page.evaluate(() => document.getElementById('tabbed')!.setAttribute('data-poppable', ''));
  await press(page, '.minimise');
  const state = () => page.evaluate(() => (document.getElementById('tabbed') as HTMLElement & { dockState: string }).dockState);
  expect(await state()).toBe('tab');
  await press(page, '.tab-open');
  expect(await state()).toBe('hover');
  // A press away from it ends the show.
  await page.mouse.click(40, 600);
  await page.evaluate(() => window.__settled());
  expect(await state()).toBe('tab');
  await press(page, '.tab-open');
  expect(await state()).toBe('hover');
  await page.keyboard.press('Escape');
  expect(await state()).toBe('tab');
  // The docking button docks it, open for good.
  await press(page, '.tab-open');
  await press(page, '.pop');
  expect(await state()).toBe('overlay');
});
