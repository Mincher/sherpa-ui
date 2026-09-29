import { test, expect, type Page } from '@playwright/test';

/**
 * SAVE A VIEW, on every page — TODO 15. Save on a preset asks for a name; a
 * name another View has gets " - Copy-001"; the reader's Views sit under
 * "Custom views"; Save on the reader's own View asks to save over it; Delete
 * asks, critical, and goes back to the first View. A preset is never saved
 * over or deleted. Runs against the EXAMPLES server (:4200).
 * TRAP T-a-saved-view-is-the-readers-own
 */
const press = (page: Page, act: string) => page.evaluate((a) => {
  const bar = document.querySelector('sherpa-quick-filter-toolbar[data-type="view"]')!;
  bar.shadowRoot!.querySelector<HTMLElement>(`[data-act="${a}"]`)!.shadowRoot!.querySelector<HTMLElement>('button')!.click();
}, act);
const pickMenu = (page: Page, value: string) => page.evaluate(async (v) => {
  const bar = document.querySelector('sherpa-quick-filter-toolbar[data-type="view"]')!;
  bar.shadowRoot!.querySelector<HTMLElement>('[data-act="view-menu"]')!.shadowRoot!.querySelector<HTMLElement>('button')!.click();
  await new Promise((res) => setTimeout(res, 200));
  bar.shadowRoot!.querySelector<HTMLElement>(`.view-menu button[value="${v}"]`)!.click();
}, value);
const answer = (page: Page, id: string, name?: string) => page.evaluate(async ({ id, name }) => {
  const dialog = document.querySelector(`#${id}`)!;
  await new Promise((res) => setTimeout(res, 200));
  const field = dialog.querySelector('sherpa-input-text') as (HTMLElement & { value: string }) | null;
  const asked = { heading: dialog.getAttribute('data-heading'), status: dialog.getAttribute('data-status'), value: field?.value ?? null };
  if (field && name != null) field.value = name;
  const [, ok] = dialog.querySelectorAll('sherpa-container-footer sherpa-button');
  (ok as HTMLElement).shadowRoot!.querySelector<HTMLElement>('button')!.click();
  await new Promise((res) => setTimeout(res, 900));
  return asked;
}, { id, name });
const state = (page: Page) => page.evaluate(() => {
  const provider = document.querySelector('sherpa-provider') as HTMLElement & { view?: string; customView: boolean };
  const bar = document.querySelector('sherpa-quick-filter-toolbar[data-type="view"]')!;
  const menu = bar.shadowRoot!.querySelector('.chip[data-id="view"] sherpa-menu')!;
  const custom = [...menu.querySelectorAll<HTMLElement>('.menu-section, .menu-row')]
    .map((n) => n.textContent?.trim() ?? '');
  return { view: provider.view, custom: provider.customView, marked: bar.hasAttribute('data-custom-view'), rows: custom };
});

test('save, save as, save over and delete a View on Records', async ({ page }) => {
  await page.goto('http://localhost:4200/?context=records');
  await page.waitForFunction(() =>
    !!document.querySelector('#context-root sherpa-data-grid')?.shadowRoot?.querySelector('.row, [role="row"]'));
  await page.waitForTimeout(500);
  const first = await state(page);

  // Save on a PRESET asks for a name.
  await press(page, 'save');
  const named = await answer(page, 'view-name', 'Mine');
  const saved = await state(page);
  // Save view as with a name a View has: " - Copy-001".
  await pickMenu(page, 'save-as');
  await answer(page, 'view-name', 'Mine');
  const copy = await state(page);
  // Save on the reader's OWN View asks to save over it.
  await press(page, 'save');
  const over = await answer(page, 'view-confirm');
  const after = await state(page);
  // Delete: critical, then the first View.
  await pickMenu(page, 'delete');
  const deleted = await answer(page, 'view-confirm');
  const gone = await state(page);

  expect(first).toMatchObject({ custom: false, marked: false });
  expect(named.heading).toBe('Save view as');
  expect(saved).toMatchObject({ view: 'mine', custom: true, marked: true });
  expect(saved.rows.at(-2)).toMatch(/custom views/i);
  expect(saved.rows.at(-1)).toBe('Mine');
  expect(copy.view).toBe('mine-copy-001');
  expect(copy.rows.slice(-3)).toEqual([expect.stringMatching(/custom views/i), 'Mine', 'Mine - Copy-001']);
  expect(over).toMatchObject({ heading: 'Save over “Mine - Copy-001”?', status: null });
  expect(after.view).toBe('mine-copy-001');
  expect(after.rows.filter((r) => r.startsWith('Mine'))).toHaveLength(2);
  expect(deleted).toMatchObject({ heading: 'Delete “Mine - Copy-001”?', status: 'critical' });
  expect(gone).toMatchObject({ view: first.view, custom: false, marked: false });
  expect(gone.rows.filter((r) => r.startsWith('Mine'))).toEqual(['Mine']);
});
