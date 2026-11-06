import { test, expect } from './harness';
import type { Page } from '@playwright/test';

/**
 * The panel keys: Left Shift and a number opens, or shuts back to its tab, that number's panel of the
 * left areas; Right Shift and a number, the right's; Shift and minus shuts every panel to its tab; Shift and
 * plus opens every tab. TRAP T-the-panel-keys-are-shift-and-a-number
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
const chord = async (page: Page, shift: 'ShiftLeft' | 'ShiftRight', key: string): Promise<void> => {
  await page.keyboard.down(shift);
  await page.keyboard.press(key);
  await page.keyboard.up(shift);
  await page.evaluate(() => window.__settled());
};

test('Left Shift and a number shuts the left panel to its tab, and opens it again; Right Shift names the right', async ({ page }) => {
  await stage(page);
  expect(await tabs(page)).toEqual([false, false, false]);
  await chord(page, 'ShiftLeft', 'Digit1');
  expect(await tabs(page)).toEqual([true, false, false]);
  await chord(page, 'ShiftLeft', 'Digit1');
  expect(await tabs(page)).toEqual([false, false, false]);
  // The right: the second of its panels.
  await chord(page, 'ShiftRight', 'Digit2');
  expect((await tabs(page))[2]).toBe(true);
  // A number with no panel under it does nothing; nor does a plain Shift and Left's number on the right.
  await chord(page, 'ShiftLeft', 'Digit5');
  expect(await tabs(page)).toEqual([false, true, true]);
});

test('Shift and minus shuts every panel to its tab; Shift and plus opens every tab', async ({ page }) => {
  await stage(page);
  await chord(page, 'ShiftLeft', 'Minus');
  expect(await tabs(page)).toEqual([true, true, true]);
  await chord(page, 'ShiftRight', 'Equal');
  expect(await tabs(page)).toEqual([false, false, false]);
});

test('the keys leave a field being typed in alone', async ({ page }) => {
  await stage(page);
  await page.evaluate(() => {
    const input = Object.assign(document.createElement('input'), { id: 'field' });
    document.getElementById('root')!.append(input);
    input.focus();
  });
  await chord(page, 'ShiftLeft', 'Minus');
  expect(await tabs(page)).toEqual([false, false, false]);
});
