import { test, expect } from './harness';

/**
 * A FILTER CLICK REDRAWS THE GRID ONCE, and keeps its heading — TODO 355. A
 * click wrote several attributes and the rows, and each one redrew the whole
 * grid, its heading's chips and menus built again each time: about half the
 * click's CPU at 4x. Counted here, so it cannot creep back.
 * TRAP T-a-grid-draws-once-per-moment · TRAP T-a-heading-cell-is-kept
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
  // The heading is KEPT: no cell made again (C5).
  expect(r).toEqual({ body: 1, heads: 0 });
});

test('a bound filter pick draws the body at most twice, and makes no heading cell', async ({ page }) => {
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
  // The heading is KEPT: no cell made again (C5).
  expect(r.heads).toBe(0);
});

/* C4: the offset and the widths are measured once, and only when what they read
   moved — yet still right after each thing that moves them. */
test('the frozen offset and the shared widths stay right without a measure per draw', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    grid.style.width = '1200px';
    grid.setAttribute('data-selectable', '');
    await grid.populate({ columns, rows: rows.slice(0, 5) });
    await settle();
    const sr = grid.shadowRoot;
    const offset = () => parseFloat(grid.style.getPropertyValue('--_pin-offset')) || 0;
    const probe = () => sr.querySelector('.head-row > .select-cell').getBoundingClientRect().width;
    const filled = () => [...sr.querySelectorAll('.cols > .col')].reduce((w, c) => w + parseFloat(c.style.width), 0);
    const out = { first: offset() > 0 && Math.abs(offset() - probe()) < 0.01 };
    grid.removeAttribute('data-selectable');
    await settle();
    out.off = offset();
    grid.setAttribute('data-selectable', '');
    await settle();
    out.on = Math.abs(offset() - probe()) < 0.01 && offset() > 0;
    // The same columns again: the widths still fill the box.
    const before = filled();
    await grid.populate({ columns, rows: rows.slice(0, 9) });
    await settle();
    out.kept = Math.abs(filled() - before) < 1 && filled() > 4 * 96;
    // Drawn while hidden, then shown: measured when it shows.
    grid.style.display = 'none';
    await grid.populate({ columns: columns.slice(0, 3), rows: rows.slice(0, 3) });
    await settle();
    grid.style.display = '';
    await settle();
    await new Promise((d) => requestAnimationFrame(() => requestAnimationFrame(d)));
    out.shown = Math.abs(offset() - probe()) < 0.01 && offset() > 0;
    return out;
  })()`);
  expect(r).toEqual({ first: true, off: 0, on: true, kept: true, shown: true });
});

/* C5: the heading's own components are kept — a pick, a sort and a page make none. */
test('a pick, a sort and a page make no new heading component', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    const source = new DataSource({ store: new ArrayStore(rows, { key: 'id' }), pageSize: 10 });
    source.declareValues('status', ['active', 'trial']);
    bindSource(source, grid, { scope: 'view', as: (r) => ({ columns, rows: r }) });
    await source.load();
    await settle();
    const all = (root, out = []) => {
      for (const el of root.querySelectorAll('*')) {
        if (el.localName.startsWith('sherpa-')) out.push(el);
        if (el.shadowRoot) all(el.shadowRoot, out);
      }
      return out;
    };
    const head = () => all(grid.shadowRoot.querySelector('.head-row'));
    const before = new Set(head());
    source.select('status', ['active']);
    await settle();
    source.setSort('name', 'desc');
    await settle();
    source.setPage(2);
    await settle();
    // Plain picks only: a menu's condition rows are its own to make.
    return { kept: before.size > 0, fresh: head().filter((el) => !before.has(el)).length, total: source.total };
  })()`);
  expect(r).toEqual({ kept: true, fresh: 0, total: 20 });
});

/* C5, Will's G1 A: an open heading menu stays open through a data push, with
   its search and its unapplied draft. */
test('an open heading menu survives a push, with its search and its draft', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    grid.setAttribute('data-column-filters', '');
    const source = new DataSource({ store: new ArrayStore(rows, { key: 'id' }), pageSize: 10 });
    source.declareValues('status', ['active', 'trial']);
    source.declareValues('region', ['EMEA', 'APAC']);
    bindSource(source, grid, { scope: 'view', as: (r) => ({ columns, rows: r }) });
    await source.load();
    await settle();
    grid.openColumnFilter('status');
    await settle();
    const menu = grid.shadowRoot.querySelector('.head-cell[data-field="status"] sherpa-menu');
    const search = menu.shadowRoot.querySelector('.search');
    if (search) search.value = 'act';
    menu.values = ['active'];
    // Another control changes ANOTHER field: the rows move, the heading is pushed.
    source.select('region', ['EMEA']);
    await settle();
    const now = grid.shadowRoot.querySelector('.head-cell[data-field="status"] sherpa-menu');
    return { same: now === menu, open: !!menu.open, search: search ? search.value : 'none', draft: menu.values, total: source.total };
  })()`);
  expect(r).toEqual({ same: true, open: true, search: 'act', draft: ['active'], total: 20 });
});
