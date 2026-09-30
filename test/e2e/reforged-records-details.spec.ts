import { test, expect, type Page } from '@playwright/test';

/**
 * The CURRENT row opens its details — TODO 23.
 *
 * The grid holds the current row BY KEY, and a caller can set and step it; one
 * overlay panel is open at a time; and in the Records Context a row click opens
 * the details panel, its chevrons step the row, and the header's trail names it.
 *
 * TRAP T-a-current-row-opens-its-details · TRAP T-one-overlay-panel-at-a-time
 */
const HARNESS = '/test/reforged/harness.html';
const APP = 'http://localhost:4200/?context=records';

type Grid = HTMLElement & {
  rendered?: Promise<void>;
  populate?: (d: unknown) => void;
  currentKey?: string | null;
  current?: Record<string, unknown> | null;
  neighbour?: (by: number) => Record<string, unknown> | null;
  stepCurrent?: (by: number) => Record<string, unknown> | null;
};

const CONFIG = {
  key: 'id',
  columns: [{ field: 'name', header: 'Name', sortable: true }],
  rows: [{ id: 'c', name: 'Charlie' }, { id: 'a', name: 'Alice' }, { id: 'b', name: 'Bob' }],
};

test.describe('the grid', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(HARNESS);
    await page.waitForFunction(() => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true);
  });

  test('holds the current row by key, sets it silently, and steps it', async ({ page }) => {
    const r = await page.evaluate(async (config) => {
      const el = document.createElement('sherpa-data-grid') as Grid;
      document.getElementById('root')!.appendChild(el);
      await el.rendered;
      el.populate!(config);
      await (window as unknown as { __settled: () => Promise<void> }).__settled();
      const marked = () => [...el.shadowRoot!.querySelectorAll('.body .row[data-current]')]
        .map((tr) => tr.querySelector('.cell')!.textContent);
      let fired = 0;
      el.addEventListener('row-select', () => fired++);

      el.shadowRoot!.querySelectorAll<HTMLElement>('.body .row')[1]!.click();
      const clicked = { key: el.currentKey, marked: marked(), fired };

      el.currentKey = 'c';
      const set = { name: el.current?.name, marked: marked(), fired };

      const up = el.neighbour!(-1);
      const down = el.stepCurrent!(1);
      const stepped = { up, down: down?.name, key: el.currentKey, marked: marked() };
      el.stepCurrent!(1);
      const atEnd = { step: el.stepCurrent!(1), key: el.currentKey };

      // A re-populate (an edit reloads the rows) keeps it: the key names the row.
      el.populate!({ ...config, rows: config.rows.map((row) => ({ ...row })) });
      await (window as unknown as { __settled: () => Promise<void> }).__settled();
      return { clicked, set, stepped, atEnd, kept: { key: el.currentKey, marked: marked() } };
    }, CONFIG);
    expect(r.clicked).toEqual({ key: 'a', marked: ['Alice'], fired: 1 });
    // Silent, as select() is.
    expect(r.set).toEqual({ name: 'Charlie', marked: ['Charlie'], fired: 1 });
    expect(r.stepped).toEqual({ up: null, down: 'Alice', key: 'a', marked: ['Alice'] });
    expect(r.atEnd).toEqual({ step: null, key: 'b' });
    expect(r.kept).toEqual({ key: 'b', marked: ['Bob'] });
  });

  test('opening one overlay panel shuts the other', async ({ page }) => {
    const r = await page.evaluate(async () => {
      type Panel = HTMLElement & { rendered?: Promise<void>; show?: () => void; open?: boolean };
      const make = () => {
        const el = document.createElement('sherpa-overlay-panel') as Panel;
        document.getElementById('root')!.appendChild(el);
        return el;
      };
      const one = make();
      const two = make();
      await Promise.all([one.rendered, two.rendered]);
      let closed = 0;
      one.addEventListener('panel-close', () => closed++);
      one.show!();
      two.show!();
      await new Promise((res) => setTimeout(res, 50));
      return { one: one.open, two: two.open, closed };
    });
    expect(r).toEqual({ one: false, two: true, closed: 1 });
  });
});

test.describe('the Records Context', () => {
  // Tall: the grid card takes what the charts leave, and at 720 that is only its heading.
  test.use({ viewport: { width: 1440, height: 1100 } });

  /** The details panel's state, and the header's trail. */
  const read = (page: Page) => page.evaluate(() => {
    const details = document.getElementById('details') as HTMLElement & { open?: boolean };
    const header = document.querySelector('sherpa-app-shell > sherpa-app-header');
    const trail = header?.querySelector('sherpa-breadcrumbs')?.shadowRoot;
    const grid = document.querySelector('sherpa-data-grid') as Grid;
    const fields = details.querySelector('.details-fields')?.shadowRoot;
    const up = details.querySelector('.details-step[data-by="-1"]');
    return {
      open: !!details.open,
      heading: details.getAttribute('data-heading'),
      crumbs: [...(trail?.querySelectorAll('.link') ?? [])].map((a) => a.textContent),
      values: [...(fields?.querySelectorAll('dd') ?? [])].map((dd) => dd.textContent),
      current: grid.currentKey,
      upDisabled: !!up?.hasAttribute('disabled'),
    };
  });

  test.beforeEach(async ({ page }) => {
    await page.goto(APP);
    await page.waitForFunction(() => {
      const grid = document.querySelector('sherpa-data-grid');
      return (grid?.shadowRoot?.querySelectorAll('.body .row').length ?? 0) > 1;
    }, undefined, { timeout: 30000 });
  });

  test('a row opens its details; the chevrons step it; the first crumb shuts it', async ({ page }) => {
    const grid = page.locator('sherpa-data-grid');
    await grid.locator('.body .row').first().click();
    await expect.poll(() => read(page).then((s) => s.open)).toBe(true);
    const first = await read(page);
    expect(first.heading).toBeTruthy();
    expect(first.crumbs).toEqual([expect.any(String), first.heading]);
    expect(first.values).toContain(first.current);
    // The first row has nothing above it.
    expect(first.upDisabled).toBe(true);

    await page.locator('#details .details-step[data-by="1"]').click();
    await expect.poll(() => read(page).then((s) => s.current)).not.toBe(first.current);
    const next = await read(page);
    expect(next.heading).not.toBe(first.heading);
    expect(next.crumbs[1]).toBe(next.heading);
    expect(next.upDisabled).toBe(false);
    await expect(grid.locator('.body .row').nth(1)).toHaveAttribute('data-current', '');

    const url = page.url();
    await page.locator('sherpa-app-header sherpa-breadcrumbs .link').first().click();
    await expect.poll(() => read(page).then((s) => s.open)).toBe(false);
    await expect.poll(() => read(page).then((s) => s.crumbs)).toEqual([]);
    // In place: no reload, no new address.
    expect(page.url()).toBe(url);
  });

  test('the assistant opening shuts the details', async ({ page }) => {
    await page.locator('sherpa-data-grid .body .row').first().click();
    await expect.poll(() => read(page).then((s) => s.open)).toBe(true);
    await page.evaluate(() => document.dispatchEvent(new CustomEvent('ai-click')));
    await expect.poll(() => page.evaluate(() => (document.getElementById('assistant') as HTMLElement & { open?: boolean }).open)).toBe(true);
    await expect.poll(() => read(page).then((s) => s.open)).toBe(false);
    await expect.poll(() => read(page).then((s) => s.crumbs)).toEqual([]);
  });
});
