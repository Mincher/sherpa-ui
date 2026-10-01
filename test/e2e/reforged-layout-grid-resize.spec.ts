import { test, expect } from './harness';

/**
 * A LAYOUT GRID RESIZED FROM ITS GUTTERS — Will, TODO 177: "As an app setting,
 * let me enable the ability to resize layout grid content using handles in the
 * gutters between containers/elements."
 * TRAP T-a-gutter-moves-a-line · TRAP T-a-handle-is-never-restamped-mid-drag
 */

/** The Dashboard's shape: four metrics, three charts, one wide line chart. */
const DASHBOARD = [
  ...['m1', 'm2', 'm3', 'm4'].map((id) =>
    `<div id="${id}" data-col-span="xsmall" data-min-row-span="1" data-label="Metric ${id}">${id}</div>`),
  ...['c1', 'c2', 'c3'].map((id) =>
    `<div id="${id}" data-col-span="medium" data-min-row-span="2"><div data-heading="Chart ${id}">${id}</div></div>`),
  '<div id="line" data-col-span="full" data-min-row-span="2" data-heading="Trend">line</div>',
].join('');

type Handle = { key: string; orientation: string | null; label: string | null; x: number; y: number; w: number; h: number };

/** Mount a grid; return its handles as drawn, in page px. */
const mount = (page: import('@playwright/test').Page, attrs: string, inner = DASHBOARD) =>
  page.evaluate(async ([attrs, inner]) => {
    const root = document.getElementById('root')!;
    root.innerHTML = `<sherpa-layout-grid ${attrs}>${inner}</sherpa-layout-grid>`;
    const grid = root.firstElementChild as HTMLElement & { rendered: Promise<void> };
    await grid.rendered;
    await window.__settled();
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    return [...grid.shadowRoot!.querySelectorAll<HTMLElement>('.handle')].map((h): Handle => {
      const r = h.getBoundingClientRect();
      return {
        key: h.dataset['key'] ?? '', orientation: h.getAttribute('aria-orientation'), label: h.getAttribute('aria-label'),
        x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
      };
    });
  }, [attrs, inner] as const);

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
});

test('no handles unless it is resizable, ungrouped, uncounted, wide enough, left to right, and every child has an id', async ({ page }) => {
  const warned: string[] = [];
  page.on('console', (m) => { if (m.type() === 'warning') warned.push(m.text()); });
  const counts: Record<string, number> = {
    plain: (await mount(page, '')).length,
    grouped: (await mount(page, 'data-resizable data-grouped')).length,
    counted: (await mount(page, 'data-resizable data-col-count="12"')).length,
    rtl: (await mount(page, 'data-resizable dir="rtl"')).length,
    noId: (await mount(page, 'data-resizable', DASHBOARD.replace('id="c2" ', ''))).length,
  };
  await page.setViewportSize({ width: 700, height: 900 });
  counts['phone'] = (await mount(page, 'data-resizable')).length;
  expect(counts).toEqual({ plain: 0, grouped: 0, counted: 0, rtl: 0, noId: 0, phone: 0 });
  expect(warned.filter((w) => w.includes('needs an id'))).toHaveLength(1);
});

test('a handle in each gutter: between cards in a row, and under each row', async ({ page }) => {
  const handles = await mount(page, 'data-resizable');
  const kids = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#root sherpa-layout-grid > *')]
    .map((k) => { const r = k.getBoundingClientRect(); return [k.id, { l: Math.round(r.left), r: Math.round(r.right), b: Math.round(r.bottom) }]; })));
  const cols = handles.filter((h) => h.orientation === 'vertical');
  const rows = handles.filter((h) => h.orientation === 'horizontal');

  expect(cols.map((h) => h.key)).toEqual(['c:m1', 'c:m2', 'c:m3', 'c:c1', 'c:c2']);
  expect(rows.map((h) => h.key)).toEqual(['r:m1', 'r:c1', 'r:end']);
  // Each sits IN its gutter: from one card's right edge to the next one's left.
  expect(cols.map((h) => [h.x, h.x + h.w])).toEqual([['m1', 'm2'], ['m2', 'm3'], ['m3', 'm4'], ['c1', 'c2'], ['c2', 'c3']]
    .map(([a, b]) => [kids[a!]!.r, kids[b!]!.l]));
  expect(rows[0]!.y).toBe(kids['m1']!.b);
  expect(cols.map((h) => h.label)).toEqual(['Width of Metric m1', 'Width of Metric m2', 'Width of Metric m3',
    'Width of Chart c1', 'Width of Chart c2']);
  expect(rows.map((h) => h.label)).toEqual(['Height of row 1', 'Height of row 2', 'Height of row 3']);
});

