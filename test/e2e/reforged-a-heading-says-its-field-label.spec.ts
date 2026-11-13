import { test, expect } from './harness';

/**
 * A HEADING SAYS ITS FIELD'S LABEL — Will, plan 960 U2: a field's label is said once, in its type. A column with no
 * `header` is headed by its source's label for the field, and its sort and group buttons and filter menu say the
 * same; a column's own `header` still wins. TRAP T-a-field-is-declared-once
 */
test('a column with no header says its type\'s label, and its own header wins', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    const { ArrayStore, DataSource, bindSource, typeStoreOptions } = await import('/dist/index.js');
    const root = document.getElementById('root');
    root.innerHTML = '';
    const grid = document.createElement('sherpa-data-grid');
    grid.setAttribute('data-column-filters', '');
    root.append(grid);
    await grid.rendered;
    const type = { v: 1, id: 'device', label: 'Device', fields: {
      id: {}, name: { label: 'Device name' }, status: { label: 'Status', values: ['online', 'offline'] },
      seats: { type: 'number', label: 'Seats held' } } };
    const rows = [{ id: 1, name: 'Alpha', status: 'online', seats: 3 }, { id: 2, name: 'Bravo', status: 'offline', seats: 5 }];
    const source = new DataSource({ store: new ArrayStore(rows, typeStoreOptions(type)), pageSize: 10 });
    // Configuration first, as a page sets it: the grid asks for its columns' fields.
    grid.columns = [{ field: 'name' }, { field: 'status', header: 'State' }, { field: 'seats', type: 'number' }];
    // Each field as the source defines it, with the rows, as sherpa-provider gives a grid them.
    const asked = ['name', 'status', 'seats'];
    bindSource(source, grid, { scope: 'view', as: (rows, src) => ({ rows, filters: Object.fromEntries(asked.map((f) => [f, src.filterDef(f)])) }) });
    await source.load();
    await window.__settled();
    const heads = [...grid.shadowRoot.querySelectorAll('.head-cell')];
    return {
      labels: heads.map((th) => th.querySelector('.head-label')?.textContent),
      sort: heads[0].querySelector('.head-sort')?.getAttribute('aria-label'),
      group: heads[1].querySelector('.head-group')?.getAttribute('aria-label'),
    };
  })()`) as { labels: string[]; sort: string; group: string };
  expect(r.labels).toEqual(['Device name', 'State', 'Seats held']);
  expect(r.sort).toBe('Sort by Device name');
  expect(r.group).toBe('Group by State');
});
