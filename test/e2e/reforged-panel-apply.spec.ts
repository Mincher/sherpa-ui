import { test, expect, type Page } from '@playwright/test';

/**
 * THE PANEL'S APPLY APPLIES EVERYTHING — against the EXAMPLES server (:4200).
 * Will, 2026-09-25: "Apply doesn't apply Custom (or Preset) Conditional
 * Filters at all."
 *
 * Two holes. A preset was relayed with `chip.click()` on the bar's chip — a
 * click on a chip's HOST, which the chip never hears, so nothing turned on.
 * And every other field was STEERED into its bar silently, so the data layer
 * never heard it. Now each preset is steered with `setChipActive`, and each
 * bar the panel steered reports once its menus have stamped.
 * TRAP T-a-silent-write-still-needs-a-way-to-report
 */
const total = (page: Page) => page.evaluate(() =>
  (window as unknown as { sherpa: { source: { debugState(): { total: number } } } })
    .sherpa.source.debugState().total);

async function openPanel(page: Page, before?: () => Promise<void>): Promise<number> {
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.goto('http://localhost:4200/?context=records');
  await page.waitForFunction(() =>
    !!document.querySelector('#context-root sherpa-data-grid')?.shadowRoot?.querySelector('.row, [role="row"]'));
  await expect.poll(() => total(page)).toBeGreaterThan(0);
  await before?.();
  const all = await total(page);
  await page.evaluate(() => document.querySelector('#context-root sherpa-quick-filter-toolbar')!
    .dispatchEvent(new CustomEvent('filter-configure', { bubbles: true, composed: true })));
  await expect(page.locator('#filter-panel .field').first()).toBeVisible();
  return all;
}

const apply = (page: Page) => page.locator('#filter-panel .foot .apply button').click();

test('a preset ticked in the panel is ON after Apply, and OFF after the next', async ({ page }) => {
  const all = await openPanel(page);
  const preset = page.locator('#filter-panel .field[data-field="presets"] .value[data-value="at-risk"]');
  const onBar = () => page.evaluate(() => document.querySelector('#context-root sherpa-quick-filter-toolbar')!
    .shadowRoot!.querySelector('.chip[data-id="at-risk"]')!.hasAttribute('data-current'));

  await preset.locator('.body').click();
  await apply(page);
  await expect.poll(onBar).toBe(true);
  await expect.poll(() => total(page)).toBeLessThan(all);

  await preset.locator('.body').click();
  await apply(page);
  await expect.poll(onBar).toBe(false);
  await expect.poll(() => total(page)).toBe(all);
});

test('a condition typed in a field only the bar holds reaches the data, and stays typed', async ({ page }) => {
  const all = await openPanel(page, async () => {
    // NAME answers with conditions only, and is no field the source owns.
    await page.evaluate(() => (document.querySelector('#context-root sherpa-quick-filter-toolbar') as
      HTMLElement & { addFilters(ids: string[]): void }).addFilters(['name']));
    await page.waitForTimeout(300);
  });
  const field = page.locator('#filter-panel .field[data-field="name"]');
  // `fill`, not a click: WebKit's scroll into a sticky-headed column misplaces
  // a pointer hit, and this is about the answer, not the pointer.
  await field.locator('.condition-row').first().locator('.condition-value input').fill('Ai');
  await apply(page);

  await expect.poll(() => total(page)).toBeLessThan(all);
  // The BAR keeps the text, so its next report cannot clear the filter.
  await expect.poll(() => page.evaluate(() => {
    const menu = document.querySelector('#context-root sherpa-quick-filter-toolbar')!.shadowRoot!
      .querySelector('.chip[data-id="name"] sherpa-menu') as HTMLElement & { conditions: unknown };
    return menu.conditions;
  })).toEqual([{ op: 'contains', text: 'Ai' }]);
  const narrowed = await total(page);
  await page.waitForTimeout(400);
  expect(await total(page)).toBe(narrowed);
});

/**
 * THE OPEN PANEL FOLLOWS THE DATA LAYER. It was filled once, when it opened,
 * so a field another control changed — a chart legend, a column heading — still
 * showed the old answer, and the panel's next Apply put that answer back over
 * the new one: 25 rows went back to 100 with nothing touched in the panel.
 * One FIELD is steered, so a reader's unapplied picks in the others stay.
 * TRAP T-an-open-panel-follows-the-data-layer
 */
test('the open panel follows a field another control changes, and keeps the reader\'s own draft', async ({ page }) => {
  const all = await openPanel(page);
  const ticked = (id: string) => page.evaluate((field) =>
    [...document.querySelector('#filter-panel')!.shadowRoot!
      .querySelectorAll(`.field[data-field="${field}"] .value[data-current]`)]
      .map((c) => (c as HTMLElement).dataset['value']), id);

  // The reader's own DRAFT, not applied.
  await page.locator('#filter-panel .field[data-field="tier"] .value[data-value="Gold"] .body').click();
  // ANOTHER control changes Status, as a legend or a heading would.
  await page.evaluate(() => (window as unknown as {
    sherpa: { source: { select(f: string, v: string[]): void } } }).sherpa.source.select('status', ['trial']));
  await expect.poll(() => ticked('status')).toEqual(['trial']);
  expect(await ticked('tier')).toEqual(['Gold']);
  const narrowed = await total(page);
  expect(narrowed).toBeLessThan(all);

  // DISCARD drops the draft and keeps what the other control set.
  await page.locator('#filter-panel .foot .discard button').click();
  await expect.poll(() => ticked('tier')).toEqual([]);
  expect(await ticked('status')).toEqual(['trial']);

  // APPLY, with nothing touched, changes nothing.
  await apply(page);
  await page.waitForTimeout(400);
  expect(await total(page)).toBe(narrowed);
});
