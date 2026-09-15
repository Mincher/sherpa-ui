import { test, expect } from '@playwright/test';

/** sherpa-data-grid — columns/rows from populate(); click-to-sort; row-click. */

const HARNESS = '/test/reforged/harness.html';

const CONFIG = {
  columns: [
    { field: 'name', header: 'Name' },
    { field: 'score', header: 'Score', type: 'number' },
  ],
  rows: [
    { name: 'Charlie', score: 30 },
    { name: 'Alice', score: 90 },
    { name: 'Bob', score: 60 },
  ],
};

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(() => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true);
});

test('renders header cells and a row per record', async ({ page }) => {
  const r = await page.evaluate(async (config) => {
    const el = document.createElement('sherpa-data-grid') as HTMLElement & {
      rendered?: Promise<void>;
      populate?: (d: unknown) => void;
    };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate!(config);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const sr = el.shadowRoot!;
    return {
      headers: Array.from(sr.querySelectorAll('.head-label')).map((h) => h.textContent),
      rows: sr.querySelectorAll('.body .row').length,
      firstCell: sr.querySelector('.body .row .cell')!.textContent,
      numericAlign: getComputedStyle(sr.querySelector('.cell[data-type="number"]')!).textAlign,
    };
  }, CONFIG);
  expect(r.headers).toEqual(['Name', 'Score']);
  expect(r.rows).toBe(3);
  expect(r.firstCell).toBe('Charlie'); // unsorted → source order
  expect(r.numericAlign).toBe('end'); // numeric column right-aligned
});

test('clicking a header sorts asc then desc and reflects the attributes', async ({ page }) => {
  const r = await page.evaluate(async (config) => {
    const el = document.createElement('sherpa-data-grid') as HTMLElement & {
      rendered?: Promise<void>;
      populate?: (d: unknown) => void;
    };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate!(config);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const names = () =>
      Array.from(el.shadowRoot!.querySelectorAll('.body .row')).map((row) => row.querySelector('.cell')!.textContent);
    const scoreHeader = () =>
      Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>('.head-cell')).find(
        (h) => h.dataset['field'] === 'score',
      )!;

    scoreHeader().querySelector<HTMLElement>('.head-btn')!.click(); // asc by score
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const asc = names();
    const ascAttr = { field: el.dataset['sortField'], dir: el.dataset['sortDirection'] };

    scoreHeader().querySelector<HTMLElement>('.head-btn')!.click(); // desc
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const desc = names();

    return { asc, ascAttr, desc };
  }, CONFIG);
  expect(r.asc).toEqual(['Charlie', 'Bob', 'Alice']); // 30, 60, 90
  expect(r.ascAttr).toEqual({ field: 'score', dir: 'asc' });
  expect(r.desc).toEqual(['Alice', 'Bob', 'Charlie']); // 90, 60, 30
});

test('clicking a row fires row-click with the record', async ({ page }) => {
  const r = await page.evaluate(async (config) => {
    const el = document.createElement('sherpa-data-grid') as HTMLElement & {
      rendered?: Promise<void>;
      populate?: (d: unknown) => void;
    };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate!(config);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    let row: Record<string, unknown> | null = null;
    el.addEventListener('row-click', (e) => (row = (e as CustomEvent).detail.row));
    el.shadowRoot!.querySelector<HTMLElement>('.body .row')!.click();
    return row;
  }, CONFIG);
  expect(r).toEqual({ name: 'Charlie', score: 30 });
});

test('an empty rows array shows the empty state', async ({ page }) => {
  const shown = await page.evaluate(async () => {
    const el = document.createElement('sherpa-data-grid') as HTMLElement & {
      rendered?: Promise<void>;
      populate?: (d: unknown) => void;
    };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate!({ columns: [{ field: 'x' }], rows: [] });
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    return {
      empty: el.hasAttribute('data-empty'),
      visible: getComputedStyle(el.shadowRoot!.querySelector('.empty')!).display !== 'none',
    };
  });
  expect(shown.empty).toBe(true);
  expect(shown.visible).toBe(true);
});