test('a resize that keeps the same handles moves the same nodes', async ({ page }) => {
  await mount(page, 'data-resizable');
  const r = await page.evaluate(async () => {
    const grid = document.querySelector('#root sherpa-layout-grid')!;
    const before = [...grid.shadowRoot!.querySelectorAll('.handle')];
    const x = getComputedStyle(before[0]!).left;
    (document.getElementById('root') as HTMLElement).style.inlineSize = '1300px';
    // The observer reports after a layout, and the grid draws on the frame after that.
    for (let i = 0; i < 3; i++) await new Promise<void>((res) => requestAnimationFrame(() => res()));
    const after = [...grid.shadowRoot!.querySelectorAll('.handle')];
    return { same: before.length === after.length && before.every((n, i) => n === after[i]), moved: getComputedStyle(after[0]!).left !== x };
  });
  expect(r).toEqual({ same: true, moved: true });
});

/* ── moving a line ───────────────────────────────────────────────────── */

type Page = import('@playwright/test').Page;

/** Mount `inner` in a resizable grid, listening for its reports. */
const build = (page: Page, inner: string, attrs = '', box = '') => page.evaluate(async ([inner, attrs, box]) => {
  const root = document.getElementById('root')!;
  root.innerHTML = `<div style="${box}"><sherpa-layout-grid data-resizable ${attrs}>${inner}</sherpa-layout-grid></div>`;
  const grid = root.querySelector('sherpa-layout-grid') as HTMLElement & { rendered: Promise<void> };
  (window as unknown as { __heard: unknown[] }).__heard = [];
  grid.addEventListener('layout-change', (e) => (window as unknown as { __heard: unknown[] }).__heard.push((e as CustomEvent).detail));
  await grid.rendered;
  await window.__settled();
  for (let i = 0; i < 3; i++) await new Promise<void>((r) => requestAnimationFrame(() => r()));
}, [inner, attrs, box] as const);

/** The grid's pitches. */
const pitch = (page: Page) => page.evaluate(() => {
  const grid = document.querySelector('#root sherpa-layout-grid')!;
  const cs = getComputedStyle(grid);
  const track = parseFloat(cs.gridTemplateColumns.split(' ')[0]!);
  const rowH = parseFloat(cs.getPropertyValue('--sherpa-layout-grid-row-height'));
  return { x: track + parseFloat(cs.columnGap), y: rowH + parseFloat(cs.rowGap), rowH, gap: parseFloat(cs.rowGap) };
});

