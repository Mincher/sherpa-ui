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
