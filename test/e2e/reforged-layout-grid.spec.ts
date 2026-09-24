import { expect, test } from '@playwright/test';

/**
 * THE CONTENT GRID — its row modes, and the ELEMENT that owns them.
 *
 * `.sherpa-grid` is a layout MIXIN: it works in any sized box, with or without
 * an app shell. Three modes:
 *
 *   (none)   rows size to their content and the area scrolls — unchanged
 *   fixed    every row one grid row high, and the area scrolls
 *   fit      every row one grid row high, and the LAST row takes the rest
 *
 * A fit grid needs no JS: `data-row-count` is authored and every child states
 * its spans, so no child's content can size a row.
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

/** Build a grid in a sized box and measure what came out. */
const build = async (
  page: import('@playwright/test').Page,
  mode: string,
  inner: string,
  rows = 0,
  boxH = 500,
): Promise<{
  gridH: number; fillerH: number; fillerTop: number; rowH: number; gap: number;
  heights: number[]; scrolls: boolean;
}> =>
  page.evaluate(async ([mode, inner, rows, boxH]) => {
    const root = document.getElementById('root')!;
    root.style.cssText = '';
    root.innerHTML =
      '<div style="height:' + boxH + 'px">'
      + '<div class="sherpa-grid"'
      + (mode ? ' data-rows="' + mode + '"' : '')
      + (rows ? ' data-row-count="' + rows + '"' : '') + '>'
      + inner + '</div></div>';
    await new Promise((r) => setTimeout(r, 100));

    const grid = root.querySelector<HTMLElement>('.sherpa-grid')!;
    const filler = grid.querySelector<HTMLElement>('[data-grow]')
      ?? (grid.lastElementChild as HTMLElement);
    const box = grid.getBoundingClientRect();
    const cs = getComputedStyle(grid);
    return {
      gridH: Math.round(box.height),
      fillerH: Math.round(filler.getBoundingClientRect().height),
      fillerTop: Math.round(filler.getBoundingClientRect().top - box.top),
      rowH: parseFloat(cs.getPropertyValue('--sherpa-layout-grid-row-height')),
      gap: parseFloat(cs.rowGap),
      heights: [...grid.children].map((c) => Math.round(c.getBoundingClientRect().height)),
      scrolls: grid.scrollHeight > grid.clientHeight + 1,
    };
  }, [mode, inner, rows, boxH] as const);

const METRIC = '<div data-col-span="small" style="background:#eef">m</div>';
const FILLER = '<div data-col-span="full" data-grow style="background:#fee">F</div>';
const PAD = 16;

/* ── fit ────────────────────────────────────────────────────────────── */

test('FIT fills its area, and the marked item takes what is left', async ({ page }) => {
  const r = await build(page, 'fit', METRIC.repeat(4) + FILLER, 2);

  expect(r.gridH, 'the grid is exactly its parent').toBe(500);
  expect(r.heights[0], 'a metric row is ONE grid row').toBe(r.rowH);
  expect(r.fillerH).toBe(500 - 2 * PAD - r.rowH - r.gap);
  expect(r.scrolls, 'a fit grid never scrolls').toBe(false);
});

test('with NO data-grow, the LAST child fills', async ({ page }) => {
  const marked = await build(page, 'fit', METRIC.repeat(4) + FILLER, 2);
  const bare = await build(page, 'fit',
    METRIC.repeat(4) + '<div data-col-span="full" style="background:#fee">LAST</div>', 2);

  expect(bare.fillerH, 'the same answer either way').toBe(marked.fillerH);
});

/* The reported bug: three cards spanning rows sat above the last card, the
   one flexible row fell inside them, and the last card hugged its content. */
test('items that SPAN rows above it do not steal the last row', async ({ page }) => {
  const card = '<div data-col-span="medium" data-row-span="2" style="background:#efe">c</div>';
  const r = await build(page, 'fit', METRIC.repeat(4) + card.repeat(3) + FILLER, 4, 600);

  expect(r.heights[4], 'a two-row card is two rows and a gutter').toBe(2 * r.rowH + r.gap);
  expect(r.fillerTop).toBe(PAD + 3 * r.rowH + 2 * r.gap + r.gap);
  expect(r.fillerH, 'the last card takes the rest').toBe(600 - PAD - r.fillerTop);
  expect(r.scrolls).toBe(false);
});

