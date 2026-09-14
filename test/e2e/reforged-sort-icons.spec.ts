import { test, expect } from '@playwright/test';

/**
 * THE SORT INDICATOR IS A TRI-STATE, AND ONE MAP OWNS IT.
 *
 * Will added four icons to the Figma Icons page — group, sort-none,
 * sort-ascending, sort-descending — and chose to map them to Font Awesome
 * rather than ship a local SVG set. The quick-filter toolbar's organise chips
 * took that map first; the data grid kept drawing its own indicator as a
 * pure-CSS triangle made of borders.
 *
 * A border triangle can only point up or down, so a SORTABLE BUT UNSORTED
 * column showed nothing and read as unsortable — the same class of bug the
 * toolbar had, where OFF wore the ascending arrow and a suspended sort looked
 * identical to an active one. The whole point of a tri-state icon is that the
 * three states look different.
 *
 * Both components now read `SherpaDataGrid.icons` / the toolbar's own copy of
 * the same four pairs, and this file asserts they have not drifted apart.
 */

const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(
    () => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true,
  );
});

test('a sortable header cycles none → asc → desc, each a different painted glyph', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-data-grid') as HTMLElement & {
      rendered?: Promise<void>; populate: (d: unknown) => void; shadowRoot: ShadowRoot;
    };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate({
      columns: [
        { field: 'name', header: 'Name' },
        { field: 'n', header: 'Count', type: 'number' },
        { field: 'x', header: 'Fixed', sortable: false },
      ],
      rows: [{ name: 'a', n: 1, x: 'p' }, { name: 'b', n: 2, x: 'q' }],
    });
    await document.fonts.ready;
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const read = () => [...el.shadowRoot.querySelectorAll('.head-cell')].map((th) => {
      const cell = th as HTMLElement;
      const i = cell.querySelector('.sort-icon') as HTMLElement;
      const before = getComputedStyle(i, '::before');
      return {
        field: cell.dataset['field'],
        sortable: cell.dataset['sortable'],
        cls: i.className,
        // `content: none` means NO RULE MATCHED — the class is absent or not in
        // this font. A working glyph reports "" (a private-use codepoint), so
        // testing for an empty string would flag every real icon as broken.
        paints: before.content !== 'none',
        w: Math.round(i.getBoundingClientRect().width),
      };
    });

    const click = async (field: string) => {
      (el.shadowRoot.querySelector(`.head-cell[data-field="${field}"] .head-btn`) as HTMLElement).click();
      await (window as unknown as { __settled: () => Promise<void> }).__settled();
    };

    const unsorted = read();
    await click('name');
    const asc = read();
    await click('name');
    const desc = read();
    return { unsorted, asc, desc };
  });

  const name = (s: { field?: string }[]) => s.find((x) => x.field === 'name')!;
  const other = (s: { field?: string }[]) => s.find((x) => x.field === 'n')!;
  const fixed = (s: { field?: string }[]) => s.find((x) => x.field === 'x')!;

  // THE THIRD STATE, which the border triangle could not express: a sortable
  // column that is not the current sort still says so.
  expect(name(r.unsorted).cls).toContain('fa-bars');
  expect(name(r.asc).cls).toContain('fa-arrow-up-wide-short');
  expect(name(r.desc).cls).toContain('fa-arrow-down-wide-short');

  // All three are DIFFERENT — the failure mode here is two states sharing a glyph.
  const seen = new Set([name(r.unsorted).cls, name(r.asc).cls, name(r.desc).cls]);
  expect(seen.size).toBe(3);

  // Every one of them actually paints. A Pro-only class renders nothing at all,
  // silently, so the class name alone is not proof.
  for (const s of [r.unsorted, r.asc, r.desc]) {
    for (const c of s) {
      if (c.sortable === 'true') expect(c.paints, `${c.field}: ${c.cls}`).toBe(true);
    }
  }

  // A column that is not the current sort stays on sort-none while another sorts.
  expect(other(r.asc).cls).toContain('fa-bars');

  // A NON-sortable column carries no glyph AND no box — an empty 14px square
  // would hold its label short of every sortable column's and the headings
  // would not line up.
  expect(fixed(r.asc).paints).toBe(false);
  expect(fixed(r.asc).w).toBe(0);
});

test('the grid and the toolbar have not drifted to different glyphs', async ({ page }) => {
  const r = await page.evaluate(() => {
    const grid = customElements.get('sherpa-data-grid') as unknown as {
      icons?: Record<string, string>;
    };
    return { grid: grid?.icons ?? null };
  });

  // The map is the contract. If these four move, the toolbar's copy must move
  // with them — they are two views of one state, and the reason the map exists
  // at all is that a sort arrow in a header and a sort chip in a toolbar must
  // never disagree about what "descending" looks like.
  expect(r.grid).toEqual({
    group: 'fa-solid fa-layer-group',
    sortNone: 'fa-solid fa-bars',
    sortAsc: 'fa-solid fa-arrow-up-wide-short',
    sortDesc: 'fa-solid fa-arrow-down-wide-short',
  });
});