test('every cell type uses the Figma label typography, not the UA <th> bold', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const grid = document.createElement('sherpa-data-grid') as HTMLElement & {
      rendered?: Promise<void>;
      populate(config: unknown): void;
    };
    grid.setAttribute('data-filterable', '');
    grid.setAttribute('data-selectable', '');
    document.getElementById('root')!.appendChild(grid);
    await grid.rendered;
    grid.populate({
      columns: [
        { field: 'name', header: 'Name' },
        { field: 'qty', header: 'Qty', type: 'number' },
      ],
      rows: [{ name: 'Alpha', qty: 3 }],
    });
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const sr = grid.shadowRoot!;
    const read = (sel: string): Record<string, string> => {
      const el = sr.querySelector(sel);
      if (!el) return { missing: sel };
      const s = getComputedStyle(el);
      return { weight: s.fontWeight, style: s.fontStyle, size: s.fontSize,
               lh: s.lineHeight, align: s.textAlign };
    };
    return { headBtn: read('.head-btn'), filterInput: read('.filter-input'), cell: read('.body .row .cell') };
  });

  // Figma binds the label on EVERY Grid Cell type (group / header / cell / filter)
  // to content/weight/regular 400 · content/size/base 14 · line-height/base 20,
  // start-aligned and never italic. The header reads as a header because of its
  // darker surface band, not a heavier weight.
  //
  // A <th> ships `font-weight: bold` + `text-align: center` from the UA stylesheet,
  // and the filter input's `font: inherit` faithfully inherited that — so the
  // secondary header rendered at 700 while the header button sat at a hand-set 600.
  for (const [name, got] of Object.entries({ headBtn: r.headBtn, filterInput: r.filterInput, cell: r.cell })) {
    expect(got['missing'], `${name} selector found`).toBeUndefined();
    expect(got['weight'], `${name} weight`).toBe('400');
    expect(got['style'], `${name} style`).toBe('normal');
    expect(got['size'], `${name} size`).toBe('14px');
    expect(got['lh'], `${name} line-height`).toBe('20px');
    expect(got['align'], `${name} align`).toBe('start');
  }
});

/* ── Column filters ──────────────────────────────────────────────────────── */

/** A grid with two text columns and one numeric, so a mixed filter is exercised. */
const FILTER_CONFIG = {
  columns: [
    { field: 'name', header: 'Name' },
    { field: 'status', header: 'Status' },
    { field: 'spend', header: 'Spend', type: 'number' },
  ],
  rows: [
    { name: 'Marcus Reyes', status: 'trial', spend: 257 },
    { name: 'Omar Haddad', status: 'trial', spend: 805 },
    { name: 'Jane Okafor', status: 'active', spend: 120 },
    { name: 'Nina Berg', status: 'active', spend: 668 },
  ],
};

/**
 * Install an in-page grid builder on `window`, so each test can build one without
 * an `eval`'d string. Returns the element, already populated.
 */
interface GridEl extends HTMLElement {
  rendered?: Promise<void>;
  populate(config: unknown): void;
}
declare global {
  interface Window {
    __buildGrid(config: unknown): Promise<GridEl>;
  }
}

async function installBuilder(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(() => {
    window.__buildGrid = async (config: unknown) => {
      const root = document.getElementById('root')!;
      root.innerHTML = '';
      const el = document.createElement('sherpa-data-grid') as GridEl;
      el.setAttribute('data-filterable', '');
      root.appendChild(el);
      await el.rendered;
      el.populate(config);
      await (window as unknown as { __settled: () => Promise<void> }).__settled();
      return el;
    };
  });
}

