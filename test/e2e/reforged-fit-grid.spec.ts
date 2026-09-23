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
  // 1400 wide is TWELVE columns, so four data-col-span="small" items share one row.
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

const METRIC = '<div data-col-span="small" style="background:#eef">m</div>';
const FILLER = '<div data-col-span="full" data-grow style="background:#fee">F</div>';

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
    METRIC.repeat(4) + '<div data-col-span="full" style="background:#fee">LAST</div>');

  expect(bare.fillerH, 'the same answer either way').toBe(marked.fillerH);
});

test('a TALL row keeps its height; the filler takes the remainder', async ({ page }) => {
  const r = await build(page, 'fit',
    METRIC.repeat(4)
    + '<div data-col-span="full" style="background:#efe;height:200px">tall</div>'
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
  const tall = '<div data-col-span="full" style="background:#eef">r</div>'.repeat(8);
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
    + '<div data-col-span="full" style="background:#efe;height:800px">tall</div>');

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
        + '<div data-col-span="small">m</div><div data-col-span="small">m</div>'
        + '<div data-col-span="small">m</div><div data-col-span="small">m</div>'
        + '<div data-col-span="full" data-grow>F</div>'
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
    '<div data-col-span="full" style="background:#efe;height:300px">a</div>'
    + '<div data-col-span="full" style="background:#efe;height:300px">b</div>'
    + FILLER);

  expect(r.scrolls, 'the content is reachable, not clipped').toBe(true);
  // Two grid rows plus a gutter is the floor — never crushed to nothing.
  expect(r.fillerH).toBeGreaterThanOrEqual(144);
});

test('…and a grid that DOES fit still does not scroll', async ({ page }) => {
  const r = await build(page, 'fit',
    '<div data-col-span="full" style="background:#efe;height:100px">a</div>' + FILLER);

  expect(r.scrolls).toBe(false);
  expect(r.gridH).toBe(500);
});

/* ── Named column spans ─────────────────────────────────────────────── */

/**
 * A COLUMN SPAN IS A NAME, NOT A COUNT.
 *
 * A view says what a card IS and the breakpoint decides how many columns that
 * takes. Measured by VIEWPORT, because the bands are real media queries — an
 * inline --sherpa-layout-grid-columns override no longer changes anything.
 *
 * TRAP T-a-container-width-is-named-not-counted
 */
test('each name takes its declared span at each breakpoint', async ({ page }) => {
  const NAMES = ['full', 'reading', 'large', 'medium', 'small', 'xsmall'];

  const spansAt = async (width: number): Promise<string> => {
    await page.setViewportSize({ width, height: 800 });
    return page.evaluate(async (names) => {
      const root = document.getElementById('root')!;
      // One PER GRID: siblings of the same name wrap and confuse the reading.
      const out: number[] = [];
      for (const name of names) {
        root.innerHTML = '<div class="sherpa-grid">'
          + '<div data-col-span="' + name + '">x</div></div>';
        await new Promise((r) => setTimeout(r, 60));
        const grid = root.querySelector('.sherpa-grid')! as HTMLElement;
        const cs = getComputedStyle(grid);
        const inner = grid.clientWidth
          - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        const cols = Number(cs.getPropertyValue('--sherpa-layout-grid-columns').trim());
        const track = (inner + 16) / cols;
        out.push(Math.round((grid.children[0]!.getBoundingClientRect().width + 16) / track));
      }
      return out.join(' ');
    }, NAMES);
  };

  //                                full reading large medium small xsmall
  expect(await spansAt(1400), 'desktop, 12 columns').toBe('12 8 6 4 3 3');
  expect(await spansAt(900), 'tablet, 8 columns').toBe('8 8 8 4 4 2');
  expect(await spansAt(420), 'mobile, 4 columns').toBe('4 4 4 4 4 1');
});

/**
 * FIT IS A DESKTOP MODE.
 *
 * At tablet and mobile a view is read by SCROLLING, and pinning it to the fold
 * would squeeze every card to nothing on the way down.
 *
 * TRAP T-fit-is-a-desktop-mode
 */
test('below 1280 a fit grid is not pinned — it scrolls', async ({ page }) => {
  const measure = async (width: number): Promise<{ gridH: number; parentH: number }> => {
    await page.setViewportSize({ width, height: 600 });
    return page.evaluate(async () => {
      const { bindFitGrid } = await import('/dist/index.js') as {
        bindFitGrid: (el: HTMLElement) => () => void;
      };
      const root = document.getElementById('root')!;
      root.style.cssText = '';
      root.innerHTML = '<div style="height:400px">'
        + '<div class="sherpa-grid" data-rows="fit">'
        + '<div data-col-span="full" style="height:300px">a</div>'
        + '<div data-col-span="full" style="height:300px">b</div>'
        + '<div data-col-span="full" data-grow>F</div></div></div>';
      const grid = root.querySelector<HTMLElement>('.sherpa-grid')!;
      bindFitGrid(grid);
      await new Promise((r) => setTimeout(r, 200));
      return {
        gridH: Math.round(grid.getBoundingClientRect().height),
        parentH: Math.round(grid.parentElement!.getBoundingClientRect().height),
      };
    });
  };

  const tablet = await measure(900);
  expect(tablet.gridH, 'it grows past its box and the page scrolls')
    .toBeGreaterThan(tablet.parentH);

  const desktop = await measure(1400);
  expect(desktop.gridH, 'pinned to its box').toBe(desktop.parentH);
});

