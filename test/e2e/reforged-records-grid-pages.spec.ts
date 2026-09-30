import { test, expect, type Page } from '@playwright/test';

/**
 * THE RECORDS GRID, PAGE BY PAGE — Will, 2026-09-30. Runs against the EXAMPLES
 * server (:4200), at a desktop size: a fit layout is a desktop mode.
 */
test.use({ viewport: { width: 1700, height: 1200 } });

type Source = {
  debugState(): { total: number; page: number; totalPages: number };
  setPage(n: number): void; setPageSize(n: number): void; setGroup(f: string | null): void;
  select(field: string, picked: string[]): void;
};

async function open(page: Page): Promise<void> {
  await page.goto('http://localhost:4200/?context=records');
  await page.waitForFunction(() =>
    !!document.querySelector('#context-root sherpa-data-grid')?.shadowRoot?.querySelector('.row, [role="row"]'));
}

const steer = (page: Page, fn: keyof Source, ...args: unknown[]): Promise<void> => page.evaluate(([f, a]) => {
  const source = (window as unknown as { sherpa: { source: Record<string, (...x: unknown[]) => void> } }).sherpa.source;
  source[f as string]!(...(a as unknown[]));
}, [fn, args] as const);

/** What the grid draws now: its visible rows and headings, and the pager's count. */
const drawn = (page: Page): Promise<{ rows: number; headings: number; page: number; pages: number }> => page.evaluate(() => {
  const sr = document.querySelector('#grid')!.shadowRoot!;
  const shown = (e: Element): boolean => (e as HTMLElement).getClientRects().length > 0;
  const s = (window as unknown as { sherpa: { source: Source } }).sherpa.source.debugState();
  return {
    rows: [...sr.querySelectorAll('.body .row')].filter(shown).length,
    headings: [...sr.querySelectorAll('.body .group-row')].filter(shown).length,
    page: s.page, pages: s.totalPages,
  };
});

/**
 * TODO 152: "Data grid pages don't respect the row count value set in the
 * pagination. When i change pages I see varying row counts." Grouped, a page
 * was 25 screen LINES, headings counted: 24, 24, 23, 23 and 6 rows, on five
 * pages. A page is 25 ROWS, grouped or not.
 * TRAP T-grid-collapsed-group-is-one-slot
 */
test('a GROUPED page holds the pager\'s row count, as an ungrouped one does', async ({ page }) => {
  await open(page);
  await expect.poll(async () => (await drawn(page)).rows).toBe(25);
  const flat = await drawn(page);

  await steer(page, 'setGroup', 'plan');
  await expect.poll(async () => (await drawn(page)).headings).toBeGreaterThan(0);
  const seen: number[] = [];
  for (let n = 1; n <= flat.pages; n += 1) {
    await steer(page, 'setPage', n);
    await expect.poll(async () => (await drawn(page)).page).toBe(n);
    await expect.poll(async () => (await drawn(page)).rows, `page ${n}`).toBe(25);
    const now = await drawn(page);
    // The SAME number of pages as ungrouped: a heading costs nothing.
    expect(now.pages).toBe(flat.pages);
    expect(now.headings).toBeGreaterThan(0);
    seen.push(now.rows);
  }
  expect(seen).toEqual([25, 25, 25, 25]);
});

/**
 * TODO 153: "The data grid, and it's container, in a fixed row count layout
 * grid also changes height to fit the row count. … The container should stay
 * the same height and the grid should fill the available height."
 * TRAP T-a-fit-grid-needs-a-sized-parent
 */
test('the grid\'s card keeps one height whatever the page holds, and the grid fills it', async ({ page }) => {
  await open(page);
  const measure = (): Promise<{ rows: number; card: number; grid: number; layout: number; frame: number; pagerAtFoot: boolean; scrolls: boolean }> =>
    page.evaluate(() => {
      const grid = document.querySelector<HTMLElement>('#grid')!;
      const card = grid.closest<HTMLElement>('sherpa-container')!;
      const layout = grid.closest<HTMLElement>('sherpa-layout-grid')!;
      const frame = document.querySelector('sherpa-app-shell')!.shadowRoot!.querySelector<HTMLElement>('.context-frame')!;
      const pager = document.querySelector<HTMLElement>('#pager')!;
      const h = (e: Element): number => Math.round(e.getBoundingClientRect().height);
      return {
        rows: grid.shadowRoot!.querySelectorAll('.body .row').length,
        card: h(card), grid: h(grid), layout: h(layout), frame: frame.clientHeight,
        pagerAtFoot: Math.abs(pager.getBoundingClientRect().bottom - card.getBoundingClientRect().bottom) <= 2,
        scrolls: frame.scrollHeight > frame.clientHeight,
      };
    });

  await steer(page, 'setPageSize', 50);
  await expect.poll(async () => (await measure()).rows).toBe(50);
  const many = await measure();
  await steer(page, 'setPageSize', 10);
  await expect.poll(async () => (await measure()).rows).toBe(10);
  const few = await measure();
  // A short LAST page: three rows of 23… whatever is left.
  await steer(page, 'select', 'plan', ['Starter']);
  await expect.poll(async () => (await drawn(page)).pages).toBeLessThan(10);
  await steer(page, 'setPage', (await drawn(page)).pages);
  await expect.poll(async () => (await measure()).rows).toBeLessThan(10);
  const last = await measure();

  // The layout fills the frame, and nothing but the grid scrolls.
  expect(many.layout).toBe(many.frame);
  expect(many.scrolls).toBe(false);
  for (const now of [few, last]) {
    expect({ card: now.card, grid: now.grid, layout: now.layout }).toEqual({ card: many.card, grid: many.grid, layout: many.layout });
    expect(now.pagerAtFoot).toBe(true);
    expect(now.scrolls).toBe(false);
  }
});