test('typing in a filter narrows rows to substring matches in THAT column', async ({ page }) => {
  await installBuilder(page);
  const r = await page.evaluate(async (config) => {
    const el = await window.__buildGrid(config);
    const sr = el.shadowRoot!;
    const cell = (field: string): HTMLElement =>
      sr.querySelector(`.filter-cell[data-field="${field}"]`) as HTMLElement;
    const type = async (field: string, value: string): Promise<void> => {
      const input = cell(field).querySelector<HTMLInputElement>('.filter-input')!;
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      await (window as unknown as { __settled: () => Promise<void> }).__settled();
    };
    const names = (): (string | null)[] =>
      Array.from(sr.querySelectorAll('.body .row')).map((row) => row.children[1]!.textContent);

    const events: unknown[] = [];
    el.addEventListener('filter-change', (e) => events.push((e as CustomEvent).detail));

    await type('name', 'ar'); // substring, not prefix: Marcus AND Omar
    const substring = names();

    await type('name', 'MARCUS'); // case-insensitive
    const insensitive = names();

    await type('name', ''); // cleared → everything back
    const cleared = names();

    // A second column ANDs with the first.
    await type('status', 'trial');
    const oneFilter = names();
    await type('name', 'omar');
    const twoFilters = names();

    // A numeric column filters on its stringified value.
    await type('name', '');
    await type('status', '');
    await type('spend', '80');
    const numeric = names();

    return { substring, insensitive, cleared, oneFilter, twoFilters, numeric, events };
  }, FILTER_CONFIG);

  // Substring, so "ar" finds both "Marcus" and "Omar" — a table filter is a find,
  // not a prefix match.
  expect(r.substring).toEqual(['Marcus Reyes', 'Omar Haddad']);
  expect(r.insensitive).toEqual(['Marcus Reyes']);
  expect(r.cleared).toHaveLength(4);

  // Several filters must ALL match.
  expect(r.oneFilter).toEqual(['Marcus Reyes', 'Omar Haddad']);
  expect(r.twoFilters).toEqual(['Omar Haddad']);

  // Values are stringified, so a numeric column filters as readily as a text one.
  expect(r.numeric).toEqual(['Omar Haddad']);

  // The event still fires for callers driving a server-side query, and carries the
  // whole filter set plus the resulting count.
  const last = r.events[r.events.length - 1] as Record<string, unknown>;
  expect(last['field']).toBe('spend');
  expect(last['visible']).toBe(1);
  expect(last['filters']).toEqual({ spend: '80' });
});

test('a populated filter shows a clear button that empties only its own column', async ({ page }) => {
  await installBuilder(page);
  const r = await page.evaluate(async (config) => {
    const el = await window.__buildGrid(config);
    const sr = el.shadowRoot!;
    const cell = (field: string): HTMLElement =>
      sr.querySelector(`.filter-cell[data-field="${field}"]`) as HTMLElement;
    const clear = (field: string): HTMLElement =>
      cell(field).querySelector('.filter-clear') as HTMLElement;
    const shown = (el2: Element): boolean => getComputedStyle(el2).display !== 'none';
    const type = async (field: string, value: string): Promise<void> => {
      const input = cell(field).querySelector<HTMLInputElement>('.filter-input')!;
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      await (window as unknown as { __settled: () => Promise<void> }).__settled();
    };

    const empty = { clearShown: shown(clear('name')), flag: cell('name').hasAttribute('data-has-value') };

    await type('name', 'ar');
    await type('status', 'trial');
    const populated = {
      clearShown: shown(clear('name')),
      flag: cell('name').hasAttribute('data-has-value'),
      // It sits INSIDE the input's box, at its trailing edge. The box (border,
      // padding, radius, focus ring) is on `.filter-field`, not the <input>, which
      // is what puts the button within the border rather than beside it.
      insideBorder: (() => {
        const f = cell('name').querySelector('.filter-field')!.getBoundingClientRect();
        const c = clear('name').getBoundingClientRect();
        return c.left >= f.left && c.right <= f.right && c.top >= f.top && c.bottom <= f.bottom;
      })(),
      // …and the text stops before it, so a long value cannot run underneath.
      textStopsBeforeButton: (() => {
        const i = cell('name').querySelector('.filter-input')!.getBoundingClientRect();
        const c = clear('name').getBoundingClientRect();
        return i.right <= c.left + 1;
      })(),
      // The <input> must carry no box of its own, or there would be two.
      inputHasNoBox: (() => {
        const cs = getComputedStyle(cell('name').querySelector('.filter-input')!);
        return cs.borderTopWidth === '0px' && cs.paddingLeft === '0px';
      })(),
      rows: sr.querySelectorAll('.body .row').length,
    };

    clear('name').click();
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const afterClear = {
      nameValue: cell('name').querySelector<HTMLInputElement>('.filter-input')!.value,
      nameClearShown: shown(clear('name')),
      // The OTHER column's filter must survive.
      statusValue: cell('status').querySelector<HTMLInputElement>('.filter-input')!.value,
      rows: sr.querySelectorAll('.body .row').length,
    };

    return { empty, populated, afterClear };
  }, FILTER_CONFIG);

  // Hidden until there is something to clear.
  expect(r.empty.clearShown).toBe(false);
  expect(r.empty.flag).toBe(false);

  expect(r.populated.clearShown).toBe(true);
  expect(r.populated.flag).toBe(true);
  expect(r.populated.insideBorder).toBe(true);
  expect(r.populated.textStopsBeforeButton).toBe(true);
  expect(r.populated.inputHasNoBox).toBe(true);
  expect(r.populated.rows).toBe(2); // name "ar" AND status "trial"

  // Clearing empties ITS field only; the status filter still applies, so the two
  // trial rows remain rather than all four.
  expect(r.afterClear.nameValue).toBe('');
  expect(r.afterClear.nameClearShown).toBe(false);
  expect(r.afterClear.statusValue).toBe('trial');
  expect(r.afterClear.rows).toBe(2);
});