/* ── A named container width ────────────────────────────────────────── */

/**
 * A STRANDED CONTAINER FILLS ITS ROW.
 *
 * When the last container of a width class sits alone on its final row, it
 * takes what is left rather than stranding a gap. Measured on Records at
 * tablet before the change: the gauge used 406 of 828px, half the row empty.
 *
 * `:nth-child(An + 1 of S)` is what makes this possible — `of S` counts only
 * siblings of the SAME width, which `sibling-count()` cannot do.
 *
 * TRAP T-a-stranded-container-fills-its-row
 */
test('the last of a width class fills its row when alone', async ({ page }) => {
  const measure = async (width: number, run: number): Promise<string[]> => {
    await page.setViewportSize({ width, height: 800 });
    return page.evaluate((run) => {
      const root = document.getElementById('root')!;
      root.innerHTML = '<div class="sherpa-grid">'
        + '<div data-col-span="medium">m</div>'.repeat(run) + '</div>';
      const grid = root.querySelector('.sherpa-grid')! as HTMLElement;
      // The CONTENT box: the grid carries its own side padding, so the outer
      // width never reaches 100% and a full row reads as 96%.
      const cs = getComputedStyle(grid);
      const gw = grid.clientWidth
        - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const rows = new Map<number, Element[]>();
      for (const c of grid.children) {
        const t = Math.round(c.getBoundingClientRect().top);
        if (!rows.has(t)) rows.set(t, []);
        rows.get(t)!.push(c);
      }
      // Percentage of the grid each ROW occupies.
      return [...rows.values()].map((row) => {
        const used = row.reduce((a, c) => a + c.getBoundingClientRect().width, 0)
          + (row.length - 1) * 16;
        return Math.round(used / gw * 100) + '%';
      });
    }, run);
  };

  // Tablet is 8 columns, so a medium is 2-across: an odd run strands the last.
  expect(await measure(900, 2), 'a full row needs no rescue').toEqual(['100%']);
  expect(await measure(900, 3), 'the third fills the second row').toEqual(['100%', '100%']);
  expect(await measure(900, 4)).toEqual(['100%', '100%']);

  // Desktop is 12 columns, so a medium is 3-across — and the TABLET rule must
  // not leak up here, which is why each band is range-scoped.
  expect(await measure(1400, 3), 'three thirds, nothing stretched').toEqual(['100%']);
  expect(await measure(1400, 4), 'the fourth is alone, so it fills').toEqual(['100%', '100%']);
});

/**
 * ROW SPANS AND TRACK COUNTS.
 *
 * `data-row-span` is only meaningful where the rows HAVE a height — that is
 * `data-rows="fixed"`. In the default mode rows are `auto`, so a span collapses
 * to the content and says nothing.
 *
 * `data-col-count` / `data-row-count` override the breakpoint's own tracks, for
 * a grid that is not the page's main content area.
 */
test('a row span needs rows with a height', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  const r = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    const out: Record<string, number> = {};
    for (const mode of ['', 'fixed']) {
      root.innerHTML = '<div style="height:900px">'
        + '<div class="sherpa-grid"' + (mode ? ' data-rows="' + mode + '"' : '') + '>'
        + '<div data-col-span="medium" data-row-span="6">A</div>'
        + '<div data-col-span="medium">B</div></div></div>';
      await new Promise((r) => setTimeout(r, 80));
      out[mode || 'default'] = Math.round(
        root.querySelector('.sherpa-grid')!.children[0]!.getBoundingClientRect().height);
    }
    return out;
  });

  // 6 rows of 64px plus 5 gutters of 16px.
  expect(r['fixed'], 'six real rows').toBe(6 * 64 + 5 * 16);
  // Nowhere near six rows — it hugs. Engines differ by a pixel or two on
  // the exact hug height, so this asserts the KIND of answer, not the value.
  expect(r['default'], 'auto rows hug the content instead')
    .toBeLessThan(6 * 64 + 5 * 16);
});

test('col and row counts override the breakpoint tracks', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  const r = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    root.innerHTML = '<div class="sherpa-grid" data-col-count="5"><div>x</div></div>';
    await new Promise((r) => setTimeout(r, 80));
    const grid = root.querySelector('.sherpa-grid')! as HTMLElement;
    return getComputedStyle(grid).gridTemplateColumns.split(' ').length;
  });
  expect(r, 'five tracks, not the breakpoint twelve').toBe(5);
});
