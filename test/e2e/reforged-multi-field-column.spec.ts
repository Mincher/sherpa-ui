import { test, expect } from './harness';

/**
 * MULTI-FIELD COLUMNS — Will, TODO 490. A column's `tags` draw as a second row
 * in each cell, in the plain Tag look (TODO 507); a tag filters
 * by its value and, pressed again, lets it go; the heading menu joins the
 * fields' lists, a section each, and answers each field on its own.
 * TRAP T-a-joined-menu-answers-each-field
 */
const SETUP = `
  const { ArrayStore, DataSource, bindSource } = await import('/dist/index.js');
  const settle = () => window.__settled();
  const root = document.getElementById('root');
  root.innerHTML = '';
  const grid = document.createElement('sherpa-data-grid');
  grid.setAttribute('data-multi-field', '');
  grid.setAttribute('data-column-filters', '');
  root.append(grid);
  await grid.rendered;
  const columns = [
    { field: 'name', header: 'Name', advanced: 'only', op: 'contains', tags: ['plan', 'status'] },
    { field: 'plan', header: 'Plan' }, { field: 'status', header: 'Status' },
  ];
  const rows = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, name: 'n' + i,
    plan: ['Free', 'Pro', 'Team'][i % 3], status: ['active', 'trial'][i % 2] }));
  const source = new DataSource({ store: new ArrayStore(rows, { key: 'id' }), pageSize: 50 });
  source.declareValues('plan', ['Free', 'Pro', 'Team']);
  source.declareValues('status', ['active', 'trial']);
  bindSource(source, grid, { scope: 'view', as: (r) => ({ columns, rows: r,
    filters: { plan: source.filterDef('plan'), status: source.filterDef('status') } }) });
  await source.load();
  await settle();
  const sr = grid.shadowRoot;
  const reading = (field) => source.query.applied.scopes.view?.readings?.[field] ?? null;
`;

test('a cell draws its tags in the plain Tag look; off, none', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    const names = (tr) => [...tr.querySelectorAll('.cell[data-field="name"] .cell-tag')].map((t) => t.textContent.trim());
    const second = sr.querySelectorAll('.row')[1];
    const tag = second.querySelector('.cell-tag');
    const out = {
      tags: [...sr.querySelectorAll('.row')].slice(0, 2).map(names),
      hue: [...second.querySelectorAll('.cell-tag')].map((t) => t.style.getPropertyValue('--_hue')),
      plain: getComputedStyle(tag).backgroundColor === getComputedStyle(sr.querySelector('.row')).getPropertyValue('--sherpa-style-surface-base').trim()
        || getComputedStyle(tag).backgroundColor === 'rgb(255, 255, 255)',
      text: second.querySelector('.cell[data-field="name"]').hasAttribute('data-tags'),
    };
    grid.removeAttribute('data-multi-field');
    await settle();
    out.off = sr.querySelectorAll('.cell-tag').length;
    return out;
  })()`);
  expect(r.tags).toEqual([['Free', 'active'], ['Pro', 'trial']]);
  // No data-viz colour: they were "not great". Will, TODO 507
  expect(r.hue).toEqual(['', '']);
  expect(r.plain).toBe(true);
  expect(r.text).toBe(true);
  expect(r.off).toBe(0);
});

test('a tag filters by its value, and pressed again lets it go', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    const tag = () => sr.querySelector('.row .cell-tag[data-field="plan"][data-value="Pro"]');
    tag().click();
    await settle();
    const on = { total: source.total, current: tag().hasAttribute('data-current'),
      pressed: tag().getAttribute('aria-pressed'), picked: reading('plan')?.picked };
    tag().click();
    await settle();
    return { on, off: { total: source.total, reading: reading('plan') } };
  })()`);
  expect(r.on).toEqual({ total: 4, current: true, pressed: 'true', picked: ['Pro'] });
  expect(r.off).toEqual({ total: 12, reading: null });
});