test('a filter matching nothing keeps the filter row usable', async ({ page }) => {
  await installBuilder(page);
  const r = await page.evaluate(async (config) => {
    const el = await window.__buildGrid(config);
    const sr = el.shadowRoot!;
    const input = sr.querySelector<HTMLInputElement>(
      '.filter-cell[data-field="name"] .filter-input',
    )!;
    input.value = 'zzzzzz';
    input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const shown = (sel: string): boolean => {
      const node = sr.querySelector(sel);
      return !!node && getComputedStyle(node).display !== 'none';
    };
    return {
      rows: sr.querySelectorAll('.body .row').length,
      // data-empty would hide the whole <table> and take the input with it.
      hostEmpty: el.hasAttribute('data-empty'),
      hostNoMatches: el.hasAttribute('data-no-matches'),
      tableShown: shown('.grid'),
      filterRowShown: shown('.filter-row'),
      noMatchesShown: shown('.no-matches'),
      emptyShown: shown('.empty'),
      // The field the user is typing in must still hold focus-worthy state.
      inputValue: input.value,
    };
  }, FILTER_CONFIG);

  expect(r.rows).toBe(0);
  // The distinction that matters: no-matches is NOT empty.
  expect(r.hostEmpty).toBe(false);
  expect(r.hostNoMatches).toBe(true);
  expect(r.tableShown).toBe(true);
  expect(r.filterRowShown).toBe(true);
  expect(r.noMatchesShown).toBe(true);
  expect(r.emptyShown).toBe(false);
  expect(r.inputValue).toBe('zzzzzz');
});

test('row-click resolves against the FILTERED list, not the full one', async ({ page }) => {
  await installBuilder(page);
  const r = await page.evaluate(async (config) => {
    const el = await window.__buildGrid(config);
    const sr = el.shadowRoot!;
    const input = sr.querySelector<HTMLInputElement>(
      '.filter-cell[data-field="status"] .filter-input',
    )!;
    input.value = 'active'; // leaves Jane (index 2) and Nina (index 3) of the full list
    input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const clicks: unknown[] = [];
    el.addEventListener('row-click', (e) => clicks.push((e as CustomEvent).detail));
    // Click the FIRST visible row. Its data-index is 0, which in the UNFILTERED
    // list would be Marcus — the wrong record.
    (sr.querySelector('.body .row .cell') as HTMLElement).click();
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    return { clicks };
  }, FILTER_CONFIG);

  expect(r.clicks).toHaveLength(1);
  const detail = r.clicks[0] as { index: number; row: Record<string, unknown> };
  expect(detail.index).toBe(0);
  expect(detail.row['name']).toBe('Jane Okafor');
});

test('re-populating clears stale filters', async ({ page }) => {
  await installBuilder(page);
  const r = await page.evaluate(async (config) => {
    const el = await window.__buildGrid(config);
    const sr = el.shadowRoot!;
    const input = sr.querySelector<HTMLInputElement>(
      '.filter-cell[data-field="name"] .filter-input',
    )!;
    input.value = 'marcus';
    input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const filtered = sr.querySelectorAll('.body .row').length;

    // New data may not even have that column. Carrying the filter over would hide
    // rows against a filter the user can no longer see.
    el.populate({
      columns: [{ field: 'other', header: 'Other' }],
      rows: [{ other: 'x' }, { other: 'y' }],
    });
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    return {
      filtered,
      afterRepopulate: sr.querySelectorAll('.body .row').length,
      anyValueFlag: !!sr.querySelector('.filter-cell[data-has-value]'),
    };
  }, FILTER_CONFIG);

  expect(r.filtered).toBe(1);
  expect(r.afterRepopulate).toBe(2);
  expect(r.anyValueFlag).toBe(false);
});

