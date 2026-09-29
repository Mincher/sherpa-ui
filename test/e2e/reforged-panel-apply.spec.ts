import { test, expect, type Page } from '@playwright/test';

/**
 * THE PANEL APPLIES AS IT IS CHANGED — against the EXAMPLES server (:4200).
 * No footer (Will, 2026-09-27, TODO 62): a field's answer goes into the Query
 * the moment it changes, and the Query draws the bars. A preset is the bar's
 * own on/off chip, so it is steered with `setChipActive` and the bar reports.
 * TRAP T-a-silent-write-still-needs-a-way-to-report · TRAP T-the-panel-reports-its-own-reading
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
  await page.evaluate(() => document.querySelector('#context-root sherpa-quick-filter-toolbar [data-filter-mode]')!
    .dispatchEvent(new CustomEvent('button-click', { bubbles: true, composed: true })));
  await expect(page.locator('#filter-panel .field').first()).toBeVisible();
  return all;
}

test('a preset ticked in the panel is ON at once, and OFF at the next tick', async ({ page }) => {
  const all = await openPanel(page);
  const preset = page.locator('#filter-panel .field[data-field="presets"] .value[data-value="at-risk"]');
  const onBar = () => page.evaluate(() => document.querySelector('#context-root sherpa-quick-filter-toolbar')!
    .shadowRoot!.querySelector('.chip[data-id="at-risk"]')!.hasAttribute('data-current'));

  await preset.locator('.body').click();
  await expect.poll(onBar).toBe(true);
  await expect.poll(() => total(page)).toBeLessThan(all);

  await preset.locator('.body').click();
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
 * showed the old answer. One FIELD is drawn, so the reader's own answer in
 * another field stays. TRAP T-an-open-panel-follows-the-data-layer
 */
test('the open panel follows a field another control changes, and keeps the reader\'s own answer', async ({ page }) => {
  const all = await openPanel(page);
  const ticked = (id: string) => page.evaluate((field) =>
    [...document.querySelector('#filter-panel')!.shadowRoot!
      .querySelectorAll(`.field[data-field="${field}"] .value[data-current]`)]
      .map((c) => (c as HTMLElement).dataset['value']), id);

  // The reader's own answer, applied as it is ticked.
  await page.locator('#filter-panel .field[data-field="tier"] .value[data-value="Gold"] .body').click();
  await expect.poll(() => total(page)).toBeLessThan(all);
  const gold = await total(page);
  // ANOTHER control changes Status, as a legend or a heading would.
  await page.evaluate(() => (window as unknown as {
    sherpa: { source: { select(f: string, v: string[]): void } } }).sherpa.source.select('status', ['trial']));
  await expect.poll(() => ticked('status')).toEqual(['trial']);
  expect(await ticked('tier')).toEqual(['Gold']);
  await expect.poll(() => total(page)).toBeLessThan(gold);
  const both = await total(page);
  await page.waitForTimeout(400);
  expect(await total(page)).toBe(both);
});

/**
 * WILL'S STEPS: Owner by a condition, then a SECOND Advanced filter — Email
 * — added and applied. Owner was reset: 10 rows went back to 100.
 * TRAP T-a-conditioned-field-opens-on-its-rows
 */
test('adding and applying a second Advanced filter keeps the first', async ({ page }) => {
  await page.goto('http://localhost:4200/?context=records');
  await page.waitForFunction(() =>
    !!document.querySelector('#context-root sherpa-data-grid')?.shadowRoot?.querySelector('.row, [role="row"]'));
  const total = () => page.evaluate(() =>
    (window as unknown as { sherpa: { source: { debugState(): { total: number } } } }).sherpa.source.debugState().total);
  type Q = HTMLElement & { setChipReading(id: string, r: unknown): void; report(): void; addFilters(ids: string[]): void };
  await page.evaluate(() => {
    const q = document.querySelector('#context-root sherpa-quick-filter-toolbar') as Q;
    q.setChipReading('owner', { picked: [], conditions: [{ op: 'contains', text: 'Da' }] });
    q.report();
  });
  await expect.poll(total).toBe(10);
  await page.evaluate(() => (document.querySelector('#context-root sherpa-quick-filter-toolbar') as Q).addFilters(['email']));
  await page.waitForTimeout(600);
  await expect.poll(total).toBe(10);
  await page.evaluate(() => {
    const q = document.querySelector('#context-root sherpa-quick-filter-toolbar') as Q;
    q.setChipReading('email', { picked: [], conditions: [{ op: 'contains', text: 'example' }] });
    q.report();
  });
  await page.waitForTimeout(600);
  // Every email contains "example", so only Owner narrows.
  await expect.poll(total).toBe(10);

  // And the PANEL, opened now, shows Owner on its rows.
  await page.evaluate(() => document.querySelector('#context-root sherpa-quick-filter-toolbar [data-filter-mode]')!
    .dispatchEvent(new CustomEvent('button-click', { bubbles: true, composed: true })));
  await expect.poll(() => page.evaluate(() => {
    const box = document.querySelector('#filter-panel')!.shadowRoot!.querySelector('.field[data-field="owner"]');
    return (box?.querySelector('sherpa-menu') as HTMLElement & { conditions?: unknown[] } | null)?.conditions ?? null;
  })).toEqual([{ op: 'contains', text: 'Da' }]);
  // Opening it changed nothing — the rows hold.
  await expect.poll(total).toBe(10);
});
