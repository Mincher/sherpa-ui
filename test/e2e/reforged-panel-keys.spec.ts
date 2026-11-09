import { test, expect } from './harness';
import type { Page } from '@playwright/test';

/**
 * The panel keys: Left Shift and a number names that number's panel of the left area (a tab opens, a panel shown takes
 * the focus); Right Shift and a number, the right's; Shift and minus shuts the first or focused panel back to a
 * tab, and its area's with it, Shift and plus opens one; Ctrl and Shift and minus, or plus, shuts or opens every panel and tab.
 * TRAP T-the-panel-keys-are-shift-and-a-number
 */
type PanelEl = HTMLElement & { rendered?: Promise<void>; show(): void };

async function stage(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    const shell = document.createElement('sherpa-app-shell');
    shell.style.blockSize = '900px';
    const make = (id: string, fixed: string): PanelEl => {
      const p = document.createElement('sherpa-overlay-panel') as PanelEl;
      p.id = id;
      p.setAttribute('data-heading', id);
      if (fixed === 'start') p.setAttribute('data-side', 'start');
      p.setAttribute('data-minimisable', '');
      p.innerHTML = `<p>${id}</p>`;
      return p;
    };
    const panels = [make('l1', 'start'), make('r1', ''), make('r2', '')];
    shell.append(...panels);
    root.replaceChildren(shell);
    for (const p of panels) { await p.rendered; await window.__settled(); p.show(); await window.__settled(); }
  });
}
const tabs = (page: Page) => page.evaluate(() => ['l1', 'r1', 'r2'].map((id) => document.getElementById(id)!.getAttribute('data-mode') === 'tab'));
const chord = async (page: Page, shift: 'ShiftLeft' | 'ShiftRight', key: string, ctrl = false): Promise<void> => {
  // Ctrl is Cmd on a Mac.
  const mod = await page.evaluate(() => (/mac|iphone|ipad/i.test(navigator.platform) ? 'Meta' : 'Control'));
  if (ctrl) await page.keyboard.down(mod);
  await page.keyboard.down(shift);
  await page.keyboard.press(key);
  await page.keyboard.up(shift);
  if (ctrl) await page.keyboard.up(mod);
  await page.evaluate(() => window.__settled());
};
/** The panel the focus is in. */
const focused = (page: Page) => page.evaluate(() => document.activeElement?.id ?? null);

test('Shift and a number names a panel of that Shift\'s side: a panel shown takes the focus, a tab opens, and its area\'s opens with it', async ({ page }) => {
  await stage(page);
  await chord(page, 'ShiftRight', 'Digit1');
  expect(await focused(page)).toBe('r1');
  await chord(page, 'ShiftRight', 'Digit2');
  expect(await focused(page)).toBe('r2');
  // It never shuts: that is Shift and minus.
  expect(await tabs(page)).toEqual([false, false, false]);
  // The left area holds one panel, and has no second.
  await chord(page, 'ShiftLeft', 'Digit2');
  expect(await tabs(page)).toEqual([false, false, false]);
  // Shut to tabs (the button shuts its area's), and a number opens them, both.
  await page.evaluate(() => (document.getElementById('r1') as HTMLElement & { minimise(on: boolean): void }).minimise(true));
  expect(await tabs(page)).toEqual([false, true, true]);
  await chord(page, 'ShiftRight', 'Digit2');
  expect(await tabs(page)).toEqual([false, false, false]);
  // The left's own, once it is a tab.
  await page.evaluate(() => (document.getElementById('l1') as HTMLElement & { minimise(on: boolean): void }).minimise(true));
  await chord(page, 'ShiftLeft', 'Digit1');
  expect((await tabs(page))[0]).toBe(false);
  // A number with no panel does nothing.
  await chord(page, 'ShiftLeft', 'Digit5');
  expect(await tabs(page)).toEqual([false, false, false]);
});

test('Shift and minus shuts the first panel of that Shift\'s side back to a tab; Shift and plus opens it', async ({ page }) => {
  await stage(page);
  await chord(page, 'ShiftLeft', 'Minus');
  expect(await tabs(page)).toEqual([true, false, false]);
  await chord(page, 'ShiftLeft', 'Equal');
  expect(await tabs(page)).toEqual([false, false, false]);
  // The right: shutting one shuts its area's, as the button does; opening one opens them.
  await chord(page, 'ShiftRight', 'Minus');
  expect(await tabs(page)).toEqual([false, true, true]);
  await chord(page, 'ShiftRight', 'Equal');
  expect(await tabs(page)).toEqual([false, false, false]);
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