test('data-group-field bunches the rows, hides that column, and folds', async ({ page }) => {
  // Figma Grid Cell `Type=group` (template 926:35309): a full-width 32-tall row
  // with a checkbox, a chevron toggle and the group's value as its label. The
  // grouped column drops out — its value IS the heading now.
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-data-grid') as HTMLElement & {
      rendered?: Promise<void>;
      populate(d: unknown): void;
    };
    el.setAttribute('data-selectable', '');
    document.getElementById('root')!.replaceChildren(el);
    await el.rendered;
    el.populate({
      columns: [
        { field: 'name', header: 'Name' },
        { field: 'team', header: 'Team' },
      ],
      rows: [
        { name: 'Ana', team: 'Blue' },
        { name: 'Bo', team: 'Red' },
        { name: 'Cy', team: 'Blue' },
      ],
    });
    el.dataset['groupField'] = 'team';
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const sr = el.shadowRoot!;
    const read = () => ({
      headers: Array.from(sr.querySelectorAll('.head-label')).map((h) => h.textContent),
      groups: Array.from(sr.querySelectorAll('.group-row')).map((g) => ({
        label: g.querySelector('.group-label')!.textContent,
        count: g.querySelector('.group-count')!.textContent,
        // +1 for the leading selection column, so the group row is exactly as
        // wide as the rows below it.
        colspan: g.querySelector<HTMLTableCellElement>('.group-cell')!.colSpan,
      })),
      // The grouped column's cells are gone too — one column, not two.
      cellsPerRow: sr.querySelector('.row')!.children.length,
      // Rows sharing a group value must be ADJACENT: that is what lets the render
      // find each group in one pass over the sorted rows.
      order: Array.from(sr.querySelectorAll('.row')).map((row) => row.children[1]!.textContent),
      visible: Array.from(sr.querySelectorAll('.row')).filter(
        (row) => getComputedStyle(row).display !== 'none',
      ).length,
    });
    const grouped = read();

    // Fold the first group shut.
    const first = sr.querySelector<HTMLElement>('.group-row')!;
    first.querySelector<HTMLElement>('.group-toggle')!.click();
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const folded = {
      ...read(),
      collapsed: first.hasAttribute('data-collapsed'),
      expanded: first.querySelector('.group-toggle')!.getAttribute('aria-expanded'),
    };

    // A re-render (here: a sort) must KEEP the fold — the flag lives on the
    // component, not on the rows it just replaced.
    el.dataset['sortField'] = 'name';
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const afterSort = { visible: read().visible, collapsed: sr.querySelector('.group-row')!.hasAttribute('data-collapsed') };

    // Un-grouping brings the column straight back, with no re-populate.
    delete el.dataset['groupField'];
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const ungrouped = { headers: read().headers, groups: read().groups.length };

    return { grouped, folded, afterSort, ungrouped };
  });

  // The grouped column is gone from the header.
  expect(r.grouped.headers).toEqual(['Name']);
  expect(r.grouped.cellsPerRow).toBe(2); // select cell + the one remaining column
  expect(r.grouped.groups).toEqual([
    { label: 'Blue', count: '2', colspan: 2 },
    { label: 'Red', count: '1', colspan: 2 },
  ]);
  expect(r.grouped.order).toEqual(['Ana', 'Cy', 'Bo']); // Blue rows adjacent
  expect(r.grouped.visible).toBe(3);

  // Folded: the group's rows are hidden by CSS off the row flag.
  expect(r.folded.collapsed).toBe(true);
  expect(r.folded.expanded).toBe('false');
  expect(r.folded.visible).toBe(1); // only Red's single row

  // The fold survives a re-render.
  expect(r.afterSort.collapsed).toBe(true);
  expect(r.afterSort.visible).toBe(1);

  // Un-grouping restores the column without re-populating.
  expect(r.ungrouped.headers).toEqual(['Name', 'Team']);
  expect(r.ungrouped.groups).toBe(0);
});

