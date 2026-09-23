import { expect, test } from '@playwright/test';

/**
 * THE CONTENT GRID'S TWO ROW MODES.
 *
 * `.sherpa-grid` is a layout MIXIN: it works in any sized box, with or without
 * an app shell. Three modes:
 *
 *   (none)   rows size to their content and the area scrolls — unchanged
 *   fixed    every row one grid row high, and the area scrolls
 *   fit      rows hug, the grid fills its area, and one item takes the rest
 *
 * TRAP T-a-content-grid-has-two-row-modes
 * TRAP T-a-fit-grid-needs-its-row-count
 * TRAP T-a-fit-grid-needs-a-sized-parent
 */
test.beforeEach(async ({ page }) => {
  await page.goto('/test/reforged/harness.html');
  // 1400 wide is TWELVE columns, so four data-span="3" items share one row.
  await page.setViewportSize({ width: 1400, height: 800 });
});

/** Build a grid in a 500px box and measure what came out. */
const build = async (
  page: import('@playwright/test').Page,
  mode: string,
  inner: string,
): Promise<{
  gridH: number; fitRows: string; fillerH: number; fillerTop: number;
  rowTops: number[]; scrolls: boolean;
}> =>
  page.evaluate(async ([mode, inner]) => {
    const { bindFitGrid } = await import('/dist/index.js') as {
      bindFitGrid: (el: HTMLElement) => () => void;
    };
    const root = document.getElementById('root')!;
    root.style.cssText = '';
    root.innerHTML =
      '<div style="height:500px">'
      + '<div class="sherpa-grid"' + (mode ? ' data-rows="' + mode + '"' : '') + '>'
      + inner + '</div></div>';

    const grid = root.querySelector<HTMLElement>('.sherpa-grid')!;
    bindFitGrid(grid);
    await new Promise((r) => setTimeout(r, 200));

    const filler = grid.querySelector<HTMLElement>('[data-grow]')
      ?? (grid.lastElementChild as HTMLElement);
    const box = grid.getBoundingClientRect();
    return {
      gridH: Math.round(box.height),
      fitRows: grid.style.getPropertyValue('--_fit-rows'),
      fillerH: Math.round(filler.getBoundingClientRect().height),
      fillerTop: Math.round(filler.getBoundingClientRect().top - box.top),
      rowTops: [...new Set([...grid.children]
        .map((c) => Math.round(c.getBoundingClientRect().top)))],
      scrolls: grid.scrollHeight > grid.clientHeight + 1,
    };
  }, [mode, inner] as const);

const METRIC = '<div data-span="3" style="background:#eef">m</div>';
const FILLER = '<div data-span="full" data-grow style="background:#fee">F</div>';

/* ── fit ────────────────────────────────────────────────────────────── */

test('FIT fills its area, and the marked item takes what is left', async ({ page }) => {
  const r = await build(page, 'fit', METRIC.repeat(4) + FILLER);

  expect(r.gridH, 'the grid is exactly its parent').toBe(500);
  expect(r.rowTops.length, 'four metrics share one row, the filler is the second').toBe(2);
  expect(r.fitRows, 'ONE row above the filler').toBe('1');
  // 500 - 16 padding * 2 - 18 metric - 16 gap.
  expect(r.fillerH).toBeGreaterThan(400);
  expect(r.scrolls, 'a fit grid never scrolls').toBe(false);
});

test('with NO data-grow, the LAST child fills', async ({ page }) => {
  const marked = await build(page, 'fit', METRIC.repeat(4) + FILLER);
  const bare = await build(page, 'fit',
    METRIC.repeat(4) + '<div data-span="full" style="background:#fee">LAST</div>');

  expect(bare.fillerH, 'the same answer either way').toBe(marked.fillerH);
});

test('a TALL row keeps its height; the filler takes the remainder', async ({ page }) => {
  const r = await build(page, 'fit',
    METRIC.repeat(4)
    + '<div data-span="full" style="background:#efe;height:200px">tall</div>'
    + FILLER);

  expect(r.fitRows).toBe('2');
  // The tall row is 200; what is left goes to the filler, and nothing scrolls.
  expect(r.fillerH).toBeGreaterThan(150);
  expect(r.fillerH).toBeLessThan(250);
  expect(r.scrolls).toBe(false);
});

test('a grid of ONLY a filler gives it everything', async ({ page }) => {
  const r = await build(page, 'fit', FILLER);
  expect(r.fitRows, 'no rows above it').toBe('0');
  expect(r.fillerH).toBeGreaterThan(450);
});

