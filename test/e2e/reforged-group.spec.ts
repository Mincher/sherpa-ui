import { test, expect } from './harness';

/**
 * sherpa-group — a row, column or grid that reads as ONE object.
 *
 * The WRAPPER owns the bookkeeping. Children carry no `data-group`, and a
 * re-order, insert or delete needs nothing from anyone: position is DERIVED,
 * by `:first-child` / `:last-child` for a row, and by `sibling-index()` for a
 * grid.
 *
 * It works because `::slotted()` sets CUSTOM PROPERTIES, which inherit through
 * a child's own shadow boundary where a class cannot reach.
 * TRAP T-a-document-class-cannot-reach-a-shadow-root
 */

const THICK = '0.5px'; // an outer edge
const THIN = '0.25px'; // a shared hairline, drawn once
const ROUND = '4px';
const SQUARE = '0px';

/** Build a group and read every child's edges — the PROPERTY, never the border. */
const edges = (
  page: import('@playwright/test').Page,
  count: number,
  attrs = '',
): Promise<Array<Record<string, string>>> =>
  page.evaluate(
    async ({ count, attrs }) => {
      await import('/dist/index.js');
      const el = document.createElement('sherpa-group') as HTMLElement & {
        rendered?: Promise<void>;
      };
      for (const pair of attrs.split(' ').filter(Boolean)) {
        const [k, v] = pair.split('=');
        el.setAttribute(k!, v ?? '');
      }
      el.innerHTML = Array.from({ length: count }, (_, i) => `<i>${i}</i>`).join('');
      document.getElementById('root')!.replaceChildren(el);
      await el.rendered;
      await (window as unknown as { __settled: () => Promise<void> }).__settled();
      return [...el.children].map((c) => {
        const s = getComputedStyle(c);
        const p = (n: string): string => s.getPropertyValue(n).trim();
        return {
          left: p('--sherpa-border-left'),
          right: p('--sherpa-border-right'),
          top: p('--sherpa-border-top'),
          tl: p('--sherpa-border-rounding-top-left'),
          tr: p('--sherpa-border-rounding-top-right'),
          bl: p('--sherpa-border-rounding-bottom-left'),
          br: p('--sherpa-border-rounding-bottom-right'),
        };
      });
    },
    { count, attrs },
  );

test('a row rounds its ends and halves every shared edge', async ({ page }) => {
  const cells = await edges(page, 3);

  // The shared edge is HALVED on BOTH sides — each neighbour draws 0.25px and
  // the joint reads 0.5px. TRAP T-a-shared-edge-is-halved-on-both-sides
  expect(cells[0]).toMatchObject({ left: THICK, right: THIN, tl: ROUND, bl: ROUND, tr: SQUARE });
  expect(cells[1]).toMatchObject({ left: THIN, right: THIN, tl: SQUARE, tr: SQUARE });
  expect(cells[2]).toMatchObject({ left: THIN, right: THICK, tr: ROUND, br: ROUND, tl: SQUARE });
});

test('a column does the same along the block axis', async ({ page }) => {
  const cells = await edges(page, 3, 'data-direction=column');

  expect(cells[0]).toMatchObject({ top: THICK, tl: ROUND, tr: ROUND, bl: SQUARE });
  expect(cells[1]).toMatchObject({ top: THIN, tl: SQUARE, tr: SQUARE });
  expect(cells[2]).toMatchObject({ top: THIN, bl: ROUND, br: ROUND, tl: SQUARE });
});

/**
 * The grid needs CSS `if()` with `style()` queries, which Firefox lacks. There
 * every cell keeps the full outer box — correct, just not joined, which is
 * exactly what the `.sherpa-group-grid` class does.
 * TRAP T-a-grid-group-needs-css-if
 */
test('a 3x2 grid rounds four outer corners and shares every inner edge', async ({ page }) => {
  const cells = await edges(page, 6, 'data-direction=grid data-col-count=3');
  const hasIf = await page.evaluate(() =>
    CSS.supports('width', 'if(style(--x: 1): 1px; else: 2px)'));

  if (!hasIf) {
    expect(cells.map((c) => c.tl)).toEqual(Array(6).fill(ROUND));
    return;
  }

  // Exactly four corners round, one per corner of the whole block.
  expect(cells[0]!.tl).toBe(ROUND);
  expect(cells[2]!.tr).toBe(ROUND);
  expect(cells[3]!.bl).toBe(ROUND);
  expect(cells[5]!.br).toBe(ROUND);
  expect(cells[1]).toMatchObject({ tl: SQUARE, tr: SQUARE, bl: SQUARE, br: SQUARE });
  expect(cells[4]).toMatchObject({ tl: SQUARE, tr: SQUARE, bl: SQUARE, br: SQUARE });
});

/** The whole point: no child carries a position, so a re-order needs nothing. */
test('a re-order needs nothing from the children', async ({ page }) => {
  await edges(page, 3);
  const after = await page.evaluate(async () => {
    const el = document.querySelector('sherpa-group')!;
    // Move the LAST child to the front. No attribute is touched.
    el.insertBefore(el.lastElementChild!, el.firstElementChild);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    return [...el.children].map((c) => {
      const s = getComputedStyle(c);
      return `${s.getPropertyValue('--sherpa-border-rounding-top-left').trim()}/${
        s.getPropertyValue('--sherpa-border-rounding-top-right').trim()}`;
    });
  });

  // The new first child owns the leading corners; the new last owns trailing.
  expect(after).toEqual([`${ROUND}/${SQUARE}`, `${SQUARE}/${SQUARE}`, `${SQUARE}/${ROUND}`]);
});

/** The component and the class it replaces must not disagree. */
test('it matches the .sherpa-group class exactly', async ({ page }) => {
  const r = await page.evaluate(async () => {
    await import('/dist/index.js');
    const root = document.getElementById('root')!;
    const read = (host: Element): string[] =>
      [...host.children].map((c) => {
        const s = getComputedStyle(c);
        return [
          s.getPropertyValue('--sherpa-border-left').trim(),
          s.getPropertyValue('--sherpa-border-right').trim(),
          s.getPropertyValue('--sherpa-border-rounding-top-left').trim(),
        ].join('|');
      });

    const el = document.createElement('sherpa-group') as HTMLElement & { rendered?: Promise<void> };
    el.innerHTML = '<i>0</i><i>1</i><i>2</i>';
    root.replaceChildren(el);
    await el.rendered;

    // The class only works inside a shadow root that adopts the shared sheets.
    const host = document.createElement('sherpa-button') as HTMLElement & {
      rendered?: Promise<void>;
    };
    root.appendChild(host);
    await host.rendered;
    const wrap = document.createElement('div');
    wrap.className = 'sherpa-group';
    wrap.innerHTML = '<i>0</i><i>1</i><i>2</i>';
    host.shadowRoot!.append(wrap);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    return { component: read(el), cls: read(wrap) };
  });

  expect(r.component).toEqual(r.cls);
});
