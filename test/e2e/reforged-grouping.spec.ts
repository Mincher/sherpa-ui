/**
 * GROUPING — a row, a column or a grid of controls reads as ONE object.
 *
 * Every assertion reads the custom PROPERTY, never the border: these edges are
 * deliberately sub-pixel and `getComputedStyle` rounds each one up to "1px".
 * TRAP T-a-sub-pixel-border-reads-back-as-1px.
 */
import { test, expect } from '@playwright/test';

const HARNESS = '/test/reforged/harness.html';

/**
 * A live host whose SHARED SHEETS have landed.
 *
 * `__settled()` resolves when the component has rendered — the shared sheets
 * are fetched separately and can arrive after it, so waiting on that alone
 * reads a shadow root that has only its own CSS. Every group value then falls
 * back to the registered initial (0), which looks exactly like a broken
 * selector. Wait for the sheet itself.
 */
const HOST_FN = `window.makeHost = async function makeHost() {
  const host = document.createElement('sherpa-button');
  host.textContent = 'x';
  document.body.append(host);
  await customElements.whenDefined('sherpa-button');
  await host.__settled?.();
  const has = () => [...host.shadowRoot.adoptedStyleSheets].some((s) => {
    try { return [...s.cssRules].some((r) => r.cssText.includes('sherpa-group')); }
    catch { return false; }
  });
  for (let i = 0; i < 100 && !has(); i++) await new Promise((r) => requestAnimationFrame(r));
  return host;
};`;

declare function makeHost(): Promise<HTMLElement>;

/** Inject the helper into every page in this file, before any script runs. */
test.beforeEach(async ({ page }) => {
  await page.addInitScript(HOST_FN);
  await page.goto(HARNESS);
});


/** Build a group inside a real shadow root and read every child's edges. */
async function edges(
  page: import('@playwright/test').Page,
  cls: string,
  count: number,
  cols?: number,
) {
  return page.evaluate(
    async ({ cls, count, cols }) => {
      const host = await makeHost();

      const wrap = document.createElement('div');
      wrap.className = cls;
      if (cols != null) wrap.style.setProperty('--cols', String(cols));
      for (let i = 0; i < count; i++) wrap.append(document.createElement('span'));
      host.shadowRoot!.append(wrap);

      return [...wrap.children].map((cell) => {
        const s = getComputedStyle(cell);
        const p = (n: string) => s.getPropertyValue(n).trim();
        return {
          left: p('--sherpa-border-left'),
          top: p('--sherpa-border-top'),
          tl: p('--sherpa-border-rounding-top-left'),
          tr: p('--sherpa-border-rounding-top-right'),
          bl: p('--sherpa-border-rounding-bottom-left'),
          br: p('--sherpa-border-rounding-bottom-right'),
        };
      });
    },
    { cls, count, cols },
  );
}

const THICK = '0.5px'; // an outer edge
const THIN = '0.25px'; // a shared hairline, drawn once
const ROUND = '4px';
const SQUARE = '0px';

test('a horizontal group rounds its ends and shares its inner edges', async ({ page }) => {
  const cells = await edges(page, 'sherpa-group', 3);

  expect(cells[0]).toMatchObject({ left: THICK, tl: ROUND, bl: ROUND, tr: SQUARE });
  expect(cells[1]).toMatchObject({ left: THIN, tl: SQUARE, tr: SQUARE });
  expect(cells[2]).toMatchObject({ left: THIN, tr: ROUND, br: ROUND, tl: SQUARE });
});

test('a vertical group does the same along the block axis', async ({ page }) => {
  const cells = await edges(page, 'sherpa-group sherpa-group-vertical', 3);

  expect(cells[0]).toMatchObject({ top: THICK, tl: ROUND, tr: ROUND });
  expect(cells[1]).toMatchObject({ top: THIN, tl: SQUARE, bl: SQUARE });
  expect(cells[2]).toMatchObject({ top: THIN, bl: ROUND, br: ROUND });
});

/**
 * The grid computes each cell's own column and row from `--cols` and
 * `sibling-index()`, because `:nth-child()` will not take a `var()`.
 * TRAP T-a-grid-group-computes-its-own-position.
 */
test('a 3x2 grid draws four outer corners and shares every inner edge', async ({ page }) => {
  const cells = await edges(page, 'sherpa-group-grid', 6, 3);

  // Column 0 owns the outer start edge; row 0 owns the outer top edge.
  expect(cells.map((c) => c.left)).toEqual([THICK, THIN, THIN, THICK, THIN, THIN]);
  expect(cells.map((c) => c.top)).toEqual([THICK, THICK, THICK, THIN, THIN, THIN]);

  // Exactly four corners round, one per corner of the whole block.
  expect(cells[0]!.tl).toBe(ROUND);
  expect(cells[2]!.tr).toBe(ROUND);
  expect(cells[3]!.bl).toBe(ROUND);
  expect(cells[5]!.br).toBe(ROUND);
  expect(cells[1]).toMatchObject({ tl: SQUARE, tr: SQUARE, bl: SQUARE, br: SQUARE });
  expect(cells[4]).toMatchObject({ tl: SQUARE, tr: SQUARE, bl: SQUARE, br: SQUARE });
});

test('a PARTIAL last row still finds its bottom corner', async ({ page }) => {
  // 7 cells in 3 columns: the last row holds one cell, at column 0.
  const cells = await edges(page, 'sherpa-group-grid', 7, 3);

  // The last row is derived from sibling-count(), so it is row 2, not row 1.
  expect(cells[6]!.bl).toBe(ROUND);
  expect(cells[3]!.bl).toBe(SQUARE);
  // Nothing sits at the bottom-right, so no cell claims that corner — honest,
  // rather than rounding whichever cell happens to be last.
  expect(cells.map((c) => c.br)).toEqual(Array(7).fill(SQUARE));
});

/**
 * `@property` cannot register from an adopted sheet, so the five
 * `--sherpa-group-*` are declared in tokens.css. Without registration the
 * value stays an untyped string and every `if(style(...))` takes its `else` —
 * which reads as a grid that merely looks unjoined.
 * TRAP T-at-property-needs-the-document.
 */
test('the group properties are registered, so the position COMPUTES', async ({ page }) => {
  const computed = await page.evaluate(async () => {
    const host = await makeHost();

    const wrap = document.createElement('div');
    wrap.className = 'sherpa-group-grid';
    wrap.style.setProperty('--cols', '3');
    for (let i = 0; i < 6; i++) wrap.append(document.createElement('span'));
    host.shadowRoot!.append(wrap);

    return [...wrap.children].map((c) => {
      const s = getComputedStyle(c);
      return `${s.getPropertyValue('--sherpa-group-col').trim()},${s
        .getPropertyValue('--sherpa-group-row')
        .trim()}`;
    });
  });

  // A NUMBER, not the literal "calc(sibling-index() - 1)" an unregistered
  // property hands back.
  expect(computed).toEqual(['0,0', '1,0', '2,0', '0,1', '1,1', '2,1']);
});