/** Drag a handle by whole-or-part pitches, with the real pointer. */
const drag = async (page: Page, key: string, dx: number, dy = 0) => {
  const c = await page.evaluate((key) => {
    const h = document.querySelector('#root sherpa-layout-grid')!.shadowRoot!.querySelector(`.handle[data-key="${key}"]`)!;
    const r = h.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, key);
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.mouse.move(c.x + dx / 2, c.y + dy / 2);
  await page.mouse.move(c.x + dx, c.y + dy);
  await page.mouse.up();
  await page.evaluate(async () => {
    await window.__settled();
    for (let i = 0; i < 3; i++) await new Promise<void>((r) => requestAnimationFrame(() => r()));
  });
};

/** Each child's laid-out columns and rows. */
const spans = (page: Page) => page.evaluate(() => {
  const grid = document.querySelector('#root sherpa-layout-grid')!;
  const cs = getComputedStyle(grid);
  const px = parseFloat(cs.gridTemplateColumns.split(' ')[0]!) + parseFloat(cs.columnGap);
  const py = parseFloat(cs.getPropertyValue('--sherpa-layout-grid-row-height')) + parseFloat(cs.rowGap);
  return Object.fromEntries([...grid.children].map((k) => {
    const r = k.getBoundingClientRect();
    return [k.id, `${Math.round((r.width + parseFloat(cs.columnGap)) / px)}x${Math.round((r.height + parseFloat(cs.rowGap)) / py)}`];
  }));
});

const heard = (page: Page) => page.evaluate(() => (window as unknown as { __heard: unknown[] }).__heard.length);
const reset = (page: Page) => page.evaluate(async () => {
  (document.querySelector('#root sherpa-layout-grid') as HTMLElement & { layout: unknown }).layout = null;
  await window.__settled();
  for (let i = 0; i < 3; i++) await new Promise<void>((r) => requestAnimationFrame(() => r()));
});

const card = (id: string, span: string, min: number, rows?: number) =>
  `<sherpa-container id="${id}" data-col-span="${span}" data-min-row-span="${min}"${rows ? ` data-row-span="${rows}"` : ''} data-heading="${id}"><div>${id}</div></sherpa-container>`;

test('widths: siblings at their minimum give nothing; the card across a line gives first, then the next', async ({ page }) => {
  await build(page, ['m1', 'm2', 'm3', 'm4'].map((id) => card(id, 'xsmall', 1)).join('')
    + ['c1', 'c2', 'c3'].map((id) => card(id, 'medium', 2)).join('') + card('line', 'full', 2));
  const p = await pitch(page);
  const out: Record<string, unknown> = {};

  // Four metrics at 3 + 3 + 3 + 3: no space anywhere.
  await drag(page, 'c:m1', 2 * p.x);
  await page.evaluate(() => (document.querySelector('#root sherpa-layout-grid')!.shadowRoot!
    .querySelector('.handle[data-key="c:m1"]') as HTMLElement).focus());
  await page.keyboard.press('ArrowRight');
  out.metrics = { spans: (await spans(page))['m1'], heard: await heard(page),
    max: await page.evaluate(() => document.querySelector('#root sherpa-layout-grid')!.shadowRoot!
      .querySelector('.handle[data-key="c:m1"]')!.getAttribute('aria-valuemax')) };

  const row = async () => { const s = await spans(page); return [s['c1'], s['c2'], s['c3']].map((v) => v!.split('x')[0]).join('/'); };
  for (const [name, dx] of [['a', 1.4], ['b', 2.6], ['c', 3.4]] as const) {
    await reset(page);
    await drag(page, 'c:c1', dx * p.x);
    out[name] = await row();
  }
  // The first width at a count freezes EVERY child at that count.
  out.frozen = await page.evaluate(() => [...document.querySelectorAll('#root sherpa-layout-grid > *')]
    .map((k) => `${k.id}:${k.getAttribute('data-col-span-12')}`));
  await reset(page);
  await drag(page, 'c:c1', -p.x);
  out.back = await row();
  await drag(page, 'c:c1', -p.x);
  out.further = await row();

  expect(out).toEqual({
    metrics: { spans: '3x1', heard: 0, max: '3' },
    a: '5/3/4', b: '6/3/3', c: '6/3/3',
    frozen: ['m1:3', 'm2:3', 'm3:3', 'm4:3', 'c1:6', 'c2:3', 'c3:3', 'line:12'],
    back: '3/5/4', further: '3/5/4',
  });
});

test('heights: a neighbouring row gives down to its highest min, then the page grows', async ({ page }) => {
  const bands = ['m1', 'm2', 'm3', 'm4'].map((id) => card(id, 'xsmall', 1, 1)).join('')
    + card('c1', 'medium', 2, 4) + card('c2', 'medium', 3, 4) + card('c3', 'medium', 2, 4)
    + card('line', 'full', 2, 4);
  await build(page, bands);
  const p = await pitch(page);
  const rows = async () => { const s = await spans(page); return ['m1', 'c1', 'line'].map((id) => s[id]!.split('x')[1]).join('/'); };
  const out: Record<string, string> = { start: await rows() };
  await drag(page, 'r:c1', 0, p.y);
  out.one = await rows();
  await reset(page);
  await drag(page, 'r:c1', 0, 3 * p.y);
  out.three = await rows();
  await reset(page);
  // Up into the charts: they stop at their highest min, 3.
  await drag(page, 'r:c1', 0, -3 * p.y);
  out.up = await rows();
  await reset(page);
  await drag(page, 'r:m1', 0, p.y);
  out.metrics = await rows();
  const m = await page.evaluate(() => Math.round(document.getElementById('m2')!.getBoundingClientRect().height));

  expect(out).toEqual({ start: '1/4/4', one: '1/5/3', three: '1/7/2', up: '1/3/5', metrics: '2/3/4' });
  expect(m).toBe(Math.round(2 * p.rowH + p.gap));
});

/** TRAP T-a-fit-grid-counts-its-resized-rows */
test('a fit grid: a row grows from the filler, only down to its floor; the row count follows', async ({ page }) => {
  // A fit grid states every row: metrics 1 + charts 3 + the filler = 5. TRAP T-a-fit-grid-needs-its-row-count
  await build(page, ['m1', 'm2', 'm3', 'm4'].map((id) => card(id, 'xsmall', 1, 1)).join('')
    + card('c1', 'medium', 2, 3) + card('c2', 'medium', 2, 3) + card('c3', 'medium', 2, 3)
    + '<div id="table" data-col-span="full" data-grow>records</div>',
  'data-rows="fit" data-row-count="5"', 'block-size: 900px');
  const p = await pitch(page);
  // More than the filler can give, inside the window: a pointer outside it is each engine's own.
  await drag(page, 'r:c1', 0, 4 * p.y);
  const r = await page.evaluate(() => {
    const grid = document.querySelector('#root sherpa-layout-grid') as HTMLElement & { layout: { rowCount?: number } };
    const t = document.getElementById('table')!.getBoundingClientRect();
    const g = grid.getBoundingClientRect();
    const cs = getComputedStyle(grid);
    return {
      tableBottom: Math.round(t.bottom), gridBottom: Math.round(g.bottom - parseFloat(cs.paddingBottom)),
      tableH: Math.round(t.height), rowCount: grid.layout.rowCount, authored: grid.dataset['rowCount'],
      charts: Math.round(document.getElementById('c1')!.getBoundingClientRect().height),
    };
  });
  // The filler keeps its floor of two rows (and the part-row left over), and ends at the grid's foot.
  expect(r.tableH).toBeGreaterThanOrEqual(Math.round(2 * p.rowH + p.gap));
  expect(r.tableH).toBeLessThan(Math.round(3 * p.rowH + 2 * p.gap));
  expect(r.tableBottom).toBe(r.gridBottom);
  expect(r.authored).toBe('5');
  const chartRows = Math.round((r.charts + p.gap) / p.y);
  expect(r.rowCount).toBe(1 + chartRows + 1);
});

test('keys move one track and report once; Home and End go to the ends; a drag reports once, on release', async ({ page }) => {
  await build(page, ['c1', 'c2', 'c3'].map((id) => card(id, 'medium', 2)).join(''));
  const p = await pitch(page);
  const handle = '.handle[data-key="c:c1"]';
  const aria = () => page.evaluate((s) => {
    const h = document.querySelector('#root sherpa-layout-grid')!.shadowRoot!.querySelector(s)!;
    return ['aria-valuenow', 'aria-valuemin', 'aria-valuemax', 'aria-valuetext'].map((a) => h.getAttribute(a)).join(' ');
  }, handle);
  const out: Record<string, unknown> = { aria: await aria() };
  await page.evaluate((s) => (document.querySelector('#root sherpa-layout-grid')!.shadowRoot!.querySelector(s) as HTMLElement).focus(), handle);
  await page.keyboard.press('ArrowRight');
  out.right = { spans: (await spans(page))['c1'], heard: await heard(page), aria: await aria() };
  await page.keyboard.press('End');
  out.end = (await spans(page))['c1'];
  await page.keyboard.press('Home');
  out.home = (await spans(page))['c1'];
  out.keysHeard = await heard(page);

  // One drag across three tracks: ONE report, and the held node stays the held node.
  await reset(page);
  const before = await heard(page);
  const c = await page.evaluate((s) => {
    const h = document.querySelector('#root sherpa-layout-grid')!.shadowRoot!.querySelector(s)!;
    (window as unknown as { __held: Element }).__held = h;
    const r = h.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, handle);
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  for (const k of [1, 2, 3]) {
    await page.mouse.move(c.x + k * p.x * 0.7, c.y);
    await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
  }
  const mid = await page.evaluate((s) => {
    const h = document.querySelector('#root sherpa-layout-grid')!.shadowRoot!.querySelector(`${s}[data-dragging]`);
    return { same: h === (window as unknown as { __held: Element }).__held, heard: (window as unknown as { __heard: unknown[] }).__heard.length };
  }, handle);
  await page.mouse.up();
  await page.evaluate(() => window.__settled());
  const report = await page.evaluate(() => {
    const grid = document.querySelector('#root sherpa-layout-grid') as HTMLElement & { layout: unknown };
    const all = (window as unknown as { __heard: { layout: unknown }[] }).__heard;
    return { count: all.length, equal: JSON.stringify(all.at(-1)!.layout) === JSON.stringify(grid.layout) };
  });

  expect(out).toEqual({
    aria: '4 3 6 4 of 12 columns',
    right: { spans: '5x1', heard: 1, aria: '5 3 6 5 of 12 columns' },
    end: '6x1', home: '3x1', keysHeard: 3,
  });
  expect(mid).toEqual({ same: true, heard: before });
  expect(report).toEqual({ count: before + 1, equal: true });
});

test('a layout put back is drawn the same and reports nothing; an incomplete one falls back to names', async ({ page }) => {
  const kids = ['c1', 'c2', 'c3'].map((id) => card(id, 'medium', 2, 2)).join('') + card('line', 'full', 2, 2);
  await build(page, kids);
  const p = await pitch(page);
  await drag(page, 'c:c1', p.x);
  await drag(page, 'r:c1', 0, p.y);
  const a = { layout: await page.evaluate(() => (document.querySelector('#root sherpa-layout-grid') as HTMLElement & { layout: unknown }).layout), spans: await spans(page) };

  await build(page, kids);
  await page.evaluate(async (layout) => {
    (document.querySelector('#root sherpa-layout-grid') as HTMLElement & { layout: unknown }).layout = layout;
    await window.__settled();
  }, a.layout);
  const b = { spans: await spans(page), heard: await heard(page) };

  // Missing one child's width at 12: widths go back to the names, heights stay.
  const partial = structuredClone(a.layout) as { byCount: Record<string, Record<string, { cols?: number }>> };
  delete partial.byCount['12']!['c3']!.cols;
  await page.evaluate(async (layout) => {
    (document.querySelector('#root sherpa-layout-grid') as HTMLElement & { layout: unknown }).layout = layout;
    await window.__settled();
  }, partial);
  const c = await spans(page);
  await reset(page);
  const cleared = await page.evaluate(() => [...document.querySelectorAll('#root sherpa-layout-grid > *')]
    .flatMap((k) => k.getAttributeNames().filter((n) => /^data-(col|row)-span-\d+$/.test(n))));

  expect(b).toEqual({ spans: a.spans, heard: 0 });
  expect([c['c1'], c['c2']]).toEqual(['4x3', '4x3']);
  expect(cleared).toEqual([]);
});
