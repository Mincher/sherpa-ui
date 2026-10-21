import { test, expect } from './harness';

/**
 * "SELECT ALL ROWS" ON A PAGED GRID — Will, TODO 238. A grid its source pages
 * holds one page, so it asks its source for every matching row, and ticks the
 * ones on other pages too. Unbound, it ticks what it holds.
 * TRAP T-select-all-is-the-visible-rows
 */

const ROWS = Array.from({ length: 25 }, (_, i) => ({ id: i + 1, name: `Row ${i + 1}`, tier: i % 5 === 0 ? 'Gold' : 'Silver' }));

type Grid = HTMLElement & { rendered?: Promise<void>; selectedKeys: string[]; populate(d: unknown): void };

test('Select all rows ticks every matching row, on every page, and only those', async ({ page }) => {
  const r = await page.evaluate(async (data) => {
    const { ArrayStore, DataSource, bindSource } = await import('/dist/index.js');
    const grid = document.createElement('sherpa-data-grid') as Grid;
    document.getElementById('root')!.replaceChildren(grid);
    await grid.rendered;
    const source = new DataSource({ store: new ArrayStore(data, { key: 'id' }), pageSize: 10 });
    bindSource(source, grid, { as: (rows) => ({ columns: [{ field: 'name', header: 'Name' }], rows }) });
    await source.load();
    await window.__settled();
    const scenario = (value: string) => grid.shadowRoot!.querySelector('.select-all')!
      .dispatchEvent(new CustomEvent('selection-scenario', { detail: { value } }));
    const heard: string[][] = [];
    grid.addEventListener('selection-change', (e) => heard.push((e as CustomEvent).detail.selected));

    scenario('all');
    await new Promise((done) => setTimeout(done, 50));
    const all = { keys: grid.selectedKeys.length, pages: grid.dataset['totalPages'], heard: heard.at(-1)?.length };

    // Under a filter, only the rows it leaves.
    scenario('none');
    source.query.setReading('view', 'tier', { picked: ['Gold'] });
    await source.load();
    scenario('all');
    await new Promise((done) => setTimeout(done, 50));
    return { all, gold: [...grid.selectedKeys].sort((a, b) => Number(a) - Number(b)) };
  }, ROWS);
  expect(r.all).toEqual({ keys: 25, pages: '3', heard: 25 });
  expect(r.gold).toEqual(['1', '6', '11', '16', '21']);
});

test('unbound, Select all rows ticks the rows the grid holds', async ({ page }) => {
  const keys = await page.evaluate(async (data) => {
    const grid = await window.__mount<Grid>('sherpa-data-grid', {
      key: 'id', columns: [{ field: 'name', header: 'Name' }], rows: data.slice(0, 4),
    });
    grid.shadowRoot!.querySelector('.select-all')!
      .dispatchEvent(new CustomEvent('selection-scenario', { detail: { value: 'all' } }));
    await window.__settled();
    return grid.selectedKeys;
  }, ROWS);
  expect(keys).toEqual(['1', '2', '3', '4']);
});

/* Will, 365: "Select all on page" selects THIS page, and only it — a row chosen
   on another page is let go. TRAP T-select-all-is-the-visible-rows */
test('Select all on page lets go of the rows chosen on other pages', async ({ page }) => {
  const r = await page.evaluate(async (data) => {
    const { ArrayStore, DataSource, bindSource } = await import('/dist/index.js');
    const grid = document.createElement('sherpa-data-grid') as Grid & { selectedKeys: string[] };
    document.getElementById('root')!.replaceChildren(grid);
    await grid.rendered;
    grid.setAttribute('data-selectable', '');
    const source = new DataSource({ store: new ArrayStore(data, { key: 'id' }), pageSize: 10 });
    bindSource(source, grid, { as: (rows) => ({ columns: [{ field: 'name', header: 'Name' }], rows }) });
    await source.load();
    await window.__settled();
    const scenario = (value: string) => grid.shadowRoot!.querySelector('.select-all')!
      .dispatchEvent(new CustomEvent('selection-scenario', { detail: { value } }));
    // Page 1: tick its first row by its box, as a reader does.
    grid.shadowRoot!.querySelector('.row .row-select')!.shadowRoot!.querySelector<HTMLElement>('input')!.click();
    await window.__settled();
    const first = [...grid.selectedKeys];
    // Page 2: Select all on page.
    source.setPage(2);
    await source.load();
    await window.__settled();
    scenario('page');
    await window.__settled();
    return { first, after: [...grid.selectedKeys].sort((a, b) => Number(a) - Number(b)) };
  }, ROWS);
  expect(r.first).toEqual(['1']);
  expect(r.after).toEqual(['11', '12', '13', '14', '15', '16', '17', '18', '19', '20']);
});
