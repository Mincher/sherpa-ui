import { test, expect } from '@playwright/test';

/**
 * SAVE VIEW ASKS IN THE PAGE'S OWN DIALOG — against the EXAMPLES server
 * (:4200). The Dashboard named a saved view with the browser's `prompt()`;
 * it asks through a `sherpa-dialog` now, as Save filter does on Records.
 * Will, 2026-09-25.
 */
test('the Dashboard names a saved view in its own dialog, never the browser prompt', async ({ page }) => {
  const native: string[] = [];
  page.on('dialog', (d) => { native.push(d.type()); void d.dismiss(); });
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.goto('http://localhost:4200/?context=dashboard');
  await page.waitForFunction(() => !!document.querySelector('#save-view'));
  await page.waitForTimeout(600);

  const open = () => page.evaluate(() =>
    (document.querySelector('#save-view') as HTMLElement & { open: boolean }).open);
  const save = () => page.evaluate(() => document.querySelector('sherpa-app-shell > sherpa-app-header')!
    .dispatchEvent(new CustomEvent('view-save', { bubbles: true, composed: true })));
  const kept = () => page.evaluate(() => Object.values(localStorage).some((v) => v.includes('Dialog view')));

  // CANCEL saves nothing.
  await save();
  await expect.poll(open).toBe(true);
  await page.evaluate(() => document.querySelector('#save-view-cancel')!.shadowRoot!
    .querySelector('button')!.click());
  await expect.poll(open).toBe(false);
  expect(await kept()).toBe(false);

  // A NAME is needed: Save with none keeps the dialog open.
  await save();
  await expect.poll(open).toBe(true);
  await page.evaluate(() => document.querySelector('#save-view-ok')!.shadowRoot!
    .querySelector('button')!.click());
  expect(await open()).toBe(true);

  // TYPED, then Enter: saved, and the dialog shuts.
  await expect.poll(() => page.evaluate(() =>
    document.activeElement === document.querySelector('#save-view-name'))).toBe(true);
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