/* ── fixed ──────────────────────────────────────────────────────────── */

test('FIXED gives every row the grid row height, and scrolls', async ({ page }) => {
  const tall = '<div data-span="full" style="background:#eef">r</div>'.repeat(8);
  const r = await build(page, 'fixed', tall);

  expect(r.scrolls, 'eight 64px rows do not fit 500px').toBe(true);
  const rowH = await page.evaluate(() => {
    const grid = document.querySelector<HTMLElement>('.sherpa-grid')!;
    return Math.round(grid.children[0]!.getBoundingClientRect().height);
  });
  expect(rowH, 'one layout-grid row').toBe(64);
});

/* ── the default is neither ─────────────────────────────────────────── */

test('NO attribute is unchanged — rows hug, and it OVERFLOWS its parent', async ({ page }) => {
  const r = await build(page, '', METRIC.repeat(4)
    + '<div data-span="full" style="background:#efe;height:800px">tall</div>');

  expect(r.fitRows, 'nothing is written on a grid that did not ask').toBe('');
  /* It does not scroll ITSELF — it grows past its parent and whatever is above
     it scrolls, exactly as every view did before these modes existed. */
  expect(r.scrolls).toBe(false);
  expect(r.gridH, 'taller than the 500px box it sits in').toBeGreaterThan(500);
});

/* ── a MIXIN, not an app-shell feature ──────────────────────────────── */

test('it fits in ANY sized box — no app shell anywhere', async ({ page }) => {
  const heights = await page.evaluate(async () => {
    const { bindFitGrid } = await import('/dist/index.js') as {
      bindFitGrid: (el: HTMLElement) => () => void;
    };
    const wrappers: Record<string, string> = {
      plain: '<div style="height:500px">',
      flexChild: '<div style="height:500px;display:flex;flex-direction:column">'
        + '<div style="flex:1;min-height:0">',
      gridCell: '<div style="height:500px;display:grid;grid-template-rows:1fr">'
        + '<div style="min-height:0">',
    };
    const out: Record<string, number> = {};
    for (const [name, open] of Object.entries(wrappers)) {
      const root = document.getElementById('root')!;
      root.style.cssText = '';
      const depth = (open.match(/<div/g) ?? []).length;
      root.innerHTML = open
        + '<div class="sherpa-grid" data-rows="fit">'
        + '<div data-span="3">m</div><div data-span="3">m</div>'
        + '<div data-span="3">m</div><div data-span="3">m</div>'
        + '<div data-span="full" data-grow>F</div>'
        + '</div>' + '</div>'.repeat(depth);
      const grid = root.querySelector<HTMLElement>('.sherpa-grid')!;
      bindFitGrid(grid);
      await new Promise((r) => setTimeout(r, 200));
      out[name] = Math.round(
        grid.querySelector<HTMLElement>('[data-grow]')!.getBoundingClientRect().height);
    }
    return out;
  });

  // The SAME height in every box: the only requirement is a sized parent.
  const values = Object.values(heights);
  expect(new Set(values).size, JSON.stringify(heights)).toBe(1);
  expect(values[0]).toBeGreaterThan(400);
});

/**
 * WHEN IT CANNOT FIT, IT SCROLLS.
 *
 * Rows above the filler may already exceed the area — three fixed-height cards
 * in a short window. Crushing the filler to nothing loses content, so the grid
 * scrolls instead and behaves like the default mode at that size.
 *
 * TRAP T-a-content-grid-has-two-row-modes
 */
test('a filler with no room hits its FLOOR and the grid scrolls', async ({ page }) => {
  const r = await build(page, 'fit',
    // Two 300px rows in a 500px box: 600px before the filler even starts.
    '<div data-span="full" style="background:#efe;height:300px">a</div>'
    + '<div data-span="full" style="background:#efe;height:300px">b</div>'
    + FILLER);

  expect(r.scrolls, 'the content is reachable, not clipped').toBe(true);
  // Two grid rows plus a gutter is the floor — never crushed to nothing.
  expect(r.fillerH).toBeGreaterThanOrEqual(144);
});

test('…and a grid that DOES fit still does not scroll', async ({ page }) => {
  const r = await build(page, 'fit',
    '<div data-span="full" style="background:#efe;height:100px">a</div>' + FILLER);

  expect(r.scrolls).toBe(false);
  expect(r.gridH).toBe(500);
});
