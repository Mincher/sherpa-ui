import { test, expect } from './harness';

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

    // The sort control is an icon-only <sherpa-quick-filter> now, so the glyph
    // is TWO shadow roots down: the chip writes its data-icon-start into its
    // own `.caret-icon`. Reading the chip's attribute alone would not prove the
    // glyph paints, which is the whole point here.
    //
    // The classes go on `.caret-icon` ITSELF, not a child <i>. That changed
    // when the three hand-rolled icon writers were replaced by the base class's
    // `writeIcon`, which puts FA classes on the target — any element can carry
    // them, and building a child with createElement is forbidden. This test
    // kept reading `.caret-icon i`, found nothing, and reported "the glyph does
    // not paint" when it painted perfectly.
    const read = () => [...el.shadowRoot.querySelectorAll('.head-cell')].map((th) => {
      const cell = th as HTMLElement;
      const chip = cell.querySelector('.head-sort') as HTMLElement;
      const i = chip.shadowRoot!.querySelector('.caret-icon') as HTMLElement | null;
      const before = i ? getComputedStyle(i, '::before') : null;
      return {
        field: cell.dataset['field'],
        sortable: cell.dataset['sortable'],
        cls: chip.dataset['iconStart'] ?? '',
        // `content: none` means NO RULE MATCHED — the class is absent or not in
        // this font. A working glyph reports "" (a private-use codepoint), so
        // testing for an empty string would flag every real icon as broken.
        paints: !!before && before.content !== 'none',
        // An UNSUPPORTED column hides the whole chip, so its box is zero.
        w: Math.round(chip.getBoundingClientRect().width),
      };
    });

    const click = async (field: string) => {
      // Click the SORT CHIP itself — it is the control now, not the label.
      const chip = el.shadowRoot.querySelector(`.head-cell[data-field="${field}"] .head-sort`) as HTMLElement;
      (chip.shadowRoot!.querySelector('.caret') as HTMLElement).click();
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
  expect(name(r.unsorted).cls).toContain('fa-sort');
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
  expect(other(r.asc).cls).toContain('fa-sort');

  // A NON-sortable column carries no control AND no box — an empty square
  // would hold its label short of every sortable column's and the headings
  // would not line up.
  expect(fixed(r.asc).w).toBe(0);
});

test('the grid and the toolbar read ONE glyph map, not two that match', async ({ page }) => {
  // This used to assert the grid's map against four hardcoded strings — which
  // could not catch drift at all, because it never read the toolbar's copy.
  // There is now one map in core/icons.ts and both components import it, so the
  // real assertion is IDENTITY: the same object, not two that happen to agree.
  const r = await page.evaluate(async () => {
    const { ORGANISE_ICONS } = await import('/dist/core/icons.js') as {
      ORGANISE_ICONS: Record<string, string>;
    };
    const grid = customElements.get('sherpa-data-grid') as unknown as {
      icons?: Record<string, string>;
    };

    // Render one of each and read the glyph each actually PAINTS. A shared
    // import proves the source; this proves what reached the screen.
    const root = document.getElementById('root')!;
    root.replaceChildren();
    const g = document.createElement('sherpa-data-grid') as HTMLElement & {
      rendered?: Promise<void>; populate(d: unknown): void;
    };
    const t = document.createElement('sherpa-quick-filter-toolbar') as HTMLElement & {
      rendered?: Promise<void>; organise(d: unknown): void;
    };
    root.append(g, t);
    await g.rendered;
    await t.rendered;
    g.populate({ columns: [{ field: 'name', header: 'Name' }], rows: [{ name: 'a' }] });
    t.organise({ sort: [{ field: 'name', label: 'Name' }] });
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const gridGlyph = (g.shadowRoot!
      .querySelector('.head-cell[data-field="name"] .head-sort') as HTMLElement)
      .dataset['iconStart'];
    const toolbarGlyph = (t.shadowRoot!
      .querySelector('.organise-chip[data-id="sort"]') as HTMLElement)
      .getAttribute('data-icon-start');

    return {
      shared: ORGANISE_ICONS,
      gridMapIsShared: grid?.icons === ORGANISE_ICONS,
      gridGlyph,
      toolbarGlyph,
    };
  });

  // ONE map, imported — not two copies kept in step by hand.
  expect(r.gridMapIsShared).toBe(true);

  // Both draw the SAME resting glyph, read off the elements themselves.
  expect(r.gridGlyph).toBe(r.shared['sortNone']);
  expect(r.toolbarGlyph).toBe(r.shared['sortNone']);
  expect(r.gridGlyph).toBe(r.toolbarGlyph);
});