test('the heading menu joins its fields, a section each; Apply answers each that changed', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    const menu = sr.querySelector('.head-cell[data-field="name"] sherpa-menu');
    const items = [menu.querySelectorAll('.menu-section').length, ...menu.itemData.map((i) => i.label)];
    const sections = [...menu.querySelectorAll('.menu-section')].map((h) => h.textContent.trim());
    const selectAll = !!menu.querySelector('.qf-all');
    const keys = menu.itemData.map((i) => i.value);
    menu.values = [keys[1], keys[4]];
    menu.dispatchEvent(new CustomEvent('menu-apply', { bubbles: true, composed: true, detail: {} }));
    await settle();
    return { items, sections, selectAll, advanced: menu.hasAttribute('data-advanced'), plan: reading('plan')?.picked,
      status: reading('status')?.picked, total: source.total,
      on: sr.querySelector('.head-cell[data-field="name"] .head-filter').hasAttribute('data-current') };
  })()`);
  expect(r.items).toEqual([2, 'Free', 'Pro', 'Team', 'active', 'trial']);
  expect(r.sections).toEqual(['Plan', 'Status']);
  // Every value of every field is no answer: no Select all.
  expect(r.selectAll).toBe(false);
  expect(r.advanced).toBe(false);
  expect(r).toMatchObject({ plan: ['Pro'], status: ['trial'], total: 2, on: true });
});

test('a tag whose field the View holds is greyed, refused, and says where it went', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    grid.supersedeColumns({ plan: { picked: ['Pro'] } }, 'View filters');
    await settle();
    const tag = sr.querySelector('.row .cell-tag[data-field="plan"]');
    tag.click();
    await settle();
    tag.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, composed: true }));
    const tip = sr.querySelector('.tag-tip');
    const menu = sr.querySelector('.head-cell[data-field="name"] sherpa-menu');
    return {
      held: tag.hasAttribute('data-superseded'), reading: reading('plan'),
      tip: tip.shadowRoot.querySelector('.bubble').matches(':popover-open') ? tip.dataset.text : null,
      sections: [...menu.querySelectorAll('.menu-section')].map((h) => h.textContent.trim()),
    };
  })()`);
  expect(r).toEqual({ held: true, reading: null, tip: 'Filter moved to View scope.', sections: ['Status'] });
});

/* With a multi-field column, EVERY cell is two lines and starts at the first,
   so the values align across the row (Will, TODO 509); off, one line again. */
test('a grid with tags makes every cell two lines, its value on the first', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    const top = (field) => {
      const cell = sr.querySelector('.row .cell[data-field="' + field + '"]');
      const range = document.createRange();
      range.selectNodeContents(cell);
      return Math.round(range.getClientRects()[0].top);
    };
    const tall = () => sr.querySelector('.row .cell[data-field="plan"]').getBoundingClientRect().height;
    const on = { align: getComputedStyle(sr.querySelector('.row .cell[data-field="plan"]')).verticalAlign,
      same: top('plan') === top('name'), height: tall() };
    grid.removeAttribute('data-multi-field');
    await settle();
    return { on, off: getComputedStyle(sr.querySelector('.row .cell[data-field="plan"]')).verticalAlign, height: tall() };
  })()`) as { on: { align: string; same: boolean; height: number }; off: string; height: number };
  expect(r.on).toMatchObject({ align: 'top', same: true });
  expect(r.on.height).toBeGreaterThan(r.height);
  expect(r.off).not.toBe('top');
});

/* …and a cell's filter button sits by that first line, not mid-cell. Will, TODO 511 */
test('in a two-line grid, a cell\'s filter button sits by its first line', async ({ page }) => {
  await page.evaluate(`(async () => { ${SETUP} })()`);
  await page.locator('sherpa-data-grid .row .cell[data-field="plan"]').first().hover();
  const r = await page.evaluate(() => {
    const sr = document.querySelector('sherpa-data-grid')!.shadowRoot!;
    const cell = sr.querySelector('.row .cell[data-field="plan"]')!;
    const chip = sr.querySelector('.cell-filter')!;
    const range = document.createRange();
    range.selectNodeContents(cell.firstChild!);
    const line = range.getBoundingClientRect();
    const c = chip.getBoundingClientRect();
    return { home: chip.parentElement === cell, off: Math.abs((c.top + c.height / 2) - (line.top + line.height / 2)) };
  });
  expect(r.home).toBe(true);
  expect(r.off).toBeLessThanOrEqual(2);
});
