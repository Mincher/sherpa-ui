import { test, expect } from '@playwright/test';

/**
 * RAISING A FILTER CARRIES ITS VALUE; LOWERING IT GIVES THE COMPONENT'S BACK.
 *
 * Before this, raising Status from the grid's bar to the header gave the header
 * an EMPTY, off chip and greyed the grid's — while the rows stayed filtered by
 * a pick no visible chip showed. And the app's selection mirror then wrote the
 * grid's emptied answer into the greyed chip, so lowering it again came back
 * with nothing.
 *
 * Needs the examples server on :4200, like reforged-filter-panel-mode.
 * TRAP T-up-is-open-down-is-closed
 */
test('raise, change and lower a filter — the value travels and comes back', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('http://localhost:4200/?context=records');
  await page.waitForFunction(() =>
    !!document.querySelector('#context-root sherpa-data-grid')?.shadowRoot
      ?.querySelector('.row, [role="row"]'));
  await page.waitForTimeout(900);

  const HEADER = 'sherpa-app-header sherpa-quick-filter-toolbar[slot="filters"]';
  const GRID = '#context-root sherpa-quick-filter-toolbar';
  const read = () => page.evaluate(([h, g]) => {
    type Chip = HTMLElement & { menu?: { values?: string[] } };
    const chip = (bar: string) => document.querySelector(bar)?.shadowRoot
      ?.querySelector<Chip>('.chips > .chip[data-id="status"]') ?? null;
    const state = (c: Chip | null) => (c ? {
      on: c.hasAttribute('data-current'),
      greyed: c.hasAttribute('data-superseded'),
      picks: c.menu?.values ?? [],
    } : null);
    const src = (window as unknown as { sherpa: { source: { debugState(): { total: number } } } })
      .sherpa.source;
    return { total: src.debugState().total, header: state(chip(h)), grid: state(chip(g)) };
  }, [HEADER, GRID]);

  const pick = async (bar: string, value: string, untick?: string) => {
    const chip = page.locator(bar).locator('.chips > .chip[data-id="status"]');
    const menu = chip.locator('sherpa-menu');
    await chip.locator('.caret').click();
    await page.waitForTimeout(300);
    if (untick) await menu.locator(`label:has(input[value="${untick}"])`).click();
    await menu.locator(`label:has(input[value="${value}"])`).click();
    await menu.locator('.apply').click();
    await page.waitForTimeout(800);
  };

  // 1. The GRID filters Status to one value.
  const [first, other] = await page.evaluate((g) => [...(document.querySelector(g)?.shadowRoot
    ?.querySelectorAll<HTMLInputElement>('.chips > .chip[data-id="status"] label.menu-row:not(.qf-all) input') ?? [])]
    .slice(0, 2).map((i) => i.value), GRID);
  await pick(GRID, first!);
  const set = await read();

  // 2. RAISE it through the header's own Add.
  await page.evaluate((h) => (document.querySelector(h) as HTMLElement & {
    addFilters(ids: string[]): void }).addFilters(['status']), HEADER);
  await page.waitForTimeout(1000);
  const raised = await read();

  // 3. Change the VIEW's value.
  await pick(HEADER, other!, first!);
  const changed = await read();

  // 4. LOWER it.
  await page.evaluate((h) => (document.querySelector(h) as HTMLElement & {
    removeFilter(id: string): void }).removeFilter('status'), HEADER);
  await page.waitForTimeout(1000);
  const lowered = await read();

  expect(set.grid).toEqual({ on: true, greyed: false, picks: [first] });

  // The value TRAVELLED: the header chip is on with it, not empty…
  expect(raised.header).toEqual({ on: true, greyed: false, picks: [first] });
  /* …the grid's chip is greyed and KEEPS it. It stays `on` too: greyed is
     SUSPENDED, not off, which is how it comes back on when the view lets go.
     It narrows nothing while greyed — the rows below are the view's. */
  expect(raised.grid).toMatchObject({ greyed: true, picks: [first] });
  // …and the rows did not move, because the same answer is still applied.
  expect(raised.total).toBe(set.total);

  // A new value at the view is not ANDed with the grid's kept one.
  expect(changed.header?.picks).toEqual([other]);
  expect(changed.total).toBeGreaterThan(0);
  expect(changed.grid?.picks).toEqual([first]);

  // Lowered: the grid's OWN answer comes back, on.
  expect(lowered.header).toBeNull();
  expect(lowered.grid).toEqual({ on: true, greyed: false, picks: [first] });
  expect(lowered.total).toBe(set.total);
});
