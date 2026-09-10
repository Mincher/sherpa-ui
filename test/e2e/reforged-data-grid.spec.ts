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
    await new Promise((res) => setTimeout(res, 10));
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
    await new Promise((res) => setTimeout(res, 10));

    const names = () =>
      Array.from(el.shadowRoot!.querySelectorAll('.body .row')).map((row) => row.querySelector('.cell')!.textContent);
    const scoreHeader = () =>
      Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>('.head-cell')).find(
        (h) => h.dataset['field'] === 'score',
      )!;

    scoreHeader().querySelector<HTMLElement>('.head-btn')!.click(); // asc by score
    await new Promise((res) => setTimeout(res, 10));
    const asc = names();
    const ascAttr = { field: el.dataset['sortField'], dir: el.dataset['sortDirection'] };

    scoreHeader().querySelector<HTMLElement>('.head-btn')!.click(); // desc
    await new Promise((res) => setTimeout(res, 10));
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
    await new Promise((res) => setTimeout(res, 10));

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
    await new Promise((res) => setTimeout(res, 10));
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
    await new Promise((resolve) => setTimeout(resolve, 40));

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
      await new Promise((resolve) => setTimeout(resolve, 20));
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
      await new Promise((res) => setTimeout(res, 20));
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
      await new Promise((res) => setTimeout(res, 20));
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
    await new Promise((res) => setTimeout(res, 20));
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
    await new Promise((res) => setTimeout(res, 20));

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
    await new Promise((res) => setTimeout(res, 20));

    const clicks: unknown[] = [];
    el.addEventListener('row-click', (e) => clicks.push((e as CustomEvent).detail));
    // Click the FIRST visible row. Its data-index is 0, which in the UNFILTERED
    // list would be Marcus — the wrong record.
    (sr.querySelector('.body .row .cell') as HTMLElement).click();
    await new Promise((res) => setTimeout(res, 20));
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
    await new Promise((res) => setTimeout(res, 20));
    const filtered = sr.querySelectorAll('.body .row').length;

    // New data may not even have that column. Carrying the filter over would hide
    // rows against a filter the user can no longer see.
    el.populate({
      columns: [{ field: 'other', header: 'Other' }],
      rows: [{ other: 'x' }, { other: 'y' }],
    });
    await new Promise((res) => setTimeout(res, 20));
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
    await new Promise((res) => setTimeout(res, 30));

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
    await new Promise((res) => setTimeout(res, 30));
    const folded = {
      ...read(),
      collapsed: first.hasAttribute('data-collapsed'),
      expanded: first.querySelector('.group-toggle')!.getAttribute('aria-expanded'),
    };

    // A re-render (here: a sort) must KEEP the fold — the flag lives on the
    // component, not on the rows it just replaced.
    el.dataset['sortField'] = 'name';
    await new Promise((res) => setTimeout(res, 30));
    const afterSort = { visible: read().visible, collapsed: sr.querySelector('.group-row')!.hasAttribute('data-collapsed') };

    // Un-grouping brings the column straight back, with no re-populate.
    delete el.dataset['groupField'];
    await new Promise((res) => setTimeout(res, 30));
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