test('a row is one grid row whatever its content', async ({ page }) => {
  const tall = '<div data-col-span="small"><div style="height:300px">tall</div></div>';
  const r = await build(page, 'fit', tall + METRIC.repeat(3) + FILLER, 2);

  expect(r.heights[0], 'the content overflows; the row does not grow').toBe(r.rowH);
  expect(r.fillerTop).toBe(PAD + r.rowH + r.gap);
});

test('a grid of ONLY a filler gives it everything', async ({ page }) => {
  const r = await build(page, 'fit', FILLER, 1);
  expect(r.fillerH).toBe(500 - 2 * PAD);
});

/* ── fixed ──────────────────────────────────────────────────────────── */

test('FIXED gives every row the grid row height, and scrolls', async ({ page }) => {
  const r = await build(page, 'fixed',
    '<div data-col-span="full" style="background:#eef">r</div>'.repeat(8));

  expect(r.scrolls, 'eight grid rows do not fit 500px').toBe(true);
  expect(r.heights[0], 'one layout-grid row').toBe(r.rowH);
});

/* ── the default is neither ─────────────────────────────────────────── */

test('NO attribute is unchanged — rows hug, and it OVERFLOWS its parent', async ({ page }) => {
  const r = await build(page, '', METRIC.repeat(4)
    + '<div data-col-span="full" style="background:#efe;height:800px">tall</div>');

  /* It does not scroll ITSELF — it grows past its parent and whatever is above
     it scrolls, exactly as every view did before these modes existed. */
  expect(r.scrolls).toBe(false);
  expect(r.gridH, 'taller than the 500px box it sits in').toBeGreaterThan(500);
});

/* ── a MIXIN, not an app-shell feature ──────────────────────────────── */

test('it fits in ANY sized box — no app shell anywhere', async ({ page }) => {
  const heights = await page.evaluate(async () => {
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
        + '<div class="sherpa-grid" data-rows="fit" data-row-count="2">'
        + '<div data-col-span="small">m</div><div data-col-span="small">m</div>'
        + '<div data-col-span="small">m</div><div data-col-span="small">m</div>'
        + '<div data-col-span="full" data-grow>F</div>'
        + '</div>' + '</div>'.repeat(depth);
      await new Promise((r) => setTimeout(r, 100));
      out[name] = Math.round(root.querySelector<HTMLElement>('[data-grow]')!
        .getBoundingClientRect().height);
    }
    return out;
  });

  // The SAME height in every box: the only requirement is a sized parent.
  const values = Object.values(heights);
  expect(new Set(values).size, JSON.stringify(heights)).toBe(1);
  expect(values[0]).toBeGreaterThan(300);
});

/**
 * WHEN IT CANNOT FIT, IT SCROLLS.
 *
 * Rows above the filler may already exceed the area — tall cards in a short
 * window. Crushing the filler to nothing loses content, so the grid scrolls
 * instead and behaves like the default mode at that size.
 *
 * TRAP T-a-content-grid-has-two-row-modes
 */
test('a filler with no room hits its FLOOR and the grid scrolls', async ({ page }) => {
  const r = await build(page, 'fit',
    '<div data-col-span="full" data-row-span="4" style="background:#efe">a</div>' + FILLER, 5);

  expect(r.scrolls, 'the content is reachable, not clipped').toBe(true);
  // Two grid rows plus a gutter is the floor — never crushed to nothing.
  expect(r.fillerH).toBe(2 * r.rowH + r.gap);
});

