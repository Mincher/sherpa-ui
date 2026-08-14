import { test, expect } from '@playwright/test';

/** sherpa-data-grid — columns/rows from populate(); click-to-sort; row-click. */

const HARNESS = '/test/reforged/harness.html';

const CONFIG = {
  columns: [
    { field: 'name', header: 'Name' },
    { field: 'score', header: 'Score', type: 'number' },
  ],
  rows: [
    { name: 'Charlie', score: 30 },
    { name: 'Alice', score: 90 },
    { name: 'Bob', score: 60 },
  ],
};

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(() => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true);
});

test('renders header cells and a row per record', async ({ page }) => {
  const r = await page.evaluate(async (config) => {
    const el = document.createElement('sherpa-data-grid') as HTMLElement & {
      rendered?: Promise<void>;
      populate?: (d: unknown) => void;
    };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate!(config);
    await new Promise((res) => setTimeout(res, 10));
    const sr = el.shadowRoot!;
    return {
      headers: Array.from(sr.querySelectorAll('.head-label')).map((h) => h.textContent),
      rows: sr.querySelectorAll('.body .row').length,
      firstCell: sr.querySelector('.body .row .cell')!.textContent,
      numericAlign: getComputedStyle(sr.querySelector('.cell[data-type="number"]')!).textAlign,
    };
  }, CONFIG);
  expect(r.headers).toEqual(['Name', 'Score']);
  expect(r.rows).toBe(3);
  expect(r.firstCell).toBe('Charlie'); // unsorted → source order
  expect(r.numericAlign).toBe('end'); // numeric column right-aligned
});

test('clicking a header sorts asc then desc and reflects the attributes', async ({ page }) => {
  const r = await page.evaluate(async (config) => {
    const el = document.createElement('sherpa-data-grid') as HTMLElement & {
      rendered?: Promise<void>;
      populate?: (d: unknown) => void;
    };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate!(config);
    await new Promise((res) => setTimeout(res, 10));

    const names = () =>
      Array.from(el.shadowRoot!.querySelectorAll('.body .row .cell:first-child')).map((c) => c.textContent);
    const scoreHeader = () =>
      Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>('.head-cell')).find(
        (h) => h.dataset['field'] === 'score',
      )!;

    scoreHeader().querySelector<HTMLElement>('.head-btn')!.click(); // asc by score
    await new Promise((res) => setTimeout(res, 10));
    const asc = names();
    const ascAttr = { field: el.dataset['sortField'], dir: el.dataset['sortDirection'] };

    scoreHeader().querySelector<HTMLElement>('.head-btn')!.click(); // desc
    await new Promise((res) => setTimeout(res, 10));
    const desc = names();

    return { asc, ascAttr, desc };
  }, CONFIG);
  expect(r.asc).toEqual(['Charlie', 'Bob', 'Alice']); // 30, 60, 90
  expect(r.ascAttr).toEqual({ field: 'score', dir: 'asc' });
  expect(r.desc).toEqual(['Alice', 'Bob', 'Charlie']); // 90, 60, 30
});

test('clicking a row fires row-click with the record', async ({ page }) => {
  const r = await page.evaluate(async (config) => {
    const el = document.createElement('sherpa-data-grid') as HTMLElement & {
      rendered?: Promise<void>;
      populate?: (d: unknown) => void;
    };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate!(config);
    await new Promise((res) => setTimeout(res, 10));

    let row: Record<string, unknown> | null = null;
    el.addEventListener('row-click', (e) => (row = (e as CustomEvent).detail.row));
    el.shadowRoot!.querySelector<HTMLElement>('.body .row')!.click();
    return row;
  }, CONFIG);
  expect(r).toEqual({ name: 'Charlie', score: 30 });
});

test('an empty rows array shows the empty state', async ({ page }) => {
  const shown = await page.evaluate(async () => {
    const el = document.createElement('sherpa-data-grid') as HTMLElement & {
      rendered?: Promise<void>;
      populate?: (d: unknown) => void;
    };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate!({ columns: [{ field: 'x' }], rows: [] });
    await new Promise((res) => setTimeout(res, 10));
    return {
      empty: el.hasAttribute('data-empty'),
      visible: getComputedStyle(el.shadowRoot!.querySelector('.empty')!).display !== 'none',
    };
  });
  expect(shown.empty).toBe(true);
  expect(shown.visible).toBe(true);
});