test('a group checkbox selects every row in that group', async ({ page }) => {
  // The group row is a heading for its rows, so its box is their select-all.
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-data-grid') as HTMLElement & {
      rendered?: Promise<void>;
      populate(d: unknown): void;
    };
    el.setAttribute('data-selectable', '');
    document.getElementById('root')!.replaceChildren(el);
    await el.rendered;
    el.populate({
      columns: [{ field: 'name', header: 'Name' }, { field: 'team', header: 'Team' }],
      rows: [
        { name: 'Ana', team: 'Blue' },
        { name: 'Bo', team: 'Red' },
        { name: 'Cy', team: 'Blue' },
      ],
    });
    el.dataset['groupField'] = 'team';
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const sr = el.shadowRoot!;
    let emitted: string[] = [];
    el.addEventListener('selection-change', (e) => {
      emitted = (e as CustomEvent).detail.selected;
    });

    const rowsIn = (key: string) =>
      Array.from(sr.querySelectorAll<HTMLElement>('.row')).filter((r) => r.dataset['group'] === key);
    const checkedIn = (key: string) =>
      rowsIn(key).filter((r) => r.querySelector<HTMLInputElement>('.row-select')!.checked).length;

    // Tick the Blue group's box.
    const blueBox = sr.querySelector<HTMLInputElement>('.group-row[data-group="Blue"] .group-select')!;
    blueBox.click();
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const selected = {
      blue: checkedIn('Blue'),
      blueTotal: rowsIn('Blue').length,
      // Only THAT group — a group box is not a select-all for the table.
      red: checkedIn('Red'),
      emitted: emitted.length,
    };

    // Untick one Blue row: the group box must go INDETERMINATE, not stay checked.
    rowsIn('Blue')[0]!.querySelector<HTMLInputElement>('.row-select')!.click();
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const partial = { checked: blueBox.checked, indeterminate: blueBox.indeterminate };

    // Click the INDETERMINATE box: the browser resolves it to CHECKED (that is
    // native checkbox behaviour, not something to fight), so the group fills back
    // up. A second click then clears it.
    blueBox.click();
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const refilled = { blue: checkedIn('Blue'), emitted: emitted.length };
    blueBox.click();
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const cleared = { blue: checkedIn('Blue'), emitted: emitted.length };

    // The header select-all fills every group box in.
    sr.querySelector<HTMLInputElement>('.select-all')!.click();
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const all = {
      groups: Array.from(sr.querySelectorAll<HTMLInputElement>('.group-select')).map((b) => b.checked),
    };

    return { selected, partial, refilled, cleared, all };
  });

  expect(r.selected).toEqual({ blue: 2, blueTotal: 2, red: 0, emitted: 2 });
  // A part-selected group reads as indeterminate, so the box never lies about its rows.
  expect(r.partial).toEqual({ checked: false, indeterminate: true });
  expect(r.refilled).toEqual({ blue: 2, emitted: 2 });
  expect(r.cleared).toEqual({ blue: 0, emitted: 0 });
  expect(r.all.groups).toEqual([true, true]);
});


test('a numeric column right-aligns its HEADER with its digits', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const grid = document.createElement('sherpa-data-grid') as HTMLElement & {
      rendered?: Promise<void>;
      populate(d: unknown): void;
    };
    grid.setAttribute('data-filterable', '');
    document.getElementById('root')!.appendChild(grid);
    await grid.rendered;
    grid.populate({
      columns: [
        { field: 'name', header: 'Name' },
        { field: 'seats', header: 'Seats', type: 'number' },
      ],
      rows: [{ name: 'Acme', seats: 42 }],
    });
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const sr = grid.shadowRoot!;
    const pick = (field: string) => {
      const th = sr.querySelector(`.head-cell[data-field="${field}"]`) as HTMLElement;
      const td = sr.querySelector(`.cell[data-type], .row .cell`) as HTMLElement;
      return {
        type: th.dataset['type'] ?? null,
        header: getComputedStyle(th.querySelector('.head-btn')!).justifyContent,
        filter: getComputedStyle(
          sr.querySelector(`.filter-cell[data-field="${field}"] .filter-input`)!,
        ).textAlign,
      };
    };
    const cell = sr.querySelector('.cell[data-type="number"]') as HTMLElement;
    return { name: pick('name'), seats: pick('seats'), cellAlign: getComputedStyle(cell).textAlign };
  });

  // The cells were already right-aligned; the HEADER was not, so a column of
  // digits sat under a left-aligned heading and read as a different column.
  expect(r.cellAlign).toBe('end');
  expect(r.seats.type).toBe('number');
  expect(r.seats.header).toBe('flex-end');
  // …and the filter input above them agrees, for the same reason.
  expect(r.seats.filter).toBe('end');

  // A text column is untouched.
  expect(r.name.type).toBe(null);
  expect(r.name.header).not.toBe('flex-end');
});

