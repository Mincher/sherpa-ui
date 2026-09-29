import { test, expect } from '@playwright/test';

/**
 * SAVE VIEW ASKS IN THE PAGE'S OWN DIALOG — against the EXAMPLES server
 * (:4200). The Dashboard named a saved view with the browser's `prompt()`;
 * it asks through a `sherpa-dialog` now — the SHELL's, for every page, since
 * TODO 15. Will, 2026-09-25. TRAP T-a-saved-view-is-the-readers-own
 */
test('the Dashboard names a saved view in its own dialog, never the browser prompt', async ({ page }) => {
  const native: string[] = [];
  page.on('dialog', (d) => { native.push(d.type()); void d.dismiss(); });
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.goto('http://localhost:4200/?context=dashboard');
  await page.waitForFunction(() => !!document.querySelector('#view-name'));
  await page.waitForTimeout(600);

  const open = () => page.evaluate(() =>
    (document.querySelector('#view-name') as HTMLElement & { open: boolean }).open);
  const button = (n: number) => page.evaluate((i) => (document.querySelectorAll('#view-name sherpa-container-footer sherpa-button')[i]!
    .shadowRoot!.querySelector('button') as HTMLElement).click(), n);
  const save = () => page.evaluate(() => document.querySelector('sherpa-app-shell > sherpa-app-header')!
    .dispatchEvent(new CustomEvent('view-save', { bubbles: true, composed: true })));
  const kept = () => page.evaluate(() => Object.values(localStorage).some((v) => v.includes('Dialog view')));

  // CANCEL saves nothing.
  await save();
  await expect.poll(open).toBe(true);
  await button(0);
  await expect.poll(open).toBe(false);
  expect(await kept()).toBe(false);

  // A NAME is needed: Save with none keeps the dialog open.
  await save();
  await expect.poll(open).toBe(true);
  // The field starts on the View's own name: empty it first.
  await page.evaluate(() => { (document.querySelector('#view-name sherpa-input-text') as HTMLElement & { value: string }).value = ''; });
  await button(1);
  expect(await open()).toBe(true);

  // TYPED, then Enter: saved, and the dialog shuts.
  await expect.poll(() => page.evaluate(() =>
    document.activeElement === document.querySelector('#view-name sherpa-input-text'))).toBe(true);
  await page.keyboard.type('Dialog view');
  await page.keyboard.press('Enter');
  await expect.poll(open).toBe(false);
  await expect.poll(kept).toBe(true);
  expect(native).toEqual([]);

  await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) {
      if (localStorage.getItem(key)?.includes('Dialog view')) localStorage.removeItem(key);
    }
  });
});