test('…and a grid that DOES fit still does not scroll', async ({ page }) => {
  const r = await build(page, 'fit', '<div data-col-span="full">a</div>' + FILLER, 2);

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
      const root = document.getElementById('root')!;
      root.style.cssText = '';
      root.innerHTML = '<div style="height:400px">'
        + '<div class="sherpa-grid" data-rows="fit" data-row-count="3">'
        + '<div data-col-span="full" style="height:300px">a</div>'
        + '<div data-col-span="full" style="height:300px">b</div>'
        + '<div data-col-span="full" data-grow>F</div></div></div>';
      await new Promise((r) => setTimeout(r, 100));
      const grid = root.querySelector<HTMLElement>('.sherpa-grid')!;
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
 * `data-rows="fixed"` or `"fit"`. In the default mode rows are `auto`, so a span
 * collapses to the content and says nothing.
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
      const grid = root.querySelector<HTMLElement>('.sherpa-grid')!;
      out[mode || 'default'] = Math.round(grid.children[0]!.getBoundingClientRect().height);
      out.rowH = parseFloat(getComputedStyle(grid).getPropertyValue('--sherpa-layout-grid-row-height'));
      out.gap = parseFloat(getComputedStyle(grid).rowGap);
    }
    return out;
  });

  const six = 6 * r['rowH']! + 5 * r['gap']!;
  expect(r['fixed'], 'six real rows').toBe(six);
  // Nowhere near six rows — it hugs. Engines differ by a pixel or two on
  // the exact hug height, so this asserts the KIND of answer, not the value.
  expect(r['default'], 'auto rows hug the content instead').toBeLessThan(six);
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

/* ── The ELEMENT ──────────────────────────────────────────────────────── */

/**
 * The tracks are NOT in the component. They are `.sherpa-grid` in the generated
 * tokens.css, and the host WEARS that class — copying the rules into a shadow
 * sheet would fork the Figma projection, and a document class cannot reach a
 * shadow root anyway. TRAP T-a-document-class-cannot-reach-a-shadow-root
 */

const mount = async (page: import('@playwright/test').Page, html: string, attrs = '') =>
  page.evaluate(
    async ({ html, attrs }) => {
      await import('/dist/index.js');
      const root = document.getElementById('root')!;
      root.style.cssText = 'block-size: 600px';
      root.replaceChildren();
      const g = document.createElement('sherpa-layout-grid') as HTMLElement & { rendered?: Promise<void> };
      for (const pair of attrs.split(' ').filter(Boolean)) {
        const [k, v] = pair.split('=');
        g.setAttribute(k!, v ?? '');
      }
      g.innerHTML = html;
      root.appendChild(g);
      await g.rendered;
      await (window as unknown as { __settled: () => Promise<void> }).__settled();
      return null;
    },
    { html, attrs },
  );

const read = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const g = document.querySelector('sherpa-layout-grid') as HTMLElement;
    const cs = getComputedStyle(g);
    return {
      display: cs.display,
      columns: cs.gridTemplateColumns.split(' ').length,
      columnGap: cs.columnGap,
      // The CSS CLASS keeps Figma's name; only the ELEMENT is sherpa-layout-grid.
      wearsClass: g.classList.contains('sherpa-grid'),
      spans: [...g.children].map((c) => getComputedStyle(c).gridColumn),
    };
  });

test('the host wears the projected class, so the tokens reach it unchanged', async ({ page }) => {
  await mount(page, '<div data-col-span="medium">a</div><div data-col-span="small">b</div>');
  const r = await read(page);

  expect(r.wearsClass).toBe(true);
  expect(r.display).toBe('grid');
  // 12 tracks and a real gap prove the DOCUMENT rule applied to the host.
  expect(r.columns).toBe(12);
  expect(r.columnGap).not.toBe('0px');
  // The children are LIGHT DOM, so `.sherpa-grid > [data-col-span]` matches them.
  expect(r.spans).toEqual(['span 4', 'span 3']);
});

/**
 * A router detaches a view and re-attaches it. `signal` is a NEW
 * AbortController each connect, so a bind made in onRender — which fires once —
 * holds one that is already aborted. TRAP T-abort-controller-per-connect
 */
test('it still measures after a detach and re-attach', async ({ page }) => {
  await mount(page, '<div data-col-span="full">a</div>', 'data-grouped');

  const last = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    const g = document.querySelector('sherpa-layout-grid')!;
    g.remove();
    root.appendChild(g);
    const extra = document.createElement('div');
    extra.setAttribute('data-col-span', 'full');
    extra.textContent = 'b';
    g.appendChild(extra);
    for (let i = 0; i < 30 && !extra.hasAttribute('data-group'); i++) {
      await new Promise((r) => requestAnimationFrame(r));
    }
    return extra.getAttribute('data-group');
  });

  expect(last, 'the new child was measured').toBe('grid-bottom-solo');
});