test('the scroller FILLS a sized host, and still scrolls inside it', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const box = document.createElement('div');
    box.style.cssText = 'block-size:300px;inline-size:600px;display:flex;';
    const grid = document.createElement('sherpa-data-grid') as HTMLElement & {
      rendered?: Promise<void>;
      populate(d: unknown): void;
    };
    box.appendChild(grid);
    document.getElementById('root')!.appendChild(box);
    await grid.rendered;
    grid.populate({
      columns: [{ field: 'name', header: 'Name' }],
      rows: Array.from({ length: 40 }, (_, i) => ({ name: `Row ${i}` })),
    });
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const sc = grid.shadowRoot!.querySelector('.scroller') as HTMLElement;
    const gridH = grid.getBoundingClientRect().height;
    const scH = sc.getBoundingClientRect().height;
    sc.scrollTop = 120;
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    return {
      hostH: gridH,
      scrollerH: scH,
      // The only difference should be the host's own 0.5px border, top and bottom.
      shortfall: +(gridH - scH).toFixed(1),
      canScroll: sc.scrollHeight > sc.clientHeight,
      scrolled: sc.scrollTop,
    };
  });

  // FILLS. Without `flex: 1 1 auto` the scroller sized to its CONTENT, so in a
  // fixed-height panel the rows stopped short of the grid's own bottom edge and
  // left a white band under them.
  expect(r.hostH).toBeCloseTo(300, 0);
  expect(r.shortfall).toBeLessThanOrEqual(2);

  // …and still scrolls. `min-block-size: 0` is the other half: a flex child
  // floors at its content size, so without it the box would refuse to shrink
  // below the full row list and the scroll would never engage.
  expect(r.canScroll).toBe(true);
  expect(r.scrolled).toBe(120);
});

/**
 * Columns are a SET width, not a measured one.
 *
 * Under the old `table-layout: auto` the longest value in a column set that
 * column's size, so one long customer name pushed every other column out and the
 * grid scrolled sideways for a single row. The fix is a <colgroup> read under
 * `table-layout: fixed`, which makes the label truncate inside its column instead.
 */
test('a long value truncates inside its column instead of widening it', async ({ page }) => {
  await installBuilder(page);
  const r = await page.evaluate(async () => {
    const el = await window.__buildGrid({
      columns: [{ field: 'name', header: 'Name' }, { field: 'note', header: 'Note' }],
      rows: [
        { name: 'Jo', note: 'short' },
        { name: 'A name far longer than any column should ever grow to fit', note: 'x' },
      ],
    });
    const sr = el.shadowRoot!;
    const heads = Array.from(sr.querySelectorAll('.head-cell')).map((h) =>
      Math.round(h.getBoundingClientRect().width),
    );
    const long = Array.from(sr.querySelectorAll<HTMLElement>('.row .cell')).find((c) =>
      (c.textContent ?? '').startsWith('A name far'),
    )!;
    return {
      heads,
      tableLayout: getComputedStyle(sr.querySelector('.grid')!).tableLayout,
      // The value overflows its box — which is exactly what an ellipsis means.
      clipped: long.scrollWidth > long.clientWidth,
      ellipsis: getComputedStyle(long).textOverflow,
      // `clip`, not `hidden`: the last pinned cell paints its scroll shadow as an
      // ::after standing OUTSIDE its trailing edge, and `hidden` clipped it away.
      overflow: getComputedStyle(long).overflow,
    };
  });

  expect(r.tableLayout).toBe('fixed');
  // Both columns are the default width — the long value changed nothing.
  expect(r.heads).toEqual([160, 160]);
  expect(r.clipped).toBe(true);
  expect(r.ellipsis).toBe('ellipsis');
  expect(r.overflow).toBe('clip');
});

/**
 * Dragging a header's trailing grip resizes that column, clamped to the 8px-grid
 * bounds — and does NOT sort it. The grip sits on top of the sort button, so the
 * browser synthesises a click on pointerup that the header would otherwise read
 * as a sort; #onGripUp swallows exactly one.
 */
