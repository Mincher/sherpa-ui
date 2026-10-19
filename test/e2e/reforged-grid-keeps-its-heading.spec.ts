import { test, expect } from './harness';

/**
 * A FILTER CLICK REDRAWS THE GRID ONCE, and keeps its heading — TODO 355. A
 * click wrote several attributes and the rows, and each one redrew the whole
 * grid, its heading's chips and menus built again each time: about half the
 * click's CPU at 4x. Counted here, so it cannot creep back.
 * TRAP T-a-grid-draws-once-per-moment
 */
const SETUP = `
  const { ArrayStore, DataSource, bindSource } = await import('/dist/index.js');
  const settle = () => window.__settled();
  const root = document.getElementById('root');
  root.innerHTML = '';
  const grid = document.createElement('sherpa-data-grid');
  root.append(grid);
  await grid.rendered;
  const columns = [
    { field: 'name', header: 'Name' }, { field: 'status', header: 'Status' },
    { field: 'region', header: 'Region' }, { field: 'seats', header: 'Seats', type: 'number' },
  ];
  const rows = Array.from({ length: 40 }, (_, i) => ({ id: i + 1, name: 'n' + i,
    status: ['active', 'trial'][i % 2], region: ['EMEA', 'APAC'][i % 2], seats: i }));
  /** Each body redraw, and each heading cell made, from now on. */
  const count = () => {
    const seen = { body: 0, heads: 0 };
    new MutationObserver((records) => {
      for (const r of records) {
        if (r.target.classList?.contains('body') && r.removedNodes.length) seen.body++;
        for (const n of r.addedNodes) if (n.classList?.contains('head-cell')) seen.heads++;
      }
    }).observe(grid.shadowRoot, { childList: true, subtree: true });
    return seen;
  };
`;

test('two attribute writes in one moment draw the grid once', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    await grid.populate({ columns, rows: rows.slice(0, 10) });
    await settle();
    const seen = count();
    grid.setAttribute('data-sort-field', 'name');
    grid.setAttribute('data-sort-direction', 'desc');
    await settle();
    return seen;
  })()`);
  expect(r).toEqual({ body: 1, heads: 4 });
});

test('a bound filter pick draws the body at most twice, and the heading at most twice', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    const source = new DataSource({ store: new ArrayStore(rows, { key: 'id' }), pageSize: 10 });
    source.declareValues('status', ['active', 'trial']);
    source.declareValues('region', ['EMEA', 'APAC']);
    bindSource(source, grid, { scope: 'view', as: (r) => ({ columns, rows: r }) });
    source.select('region', ['EMEA']);
    await source.load();
    await settle();
    const seen = count();
    source.select('status', ['active']);
    await settle();
    return { ...seen, total: source.total };
  })()`);
  expect(r.total).toBe(20);
  expect(r.body).toBeLessThanOrEqual(2);
  // Two heading builds of 4 cells — drawReading's, and the rows' — where there
  // were more. A ceiling that may only fall: C5 takes it to 0.
  expect(r.heads).toBeLessThanOrEqual(8);
});
