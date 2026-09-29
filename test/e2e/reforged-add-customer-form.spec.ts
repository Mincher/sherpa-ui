import { test, expect } from '@playwright/test';

/**
 * THE ADD CUSTOMER DIALOG IS A FORM: Save with a required field empty saves
 * nothing, and the field says why. It used to fill the blanks in — "New
 * customer", a made-up email. TODO 61, TRAP T-a-form-value-follows-every-write
 *
 * Runs against the EXAMPLES server (:4200).
 */
test('Save with Name and Email empty saves nothing; filled in, it saves', async ({ page }) => {
  await page.goto('http://localhost:4200/?context=records');
  await page.waitForFunction(() =>
    !!document.querySelector('#context-root sherpa-data-grid')?.shadowRoot?.querySelector('.row, [role="row"]'));
  const total = () => page.evaluate(async () => {
    const { customerStore } = await import('/contexts/records-data.js');
    return (await customerStore.load()).total;
  });
  const before = await total();
  const press = (id: string) => page.evaluate((sel) => {
    document.querySelector(sel)!.dispatchEvent(new CustomEvent('button-click', { bubbles: true, composed: true }));
  }, id);

  await press('#add-btn');
  await expect.poll(() => page.evaluate(() =>
    (document.querySelector('#dialog') as HTMLElement & { open: boolean }).open)).toBe(true);
  await press('#save-btn');
  const refused = await page.evaluate(() => ({
    open: (document.querySelector('#dialog') as HTMLElement & { open: boolean }).open,
    valid: (document.querySelector('#customer-form') as HTMLFormElement).checkValidity(),
    name: (document.querySelector('#f-name') as HTMLElement & { checkValidity(): boolean }).checkValidity(),
  }));
  expect(refused).toEqual({ open: true, valid: false, name: false });
  expect(await total()).toBe(before);

  await page.evaluate(() => {
    (document.querySelector('#f-name') as HTMLElement & { value: string }).value = 'Form Person';
    (document.querySelector('#f-email') as HTMLElement & { value: string }).value = `form.${Date.now()}@example.com`;
  });
  await press('#save-btn');
  await expect.poll(total).toBe(before + 1);
  expect(await page.evaluate(() =>
    (document.querySelector('#dialog') as HTMLElement & { open: boolean }).open)).toBe(false);
});
