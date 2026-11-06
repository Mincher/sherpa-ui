import { test, expect } from './harness';
import type { Page } from '@playwright/test';

/**
 * The panel keys: Left Shift and a number brings that number's panel of the left areas to the fore (a tab
 * opens); Right Shift and a number, the right's; Shift and minus shuts the front or focused panel back to a
 * tab, Shift and plus opens one; Ctrl and Shift and minus, or plus, shuts or opens every panel and tab.
 * TRAP T-the-panel-keys-are-shift-and-a-number
 */
type PanelEl = HTMLElement & { rendered?: Promise<void>; show(): void };

async function stage(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    const shell = document.createElement('sherpa-app-shell');
    const make = (id: string, fixed: string): PanelEl => {
      const p = document.createElement('sherpa-overlay-panel') as PanelEl;
      p.id = id;
      p.setAttribute('data-heading', id);
      p.setAttribute('data-fixed', fixed);
      p.setAttribute('data-minimisable', '');
      p.innerHTML = `<p>${id}</p>`;
      return p;
    };
    const panels = [make('l1', 'start'), make('r1', ''), make('r2', '')];
    root.replaceChildren(shell, ...panels);
    for (const p of panels) { await p.rendered; await window.__settled(); p.show(); await window.__settled(); }
  });
}
const tabs = (page: Page) => page.evaluate(() => ['l1', 'r1', 'r2'].map((id) => document.getElementById(id)!.hasAttribute('data-minimised')));
const chord = async (page: Page, shift: 'ShiftLeft' | 'ShiftRight', key: string, ctrl = false): Promise<void> => {
  if (ctrl) await page.keyboard.down('Control');
  await page.keyboard.down(shift);
  await page.keyboard.press(key);
  await page.keyboard.up(shift);
  if (ctrl) await page.keyboard.up('Control');
  await page.evaluate(() => window.__settled());
};
/** The panel drawn in front of the right area: the one the area marks. */
const front = (page: Page) => page.evaluate(() => ['r1', 'r2'].filter((id) => document.getElementById(id)!.hasAttribute('data-current')));

test('Shift and a number is the tab\'s place: a docked panel in a tabbed area comes to the fore, a tab opens, a panel alone has none', async ({ page }) => {
  await stage(page);
  expect(await front(page)).toEqual(['r2']);
  await chord(page, 'ShiftRight', 'Digit1');
  expect(await front(page)).toEqual(['r1']);
  await chord(page, 'ShiftRight', 'Digit2');
  expect(await front(page)).toEqual(['r2']);
  // Again: still in front, not a tab. Nothing shuts by a number.
  await chord(page, 'ShiftRight', 'Digit2');
  expect(await tabs(page)).toEqual([false, false, false]);
  // The left panel is alone in its area: no tab, so no number.
  await chord(page, 'ShiftLeft', 'Digit1');
  expect(await tabs(page)).toEqual([false, false, false]);
  // Shut to tabs (the button shuts its area's), and a tab opens by its place among the edge's.
  await page.evaluate(() => (document.getElementById('r1') as HTMLElement & { minimise(on: boolean): void }).minimise(true));
  expect(await tabs(page)).toEqual([false, true, true]);
  await chord(page, 'ShiftRight', 'Digit2');
  expect(await tabs(page)).toEqual([false, true, false]);
  // The left's own, once it is a tab.
  await page.evaluate(() => (document.getElementById('l1') as HTMLElement & { minimise(on: boolean): void }).minimise(true));
  await chord(page, 'ShiftLeft', 'Digit1');
  expect((await tabs(page))[0]).toBe(false);
  // A number with no tab does nothing.
  await chord(page, 'ShiftLeft', 'Digit5');
  expect(await tabs(page)).toEqual([false, true, false]);
});

test('Shift and minus shuts the front panel of that Shift\'s side back to a tab; Shift and plus opens it', async ({ page }) => {
  await stage(page);
  await chord(page, 'ShiftLeft', 'Minus');
  expect(await tabs(page)).toEqual([true, false, false]);
  await chord(page, 'ShiftLeft', 'Equal');
  expect(await tabs(page)).toEqual([false, false, false]);
  // The right: shutting one shuts its area's, as the button does.
  await chord(page, 'ShiftRight', 'Minus');
  expect(await tabs(page)).toEqual([false, true, true]);
  await chord(page, 'ShiftRight', 'Equal');
  expect((await tabs(page)).slice(1).some(Boolean)).toBe(true);
});

test('Ctrl and Shift and minus shuts every panel and tab; Ctrl and Shift and plus opens them all', async ({ page }) => {
  await stage(page);
  await chord(page, 'ShiftLeft', 'Minus', true);
  expect(await tabs(page)).toEqual([true, true, true]);
  await chord(page, 'ShiftRight', 'Equal', true);
  expect(await tabs(page)).toEqual([false, false, false]);
});

test('the keys leave a field being typed in alone', async ({ page }) => {
  await stage(page);
  await page.evaluate(() => {
    const input = Object.assign(document.createElement('input'), { id: 'field' });
    document.getElementById('root')!.append(input);
    input.focus();
  });
  await chord(page, 'ShiftLeft', 'Minus', true);
  expect(await tabs(page)).toEqual([false, false, false]);
});