test('data-col-count overrides the breakpoint', async ({ page }) => {
  await mount(page, '<div>a</div><div>b</div>', 'data-col-count=4');
  expect((await read(page)).columns).toBe(4);
});

/* ── data-grouped ─────────────────────────────────────────────────────── */

/**
 * GROUPED: every container reads as ONE stitched object.
 *
 * Will's ruling — this is grouping applied to the layout grid, not a second
 * mechanism. It writes each child's `data-group` and the existing grouping
 * blocks do the rest.
 *
 * The position is MEASURED, never derived from spans. `grid-column-start`
 * reports `span 4`, not the track auto-placement chose — verified in all three
 * engines — so CSS alone cannot find the first or last item in a row once a
 * span wraps. TRAP T-a-wrapping-span-hides-its-own-row
 */
const grouped = (page: import('@playwright/test').Page, on: boolean) =>
  page.evaluate(async (on) => {
    await import('/dist/index.js');
    const root = document.getElementById('root')!;
    const g = document.createElement('sherpa-layout-grid') as HTMLElement & {
      rendered?: Promise<void>;
    };
    if (on) g.setAttribute('data-grouped', '');
    // Three thirds, then a full-width row — the wrapping-span case.
    g.innerHTML =
      '<sherpa-container data-col-span="medium">a</sherpa-container>' +
      '<sherpa-container data-col-span="medium">b</sherpa-container>' +
      '<sherpa-container data-col-span="medium">c</sherpa-container>' +
      '<sherpa-container data-col-span="full">d</sherpa-container>';
    root.replaceChildren(g);
    await g.rendered;
    await Promise.all(
      [...g.children].map((c) => (c as HTMLElement & { rendered?: Promise<void> }).rendered),
    );
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    /* The measuring runs on a FRAME, and it re-runs when a child resizes — and
       four sherpa-containers finish rendering at their own pace. Wait for the
       answer to stop changing rather than for one frame. */
    if (on) {
      let last = '';
      for (let i = 0; i < 60; i++) {
        await new Promise((r) => requestAnimationFrame(r));
        const now = [...g.children].map((c) => c.getAttribute('data-group')).join();
        if (now === last && !now.includes('null')) break;
        last = now;
      }
    }
    const cs = getComputedStyle(g);
    return {
      gap: `${cs.columnGap}/${cs.rowGap}`,
      groups: [...g.children].map((c) => c.getAttribute('data-group')),
      corners: [...g.children].map((c) => {
        const s = getComputedStyle(c);
        return [s.borderTopLeftRadius, s.borderTopRightRadius,
                s.borderBottomLeftRadius, s.borderBottomRightRadius].join(' ');
      }),
    };
  }, on);

test('without data-grouped the gutters stay and no child is positioned', async ({ page }) => {
  const r = await grouped(page, false);
  expect(r.gap).not.toBe('0px/0px');
  expect(r.groups).toEqual([null, null, null, null]);
});

test('data-grouped drops the gutters and positions every child', async ({ page }) => {
  const r = await grouped(page, true);

  /* The gutters go via the TOKENS, not `column-gap`. `.sherpa-grid` is a
     DOCUMENT rule and a document rule beats an adopted `:host` one at any
     specificity. TRAP T-a-document-rule-outranks-an-adopted-host-rule */
  expect(r.gap).toBe('0px/0px');

  // Three across the top, then one alone on the bottom row.
  expect(r.groups).toEqual([
    'grid-top-start', 'grid-top-mid', 'grid-top-end', 'grid-bottom-solo',
  ]);
});

test('a grouped grid rounds only its four outer corners', async ({ page }) => {
  const r = await grouped(page, true);

  // tl on the first, tr on the third, and both bottom corners on the last row.
  expect(r.corners[0]).toBe('4px 0px 0px 0px');
  expect(r.corners[1]).toBe('0px 0px 0px 0px');
  expect(r.corners[2]).toBe('0px 4px 0px 0px');
  expect(r.corners[3]).toBe('0px 0px 4px 4px');
});