test('the header grip resizes a column, clamps it, and does not sort', async ({ page }) => {
  await installBuilder(page);
  await page.evaluate(async () => {
    await window.__buildGrid({
      columns: [{ field: 'name', header: 'Name' }, { field: 'note', header: 'Note' }],
      rows: [{ name: 'Jo', note: 'x' }],
    });
  });

  const gripCentre = async (i: number): Promise<{ x: number; y: number }> =>
    page.evaluate((n) => {
      const th = Array.from(
        document.querySelector('sherpa-data-grid')!.shadowRoot!.querySelectorAll('.head-cell'),
      )[n]!;
      const r = th.querySelector('.resize-grip')!.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }, i);

  const width = async (i: number): Promise<number> =>
    page.evaluate(
      (n) =>
        Math.round(
          Array.from(
            document.querySelector('sherpa-data-grid')!.shadowRoot!.querySelectorAll('.head-cell'),
          )[n]!.getBoundingClientRect().width,
        ),
      i,
    );

  const sortField = async (): Promise<string | null> =>
    page.evaluate(() => document.querySelector('sherpa-data-grid')!.getAttribute('data-sort-field'));

  const drag = async (i: number, dx: number): Promise<void> => {
    const g = await gripCentre(i);
    await page.mouse.move(g.x, g.y);
    await page.mouse.down();
    await page.mouse.move(g.x + dx, g.y, { steps: 10 });
    await page.mouse.up();
    await page.evaluate(() => (window as unknown as { __settled: () => Promise<void> }).__settled());
  };

  expect(await width(0)).toBe(160);

  await drag(0, 80);
  expect(await width(0)).toBe(240);
  // The drag must NOT have sorted the column it grabbed.
  expect(await sortField()).toBeNull();

  // Clamped at both ends, on the 8px grid.
  await drag(0, -500);
  expect(await width(0)).toBe(96);
  await drag(0, 900);
  expect(await width(0)).toBe(480);

  // …and a REAL header click straight after a resize still sorts. The click
  // suppressor is `once`, so it eats the synthesised click and nothing more.
  await page.evaluate(() => {
    const th = Array.from(
      document.querySelector('sherpa-data-grid')!.shadowRoot!.querySelectorAll('.head-cell'),
    )[0]!;
    th.querySelector<HTMLElement>('.head-btn')!.click();
  });
  await page.evaluate(() => (window as unknown as { __settled: () => Promise<void> }).__settled());
  expect(await sortField()).toBe('name');
});

/**
 * data-select="single" — the grid picks ONE row.
 *
 * Radios, not checkboxes: the native type buys the group behaviour, so the
 * browser unticks the previous row and arrow keys move the choice. And no
 * control in the header, because "select all" is meaningless where only one can
 * be chosen — a lone checkbox there would offer something the grid cannot do.
 */
test('data-select="single" draws radios, holds one row, and drops the select-all', async ({
  page,
}) => {
  await installBuilder(page);
  const r = await page.evaluate(async () => {
    const settle = (): Promise<void> =>
      (window as unknown as { __settled: () => Promise<void> }).__settled();

    const run = async (single: boolean): Promise<Record<string, unknown>> => {
      const el = await window.__buildGrid({
        columns: [{ field: 'name', header: 'Name' }],
        rows: [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
      });
      el.setAttribute('data-selectable', '');
      if (single) el.setAttribute('data-select', 'single');
      await settle();

      const sr = el.shadowRoot!;
      const boxes = (): HTMLInputElement[] => [...sr.querySelectorAll('.row-select')];
      const shown = (sel: string): boolean => {
        const n = sr.querySelector(sel);
        return !!n && getComputedStyle(n).display !== 'none';
      };

      const before = {
        type: boxes()[0]?.type,
        // One NAME per grid, so two grids on a page cannot share a group and
        // steal each other's selection.
        names: [...new Set(boxes().map((b) => b.name))].length,
        selectAll: shown('.select-all'),
        // The CELL stays — it holds the column open so the radios line up.
        headCell: shown('.select-head'),
      };

      let detail: unknown = null;
      el.addEventListener('selection-change', (e) => {
        detail = (e as CustomEvent).detail;
      });

      boxes()[0]!.click();
      await settle();
      boxes()[2]!.click();
      await settle();

      return {
        ...before,
        ticked: boxes().filter((b) => b.checked).length,
        reported: (detail as { selected: string[] } | null)?.selected.length ?? null,
      };
    };

    return { multi: await run(false), single: await run(true) };
  });

  // MULTIPLE is unchanged: checkboxes, a select-all, and both picks held.
  expect(r.multi.type).toBe('checkbox');
  expect(r.multi.selectAll).toBe(true);
  expect(r.multi.ticked).toBe(2);
  expect(r.multi.reported).toBe(2);

  // SINGLE: radios in one group, no select-all, one row held.
  expect(r.single.type).toBe('radio');
  expect(r.single.names).toBe(1);
  expect(r.single.selectAll).toBe(false);
  // …and the column is still open, so the radios line up under the header.
  expect(r.single.headCell).toBe(true);
  expect(r.single.ticked).toBe(1);
  expect(r.single.reported).toBe(1);
});
